import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useLanguage } from "../../context/LanguageContext";
import { useAuth } from "../../context/AuthContext";
import { BookingsAPI } from "../../api/client";

export default function MyBookings() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [rows, setRows] = useState(null);
  const [error, setError] = useState("");

  const load = () => BookingsAPI.mine().then(setRows).catch((e) => setError(e.message));

  useEffect(() => {
    if (!user) {
      navigate("/Login");
      return;
    }
    load();
  }, [user]);

  const cancel = async (id) => {
    if (!confirm(t("Cancel this booking? Seats will be released.", "បោះបង់ការកក់នេះ?"))) return;
    try {
      await BookingsAPI.cancel(id);
      load();
    } catch (e) {
      alert(e.message);
    }
  };

  if (!rows)
    return (
      <div className="min-h-screen bg-gray-950 text-white pt-28 flex justify-center">
        <Loader2 className="animate-spin" />
      </div>
    );

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0f0f0f] to-[#1a1a1a] text-white pt-24 px-6 sm:px-12 pb-16">
      <h1 className="text-4xl font-extrabold mb-10 text-center">
        {t("My Bookings", "ការកក់របស់ខ្ញុំ")}
      </h1>

      {error && <p className="text-red-400 text-center">{error}</p>}

      {rows.length === 0 ? (
        <p className="text-gray-400 text-center">
          {t("No bookings yet.", "មិនទាន់មានការកក់ទេ។")}{" "}
          <Link to="/Movie" className="text-red-400">
            {t("Find a movie →", "រកភាពយន្ត →")}
          </Link>
        </p>
      ) : (
        <div className="max-w-3xl mx-auto space-y-4">
          {rows.map((b) => (
            <div
              key={b.booking_id}
              className="flex gap-4 items-center bg-gray-900 rounded-2xl p-4 border border-gray-800"
            >
              {b.poster_url && (
                <img
                  src={b.poster_url}
                  alt={b.title}
                  className="w-16 h-24 object-cover rounded-lg"
                />
              )}
              <div className="flex-1">
                <h3 className="font-bold">{b.title}</h3>
                <p className="text-sm text-gray-400">
                  {b.show_date} · {b.start_time} · {b.cinema} · {b.hall_name}
                </p>
                <p className="text-xs font-mono text-gray-500 mt-1">
                  {b.booking_ref} · ${b.total_price.toFixed(2)}
                </p>
              </div>
              <div className="text-right">
                <span
                  className={`text-xs px-2 py-1 rounded-full ${
                    b.status === "CONFIRMED"
                      ? "bg-green-600/20 text-green-400 border border-green-600/40"
                      : "bg-gray-700 text-gray-400"
                  }`}
                >
                  {b.status}
                </span>
                <div className="flex gap-2 mt-3 justify-end">
                  <Link
                    to={`/ticket/${b.booking_id}`}
                    className="text-xs bg-red-600 hover:bg-red-500 px-3 py-1.5 rounded"
                  >
                    {t("View ticket", "មើលសំបុត្រ")}
                  </Link>
                  {b.status === "CONFIRMED" && (
                    <button
                      onClick={() => cancel(b.booking_id)}
                      className="text-xs bg-gray-800 hover:bg-gray-700 px-3 py-1.5 rounded"
                    >
                      {t("Cancel", "បោះបង់")}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
