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
router.post('/:movieId', auth, async (req, res) => {
  const db = getDb();
  await db
.prepare('INSERT OR IGNORE INTO favorites (user_id, movie_id) VALUES (?,?)').run(
    req.user.id,
    req.params.movieId
  );
  res.json({ ok: true });
});

// DELETE /api/favorites/:movieId  (remove)
router.delete('/:movieId', auth, async (req, res) => {
  const db = getDb();
  await db
.prepare('DELETE FROM favorites WHERE user_id=? AND movie_id=?').run(
    req.user.id,
    req.params.movieId
  );
  res.json({ ok: true });
});

module.exports = router;
