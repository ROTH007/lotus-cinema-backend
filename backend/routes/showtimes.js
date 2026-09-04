const express = require('express');
const { getDb, createShowtime } = require('../db');
const { auth, managerOnly } = require('../config/auth');

const router = express.Router();

// GET /api/showtimes/:id/seats  -> full seat map for a showtime
router.get('/:id/seats', async (req, res) => {
  const db = getDb();
  const showtime = await db
    .prepare(
      `SELECT st.*, m.title, m.title_km, h.hall_name, h.hall_type, h.floor, h.capacity,
              c.name AS cinema, ci.city_name AS city
       FROM showtimes st
       JOIN movies m ON m.movie_id = st.movie_id
       JOIN halls h ON h.hall_id = st.hall_id
       JOIN cinemas c ON c.cinema_id = h.cinema_id
       JOIN cities ci ON ci.city_id = c.city_id
       WHERE st.showtime_id = ?`
    )
    .get(req.params.id);
  if (!showtime) return res.status(404).json({ error: 'Showtime not found' });

  const seats = await db
    .prepare(
      `SELECT ss.show_seat_id, ss.status, ss.price,
              s.seat_row, s.seat_col, s.seat_type
       FROM show_seats ss JOIN seats s ON s.seat_id = ss.seat_id
       WHERE ss.showtime_id = ?
       ORDER BY s.seat_row, s.seat_col`
    )
    .all(req.params.id);

  res.json({ showtime, seats });
});

// GET /api/showtimes/meta/halls  (for manager showtime form)
router.get('/meta/halls', auth, managerOnly, async (req, res) => {
  const db = getDb();
  const rows = await db
    .prepare(
      `SELECT h.hall_id, h.hall_name, h.hall_type, h.floor, h.capacity, c.name AS cinema
       FROM halls h JOIN cinemas c ON c.cinema_id = h.cinema_id
       ORDER BY h.floor, c.name, h.hall_name`
    )
    .all();
  res.json(rows);
});

// GET /api/showtimes/by-date/:date   -> movies playing on a given day (YYYY-MM-DD)
// Public: powers the "Now Showing" date strip on the homepage.
router.get('/by-date/:date', async (req, res) => {
  const db = getDb();
  const rows = await db
    .prepare(
      // Aliases are lower_snake_case on purpose: the Oracle adapter
      // lower-cases every returned column, so mixed-case aliases like
      // "titleKm" would arrive as "titlekm" and silently be undefined.
      // ARCHIVED films are excluded, but COMING_SOON ones still show —
      // if a manager scheduled it, customers should be able to see it.
      `SELECT m.movie_id AS id, m.title, m.title_km, m.poster_url,
              m.rating, m.runtime, m.release_year, m.status,
              COUNT(st.showtime_id) AS show_count,
              MIN(st.base_price) AS from_price
       FROM movies m
       JOIN showtimes st ON st.movie_id = m.movie_id
       WHERE st.show_date = ? AND m.status <> 'ARCHIVED'
       GROUP BY m.movie_id, m.title, m.title_km, m.poster_url, m.rating,
                m.runtime, m.release_year, m.status
       ORDER BY m.title`
    )
    .all(req.params.date);

  res.json(
    rows.map((r) => ({
      id: r.id,
      title: r.title,
      titleKm: r.title_km,
      poster: r.poster_url,
      rating: r.rating,
      runtime: r.runtime,
      releaseYear: r.release_year,
      status: r.status,
      showCount: r.show_count,
      fromPrice: r.from_price,
    }))
  );
});

// GET /api/showtimes/calendar/:from/:to  -> showtimes grouped for the manager calendar
router.get('/calendar/:from/:to', auth, managerOnly, async (req, res) => {
  const db = getDb();
  const rows = await db
    .prepare(
      `SELECT st.showtime_id, st.show_date, st.start_time, st.base_price, st.screen_type,
              m.movie_id, m.title, m.status,
              h.hall_id, h.hall_name, h.floor, h.capacity,
              (SELECT COUNT(*) FROM show_seats ss
                WHERE ss.showtime_id = st.showtime_id AND ss.status='BOOKED') AS sold
       FROM showtimes st
       JOIN movies m ON m.movie_id = st.movie_id
       JOIN halls  h ON h.hall_id  = st.hall_id
       WHERE st.show_date >= ? AND st.show_date <= ?
       ORDER BY st.show_date, st.start_time`
    )
    .all(req.params.from, req.params.to);
  res.json(rows);
});

// GET /api/showtimes  -> all showtimes (manager list, newest first)
router.get('/', auth, managerOnly, async (req, res) => {
  const db = getDb();
  const rows = await db
    .prepare(
      `SELECT st.showtime_id, st.show_date, st.start_time, st.base_price, st.screen_type,
              m.title, m.movie_id,
              h.hall_name, h.floor, h.capacity,
              c.name AS cinema,
              (SELECT COUNT(*) FROM show_seats ss
                WHERE ss.showtime_id = st.showtime_id AND ss.status = 'BOOKED') AS sold
       FROM showtimes st
       JOIN movies m ON m.movie_id = st.movie_id
       JOIN halls h ON h.hall_id = st.hall_id
       JOIN cinemas c ON c.cinema_id = h.cinema_id
       ORDER BY st.show_date DESC, st.start_time`
    )
    .all();
  res.json(rows);
});

// DELETE /api/showtimes/:id  -> remove a showtime (only if nothing sold)
router.delete('/:id', auth, managerOnly, async (req, res) => {
  const db = getDb();
  const sold = await db
    .prepare(
      `SELECT COUNT(*) AS n FROM show_seats
       WHERE showtime_id = ? AND status = 'BOOKED'`
    )
    .get(req.params.id);
  if (sold.n > 0)
    return res
      .status(409)
      .json({ error: `Cannot delete — ${sold.n} seat(s) already booked. Cancel those bookings first.` });

  await db.prepare('DELETE FROM show_seats WHERE showtime_id = ?').run(req.params.id);
  await db.prepare('DELETE FROM showtimes WHERE showtime_id = ?').run(req.params.id);
  res.json({ ok: true });
});

// PUT /api/showtimes/:id  -> edit time / price / screen type (not the hall)
router.put('/:id', auth, managerOnly, async (req, res) => {
  const { date, time, basePrice, screenType } = req.body || {};
  const db = getDb();
  await db
    .prepare(
      `UPDATE showtimes SET show_date = ?, start_time = ?, base_price = ?, screen_type = ?
       WHERE showtime_id = ?`
    )
    .run(date, time, Number(basePrice) || 6, screenType || '2D', req.params.id);
  res.json({ ok: true });
});

// POST /api/showtimes  (manager creates a showtime + seat map)
router.post('/', auth, managerOnly, async (req, res) => {
  const { movieId, hallId, date, time, basePrice, screenType } = req.body || {};
  if (!movieId || !hallId || !date || !time)
    return res.status(400).json({ error: 'movieId, hallId, date and time are required' });
  const id = await createShowtime(movieId, hallId, date, time, Number(basePrice) || 6, screenType || '2D');
  res.json({ showtimeId: id });
});

module.exports = router;