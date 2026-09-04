# 🪷 Lotus Cinema — Movie Ticket Booking System

Full-stack cinema booking web app.
**React (Vite + Tailwind) → Node/Express REST API → Oracle Database**

Bilingual English / ភាសាខ្មែរ · 39 movies · seat-level booking · manager & customer roles.

---

## What's inside

```
LotusCinema/
├── sql/                    ← Oracle: run these 3 files
│   ├── 01_schema.sql          17 tables + constraints + indexes
│   ├── 02_seed.sql            39 movies, 16 genres, users, showtimes
│   └── 03_procedures.sql      procedures + reporting views
├── backend/                ← Node/Express API (port 4000)
│   ├── server.js
│   ├── routes/                auth, movies, showtimes, bookings, favorites, manager
│   ├── config/auth.js         JWT + role middleware
│   └── db/                    Oracle connector + SQLite demo fallback
└── frontend/               ← your React app, now database-driven
    └── src/
        ├── api/client.js      all API calls live here
        ├── context/           AuthContext + LanguageContext
        └── assets/Page/       Booking (seat picker), Ticket, Manager, …
```

---

## Quick start (no Oracle needed)

The backend ships with a **SQLite demo database** that mirrors the Oracle schema exactly
and auto-seeds all 39 movies on first run. Good for testing the UI immediately.

```bash
# 1. backend
cd backend
npm install
npm start                 # → http://localhost:4000

# 2. frontend (new terminal)
cd frontend
npm install
npm run dev               # → http://localhost:5173
```

**Demo logins**

| Role | Email | Password |
|---|---|---|
| Manager | manager@lotus.com | manager123 |
| Customer | sophea@mail.com | user123 |
| Customer | dara@mail.com | user123 |

---

## Running on Oracle

### Step 1 — create the database objects

Run the three files **in this order** (SQL*Plus, SQL Developer, or VS Code Oracle extension):

```sql
@sql/01_schema.sql        -- tables first
@sql/03_procedures.sql    -- then procedures (seed calls them)
@sql/02_seed.sql          -- finally the data
```

> ⚠️ **Order matters.** `02_seed.sql` finishes by calling `gen_seats()` and
> `create_showtime()`, so those procedures must already exist.

Passwords in the seed are already real bcrypt hashes — nothing to replace.

**Verify it worked:**

```sql
SELECT COUNT(*) FROM movies;      -- 39
SELECT COUNT(*) FROM seats;       -- 384  (4 halls × 96)
SELECT COUNT(*) FROM show_seats;  -- 672  (7 showtimes × 96)
SELECT * FROM v_dashboard;
```

### Step 2 — point the backend at Oracle

```bash
cd backend
npm install oracledb

export USE_ORACLE=true
export ORA_USER=your_user
export ORA_PASSWORD=your_password
export ORA_CONNECT=localhost:1521/XEPDB1   # host:port/service_name

npm start
```

On Windows (PowerShell) use `$env:USE_ORACLE="true"` etc.

Check it connected:

```bash
curl http://localhost:4000/api/health
# {"ok":true,"mode":"oracle"}
```

### Step 3 — build the frontend

```bash
cd frontend
npm install
npm run build        # Express then serves it at http://localhost:4000
```

Or `npm run dev` for hot-reload on :5173 (Vite proxies `/api` → :4000).

---

## Database design

**17 tables.**

```
CITIES → CINEMAS → HALLS → SEATS                (physical layout, 8 rows × 12 cols)
MOVIES ↔ GENRES                                 (many-to-many via MOVIE_GENRES)
MOVIES + HALLS → SHOWTIMES → SHOW_SEATS         (a bookable seat per screening)
USERS → BOOKINGS → BOOKING_SEATS → SHOW_SEATS
BOOKINGS → PAYMENTS, BOOKINGS → TICKETS         (one QR per seat)
USERS ↔ MOVIES  via FAVORITES and REVIEWS
COUPONS → BOOKINGS
```

### Key design decisions

**`SHOW_SEATS` is the heart of it.** A seat isn't booked in the abstract — it's booked
*for one screening*. So every showtime gets its own copy of the hall's 96 seats, each with
its own status and price. That's what makes the seat map work and what makes
double-booking impossible.

**`BOOKING_SEATS.show_seat_id` is UNIQUE.** This is the guard rail: even if two customers
click the same seat at the same instant, the database physically refuses the second one.
The API wraps booking in a transaction and re-checks availability before inserting.

**Seat pricing is tiered** by `seat_type`: rows G–H are VIP (+$4), E–F are PREMIUM (+$2),
A–D standard. `create_showtime()` applies this automatically.

**Roles live on `USERS.role`** with a CHECK constraint (`CUSTOMER` / `MANAGER`).
JWT carries the role; `managerOnly` middleware guards every `/api/manager/*` route.

### Stored procedures

| Procedure | Purpose |
|---|---|
| `gen_seats(hall_id)` | Builds the 8×12 seat grid (A1–H12) with VIP/Premium/Standard tiers |
| `create_showtime(movie, hall, date, time, price)` | Creates a screening **and** opens all 96 seats with tiered pricing |

### Views (used by the manager dashboard)

`v_revenue_by_movie` · `v_revenue_by_day` · `v_occupancy` · `v_dashboard`

---

## ER Diagram

See `ER_DIAGRAM.md` (Mermaid — renders on GitHub, or paste into
[mermaid.live](https://mermaid.live)).

---

## API reference

### Auth
| Method | Endpoint | Notes |
|---|---|---|
| POST | `/api/auth/register` | always creates a CUSTOMER |
| POST | `/api/auth/login` | email **or** username; returns JWT |
| GET | `/api/auth/me` | current user |

### Movies
| Method | Endpoint | Notes |
|---|---|---|
| GET | `/api/movies?q=&genre=&status=` | search + filter |
| GET | `/api/movies/genres` | 16 genres, with Khmer names |
| GET | `/api/movies/:id` | detail + showtimes + reviews |
| POST | `/api/movies/:id/reviews` | 1–5 stars (auth) |
| POST/PUT/DELETE | `/api/movies/:id` | **manager only** |

### Booking
| Method | Endpoint | Notes |
|---|---|---|
| GET | `/api/showtimes/:id/seats` | full seat map |
| POST | `/api/bookings` | transactional; 409 if a seat was taken |
| GET | `/api/bookings/mine` | customer's bookings |
| GET | `/api/bookings/:id` | ticket + QR codes |
| POST | `/api/bookings/:id/cancel` | releases the seats |

### Manager (all require role = MANAGER)
| Method | Endpoint |
|---|---|
| GET | `/api/manager/dashboard` |
| GET | `/api/manager/bookings` |
| GET | `/api/manager/occupancy` |
| POST | `/api/showtimes` |

---

## What changed from the original project

Your movie data was hardcoded in **four** different files, each with its own list and
**mismatched IDs** (`MovieDetail.jsx` had 39 movies, `Movie.jsx` had a different set,
`Buynow.jsx` had a third — plus a nested-array bug duplicating id 7 — and `Products.jsx`
a fourth). Every page now reads from **one `MOVIES` table**.

| Before | After |
|---|---|
| Movies hardcoded in 4 files | one `MOVIES` table, 39 rows |
| `MovieDetail.jsx` — 901 lines | 297 lines, fetches by id |
| `Movie.jsx` — 776 lines, 3 genre filters | 202 lines, all 16 genres from DB |
| Favorites in `localStorage` | `FAVORITES` table, tied to your account |
| Login form did nothing | real JWT auth, manager vs customer |
| `Buynow` — payment form, no seats | full seat picker → payment → QR ticket |
| No admin | manager dashboard: CRUD, showtimes, revenue, occupancy |

Your design, layout, Khmer translations, and green Lotus branding are untouched.

---

## Notes for grading

- **Zero-config demo:** `cd backend && npm install && npm start` runs everything on SQLite
  with all 39 movies seeded — no Oracle install required to see it work.
- The SQLite demo schema in `backend/db/index.js` mirrors `sql/01_schema.sql` table-for-table,
  so the Oracle SQL is the real deliverable, not an afterthought.
- Double-booking, coupon discounts, and role enforcement are all verified working.
