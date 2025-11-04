import { query } from '../../../lib/db.js';

function jsonResponse(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

/**
 * POST /api/profile
 * Body:
 * {
 *   "account_number": "1234567890123456",
 *   "encrypted_profile": "<base64-AES-GCM-json-blob>"
 * }
 *
 * Response:
 * 200 { ok: true }
 * 400/404/500 on errors
 */
export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch (err) {
    return jsonResponse({ error: { code: 'bad_request', message: 'Invalid JSON' } }, 400);
  }

  const { account_number, encrypted_profile } = body || {};
  if (!account_number || typeof account_number !== 'string') {
    return jsonResponse({ error: { code: 'bad_request', message: 'account_number required' } }, 400);
  }
  if (typeof encrypted_profile === 'undefined' || encrypted_profile === null) {
    return jsonResponse({ error: { code: 'bad_request', message: 'encrypted_profile required' } }, 400);
  }

  try {
    const res = await query(
      `UPDATE accounts
       SET encrypted_profile = $2, last_active_at = now()
       WHERE account_number = $1
       RETURNING account_number`,
      [account_number, encrypted_profile]
    );

    if (!res.rowCount) {
      return jsonResponse({ error: { code: 'not_found', message: 'Account not found' } }, 404);
    }

    return jsonResponse({ ok: true }, 200);
  } catch (err) {
    console.error('[profile POST] DB error', err?.message || err);
    return jsonResponse({ error: { code: 'server_error', message: 'Database error' } }, 500);
  }
}

/**
 * GET /api/profile?account_number=...
 *
 * Response (200):
 * {
 *   "identity_public_key": "<base64-x25519>",
 *   "encrypted_profile": "<base64-AES-GCM-json-blob|null>",
 *   "last_active_at": "2025-11-01T12:00:00Z"
 * }
 *
 * 400/404/500 on errors
 */
export async function GET(request) {
  try {
    const url = new URL(request.url);
    const account_number = url.searchParams.get('account_number');

    if (!account_number) {
      return jsonResponse({ error: { code: 'bad_request', message: 'account_number query parameter required' } }, 400);
    }

    const res = await query(
      `SELECT identity_public_key, encrypted_profile, last_active_at
       FROM accounts WHERE account_number = $1`,
      [account_number]
    );

    if (!res.rows.length) {
      return jsonResponse({ error: { code: 'not_found', message: 'Account not found' } }, 404);
    }

    const row = res.rows[0];
    return jsonResponse({
      identity_public_key: row.identity_public_key,
      encrypted_profile: row.encrypted_profile,
      last_active_at: row.last_active_at
    }, 200);
  } catch (err) {
    console.error('[profile GET] error', err?.message || err);
    return jsonResponse({ error: { code: 'server_error', message: 'Database error' } }, 500);
  }
}
