/*
 * Lotus Cinema — Postgres adapter (persistent deployed database)
 * ------------------------------------------------------------
 * Why this file exists:
 *   The deployed backend on Render was using SQLite as a single file
 *   living inside the app's own container. Render's free web service
 *   restarts that container after ~15 minutes idle, and the restart
 *   wipes the filesystem — so every movie/showtime added through the
 *   live manager dashboard vanished the next time anyone visited.
 *
 *   Postgres on Neon is a completely separate, persistent database —
 *   restarting the Render container has no effect on it at all. Data
 *   added today is still there tomorrow, next week, forever.
 *
 * Design goal: match the exact same shape the SQLite/Oracle adapters
 * already expose (prepare().get()/.all()/.run(), transaction(fn)),
 * so the route files don't need to change at all.
 *
 * Placeholders: route SQL uses SQLite-style '?' and some named
 * '@field' placeholders (see db/index.js's movie insert). Postgres
 * only understands positional $1, $2, ... — translate() below
 * rewrites both styles into that form.
 *
 * Transactions: node-postgres is connection-pooled, so BEGIN/COMMIT
 * must run on the SAME connection as every query inside that
 * transaction — not a random other connection from the pool. This
 * uses AsyncLocalStorage so that any code calling getDb().prepare(...)
 * while inside a transaction() callback automatically routes through
 * the correct connection, with zero changes needed in route files.
 */

const { Pool } = require('pg');
const { AsyncLocalStorage } = require('async_hooks');

let pool;
const txContext = new AsyncLocalStorage();

async function initPool() {
  if (pool) return pool;
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }, // Neon requires SSL; this accepts its cert chain
    max: 5,
  });
  // fail fast on boot if the connection string is wrong, rather than
  // waiting for the first request to discover it
  const client = await pool.connect();
  client.release();
  return pool;
}

// Whichever connection is "active" right now: the transaction's
// dedicated client if we're inside one, otherwise the shared pool.
function executor() {
  return txContext.getStore() || pool;
}

/*
 * Translate placeholders:
 *   ?          -> $1, $2, $3 ...   (in the order they appear)
 *   @name      -> $1, $2, ...      (value pulled from a params object)
 * Returns { sql, values(...) } where values(...) turns whatever the
 * route passed to .run()/.get()/.all() into the positional array pg
 * expects.
 */
function compile(sql) {
  const namedFields = [...sql.matchAll(/@(\w+)/g)].map((m) => m[1]);

  if (namedFields.length) {
    let i = 0;
    const pgSql = sql.replace(/@(\w+)/g, () => `$${++i}`);
    return {
      pgSql,
      values: (params) => {
        const obj = params[0] || {};
        return namedFields.map((f) => obj[f]);
      },
    };
  }

  let i = 0;
  const pgSql = sql.replace(/\?/g, () => `$${++i}`);
  return { pgSql, values: (params) => params };
}

// After an INSERT, the route code expects result.lastInsertRowid
// (that's the property name the SQLite/better-sqlite3 driver uses,
// and every route already reads it under that name). Auto-append a
// RETURNING clause so we can hand the same thing back from Postgres.
function withReturning(pgSql) {
  const isPlainInsert = /^\s*INSERT\s+INTO/i.test(pgSql) && !/RETURNING/i.test(pgSql);
  if (!isPlainInsert) return pgSql;
  return pgSql.replace(/;?\s*$/, ' RETURNING *');
}

// Heuristic: the schema names every surrogate primary key "..._id"
// (movie_id, booking_id, item_id, ...). Whichever such column comes
// back in the RETURNING row is the new id.
function extractInsertId(row) {
  if (!row) return undefined;
  const idKey = Object.keys(row).find((k) => k.endsWith('_id'));
  return idKey ? row[idKey] : undefined;
}

function makeDb() {
  return {
    prepare(sql) {
      const { pgSql, values } = compile(sql);

      return {
        async get(...params) {
          const res = await executor().query(pgSql, values(params));
          return res.rows[0];
        },
        async all(...params) {
          const res = await executor().query(pgSql, values(params));
          return res.rows;
        },
        async run(...params) {
          const finalSql = withReturning(pgSql);
          const res = await executor().query(finalSql, values(params));
          return {
            lastInsertRowid: extractInsertId(res.rows[0]),
            changes: res.rowCount,
          };
        },
      };
    },

    // Runs fn() with every query inside it pinned to one connection,
    // wrapped in BEGIN/COMMIT (or ROLLBACK on error). Route code needs
    // no changes — it just calls getDb().prepare(...) as usual, and
    // AsyncLocalStorage makes sure that resolves to this connection.
    transaction(fn) {
      return async (...args) => {
        const client = await pool.connect();
        try {
          await client.query('BEGIN');
          const out = await txContext.run(client, () => fn(...args));
          await client.query('COMMIT');
          return out;
        } catch (e) {
          try {
            await client.query('ROLLBACK');
          } catch {}
          throw e;
        } finally {
          client.release();
        }
      };
    },

    async exec(sql) {
      await executor().query(sql);
    },

    pragma() {
      /* no-op — SQLite-only concept (WAL mode, foreign key enforcement
         toggle). Postgres enforces foreign keys by default and has no
         equivalent pragma; nothing to translate. */
    },
  };
}

module.exports = { initPool, makeDb, get pool() { return pool; } };