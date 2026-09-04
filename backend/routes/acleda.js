const express = require('express');
const { getDb } = require('../db');
const { auth } = require('../config/auth');
const acleda = require('../acleda');

const router = express.Router();

// GET /api/acleda/status  -> is live mode configured?
router.get('/status', (req, res) => {
  res.json({
    enabled: acleda.enabled(),
    rate: Number(process.env.USD_TO_KHR || 4100),
  });
});

// POST /api/acleda/pay/:bookingId
// Opens a real ACLEDA sandbox session and returns the form the
// browser must POST to, to reach ACLEDA's KHQR page.
router.post('/pay/:bookingId', auth, async (req, res) => {
  if (!acleda.enabled())
    return res.status(400).json({ error: 'ACLEDA live mode is not enabled on the server.' });

  const db = getDb();
  const b = await db
    .prepare(
      `SELECT b.booking_id, b.booking_ref, b.total_price, m.title
       FROM bookings b
       JOIN showtimes st ON st.showtime_id = b.showtime_id
       JOIN movies m ON m.movie_id = st.movie_id
       WHERE b.booking_id = ? AND b.user_id = ?`
    )
    .get(req.params.bookingId, req.user.id);
  if (!b) return res.status(404).json({ error: 'Booking not found' });

  try {
    const pay = await acleda.createPayment({
      amountUsd: Number(b.total_price),
      description: `Lotus Cinema - ${b.title}`.slice(0, 40),
      invoiceId: b.booking_ref,
    });

    // remember the txid so we can poll it later
    await db
      .prepare("UPDATE payments SET txn_ref = ?, payment_status = 'PENDING' WHERE booking_id = ?")
      .run(pay.txid, b.booking_id);

    res.json({
      bookingRef: b.booking_ref,
      amountUsd: Number(b.total_price),
      ...pay,
    });
  } catch (e) {
    console.error('ACLEDA error:', e.message);
    res.status(502).json({ error: e.message });
  }
});

// GET /api/acleda/check/:bookingId  -> poll ACLEDA for payment status
router.get('/check/:bookingId', auth, async (req, res) => {
  if (!acleda.enabled()) return res.status(400).json({ error: 'ACLEDA live mode is off.' });

  const db = getDb();
  const p = await db
    .prepare(
      `SELECT p.txn_ref, p.payment_status, b.booking_id
       FROM payments p JOIN bookings b ON b.booking_id = p.booking_id
       WHERE p.booking_id = ? AND b.user_id = ?`
    )
    .get(req.params.bookingId, req.user.id);
  if (!p) return res.status(404).json({ error: 'Payment not found' });

  try {
    const st = await acleda.getStatus(p.txn_ref);
    if (st.paid && p.payment_status !== 'PAID') {
      await db
        .prepare("UPDATE payments SET payment_status = 'PAID' WHERE booking_id = ?")
        .run(p.booking_id);
      await db
        .prepare("UPDATE bookings SET status = 'CONFIRMED' WHERE booking_id = ?")
        .run(p.booking_id);
    }
    res.json({ paid: st.paid, status: st.status, txid: p.txn_ref });
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
});

module.exports = router;