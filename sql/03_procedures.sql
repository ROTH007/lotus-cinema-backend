-- ============================================================
--  Lotus Cinema — stored procedures + reporting views
-- ============================================================

-- Generate an 8x12 seat grid for a hall (rows A-H, cols 1-12)
-- Back rows (G,H) = VIP, middle (E,F) = PREMIUM, rest = STANDARD
CREATE OR REPLACE PROCEDURE gen_seats(p_hall_id IN NUMBER) IS
  v_row VARCHAR2(2);
  v_type VARCHAR2(20);
BEGIN
  FOR r IN 1..8 LOOP
    v_row := CHR(64 + r);  -- A..H
    v_type := CASE
                WHEN r >= 7 THEN 'VIP'
                WHEN r >= 5 THEN 'PREMIUM'
                ELSE 'STANDARD'
              END;
    FOR c IN 1..12 LOOP
      INSERT INTO seats (hall_id, seat_row, seat_col, seat_type)
      VALUES (p_hall_id, v_row, c, v_type);
    END LOOP;
  END LOOP;
  COMMIT;
END;
/

-- Create a showtime AND open every seat for booking with tiered pricing
--   PREMIUM = base + 2, VIP = base + 4
CREATE OR REPLACE PROCEDURE create_showtime(
  p_movie_id   IN NUMBER,
  p_hall_id    IN NUMBER,
  p_show_date  IN DATE,
  p_start_time IN VARCHAR2,
  p_base_price IN NUMBER
) IS
  v_showtime_id NUMBER;
BEGIN
  INSERT INTO showtimes (movie_id, hall_id, show_date, start_time, base_price)
  VALUES (p_movie_id, p_hall_id, p_show_date, p_start_time, p_base_price)
  RETURNING showtime_id INTO v_showtime_id;

  INSERT INTO show_seats (showtime_id, seat_id, status, price)
  SELECT v_showtime_id, s.seat_id, 'AVAILABLE',
         p_base_price + CASE s.seat_type
                          WHEN 'VIP' THEN 4
                          WHEN 'PREMIUM' THEN 2
                          ELSE 0 END
  FROM seats s
  WHERE s.hall_id = p_hall_id;

  COMMIT;
END;
/

-- ---------- Reporting views (for the manager dashboard) ----------
CREATE OR REPLACE VIEW v_revenue_by_movie AS
SELECT m.movie_id, m.title,
       COUNT(bs.booking_seat_id) AS seats_sold,
       NVL(SUM(ss.price),0)      AS revenue
FROM movies m
LEFT JOIN showtimes st  ON st.movie_id = m.movie_id
LEFT JOIN show_seats ss ON ss.showtime_id = st.showtime_id
LEFT JOIN booking_seats bs ON bs.show_seat_id = ss.show_seat_id
LEFT JOIN bookings b ON b.booking_id = bs.booking_id AND b.status = 'CONFIRMED'
GROUP BY m.movie_id, m.title;

CREATE OR REPLACE VIEW v_revenue_by_day AS
SELECT TO_CHAR(b.created_at,'YYYY-MM-DD') AS day,
       COUNT(DISTINCT b.booking_id) AS bookings,
       SUM(b.total_price)           AS revenue
FROM bookings b
WHERE b.status = 'CONFIRMED'
GROUP BY TO_CHAR(b.created_at,'YYYY-MM-DD');

CREATE OR REPLACE VIEW v_occupancy AS
SELECT st.showtime_id, m.title, st.show_date, st.start_time,
       COUNT(ss.show_seat_id) AS total_seats,
       SUM(CASE WHEN ss.status = 'BOOKED' THEN 1 ELSE 0 END) AS sold
FROM showtimes st
JOIN movies m ON m.movie_id = st.movie_id
JOIN show_seats ss ON ss.showtime_id = st.showtime_id
GROUP BY st.showtime_id, m.title, st.show_date, st.start_time;

CREATE OR REPLACE VIEW v_dashboard AS
SELECT
  (SELECT COUNT(*) FROM movies WHERE status='NOW_SHOWING')                AS movies_showing,
  (SELECT COUNT(*) FROM bookings WHERE status='CONFIRMED')               AS total_bookings,
  (SELECT COUNT(*) FROM users WHERE role='CUSTOMER')                     AS total_customers,
  (SELECT NVL(SUM(total_price),0) FROM bookings WHERE status='CONFIRMED') AS total_revenue
FROM dual;
