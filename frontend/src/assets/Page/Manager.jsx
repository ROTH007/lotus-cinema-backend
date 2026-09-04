import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Loader2,
  DollarSign,
  Ticket,
  Film,
  Users,
  LayoutDashboard,
  Clapperboard,
  CalendarClock,
  Popcorn,
  Receipt,
  BarChart3,
  TrendingUp,
  Trash2,
  Pencil,
  Printer,
  Check,
} from "lucide-react";
import { useLanguage } from "../../context/LanguageContext";
import { useAuth } from "../../context/AuthContext";
import { ManagerAPI, MoviesAPI, ShowtimesAPI, ConcessionsAPI } from "../../api/client";

const TABS = [
  { key: "dashboard", icon: LayoutDashboard, en: "Dashboard", km: "ផ្ទាំងគ្រប់គ្រង" },
  { key: "movies", icon: Clapperboard, en: "Movies", km: "ភាពយន្ត" },
  { key: "showtimes", icon: CalendarClock, en: "Showtimes", km: "ម៉ោងបញ្ចាំង" },
  { key: "food", icon: Popcorn, en: "Food", km: "អាហារ" },
  { key: "bookings", icon: Receipt, en: "Bookings", km: "ការកក់" },
  { key: "reports", icon: BarChart3, en: "Reports", km: "របាយការណ៍" },
];

export default function Manager() {
  const { user, isManager } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [tab, setTab] = useState("dashboard");

  useEffect(() => {
    if (!user) navigate("/Login");
  }, [user]);

  if (!user) return null;
  if (!isManager)
    return (
      <div className="min-h-screen bg-gray-950 text-white pt-28 text-center">
        {t("Manager access only.", "សម្រាប់តែអ្នកគ្រប់គ្រង។")}
      </div>
    );

  const active = TABS.find((x) => x.key === tab);

  return (
    <div className="min-h-screen bg-gray-950 text-white pt-20 pb-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:grid lg:grid-cols-[220px_1fr] lg:gap-8">
        {/* ---------- Sidebar ---------- */}
        <aside className="lg:sticky lg:top-24 lg:h-fit mb-6 lg:mb-0">
          <div className="hidden lg:block mb-6">
            <p className="text-xs uppercase tracking-widest text-gray-500">
              {t("Lotus Cinema", "Lotus Cinema")}
            </p>
            <h1 className="text-xl font-extrabold">{t("Manager", "អ្នកគ្រប់គ្រង")}</h1>
            <p className="text-xs text-gray-500 mt-1">{user.username}</p>
          </div>

          <nav className="flex lg:flex-col gap-1.5 overflow-x-auto lg:overflow-visible pb-1">
            {TABS.map((x) => {
              const on = tab === x.key;
              return (
                <button
                  key={x.key}
                  onClick={() => setTab(x.key)}
                  className={`flex-none flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition ${
                    on
                      ? "bg-red-600 text-white shadow-lg shadow-red-600/20"
                      : "text-gray-400 hover:text-white hover:bg-gray-900 border border-transparent"
                  }`}
                >
                  <x.icon className="w-4 h-4 flex-none" />
                  <span>{t(x.en, x.km)}</span>
                </button>
              );
            })}
          </nav>
        </aside>

        {/* ---------- Content ---------- */}
        <main className="min-w-0">
          <div className="flex items-center gap-2.5 mb-6">
            {active && <active.icon className="w-6 h-6 text-red-500" />}
            <h2 className="text-2xl font-extrabold">{active && t(active.en, active.km)}</h2>
          </div>

          {tab === "dashboard" && <Dashboard t={t} />}
          {tab === "movies" && <Movies t={t} />}
          {tab === "showtimes" && <Showtimes t={t} />}
          {tab === "food" && <Food t={t} />}
          {tab === "bookings" && <Bookings t={t} />}
          {tab === "reports" && <Reports t={t} />}
        </main>
      </div>
    </div>
  );
}

/* ---------- Dashboard ---------- */
function Dashboard({ t }) {
  const [d, setD] = useState(null);
  useEffect(() => {
    ManagerAPI.dashboard().then(setD);
  }, []);
  if (!d) return <Spin />;

  const maxRev = Math.max(1, ...d.byMovie.map((m) => m.revenue));
  const maxDay = Math.max(1, ...d.byDay.map((x) => x.revenue || 0));
  const avgTicket =
    d.totals.totalBookings > 0
      ? d.totals.totalRevenue / d.totals.totalBookings
      : 0;

  return (
    <div className="space-y-8">
      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat
          icon={DollarSign}
          tint="from-green-500/20 to-green-500/5"
          ring="ring-green-500/30"
          color="text-green-400"
          label={t("Total revenue", "ចំណូលសរុប")}
          val={`$${d.totals.totalRevenue.toFixed(2)}`}
          sub={`${t("avg", "មធ្យម")} $${avgTicket.toFixed(2)} / ${t("booking", "ការកក់")}`}
        />
        <Stat
          icon={Ticket}
          tint="from-red-500/20 to-red-500/5"
          ring="ring-red-500/30"
          color="text-red-400"
          label={t("Bookings", "ការកក់")}
          val={d.totals.totalBookings}
        />
        <Stat
          icon={Film}
          tint="from-purple-500/20 to-purple-500/5"
          ring="ring-purple-500/30"
          color="text-purple-400"
          label={t("Now showing", "កំពុងបញ្ចាំង")}
          val={d.totals.moviesShowing}
        />
        <Stat
          icon={Users}
          tint="from-blue-500/20 to-blue-500/5"
          ring="ring-blue-500/30"
          color="text-blue-400"
          label={t("Customers", "អតិថិជន")}
          val={d.totals.totalCustomers}
        />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Revenue by movie */}
        <Card
          title={t("Revenue by movie", "ចំណូលតាមភាពយន្ត")}
          icon={TrendingUp}
        >
          {d.byMovie.length === 0 ? (
            <Empty t={t} />
          ) : (
            <div className="space-y-3.5">
              {d.byMovie.slice(0, 8).map((m) => (
                <div key={m.title}>
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className="truncate pr-3 text-gray-300">{m.title}</span>
                    <span className="font-mono text-yellow-400 flex-none">
                      ${m.revenue.toFixed(2)}
                    </span>
                  </div>
                  <div className="bg-gray-800 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-red-600 to-yellow-500 h-full rounded-full transition-all duration-700"
                      style={{ width: `${(m.revenue / maxRev) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Revenue by day — mini bar chart */}
        <Card title={t("Revenue by day", "ចំណូលតាមថ្ងៃ")} icon={BarChart3}>
          {d.byDay.length === 0 ? (
            <Empty t={t} />
          ) : (
            <div className="flex items-end gap-2 h-40 pt-2">
              {d.byDay.slice(-14).map((x) => (
                <div key={x.day} className="flex-1 flex flex-col items-center gap-1.5 group">
                  <span className="text-[10px] text-gray-500 opacity-0 group-hover:opacity-100 transition">
                    ${Number(x.revenue).toFixed(0)}
                  </span>
                  <div
                    className="w-full bg-gradient-to-t from-red-600 to-red-400 rounded-t transition-all duration-500 hover:from-red-500 hover:to-red-300"
                    style={{
                      height: `${Math.max(4, (x.revenue / maxDay) * 100)}%`,
                    }}
                    title={`${x.day}: $${Number(x.revenue).toFixed(2)}`}
                  />
                  <span className="text-[9px] text-gray-600 truncate w-full text-center">
                    {String(x.day).slice(5)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

/* small building blocks */
const Card = ({ title, icon: Icon, children, action }) => (
  <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
    <div className="flex items-center justify-between mb-4">
      <h3 className="font-bold flex items-center gap-2 text-sm">
        {Icon && <Icon className="w-4 h-4 text-gray-500" />}
        {title}
      </h3>
      {action}
    </div>
    {children}
  </div>
);

const Empty = ({ t }) => (
  <p className="text-gray-500 text-sm py-6 text-center">
    {t("No data yet.", "មិនទាន់មានទិន្នន័យ។")}
  </p>
);

/* ---------- Movies CRUD ---------- */
function Movies({ t }) {
  const [movies, setMovies] = useState(null);
  const [genres, setGenres] = useState([]);
  const [editing, setEditing] = useState(null);
  const [filter, setFilter] = useState("ALL");

  const load = () => MoviesAPI.list().then(setMovies);
  useEffect(() => {
    load();
    MoviesAPI.genres().then(setGenres);
  }, []);

  if (!movies) return <Spin />;

  const archive = async (id) => {
    if (!confirm(t("Archive this movie?", "ទុកភាពយន្តនេះក្នុងប័ណ្ណសារ?"))) return;
    await MoviesAPI.archive(id);
    load();
  };

  return (
    <div>
      <div className="flex flex-wrap justify-between items-center gap-3 mb-4">
        <div className="flex gap-1.5">
          {["ALL", "NOW_SHOWING", "COMING_SOON", "ARCHIVED"].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`text-[11px] px-2.5 py-1.5 rounded-lg font-semibold transition ${
                filter === f ? "bg-red-600 text-white" : "bg-gray-800 text-gray-400 hover:text-white"
              }`}
            >
              {f === "ALL" ? t("All", "ទាំងអស់") : f.replace("_", " ")}
              <span className="ml-1 opacity-60">
                {f === "ALL" ? movies.length : movies.filter((m) => m.status === f).length}
              </span>
            </button>
          ))}
        </div>
        <button
          onClick={() => setEditing({})}
          className="bg-red-600 hover:bg-red-500 px-4 py-2 rounded-lg text-sm font-semibold"
        >
          + {t("Add movie", "បន្ថែមភាពយន្ត")}
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-gray-400 border-b border-gray-800">
            <tr>
              <th className="text-left py-2">{t("Title", "ចំណងជើង")}</th>
              <th className="text-left">{t("Genres", "ប្រភេទ")}</th>
              <th className="text-left">{t("Status", "ស្ថានភាព")}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {movies
              .filter((m) => filter === "ALL" || m.status === filter)
              .map((m) => (
              <tr key={m.id} className="border-b border-gray-900">
                <td className="py-2">{m.title}</td>
                <td className="text-gray-400">{m.genres.join(", ")}</td>
                <td>
                  <select
                    value={m.status}
                    onChange={async (e) => {
                      await MoviesAPI.update(m.id, { ...m, status: e.target.value });
                      load();
                    }}
                    className={`text-[11px] rounded px-2 py-1 border bg-gray-900 cursor-pointer ${
                      m.status === "NOW_SHOWING"
                        ? "border-green-600/50 text-green-400"
                        : m.status === "COMING_SOON"
                        ? "border-purple-600/50 text-purple-400"
                        : "border-gray-700 text-gray-500"
                    }`}
                  >
                    <option value="NOW_SHOWING">NOW_SHOWING</option>
                    <option value="COMING_SOON">COMING_SOON</option>
                    <option value="ARCHIVED">ARCHIVED</option>
                  </select>
                </td>
                <td className="text-right">
                  <button
                    onClick={() => setEditing(m)}
                    className="text-xs bg-gray-800 hover:bg-gray-700 px-3 py-1 rounded mr-2"
                  >
                    {t("Edit", "កែ")}
                  </button>
                  <button
                    onClick={() => archive(m.id)}
                    className="text-xs bg-gray-800 hover:bg-gray-700 px-3 py-1 rounded"
                  >
                    {t("Archive", "ទុក")}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && (
        <MovieForm
          t={t}
          movie={editing}
          genres={genres}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load();
          }}
        />
      )}
    </div>
  );
}

function MovieForm({ t, movie, genres, onClose, onSaved }) {
  const [f, setF] = useState({
    title: movie.title || "",
    titleKm: movie.titleKm || "",
    overview: movie.overview || "",
    runtime: movie.runtime || "",
    rating: movie.rating || "",
    releaseYear: movie.releaseYear || "",
    poster: movie.poster || "",
    banner: movie.banner || "",
    trailer: movie.trailer || "",
    status: movie.status || "NOW_SHOWING",
    basePrice: movie.basePrice || 6,
    genreIds: [],
  });
  const [err, setErr] = useState("");
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const toggleGenre = (id) =>
    setF((cur) => ({
      ...cur,
      genreIds: cur.genreIds.includes(id)
        ? cur.genreIds.filter((g) => g !== id)
        : [...cur.genreIds, id],
    }));

  const save = async () => {
    if (!f.title) {
      setErr(t("Title is required", "តម្រូវឲ្យមានចំណងជើង"));
      return;
    }
    try {
      if (movie.id) await MoviesAPI.update(movie.id, f);
      else await MoviesAPI.create(f);
      onSaved();
    } catch (e) {
      setErr(e.message);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-gray-900 rounded-2xl p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto border border-gray-700"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-xl font-bold mb-4">
          {movie.id ? t("Edit movie", "កែភាពយន្ត") : t("Add movie", "បន្ថែមភាពយន្ត")}
        </h2>
        {err && <p className="text-red-400 text-sm mb-3">{err}</p>}
        <div className="space-y-3">
          <Field label={t("Title", "ចំណងជើង")} value={f.title} onChange={set("title")} />
          <Field label={t("Khmer title", "ចំណងជើងខ្មែរ")} value={f.titleKm} onChange={set("titleKm")} />
          <div>
            <label className="text-xs text-gray-400">{t("Overview", "សេចក្តីសង្ខេប")}</label>
            <textarea
              value={f.overview}
              onChange={set("overview")}
              className="w-full bg-gray-800 rounded-lg p-2 text-sm mt-1"
            />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <Field label={t("Runtime", "រយៈពេល")} value={f.runtime} onChange={set("runtime")} />
            <Field label={t("Rating", "ពិន្ទុ")} value={f.rating} onChange={set("rating")} />
            <Field label={t("Year", "ឆ្នាំ")} value={f.releaseYear} onChange={set("releaseYear")} />
          </div>
          <Field label={t("Poster URL", "រូបផូស្ទ័រ")} value={f.poster} onChange={set("poster")} />
          <Field label={t("Banner URL", "រូបផ្ទាំង")} value={f.banner} onChange={set("banner")} />
          <Field label={t("Trailer URL", "វីដេអូ")} value={f.trailer} onChange={set("trailer")} />
          <div className="grid grid-cols-2 gap-2">
            <Field label={t("Base price", "តម្លៃមូលដ្ឋាន")} value={f.basePrice} onChange={set("basePrice")} />
            <div>
              <label className="text-xs text-gray-400">{t("Status", "ស្ថានភាព")}</label>
              <select
                value={f.status}
                onChange={set("status")}
                className="w-full bg-gray-800 rounded-lg p-2 text-sm mt-1"
              >
                <option value="NOW_SHOWING">NOW_SHOWING</option>
                <option value="COMING_SOON">COMING_SOON</option>
                <option value="ARCHIVED">ARCHIVED</option>
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-400">{t("Genres", "ប្រភេទ")}</label>
            <div className="flex flex-wrap gap-2 mt-1">
              {genres.map((g) => (
                <button
                  key={g.id}
                  onClick={() => toggleGenre(g.id)}
                  className={`text-xs px-2 py-1 rounded ${
                    f.genreIds.includes(g.id) ? "bg-red-600" : "bg-gray-800"
                  }`}
                >
                  {g.name}
                </button>
              ))}
            </div>
          </div>
          <button
            onClick={save}
            className="w-full bg-red-600 hover:bg-red-500 py-2 rounded-lg font-semibold"
          >
            {t("Save", "រក្សាទុក")}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------- Showtimes ---------- */
const SCREEN_TYPES = ["2D", "3D", "IMAX", "4DX", "VIP"];

function Showtimes({ t }) {
  const [movies, setMovies] = useState([]);
  const [halls, setHalls] = useState([]);
  const [movieId, setMovieId] = useState("");
  const [date, setDate] = useState("");
  const [basePrice, setBasePrice] = useState(6);
  // one row per hall the movie should play in: { hallId, time, screenType }
  const [rows, setRows] = useState([{ hallId: "", time: "18:30", screenType: "2D" }]);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const load = () => {
    MoviesAPI.list({ status: "NOW_SHOWING" }).then((m) => {
      setMovies(m);
      if (m[0]) setMovieId((cur) => cur || m[0].id);
    });
    ShowtimesAPI.halls().then((h) => {
      setHalls(h);
      if (h[0]) setRows((cur) => cur.map((r) => (r.hallId ? r : { ...r, hallId: h[0].hall_id })));
    });
  };
  useEffect(() => {
    load();
  }, []);

  const addRow = () =>
    setRows((cur) => [
      ...cur,
      { hallId: halls[0]?.hall_id || "", time: "18:30", screenType: "2D" },
    ]);
  const removeRow = (i) => setRows((cur) => cur.filter((_, idx) => idx !== i));
  const setRow = (i, k, v) =>
    setRows((cur) => cur.map((r, idx) => (idx === i ? { ...r, [k]: v } : r)));

  const save = async () => {
    setMsg("");
    if (!date) return setMsg(t("Pick a date", "ជ្រើសកាលបរិច្ឆេទ"));
    if (!rows.length) return setMsg(t("Add at least one hall", "បន្ថែមសាលយ៉ាងតិចមួយ"));
    setBusy(true);
    let ok = 0;
    const fails = [];
    for (const r of rows) {
      try {
        await ShowtimesAPI.create({
          movieId: Number(movieId),
          hallId: Number(r.hallId),
          date,
          time: r.time,
          basePrice: Number(basePrice),
          screenType: r.screenType,
        });
        ok++;
      } catch (e) {
        fails.push(e.message);
      }
    }
    setBusy(false);
    const movieName = movies.find((m) => m.id === Number(movieId))?.title || "";
    setMsg(
      t(
        `${movieName}: created ${ok} showtime(s) across ${rows.length} hall(s) ✓` +
          (fails.length ? ` — ${fails.length} failed` : ""),
        `${movieName}: បង្កើត ${ok} ម៉ោង ✓`
      )
    );
  };

  const hallLabel = (h) =>
    `${h.hall_name} · ${t("Floor", "ជាន់")} ${h.floor} · ${h.capacity} ${t("seats", "កៅអី")}`;

  return (
    <div className="max-w-3xl">
      <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800">
      <h2 className="text-lg font-bold mb-1">
        {t("Schedule a movie in multiple halls", "កំណត់ម៉ោងភាពយន្តក្នុងសាលច្រើន")}
      </h2>
      <p className="text-xs text-gray-500 mb-4">
        {t(
          "Pick a movie and a date, then add a row for each hall it should play in.",
          "ជ្រើសភាពយន្ត និងកាលបរិច្ឆេទ បន្ទាប់មកបន្ថែមជួរសម្រាប់សាលនីមួយៗ។"
        )}
      </p>

      <div className="space-y-3">
        <div className="grid sm:grid-cols-3 gap-2">
          <div className="sm:col-span-1">
            <label className="text-xs text-gray-400">{t("Movie", "ភាពយន្ត")}</label>
            <select
              value={movieId}
              onChange={(e) => setMovieId(e.target.value)}
              className="w-full bg-gray-800 rounded-lg p-2 text-sm mt-1"
            >
              {movies.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.title}
                </option>
              ))}
            </select>
          </div>
          <Field
            label={t("Date", "កាលបរិច្ឆេទ")}
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
          <Field
            label={t("Base price ($)", "តម្លៃ ($)")}
            value={basePrice}
            onChange={(e) => setBasePrice(e.target.value)}
          />
        </div>

        {/* per-hall rows */}
        <div className="space-y-2">
          <label className="text-xs text-gray-400">{t("Halls & times", "សាល និងម៉ោង")}</label>
          {rows.map((r, i) => (
            <div key={i} className="flex gap-2 items-center bg-gray-950/50 rounded-lg p-2">
              <select
                value={r.hallId}
                onChange={(e) => setRow(i, "hallId", e.target.value)}
                className="flex-1 bg-gray-800 rounded-lg p-2 text-xs"
              >
                {halls.map((h) => (
                  <option key={h.hall_id} value={h.hall_id}>
                    {hallLabel(h)}
                  </option>
                ))}
              </select>
              <input
                type="time"
                value={r.time}
                onChange={(e) => setRow(i, "time", e.target.value)}
                className="bg-gray-800 rounded-lg p-2 text-xs w-24"
              />
              <select
                value={r.screenType}
                onChange={(e) => setRow(i, "screenType", e.target.value)}
                className="bg-gray-800 rounded-lg p-2 text-xs w-20"
              >
                {SCREEN_TYPES.map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>
              {rows.length > 1 && (
                <button
                  onClick={() => removeRow(i)}
                  className="text-gray-500 hover:text-red-500 px-1 text-lg"
                  title={t("Remove", "លុប")}
                >
                  ×
                </button>
              )}
            </div>
          ))}
          <button
            onClick={addRow}
            className="text-xs text-red-400 hover:text-red-300 font-semibold"
          >
            + {t("Add another hall", "បន្ថែមសាលមួយទៀត")}
          </button>
        </div>

        <button
          onClick={save}
          disabled={busy}
          className="w-full bg-red-600 hover:bg-red-500 disabled:opacity-50 py-2 rounded-lg font-semibold mt-2"
        >
          {busy
            ? t("Creating…", "កំពុងបង្កើត…")
            : t(`Create ${rows.length} showtime(s)`, `បង្កើត ${rows.length} ម៉ោង`)}
        </button>
        {msg && <p className="text-sm text-green-400">{msg}</p>}
      </div>
      </div>

      {/* ---------- existing showtimes ---------- */}
      <ShowtimeList t={t} refreshKey={msg} />
    </div>
  );
}

/* ---------- list / edit / delete existing showtimes ---------- */
function ShowtimeList({ t, refreshKey }) {
  const [view, setView] = useState("week");   // 'week' | 'list'
  const [weekStart, setWeekStart] = useState(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState("");
  const [editing, setEditing] = useState(null);

  const iso = (d) => {
    const x = new Date(d);
    return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(
      x.getDate()
    ).padStart(2, "0")}`;
  };
  const addDays = (d, n) => {
    const x = new Date(d);
    x.setDate(x.getDate() + n);
    return x;
  };

  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const load = () => {
    setErr("");
    if (view === "week") {
      ShowtimesAPI.calendar(iso(days[0]), iso(days[6]))
        .then(setRows)
        .catch((e) => setErr(e.message));
    } else {
      ShowtimesAPI.list().then(setRows).catch((e) => setErr(e.message));
    }
  };
  useEffect(() => {
    load();
  }, [refreshKey, view, weekStart]);

  const del = async (r) => {
    if (!confirm(t(`Delete ${r.title} at ${r.start_time}?`, "លុបម៉ោងបញ្ចាំងនេះ?"))) return;
    try {
      await ShowtimesAPI.remove(r.showtime_id);
      load();
    } catch (e) {
      setErr(e.message);
    }
  };

  const saveEdit = async () => {
    try {
      await ShowtimesAPI.update(editing.showtime_id, {
        date: editing.show_date,
        time: editing.start_time,
        basePrice: editing.base_price,
        screenType: editing.screen_type,
      });
      setEditing(null);
      load();
    } catch (e) {
      setErr(e.message);
    }
  };

  if (!rows) return <Spin />;

  const screenTint = (s) =>
    s === "IMAX"
      ? "border-blue-500/50 bg-blue-500/10"
      : s === "3D"
      ? "border-purple-500/50 bg-purple-500/10"
      : s === "4DX"
      ? "border-orange-500/50 bg-orange-500/10"
      : s === "VIP"
      ? "border-yellow-500/50 bg-yellow-500/10"
      : "border-gray-700 bg-gray-800/60";

  const forDay = (d) => rows.filter((r) => String(r.show_date).slice(0, 10) === iso(d));
  const isToday = (d) => iso(d) === iso(new Date());

  return (
    <div className="mt-6 bg-gray-900 border border-gray-800 rounded-2xl p-5">
      {/* header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h3 className="font-bold text-sm">
            {t("Schedule", "កាលវិភាគ")}
          </h3>
          <p className="text-xs text-gray-500">
            {t(
              "Showtimes with sold seats can't be deleted.",
              "ម៉ោងដែលមានលក់កៅអីរួច មិនអាចលុបបានទេ។"
            )}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {view === "week" && (
            <>
              <button
                onClick={() => setWeekStart(addDays(weekStart, -7))}
                className="px-2.5 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-xs"
              >
                ‹
              </button>
              <button
                onClick={() => {
                  const d = new Date();
                  d.setHours(0, 0, 0, 0);
                  setWeekStart(d);
                }}
                className="px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-[11px] font-semibold"
              >
                {t("Today", "ថ្ងៃនេះ")}
              </button>
              <button
                onClick={() => setWeekStart(addDays(weekStart, 7))}
                className="px-2.5 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-xs"
              >
                ›
              </button>
            </>
          )}
          <div className="flex rounded-lg overflow-hidden border border-gray-800">
            {["week", "list"].map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`px-3 py-1.5 text-[11px] font-semibold ${
                  view === v ? "bg-red-600 text-white" : "bg-gray-800 text-gray-400"
                }`}
              >
                {v === "week" ? t("Week", "សប្តាហ៍") : t("List", "បញ្ជី")}
              </button>
            ))}
          </div>
        </div>
      </div>

      {err && <p className="text-red-400 text-xs mb-3">{err}</p>}

      {/* ---------- WEEK VIEW ---------- */}
      {view === "week" && (
        <>
          <p className="text-xs text-gray-500 mb-3">
            {days[0].toLocaleDateString()} — {days[6].toLocaleDateString()} ·{" "}
            <span className="text-gray-400">
              {rows.length} {t("showtimes", "ម៉ោងបញ្ចាំង")}
            </span>
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
            {days.map((d) => {
              const list = forDay(d);
              return (
                <div
                  key={iso(d)}
                  className={`rounded-xl border p-2 min-h-[130px] ${
                    isToday(d)
                      ? "border-red-600/60 bg-red-600/5"
                      : "border-gray-800 bg-gray-950/40"
                  }`}
                >
                  <div className="text-center mb-2 pb-1.5 border-b border-gray-800">
                    <p className="text-[10px] uppercase text-gray-500">
                      {isToday(d)
                        ? t("Today", "ថ្ងៃនេះ")
                        : d.toLocaleDateString("en-US", { weekday: "short" })}
                    </p>
                    <p
                      className={`text-lg font-extrabold leading-none ${
                        isToday(d) ? "text-red-500" : ""
                      }`}
                    >
                      {d.getDate()}
                    </p>
                  </div>

                  {list.length === 0 ? (
                    <p className="text-[10px] text-gray-700 text-center pt-3">—</p>
                  ) : (
                    <div className="space-y-1.5">
                      {list.map((r) => (
                        <div
                          key={r.showtime_id}
                          className={`group rounded-lg border px-2 py-1.5 ${screenTint(
                            r.screen_type
                          )}`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold">{r.start_time}</span>
                            <span className="text-[9px] opacity-70">{r.screen_type}</span>
                          </div>
                          <p className="text-[10px] truncate text-gray-300" title={r.title}>
                            {r.title}
                          </p>
                          <p className="text-[9px] text-gray-500 truncate">
                            {r.hall_name} · {r.sold}/{r.capacity}
                          </p>
                          <div className="flex gap-1 mt-1 opacity-0 group-hover:opacity-100 transition">
                            <button
                              onClick={() => setEditing({ ...r })}
                              className="text-[9px] px-1.5 py-0.5 rounded bg-gray-800 hover:bg-gray-700"
                            >
                              {t("Edit", "កែ")}
                            </button>
                            <button
                              onClick={() => del(r)}
                              className="text-[9px] px-1.5 py-0.5 rounded bg-gray-800 hover:bg-red-600"
                            >
                              {t("Del", "លុប")}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* ---------- LIST VIEW ---------- */}
      {view === "list" && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-gray-500 border-b border-gray-800 text-xs">
              <tr>
                <th className="text-left py-2 font-medium">{t("Movie", "ភាពយន្ត")}</th>
                <th className="text-left font-medium">{t("Hall", "សាល")}</th>
                <th className="text-left font-medium">{t("When", "ពេលណា")}</th>
                <th className="text-center font-medium">{t("Screen", "អេក្រង់")}</th>
                <th className="text-center font-medium">{t("Sold", "លក់រួច")}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.showtime_id} className="border-b border-gray-900/70">
                  <td className="py-2.5 pr-2 truncate max-w-[160px]">{r.title}</td>
                  <td className="text-gray-400 text-xs">
                    {r.hall_name}
                    <span className="text-gray-600"> · F{r.floor}</span>
                  </td>
                  <td className="text-gray-400 text-xs">
                    {String(r.show_date).slice(0, 10)} {r.start_time}
                  </td>
                  <td className="text-center">
                    <span className="text-[10px] bg-gray-800 border border-gray-700 rounded px-1.5 py-0.5">
                      {r.screen_type}
                    </span>
                  </td>
                  <td className="text-center text-xs">
                    <span className={r.sold > 0 ? "text-green-400" : "text-gray-600"}>
                      {r.sold}/{r.capacity}
                    </span>
                  </td>
                  <td className="text-right whitespace-nowrap">
                    <button
                      onClick={() => setEditing({ ...r })}
                      className="text-gray-400 hover:text-white p-1.5"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => del(r)}
                      className="text-gray-400 hover:text-red-500 p-1.5"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center text-gray-500 py-6">
                    {t("No showtimes yet.", "មិនទាន់មានម៉ោងបញ្ចាំង។")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* edit modal */}
      {editing && (
        <div
          className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
          onClick={() => setEditing(null)}
        >
          <div
            className="bg-gray-900 rounded-2xl p-6 w-full max-w-sm border border-gray-700"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-bold mb-1">{t("Edit showtime", "កែម៉ោងបញ្ចាំង")}</h3>
            <p className="text-xs text-gray-500 mb-4">
              {editing.title} · {editing.hall_name}
            </p>
            <div className="space-y-3">
              <Field
                label={t("Date", "កាលបរិច្ឆេទ")}
                type="date"
                value={String(editing.show_date).slice(0, 10)}
                onChange={(e) => setEditing({ ...editing, show_date: e.target.value })}
              />
              <Field
                label={t("Time", "ម៉ោង")}
                type="time"
                value={editing.start_time}
                onChange={(e) => setEditing({ ...editing, start_time: e.target.value })}
              />
              <Field
                label={t("Base price ($)", "តម្លៃ ($)")}
                value={editing.base_price}
                onChange={(e) => setEditing({ ...editing, base_price: e.target.value })}
              />
              <div>
                <label className="text-xs text-gray-400">{t("Screen", "អេក្រង់")}</label>
                <select
                  value={editing.screen_type}
                  onChange={(e) => setEditing({ ...editing, screen_type: e.target.value })}
                  className="w-full bg-gray-800 rounded-lg p-2 text-sm mt-1"
                >
                  {SCREEN_TYPES.map((x) => (
                    <option key={x} value={x}>
                      {x}
                    </option>
                  ))}
                </select>
              </div>
              <button
                onClick={saveEdit}
                className="w-full bg-red-600 hover:bg-red-500 py-2 rounded-lg font-semibold"
              >
                {t("Save", "រក្សាទុក")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- Food / concessions ---------- */
function Food({ t }) {
  const [items, setItems] = useState(null);
  const [editing, setEditing] = useState(null);
  const [err, setErr] = useState("");

  const load = () =>
    ConcessionsAPI.listAll()
      .then(setItems)
      .catch((e) => setErr(e.message));
  useEffect(() => {
    load();
  }, []);

  if (err) return <p className="text-red-400 text-sm">{err}</p>;
  if (!items) return <Spin />;

  const toggle = async (item) => {
    try {
      await ConcessionsAPI.update(item.id, { ...item, available: !item.available });
      load();
    } catch (e) {
      setErr(e.message);
    }
  };

  const cats = ["POPCORN", "DRINK", "SNACK", "COMBO"];
  const onSale = items.filter((i) => i.available).length;

  return (
    <div>
      <div className="flex flex-wrap justify-between items-center gap-3 mb-5">
        <p className="text-sm text-gray-400">
          <span className="text-green-400 font-semibold">{onSale}</span> {t("on sale", "កំពុងលក់")}{" "}
          / {items.length} {t("items", "មុខ")}
        </p>
        <button
          onClick={() => setEditing({})}
          className="bg-red-600 hover:bg-red-500 px-4 py-2 rounded-lg text-sm font-semibold"
        >
          + {t("Add item", "បន្ថែមមុខម្ហូប")}
        </button>
      </div>

      {cats.map((c) => {
        const rows = items.filter((i) => i.category === c);
        if (!rows.length) return null;
        return (
          <div key={c} className="mb-6">
            <h3 className="text-xs font-bold text-gray-500 mb-2 uppercase tracking-wide">
              {c}
              <span className="ml-2 text-gray-600 font-normal">({rows.length})</span>
            </h3>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {rows.map((i) => (
                <div
                  key={i.id}
                  className={`flex gap-3 items-center rounded-xl p-3 border transition ${
                    i.available
                      ? "bg-gray-900 border-gray-800"
                      : "bg-gray-950 border-gray-900 opacity-50"
                  }`}
                >
                  {i.image && (
                    <img
                      src={i.image}
                      alt=""
                      className="w-12 h-12 rounded-lg object-cover flex-none"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{i.name}</p>
                    {i.nameKm && (
                      <p className="text-xs text-gray-500 truncate">{i.nameKm}</p>
                    )}
                    <p className="text-sm text-yellow-400 font-mono">
                      ${Number(i.price).toFixed(2)}
                      {i.size && <span className="text-gray-600 text-xs"> · {i.size}</span>}
                    </p>
                  </div>
                  <div className="flex flex-col gap-1 flex-none">
                    <button
                      onClick={() => setEditing(i)}
                      className="text-[11px] bg-gray-800 hover:bg-gray-700 px-2 py-1 rounded"
                    >
                      {t("Edit", "កែ")}
                    </button>
                    <button
                      onClick={() => toggle(i)}
                      className={`text-[11px] px-2 py-1 rounded ${
                        i.available
                          ? "bg-gray-800 hover:bg-gray-700"
                          : "bg-green-700 hover:bg-green-600"
                      }`}
                    >
                      {i.available ? t("Hide", "លាក់") : t("Show", "បង្ហាញ")}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}

      {editing && (
        <FoodForm
          t={t}
          item={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load();
          }}
        />
      )}
    </div>
  );
}

function FoodForm({ t, item, onClose, onSaved }) {
  const [f, setF] = useState({
    name: item.name || "",
    nameKm: item.nameKm || "",
    category: item.category || "POPCORN",
    size: item.size || "",
    price: item.price ?? "",
    image: item.image || "",
    description: item.description || "",
    available: item.available !== false,
  });
  const [err, setErr] = useState("");
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const save = async () => {
    if (!f.name || f.price === "") {
      setErr(t("Name and price are required", "តម្រូវឲ្យមានឈ្មោះ និងតម្លៃ"));
      return;
    }
    try {
      const payload = { ...f, price: Number(f.price), size: f.size || null };
      if (item.id) await ConcessionsAPI.update(item.id, payload);
      else await ConcessionsAPI.create(payload);
      onSaved();
    } catch (e) {
      setErr(e.message);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-gray-900 rounded-2xl p-6 max-w-md w-full max-h-[90vh] overflow-y-auto border border-gray-700"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-xl font-bold mb-4">
          {item.id ? t("Edit item", "កែមុខម្ហូប") : t("Add item", "បន្ថែមមុខម្ហូប")}
        </h2>
        {err && <p className="text-red-400 text-sm mb-3">{err}</p>}
        <div className="space-y-3">
          <Field label={t("Name", "ឈ្មោះ")} value={f.name} onChange={set("name")} />
          <Field label={t("Khmer name", "ឈ្មោះខ្មែរ")} value={f.nameKm} onChange={set("nameKm")} />
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-gray-400">{t("Category", "ប្រភេទ")}</label>
              <select
                value={f.category}
                onChange={set("category")}
                className="w-full bg-gray-800 rounded-lg p-2 text-sm mt-1"
              >
                <option value="POPCORN">POPCORN</option>
                <option value="DRINK">DRINK</option>
                <option value="SNACK">SNACK</option>
                <option value="COMBO">COMBO</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-400">{t("Size", "ទំហំ")}</label>
              <select
                value={f.size}
                onChange={set("size")}
                className="w-full bg-gray-800 rounded-lg p-2 text-sm mt-1"
              >
                <option value="">—</option>
                <option value="SMALL">SMALL</option>
                <option value="MEDIUM">MEDIUM</option>
                <option value="LARGE">LARGE</option>
              </select>
            </div>
          </div>
          <Field label={t("Price ($)", "តម្លៃ ($)")} value={f.price} onChange={set("price")} />
          <Field label={t("Image URL", "រូបភាព")} value={f.image} onChange={set("image")} />
          <Field
            label={t("Description", "ការពិពណ៌នា")}
            value={f.description}
            onChange={set("description")}
          />
          <button
            onClick={save}
            className="w-full bg-red-600 hover:bg-red-500 py-2 rounded-lg font-semibold"
          >
            {t("Save", "រក្សាទុក")}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------- Bookings ---------- */
function Bookings({ t }) {
  const [rows, setRows] = useState(null);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("ALL");

  useEffect(() => {
    ManagerAPI.bookings().then(setRows);
  }, []);
  if (!rows) return <Spin />;

  const filtered = rows.filter((b) => {
    if (status !== "ALL" && b.status !== status) return false;
    if (!q) return true;
    const hay = `${b.booking_ref} ${b.username} ${b.title}`.toLowerCase();
    return hay.includes(q.toLowerCase());
  });

  const confirmed = rows.filter((b) => b.status === "CONFIRMED");
  const revenue = confirmed.reduce((a, b) => a + Number(b.total_price || 0), 0);
  const seats = confirmed.reduce((a, b) => a + Number(b.seats || 0), 0);

  return (
    <div className="space-y-4">
      {/* quick totals */}
      <div className="grid grid-cols-3 gap-3">
        <MiniStat label={t("Confirmed", "បានបញ្ជាក់")} val={confirmed.length} />
        <MiniStat label={t("Seats sold", "កៅអីលក់")} val={seats} />
        <MiniStat label={t("Revenue", "ចំណូល")} val={`$${revenue.toFixed(2)}`} accent />
      </div>

      {/* filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t("Search ref, user or movie…", "ស្វែងរក…")}
          className="flex-1 min-w-[200px] bg-gray-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-red-500"
        />
        {["ALL", "CONFIRMED", "CANCELLED"].map((f) => (
          <button
            key={f}
            onClick={() => setStatus(f)}
            className={`text-[11px] px-3 py-2 rounded-lg font-semibold transition ${
              status === f ? "bg-red-600 text-white" : "bg-gray-800 text-gray-400 hover:text-white"
            }`}
          >
            {f === "ALL" ? t("All", "ទាំងអស់") : f}
          </button>
        ))}
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-gray-500 border-b border-gray-800 text-xs">
              <tr>
                <th className="text-left py-3 px-4 font-medium">{t("Ref", "លេខ")}</th>
                <th className="text-left font-medium">{t("Customer", "អតិថិជន")}</th>
                <th className="text-left font-medium">{t("Movie", "ភាពយន្ត")}</th>
                <th className="text-left font-medium">{t("Screening", "ការបញ្ចាំង")}</th>
                <th className="text-center font-medium">{t("Seats", "កៅអី")}</th>
                <th className="text-center font-medium">{t("Food", "អាហារ")}</th>
                <th className="text-right font-medium">{t("Total", "សរុប")}</th>
                <th className="text-center font-medium pr-4">{t("Status", "ស្ថានភាព")}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((b) => (
                <tr key={b.booking_id} className="border-b border-gray-900/70 hover:bg-gray-950/40">
                  <td className="py-3 px-4 font-mono text-xs text-gray-400">{b.booking_ref}</td>
                  <td className="text-gray-300">{b.username}</td>
                  <td className="truncate max-w-[150px]">{b.title}</td>
                  <td className="text-xs text-gray-400">
                    {b.show_date} {b.start_time}
                    <span className="text-gray-600"> · {b.hall_name}</span>
                  </td>
                  <td className="text-center">{b.seats}</td>
                  <td className="text-center text-gray-400">{b.food_items || "—"}</td>
                  <td className="text-right font-mono text-yellow-400">
                    ${Number(b.total_price || 0).toFixed(2)}
                  </td>
                  <td className="text-center pr-4">
                    <span
                      className={`text-[10px] px-2 py-1 rounded-full border ${
                        b.status === "CONFIRMED"
                          ? "border-green-600/40 text-green-400 bg-green-600/10"
                          : "border-gray-700 text-gray-500"
                      }`}
                    >
                      {b.status}
                    </span>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-center text-gray-500 py-8">
                    {t("No bookings match.", "រកមិនឃើញការកក់។")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ---------- Reports ---------- */

// Which sections can be included in a printed report.
const REPORT_SECTIONS = [
  { key: "split",     en: "Revenue split",          km: "ការបែងចែកចំណូល" },
  { key: "halls",     en: "Seats sold per room",    km: "កៅអីលក់តាមសាល" },
  { key: "seats",     en: "Seat types & screens",   km: "ប្រភេទកៅអី និងអេក្រង់" },
  { key: "food",      en: "Food & drink sales",     km: "ការលក់អាហារ" },
  { key: "occupancy", en: "Occupancy by screening", km: "អត្រាកៅអី" },
  { key: "customers", en: "Top customers",          km: "អតិថិជនកំពូល" },
];

function Reports({ t }) {
  const [r, setR] = useState(null);
  const [occ, setOcc] = useState(null);
  // every section on by default; the manager unticks what they don't need
  const [show, setShow] = useState(
    Object.fromEntries(REPORT_SECTIONS.map((s) => [s.key, true]))
  );

  useEffect(() => {
    ManagerAPI.reports().then(setR);
    ManagerAPI.occupancy().then(setOcc);
  }, []);
  if (!r || !occ) return <Spin />;

  const toggle = (k) => setShow((s) => ({ ...s, [k]: !s[k] }));
  const allOn = REPORT_SECTIONS.every((s) => show[s.key]);
  const setAll = (v) =>
    setShow(Object.fromEntries(REPORT_SECTIONS.map((s) => [s.key, v])));

  const totalRev = r.split.ticketRevenue + r.split.foodRevenue;
  const ticketPct = totalRev ? (r.split.ticketRevenue / totalRev) * 100 : 0;
  const maxHall = Math.max(1, ...r.byHall.map((h) => h.revenue));
  const soldFood = r.food.filter((f) => f.units_sold > 0);
  const printedOn = new Date().toLocaleString();

  return (
    <div className="space-y-6">
      {/* ---------- print controls (never printed themselves) ---------- */}
      <div className="no-print bg-gray-900 border border-gray-800 rounded-2xl p-4">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <div>
            <h3 className="font-bold text-sm flex items-center gap-2">
              <Printer className="w-4 h-4 text-gray-500" />
              {t("Print report", "បោះពុម្ពរបាយការណ៍")}
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              {t(
                "Tick the sections you want, then print or save as PDF.",
                "ជ្រើសផ្នែកដែលចង់បាន បន្ទាប់មកបោះពុម្ព ឬរក្សាទុកជា PDF។"
              )}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setAll(!allOn)}
              className="text-[11px] px-3 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 font-semibold"
            >
              {allOn ? t("Clear all", "ដកទាំងអស់") : t("Select all", "ជ្រើសទាំងអស់")}
            </button>
            <button
              onClick={() => window.print()}
              className="flex items-center gap-2 text-[11px] px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 font-semibold"
            >
              <Printer className="w-3.5 h-3.5" />
              {t("Print / Save PDF", "បោះពុម្ព / រក្សាទុក PDF")}
            </button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {REPORT_SECTIONS.map((sec) => (
            <button
              key={sec.key}
              onClick={() => toggle(sec.key)}
              className={`flex items-center gap-1.5 text-[11px] px-3 py-1.5 rounded-full border transition ${
                show[sec.key]
                  ? "bg-green-600/15 border-green-600/50 text-green-400"
                  : "bg-gray-800 border-gray-700 text-gray-500 hover:text-gray-300"
              }`}
            >
              {show[sec.key] && <Check className="w-3 h-3" />}
              {t(sec.en, sec.km)}
            </button>
          ))}
        </div>
      </div>

      {/* ---------- everything below is what gets printed ---------- */}
      <div className="print-area space-y-6">
        {/* letterhead: hidden on screen, shown on paper */}
        <div className="print-header" style={{ marginBottom: "8mm" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-end",
              borderBottom: "2px solid #000",
              paddingBottom: "4mm",
            }}
          >
            <div>
              <h1 style={{ fontSize: "20pt", fontWeight: 800, margin: 0 }}>
                Lotus Cinema
              </h1>
              <p style={{ fontSize: "11pt", margin: "2px 0 0" }}>
                Management Report · របាយការណ៍គ្រប់គ្រង
              </p>
            </div>
            <div style={{ textAlign: "right", fontSize: "9pt" }}>
              <p style={{ margin: 0 }}>Printed · បោះពុម្ព</p>
              <p style={{ margin: 0, fontWeight: 700 }}>{printedOn}</p>
            </div>
          </div>
        </div>

        {/* revenue split */}
        {show.split && (
          <Card
            title={`${t("Where the money comes from", "ចំណូលមកពីណា")}`}
            icon={DollarSign}
          >
            <p className="hidden print:block text-xs mb-2">ចំណូលមកពីណា</p>
            <div className="flex items-end gap-6 mb-3">
              <div>
                <p className="text-2xl font-extrabold text-yellow-400">
                  ${r.split.ticketRevenue.toFixed(2)}
                </p>
                <p className="text-xs text-gray-500">{t("Tickets", "សំបុត្រ")} / Tickets</p>
              </div>
              <div>
                <p className="text-2xl font-extrabold text-green-400">
                  ${r.split.foodRevenue.toFixed(2)}
                </p>
                <p className="text-xs text-gray-500">{t("Food & drink", "អាហារ")} / Food</p>
              </div>
              <div className="ml-auto text-right">
                <p className="text-2xl font-extrabold">${totalRev.toFixed(2)}</p>
                <p className="text-xs text-gray-500">{t("Total", "សរុប")} / Total</p>
              </div>
            </div>
            <div className="flex h-3 rounded-full overflow-hidden bg-gray-800">
              <div className="bg-yellow-500" style={{ width: `${ticketPct}%` }} />
              <div className="bg-green-500" style={{ width: `${100 - ticketPct}%` }} />
            </div>
          </Card>
        )}

        <div className="grid lg:grid-cols-2 gap-6 print:block">
          {/* seats sold per room */}
          {show.halls && (
            <Card
              title={`${t("Seats sold per room", "កៅអីលក់តាមសាល")}`}
              icon={LayoutDashboard}
            >
              <div className="space-y-3">
                {r.byHall.map((h) => {
                  const pct = h.seats_offered
                    ? Math.round((h.seats_sold / h.seats_offered) * 100)
                    : 0;
                  return (
                    <div key={h.hall_id}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-gray-300">
                          {h.hall_name}
                          <span className="text-gray-600">
                            {" "}
                            · {t("Floor", "ជាន់")} {h.floor} · {h.capacity}{" "}
                            {t("seats", "កៅអី")}
                          </span>
                        </span>
                        <span className="font-mono text-yellow-400">
                          ${Number(h.revenue).toFixed(2)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-gray-800 rounded-full h-2 overflow-hidden">
                          <div
                            className="bg-gradient-to-r from-red-600 to-yellow-500 h-full"
                            style={{ width: `${(h.revenue / maxHall) * 100}%` }}
                          />
                        </div>
                        <span className="text-[10px] text-gray-500 w-24 text-right">
                          {h.seats_sold}/{h.seats_offered} ({pct}%)
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}

          {/* seat types + screens */}
          {show.seats && (
            <Card
              title={`${t("Seat types & screens", "ប្រភេទកៅអី និងអេក្រង់")}`}
              icon={BarChart3}
            >
              <p className="text-[11px] text-gray-500 mb-2">
                {t("By seat class", "តាមថ្នាក់កៅអី")}
              </p>
              <table className="w-full text-xs mb-4">
                <tbody>
                  {r.bySeatType.map((s) => (
                    <tr key={s.seat_type} className="border-b border-gray-900/60">
                      <td className="py-1.5">{s.seat_type}</td>
                      <td className="text-right text-gray-400">
                        {s.sold}/{s.offered}
                      </td>
                      <td className="text-right font-mono text-yellow-400 w-20">
                        ${Number(s.revenue).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <p className="text-[11px] text-gray-500 mb-2">
                {t("By screen format", "តាមអេក្រង់")}
              </p>
              <table className="w-full text-xs">
                <tbody>
                  {r.byScreen.map((s) => (
                    <tr key={s.screen_type} className="border-b border-gray-900/60">
                      <td className="py-1.5">
                        <span className="text-[10px] bg-gray-800 border border-gray-700 rounded px-1.5 py-0.5">
                          {s.screen_type}
                        </span>
                      </td>
                      <td className="text-right text-gray-400">
                        {s.sold} {t("seats", "កៅអី")}
                      </td>
                      <td className="text-right font-mono text-yellow-400 w-20">
                        ${Number(s.revenue).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}
        </div>

        {/* food */}
        {show.food && (
          <Card
            title={`${t("Food & drink sales", "ការលក់អាហារ")}`}
            icon={Popcorn}
            action={
              <span className="text-xs text-gray-500">
                {soldFood.length}/{r.food.length} {t("items sold", "មុខលក់បាន")}
              </span>
            }
          >
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="text-gray-500 border-b border-gray-800">
                  <tr>
                    <th className="text-left py-2 font-medium">{t("Item", "មុខម្ហូប")}</th>
                    <th className="text-left font-medium">{t("Category", "ប្រភេទ")}</th>
                    <th className="text-right font-medium">{t("Price", "តម្លៃ")}</th>
                    <th className="text-right font-medium">{t("Sold", "លក់")}</th>
                    <th className="text-right font-medium">{t("Revenue", "ចំណូល")}</th>
                    <th className="text-center font-medium">{t("Status", "ស្ថានភាព")}</th>
                  </tr>
                </thead>
                <tbody>
                  {r.food.map((f) => (
                    <tr key={f.item_id} className="border-b border-gray-900/60">
                      <td className="py-2">
                        {f.name}
                        {f.item_size && <span className="text-gray-600"> · {f.item_size}</span>}
                      </td>
                      <td className="text-gray-500">{f.category}</td>
                      <td className="text-right text-gray-400">
                        ${Number(f.price).toFixed(2)}
                      </td>
                      <td className="text-right">
                        {f.units_sold > 0 ? (
                          <span className="text-green-400 font-semibold">{f.units_sold}</span>
                        ) : (
                          <span className="text-gray-700">0</span>
                        )}
                      </td>
                      <td className="text-right font-mono text-yellow-400">
                        ${Number(f.revenue).toFixed(2)}
                      </td>
                      <td className="text-center">
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full ${
                            f.available
                              ? "text-green-400 bg-green-600/10 border border-green-600/30"
                              : "text-gray-500 bg-gray-800"
                          }`}
                        >
                          {f.available ? t("On sale", "លក់") : t("Hidden", "លាក់")}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        <div className="grid lg:grid-cols-2 gap-6 print:block">
          {/* occupancy */}
          {show.occupancy && (
            <Card
              title={`${t("Occupancy by screening", "អត្រាកៅអីតាមការបញ្ចាំង")}`}
              icon={TrendingUp}
            >
              <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                {occ.map((o) => (
                  <div key={o.showtime_id}>
                    <div className="flex justify-between text-[11px] mb-1">
                      <span className="truncate pr-2 text-gray-300">
                        {o.title}
                        <span className="text-gray-600">
                          {" "}
                          · {o.hall_name} · {o.start_time}
                        </span>
                      </span>
                      <span className="text-gray-400 flex-none">
                        {o.sold}/{o.total}
                      </span>
                    </div>
                    <div className="bg-gray-800 rounded-full h-1.5 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          o.occupancy > 66
                            ? "bg-green-500"
                            : o.occupancy > 33
                            ? "bg-yellow-500"
                            : "bg-red-600"
                        }`}
                        style={{ width: `${Math.max(2, o.occupancy)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* top customers */}
          {show.customers && (
            <Card title={`${t("Top customers", "អតិថិជនកំពូល")}`} icon={Users}>
              {r.topCustomers.length === 0 ? (
                <Empty t={t} />
              ) : (
                <table className="w-full text-xs">
                  <tbody>
                    {r.topCustomers.slice(0, 10).map((c, i) => (
                      <tr key={c.email} className="border-b border-gray-900/60">
                        <td className="py-2 w-6 text-gray-600">{i + 1}</td>
                        <td>
                          {c.username}
                          <span className="text-gray-600 text-[10px]"> · {c.email}</span>
                        </td>
                        <td className="text-right text-gray-400">
                          {c.bookings} {t("bookings", "ការកក់")}
                        </td>
                        <td className="text-right font-mono text-yellow-400 w-20">
                          ${Number(c.spent).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Card>
          )}
        </div>

        {/* print-only footer */}
        <div
          className="print-header"
          style={{ borderTop: "1px solid #000", paddingTop: "3mm", fontSize: "8pt" }}
        >
          Lotus Cinema — Management Report · របាយការណ៍គ្រប់គ្រង · {printedOn}
        </div>
      </div>
    </div>
  );
}

const MiniStat = ({ label, val, accent }) => (
  <div className="bg-gray-900 border border-gray-800 rounded-xl px-4 py-3">
    <p className={`text-xl font-extrabold ${accent ? "text-yellow-400" : ""}`}>{val}</p>
    <p className="text-[11px] text-gray-500">{label}</p>
  </div>
);

/* ---------- small helpers ---------- */
const Spin = () => (
  <div className="flex justify-center py-10">
    <Loader2 className="animate-spin" />
  </div>
);
const Stat = ({ icon: Icon, color, label, val, sub, tint = "", ring = "" }) => (
  <div
    className={`relative overflow-hidden bg-gray-900 rounded-2xl p-5 border border-gray-800 ring-1 ${ring}`}
  >
    <div className={`absolute inset-0 bg-gradient-to-br ${tint} pointer-events-none`} />
    <div className="relative">
      <Icon className={`w-5 h-5 ${color} mb-3`} />
      <p className="text-2xl font-extrabold leading-none">{val}</p>
      <p className="text-xs text-gray-400 mt-1.5">{label}</p>
      {sub && <p className="text-[10px] text-gray-500 mt-0.5">{sub}</p>}
    </div>
  </div>
);
const Field = ({ label, value, onChange, type = "text" }) => (
  <div>
    <label className="text-xs text-gray-400">{label}</label>
    <input
      type={type}
      value={value}
      onChange={onChange}
      className="w-full bg-gray-800 rounded-lg p-2 text-sm mt-1 focus:outline-none focus:ring-1 focus:ring-red-500"
    />
  </div>
);