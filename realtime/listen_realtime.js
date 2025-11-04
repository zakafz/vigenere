/*
vigenere/realtime/listen_realtime.js

Realtime listener and WebSocket relay for Vigenère.

- Listens to Postgres NOTIFY channel `new_message`.
- On receiving a notification, queries the DB for message and session metadata,
  determines recipient(s), and forwards the encrypted envelope to connected WebSocket clients
  that have authenticated with their `account_number`.
- Provides a small WebSocket server where clients connect and send:
    { "type": "auth", "account_number": "1234567890123456" }
  to register for push notifications.
- Safe for local/dev usage. For production, run this as a long-running process (PM2, systemd, container).
- Environment variables:
    DATABASE_URL - required, Postgres connection string (use Supabase connection string)
    WS_PORT      - optional, default 8080
    PG_CHANNEL   - optional, default 'new_message'
    LOG_LEVEL    - optional, 'debug'|'info'|'warn'|'error' (default 'info')

Dependencies:
  npm install pg ws dotenv

Usage:
  node vigenere/realtime/listen_realtime.js

Notes:
- This process holds a persistent Postgres connection for LISTEN/NOTIFY.
- The DB schema expected:
  - messages(id, session_id, sender_account_number, ciphertext, message_metadata, created_at)
  - sessions(id, a_account_number, b_account_number)
- This program does not decrypt messages; it forwards the opaque ciphertext as-is.
- For multi-instance deployment, replace in-memory client registry with a distributed presence layer (Redis).
*/

import dotenv from "dotenv";
dotenv.config();

import { Client as PgClient, Pool as PgPool } from "pg";
import WebSocket, { WebSocketServer } from "ws";

/* Configuration */
const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL not set. Exiting.");
  process.exit(1);
}
const WS_PORT = Number(process.env.WS_PORT || 8080);
const PG_CHANNEL = process.env.PG_CHANNEL || "new_message";
const LOG_LEVEL = process.env.LOG_LEVEL || "info";

function logDebug(...args) {
  if (["debug"].includes(LOG_LEVEL)) console.debug("[debug]", ...args);
}
function logInfo(...args) {
  if (["debug", "info"].includes(LOG_LEVEL)) console.info("[info]", ...args);
}
function logWarn(...args) {
  if (["debug", "info", "warn"].includes(LOG_LEVEL)) console.warn("[warn]", ...args);
}
function logError(...args) {
  console.error("[error]", ...args);
}

/* In-memory registry: account_number => Set of WebSocket connections */
const connectionsByAccount = new Map();

/* Helper: add connection for account */
function addConnection(accountNumber, ws) {
  if (!connectionsByAccount.has(accountNumber)) connectionsByAccount.set(accountNumber, new Set());
  connectionsByAccount.get(accountNumber).add(ws);
  ws.__vig_account = accountNumber;
  logInfo("connection registered for account", accountNumber, "total connections:", connectionsByAccount.get(accountNumber).size);
}

/* Helper: remove connection */
function removeConnection(ws) {
  const account = ws.__vig_account;
  if (!account) return;
  const set = connectionsByAccount.get(account);
  if (!set) return;
  set.delete(ws);
  if (set.size === 0) connectionsByAccount.delete(account);
  logInfo("connection removed for account", account, "remaining:", set.size);
}

/* Broadcast an object to all WS clients for an account */
function sendToAccount(accountNumber, obj) {
  const set = connectionsByAccount.get(accountNumber);
  if (!set || set.size === 0) return 0;
  const payload = JSON.stringify(obj);
  let sent = 0;
  for (const ws of Array.from(set)) {
    if (ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(payload);
        sent++;
      } catch (err) {
        logWarn("ws send failed, removing connection", err?.message || err);
        try { ws.terminate(); } catch (_) {}
        removeConnection(ws);
      }
    } else {
      removeConnection(ws);
    }
  }
  return sent;
}

/* Postgres clients
 - listenerClient: dedicated client that LISTENs on PG_CHANNEL
 - queryPool: pool for executing follow-up queries (fetch message/session)
*/
const listenerClient = new PgClient({ connectionString: DATABASE_URL });
const queryPool = new PgPool({ connectionString: DATABASE_URL, max: 5 });

async function startPgListener() {
  listenerClient.on("error", (err) => {
    logError("Postgres listener client error:", err?.message || err);
  });

  listenerClient.on("end", () => {
    logWarn("Postgres listener client connection ended. Attempting reconnect in 2s...");
    // Attempt reconnect
    setTimeout(() => {
      startPgListener().catch((e) => logError("reconnect startPgListener failed:", e));
    }, 2000);
  });

  try {
    await listenerClient.connect();
    logInfo("Postgres listener connected; listening on channel:", PG_CHANNEL);
    await listenerClient.query(`LISTEN ${PG_CHANNEL}`);
    listenerClient.on("notification", async (msg) => {
      try {
        await handleNotification(msg);
      } catch (err) {
        logError("error handling notification:", err?.message || err);
      }
    });
  } catch (err) {
    logError("Failed to connect Postgres listener:", err?.message || err);
    // retry after delay
    setTimeout(() => {
      startPgListener().catch((e) => logError("retry startPgListener failed:", e));
    }, 2000);
  }
}

/* Parse and handle incoming NOTIFY payloads */
async function handleNotification(msg) {
  // msg.channel, msg.payload
  logDebug("received notification on channel", msg.channel, msg.payload);
  if (!msg.payload) {
    logWarn("empty payload received");
    return;
  }

  let payload;
  try {
    payload = JSON.parse(msg.payload);
  } catch (err) {
    logWarn("invalid JSON payload from notify:", msg.payload);
    return;
  }

  // Expect payload to minimally contain session_id and message_id
  const { session_id, message_id } = payload;
  if (!session_id || !message_id) {
    logWarn("notify payload missing session_id or message_id:", payload);
    return;
  }

  // Query DB to fetch message row and session participants
  try {
    const client = await queryPool.connect();
    try {
      // Fetch message ciphertext and sender
      const mres = await client.query(
        `SELECT id, session_id, sender_account_number, ciphertext, message_metadata, created_at
         FROM messages WHERE id = $1`,
        [message_id]
      );
      if (!mres.rows.length) {
        logWarn("message not found for id", message_id);
        return;
      }
      const messageRow = mres.rows[0];

      // Fetch session participants
      const sres = await client.query(
        `SELECT id, a_account_number, b_account_number FROM sessions WHERE id = $1`,
        [messageRow.session_id]
      );
      if (!sres.rows.length) {
        logWarn("session not found for id", messageRow.session_id);
        return;
      }
      const sessionRow = sres.rows[0];

      // Determine recipient(s): the other participant(s)
      const recipients = [];
      if (sessionRow.a_account_number && sessionRow.b_account_number) {
        if (messageRow.sender_account_number === sessionRow.a_account_number) {
          recipients.push(sessionRow.b_account_number);
        } else if (messageRow.sender_account_number === sessionRow.b_account_number) {
          recipients.push(sessionRow.a_account_number);
        } else {
          // sender is not a participant? add both to be safe
          recipients.push(sessionRow.a_account_number, sessionRow.b_account_number);
        }
      }

      // Build a minimal delivery envelope - do not include any plaintext
      const envelope = {
        type: "message",
        message_id: messageRow.id,
        session_id: messageRow.session_id,
        sender: messageRow.sender_account_number,
        ciphertext: messageRow.ciphertext,
        message_metadata: messageRow.message_metadata,
        created_at: messageRow.created_at,
      };

      // Forward to each recipient if connected
      let totalSent = 0;
      for (const acct of recipients) {
        if (!acct) continue;
        const sent = sendToAccount(acct, envelope);
        totalSent += sent;
        if (sent > 0) {
          logInfo("delivered message", messageRow.id, "to account", acct, "connections:", sent);
        } else {
          logInfo("recipient offline or no ws connection:", acct);
          // If offline behavior required (push), implement here: push to FCM/APNs or enqueue for later.
        }
      }

      logDebug("notification processed: message", message_id, "totalSent", totalSent);
    } finally {
      client.release();
    }
  } catch (err) {
    logError("DB query error while handling notify:", err?.message || err);
  }
}

/* WebSocket server: simple auth and registry */
function startWebSocketServer() {
  const wss = new WebSocketServer({ port: WS_PORT });
  logInfo("WebSocket server listening on port", WS_PORT);

  wss.on("connection", (ws, req) => {
    logInfo("ws connection from", req.socket.remoteAddress);

    let authenticatedAccount = null;

    // Set up ping/pong heartbeat
    ws.isAlive = true;
    ws.on("pong", () => { ws.isAlive = true; });

    ws.on("message", (data) => {
      let msg;
      try {
        msg = typeof data === "string" ? JSON.parse(data) : JSON.parse(data.toString());
      } catch (err) {
        ws.send(JSON.stringify({ type: "error", message: "invalid JSON" }));
        return;
      }

      // Support messages:
      // { type: 'auth', account_number: '...' }
      // { type: 'subscribe', session_id: '...' }  -- future: subscribe to session-level events
      if (!msg.type) {
        ws.send(JSON.stringify({ type: "error", message: "missing type" }));
        return;
      }

      if (msg.type === "auth") {
        const acct = msg.account_number;
        if (!acct || typeof acct !== "string") {
          ws.send(JSON.stringify({ type: "auth_ack", ok: false, message: "account_number required" }));
          return;
        }
        // naive validation: check DB has account (best-effort)
        (async () => {
          try {
            const res = await queryPool.query("SELECT account_number FROM accounts WHERE account_number = $1 LIMIT 1", [acct]);
            if (!res.rows.length) {
              ws.send(JSON.stringify({ type: "auth_ack", ok: false, message: "account not found" }));
              return;
            }
            addConnection(acct, ws);
            authenticatedAccount = acct;
            ws.send(JSON.stringify({ type: "auth_ack", ok: true }));
          } catch (err) {
            logWarn("auth DB check failed:", err?.message || err);
            // allow auth without DB check to avoid blocking, but warn
            addConnection(acct, ws);
            authenticatedAccount = acct;
            ws.send(JSON.stringify({ type: "auth_ack", ok: true, warning: "db_check_failed" }));
          }
        })();
      } else if (msg.type === "ping") {
        ws.send(JSON.stringify({ type: "pong" }));
      } else {
        ws.send(JSON.stringify({ type: "error", message: "unsupported message type" }));
      }
    });

    ws.on("close", () => {
      if (authenticatedAccount) {
        removeConnection(ws);
      }
      logInfo("ws closed for", authenticatedAccount || req.socket.remoteAddress);
    });

    ws.on("error", (err) => {
      logWarn("ws error", err?.message || err);
      if (authenticatedAccount) removeConnection(ws);
    });
  });

  // Heartbeat interval to detect dead clients
  const interval = setInterval(function pingClients() {
    wss.clients.forEach(function each(ws) {
      if (ws.isAlive === false) {
        try { ws.terminate(); } catch (_) {}
        return;
      }
      ws.isAlive = false;
      try { ws.ping(); } catch (_) {}
    });
  }, 30000);

  wss.on("close", function close() {
    clearInterval(interval);
  });

  return wss;
}

/* Graceful shutdown */
async function shutdown(signal) {
  try {
    logInfo("shutdown signal received:", signal);
    // Close WebSocket server by terminating connections
    // close Pool and listener client
    try {
      await queryPool.end();
    } catch (e) {
      logWarn("error closing query pool", e?.message || e);
    }
    try {
      await listenerClient.end();
    } catch (e) {
      logWarn("error closing listener client", e?.message || e);
    }
    process.exit(0);
  } catch (err) {
    logError("shutdown error", err?.message || err);
    process.exit(1);
  }
}

/* Entrypoint */
async function main() {
  logInfo("starting realtime listener...");
  startWebSocketServer();
  await startPgListener();

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("uncaughtException", (err) => {
    logError("uncaughtException", err?.message || err);
    // don't exit immediately; try to shutdown gracefully
    shutdown("uncaughtException");
  });
  process.on("unhandledRejection", (reason) => {
    logError("unhandledRejection", reason);
  });
}

main().catch((err) => {
  logError("fatal error in main:", err?.message || err);
  process.exit(1);
});
