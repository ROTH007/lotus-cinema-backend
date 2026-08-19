const jwt = require('jsonwebtoken');

const SECRET = process.env.JWT_SECRET || 'lotus-cinema-dev-secret-change-me';

function sign(user) {
  return jwt.sign(
    { id: user.user_id, username: user.username, role: user.role },
    SECRET,
    { expiresIn: '7d' }
  );
}

function auth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Not logged in' });
  try {
    req.user = jwt.verify(token, SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Session expired, please log in again' });
  }
}

function managerOnly(req, res, next) {
  if (req.user?.role !== 'MANAGER')
    return res.status(403).json({ error: 'Manager access only' });
  next();
}

module.exports = { sign, auth, managerOnly };
