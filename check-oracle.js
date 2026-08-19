/*
 * Oracle connection doctor.
 *   node check-oracle.js
 *
 * Run this BEFORE `npm start` when switching to Oracle. It tells you
 * exactly which step failed instead of a wall of stack trace.
 */
require('dotenv').config({ quiet: true });

const need = ['ORA_USER', 'ORA_PASSWORD', 'ORA_CONNECT'];
const c = { ok: '\x1b[32m✓\x1b[0m', no: '\x1b[31m✗\x1b[0m', warn: '\x1b[33m!\x1b[0m' };

(async () => {
  console.log('\n  Lotus Cinema — Oracle check\n');

  // 1. env vars
  const missing = need.filter((k) => !process.env[k]);
  if (missing.length) {
    console.log(`  ${c.no} Missing: ${missing.join(', ')}`);
    console.log('\n    Create backend/.env  (copy .env.example) with:');
    console.log('      USE_ORACLE=true');
    console.log('      ORA_USER=lotus');
    console.log('      ORA_PASSWORD=lotus123');
    console.log('      ORA_CONNECT=localhost:1521/XEPDB1\n');
    process.exit(1);
  }
  console.log(`  ${c.ok} env vars set`);
  console.log(`      user:    ${process.env.ORA_USER}`);
  console.log(`      connect: ${process.env.ORA_CONNECT}`);

  // 2. driver
  let oracledb;
  try {
    oracledb = require('oracledb');
    console.log(`  ${c.ok} oracledb driver v${oracledb.versionString}`);
  } catch {
    console.log(`  ${c.no} oracledb not installed  →  npm install oracledb\n`);
    process.exit(1);
  }
  oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;

  // 3. connect
  let conn;
  try {
    conn = await oracledb.getConnection({
      user: process.env.ORA_USER,
      password: process.env.ORA_PASSWORD,
      connectString: process.env.ORA_CONNECT,
    });
    console.log(`  ${c.ok} connected`);
  } catch (e) {
    console.log(`  ${c.no} connection failed: ${e.message}\n`);
    if (/ORA-01017/.test(e.message)) console.log('    → Wrong username or password.');
    if (/ORA-12541|ECONNREFUSED|NJS-503/.test(e.message)) {
      console.log('    → Nothing listening on that host/port.');
      console.log('      Is the Oracle service running? On Windows check');
      console.log('      Services for OracleServiceXE + OracleXETNSListener.');
    }
    if (/ORA-12514/.test(e.message))
      console.log('    → Service name wrong. Try XEPDB1, XE, or ORCL.');
    if (/DPI-1047|NJS-116/.test(e.message))
      console.log('    → Needs Instant Client. Set ORA_CLIENT_LIB in .env');
    console.log('');
    process.exit(1);
  }

  // 4. tables
  const want = [
    'CITIES','CINEMAS','HALLS','SEATS','USERS','MOVIES','GENRES','MOVIE_GENRES',
    'FAVORITES','REVIEWS','SHOWTIMES','SHOW_SEATS','COUPONS','BOOKINGS',
    'BOOKING_SEATS','PAYMENTS','TICKETS','CONCESSIONS','BOOKING_CONCESSIONS',
  ];
  const r = await conn.execute(`SELECT table_name FROM user_tables`);
  const have = r.rows.map((x) => x.TABLE_NAME.toUpperCase());
  const lost = want.filter((t) => !have.includes(t));
  if (lost.length) {
    console.log(`  ${c.no} missing tables: ${lost.join(', ')}`);
    console.log('    → Run sql/01_schema.sql first.\n');
  } else {
    console.log(`  ${c.ok} all 19 tables present`);
  }

  // 5. procedures
  const p = await conn.execute(
    `SELECT object_name FROM user_objects WHERE object_type='PROCEDURE'`
  );
  const procs = p.rows.map((x) => x.OBJECT_NAME.toUpperCase());
  for (const proc of ['GEN_SEATS', 'CREATE_SHOWTIME']) {
    if (procs.includes(proc)) console.log(`  ${c.ok} procedure ${proc}`);
    else console.log(`  ${c.no} procedure ${proc} missing → run sql/03_procedures.sql`);
  }

  // 6. data
  const counts = {};
  for (const t of ['movies', 'genres', 'users', 'seats', 'showtimes', 'show_seats', 'concessions']) {
    if (!have.includes(t.toUpperCase())) continue;
    const q = await conn.execute(`SELECT COUNT(*) AS n FROM ${t}`);
    counts[t] = q.rows[0].N;
  }
  console.log('');
  const expect = { movies: 39, genres: 16, users: 3, seats: 384, showtimes: 7, show_seats: 672, concessions: 19 };
  for (const [k, v] of Object.entries(counts)) {
    const e = expect[k];
    const mark = v === e ? c.ok : v === 0 ? c.no : c.warn;
    console.log(`  ${mark} ${k.padEnd(12)} ${String(v).padStart(4)}   (expected ${e})`);
  }
  if (Object.values(counts).some((v) => v === 0))
    console.log('\n    → Empty tables. Run sql/02_seed.sql (after 01 and 03).');

  // 7. password hashes
  if (have.includes('USERS') && counts.users > 0) {
    const u = await conn.execute(
      `SELECT username, role, LENGTH(password_hash) AS len FROM users ORDER BY user_id`
    );
    console.log('');
    for (const row of u.rows) {
      const good = row.LEN === 60;
      console.log(
        `  ${good ? c.ok : c.no} ${row.USERNAME.padEnd(10)} ${row.ROLE.padEnd(9)} hash=${row.LEN}${
          good ? '' : '  ← should be 60, reload sql/02_seed.sql'
        }`
      );
    }
  }

  await conn.close();
  console.log(`\n  Done. If everything is ${c.ok}, run:  npm start\n`);
  process.exit(0);
})().catch((e) => {
  console.error('\n  Unexpected error:', e.message, '\n');
  process.exit(1);
});
