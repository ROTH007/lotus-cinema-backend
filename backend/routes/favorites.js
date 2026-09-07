const express = require('express');
const { getDb } = require('../db');
const { auth } = require('../config/auth');

const router = express.Router();

// GET /api/favorites  -> the customer's favorite movies (full movie cards)
router.get('/', auth, async (req, res) => {
  const db = getDb();
  const rows = await db
    .prepare(
      `SELECT m.movie_id AS id, m.title, m.title_km AS titleKm,
              m.poster_url AS poster, m.rating, m.release_year AS releaseYear
       FROM favorites f JOIN movies m ON m.movie_id = f.movie_id
       WHERE f.user_id = ?
       ORDER BY f.added_at DESC`
    )
    .all(req.user.id);
  res.json(rows);
});

// POST /api/favorites/:movieId  (add)
//
// Was `INSERT OR IGNORE` — SQLite-only syntax. Postgres throws a syntax
// error on it ("syntax error at or near OR"), which crashed this route
// with no valid HTTP response — the browser reported that as a CORS
// failure, though CORS was never actually the problem.
//
// `ON CONFLICT DO NOTHING` does the same "add it, but don't error if
// it's already there" job, and — verified — works identically on both
// SQLite and Postgres, so no per-database branching is needed here.
router.post('/:movieId', auth, async (req, res) => {
  const db = getDb();
  await db
    .prepare(
      'INSERT INTO favorites (user_id, movie_id) VALUES (?,?) ON CONFLICT DO NOTHING'
    )
    .run(req.user.id, req.params.movieId);
  res.json({ ok: true });
});

// DELETE /api/favorites/:movieId  (remove)
router.delete('/:movieId', auth, async (req, res) => {
  const db = getDb();
  await db
    .prepare('DELETE FROM favorites WHERE user_id=? AND movie_id=?')
    .run(req.user.id, req.params.movieId);
  res.json({ ok: true });
});

module.exports = router;