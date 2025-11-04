/**
 * vigenere/lib/db.js
 *
 * Serverless-friendly Postgres helper for Vigenère.
 *
 * Usage:
 *   import { query, getClient, withTransaction } from 'vigenere/lib/db';
 *
 * Notes:
 * - Reuses a single Pool across lambda/container cold starts by attaching to `globalThis`.
 * - Expects `process.env.DATABASE_URL` to be set (Supabase connection string is fine).
 * - Configure optional env vars:
 *     DB_POOL_MAX (default: 5)
 *     DB_IDLE_TIMEOUT_MS (default: 30000)
 *     DB_CONN_TIMEOUT_MS (default: 5000)
 *
 * Do NOT commit credentials. Inject via your deployment platform's secret manager.
 */

import pkg from 'pg';
const { Pool } = pkg;

/**
 * Create or reuse a Pool in serverless environments.
 * Attaches pool to globalThis to avoid exhausting connections across hot reloads.
 */
function _createPool() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL environment variable is not set.');
  }

  const max = Number(process.env.DB_POOL_MAX || 5);
  const idleTimeoutMillis = Number(process.env.DB_IDLE_TIMEOUT_MS || 30000);
  const connectionTimeoutMillis = Number(process.env.DB_CONN_TIMEOUT_MS || 5000);

  // For Supabase / cloud Postgres, SSL is typically required via the connection string.
  return new Pool({
    connectionString,
    max,
    idleTimeoutMillis,
    connectionTimeoutMillis
  });
}

/**
 * Get global pool (create if needed).
 * Attaches to globalThis to survive serverless function warm starts.
 */
function getPool() {
  // Use a stable name to avoid collisions
  const key = '__VIGENERE_PG_POOL__';

  if (globalThis[key] && globalThis[key].ending !== true) {
    return globalThis[key];
  }

  const pool = _createPool();
  // store for reuse
  globalThis[key] = pool;
  return pool;
}

/**
 * Simple query wrapper for single-statement queries.
 * Returns the same object as node-postgres `pool.query`.
 *
 * @param {string} text
 * @param {Array<any>} params
 * @returns {Promise<import('pg').QueryResult>}
 */
export async function query(text, params = []) {
  const pool = getPool();
  try {
    return await pool.query(text, params);
  } catch (err) {
    // Attach query for easier debugging in logs (do not leak to clients)
    // eslint-disable-next-line no-console
    console.error('[db] query error', { message: err?.message || err, text, params });
    throw err;
  }
}

/**
 * Acquire a dedicated client from the pool for transactional or multi-statement work.
 * Caller MUST release the client via `client.release()` when done.
 *
 * Example:
 *   const client = await getClient();
 *   try {
 *     await client.query('BEGIN');
 *     ...
 *     await client.query('COMMIT');
 *   } catch (e) {
 *     await client.query('ROLLBACK');
 *   } finally {
 *     client.release();
 *   }
 *
 * @returns {Promise<import('pg').PoolClient>}
 */
export async function getClient() {
  const pool = getPool();
  const client = await pool.connect();
  return client;
}

/**
 * Convenience helper to run a function inside a transaction.
 * Commits on success, rolls back on error.
 *
 * Example:
 *   await withTransaction(async (client) => {
 *     await client.query('UPDATE ...', [...]);
 *     const res = await client.query('SELECT ...');
 *     return res.rows;
 *   });
 *
 * @param {(client: import('pg').PoolClient) => Promise<any>} fn
 * @returns {Promise<any>} returns whatever the provided function returns
 */
export async function withTransaction(fn) {
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch (rbErr) {
      // eslint-disable-next-line no-console
      console.error('[db] rollback failed', rbErr);
    }
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Gracefully close the pool. Useful in local scripts or shutdown hooks.
 */
export async function closePool() {
  try {
    const key = '__VIGENERE_PG_POOL__';
    if (globalThis[key]) {
      await globalThis[key].end();
      // eslint-disable-next-line no-console
      console.info('[db] pool closed');
      delete globalThis[key];
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[db] error closing pool', err);
  }
}

/**
 * Helper to test connectivity quickly.
 * Returns true if DB responds to a lightweight query.
 */
export async function ping() {
  try {
    const res = await query('SELECT 1 as ok');
    return res && res.rows && res.rows[0] && res.rows[0].ok === 1;
  } catch (_err) {
    return false;
  }
}

export default {
  query,
  getClient,
  withTransaction,
  closePool,
  ping
};
