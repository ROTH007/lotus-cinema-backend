/*
 * Lotus Cinema — database layer
 * ------------------------------------------------------------
 * Three modes now:
 *
 *   1. Demo (default, USE_ORACLE and USE_POSTGRES both unset):
 *      better-sqlite3, zero config, auto-seeds. Good for quick local
 *      testing, but NOT persistent if deployed on a container that
 *      restarts (Render free tier restarts the filesystem itself).
 *
 *   2. Oracle (USE_ORACLE=true): your local development database.
 *      Load sql/01_schema.sql, 03_procedures.sql, 02_seed.sql by hand.
 *
 *   3. Postgres (USE_POSTGRES=true): a persistent, separately-hosted
 *      database (Neon, free tier) for the DEPLOYED backend. This is
 *      the fix for "everything I add disappears" — Render's container
 *      can restart as often as it likes; Neon is a different service
 *      entirely and is untouched by that. Schema + seed run ONCE ever
 *      (checked via information_schema on boot), so anything a manager
 *      adds afterwards is never overwritten by a re-seed.
 */
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');

const USE_ORACLE = process.env.USE_ORACLE === 'true';
const USE_POSTGRES = process.env.USE_POSTGRES === 'true';

let db;        // raw better-sqlite3 handle (demo mode)
let handle;    // async facade handed to the routes
let oracleReady = false;


/* ------------------------------------------------------------------
 * Async facade over better-sqlite3.
 * The Oracle and Postgres adapters are both async (no sync driver
 * exists for either), so the routes await every DB call. To keep ONE
 * set of route files working on all three databases, the SQLite
 * handle is wrapped to return promises too. It's still synchronous
 * underneath — just promise-shaped.
 * ---------------------------------------------------------------- */
function asyncWrap(raw) {
  return {
    prepare(sql) {
      const st = raw.prepare(sql);
      return {
        get: async (...p) => st.get(...p),
        all: async (...p) => st.all(...p),
        run: async (...p) => st.run(...p),
      };
    },
    transaction(fn) {
      // better-sqlite3 transactions can't wrap async fns, so run the
      // steps manually with explicit BEGIN/COMMIT.
      return async (...args) => {
        raw.exec('BEGIN');
        try {
          const out = await fn(...args);
          raw.exec('COMMIT');
          return out;
        } catch (e) {
          try { raw.exec('ROLLBACK'); } catch {}
          throw e;
        }
      };
    },
    exec: async (sql) => raw.exec(sql),
    pragma: (p) => raw.pragma(p),
    _raw: raw,
  };
}

async function initDb() {
  if (handle) return handle;

  if (USE_ORACLE) {
    const { initPool, makeDb } = require('./oracle-adapter');
    await initPool();
    handle = makeDb();
    oracleReady = true;
    console.log('  connected to Oracle:', process.env.ORA_CONNECT);
    return handle;
  }

  if (USE_POSTGRES) {
    const { initPool, makeDb } = require('./postgres-adapter');
    await initPool();
    handle = makeDb();
    console.log('  connected to Postgres (persistent — survives restarts)');

    const exists = await handle
      .prepare(
        `SELECT EXISTS (
           SELECT FROM information_schema.tables WHERE table_name = 'movies'
         ) AS ok`
      )
      .get();

    if (!exists.ok) {
      console.log('  first boot on this database — creating schema and seeding once');
      await createSchemaPg(handle);
      await seedPg(handle);
      console.log('  seed complete. From now on this data persists across every restart.');
    } else {
      console.log('  schema already exists — skipping seed, keeping whatever is already there');
    }

    return handle;
  }

  const Database = require('better-sqlite3');
  const file = path.join(__dirname, 'lotus.db');
  const firstRun = !fs.existsSync(file);
  db = new Database(file);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  createSchema();
  if (firstRun) await seed();
  handle = asyncWrap(db);
  return handle;
}

// Routes call this synchronously; initDb() has already run at boot.
function getDb() {
  if (!handle) throw new Error('Database not ready — call initDb() before serving requests.');
  return handle;
}

function createSchema() {
  db.exec(`
  CREATE TABLE IF NOT EXISTS cities (
    city_id INTEGER PRIMARY KEY AUTOINCREMENT,
    city_name TEXT NOT NULL,
    city_name_km TEXT
  );
  CREATE TABLE IF NOT EXISTS cinemas (
    cinema_id INTEGER PRIMARY KEY AUTOINCREMENT,
    city_id INTEGER NOT NULL REFERENCES cities(city_id),
    name TEXT NOT NULL,
    address TEXT
  );
  CREATE TABLE IF NOT EXISTS halls (
    hall_id INTEGER PRIMARY KEY AUTOINCREMENT,
    cinema_id INTEGER NOT NULL REFERENCES cinemas(cinema_id),
    hall_name TEXT NOT NULL,
    hall_type TEXT DEFAULT 'STANDARD',
    floor INTEGER DEFAULT 1,
    capacity INTEGER DEFAULT 96,
    seat_rows INTEGER DEFAULT 8,
    seat_cols INTEGER DEFAULT 12
  );
  CREATE TABLE IF NOT EXISTS seats (
    seat_id INTEGER PRIMARY KEY AUTOINCREMENT,
    hall_id INTEGER NOT NULL REFERENCES halls(hall_id),
    seat_row TEXT NOT NULL,
    seat_col INTEGER NOT NULL,
    seat_type TEXT DEFAULT 'STANDARD',
    UNIQUE(hall_id, seat_row, seat_col)
  );
  CREATE TABLE IF NOT EXISTS users (
    user_id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT DEFAULT 'CUSTOMER',
    full_name TEXT,
    phone TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS movies (
    movie_id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    title_km TEXT,
    tagline TEXT,
    overview TEXT,
    release_year TEXT,
    release_date TEXT,
    runtime TEXT,
    rating REAL,
    language TEXT DEFAULT 'English',
    production TEXT,
    base_price REAL DEFAULT 6,
    poster_url TEXT,
    banner_url TEXT,
    trailer_url TEXT,
    status TEXT DEFAULT 'NOW_SHOWING',
    created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS genres (
    genre_id INTEGER PRIMARY KEY AUTOINCREMENT,
    genre_name TEXT NOT NULL UNIQUE,
    genre_name_km TEXT
  );
  CREATE TABLE IF NOT EXISTS movie_genres (
    movie_id INTEGER NOT NULL REFERENCES movies(movie_id) ON DELETE CASCADE,
    genre_id INTEGER NOT NULL REFERENCES genres(genre_id) ON DELETE CASCADE,
    PRIMARY KEY (movie_id, genre_id)
  );
  CREATE TABLE IF NOT EXISTS favorites (
    user_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    movie_id INTEGER NOT NULL REFERENCES movies(movie_id) ON DELETE CASCADE,
    added_at TEXT DEFAULT (datetime('now')),
    PRIMARY KEY (user_id, movie_id)
  );
  CREATE TABLE IF NOT EXISTS reviews (
    review_id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    movie_id INTEGER NOT NULL REFERENCES movies(movie_id) ON DELETE CASCADE,
    stars INTEGER NOT NULL CHECK (stars BETWEEN 1 AND 5),
    review_text TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    UNIQUE(user_id, movie_id)
  );
  CREATE TABLE IF NOT EXISTS showtimes (
    showtime_id INTEGER PRIMARY KEY AUTOINCREMENT,
    movie_id INTEGER NOT NULL REFERENCES movies(movie_id) ON DELETE CASCADE,
    hall_id INTEGER NOT NULL REFERENCES halls(hall_id),
    show_date TEXT NOT NULL,
    start_time TEXT NOT NULL,
    base_price REAL NOT NULL,
    screen_type TEXT DEFAULT '2D'
  );
  CREATE TABLE IF NOT EXISTS show_seats (
    show_seat_id INTEGER PRIMARY KEY AUTOINCREMENT,
    showtime_id INTEGER NOT NULL REFERENCES showtimes(showtime_id) ON DELETE CASCADE,
    seat_id INTEGER NOT NULL REFERENCES seats(seat_id),
    status TEXT DEFAULT 'AVAILABLE',
    price REAL NOT NULL,
    UNIQUE(showtime_id, seat_id)
  );
  CREATE TABLE IF NOT EXISTS coupons (
    coupon_id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT NOT NULL UNIQUE,
    discount_pct INTEGER NOT NULL,
    active INTEGER DEFAULT 1
  );
  CREATE TABLE IF NOT EXISTS bookings (
    booking_id INTEGER PRIMARY KEY AUTOINCREMENT,
    booking_ref TEXT NOT NULL UNIQUE,
    user_id INTEGER NOT NULL REFERENCES users(user_id),
    showtime_id INTEGER NOT NULL REFERENCES showtimes(showtime_id),
    coupon_id INTEGER REFERENCES coupons(coupon_id),
    subtotal REAL NOT NULL,
    discount REAL DEFAULT 0,
    total_price REAL NOT NULL,
    status TEXT DEFAULT 'CONFIRMED',
    created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS booking_seats (
    booking_seat_id INTEGER PRIMARY KEY AUTOINCREMENT,
    booking_id INTEGER NOT NULL REFERENCES bookings(booking_id) ON DELETE CASCADE,
    show_seat_id INTEGER NOT NULL REFERENCES show_seats(show_seat_id),
    UNIQUE(show_seat_id)
  );
  CREATE TABLE IF NOT EXISTS payments (
    payment_id INTEGER PRIMARY KEY AUTOINCREMENT,
    booking_id INTEGER NOT NULL REFERENCES bookings(booking_id) ON DELETE CASCADE,
    method TEXT NOT NULL,
    txn_ref TEXT NOT NULL,
    amount REAL NOT NULL,
    khqr_string TEXT,
    payment_status TEXT DEFAULT 'PAID',
    expires_at TEXT,
    paid_at TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS concessions (
    item_id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    name_km TEXT,
    category TEXT NOT NULL,
    item_size TEXT,
    price REAL NOT NULL,
    image_url TEXT,
    description TEXT,
    available INTEGER DEFAULT 1
  );
  CREATE TABLE IF NOT EXISTS booking_concessions (
    bc_id INTEGER PRIMARY KEY AUTOINCREMENT,
    booking_id INTEGER NOT NULL REFERENCES bookings(booking_id) ON DELETE CASCADE,
    item_id INTEGER NOT NULL REFERENCES concessions(item_id),
    quantity INTEGER NOT NULL,
    unit_price REAL NOT NULL
  );
  CREATE TABLE IF NOT EXISTS tickets (
    ticket_id INTEGER PRIMARY KEY AUTOINCREMENT,
    booking_id INTEGER NOT NULL REFERENCES bookings(booking_id) ON DELETE CASCADE,
    booking_seat_id INTEGER NOT NULL REFERENCES booking_seats(booking_seat_id) ON DELETE CASCADE,
    qr_code TEXT NOT NULL UNIQUE,
    issued_at TEXT DEFAULT (datetime('now'))
  );
  `);
}

/*
 * Same schema as createSchema() above, translated for Postgres.
 * Differences (everything else is identical SQL):
 *   INTEGER PRIMARY KEY AUTOINCREMENT  ->  SERIAL PRIMARY KEY
 *   datetime('now')                    ->  to_char(now() at time zone 'utc', ...)
 * REAL, TEXT, UNIQUE(...), REFERENCES ... ON DELETE CASCADE, and CHECK
 * constraints are all valid as-is in Postgres — no translation needed.
 */
async function createSchemaPg(handle) {
  const NOW = `to_char(now() at time zone 'utc', 'YYYY-MM-DD HH24:MI:SS')`;
  await handle.exec(`
  CREATE TABLE IF NOT EXISTS cities (
    city_id SERIAL PRIMARY KEY,
    city_name TEXT NOT NULL,
    city_name_km TEXT
  );
  CREATE TABLE IF NOT EXISTS cinemas (
    cinema_id SERIAL PRIMARY KEY,
    city_id INTEGER NOT NULL REFERENCES cities(city_id),
    name TEXT NOT NULL,
    address TEXT
  );
  CREATE TABLE IF NOT EXISTS halls (
    hall_id SERIAL PRIMARY KEY,
    cinema_id INTEGER NOT NULL REFERENCES cinemas(cinema_id),
    hall_name TEXT NOT NULL,
    hall_type TEXT DEFAULT 'STANDARD',
    floor INTEGER DEFAULT 1,
    capacity INTEGER DEFAULT 96,
    seat_rows INTEGER DEFAULT 8,
    seat_cols INTEGER DEFAULT 12
  );
  CREATE TABLE IF NOT EXISTS seats (
    seat_id SERIAL PRIMARY KEY,
    hall_id INTEGER NOT NULL REFERENCES halls(hall_id),
    seat_row TEXT NOT NULL,
    seat_col INTEGER NOT NULL,
    seat_type TEXT DEFAULT 'STANDARD',
    UNIQUE(hall_id, seat_row, seat_col)
  );
  CREATE TABLE IF NOT EXISTS users (
    user_id SERIAL PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT DEFAULT 'CUSTOMER',
    full_name TEXT,
    phone TEXT,
    created_at TEXT DEFAULT ${NOW}
  );
  CREATE TABLE IF NOT EXISTS movies (
    movie_id SERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    title_km TEXT,
    tagline TEXT,
    overview TEXT,
    release_year TEXT,
    release_date TEXT,
    runtime TEXT,
    rating REAL,
    language TEXT DEFAULT 'English',
    production TEXT,
    base_price REAL DEFAULT 6,
    poster_url TEXT,
    banner_url TEXT,
    trailer_url TEXT,
    status TEXT DEFAULT 'NOW_SHOWING',
    created_at TEXT DEFAULT ${NOW}
  );
  CREATE TABLE IF NOT EXISTS genres (
    genre_id SERIAL PRIMARY KEY,
    genre_name TEXT NOT NULL UNIQUE,
    genre_name_km TEXT
  );
  CREATE TABLE IF NOT EXISTS movie_genres (
    movie_id INTEGER NOT NULL REFERENCES movies(movie_id) ON DELETE CASCADE,
    genre_id INTEGER NOT NULL REFERENCES genres(genre_id) ON DELETE CASCADE,
    PRIMARY KEY (movie_id, genre_id)
  );
  CREATE TABLE IF NOT EXISTS favorites (
    user_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    movie_id INTEGER NOT NULL REFERENCES movies(movie_id) ON DELETE CASCADE,
    added_at TEXT DEFAULT ${NOW},
    PRIMARY KEY (user_id, movie_id)
  );
  CREATE TABLE IF NOT EXISTS reviews (
    review_id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    movie_id INTEGER NOT NULL REFERENCES movies(movie_id) ON DELETE CASCADE,
    stars INTEGER NOT NULL CHECK (stars BETWEEN 1 AND 5),
    review_text TEXT,
    created_at TEXT DEFAULT ${NOW},
    UNIQUE(user_id, movie_id)
  );
  CREATE TABLE IF NOT EXISTS showtimes (
    showtime_id SERIAL PRIMARY KEY,
    movie_id INTEGER NOT NULL REFERENCES movies(movie_id) ON DELETE CASCADE,
    hall_id INTEGER NOT NULL REFERENCES halls(hall_id),
    show_date TEXT NOT NULL,
    start_time TEXT NOT NULL,
    base_price REAL NOT NULL,
    screen_type TEXT DEFAULT '2D'
  );
  CREATE TABLE IF NOT EXISTS show_seats (
    show_seat_id SERIAL PRIMARY KEY,
    showtime_id INTEGER NOT NULL REFERENCES showtimes(showtime_id) ON DELETE CASCADE,
    seat_id INTEGER NOT NULL REFERENCES seats(seat_id),
    status TEXT DEFAULT 'AVAILABLE',
    price REAL NOT NULL,
    UNIQUE(showtime_id, seat_id)
  );
  CREATE TABLE IF NOT EXISTS coupons (
    coupon_id SERIAL PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    discount_pct INTEGER NOT NULL,
    active INTEGER DEFAULT 1
  );
  CREATE TABLE IF NOT EXISTS bookings (
    booking_id SERIAL PRIMARY KEY,
    booking_ref TEXT NOT NULL UNIQUE,
    user_id INTEGER NOT NULL REFERENCES users(user_id),
    showtime_id INTEGER NOT NULL REFERENCES showtimes(showtime_id),
    coupon_id INTEGER REFERENCES coupons(coupon_id),
    subtotal REAL NOT NULL,
    discount REAL DEFAULT 0,
    total_price REAL NOT NULL,
    status TEXT DEFAULT 'CONFIRMED',
    created_at TEXT DEFAULT ${NOW}
  );
  CREATE TABLE IF NOT EXISTS booking_seats (
    booking_seat_id SERIAL PRIMARY KEY,
    booking_id INTEGER NOT NULL REFERENCES bookings(booking_id) ON DELETE CASCADE,
    show_seat_id INTEGER NOT NULL REFERENCES show_seats(show_seat_id),
    UNIQUE(show_seat_id)
  );
  CREATE TABLE IF NOT EXISTS payments (
    payment_id SERIAL PRIMARY KEY,
    booking_id INTEGER NOT NULL REFERENCES bookings(booking_id) ON DELETE CASCADE,
    method TEXT NOT NULL,
    txn_ref TEXT NOT NULL,
    amount REAL NOT NULL,
    khqr_string TEXT,
    payment_status TEXT DEFAULT 'PAID',
    expires_at TEXT,
    paid_at TEXT DEFAULT ${NOW}
  );
  CREATE TABLE IF NOT EXISTS concessions (
    item_id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    name_km TEXT,
    category TEXT NOT NULL,
    item_size TEXT,
    price REAL NOT NULL,
    image_url TEXT,
    description TEXT,
    available INTEGER DEFAULT 1
  );
  CREATE TABLE IF NOT EXISTS booking_concessions (
    bc_id SERIAL PRIMARY KEY,
    booking_id INTEGER NOT NULL REFERENCES bookings(booking_id) ON DELETE CASCADE,
    item_id INTEGER NOT NULL REFERENCES concessions(item_id),
    quantity INTEGER NOT NULL,
    unit_price REAL NOT NULL
  );
  CREATE TABLE IF NOT EXISTS tickets (
    ticket_id SERIAL PRIMARY KEY,
    booking_id INTEGER NOT NULL REFERENCES bookings(booking_id) ON DELETE CASCADE,
    booking_seat_id INTEGER NOT NULL REFERENCES booking_seats(booking_seat_id) ON DELETE CASCADE,
    qr_code TEXT NOT NULL UNIQUE,
    issued_at TEXT DEFAULT ${NOW}
  );
  `);
}

/* ---- 8x12 seat grid: rows A-H, back rows VIP, middle PREMIUM ---- */
function genSeats(hallId) {
  // read this hall's grid size
  const hall = db.prepare('SELECT seat_rows, seat_cols FROM halls WHERE hall_id = ?').get(hallId);
  const rows = hall?.seat_rows || 8;
  const cols = hall?.seat_cols || 12;
  const ins = db.prepare(
    'INSERT INTO seats (hall_id, seat_row, seat_col, seat_type) VALUES (?,?,?,?)'
  );
  // top ~25% rows = VIP, next ~25% = PREMIUM, rest = STANDARD
  const vipFrom = rows - Math.max(1, Math.round(rows / 4));
  const premFrom = rows - Math.max(2, Math.round(rows / 2));
  for (let r = 1; r <= rows; r++) {
    const row = String.fromCharCode(64 + r);
    const type = r > vipFrom ? 'VIP' : r > premFrom ? 'PREMIUM' : 'STANDARD';
    for (let c = 1; c <= cols; c++) ins.run(hallId, row, c, type);
  }
}

/* Same idea as genSeats() above, but through the async Postgres handle
 * instead of the raw synchronous better-sqlite3 connection. */
async function genSeatsPg(handle, hallId) {
  const hall = await handle
    .prepare('SELECT seat_rows, seat_cols FROM halls WHERE hall_id = ?')
    .get(hallId);
  const rows = hall?.seat_rows || 8;
  const cols = hall?.seat_cols || 12;
  const vipFrom = rows - Math.max(1, Math.round(rows / 4));
  const premFrom = rows - Math.max(2, Math.round(rows / 2));
  for (let r = 1; r <= rows; r++) {
    const row = String.fromCharCode(64 + r);
    const type = r > vipFrom ? 'VIP' : r > premFrom ? 'PREMIUM' : 'STANDARD';
    for (let c = 1; c <= cols; c++) {
      await handle
        .prepare('INSERT INTO seats (hall_id, seat_row, seat_col, seat_type) VALUES (?,?,?,?)')
        .run(hallId, row, c, type);
    }
  }
}

/* ---- create showtime + open all seats with tiered pricing ----
 * Works on all three databases. On Oracle this calls the stored
 * procedure create_showtime() from sql/03_procedures.sql, so the logic
 * lives in the database where it belongs. On SQLite and Postgres we do
 * it inline (synchronously for SQLite, through the async handle for
 * Postgres).
 */
async function createShowtime(movieId, hallId, showDate, startTime, basePrice, screenType = '2D') {
  if (USE_ORACLE) {
    const oracledb = require('oracledb');
    const { pool } = require('./oracle-adapter');
    const conn = await pool.getConnection();
    try {
      await conn.execute(
        `BEGIN create_showtime(:mid, :hid, TO_DATE(:sdate,'YYYY-MM-DD'), :stime, :price); END;`,
        { mid: movieId, hid: hallId, sdate: showDate, stime: startTime, price: basePrice },
        { autoCommit: true }
      );
      const r = await conn.execute(
        `SELECT MAX(showtime_id) AS id FROM showtimes WHERE movie_id = :mid AND hall_id = :hid`,
        { mid: movieId, hid: hallId }
      );
      const stId = r.rows[0].ID;
      await conn.execute(
        `UPDATE showtimes SET screen_type = :sc WHERE showtime_id = :id`,
        { sc: screenType, id: stId },
        { autoCommit: true }
      );
      return stId;
    } finally {
      await conn.close();
    }
  }

  if (USE_POSTGRES) {
    const h = getDb();
    const info = await h
      .prepare(
        'INSERT INTO showtimes (movie_id, hall_id, show_date, start_time, base_price, screen_type) VALUES (?,?,?,?,?,?)'
      )
      .run(movieId, hallId, showDate, startTime, basePrice, screenType);
    const showtimeId = info.lastInsertRowid;
    const seats = await h.prepare('SELECT seat_id, seat_type FROM seats WHERE hall_id = ?').all(hallId);
    const bump = { VIP: 4, PREMIUM: 2, STANDARD: 0 };
    for (const s of seats) {
      await h
        .prepare('INSERT INTO show_seats (showtime_id, seat_id, status, price) VALUES (?,?,?,?)')
        .run(showtimeId, s.seat_id, 'AVAILABLE', basePrice + (bump[s.seat_type] || 0));
    }
    return showtimeId;
  }

  // ---- SQLite demo path ----
  const info = db
    .prepare(
      'INSERT INTO showtimes (movie_id, hall_id, show_date, start_time, base_price, screen_type) VALUES (?,?,?,?,?,?)'
    )
    .run(movieId, hallId, showDate, startTime, basePrice, screenType);
  const showtimeId = info.lastInsertRowid;
  const seats = db.prepare('SELECT seat_id, seat_type FROM seats WHERE hall_id = ?').all(hallId);
  const ins = db.prepare(
    'INSERT INTO show_seats (showtime_id, seat_id, status, price) VALUES (?,?,?,?)'
  );
  const bump = { VIP: 4, PREMIUM: 2, STANDARD: 0 };
  const tx = db.transaction(() => {
    for (const s of seats)
      ins.run(showtimeId, s.seat_id, 'AVAILABLE', basePrice + (bump[s.seat_type] || 0));
  });
  tx();
  return showtimeId;
}

async function seed() {
  const movies = require('./movies.seed.json');
  const genres = require('./genres.seed.json');

  const tx = db.transaction(() => {
    // Cities / cinemas / halls
    db.prepare("INSERT INTO cities (city_name, city_name_km) VALUES ('Phnom Penh','ភ្នំពេញ')").run();
    db.prepare("INSERT INTO cities (city_name, city_name_km) VALUES ('Siem Reap','សៀមរាប')").run();
    db.prepare("INSERT INTO cinemas (city_id,name,address) VALUES (1,'Lotus Cinema — Aeon Mall','Sen Sok, Phnom Penh')").run();
    db.prepare("INSERT INTO cinemas (city_id,name,address) VALUES (1,'Lotus Cinema — Chip Mong','Chroy Changvar, Phnom Penh')").run();
    db.prepare("INSERT INTO cinemas (city_id,name,address) VALUES (2,'Lotus Cinema — Siem Reap','Wat Bo Road, Siem Reap')").run();
    const hins = db.prepare(
      'INSERT INTO halls (cinema_id,hall_name,hall_type,floor,seat_rows,seat_cols,capacity) VALUES (?,?,?,?,?,?,?)'
    );
    hins.run(1, 'Hall A', 'STANDARD', 1, 8, 12, 96);          // 96 seats, floor 1
    hins.run(1, 'Hall B (IMAX)', 'IMAX', 1, 5, 10, 50);       // 50 seats, floor 1
    hins.run(2, 'Hall C (VIP)', 'VIP', 2, 5, 5, 25);          // 25 VIP seats, floor 2
    hins.run(3, 'Hall A', 'STANDARD', 2, 8, 12, 96);          // 96 seats, floor 2
    for (let h = 1; h <= 4; h++) genSeats(h);

    // Users
    const uins = db.prepare(
      'INSERT INTO users (username,email,password_hash,role,full_name) VALUES (?,?,?,?,?)'
    );
    uins.run('manager', 'manager@lotus.com', bcrypt.hashSync('manager123', 10), 'MANAGER', 'Lotus Manager');
    uins.run('sophea', 'sophea@mail.com', bcrypt.hashSync('user123', 10), 'CUSTOMER', 'Sophea Chan');
    uins.run('dara', 'dara@mail.com', bcrypt.hashSync('user123', 10), 'CUSTOMER', 'Dara Kim');

    // Genres
    const gins = db.prepare('INSERT INTO genres (genre_name, genre_name_km) VALUES (?,?)');
    const genreId = {};
    genres.forEach((g) => {
      const info = gins.run(g.name, g.nameKm);
      genreId[g.name] = info.lastInsertRowid;
    });

    // Movies (+ genre links) — ids come straight from the merged data
    const mins = db.prepare(`INSERT INTO movies
      (movie_id,title,title_km,tagline,overview,release_year,release_date,runtime,rating,language,production,base_price,poster_url,banner_url,trailer_url,status)
      VALUES (@id,@title,@title_km,@tagline,@overview,@release_year,@release_date,@runtime,@rating,@language,@production,@base_price,@poster,@banner,@trailer,@status)`);
    const mgins = db.prepare('INSERT INTO movie_genres (movie_id, genre_id) VALUES (?,?)');
    const priceFor = (m) => {
      let p = 6;
      const y = parseInt(m.releaseYear) || 0;
      if (y >= 2024) p += 1.5;
      return p;
    };
    // A handful of the newest titles are flagged COMING_SOON so the
    // homepage tab has content (mirrors what's set in Oracle).
    const comingSoonIds = new Set([31, 32, 33, 34, 35]);
    const statusFor = (m) => {
      if (comingSoonIds.has(m.id)) return 'COMING_SOON';
      const y = parseInt(m.releaseYear) || 0;
      return y >= 2023 ? 'NOW_SHOWING' : 'ARCHIVED';
    };
    for (const m of movies) {
      mins.run({
        id: m.id,
        title: m.title,
        title_km: m.titleKm || null,
        tagline: m.tagline || null,
        overview: m.overview || null,
        release_year: m.releaseYear || null,
        release_date: m.releaseDate || null,
        runtime: m.runtime || null,
        rating: m.rating ?? null,
        language: m.language || 'English',
        production: m.production || null,
        base_price: priceFor(m),
        poster: m.poster || null,
        banner: m.banner || null,
        trailer: m.trailer || null,
        status: statusFor(m),
      });
      for (const g of m.genres || []) if (genreId[g]) mgins.run(m.id, genreId[g]);
    }

    // Concessions menu
    const food = require('./concessions.seed.json');
    const fins = db.prepare(
      `INSERT INTO concessions (item_id,name,name_km,category,item_size,price,image_url,description,available)
       VALUES (?,?,?,?,?,?,?,?,1)`
    );
    for (const f of food)
      fins.run(f.id, f.name, f.nameKm, f.category, f.size, f.price, f.image, f.description);

    // Coupons
    const cins = db.prepare('INSERT INTO coupons (code, discount_pct, active) VALUES (?,?,1)');
    cins.run('WELCOME10', 10);
    cins.run('STUDENT20', 20);
    cins.run('LOTUS15', 15);
  });
  tx();

  // Showtimes (after commit so seats exist)
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  // Local date parts, not toISOString() — that converts to UTC and would
  // shift every seeded showtime a day earlier east of Greenwich.
  const d = (n) => {
    const x = new Date(today);
    x.setDate(x.getDate() + n);
    return (
      x.getFullYear() +
      '-' +
      String(x.getMonth() + 1).padStart(2, '0') +
      '-' +
      String(x.getDate()).padStart(2, '0')
    );
  };
  // spread across the week so the homepage date strip has something on every day
  const plan = [
    [1, 1, 0, '14:00', 6,  '2D'],
    [1, 2, 0, '19:30', 8,  'IMAX'],
    [1, 3, 0, '21:00', 12, '4DX'],
    [2, 1, 0, '17:00', 6,  '2D'],
    [3, 2, 0, '20:00', 8,  '3D'],
    [4, 3, 1, '15:30', 10, 'VIP'],
    [2, 1, 1, '13:00', 6,  '2D'],
    [6, 2, 1, '18:00', 7,  '3D'],
    [10, 4, 2, '16:00', 6, '2D'],
    [6, 1, 2, '18:00', 7,  '3D'],
    [3, 2, 2, '20:30', 8,  'IMAX'],
    [4, 1, 3, '14:30', 6,  '2D'],
    [10, 2, 3, '19:00', 8, '3D'],
    [1, 1, 4, '15:00', 6,  '2D'],
    [2, 3, 4, '21:00', 12, 'VIP'],
    [6, 4, 5, '17:30', 6,  '2D'],
    [3, 1, 5, '20:00', 7,  '2D'],
    [4, 2, 6, '16:30', 8,  'IMAX'],
  ];
  for (const [mv, hall, day, time, price, screen] of plan) {
    await createShowtime(mv, hall, d(day), time, price, screen);
  }

  console.log('  seeded: 39 movies, 16 genres, 19 menu items, 3 users, 7 showtimes, 4 halls x 96 seats');
}

/*
 * Same seeding logic as seed() above, but through the async Postgres
 * handle instead of raw synchronous better-sqlite3 calls, and with a
 * setval() fix after every table that's seeded with explicit ids
 * (movies, concessions) — otherwise Postgres's own auto-increment
 * counter stays at 1 while seeded rows already occupy ids up to ~39,
 * and the very first movie a manager adds live collides with movie_id
 * 1 (the exact same class of bug the local Oracle setup hit before —
 * see fix-identity.sql from that earlier fix).
 */
async function seedPg(handle) {
  const movies = require('./movies.seed.json');
  const genres = require('./genres.seed.json');
  const food = require('./concessions.seed.json');

  await handle.prepare("INSERT INTO cities (city_name, city_name_km) VALUES ('Phnom Penh','ភ្នំពេញ')").run();
  await handle.prepare("INSERT INTO cities (city_name, city_name_km) VALUES ('Siem Reap','សៀមរាប')").run();
  await handle.prepare("INSERT INTO cinemas (city_id,name,address) VALUES (1,'Lotus Cinema — Aeon Mall','Sen Sok, Phnom Penh')").run();
  await handle.prepare("INSERT INTO cinemas (city_id,name,address) VALUES (1,'Lotus Cinema — Chip Mong','Chroy Changvar, Phnom Penh')").run();
  await handle.prepare("INSERT INTO cinemas (city_id,name,address) VALUES (2,'Lotus Cinema — Siem Reap','Wat Bo Road, Siem Reap')").run();

  const hallSpec = [
    [1, 'Hall A', 'STANDARD', 1, 8, 12, 96],
    [1, 'Hall B (IMAX)', 'IMAX', 1, 5, 10, 50],
    [2, 'Hall C (VIP)', 'VIP', 2, 5, 5, 25],
    [3, 'Hall A', 'STANDARD', 2, 8, 12, 96],
  ];
  for (const h of hallSpec) {
    await handle
      .prepare('INSERT INTO halls (cinema_id,hall_name,hall_type,floor,seat_rows,seat_cols,capacity) VALUES (?,?,?,?,?,?,?)')
      .run(...h);
  }
  for (let hallId = 1; hallId <= 4; hallId++) await genSeatsPg(handle, hallId);

  await handle
    .prepare('INSERT INTO users (username,email,password_hash,role,full_name) VALUES (?,?,?,?,?)')
    .run('manager', 'manager@lotus.com', bcrypt.hashSync('manager123', 10), 'MANAGER', 'Lotus Manager');
  await handle
    .prepare('INSERT INTO users (username,email,password_hash,role,full_name) VALUES (?,?,?,?,?)')
    .run('sophea', 'sophea@mail.com', bcrypt.hashSync('user123', 10), 'CUSTOMER', 'Sophea Chan');
  await handle
    .prepare('INSERT INTO users (username,email,password_hash,role,full_name) VALUES (?,?,?,?,?)')
    .run('dara', 'dara@mail.com', bcrypt.hashSync('user123', 10), 'CUSTOMER', 'Dara Kim');

  const genreId = {};
  for (const g of genres) {
    const info = await handle
      .prepare('INSERT INTO genres (genre_name, genre_name_km) VALUES (?,?)')
      .run(g.name, g.nameKm);
    genreId[g.name] = info.lastInsertRowid;
  }

  const priceFor = (m) => {
    let p = 6;
    const y = parseInt(m.releaseYear) || 0;
    if (y >= 2024) p += 1.5;
    return p;
  };
  const comingSoonIds = new Set([31, 32, 33, 34, 35]);
  const statusFor = (m) => {
    if (comingSoonIds.has(m.id)) return 'COMING_SOON';
    const y = parseInt(m.releaseYear) || 0;
    return y >= 2023 ? 'NOW_SHOWING' : 'ARCHIVED';
  };
  for (const m of movies) {
    await handle
      .prepare(
        `INSERT INTO movies
         (movie_id,title,title_km,tagline,overview,release_year,release_date,runtime,rating,language,production,base_price,poster_url,banner_url,trailer_url,status)
         VALUES (@id,@title,@title_km,@tagline,@overview,@release_year,@release_date,@runtime,@rating,@language,@production,@base_price,@poster,@banner,@trailer,@status)`
      )
      .run({
        id: m.id,
        title: m.title,
        title_km: m.titleKm || null,
        tagline: m.tagline || null,
        overview: m.overview || null,
        release_year: m.releaseYear || null,
        release_date: m.releaseDate || null,
        runtime: m.runtime || null,
        rating: m.rating ?? null,
        language: m.language || 'English',
        production: m.production || null,
        base_price: priceFor(m),
        poster: m.poster || null,
        banner: m.banner || null,
        trailer: m.trailer || null,
        status: statusFor(m),
      });
    for (const g of m.genres || []) {
      if (genreId[g]) await handle.prepare('INSERT INTO movie_genres (movie_id, genre_id) VALUES (?,?)').run(m.id, genreId[g]);
    }
  }
  // movies were seeded with explicit ids — bump the sequence past the
  // highest one, or the next live "add movie" collides with movie_id 1.
  await handle.exec(`SELECT setval('movies_movie_id_seq', (SELECT MAX(movie_id) FROM movies))`);

  for (const f of food) {
    await handle
      .prepare(
        `INSERT INTO concessions (item_id,name,name_km,category,item_size,price,image_url,description,available)
         VALUES (?,?,?,?,?,?,?,?,1)`
      )
      .run(f.id, f.name, f.nameKm, f.category, f.size, f.price, f.image, f.description);
  }
  // same fix, same reason, for concessions' explicit ids
  await handle.exec(`SELECT setval('concessions_item_id_seq', (SELECT MAX(item_id) FROM concessions))`);

  await handle.prepare('INSERT INTO coupons (code, discount_pct, active) VALUES (?,?,1)').run('WELCOME10', 10);
  await handle.prepare('INSERT INTO coupons (code, discount_pct, active) VALUES (?,?,1)').run('STUDENT20', 20);
  await handle.prepare('INSERT INTO coupons (code, discount_pct, active) VALUES (?,?,1)').run('LOTUS15', 15);

  // Showtimes — same date-spreading plan as the SQLite seed
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = (n) => {
    const x = new Date(today);
    x.setDate(x.getDate() + n);
    return (
      x.getFullYear() +
      '-' +
      String(x.getMonth() + 1).padStart(2, '0') +
      '-' +
      String(x.getDate()).padStart(2, '0')
    );
  };
  const plan = [
    [1, 1, 0, '14:00', 6,  '2D'],
    [1, 2, 0, '19:30', 8,  'IMAX'],
    [1, 3, 0, '21:00', 12, '4DX'],
    [2, 1, 0, '17:00', 6,  '2D'],
    [3, 2, 0, '20:00', 8,  '3D'],
    [4, 3, 1, '15:30', 10, 'VIP'],
    [2, 1, 1, '13:00', 6,  '2D'],
    [6, 2, 1, '18:00', 7,  '3D'],
    [10, 4, 2, '16:00', 6, '2D'],
    [6, 1, 2, '18:00', 7,  '3D'],
    [3, 2, 2, '20:30', 8,  'IMAX'],
    [4, 1, 3, '14:30', 6,  '2D'],
    [10, 2, 3, '19:00', 8, '3D'],
    [1, 1, 4, '15:00', 6,  '2D'],
    [2, 3, 4, '21:00', 12, 'VIP'],
    [6, 4, 5, '17:30', 6,  '2D'],
    [3, 1, 5, '20:00', 7,  '2D'],
    [4, 2, 6, '16:30', 8,  'IMAX'],
  ];
  for (const [mv, hall, day, time, price, screen] of plan) {
    await createShowtime(mv, hall, d(day), time, price, screen);
  }

  console.log('  seeded (Postgres): 39 movies, 16 genres, 19 menu items, 3 users, 18 showtimes, 4 halls');
}

module.exports = { initDb, getDb, genSeats, createShowtime, USE_ORACLE, USE_POSTGRES };