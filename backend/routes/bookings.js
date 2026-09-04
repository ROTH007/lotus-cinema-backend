const express = require('express');
const { getDb } = require('../db');
const { auth } = require('../config/auth');
const { buildKHQR } = require('../khqr');

const router = express.Router();

const rand = (p) => p + Math.random().toString(36).slice(2, 10).toUpperCase();

// POST /api/bookings  { showtimeId, showSeatIds[], couponCode?, paymentMethod }
router.post('/', auth, async (req, res) => {
  const { showtimeId, showSeatIds, couponCode, paymentMethod, food } = req.body || {};
  if (!showtimeId || !Array.isArray(showSeatIds) || !showSeatIds.length)
    return res.status(400).json({ error: 'Pick at least one seat' });
  if (showSeatIds.length > 10)
    return res.status(400).json({ error: 'Max 10 seats per booking' });

  const db = getDb();

  try {
    const result = await db.transaction(async () => {
      // lock check: all seats must still be AVAILABLE for this showtime
      const placeholders = showSeatIds.map(() => '?').join(',');
      const seats = await db
    .prepare(
          `SELECT ss.show_seat_id, ss.status, ss.price
           FROM show_seats ss
           WHERE ss.showtime_id = ? AND ss.show_seat_id IN (${placeholders})`
        )
        .all(showtimeId, ...showSeatIds);

      if (seats.length !== showSeatIds.length)
        throw { code: 400, msg: 'Some seats are invalid for this showtime' };
      const taken = seats.find((s) => s.status !== 'AVAILABLE');
      if (taken) throw { code: 409, msg: 'Sorry, a seat was just taken. Please pick again.' };

      const seatTotal = seats.reduce((a, s) => a + s.price, 0);

      // Food: always price from the DB. Never trust a price sent by the client.
      let foodTotal = 0;
      let foodLines = [];
      if (Array.isArray(food) && food.length) {
        if (food.length > 20) throw { code: 400, msg: 'Too many items' };
        for (const line of food) {
          const qty = parseInt(line.quantity, 10);
          if (!qty || qty < 1 || qty > 20)
            throw { code: 400, msg: 'Invalid quantity for a menu item' };
          const item = await db
            .prepare('SELECT item_id, price, available FROM concessions WHERE item_id = ?')
            .get(line.itemId);
          if (!item) throw { code: 400, msg: 'Menu item not found' };
          if (!item.available) throw { code: 400, msg: 'A menu item is no longer available' };
          foodTotal += item.price * qty;
          foodLines.push({ itemId: item.item_id, qty, unitPrice: item.price });
        }
      }

      const subtotal = Math.round((seatTotal + foodTotal) * 100) / 100;

      // coupon
      let discount = 0;
      let couponId = null;
      if (couponCode) {
        const c = await db
    .prepare('SELECT * FROM coupons WHERE code = ? AND active = 1')
          .get(couponCode.toUpperCase());
        if (c) {
          couponId = c.coupon_id;
          discount = Math.round(subtotal * (c.discount_pct / 100) * 100) / 100;
        }
      }
      const total = Math.round((subtotal - discount) * 100) / 100;

      // booking
      const ref = rand('LC');
      const bInfo = await db
    .prepare(
          `INSERT INTO bookings (booking_ref,user_id,showtime_id,coupon_id,subtotal,discount,total_price,status)
           VALUES (?,?,?,?,?,?,?,'CONFIRMED')`
        )
        .run(ref, req.user.id, showtimeId, couponId, subtotal, discount, total);
      const bookingId = bInfo.lastInsertRowid;

      // seats -> BOOKED, booking_seats, tickets
      const markSeat = await db
    .prepare("UPDATE show_seats SET status='BOOKED' WHERE show_seat_id=?");
      const insBS = await db
    .prepare(
        'INSERT INTO booking_seats (booking_id, show_seat_id) VALUES (?,?)'
      );
      const insTk = await db
    .prepare(
        'INSERT INTO tickets (booking_id, booking_seat_id, qr_code) VALUES (?,?,?)'
      );
      for (const ssId of showSeatIds) {
        await markSeat.run(ssId);
        const bs = await insBS.run(bookingId, ssId);
        await insTk.run(bookingId, bs.lastInsertRowid, rand('TK'));
      }

      // food lines (priced from the DB above, not from the client)
      if (foodLines.length) {
        const insFood = db.prepare(
          'INSERT INTO booking_concessions (booking_id, item_id, quantity, unit_price) VALUES (?,?,?,?)'
        );
        for (const f of foodLines) {
          await insFood.run(bookingId, f.itemId, f.qty, f.unitPrice);
        }
      }

      // KHQR payment string with the real amount (USD)
      const khqrString = buildKHQR({
        amount: total,
        currency: 'USD',
        merchant: 'LOTUS CINEMA',
        city: 'PHNOM PENH',
        billNumber: ref,
      });

      // payment
      await db
        .prepare(
          'INSERT INTO payments (booking_id, method, txn_ref, amount, khqr_string, payment_status) VALUES (?,?,?,?,?,?)'
        )
        .run(
          bookingId,
          (paymentMethod || 'KHQR').toUpperCase(),
          rand('TXN'),
          total,
          khqrString,
          'PAID'
        );

      return { bookingId, bookingRef: ref, seatTotal, foodTotal, subtotal, discount, total, khqrString };
    })();

    res.json(result);
  } catch (e) {
    if (e && e.code) return res.status(e.code).json({ error: e.msg });
    console.error(e);
    res.status(500).json({ error: 'Booking failed, please try again' });
  }
});

// GET /api/bookings/mine
router.get('/mine', auth, async (req, res) => {
  const db = getDb();
  const rows = await db
    .prepare(
      `SELECT b.booking_id, b.booking_ref, b.total_price, b.status, b.created_at,
              m.title, m.poster_url, st.show_date, st.start_time,
              h.hall_name, c.name AS cinema
       FROM bookings b
       JOIN showtimes st ON st.showtime_id = b.showtime_id
       JOIN movies m ON m.movie_id = st.movie_id
       JOIN halls h ON h.hall_id = st.hall_id
       JOIN cinemas c ON c.cinema_id = h.cinema_id
       WHERE b.user_id = ?
       ORDER BY b.created_at DESC`
    )
    .all(req.user.id);
  res.json(rows);
});

// GET /api/bookings/:id  (full ticket)
router.get('/:id', auth, async (req, res) => {
  const db = getDb();
  const b = await db
    .prepare(
      `SELECT b.*, m.title, m.title_km, m.poster_url, m.rating, m.runtime,
              st.show_date, st.start_time, h.hall_name, h.hall_type,
              c.name AS cinema, ci.city_name AS city,
              p.method, p.txn_ref, p.khqr_string, p.payment_status
       FROM bookings b
       JOIN showtimes st ON st.showtime_id = b.showtime_id
       JOIN movies m ON m.movie_id = st.movie_id
       JOIN halls h ON h.hall_id = st.hall_id
       JOIN cinemas c ON c.cinema_id = h.cinema_id
       JOIN cities ci ON ci.city_id = c.city_id
       LEFT JOIN payments p ON p.booking_id = b.booking_id
       WHERE b.booking_id = ? AND b.user_id = ?`
    )
    .get(req.params.id, req.user.id);
  if (!b) return res.status(404).json({ error: 'Booking not found' });

  const seats = await db
    .prepare(
      `SELECT s.seat_row, s.seat_col, s.seat_type, t.qr_code
       FROM booking_seats bs
       JOIN show_seats ss ON ss.show_seat_id = bs.show_seat_id
       JOIN seats s ON s.seat_id = ss.seat_id
       JOIN tickets t ON t.booking_seat_id = bs.booking_seat_id
       WHERE bs.booking_id = ?
       ORDER BY s.seat_row, s.seat_col`
    )
    .all(req.params.id);

  const food = await db
    .prepare(
      `SELECT c.name, c.name_km, c.item_size AS "size", bc.quantity, bc.unit_price
       FROM booking_concessions bc
       JOIN concessions c ON c.item_id = bc.item_id
       WHERE bc.booking_id = ?`
    )
    .all(req.params.id);

  res.json({ ...b, seats, food });
});

// POST /api/bookings/:id/cancel
router.post('/:id/cancel', auth, async (req, res) => {
  const db = getDb();
  const b = await db
    .prepare('SELECT * FROM bookings WHERE booking_id=? AND user_id=?')
    .get(req.params.id, req.user.id);
  if (!b) return res.status(404).json({ error: 'Booking not found' });
  if (b.status === 'CANCELLED') return res.json({ ok: true });

  await db.transaction(async () => {
    await db
      .prepare("UPDATE bookings SET status='CANCELLED' WHERE booking_id=?")
      .run(b.booking_id);
    // free the seats
    await db
      .prepare(
        `UPDATE show_seats SET status='AVAILABLE'
         WHERE show_seat_id IN (SELECT show_seat_id FROM booking_seats WHERE booking_id=?)`
      )
      .run(b.booking_id);
  })();
  res.json({ ok: true });
});

module.exports = router;