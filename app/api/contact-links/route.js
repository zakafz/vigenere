import { query } from '../../../../lib/db.js';
import crypto from 'crypto';

function jsonResponse(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

/**
 * Helpers to inspect request pathname segments
 */
function getPathname(request) {
  try {
    return new URL(request.url).pathname;
  } catch (e) {
    // Fallback for environments where request.url might be relative
    return request.url || '/';
  }
}

/**
 * POST handler
 *
 * Routes:
 * - POST /api/contact-links/generate
 *   body: { account_number, expires_in_seconds?, single_use? }
 *
 * - POST /api/contact-links/:token/revoke
 *   body: { account_number }
 */
export async function POST(request) {
  const pathname = getPathname(request);

  // GENERATE
  if (pathname.endsWith('/generate')) {
    let body;
    try {
      body = await request.json();
    } catch (err) {
      return jsonResponse({ error: { code: 'bad_request', message: 'Invalid JSON' } }, 400);
    }

    const { account_number, expires_in_seconds, single_use = true } = body || {};
    if (!account_number || typeof account_number !== 'string') {
      return jsonResponse({ error: { code: 'bad_request', message: 'account_number required' } }, 400);
    }

    try {
      // verify account exists
      const accRes = await query(
        `SELECT account_number, identity_public_key, encrypted_profile FROM accounts WHERE account_number = $1`,
        [account_number]
      );
      if (!accRes.rows.length) {
        return jsonResponse({ error: { code: 'not_found', message: 'Account not found' } }, 404);
      }

      // generate ~144-192 bits token
      const token = crypto.randomBytes(18).toString('base64url');

      const expiresAt = typeof expires_in_seconds === 'number' && expires_in_seconds > 0
        ? new Date(Date.now() + expires_in_seconds * 1000).toISOString()
        : null;

      const metadata = {
        snapshot: {
          identity_public_key: accRes.rows[0].identity_public_key || null,
          encrypted_profile: accRes.rows[0].encrypted_profile || null
        }
      };

      await query(
        `INSERT INTO contact_links (token, account_number, single_use, expires_at, metadata)
         VALUES ($1, $2, $3, $4, $5)`,
        [token, account_number, !!single_use, expiresAt, metadata]
      );

      const base = (process.env.SERVICE_URL && process.env.SERVICE_URL.replace(/\/+$/, '')) || `${new URL(request.url).origin || ''}`;
      const url = `${base}/add/${encodeURIComponent(token)}`;

      return jsonResponse({ token, url, expires_at: expiresAt }, 201);
    } catch (err) {
      console.error('[contact-links generate] error', err?.message || err);
      return jsonResponse({ error: { code: 'server_error', message: 'Database error' } }, 500);
    }
  }

  // REVOKE: POST /api/contact-links/:token/revoke
  // pathname expected like /api/contact-links/<token>/revoke
  const revokeMatch = pathname.match(/\/api\/contact-links\/([^/]+)\/revoke\/?$/);
  if (revokeMatch) {
    const token = decodeURIComponent(revokeMatch[1]);
    let body;
    try {
      body = await request.json();
    } catch (err) {
      return jsonResponse({ error: { code: 'bad_request', message: 'Invalid JSON' } }, 400);
    }
    const { account_number } = body || {};
    if (!account_number) return jsonResponse({ error: { code: 'bad_request', message: 'account_number required' } }, 400);

    try {
      const res = await query(`SELECT account_number FROM contact_links WHERE token = $1`, [token]);
      if (!res.rows.length) return jsonResponse({ error: { code: 'not_found', message: 'Token not found' } }, 404);
      if (res.rows[0].account_number !== account_number) return jsonResponse({ error: { code: 'forbidden', message: 'Not allowed' } }, 403);

      await query(`DELETE FROM contact_links WHERE token = $1`, [token]);
      return jsonResponse({ ok: true }, 200);
    } catch (err) {
      console.error('[contact-links revoke] error', err?.message || err);
      return jsonResponse({ error: { code: 'server_error', message: 'Database error' } }, 500);
    }
  }

  // If we reach here, unsupported POST path
  return jsonResponse({ error: { code: 'not_found', message: 'Unsupported POST path' } }, 404);
}

/**
 * GET handler
 *
 * Routes:
 * - GET /api/contact-links/:token
 *   returns public key material and encrypted_profile snapshot
 */
export async function GET(request) {
  const pathname = getPathname(request);

  // Expect path like /api/contact-links/<token>
  const m = pathname.match(/\/api\/contact-links\/([^/]+)\/?$/);
  if (!m) return jsonResponse({ error: { code: 'not_found', message: 'Token required in path' } }, 400);

  const token = decodeURIComponent(m[1]);

  try {
    const res = await query(
      `SELECT token, account_number, single_use, created_at, expires_at, used, use_count, metadata
       FROM contact_links WHERE token = $1`,
      [token]
    );
    if (!res.rows.length) return jsonResponse({ error: { code: 'not_found', message: 'Token not found' } }, 404);

    const row = res.rows[0];

    // check expiry
    if (row.expires_at && new Date(row.expires_at) < new Date()) {
      return jsonResponse({ error: { code: 'gone', message: 'Token expired' } }, 410);
    }
    if (row.single_use && row.used) {
      return jsonResponse({ error: { code: 'gone', message: 'Token already used' } }, 410);
    }

    // If single-use, mark it used atomically and increment use_count
    if (row.single_use) {
      try {
        await query(`UPDATE contact_links SET used = true, use_count = use_count + 1 WHERE token = $1`, [token]);
      } catch (uerr) {
        // Non-fatal for caller; log and continue returning snapshot
        console.error('[contact-links GET] failed to mark token used', uerr?.message || uerr);
      }
    } else {
      // increment use_count for analytics
      try {
        await query(`UPDATE contact_links SET use_count = use_count + 1 WHERE token = $1`, [token]);
      } catch (_) {}
    }

    const identity_public_key = row.metadata?.snapshot?.identity_public_key || null;
    const encrypted_profile = row.metadata?.snapshot?.encrypted_profile || null;

    return jsonResponse({
      // account_number omitted intentionally to preserve anonymity option;
      // include if you want the client to learn it.
      // account_number: row.account_number,
      identity_public_key,
      encrypted_profile,
      single_use: row.single_use,
      expires_at: row.expires_at
    }, 200);
  } catch (err) {
    console.error('[contact-links GET] error', err?.message || err);
    return jsonResponse({ error: { code: 'server_error', message: 'Database error' } }, 500);
  }
}
