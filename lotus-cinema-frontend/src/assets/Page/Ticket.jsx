import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { QRCodeCanvas } from "qrcode.react";
import { Loader2, Printer, Star } from "lucide-react";
import { useLanguage } from "../../context/LanguageContext";
import { BookingsAPI } from "../../api/client";

export default function Ticket() {
  const { bookingId } = useParams();
  const { t } = useLanguage();
  const [b, setB] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    BookingsAPI.get(bookingId).then(setB).catch((e) => setError(e.message));
  }, [bookingId]);

  if (error)
    return <div className="min-h-screen bg-gray-950 text-white pt-28 text-center">{error}</div>;
  if (!b)
    return (
      <div className="min-h-screen bg-gray-950 text-white pt-28 flex justify-center">
        <Loader2 className="animate-spin" />
      </div>
    );

  const seatList = b.seats.map((s) => `${s.seat_row}${s.seat_col}`).join(", ");
  const primaryQR = b.seats[0]?.qr_code || b.booking_ref;

  return (
    <div className="min-h-screen bg-gray-950 text-white pt-24 pb-16 px-4 print:bg-white print:text-black">
      <div className="max-w-md mx-auto">
        {/* Ticket */}
        <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-3xl overflow-hidden shadow-2xl border border-gray-700 print:border-black">
          {/* Top */}
          <div className="p-6">
            <div className="flex justify-between items-center mb-4">
              <span className="text-lg font-extrabold tracking-wide">
                Lotus<span className="text-red-500">Cinema</span> 🪷
              </span>
              <span className="text-green-400 text-xs font-semibold border border-green-500/40 rounded-full px-3 py-1">
                ● {b.status}
              </span>
            </div>

            <div className="flex gap-4">
              {b.poster_url && (
                <img
                  src={b.poster_url}
                  alt={b.title}
                  className="w-20 h-28 object-cover rounded-lg shadow"
                />
              )}
              <div>
                <h1 className="text-xl font-bold leading-tight">{b.title}</h1>
                {b.title_km && <p className="text-sm text-gray-400">{b.title_km}</p>}
                <p className="flex items-center gap-1 text-yellow-400 text-sm mt-1">
                  <Star className="w-4 h-4 fill-yellow-400" /> {b.rating} · {b.runtime}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mt-5 text-sm">
              <Info label={t("Cinema", "រោងកុន")} val={b.cinema} />
              <Info label={t("City", "ទីក្រុង")} val={b.city} />
              <Info label={t("Date", "កាលបរិច្ឆេទ")} val={b.show_date} />
              <Info label={t("Time", "ម៉ោង")} val={b.start_time} />
              <Info label={t("Hall", "សាល")} val={`${b.hall_name} (${b.hall_type})`} />
              <Info label={t("Seats", "កៅអី")} val={seatList} />
            </div>
          </div>

          {/* Perforation */}
          <div className="relative">
            <div className="border-t-2 border-dashed border-gray-600" />
            <div className="absolute -left-3 -top-3 w-6 h-6 rounded-full bg-gray-950 print:bg-white" />
            <div className="absolute -right-3 -top-3 w-6 h-6 rounded-full bg-gray-950 print:bg-white" />
          </div>

          {/* Bottom */}
          <div className="p-6 flex items-center justify-between">
            <div className="text-sm">
              <p className="text-gray-400 text-xs">{t("Booking Ref", "លេខកក់")}</p>
              <p className="font-mono font-bold mb-2">{b.booking_ref}</p>
              <p className="text-gray-400 text-xs">{t("Paid", "បានទូទាត់")} ({b.method})</p>
              <p className="text-green-400 font-bold text-lg">${b.total_price.toFixed(2)}</p>
            </div>
            <div className="bg-white p-2 rounded-lg">
              <QRCodeCanvas value={primaryQR} size={96} />
            </div>
          </div>
        </div>

        {/* Per-seat tickets */}
        <div className="mt-6 space-y-2">
          <h2 className="text-sm font-semibold text-gray-400">
            {t("Per-seat tickets", "សំបុត្រតាមកៅអី")}
          </h2>
          {b.seats.map((s) => (
            <div
              key={s.qr_code}
              className="flex justify-between items-center bg-gray-900 rounded-lg px-4 py-2 text-sm border border-gray-800"
            >
              <span>
                {t("Seat", "កៅអី")} <b>{s.seat_row}{s.seat_col}</b> · {s.seat_type}
              </span>
              <span className="font-mono text-xs text-gray-500">{s.qr_code}</span>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="flex gap-3 mt-6 justify-center print:hidden">
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 bg-red-600 hover:bg-red-500 px-4 py-2 rounded-lg text-sm font-semibold"
          >
            <Printer className="w-4 h-4" /> {t("Print / Save PDF", "បោះពុម្ព")}
          </button>
          <Link
            to="/my-bookings"
            className="bg-gray-800 hover:bg-gray-700 px-4 py-2 rounded-lg text-sm font-semibold"
          >
            {t("My Bookings", "ការកក់របស់ខ្ញុំ")}
          </Link>
          <Link
            to="/Movie"
            className="bg-gray-800 hover:bg-gray-700 px-4 py-2 rounded-lg text-sm font-semibold"
          >
            {t("Book another", "កក់ម្តងទៀត")}
          </Link>
        </div>
      </div>
    </div>
  );
}

const Info = ({ label, val }) => (
  <div>
    <p className="text-gray-500 text-xs">{label}</p>
    <p className="font-medium">{val}</p>
  </div>
);
