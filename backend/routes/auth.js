const express = require('express');
const bcrypt = require('bcryptjs');
const { getDb } = require('../db');
const { sign, auth } = require('../config/auth');

const router = express.Router();

// POST /api/auth/register  (always creates a CUSTOMER)
router.post('/register', async (req, res) => {
  const { username, email, password, fullName, phone } = req.body || {};
  if (!username || !email || !password)
    return res.status(400).json({ error: 'Username, email and password are required' });
  const db = getDb();
  const exists = await db
    .prepare('SELECT 1 FROM users WHERE email = ? OR username = ?')
    .get(email, username);
  if (exists) return res.status(409).json({ error: 'Email or username already in use' });

  const info = await db
    .prepare(
      'INSERT INTO users (username,email,password_hash,role,full_name,phone) VALUES (?,?,?,?,?,?)'
    )
    .run(username, email, bcrypt.hashSync(password, 10), 'CUSTOMER', fullName || null, phone || null);

  const user = await db
    .prepare('SELECT * FROM users WHERE user_id = ?').get(info.lastInsertRowid);
  res.json({ token: sign(user), user: publicUser(user) });
});

// POST /api/auth/login  (works for both manager and customer)
router.post('/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password)
    return res.status(400).json({ error: 'Email and password are required' });
  const db = getDb();
  // allow login by email OR username
  const user = await db
    .prepare('SELECT * FROM users WHERE email = ? OR username = ?')
    .get(email, email);
  if (!user || !bcrypt.compareSync(password, user.password_hash))
    return res.status(401).json({ error: 'Wrong email or password' });
  res.json({ token: sign(user), user: publicUser(user) });
});

// GET /api/auth/me
router.get('/me', auth, async (req, res) => {
  const db = getDb();
  const user = await db
    .prepare('SELECT * FROM users WHERE user_id = ?').get(req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json(publicUser(user));
});

function publicUser(u) {
  return {
    id: u.user_id,
    username: u.username,
    email: u.email,
    role: u.role,
    fullName: u.full_name,
  };
}

module.exports = router;
