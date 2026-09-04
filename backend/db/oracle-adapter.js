/*
 * Oracle adapter for Lotus Cinema
 * ------------------------------------------------------------
 * Exposes the SAME tiny surface as better-sqlite3 so the route
 * files work unchanged on both databases:
 *
 *     db.prepare(sql).get(...params)   -> one row  | undefined
 *     db.prepare(sql).all(...params)   -> array of rows
 *     db.prepare(sql).run(...params)   -> { lastInsertRowid, changes }
 *     db.transaction(fn)()             -> runs fn atomically
 *
 * Differences it papers over:
 *   - placeholders:  ?      -> :1, :2, :3 …
 *   - named binds:   @name  -> :name
 *   - lastInsertRowid: Oracle needs RETURNING … INTO, so we detect
 *     INSERTs and append it automatically.
 *   - column names: Oracle upper-cases them; we lower-case keys back
 *     so `row.movie_id` keeps working.
 *   - booleans / dates normalised to what the routes expect.
 *
 * NOTE: better-sqlite3 is synchronous, node-oracledb is async. Node
 * can't make async look sync, so every route that touches the DB is
 * async already via the thin wrapper in db/index.js (see runSync).
 */
const oracledb = require('oracledb');

oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;
oracledb.autoCommit = true;
oracledb.fetchAsString = [oracledb.CLOB];

let pool = null;

/* ---------- pool ---------- */
async function initPool() {
  if (pool) return pool;
  const cfg = {
    user: process.env.ORA_USER,
    password: process.env.ORA_PASSWORD,
    connectString: process.env.ORA_CONNECT,
    poolMin: 1,
    poolMax: 10,
    poolIncrement: 1,
  };
  if (!cfg.user || !cfg.password || !cfg.connectString) {
    throw new Error(
      'Oracle mode needs ORA_USER, ORA_PASSWORD and ORA_CONNECT. ' +
        'Example: ORA_CONNECT=localhost:1521/XEPDB1'
    );
  }
  // Thick mode only if the user points us at an Instant Client
  if (process.env.ORA_CLIENT_LIB) {
    try {
      oracledb.initOracleClient({ libDir: process.env.ORA_CLIENT_LIB });
    } catch (e) {
      console.warn('  (thick client not loaded, staying in thin mode):', e.message);
    }
  }
  pool = await oracledb.createPool(cfg);

  // createPool() is lazy — it does NOT prove the database is reachable.
  // Borrow a connection and run a trivial query so a bad host/password
  // fails HERE at boot, not on the first user request.
  const conn = await pool.getConnection();
  try {
    await conn.execute('SELECT 1 FROM dual');
  } finally {
    await conn.close();
  }
  return pool;
}

/* ---------- SQL translation ---------- */

// The routes are written in SQLite dialect. Translate the handful of
// constructs Oracle spells differently.
function translate(sql) {
  let s = sql;

  // datetime('now') -> SYSTIMESTAMP  (tolerate escaped quotes: datetime(\'now\'))
  s = s.replace(/datetime\(\s*\\?'now\\?'\s*\)/gi, 'SYSTIMESTAMP');

  // substr(x,1,10) works in both — leave it.

  // COALESCE / AVG / COUNT are the same.

  // INSERT OR IGNORE  ->  MERGE-less trick: handled by caller catching DUP_VAL
  s = s.replace(/INSERT\s+OR\s+IGNORE\s+INTO/gi, 'INSERT INTO');

  // LIMIT n  ->  FETCH FIRST n ROWS ONLY
  s = s.replace(/\bLIMIT\s+(\d+)\b/gi, 'FETCH FIRST $1 ROWS ONLY');

  // show_date is a real DATE in Oracle but the app passes 'YYYY-MM-DD'
  // strings (SQLite stores dates as text). Wrap the bind so Oracle can
  // compare / assign them:  show_date = ?  ->  show_date = TO_DATE(?,'YYYY-MM-DD')
  s = s.replace(
    /(\b(?:\w+\.)?show_date\s*(?:=|>=|<=|>|<))\s*\?/gi,
    "$1 TO_DATE(?,'YYYY-MM-DD')"
  );

  return s;
}

/*
 * The database NLS_CHARACTERSET is WE8MSWIN1252 (Western European),
 * which cannot represent Khmer. If we bind a Khmer string as a plain
 * value, node-oracledb sends it as VARCHAR2 and Oracle converts it
 * through that charset — every character becomes U+00BF ('¿').
 *
 * Binding it explicitly as NVARCHAR2 routes it through
 * NLS_NCHAR_CHARACTERSET (AL16UTF16) instead, which holds Khmer fine.
 * That's what the N'…' prefix does in SQL; this is the bind equivalent.
 *
 * Plain ASCII is left alone so nothing else changes behaviour.
 */
const NON_ASCII = /[^\x00-\x7F]/;

function bindValue(v) {
  if (typeof v === 'string' && NON_ASCII.test(v)) {
    return { val: v, type: oracledb.DB_TYPE_NVARCHAR, dir: oracledb.BIND_IN };
  }
  return v;
}

// ?  ->  :1 :2 :3 …   |   @name -> :name
function bindify(sql, params) {
  // named style: caller passed a single object
  if (params.length === 1 && params[0] && typeof params[0] === 'object' && !Array.isArray(params[0])) {
    const named = {};
    for (const k of Object.keys(params[0])) named[k] = bindValue(params[0][k]);
    return { sql: sql.replace(/@(\w+)/g, ':$1'), binds: named };
  }
  // positional style
  let i = 0;
  const out = sql.replace(/\?/g, () => `:${++i}`);
  const binds = {};
  params.forEach((v, idx) => (binds[String(idx + 1)] = bindValue(v)));
  return { sql: out, binds };
}

const isInsert = (sql) => /^\s*INSERT\s/i.test(sql);

// figure out the PK column so RETURNING works
function pkFor(sql) {
  const m = /INSERT\s+(?:OR\s+IGNORE\s+)?INTO\s+(\w+)/i.exec(sql);
  if (!m) return null;
  const table = m[1].toLowerCase();
  // Tables with a composite PK have no identity column — no RETURNING clause.
  const noPk = ['movie_genres', 'favorites'];
  if (noPk.includes(table)) return null;
  const map = {
    users: 'user_id',
    movies: 'movie_id',
    genres: 'genre_id',
    cities: 'city_id',
    cinemas: 'cinema_id',
    halls: 'hall_id',
    seats: 'seat_id',
    showtimes: 'showtime_id',
    show_seats: 'show_seat_id',
    bookings: 'booking_id',
    booking_seats: 'booking_seat_id',
    payments: 'payment_id',
    tickets: 'ticket_id',
    reviews: 'review_id',
    coupons: 'coupon_id',
  };
  return map[table] || null;
}

// Oracle returns MOVIE_ID; routes read row.movie_id
function lower(row) {
  if (!row) return row;
  const out = {};
  for (const k of Object.keys(row)) {
    let v = row[k];
    // DATE columns -> 'YYYY-MM-DD'.
    // NOT toISOString(): that converts to UTC, so a show_date stored as
    // 2026-07-29 00:00 in Cambodia (UTC+7) would come back as
    // '2026-07-28' and the homepage would look for the wrong day.
    // Read the local date parts instead.
    if (v instanceof Date) {
      v =
        v.getFullYear() +
        '-' +
        String(v.getMonth() + 1).padStart(2, '0') +
        '-' +
        String(v.getDate()).padStart(2, '0');
    }
    out[k.toLowerCase()] = v;
  }
  return out;
}

/* ---------- statement ---------- */
function makeStatement(rawSql, getConn) {
  const ignoreDupes = /INSERT\s+OR\s+IGNORE/i.test(rawSql);
  const sql = translate(rawSql);

  async function exec(params, opts = {}) {
    const { sql: bound, binds } = bindify(sql, params);
    const { conn, release } = await getConn();
    try {
      return await conn.execute(bound, binds, { autoCommit: opts.autoCommit !== false });
    } finally {
      await release();
    }
  }

  return {
    async get(...params) {
      const r = await exec(params);
      return lower(r.rows?.[0]);
    },
    async all(...params) {
      const r = await exec(params);
      return (r.rows || []).map(lower);
    },
    async run(...params) {
      const pk = isInsert(sql) ? pkFor(sql) : null;
      let finalSql = sql;
      let extra = {};
      if (pk && !/RETURNING/i.test(sql)) {
        finalSql = sql.replace(/;?\s*$/, ` RETURNING ${pk} INTO :out_id`);
      }
      const { sql: bound, binds } = bindify(finalSql, params);
      if (pk && !/RETURNING/i.test(sql)) {
        binds.out_id = { dir: oracledb.BIND_OUT, type: oracledb.NUMBER };
      }
      const { conn, release } = await getConn();
      try {
        const r = await conn.execute(bound, binds, { autoCommit: true });
        return {
          lastInsertRowid: r.outBinds?.out_id?.[0] ?? null,
          changes: r.rowsAffected ?? 0,
        };
      } catch (e) {
        // emulate SQLite's INSERT OR IGNORE: swallow unique-constraint violations
        if (/ORA-00001/.test(e.message) && ignoreDupes) {
          return { lastInsertRowid: null, changes: 0 };
        }
        throw e;
      } finally {
        await release();
      }
    },
  };
}

/* ---------- db handle ---------- */
function makeDb() {
  // when inside a transaction we reuse one connection
  let txConn = null;

  const getConn = async () => {
    if (txConn) return { conn: txConn, release: async () => {} };
    const c = await pool.getConnection();
    return { conn: c, release: () => c.close() };
  };

  return {
    prepare: (sql) => makeStatement(sql, getConn),

    // db.transaction(fn)() — mirrors better-sqlite3's shape
    transaction(fn) {
      return async (...args) => {
        const conn = await pool.getConnection();
        txConn = conn;
        try {
          const out = await fn(...args);
          await conn.commit();
          return out;
        } catch (e) {
          await conn.rollback();
          throw e;
        } finally {
          txConn = null;
          await conn.close();
        }
      };
    },

    exec: async (sql) => {
      const conn = await pool.getConnection();
      try {
        await conn.execute(translate(sql), {}, { autoCommit: true });
      } finally {
        await conn.close();
      }
    },

    pragma: () => {}, // no-op on Oracle
  };
}

module.exports = { initPool, makeDb, get pool() { return pool; } };