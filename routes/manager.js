const express = require('express');
const { getDb } = require('../db');
const { auth, managerOnly } = require('../config/auth');

const router = express.Router();
router.use(auth, managerOnly);

/*
 * NOTE ON COLUMN NAMES
 * The Oracle adapter lower-cases every column name it returns, so the
 * React side always sees `booking_ref`, `title`, `total_price` … .
 * Earlier versions of this file used UPPERCASE aliases (AS TITLE) which
 * worked on SQLite but came back undefined on Oracle — that's what made
 * the Bookings tab render a blank screen.
 */

// GET /api/manager/dashboard
router.get('/dashboard', async (req, res) => {
  const db = getDb();

  const totals = {
    moviesShowing: (
      await db.prepare("SELECT COUNT(*) n FROM movies WHERE status='NOW_SHOWING'").get()
    ).n,
    totalBookings: (
      await db.prepare("SELECT COUNT(*) n FROM bookings WHERE status='CONFIRMED'").get()
    ).n,
    totalCustomers: (
      await db.prepare("SELECT COUNT(*) n FROM users WHERE role='CUSTOMER'").get()
    ).n,
    totalRevenue: (
      await db
        .prepare("SELECT COALESCE(SUM(total_price),0) s FROM bookings WHERE status='CONFIRMED'")
        .get()
    ).s,
  };

  const byMovie = await db
    .prepare(
      `SELECT m.title,
              COUNT(bs.booking_seat_id) AS seats_sold,
              COALESCE(SUM(ss.price),0) AS revenue
       FROM movies m
       JOIN showtimes st     ON st.movie_id     = m.movie_id
       JOIN show_seats ss    ON ss.showtime_id  = st.showtime_id
       JOIN booking_seats bs ON bs.show_seat_id = ss.show_seat_id
       JOIN bookings b       ON b.booking_id    = bs.booking_id AND b.status='CONFIRMED'
       GROUP BY m.movie_id, m.title
       ORDER BY revenue DESC`
    )
    .all();

  const byDay = await db
    .prepare(
      `SELECT substr(created_at,1,10) AS day,
              COUNT(*) AS bookings,
              SUM(total_price) AS revenue
       FROM bookings WHERE status='CONFIRMED'
       GROUP BY substr(created_at,1,10)
       ORDER BY day`
    )
    .all();

  res.json({ totals, byMovie, byDay });
});

// GET /api/manager/bookings  (all bookings)
router.get('/bookings', async (req, res) => {
  const db = getDb();
  const rows = await db
    .prepare(
      `SELECT b.booking_id, b.booking_ref, u.username, m.title,
              st.show_date, st.start_time, st.screen_type,
              h.hall_name, h.floor,
              b.subtotal, b.discount, b.total_price, b.status, b.created_at,
              p.method,
              (SELECT COUNT(*) FROM booking_seats bs WHERE bs.booking_id = b.booking_id) AS seats,
              (SELECT COALESCE(SUM(bc.quantity),0) FROM booking_concessions bc
                WHERE bc.booking_id = b.booking_id) AS food_items
       FROM bookings b
       JOIN users u      ON u.user_id      = b.user_id
       JOIN showtimes st ON st.showtime_id = b.showtime_id
       JOIN movies m     ON m.movie_id     = st.movie_id
       JOIN halls h      ON h.hall_id      = st.hall_id
       LEFT JOIN payments p ON p.booking_id = b.booking_id
       ORDER BY b.created_at DESC`
    )
    .all();
  res.json(rows);
});

// GET /api/manager/occupancy  — seats sold per screening
router.get('/occupancy', async (req, res) => {
  const db = getDb();
  const raw = await db
    .prepare(
      `SELECT st.showtime_id, m.title, st.show_date, st.start_time, st.screen_type,
              h.hall_name, h.floor,
              COUNT(ss.show_seat_id) AS total,
              SUM(CASE WHEN ss.status='BOOKED' THEN 1 ELSE 0 END) AS sold,
              COALESCE(SUM(CASE WHEN ss.status='BOOKED' THEN ss.price ELSE 0 END),0) AS revenue
       FROM showtimes st
       JOIN movies m      ON m.movie_id     = st.movie_id
       JOIN halls h       ON h.hall_id      = st.hall_id
       JOIN show_seats ss ON ss.showtime_id = st.showtime_id
       GROUP BY st.showtime_id, m.title, st.show_date, st.start_time,
                st.screen_type, h.hall_name, h.floor
       ORDER BY st.show_date DESC, st.start_time`
    )
    .all();
  const rows = raw.map((r) => ({
    ...r,
    occupancy: r.total ? Math.round((r.sold / r.total) * 100) : 0,
  }));
  res.json(rows);
});

/* ============================================================
 *  REPORTS — seats per room, seat types, screens, food, customers
 * ========================================================== */
router.get('/reports', async (req, res) => {
  const db = getDb();

  const byHall = await db
    .prepare(
      `SELECT h.hall_id, h.hall_name, h.floor, h.hall_type, h.capacity,
              c.name AS cinema,
              COUNT(DISTINCT st.showtime_id) AS showtimes,
              COALESCE(SUM(CASE WHEN ss.status='BOOKED' THEN 1 ELSE 0 END),0) AS seats_sold,
              COUNT(ss.show_seat_id) AS seats_offered,
              COALESCE(SUM(CASE WHEN ss.status='BOOKED' THEN ss.price ELSE 0 END),0) AS revenue
       FROM halls h
       JOIN cinemas c          ON c.cinema_id   = h.cinema_id
       LEFT JOIN showtimes st  ON st.hall_id    = h.hall_id
       LEFT JOIN show_seats ss ON ss.showtime_id = st.showtime_id
       GROUP BY h.hall_id, h.hall_name, h.floor, h.hall_type, h.capacity, c.name
       ORDER BY h.floor, h.hall_name`
    )
    .all();

  const bySeatType = await db
    .prepare(
      `SELECT s.seat_type,
              COUNT(ss.show_seat_id) AS offered,
              SUM(CASE WHEN ss.status='BOOKED' THEN 1 ELSE 0 END) AS sold,
              COALESCE(SUM(CASE WHEN ss.status='BOOKED' THEN ss.price ELSE 0 END),0) AS revenue
       FROM show_seats ss
       JOIN seats s ON s.seat_id = ss.seat_id
       GROUP BY s.seat_type`
    )
    .all();

  const byScreen = await db
    .prepare(
      `SELECT st.screen_type,
              COUNT(DISTINCT st.showtime_id) AS showtimes,
              SUM(CASE WHEN ss.status='BOOKED' THEN 1 ELSE 0 END) AS sold,
              COALESCE(SUM(CASE WHEN ss.status='BOOKED' THEN ss.price ELSE 0 END),0) AS revenue
       FROM showtimes st
       JOIN show_seats ss ON ss.showtime_id = st.showtime_id
       GROUP BY st.screen_type
       ORDER BY revenue DESC`
    )
    .all();

  const food = await db
    .prepare(
      `SELECT c.item_id, c.name, c.name_km, c.category, c.item_size,
              c.price, c.available,
              COALESCE(SUM(bc.quantity),0) AS units_sold,
              COALESCE(SUM(bc.quantity * bc.unit_price),0) AS revenue
       FROM concessions c
       LEFT JOIN booking_concessions bc ON bc.item_id = c.item_id
       LEFT JOIN bookings b ON b.booking_id = bc.booking_id AND b.status='CONFIRMED'
       GROUP BY c.item_id, c.name, c.name_km, c.category, c.item_size, c.price, c.available
       ORDER BY revenue DESC`
    )
    .all();

  const ticketRev = (
    await db
      .prepare(
        `SELECT COALESCE(SUM(ss.price),0) AS s
         FROM booking_seats bs
         JOIN show_seats ss ON ss.show_seat_id = bs.show_seat_id
         JOIN bookings b    ON b.booking_id    = bs.booking_id AND b.status='CONFIRMED'`
      )
      .get()
  ).s;

  const foodRev = (
    await db
      .prepare(
        `SELECT COALESCE(SUM(bc.quantity * bc.unit_price),0) AS s
         FROM booking_concessions bc
         JOIN bookings b ON b.booking_id = bc.booking_id AND b.status='CONFIRMED'`
      )
      .get()
  ).s;

  const topCustomers = await db
    .prepare(
      `SELECT u.username, u.email,
              COUNT(b.booking_id) AS bookings,
              COALESCE(SUM(b.total_price),0) AS spent
       FROM users u
       JOIN bookings b ON b.user_id = u.user_id AND b.status='CONFIRMED'
       GROUP BY u.user_id, u.username, u.email
       ORDER BY spent DESC`
    )
    .all();

  res.json({
    byHall,
    bySeatType,
    byScreen,
    food,
    split: { ticketRevenue: ticketRev, foodRevenue: foodRev },
    topCustomers,
  });
});

module.exports = router;