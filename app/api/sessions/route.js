import { query } from '../../../lib/db.js';

/**
 * Serverless routes for sessions:
 * - POST /api/sessions/initiate
 *   Body: {
 *     initiator_account_number: string,
 *     responder_account_number: string,
 *     session_state: <opaque encrypted session blob>,
 *     contact_link_token?: string
 *   }
 *
 * - GET /api/sessions?account_number=123...   => list sessions for account
 * - GET /api/sessions/:id                     => get a specific session (returns encrypted session_state)
 *
 * - DELETE /api/sessions/:id                  => delete a session (requires account_number in body to authorize)
 *
 * The file is a single route handler. We inspect the request URL to determine which operation to perform.
 */

function jsonResponse(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function getPathname(request) {
  try {
    return new URL(request.url).pathname;
  } catch (e) {
    return request.url || '/';
  }
}

function isUUID(str) {
  if (!str || typeof str !== 'string') return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(str);
}

function isAccountNumber16(str) {
  if (!str || typeof str !== 'string') return false;
  return /^[0-9]{16}$/.test(str);
}

/**
 * POST /api/sessions/initiate
 */
export async function POST(request) {
  const pathname = getPathname(request);

  // Support route /api/sessions/initiate
  if (!pathname.endsWith('/initiate')) {
    return jsonResponse({ error: { code: 'not_found', message: 'Unsupported POST path' } }, 404);
  }

  let body;
  try {
    body = await request.json();
  } catch (err) {
    return jsonResponse({ error: { code: 'bad_request', message: 'Invalid JSON' } }, 400);
  }

  const {
    initiator_account_number,
    responder_account_number,
    session_state,
    contact_link_token = null,
  } = body || {};

  if (!initiator_account_number || !responder_account_number || !session_state) {
    return jsonResponse(
      { error: { code: 'bad_request', message: 'initiator_account_number, responder_account_number and session_state are required' } },
      400
    );
  }

  try {
    // Insert session row
    const insertRes = await query(
      `INSERT INTO sessions (a_account_number, b_account_number, session_state, created_at, updated_at)
       VALUES ($1, $2, $3, now(), now())
       RETURNING id, created_at, updated_at`,
      [initiator_account_number, responder_account_number, session_state]
    );

    const sessionRow = insertRes.rows[0];

    // Touch last_active_at for both accounts (best-effort, non-fatal)
    try {
      await query(`UPDATE accounts SET last_active_at = now() WHERE account_number = ANY($1::text[])`, [
        [initiator_account_number, responder_account_number],
      ]);
    } catch (tErr) {
      console.error('[sessions POST] failed to update last_active_at', tErr?.message || tErr);
    }

    // Optionally record contact_link_token usage in audit_logs if provided
    if (contact_link_token) {
      try {
        await query(
          `INSERT INTO audit_logs (account_number, action, meta, created_at)
           VALUES ($1, $2, $3, now())`,
          [initiator_account_number, 'session_initiated_via_contact_link', { contact_link_token, responder: responder_account_number }]
        );
      } catch (aErr) {
        // non-fatal
        console.error('[sessions POST] failed to write audit log', aErr?.message || aErr);
      }
    }

    return jsonResponse(
      { session_id: sessionRow.id, created_at: sessionRow.created_at, updated_at: sessionRow.updated_at },
      201
    );
  } catch (err) {
    console.error('[sessions POST] DB error', err?.message || err);
    return jsonResponse({ error: { code: 'server_error', message: 'Database error' } }, 500);
  }
}

/**
 * GET /api/sessions or /api/sessions/:id or /api/sessions?account_number=...
 */
export async function GET(request) {
  const url = new URL(request.url);
  const pathname = url.pathname;
  const parts = pathname.split('/').filter(Boolean); // e.g. ['api','sessions', '<id>']

  // If URL has a last segment after /api/sessions, treat it as session id or account number
  if (parts.length >= 3) {
    const last = parts[2];

    // If it's a UUID -> fetch by session id
    if (isUUID(last)) {
      const sessionId = last;
      try {
        const res = await query(
          `SELECT id, a_account_number, b_account_number, session_state, created_at, updated_at
           FROM sessions WHERE id = $1`,
          [sessionId]
        );
        if (!res.rows.length) {
          return jsonResponse({ error: { code: 'not_found', message: 'Session not found' } }, 404);
        }
        const r = res.rows[0];
        // Return the encrypted session_state blob (server does not decrypt)
        return jsonResponse({
          id: r.id,
          a_account_number: r.a_account_number,
          b_account_number: r.b_account_number,
          session_state: r.session_state,
          created_at: r.created_at,
          updated_at: r.updated_at,
        });
      } catch (err) {
        console.error('[sessions GET by id] DB error', err?.message || err);
        return jsonResponse({ error: { code: 'server_error', message: 'Database error' } }, 500);
      }
    }

    // If it's a 16-digit account number we will list sessions for that account
    if (isAccountNumber16(last)) {
      const account_number = last;
      try {
        const res = await query(
          `SELECT id, a_account_number, b_account_number, created_at, updated_at
           FROM sessions
           WHERE a_account_number = $1 OR b_account_number = $1
           ORDER BY updated_at DESC`,
          [account_number]
        );
        const rows = res.rows.map((r) => ({
          id: r.id,
          a_account_number: r.a_account_number,
          b_account_number: r.b_account_number,
          created_at: r.created_at,
          updated_at: r.updated_at,
        }));
        return jsonResponse({ sessions: rows });
      } catch (err) {
        console.error('[sessions GET by account (path)] DB error', err?.message || err);
        return jsonResponse({ error: { code: 'server_error', message: 'Database error' } }, 500);
      }
    }

    // Unrecognized last segment
    return jsonResponse({ error: { code: 'bad_request', message: 'Unrecognized identifier in path' } }, 400);
  }

  // No path id provided - support query param account_number
  const account_number = url.searchParams.get('account_number');
  if (!account_number) {
    return jsonResponse({ error: { code: 'bad_request', message: 'account_number query parameter required or use /api/sessions/:id' } }, 400);
  }

  try {
    const res = await query(
      `SELECT id, a_account_number, b_account_number, created_at, updated_at
       FROM sessions
       WHERE a_account_number = $1 OR b_account_number = $1
       ORDER BY updated_at DESC`,
      [account_number]
    );
    const rows = res.rows.map((r) => ({
      id: r.id,
      a_account_number: r.a_account_number,
      b_account_number: r.b_account_number,
      created_at: r.created_at,
      updated_at: r.updated_at,
    }));
    return jsonResponse({ sessions: rows });
  } catch (err) {
    console.error('[sessions GET by account (query)] DB error', err?.message || err);
    return jsonResponse({ error: { code: 'server_error', message: 'Database error' } }, 500);
  }
}

/**
 * DELETE /api/sessions/:id
 * Body: { account_number: "<owner>" } to authorize deletion (caller must be one of the participants)
 */
export async function DELETE(request) {
  const pathname = getPathname(request);
  // Expect /api/sessions/<id>
  const match = pathname.match(/\/api\/sessions\/([^/]+)\/?$/);
  if (!match) return jsonResponse({ error: { code: 'bad_request', message: 'session id required in path' } }, 400);

  const sessionId = match[1];
  if (!isUUID(sessionId)) return jsonResponse({ error: { code: 'bad_request', message: 'invalid session id format' } }, 400);

  let body;
  try {
    body = await request.json();
  } catch (err) {
    return jsonResponse({ error: { code: 'bad_request', message: 'Invalid JSON' } }, 400);
  }

  const { account_number } = body || {};
  if (!account_number) return jsonResponse({ error: { code: 'bad_request', message: 'account_number required to authorize deletion' } }, 400);

  try {
    // verify session exists and that requester is participant
    const res = await query(`SELECT a_account_number, b_account_number FROM sessions WHERE id = $1`, [sessionId]);
    if (!res.rows.length) return jsonResponse({ error: { code: 'not_found', message: 'Session not found' } }, 404);
    const row = res.rows[0];
    if (row.a_account_number !== account_number && row.b_account_number !== account_number) {
      return jsonResponse({ error: { code: 'forbidden', message: 'Not a participant' } }, 403);
    }

    await query(`DELETE FROM sessions WHERE id = $1`, [sessionId]);

    // Optionally write an audit log
    try {
      await query(
        `INSERT INTO audit_logs (account_number, action, meta, created_at) VALUES ($1, $2, $3, now())`,
        [account_number, 'session_deleted', { session_id: sessionId }]
      );
    } catch (aErr) {
      console.error('[sessions DELETE] failed to write audit log', aErr?.message || aErr);
    }

    return new Response(null, { status: 204 });
  } catch (err) {
    console.error('[sessions DELETE] DB error', err?.message || err);
    return jsonResponse({ error: { code: 'server_error', message: 'Database error' } }, 500);
  }
}
