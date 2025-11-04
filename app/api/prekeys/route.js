import { query } from '../../../../lib/db.js';

function jsonResponse(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

/**
 * POST /api/prekeys/upload
 *
 * Body:
 * {
 *   "account_number": "1234567890123456",
 *   "signed_prekey": "<base64-signed-prekey>",               // optional
 *   "signed_prekey_signature": "<base64-signature>",         // optional
 *   "one_time_prekeys": [ { "id": 1, "public_key": "<base64>" }, ... ] // optional
 * }
 *
 * Responds: { ok: true, uploaded: <number> }
 */
export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch (err) {
    return jsonResponse({ error: { code: 'bad_request', message: 'Invalid JSON' } }, 400);
  }

  const { account_number, signed_prekey, signed_prekey_signature, one_time_prekeys } = body || {};

  if (!account_number || typeof account_number !== 'string') {
    return jsonResponse({ error: { code: 'bad_request', message: 'account_number required' } }, 400);
  }
  if (!signed_prekey && (!Array.isArray(one_time_prekeys) || one_time_prekeys.length === 0)) {
    // nothing to do: require at least a signed_prekey or OPKs
    return jsonResponse({ error: { code: 'bad_request', message: 'signed_prekey or one_time_prekeys required' } }, 400);
  }

  try {
    let prekeyId = null;

    if (signed_prekey) {
      // Insert a new prekeys row
      const res = await query(
        `INSERT INTO prekeys (account_number, signed_prekey, signed_prekey_signature, last_uploaded)
         VALUES ($1, $2, $3, now()) RETURNING id`,
        [account_number, signed_prekey, signed_prekey_signature || null]
      );
      prekeyId = res.rows[0].id;
    } else {
      // No new signed_prekey - try to find the latest existing prekey row for this account
      const res = await query(
        `SELECT id FROM prekeys WHERE account_number = $1 ORDER BY last_uploaded DESC LIMIT 1`,
        [account_number]
      );
      if (res.rows.length) {
        prekeyId = res.rows[0].id;
        // update last_uploaded for bookkeeping
        await query(`UPDATE prekeys SET last_uploaded = now() WHERE id = $1`, [prekeyId]);
      } else {
        // create placeholder prekey row to attach OPKs to
        const created = await query(
          `INSERT INTO prekeys (account_number, signed_prekey, last_uploaded) VALUES ($1, $2, now()) RETURNING id`,
          [account_number, null]
        );
        prekeyId = created.rows[0].id;
      }
    }

    let uploaded = 0;
    if (Array.isArray(one_time_prekeys) && one_time_prekeys.length) {
      // Insert OPKs
      const inserts = [];
      for (const otp of one_time_prekeys) {
        const keyIndex = typeof otp.id !== 'undefined' ? otp.id : null;
        const publicKey = otp && otp.public_key ? otp.public_key : null;
        if (!publicKey) continue;
        uploaded++;
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

    return jsonResponse({ ok: true, uploaded }, 200);
  } catch (err) {
    console.error('[prekeys POST] DB error', err?.message || err);
    return jsonResponse({ error: { code: 'server_error', message: 'Database error' } }, 500);
  }
}

/**
 * GET /api/prekeys/:account_number
 *
 * Query params:
 *   ?consume_one_time_prekey=true
 *
 * Response (200):
 * {
 *   "signed_prekey": "<base64>",
 *   "signed_prekey_signature": "<base64|null>",
 *   "one_time_prekey": { "id": "<uuid>", "public_key": "<base64>", "key_index": <int|null> } | null
 * }
 */
export async function GET(request) {
  try {
    const url = new URL(request.url);
    // Path extraction: last segment is account_number
    const parts = url.pathname.split('/').filter(Boolean);
    const account_number = parts[parts.length - 1];
    if (!account_number) {
      return jsonResponse({ error: { code: 'bad_request', message: 'account_number required in path' } }, 400);
    }

    const consume = (url.searchParams.get('consume_one_time_prekey') || '').toLowerCase() === 'true';

    // Get the latest signed_prekey for the account
    const spkRes = await query(
      `SELECT id, signed_prekey, signed_prekey_signature FROM prekeys WHERE account_number = $1 ORDER BY last_uploaded DESC LIMIT 1`,
      [account_number]
    );
    if (!spkRes.rows.length) {
      return jsonResponse({ error: { code: 'not_found', message: 'No prekey found for account' } }, 404);
    }

    const spkRow = spkRes.rows[0];

    let opk = null;
    if (consume) {
      try {
        // Call DB function to atomically consume a single OPK
        // It returns table(opk_id uuid, public_key text, key_index int, prekey_id int)
        const opkRes = await query(`SELECT * FROM consume_one_time_prekey($1)`, [account_number]);
        if (opkRes.rows && opkRes.rows.length) {
          const r = opkRes.rows[0];
          opk = {
            id: r.opk_id,
            public_key: r.public_key,
            key_index: r.key_index,
            prekey_id: r.prekey_id
          };
        } else {
          // no OPK available
          opk = null;
        }
      } catch (err) {
        console.error('[prekeys GET] error consuming OPK', err?.message || err);
        // Don't fail the whole request if OPK consume has issues; return signed_prekey only
        opk = null;
      }
    }

    return jsonResponse({
      signed_prekey: spkRow.signed_prekey || null,
      signed_prekey_signature: spkRow.signed_prekey_signature || null,
      one_time_prekey: opk
    }, 200);
  } catch (err) {
    console.error('[prekeys GET] error', err?.message || err);
    return jsonResponse({ error: { code: 'server_error', message: 'Database error' } }, 500);
  }
}
