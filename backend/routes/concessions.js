const express = require('express');
const { getDb } = require('../db');
const { auth, managerOnly } = require('../config/auth');

const router = express.Router();

// NOTE: the column is item_size — `size` is a reserved word in Oracle.
// The API still exposes it as `size` so the React side is unchanged.
const map = (r) => ({
  id: r.item_id,
  name: r.name,
  nameKm: r.name_km,
  category: r.category,
  size: r.item_size,
  price: r.price,
  image: r.image_url,
  description: r.description,
  available: !!r.available,
});

// GET /api/concessions           -> the menu (available items only)
// GET /api/concessions?all=1     -> everything (manager view)
router.get('/', async (req, res) => {
  const db = getDb();
  const sql = req.query.all
    ? 'SELECT * FROM concessions ORDER BY category, price'
    : 'SELECT * FROM concessions WHERE available = 1 ORDER BY category, price';
  const rows = await db.prepare(sql).all();
  res.json(rows.map(map));
});

/* ---------------- Manager ---------------- */

// POST /api/concessions
router.post('/', auth, managerOnly, async (req, res) => {
  const b = req.body || {};
  if (!b.name || !b.category || b.price == null)
    return res.status(400).json({ error: 'name, category and price are required' });
  const db = getDb();
  const info = await db
    .prepare(
      `INSERT INTO concessions (name,name_km,category,item_size,price,image_url,description,available)
       VALUES (?,?,?,?,?,?,?,?)`
    )
    .run(
      b.name,
      b.nameKm || null,
      b.category,
      b.size || null,
      b.price,
      b.image || null,
      b.description || null,
      b.available === false ? 0 : 1
    );
  res.json({ id: info.lastInsertRowid });
});

// PUT /api/concessions/:id
router.put('/:id', auth, managerOnly, async (req, res) => {
  const b = req.body || {};
  const db = getDb();
  await db
    .prepare(
      `UPDATE concessions SET name=?, name_km=?, category=?, item_size=?, price=?,
       image_url=?, description=?, available=? WHERE item_id=?`
    )
    .run(
      b.name,
      b.nameKm || null,
      b.category,
      b.size || null,
      b.price,
      b.image || null,
      b.description || null,
      b.available === false ? 0 : 1,
      req.params.id
    );
  res.json({ ok: true });
});

// DELETE /api/concessions/:id  -> mark unavailable (keeps order history intact)
router.delete('/:id', auth, managerOnly, async (req, res) => {
  const db = getDb();
  await db.prepare('UPDATE concessions SET available=0 WHERE item_id=?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
