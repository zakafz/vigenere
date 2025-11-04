import { query } from '../../../../lib/db.js';
import crypto from 'crypto';

/**
 * POST /api/auth/register
 *
 * Serverless route that creates a new account row.
 * Expects JSON body:
 * {
 *   "identity_public_key": "<base64-x25519-pub>",
 *   "encrypted_profile": "<base64-AES-GCM-json-blob>",      // optional
 *   "signed_prekey": "<base64-signed-prekey>",             // optional
 *   "signed_prekey_signature": "<base64-signature>",       // optional
 *   "one_time_prekeys": [ { "id": 1, "public_key": "<base64>" }, ... ] // optional
 * }
 *
 * Returns (201) on success:
 * { "account_number": "1234567890123456", "created_at": "..." }
 *
 * Notes:
 * - account_number is generated server-side (16-digit decimal).
 * - All profile and key material are treated as opaque strings and stored as provided.
 * - The account_number is shown once; client must persist it.
 */

function generateAccountNumber16() {
  // Generate 8 random bytes -> big integer -> mod 10^16 -> pad to 16 digits
  const buf = crypto.randomBytes(8);
  const n = BigInt('0x' + buf.toString('hex'));
  const max = BigInt(10) ** BigInt(16);
  const num = (n % max).toString().padStart(16, '0');
  return num;
}

function jsonResponse(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch (err) {
    return jsonResponse({ error: { code: 'bad_request', message: 'Invalid JSON' } }, 400);
  }

  const {
    identity_public_key,
    encrypted_profile = null,
    signed_prekey = null,
    signed_prekey_signature = null,
    one_time_prekeys = null
  } = body || {};

  if (!identity_public_key || typeof identity_public_key !== 'string') {
    return jsonResponse({ error: { code: 'bad_request', message: 'identity_public_key required' } }, 400);
  }

  // Try a few times to avoid rare account_number collisions
  for (let attempt = 0; attempt < 6; attempt++) {
    const account_number = generateAccountNumber16();
    try {
      // Insert account
      const insertAccount = await query(
        `INSERT INTO accounts (account_number, identity_public_key, encrypted_profile)
         VALUES ($1, $2, $3)
         RETURNING account_number, created_at`,
        [account_number, identity_public_key, encrypted_profile]
      );

      // Optionally insert signed prekey row
      if (signed_prekey) {
        await query(
          `INSERT INTO prekeys (account_number, signed_prekey, signed_prekey_signature, last_uploaded)
           VALUES ($1, $2, $3, now())`,
          [account_number, signed_prekey, signed_prekey_signature]
        );
      }

      // Optionally insert one-time-prekeys (if provided)
      if (Array.isArray(one_time_prekeys) && one_time_prekeys.length > 0) {
        // Get the most recent prekey row for this account to reference prekey_id
        const prekeyRow = await query(
          `SELECT id FROM prekeys WHERE account_number = $1 ORDER BY last_uploaded DESC LIMIT 1`,
          [account_number]
        );
        let prekeyId = null;
        if (prekeyRow.rows.length) {
          prekeyId = prekeyRow.rows[0].id;
        } else {
          // If no prekey row existed (signed_prekey not provided), create a placeholder prekey row
          const res = await query(
            `INSERT INTO prekeys (account_number, signed_prekey, last_uploaded)
             VALUES ($1, $2, now()) RETURNING id`,
            [account_number, null]
          );
          prekeyId = res.rows[0].id;
        }

        // Insert OPKs in batches
        const inserts = [];
        for (const otp of one_time_prekeys) {
          const keyIndex = otp && typeof otp.id !== 'undefined' ? otp.id : null;
          const publicKey = otp && otp.public_key ? otp.public_key : null;
          if (!publicKey) continue;
          inserts.push(
            query(
              `INSERT INTO one_time_prekeys (prekey_id, account_number, key_index, public_key)
               VALUES ($1, $2, $3, $4)`,
              [prekeyId, account_number, keyIndex, publicKey]
            )
          );
        }
        if (inserts.length) await Promise.all(inserts);
      }

      const created = insertAccount.rows[0];
      return jsonResponse({ account_number: created.account_number, created_at: created.created_at }, 201);
    } catch (err) {
      // 23505 = unique violation (rare collision on account_number)
      // Some Postgres adapters keep .code; fallback to string check
      const code = err?.code || '';
      const message = (err && err.message) || String(err);
      // If unique constraint failure, retry generation
      if (code === '23505' || message.toLowerCase().includes('unique')) {
        // retry
        continue;
      }
      // Log and return generic server error
      // In serverless contexts, console.error will appear in logs
      console.error('[register] DB error', { message, stack: err?.stack });
      return jsonResponse({ error: { code: 'server_error', message: 'Database error' } }, 500);
    }
  }

  // If we exhausted retries
  return jsonResponse({ error: { code: 'server_error', message: 'Could not generate unique account number' } }, 500);
}
