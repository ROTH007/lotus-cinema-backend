const express = require('express');
const { getDb } = require('../db');
const { auth, managerOnly } = require('../config/auth');

const router = express.Router();

// attach genres array to a movie row
async function withGenres(db, movie) {
  const genres = await db
    .prepare(
      `SELECT g.genre_name AS name, g.genre_name_km AS nameKm
       FROM movie_genres mg JOIN genres g ON g.genre_id = mg.genre_id
       WHERE mg.movie_id = ?`
    )
    .all(movie.movie_id);
  return {
    id: movie.movie_id,
    title: movie.title,
    titleKm: movie.title_km,
    tagline: movie.tagline,
    overview: movie.overview,
    releaseYear: movie.release_year,
    releaseDate: movie.release_date,
    runtime: movie.runtime,
    rating: movie.rating,
    language: movie.language,
    production: movie.production,
    basePrice: movie.base_price,
    poster: movie.poster_url,
    banner: movie.banner_url,
    trailer: movie.trailer_url,
    status: movie.status,
    genres: genres.map((g) => g.name),
    genresKm: genres.map((g) => g.nameKm),
  };
}

// GET /api/movies?q=&genre=&status=
router.get('/', async (req, res) => {
  const db = getDb();
  const { q, genre, status } = req.query;
  let sql = 'SELECT DISTINCT m.* FROM movies m';
  const where = [];
  const params = [];
  if (genre && genre !== 'All') {
    sql += ' JOIN movie_genres mg ON mg.movie_id = m.movie_id JOIN genres g ON g.genre_id = mg.genre_id';
    where.push('g.genre_name = ?');
    params.push(genre);
  }
  if (status) {
    where.push('m.status = ?');
    params.push(status);
  }
  if (q) {
    where.push('(LOWER(m.title) LIKE ? OR LOWER(m.title_km) LIKE ?)');
    params.push('%' + q.toLowerCase() + '%', '%' + q.toLowerCase() + '%');
  }
  if (where.length) sql += ' WHERE ' + where.join(' AND ');
  sql += ' ORDER BY m.movie_id';
  const rows = await db
    .prepare(sql).all(...params);
  res.json(await Promise.all(rows.map((r) => withGenres(db, r))));
});

// GET /api/movies/genres
router.get('/genres', async (req, res) => {
  const db = getDb();
  const rows = await db
    .prepare('SELECT genre_id, genre_name, genre_name_km FROM genres ORDER BY genre_name').all();
  res.json(rows.map((g) => ({ id: g.genre_id, name: g.genre_name, nameKm: g.genre_name_km })));
});

// GET /api/movies/:id  (detail + showtimes + reviews)
router.get('/:id', async (req, res) => {
  const db = getDb();
  const movie = await db
    .prepare('SELECT * FROM movies WHERE movie_id = ?').get(req.params.id);
  if (!movie) return res.status(404).json({ error: 'Movie not found' });

  const showtimes = await db
    .prepare(
      `SELECT st.showtime_id, st.show_date, st.start_time, st.base_price, st.screen_type,
              h.hall_name, h.hall_type, h.floor, c.name AS cinema, ci.city_name AS city,
              (SELECT COUNT(*) FROM show_seats ss WHERE ss.showtime_id = st.showtime_id AND ss.status='AVAILABLE') AS seats_left
       FROM showtimes st
       JOIN halls h ON h.hall_id = st.hall_id
       JOIN cinemas c ON c.cinema_id = h.cinema_id
       JOIN cities ci ON ci.city_id = c.city_id
       WHERE st.movie_id = ?
       ORDER BY st.show_date, st.start_time`
    )
    .all(req.params.id);

  // NOTE: the column is review_text — `comment` is a reserved word in Oracle.
  // Aliased back to `comment` so the React side keeps working unchanged.
  const reviews = await db
    .prepare(
      `SELECT r.stars, r.review_text AS "comment", r.created_at, u.username
       FROM reviews r JOIN users u ON u.user_id = r.user_id
       WHERE r.movie_id = ? ORDER BY r.created_at DESC`
    )
    .all(req.params.id);
  const avg = await db
    .prepare('SELECT AVG(stars) AS a, COUNT(*) AS n FROM reviews WHERE movie_id = ?')
    .get(req.params.id);

  res.json({
    ...(await withGenres(db, movie)),
    showtimes,
    reviews,
    avgStars: avg.a ? Math.round(avg.a * 10) / 10 : null,
    reviewCount: avg.n,
  });
});

// POST /api/movies/:id/reviews
router.post('/:id/reviews', auth, async (req, res) => {
  const { stars, comment } = req.body || {};
  if (!stars || stars < 1 || stars > 5)
    return res.status(400).json({ error: 'Stars must be 1-5' });
  const db = getDb();
  try {
    await db
.prepare(
      'INSERT INTO reviews (user_id, movie_id, stars, review_text) VALUES (?,?,?,?)'
    ).run(req.user.id, req.params.id, stars, comment || null);
  } catch {
    await db
.prepare(
      `UPDATE reviews SET stars=?, review_text=?, created_at=datetime('now') WHERE user_id=? AND movie_id=?`
    ).run(stars, comment || null, req.user.id, req.params.id);
  }
  res.json({ ok: true });
});

/* ---------------- Manager CRUD ---------------- */

// POST /api/movies  (create)
router.post('/', auth, managerOnly, async (req, res) => {
  const db = getDb();
  const b = req.body || {};
  if (!b.title) return res.status(400).json({ error: 'Title is required' });
  const info = await db
    .prepare(
      `INSERT INTO movies
       (title,title_km,tagline,overview,release_year,release_date,runtime,rating,language,production,base_price,poster_url,banner_url,trailer_url,status)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
    )
    .run(
      b.title, b.titleKm || null, b.tagline || null, b.overview || null,
      b.releaseYear || null, b.releaseDate || null, b.runtime || null,
      b.rating || null, b.language || 'English', b.production || null,
      b.basePrice || 6, b.poster || null, b.banner || null, b.trailer || null,
      b.status || 'NOW_SHOWING'
    );
  await setGenres(db, info.lastInsertRowid, b.genreIds);
  res.json({ id: info.lastInsertRowid });
});

// PUT /api/movies/:id  (update)
router.put('/:id', auth, managerOnly, async (req, res) => {
  const db = getDb();
  const b = req.body || {};
  await db
.prepare(
    `UPDATE movies SET title=?,title_km=?,tagline=?,overview=?,release_year=?,release_date=?,
     runtime=?,rating=?,language=?,production=?,base_price=?,poster_url=?,banner_url=?,trailer_url=?,status=?
     WHERE movie_id=?`
  ).run(
    b.title, b.titleKm || null, b.tagline || null, b.overview || null,
    b.releaseYear || null, b.releaseDate || null, b.runtime || null,
    b.rating || null, b.language || 'English', b.production || null,
    b.basePrice || 6, b.poster || null, b.banner || null, b.trailer || null,
    b.status || 'NOW_SHOWING', req.params.id
  );
  if (Array.isArray(b.genreIds)) await setGenres(db, req.params.id, b.genreIds);
  res.json({ ok: true });
});

// DELETE /api/movies/:id  (archive)
router.delete('/:id', auth, managerOnly, async (req, res) => {
  const db = getDb();
  await db
.prepare("UPDATE movies SET status='ARCHIVED' WHERE movie_id=?").run(req.params.id);
  res.json({ ok: true });
});

async function setGenres(db, movieId, genreIds) {
  if (!Array.isArray(genreIds)) return;
  await db
.prepare('DELETE FROM movie_genres WHERE movie_id=?').run(movieId);
  const ins = await db
    .prepare('INSERT OR IGNORE INTO movie_genres (movie_id, genre_id) VALUES (?,?)');
  for (const gid of genreIds) await ins.run(movieId, gid);
}

module.exports = router;