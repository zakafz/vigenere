import { query } from '../../../../lib/db.js';

function jsonResponse(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

/**
 * POST /api/auth/login
 *
 * Body:
 * { "account_number": "1234567890123456" }
 *
 * Response (200):
 * {
 *   "identity_public_key": "<base64-x25519>",
 *   "encrypted_profile": "<base64-AES-GCM-json-blob|null>",
 *   "last_active_at": "2025-11-01T12:00:00Z",
 *   "status": "active"
 * }
 */
export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch (err) {
    return jsonResponse({ error: { code: 'bad_request', message: 'Invalid JSON' } }, 400);
  }

  const { account_number } = body || {};
  if (!account_number || typeof account_number !== 'string') {
    return jsonResponse({ error: { code: 'bad_request', message: 'account_number required' } }, 400);
  }

  try {
    const res = await query(
      `SELECT identity_public_key, encrypted_profile, last_active_at, status
       FROM accounts WHERE account_number = $1`,
      [account_number]
    );

    if (!res.rows.length) {
      return jsonResponse({ error: { code: 'not_found', message: 'Account not found' } }, 404);
    }

    // update last_active_at
    try {
      await query(`UPDATE accounts SET last_active_at = now() WHERE account_number = $1`, [account_number]);
    } catch (uerr) {
      // non-fatal; log for serverless logs and continue returning data
      // console.error will show in serverless logs
      console.error('[login] failed to update last_active_at', uerr?.message || uerr);
    }

    const row = res.rows[0];
    return jsonResponse({
      identity_public_key: row.identity_public_key,
      encrypted_profile: row.encrypted_profile,
      last_active_at: row.last_active_at,
      status: row.status
    }, 200);
  } catch (err) {
    console.error('[login] DB error', err?.message || err);
    return jsonResponse({ error: { code: 'server_error', message: 'Database error' } }, 500);
  }
}
