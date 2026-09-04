/*
 * Lotus Cinema — database layer
 * ------------------------------------------------------------
 * Demo mode (default): better-sqlite3, zero config, auto-seeds
 * from the exact movie data pulled out of the React project.
 * The SQLite schema mirrors sql/01_schema.sql so the SQL you
 * hand your professor maps 1:1 to what runs here.
 *
 * Oracle mode: set USE_ORACLE=true and provide ORA_* env vars,
 * then load sql/01_schema.sql, 03_procedures.sql, 02_seed.sql.
 */
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');

const USE_ORACLE = process.env.USE_ORACLE === 'true';

let db;        // raw better-sqlite3 handle (demo mode)
let handle;    // async facade handed to the routes
let oracleReady = false;


/* ------------------------------------------------------------------
 * Async facade over better-sqlite3.
 * The Oracle adapter is async (node-oracledb has no sync API), so the
 * routes await every DB call. To keep ONE set of route files working
 * on both databases, the SQLite handle is wrapped to return promises
 * too. It's still synchronous underneath — just promise-shaped.
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

/* ---- create showtime + open all seats with tiered pricing ----
 * Works on both databases. On Oracle this calls the stored procedure
 * create_showtime() from sql/03_procedures.sql, so the logic lives in
 * the database where it belongs. On SQLite we do it inline.
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

module.exports = { initDb, getDb, genSeats, createShowtime, USE_ORACLE };