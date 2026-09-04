import React, { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  CreditCard,
  Wallet,
  Lock,
  Loader2,
  Popcorn,
  Plus,
  Minus,
  ChevronDown,
  Clock,
  CheckCircle2,
} from "lucide-react";
import { useLanguage } from "../../context/LanguageContext";
import { useAuth } from "../../context/AuthContext";
import { QRCodeCanvas } from "qrcode.react";
import { ShowtimesAPI, BookingsAPI, ConcessionsAPI, AcledaAPI } from "../../api/client";

const CATEGORIES = [
  { key: "POPCORN", en: "Popcorn", km: "ពោតលីង" },
  { key: "DRINK", en: "Drinks", km: "ភេសជ្ជៈ" },
  { key: "SNACK", en: "Snacks", km: "អាហារសម្រន់" },
  { key: "COMBO", en: "Combos", km: "ឈុត" },
];

const PAYMENTS = [
  { key: "VISA", label: "Visa", icon: CreditCard },
  { key: "MASTERCARD", label: "MasterCard", icon: CreditCard },
  { key: "KHQR", label: "KHQR", icon: Wallet },
  { key: "ABA", label: "ABA Pay", icon: Wallet },
  { key: "PAYPAL", label: "PayPal", icon: Wallet },
];

const PROMOS = [
  { code: "WELCOME10", pct: 10 },
  { code: "STUDENT20", pct: 20 },
  { code: "LOTUS15", pct: 15 },
];

export default function Booking() {
  const { showtimeId } = useParams();
  const { t, isKhmer } = useLanguage();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [data, setData] = useState(null);
  const [selected, setSelected] = useState([]); // show_seat_id[]
  const [coupon, setCoupon] = useState("");
  const [method, setMethod] = useState("KHQR");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // snacks & drinks
  const [menu, setMenu] = useState([]);
  const [cart, setCart] = useState({}); // { itemId: qty }
  const [foodOpen, setFoodOpen] = useState(false);
  const [tab, setTab] = useState("POPCORN");

  // KHQR payment modal
  const [pay, setPay] = useState(null); // { bookingId, khqr, total }
  const [secondsLeft, setSecondsLeft] = useState(300);
  const [acledaLive, setAcledaLive] = useState(false);

  useEffect(() => {
    ShowtimesAPI.seats(showtimeId)
      .then(setData)
      .catch((e) => setError(e.message));
    ConcessionsAPI.list()
      .then(setMenu)
      .catch(() => {}); // menu is optional — booking still works without it
    AcledaAPI.status()
      .then((s) => setAcledaLive(!!s.enabled))
      .catch(() => setAcledaLive(false));
  }, [showtimeId]);

  // 5-minute countdown while the KHQR is on screen
  useEffect(() => {
    if (!pay) return;
    setSecondsLeft(300);
    const id = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          clearInterval(id);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [pay]);

  if (error && !data)
    return <div className="min-h-screen bg-gray-950 text-white pt-28 text-center">{error}</div>;
  if (!data)
    return (
      <div className="min-h-screen bg-gray-950 text-white pt-28 flex justify-center">
        <Loader2 className="animate-spin" />
      </div>
    );

  const selectedSeats = data.seats.filter((s) => selected.includes(s.show_seat_id));

  const seatTotal = selectedSeats.reduce((a, s) => a + s.price, 0);
  const foodLines = Object.entries(cart)
    .filter(([, q]) => q > 0)
    .map(([id, q]) => ({ item: menu.find((m) => m.id === Number(id)), qty: q }))
    .filter((l) => l.item);
  const foodTotal = foodLines.reduce((a, l) => a + l.item.price * l.qty, 0);
  const subtotal = Math.round((seatTotal + foodTotal) * 100) / 100;

  const promo = PROMOS.find((p) => p.code === coupon.trim().toUpperCase());
  const estDiscount = promo ? Math.round(subtotal * (promo.pct / 100) * 100) / 100 : 0;
  const estTotal = Math.round((subtotal - estDiscount) * 100) / 100;

  const addItem = (id) => setCart((c) => ({ ...c, [id]: (c[id] || 0) + 1 }));
  const removeItem = (id) =>
    setCart((c) => {
      const n = (c[id] || 0) - 1;
      const out = { ...c };
      if (n <= 0) delete out[id];
      else out[id] = n;
      return out;
    });
  const cartCount = Object.values(cart).reduce((a, b) => a + b, 0);

  // group seats by row
  const rows = {};
  data.seats.forEach((s) => {
    (rows[s.seat_row] = rows[s.seat_row] || []).push(s);
  });

  const toggle = (seat) => {
    if (seat.status !== "AVAILABLE") return;
    setSelected((cur) =>
      cur.includes(seat.show_seat_id)
        ? cur.filter((id) => id !== seat.show_seat_id)
        : cur.length >= 10
        ? cur
        : [...cur, seat.show_seat_id]
    );
  };

  const seatColor = (seat) => {
    if (seat.status === "BOOKED")
      return "bg-gray-700 text-gray-700 cursor-not-allowed opacity-40";
    if (selected.includes(seat.show_seat_id))
      return "bg-red-600 text-red-600 !text-white scale-110";
    if (seat.seat_type === "VIP")
      return "bg-yellow-500/20 text-yellow-500 border border-yellow-500/60 hover:bg-yellow-500/40";
    if (seat.seat_type === "PREMIUM")
      return "bg-green-500/20 text-green-500 border border-green-500/50 hover:bg-green-500/40";
    return "bg-gray-800 text-gray-600 hover:bg-gray-600 border border-gray-700";
  };

  const checkout = async () => {
    setError("");
    if (!user) {
      navigate("/Login");
      return;
    }
    if (!selected.length) {
      setError(t("Please select at least one seat.", "សូមជ្រើសរើសកៅអីយ៉ាងតិចមួយ។"));
      return;
    }
    setBusy(true);
    try {
      const res = await BookingsAPI.create({
        showtimeId: Number(showtimeId),
        showSeatIds: selected,
        couponCode: coupon.trim() || undefined,
        paymentMethod: method,
        food: foodLines.map((l) => ({ itemId: l.item.id, quantity: l.qty })),
      });
      // KHQR: if the server has live ACLEDA credentials, hand the customer
      // to ACLEDA's own KHQR page (a real, scannable payment). Otherwise fall
      // back to the locally generated demo QR.
      if (method === "ABA" || method === "KHQR") {
        if (acledaLive) {
          try {
            const p = await AcledaAPI.pay(res.bookingId);
            // remember where to come back to
            sessionStorage.setItem("lotus_pending_booking", String(res.bookingId));
            // build and submit a form -> ACLEDA renders the KHQR page
            const f = document.createElement("form");
            f.method = "POST";
            f.action = p.action;
            Object.entries(p.fields).forEach(([k, v]) => {
              const i = document.createElement("input");
              i.type = "hidden";
              i.name = k;
              i.value = v;
              f.appendChild(i);
            });
            document.body.appendChild(f);
            f.submit();
            return;
          } catch (e) {
            // live call failed -> show the demo QR instead of blocking the sale
            console.warn("ACLEDA live payment unavailable:", e.message);
          }
        }
        setPay({ bookingId: res.bookingId, khqr: res.khqrString, total: res.total });
      } else {
        navigate(`/ticket/${res.bookingId}`);
      }
    } catch (e) {
      setError(e.message);
      // reload seat map in case seats were taken
      ShowtimesAPI.seats(showtimeId).then(setData);
      setSelected([]);
    } finally {
      setBusy(false);
    }
  };

  const mmss = (s) =>
    `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  const st = data.showtime;

  return (
    <div className="min-h-screen bg-gray-950 text-white pt-24 pb-16 px-4 sm:px-8">
      <div className="max-w-6xl mx-auto grid lg:grid-cols-[1fr_360px] gap-8">
        {/* Seat map */}
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-3xl font-extrabold">{st.title}</h1>
            {st.screen_type && (
              <span
                className={`text-xs font-bold rounded px-2 py-1 ${
                  st.screen_type === "IMAX"
                    ? "bg-blue-600"
                    : st.screen_type === "3D"
                    ? "bg-purple-600"
                    : st.screen_type === "4DX"
                    ? "bg-orange-600"
                    : st.screen_type === "VIP"
                    ? "bg-yellow-500 text-black"
                    : "bg-gray-700"
                }`}
              >
                {st.screen_type}
              </span>
            )}
          </div>
          <p className="text-gray-400 mb-6 text-sm">
            {st.cinema} · {st.hall_name} · {t("Floor", "ជាន់")} {st.floor} · {st.show_date} ·{" "}
            {st.start_time}
          </p>

          {/* Screen */}
          <div className="mb-10">
            <div className="mx-auto w-3/4 h-3 rounded-t-[50%] bg-gradient-to-b from-red-500/70 to-transparent shadow-[0_0_40px_10px_rgba(239,68,68,0.4)]" />
            <p className="text-center text-xs tracking-[0.5em] text-gray-500 mt-2">
              {t("SCREEN", "អេក្រង់")}
            </p>
          </div>

          {/* Seats */}
          <div className="space-y-2.5 overflow-x-auto pb-2">
            {Object.keys(rows)
              .sort()
              .map((row) => (
                <div key={row} className="flex items-center gap-3 justify-center">
                  <span className="w-4 text-xs text-gray-500">{row}</span>
                  <div className="flex gap-2.5">
                    {rows[row]
                      .sort((a, b) => a.seat_col - b.seat_col)
                      .map((seat) => (
                        <button
                          key={seat.show_seat_id}
                          onClick={() => toggle(seat)}
                          title={`${seat.seat_row}${seat.seat_col} · ${seat.seat_type} · $${seat.price}`}
                          className={`relative w-7 h-7 rounded-t-lg rounded-b-sm text-[9px] font-bold
                            flex items-end justify-center pb-0.5 transition-all duration-150
                            before:absolute before:-left-[3px] before:top-2 before:w-[3px] before:h-3 before:rounded-l-sm before:bg-current before:opacity-50
                            after:absolute after:-right-[3px] after:top-2 after:w-[3px] after:h-3 after:rounded-r-sm after:bg-current after:opacity-50
                            ${seatColor(seat)}`}
                        >
                          <span className={selected.includes(seat.show_seat_id) ? "text-white" : "text-gray-400"}>
                            {seat.seat_col}
                          </span>
                        </button>
                      ))}
                  </div>
                </div>
              ))}
          </div>

          {/* Legend */}
          <div className="flex flex-wrap gap-4 justify-center mt-8 text-xs text-gray-400">
            <Legend cls="bg-gray-800 border border-gray-700" label={t("Standard", "ធម្មតា")} />
            <Legend cls="bg-green-500/30 border border-green-500/50" label={t("Premium", "ពិសេស")} />
            <Legend cls="bg-yellow-500/30 border border-yellow-500/60" label="VIP" />
            <Legend cls="bg-red-600" label={t("Selected", "បានជ្រើស")} />
            <Legend cls="bg-gray-700 opacity-40" label={t("Booked", "កក់រួច")} />
          </div>

          {/* ---------- Snacks & drinks ---------- */}
          {menu.length > 0 && (
            <div className="mt-10 border border-gray-800 rounded-2xl overflow-hidden">
              <button
                onClick={() => setFoodOpen((o) => !o)}
                className="w-full flex items-center justify-between px-5 py-4 bg-gray-900 hover:bg-gray-800 transition"
              >
                <span className="flex items-center gap-2 font-semibold">
                  <Popcorn className="w-5 h-5 text-yellow-500" />
                  {t("Add snacks & drinks", "បន្ថែមអាហារ និងភេសជ្ជៈ")}
                  {cartCount > 0 && (
                    <span className="bg-red-600 text-white text-xs rounded-full px-2 py-0.5">
                      {cartCount}
                    </span>
                  )}
                </span>
                <span className="flex items-center gap-3 text-sm text-gray-400">
                  {foodTotal > 0 && (
                    <span className="text-yellow-400 font-mono">+${foodTotal.toFixed(2)}</span>
                  )}
                  <ChevronDown
                    className={`w-5 h-5 transition-transform ${foodOpen ? "rotate-180" : ""}`}
                  />
                </span>
              </button>

              {foodOpen && (
                <div className="p-5 bg-gray-950/60">
                  {/* category tabs */}
                  <div className="flex gap-2 mb-5 flex-wrap">
                    {CATEGORIES.map((c) => {
                      const n = menu.filter((m) => m.category === c.key).length;
                      if (!n) return null;
                      return (
                        <button
                          key={c.key}
                          onClick={() => setTab(c.key)}
                          className={`px-4 py-1.5 rounded-full text-xs font-semibold transition ${
                            tab === c.key
                              ? "bg-red-600 text-white"
                              : "bg-gray-800 text-gray-300 hover:bg-gray-700"
                          }`}
                        >
                          {t(c.en, c.km)}
                        </button>
                      );
                    })}
                  </div>

                  {/* items */}
                  <div className="grid sm:grid-cols-2 gap-3">
                    {menu
                      .filter((m) => m.category === tab)
                      .map((item) => {
                        const qty = cart[item.id] || 0;
                        return (
                          <div
                            key={item.id}
                            className={`flex gap-3 items-center rounded-xl p-3 border transition ${
                              qty
                                ? "bg-red-600/10 border-red-600/40"
                                : "bg-gray-900 border-gray-800 hover:border-gray-700"
                            }`}
                          >
                            {item.image && (
                              <img
                                src={item.image}
                                alt={item.name}
                                className="w-14 h-14 rounded-lg object-cover flex-none"
                              />
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold truncate">
                                {isKhmer && item.nameKm ? item.nameKm : item.name}
                              </p>
                              {item.description && (
                                <p className="text-[11px] text-gray-500 truncate">
                                  {item.description}
                                </p>
                              )}
                              <p className="text-sm text-yellow-400 font-mono mt-0.5">
                                ${item.price.toFixed(2)}
                              </p>
                            </div>

                            {qty === 0 ? (
                              <button
                                onClick={() => addItem(item.id)}
                                className="flex-none bg-gray-800 hover:bg-red-600 w-8 h-8 rounded-lg flex items-center justify-center transition"
                                aria-label={t("Add", "បន្ថែម")}
                              >
                                <Plus className="w-4 h-4" />
                              </button>
                            ) : (
                              <div className="flex-none flex items-center gap-1.5">
                                <button
                                  onClick={() => removeItem(item.id)}
                                  className="bg-gray-800 hover:bg-gray-700 w-7 h-7 rounded-md flex items-center justify-center"
                                >
                                  <Minus className="w-3.5 h-3.5" />
                                </button>
                                <span className="w-5 text-center text-sm font-bold">{qty}</span>
                                <button
                                  onClick={() => addItem(item.id)}
                                  className="bg-red-600 hover:bg-red-500 w-7 h-7 rounded-md flex items-center justify-center"
                                >
                                  <Plus className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Order summary */}
        <div className="bg-gray-900 rounded-2xl p-6 h-fit lg:sticky lg:top-24 border border-gray-800">
          <h2 className="text-lg font-bold mb-4">{t("Your Order", "ការកម្មង់របស់អ្នក")}</h2>

          {selectedSeats.length === 0 ? (
            <p className="text-gray-500 text-sm mb-4">
              {t("Tap seats to select them.", "ចុចលើកៅអីដើម្បីជ្រើសរើស។")}
            </p>
          ) : (
            <div className="flex flex-wrap gap-2 mb-4">
              {selectedSeats.map((s) => (
                <span
                  key={s.show_seat_id}
                  className="bg-red-600/20 border border-red-600/40 text-red-300 text-xs px-2 py-1 rounded"
                >
                  {s.seat_row}
                  {s.seat_col} · ${s.price}
                </span>
              ))}
            </div>
          )}

          {/* food in cart */}
          {foodLines.length > 0 && (
            <div className="mb-4 space-y-1.5">
              {foodLines.map((l) => (
                <div
                  key={l.item.id}
                  className="flex justify-between items-center text-xs text-gray-300"
                >
                  <span className="truncate pr-2">
                    {l.qty}× {isKhmer && l.item.nameKm ? l.item.nameKm : l.item.name}
                  </span>
                  <span className="font-mono text-gray-400 flex-none">
                    ${(l.item.price * l.qty).toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Promotions */}
          <div className="mb-4">
            <h3 className="text-sm font-medium mb-2">{t("Promotions", "ការបញ្ចុះតម្លៃ")}</h3>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {PROMOS.map((p) => (
                <button
                  key={p.code}
                  onClick={() => setCoupon(coupon === p.code ? "" : p.code)}
                  className={`text-[10px] px-2 py-1 rounded-full border transition ${
                    coupon === p.code
                      ? "bg-green-600 border-green-500 text-white"
                      : "bg-gray-800 border-gray-700 text-gray-300 hover:border-green-600"
                  }`}
                >
                  {p.code} · -{p.pct}%
                </button>
              ))}
            </div>
            <input
              value={coupon}
              onChange={(e) => setCoupon(e.target.value.toUpperCase())}
              placeholder={t("Or type a code", "ឬវាយកូដ")}
              className="w-full bg-gray-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-red-500"
            />
          </div>

          <div>
            <h3 className="text-sm font-medium mb-2">{t("Payment", "ការទូទាត់")}</h3>
            <div className="grid grid-cols-2 gap-2 mb-4">
              {PAYMENTS.map((p) => (
                <button
                  key={p.key}
                  onClick={() => setMethod(p.key)}
                  className={`flex items-center justify-center gap-1.5 p-2 rounded-lg text-xs transition ${
                    method === p.key
                      ? "bg-red-600 text-white"
                      : "bg-gray-800 hover:bg-gray-700 text-gray-300"
                  }`}
                >
                  <p.icon className="w-4 h-4" />
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div className="border-t border-gray-800 pt-4 space-y-1 text-sm">
            <Row label={t("Seats", "កៅអី")} val={selectedSeats.length} />
            <Row label={t("Seat total", "តម្លៃកៅអី")} val={`$${seatTotal.toFixed(2)}`} />
            {foodTotal > 0 && (
              <Row label={t("Snacks", "អាហារ")} val={`$${foodTotal.toFixed(2)}`} />
            )}
            <div className="flex justify-between pt-1 text-gray-300">
              <span>{t("Subtotal", "សរុបរង")}</span>
              <span>${subtotal.toFixed(2)}</span>
            </div>
            {estDiscount > 0 && (
              <div className="flex justify-between text-green-400">
                <span>
                  {t("Discount", "បញ្ចុះតម្លៃ")} ({promo.pct}%)
                </span>
                <span>−${estDiscount.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between pt-1 font-bold text-white text-base">
              <span>{t("Total", "សរុប")}</span>
              <span>${estTotal.toFixed(2)}</span>
            </div>
          </div>

          {error && <p className="text-red-400 text-xs mt-3">{error}</p>}

          <button
            onClick={checkout}
            disabled={busy || !selected.length}
            className="w-full mt-4 flex items-center justify-center gap-2 bg-green-600 hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed p-3 rounded-lg font-semibold transition"
          >
            {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : <Lock className="w-5 h-5" />}
            {t("Pay", "ទូទាត់")} ${estTotal.toFixed(2)}
          </button>

          {!user && (
            <p className="text-xs text-gray-500 mt-3 text-center">
              {t("You'll be asked to log in.", "អ្នកនឹងត្រូវចូលគណនីជាមុនសិន។")}{" "}
              <Link to="/Login" className="text-red-400">
                {t("Login", "ចូលគណនី")}
              </Link>
            </p>
          )}
        </div>
      </div>

      {/* ---------- KHQR payment modal ---------- */}
      {pay && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-white text-gray-900 rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl">
            {/* KHQR red header band */}
            <div className="bg-[#E21A2C] px-6 py-4 flex items-center justify-between">
              <span className="text-white font-extrabold tracking-wide text-lg">KHQR</span>
              <span className="text-white/90 text-xs flex items-center gap-1">
                <Clock className="w-4 h-4" /> {mmss(secondsLeft)}
              </span>
            </div>

            <div className="p-6 text-center">
              <p className="text-sm text-gray-500">{t("Lotus Cinema", "Lotus Cinema")}</p>
              <p className="text-3xl font-extrabold mt-1">
                ${pay.total.toFixed(2)} <span className="text-base font-medium text-gray-500">USD</span>
              </p>

              {secondsLeft > 0 ? (
                <>
                  {/* Real bank QR image. It carries the account identity but no
                      amount, so the amount is shown clearly above it for the
                      customer to enter — the way most shops in Cambodia do it. */}
                  <div className="my-5 flex justify-center">
                    <div className="p-3 border-2 border-gray-200 rounded-2xl bg-white">
                      <img
                        src="/videos/QR.jpg"
                        alt="KHQR"
                        className="w-[220px] h-[220px] object-contain"
                      />
                    </div>
                  </div>
                  <p className="text-sm text-gray-700 font-semibold mb-1">
                    {t("Scan with your bank app", "ស្កេនដោយកម្មវិធីធនាគាររបស់អ្នក")}
                  </p>
                  <p className="text-xs text-gray-500 mb-5">
                    {t(
                      `Enter the amount $${pay.total.toFixed(2)} when your bank app asks.`,
                      `សូមបញ្ចូលចំនួនទឹកប្រាក់ $${pay.total.toFixed(2)} ពេលកម្មវិធីធនាគារសួរ។`
                    )}
                  </p>

                  <button
                    onClick={() => navigate(`/ticket/${pay.bookingId}`)}
                    className="w-full bg-[#E21A2C] hover:bg-red-700 text-white py-3 rounded-xl font-semibold flex items-center justify-center gap-2"
                  >
                    <CheckCircle2 className="w-5 h-5" />
                    {t("Confirm payment — show my ticket", "បញ្ជាក់ការទូទាត់ — បង្ហាញសំបុត្រ")}
                  </button>
                  <button
                    onClick={() => setPay(null)}
                    className="w-full mt-2 text-gray-500 text-sm py-2"
                  >
                    {t("Cancel", "បោះបង់")}
                  </button>
                </>
              ) : (
                <div className="my-6">
                  <p className="text-red-600 font-semibold mb-4">
                    {t("QR expired. Your booking is still saved.", "QR ផុតកំណត់។ ការកក់នៅរក្សាទុក។")}
                  </p>
                  <button
                    onClick={() => navigate(`/ticket/${pay.bookingId}`)}
                    className="w-full bg-gray-900 text-white py-3 rounded-xl font-semibold"
                  >
                    {t("Show my ticket", "បង្ហាញសំបុត្រ")}
                  </button>
                </div>
              )}

              <p className="text-[10px] text-gray-400 mt-4">
                {t(
                  "Lotus Cinema · KHQR payment",
                  "Lotus Cinema · ការទូទាត់តាម KHQR"
                )}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const Legend = ({ cls, label }) => (
  <span className="flex items-center gap-1.5">
    <span className={`w-4 h-4 rounded-t-md rounded-b-sm ${cls}`} />
    {label}
  </span>
);
const Row = ({ label, val }) => (
  <div className="flex justify-between text-gray-300">
    <span>{label}</span>
    <span>{val}</span>
  </div>
);