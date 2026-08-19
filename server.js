require('dotenv').config({ quiet: true });   // loads backend/.env if present

const express = require('express');
const cors = require('cors');
const path = require('path');
const { initDb, USE_ORACLE } = require('./db');

const app = express();
app.use(cors());
app.use(express.json());

// API routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/movies', require('./routes/movies'));
app.use('/api/showtimes', require('./routes/showtimes'));
app.use('/api/bookings', require('./routes/bookings'));
app.use('/api/favorites', require('./routes/favorites'));
app.use('/api/concessions', require('./routes/concessions'));
app.use('/api/acleda', require('./routes/acleda'));
app.use('/api/manager', require('./routes/manager'));

app.get('/api/health', (req, res) => res.json({ ok: true, mode: USE_ORACLE ? 'oracle' : 'sqlite-demo' }));

// Serve the built React app if present (after `npm run build` in ../frontend)
const dist = path.join(__dirname, '..', 'frontend', 'dist');
app.use(express.static(dist));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  res.sendFile(path.join(dist, 'index.html'), (err) => {
    if (err) res.status(200).send('Lotus Cinema API is running. Build the React app (npm run build in /frontend) to serve the UI here, or run the frontend dev server on :5173.');
  });
});

const PORT = process.env.PORT || 4000;

// Connect (and seed, in demo mode) BEFORE accepting requests.
initDb()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`\n🪷  Lotus Cinema API  →  http://localhost:${PORT}   [${USE_ORACLE ? 'ORACLE' : 'SQLite demo'}]`);
      console.log(`\n   Manager login:   manager@lotus.com  /  manager123`);
      console.log(`   Customer login:  sophea@mail.com    /  user123\n`);
    });
  })
  .catch((e) => {
    console.error('\n❌  Could not start:', e.message);
    if (USE_ORACLE) {
      console.error('    Check ORA_USER / ORA_PASSWORD / ORA_CONNECT, and that Oracle is running.');
      console.error('    Tip: unset USE_ORACLE to fall back to the SQLite demo.\n');
    }
    process.exit(1);
  });