# Lotus Cinema — ER Diagram

Paste into [mermaid.live](https://mermaid.live) to view or export as an image.

```mermaid
erDiagram
    CITIES ||--o{ CINEMAS : has
    CINEMAS ||--o{ HALLS : contains
    HALLS ||--o{ SEATS : "has 96"
    HALLS ||--o{ SHOWTIMES : hosts

    MOVIES ||--o{ MOVIE_GENRES : ""
    GENRES ||--o{ MOVIE_GENRES : ""
    MOVIES ||--o{ SHOWTIMES : screens
    MOVIES ||--o{ FAVORITES : ""
    MOVIES ||--o{ REVIEWS : ""

    USERS ||--o{ FAVORITES : saves
    USERS ||--o{ REVIEWS : writes
    USERS ||--o{ BOOKINGS : makes

    SHOWTIMES ||--o{ SHOW_SEATS : opens
    SEATS ||--o{ SHOW_SEATS : "instance of"
    SHOWTIMES ||--o{ BOOKINGS : ""

    BOOKINGS ||--o{ BOOKING_SEATS : contains
    SHOW_SEATS ||--|| BOOKING_SEATS : "sold once"
    BOOKINGS ||--o{ PAYMENTS : "paid by"
    BOOKINGS ||--o{ TICKETS : issues
    BOOKING_SEATS ||--|| TICKETS : "1 QR each"
    COUPONS ||--o{ BOOKINGS : discounts

    CITIES {
        number city_id PK
        varchar2 city_name
        nvarchar2 city_name_km
    }
    CINEMAS {
        number cinema_id PK
        number city_id FK
        varchar2 name
        varchar2 address
    }
    HALLS {
        number hall_id PK
        number cinema_id FK
        varchar2 hall_name
        varchar2 hall_type "STANDARD|IMAX|VIP"
    }
    SEATS {
        number seat_id PK
        number hall_id FK
        varchar2 seat_row "A-H"
        number seat_col "1-12"
        varchar2 seat_type "STANDARD|PREMIUM|VIP"
    }
    USERS {
        number user_id PK
        varchar2 username UK
        varchar2 email UK
        varchar2 password_hash
        varchar2 role "CUSTOMER|MANAGER"
        varchar2 full_name
        varchar2 phone
    }
    MOVIES {
        number movie_id PK
        varchar2 title
        nvarchar2 title_km
        varchar2 tagline
        varchar2 overview
        varchar2 release_year
        varchar2 runtime
        number rating
        varchar2 production
        number base_price
        varchar2 poster_url
        varchar2 banner_url
        varchar2 trailer_url
        varchar2 status "NOW_SHOWING|COMING_SOON|ARCHIVED"
    }
    GENRES {
        number genre_id PK
        varchar2 genre_name UK
        nvarchar2 genre_name_km
    }
    MOVIE_GENRES {
        number movie_id PK_FK
        number genre_id PK_FK
    }
    FAVORITES {
        number user_id PK_FK
        number movie_id PK_FK
        timestamp added_at
    }
    REVIEWS {
        number review_id PK
        number user_id FK
        number movie_id FK
        number stars "1-5"
        varchar2 comment
    }
    SHOWTIMES {
        number showtime_id PK
        number movie_id FK
        number hall_id FK
        date show_date
        varchar2 start_time
        number base_price
    }
    SHOW_SEATS {
        number show_seat_id PK
        number showtime_id FK
        number seat_id FK
        varchar2 status "AVAILABLE|LOCKED|BOOKED"
        number price
    }
    COUPONS {
        number coupon_id PK
        varchar2 code UK
        number discount_pct
        number active
    }
    BOOKINGS {
        number booking_id PK
        varchar2 booking_ref UK
        number user_id FK
        number showtime_id FK
        number coupon_id FK
        number subtotal
        number discount
        number total_price
        varchar2 status "PENDING|CONFIRMED|CANCELLED"
    }
    BOOKING_SEATS {
        number booking_seat_id PK
        number booking_id FK
        number show_seat_id FK_UK "unique = sold once"
    }
    PAYMENTS {
        number payment_id PK
        number booking_id FK
        varchar2 method "VISA|MASTERCARD|PAYPAL|ABA|CASH"
        varchar2 txn_ref
        number amount
    }
    TICKETS {
        number ticket_id PK
        number booking_id FK
        number booking_seat_id FK
        varchar2 qr_code UK
    }
```

## Reading the diagram

The chain that matters most:

**`SHOWTIMES → SHOW_SEATS → BOOKING_SEATS`**

A physical `SEAT` (say A5 in Hall A) exists once. But it can be sold many times — once per
screening. `SHOW_SEATS` is that intersection: one row per seat *per showtime*, carrying its
own `status` and `price`.

`BOOKING_SEATS.show_seat_id` has a **UNIQUE constraint**, which is what makes
double-booking structurally impossible rather than just unlikely.
