import { query } from "../../../lib/db.js";

/**
 * Serverless route for messages:
 *
 * - POST /api/messages/send
 *   Body: {
 *     session_id: "<uuid>",
 *     sender_account_number: "1234567890123456",
 *     ciphertext: "<base64-signal-envelope>",
 *     message_metadata: <optional encrypted metadata>
 *   }
 *
 *   Response: { message_id, created_at }
 *
 * - GET /api/messages/:session_id
 *   Query params:
 *     ?since_id=<uuid>   => return messages with created_at > created_at(of since_id)
 *     ?limit=100
 *
 *   Response: { messages: [ { id, sender_account_number, ciphertext, message_metadata, delivered, created_at, delivered_at } ] }
 *
 * - PATCH /api/messages/:id/mark-delivered
 *   Body: { delivered_by_account_number: "123..." }
 *   Response: { ok: true }
 */

function jsonResponse(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function getPathname(request) {
  try {
    return new URL(request.url).pathname;
  } catch (e) {
    return request.url || "/";
  }
}

function isUUID(str) {
  if (!str || typeof str !== "string") return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    str,
  );
}

export async function POST(request) {
  // POST handler supports /api/messages/send
  const pathname = getPathname(request);

  if (!pathname.endsWith("/send")) {
    return jsonResponse(
      { error: { code: "not_found", message: "Unsupported POST path" } },
      404,
    );
  }

  let body;
  try {
    body = await request.json();
  } catch (err) {
    return jsonResponse(
      { error: { code: "bad_request", message: "Invalid JSON" } },
      400,
    );
  }

  const {
    session_id,
    sender_account_number,
    ciphertext,
    message_metadata = null,
  } = body || {};

  if (
    !session_id ||
    !isUUID(session_id) ||
    !sender_account_number ||
    !ciphertext
  ) {
    return jsonResponse(
      {
        error: {
          code: "bad_request",
          message:
            "session_id (uuid), sender_account_number and ciphertext are required",
        },
      },
      400,
    );
  }

  try {
    // Verify session exists and that sender is a participant
    const sRes = await query(
      `SELECT id, a_account_number, b_account_number FROM sessions WHERE id = $1`,
      [session_id],
    );
    if (!sRes.rows.length) {
      return jsonResponse(
        { error: { code: "not_found", message: "Session not found" } },
        404,
      );
    }
    const session = sRes.rows[0];
    if (
      sender_account_number !== session.a_account_number &&
      sender_account_number !== session.b_account_number
    ) {
      return jsonResponse(
        {
          error: {
            code: "forbidden",
            message: "Sender not part of the session",
          },
        },
        403,
      );
    }

    // Insert message
    const ins = await query(
      `INSERT INTO messages (session_id, sender_account_number, ciphertext, message_metadata, delivered, created_at)
       VALUES ($1, $2, $3, $4, false, now())
       RETURNING id, created_at`,
      [session_id, sender_account_number, ciphertext, message_metadata],
    );

    // Update session updated_at to reflect recent activity (best-effort)
    try {
      await query(`UPDATE sessions SET updated_at = now() WHERE id = $1`, [
        session_id,
      ]);
    } catch (uerr) {
      // non-fatal
      console.error(
        "[messages POST] failed to update session.updated_at",
        uerr?.message || uerr,
      );
    }

    const row = ins.rows[0];

    // Notify listeners via Postgres NOTIFY (payload is a small JSON string).
    // Any realtime worker or listener can LISTEN on 'new_message' to push to connected clients.
    try {
      const payload = JSON.stringify({
        session_id,
        message_id: row.id,
        created_at: row.created_at,
      });
      await query(`SELECT pg_notify('new_message', $1)`, [payload]);
    } catch (notifyErr) {
      console.error(
        "[messages POST] pg_notify error",
        notifyErr?.message || notifyErr,
      );
    }

    return jsonResponse(
      { message_id: row.id, created_at: row.created_at },
      201,
    );
  } catch (err) {
    console.error("[messages POST] DB error", err?.message || err);
    return jsonResponse(
      { error: { code: "server_error", message: "Database error" } },
      500,
    );
  }
}

export async function GET(request) {
  // Support:
  // - GET /api/messages/:session_id
  // - GET /api/messages?session_id=<uuid>
  // Query params: since_id, limit
  try {
    const url = new URL(request.url);
    const pathname = url.pathname;
    const parts = pathname.split("/").filter(Boolean);
    let session_id = null;

    if (parts.length >= 3) {
      // /api/messages/<session_id>
      session_id = parts[2];
    } else {
      // query param
      session_id = url.searchParams.get("session_id");
    }

    if (!session_id || !isUUID(session_id)) {
      return jsonResponse(
        {
          error: {
            code: "bad_request",
            message: "session_id (uuid) required in path or query",
          },
        },
        400,
      );
    }

    const since_id = url.searchParams.get("since_id") || null;
    const limitParam = parseInt(url.searchParams.get("limit") || "100", 10);
    const limit = Math.min(
      Math.max(isNaN(limitParam) ? 100 : limitParam, 1),
      1000,
    );

    // Determine cutoff timestamp if since_id provided
    let cutoffTs = null;
    if (since_id) {
      if (!isUUID(since_id)) {
        return jsonResponse(
          {
            error: { code: "bad_request", message: "since_id must be a uuid" },
          },
          400,
        );
      }
      const sRes = await query(
        `SELECT created_at FROM messages WHERE id = $1`,
        [since_id],
      );
      if (sRes.rows.length) {
        cutoffTs = sRes.rows[0].created_at;
      } else {
        // If since_id not found, treat as no cutoff
        cutoffTs = null;
      }
    }

    // Query messages
    let rowsRes;
    if (cutoffTs) {
      rowsRes = await query(
        `SELECT id, session_id, sender_account_number, ciphertext, message_metadata, delivered, created_at, delivered_at
         FROM messages
         WHERE session_id = $1 AND created_at > $2
         ORDER BY created_at ASC
         LIMIT $3`,
        [session_id, cutoffTs, limit],
      );
    } else {
      rowsRes = await query(
        `SELECT id, session_id, sender_account_number, ciphertext, message_metadata, delivered, created_at, delivered_at
         FROM messages
         WHERE session_id = $1
         ORDER BY created_at ASC
         LIMIT $2`,
        [session_id, limit],
      );
    }

    const messages = (rowsRes.rows || []).map((r) => ({
      id: r.id,
      session_id: r.session_id,
      sender_account_number: r.sender_account_number,
      ciphertext: r.ciphertext,
      message_metadata: r.message_metadata,
      delivered: r.delivered,
      created_at: r.created_at,
      delivered_at: r.delivered_at,
    }));

    return jsonResponse({ messages }, 200);
  } catch (err) {
    console.error("[messages GET] error", err?.message || err);
    return jsonResponse(
      { error: { code: "server_error", message: "Database error" } },
      500,
    );
  }
}

export async function PATCH(request) {
  // Support PATCH /api/messages/:id/mark-delivered
  const pathname = getPathname(request);
  const match = pathname.match(/\/api\/messages\/([^/]+)\/mark-delivered\/?$/);
  if (!match) {
    return jsonResponse(
      { error: { code: "not_found", message: "Unsupported PATCH path" } },
      404,
    );
  }

  const messageId = match[1];
  if (!isUUID(messageId)) {
    return jsonResponse(
      { error: { code: "bad_request", message: "invalid message id" } },
      400,
    );
  }

  let body;
  try {
    body = await request.json();
  } catch (err) {
    return jsonResponse(
      { error: { code: "bad_request", message: "Invalid JSON" } },
      400,
    );
  }

  const { delivered_by_account_number } = body || {};
  if (!delivered_by_account_number) {
    return jsonResponse(
      {
        error: {
          code: "bad_request",
          message: "delivered_by_account_number required",
        },
      },
      400,
    );
  }

  try {
    // Load message and session participants
    const mRes = await query(
      `SELECT id, session_id, sender_account_number, delivered FROM messages WHERE id = $1`,
      [messageId],
    );
    if (!mRes.rows.length)
      return jsonResponse(
        { error: { code: "not_found", message: "Message not found" } },
        404,
      );
    const msg = mRes.rows[0];

    const sRes = await query(
      `SELECT a_account_number, b_account_number FROM sessions WHERE id = $1`,
      [msg.session_id],
    );
    if (!sRes.rows.length) {
      // session missing - still mark delivered to clean up messages
      await query(
        `UPDATE messages SET delivered = true, delivered_at = now() WHERE id = $1`,
        [messageId],
      );
      return jsonResponse({ ok: true }, 200);
    }
    const session = sRes.rows[0];

    // delivered_by must be participant and must not be the original sender
    if (
      delivered_by_account_number !== session.a_account_number &&
      delivered_by_account_number !== session.b_account_number
    ) {
      return jsonResponse(
        {
          error: {
            code: "forbidden",
            message: "Account not participant in session",
          },
        },
        403,
      );
    }
    if (delivered_by_account_number === msg.sender_account_number) {
      // Sender marking own message delivered doesn't make sense
      return jsonResponse(
        {
          error: {
            code: "bad_request",
            message: "Sender cannot mark message delivered",
          },
        },
        400,
      );
    }

    // Mark delivered
    await query(
      `UPDATE messages SET delivered = true, delivered_at = now() WHERE id = $1`,
      [messageId],
    );

    // Optionally insert audit log
    try {
      await query(
        `INSERT INTO audit_logs (account_number, action, meta, created_at) VALUES ($1, $2, $3, now())`,
        [
          delivered_by_account_number,
          "message_marked_delivered",
          { message_id: messageId, session_id: msg.session_id },
        ],
      );
    } catch (aErr) {
      console.error(
        "[messages PATCH] failed to insert audit log",
        aErr?.message || aErr,
      );
    }

    return jsonResponse({ ok: true }, 200);
  } catch (err) {
    console.error("[messages PATCH] DB error", err?.message || err);
    return jsonResponse(
      { error: { code: "server_error", message: "Database error" } },
      500,
    );
  }
}
