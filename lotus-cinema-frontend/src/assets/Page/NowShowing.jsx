import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Star, Clock, Loader2, CalendarDays } from "lucide-react";
import { useLanguage } from "../../context/LanguageContext";
import { MoviesAPI, ShowtimesAPI } from "../../api/client";

/* 'YYYY-MM-DD' from the LOCAL date parts.
   NOT toISOString(): that converts to UTC, so in Cambodia (UTC+7)
   midnight on the 24th becomes '2026-07-23' and the strip asks the
   server for the wrong day — today looks empty and screenings appear
   to slide onto the following date. */
function localISO(d) {
  return (
    d.getFullYear() +
    "-" +
    String(d.getMonth() + 1).padStart(2, "0") +
    "-" +
    String(d.getDate()).padStart(2, "0")
  );
}

/* next 7 days, starting today */
function nextDays(n = 7) {
  const out = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (let i = 0; i < n; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    out.push({
      iso: localISO(d),
      dow: d.toLocaleDateString("en-US", { weekday: "short" }),
      day: d.getDate(),
      mon: d.toLocaleDateString("en-US", { month: "short" }),
      isToday: i === 0,
    });
  }
  return out;
}

export default function NowShowing() {
  const { t, isKhmer } = useLanguage();
  const days = nextDays(7);

  const [tab, setTab] = useState("now"); // 'now' | 'soon'
  const [date, setDate] = useState(days[0].iso);
  const [movies, setMovies] = useState(null);
  const [soon, setSoon] = useState(null);

  // movies playing on the chosen day
  useEffect(() => {
    if (tab !== "now") return;
    setMovies(null);
    ShowtimesAPI.byDate(date)
      .then(setMovies)
      .catch(() => setMovies([]));
  }, [date, tab]);

  // coming soon list
  useEffect(() => {
    if (tab !== "soon" || soon) return;
    MoviesAPI.list({ status: "COMING_SOON" })
      .then(setSoon)
      .catch(() => setSoon([]));
  }, [tab]);

  const list = tab === "now" ? movies : soon;

  return (
    <section className="bg-black text-white py-12 px-4 sm:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Tabs */}
        <div className="flex items-center gap-4 mb-8">
          <button
            onClick={() => setTab("now")}
            className={`text-2xl sm:text-3xl font-extrabold transition ${
              tab === "now" ? "text-white" : "text-gray-600 hover:text-gray-400"
            }`}
          >
            {t("Now Showing", "កំពុងបញ្ចាំង")}
          </button>
          <span className="text-gray-700 text-2xl">|</span>
          <button
            onClick={() => setTab("soon")}
            className={`text-2xl sm:text-3xl font-extrabold transition ${
              tab === "soon" ? "text-white" : "text-gray-600 hover:text-gray-400"
            }`}
          >
            {t("Coming Soon", "នឹងមកដល់")}
          </button>
        </div>

        {/* Date strip — only for Now Showing */}
        {tab === "now" && (
          <div className="flex gap-2 sm:gap-3 mb-8 overflow-x-auto pb-2">
            {days.map((d) => {
              const active = d.iso === date;
              return (
                <button
                  key={d.iso}
                  onClick={() => setDate(d.iso)}
                  className={`flex-none w-[86px] sm:w-24 rounded-xl border py-3 text-center transition ${
                    active
                      ? "border-red-600 bg-red-600/10 text-white"
                      : "border-gray-800 bg-gray-900 text-gray-400 hover:border-gray-600"
                  }`}
                >
                  <p className="text-[11px] uppercase tracking-wide">
                    {d.isToday ? t("Today", "ថ្ងៃនេះ") : d.dow}
                  </p>
                  <p
                    className={`text-2xl font-extrabold leading-tight ${
                      active ? "text-red-500" : ""
                    }`}
                  >
                    {d.day}
                  </p>
                  <p className="text-[11px] text-gray-500">{d.mon}</p>
                </button>
              );
            })}
          </div>
        )}

        {/* Grid */}
        {!list ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-7 h-7 animate-spin text-red-500" />
          </div>
        ) : list.length === 0 ? (
          <div className="text-center py-16 text-gray-500">
            <CalendarDays className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p>
              {tab === "now"
                ? t("No screenings on this day.", "គ្មានការបញ្ចាំងនៅថ្ងៃនេះទេ។")
                : t("Nothing announced yet.", "មិនទាន់មានការប្រកាសទេ។")}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-5">
            {list.map((m) => (
              <Link
                key={m.id}
                to={`/Detail/${m.id}`}
                className="group relative rounded-xl overflow-hidden bg-gray-900 border border-gray-800 hover:border-red-500/60 transition-all duration-300 hover:-translate-y-1"
              >
                <div className="relative aspect-[2/3] overflow-hidden">
                  <img
                    src={m.poster}
                    alt={isKhmer && m.titleKm ? m.titleKm : m.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />

                  {/* ribbon */}
                  {tab === "soon" ? (
                    <span className="absolute top-2 left-2 bg-purple-600 text-[10px] font-bold px-2 py-1 rounded">
                      {t("SOON", "ឆាប់ៗ")}
                    </span>
                  ) : (
                    m.showCount > 0 && (
                      <span className="absolute top-2 left-2 bg-red-600 text-[10px] font-bold px-2 py-1 rounded">
                        {m.showCount} {t("shows", "ការបញ្ចាំង")}
                      </span>
                    )
                  )}

                  {m.rating != null && (
                    <span className="absolute top-2 right-2 bg-black/75 px-1.5 py-0.5 rounded flex items-center gap-1 text-[11px]">
                      <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                      {m.rating}
                    </span>
                  )}

                  {/* hover CTA */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition">
                    <span className="absolute bottom-3 left-0 right-0 text-center text-sm font-semibold">
                      {tab === "now" ? t("Book now", "កក់ឥឡូវ") : t("View details", "មើលព័ត៌មាន")}
                    </span>
                  </div>
                </div>

                <div className="p-3">
                  <h3 className="text-sm font-bold line-clamp-2 group-hover:text-red-500 transition">
                    {isKhmer && m.titleKm ? m.titleKm : m.title}
                  </h3>
                  <p className="text-[11px] text-gray-500 mt-1 flex items-center gap-2">
                    {m.runtime && (
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {m.runtime}
                      </span>
                    )}
                    {tab === "now" && m.fromPrice != null && (
                      <span className="text-green-400">
                        {t("from", "ចាប់ពី")} ${Number(m.fromPrice).toFixed(2)}
                      </span>
                    )}
                    {tab === "soon" && m.releaseYear && <span>{m.releaseYear}</span>}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}