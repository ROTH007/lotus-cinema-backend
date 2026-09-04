// src/Detailpage/MovieDetail.jsx
// Movie data now comes from the database via the API (was a hardcoded array).
import React, { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { Play, Heart, Star, Clock, Loader2, Ticket } from "lucide-react";
import { useLanguage } from "../../context/LanguageContext";
import { useAuth } from "../../context/AuthContext";
import { MoviesAPI, FavoritesAPI } from "../../api/client";

// colour per screen type
function screenBadge(type) {
  switch (type) {
    case "IMAX":
      return "bg-blue-600 text-white";
    case "3D":
      return "bg-purple-600 text-white";
    case "4DX":
      return "bg-orange-600 text-white";
    case "VIP":
      return "bg-yellow-500 text-black";
    default:
      return "bg-gray-700 text-white"; // 2D
  }
}

function MovieDetail() {
  const { id } = useParams();
  const { t, isKhmer } = useLanguage();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [m, setM] = useState(null);
  const [error, setError] = useState("");
  const [isFavorite, setIsFavorite] = useState(false);
  const [stars, setStars] = useState(0);
  const [comment, setComment] = useState("");
  const [reviewMsg, setReviewMsg] = useState("");

  const load = () =>
    MoviesAPI.get(id)
      .then(setM)
      .catch((e) => setError(e.message));

  useEffect(() => {
    load();
  }, [id]);

  // is this movie already a favorite?
  useEffect(() => {
    if (!user) {
      setIsFavorite(false);
      return;
    }
    FavoritesAPI.list()
      .then((favs) => setIsFavorite(favs.some((f) => f.id === parseInt(id))))
      .catch(() => {});
  }, [user, id]);

  const toggleFavorite = async () => {
    if (!user) return navigate("/Login");
    try {
      if (isFavorite) await FavoritesAPI.remove(m.id);
      else await FavoritesAPI.add(m.id);
      setIsFavorite(!isFavorite);
      window.dispatchEvent(new Event("favorites-change"));
    } catch (e) {
      alert(e.message);
    }
  };

  const submitReview = async () => {
    if (!user) return navigate("/Login");
    if (!stars) return setReviewMsg(t("Pick a star rating", "សូមជ្រើសពិន្ទុ"));
    try {
      await MoviesAPI.addReview(m.id, stars, comment);
      setReviewMsg(t("Thanks for your review!", "អរគុណសម្រាប់មតិ!"));
      setComment("");
      load();
    } catch (e) {
      setReviewMsg(e.message);
    }
  };

  if (error)
    return <h1 className="text-white text-center mt-32">{t("Movie not found!", "រកមិនឃើញភាពយន្ត!")}</h1>;
  if (!m)
    return (
      <div className="bg-[#0f0f0f] min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-red-500" />
      </div>
    );

  const title = isKhmer && m.titleKm ? m.titleKm : m.title;
  const genreList = (isKhmer && m.genresKm?.filter(Boolean).length ? m.genresKm : m.genres) || [];

  return (
    <div className="bg-[#0f0f0f] text-white min-h-screen font-sans pt-[60px]">
      {/* Breadcrumb */}
      <div className="text-gray-400 text-xs sm:text-sm px-4 sm:px-8 py-3 sm:py-4">
        <Link to="/" className="hover:text-white">{t("Home", "ទំព័រដើម")}</Link> &gt;{" "}
        <Link to="/Movie" className="hover:text-white">{t("Movies", "ភាពយន្ត")}</Link> &gt;{" "}
        <span className="text-white">{title}</span>
      </div>

      {/* Header Section */}
      {/* min-h (not a fixed h) on mobile lets this grow with its content instead of
          clipping/overlapping the section below when the poster + title + buttons
          don't fit in a short viewport height. Locks back to a fixed h from sm: up,
          same as before. */}
      <section
        className="relative min-h-[85vh] sm:h-[70vh] flex flex-col sm:flex-row items-end justify-start bg-cover bg-center py-8 sm:py-0"
        style={{ backgroundImage: `url(${m.banner})` }}
      >
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-transparent"></div>

        <div className="relative z-10 flex flex-col sm:flex-row items-center sm:items-end justify-between w-full px-4 sm:px-8 pb-0 sm:pb-10 gap-6 sm:gap-8">
          <img
            src={m.poster}
            alt={title}
            className="w-36 sm:w-48 md:w-56 rounded-xl sm:rounded-2xl shadow-lg"
          />

          <div className="text-center sm:text-left max-w-2xl w-full">
            <h1 className="text-2xl sm:text-4xl md:text-5xl font-bold mb-2 leading-tight">{title}</h1>
            {isKhmer && m.titleKm && (
              <p className="text-gray-400 text-sm mb-1">{m.title}</p>
            )}

            <div className="flex flex-wrap justify-center sm:justify-start items-center gap-x-2 gap-y-1 text-gray-300 text-sm sm:text-base">
              <span>{m.releaseYear}</span>
              <span className="text-gray-600">•</span>
              <span className="flex items-center gap-1">
                <Clock className="w-4 h-4" /> {m.runtime}
              </span>
              <span className="text-gray-600">•</span>
              <span>{genreList.join(" | ")}</span>
            </div>

            <p className="flex justify-center sm:justify-start items-center gap-1 mt-2 text-yellow-400 text-sm sm:text-base">
              <Star className="w-4 h-4 fill-yellow-400" /> {m.rating}/10
              {m.avgStars && (
                <span className="text-gray-400 ml-2 text-xs">
                  ({t("users", "អ្នកប្រើ")}: {m.avgStars}★ · {m.reviewCount})
                </span>
              )}
            </p>

            {/* Buttons */}
            <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-3 sm:gap-4 mt-6 max-w-sm sm:max-w-none mx-auto sm:mx-0">
              <a
                href="#trailer"
                className="bg-red-600 hover:bg-red-700 px-5 sm:px-6 py-2 sm:py-3 rounded-full flex items-center justify-center sm:justify-start gap-2 text-sm sm:text-base"
              >
                <Play className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" /> {t("Watch Trailer", "មើលវីដេអូ")}
              </a>

              <a
                href="#showtimes"
                className="bg-green-600 hover:bg-green-500 px-5 sm:px-6 py-2 sm:py-3 rounded-full flex items-center justify-center sm:justify-start gap-2 text-sm sm:text-base font-semibold"
              >
                <Ticket className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" /> {t("Book Tickets", "កក់សំបុត្រ")}
              </a>

              <button
                onClick={toggleFavorite}
                className={`${
                  isFavorite ? "bg-red-600 hover:bg-red-700" : "bg-gray-800 hover:bg-gray-700"
                } col-span-2 sm:col-auto px-5 sm:px-6 py-2 sm:py-3 rounded-full flex items-center justify-center sm:justify-start gap-2 text-sm sm:text-base`}
              >
                {isFavorite ? <Heart className="w-4 h-4 sm:w-5 sm:h-5 shrink-0 fill-red-500 text-red-500" /> : <Heart className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />}
                {isFavorite ? t("Favorited", "បានចូលចិត្ត") : t("Favorite", "ចូលចិត្ត")}
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Showtimes -> seat picker */}
      <section id="showtimes" className="px-4 sm:px-8 py-8 sm:py-10">
        <h2 className="text-xl sm:text-2xl font-semibold mb-4">
          {t("Showtimes", "ម៉ោងចាក់")}
        </h2>
        {m.showtimes.length === 0 ? (
          <p className="text-gray-400 text-sm">
            {t("No showtimes scheduled yet.", "មិនទាន់មានម៉ោងចាក់ទេ។")}
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {m.showtimes.map((s) => (
              <Link
                key={s.showtime_id}
                to={`/booking/${s.showtime_id}`}
                className="group bg-gray-900 hover:bg-gray-800 border border-gray-800 hover:border-red-500/50 rounded-xl p-4 transition"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-lg font-bold group-hover:text-red-500 transition">
                      {s.start_time}
                    </p>
                    <p className="text-xs text-gray-400">{s.show_date}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className={`text-xs font-bold rounded px-2 py-1 ${screenBadge(s.screen_type)}`}>
                      {s.screen_type || "2D"}
                    </span>
                    {s.hall_type && s.hall_type !== "STANDARD" && (
                      <span className="text-[10px] bg-gray-800 border border-gray-700 rounded px-2 py-0.5 text-gray-300">
                        {s.hall_type}
                      </span>
                    )}
                  </div>
                </div>
                <p className="text-sm text-gray-300 mt-2">{s.cinema}</p>
                <p className="text-xs text-gray-500">
                  {s.hall_name} · {t("Floor", "ជាន់")} {s.floor} · {s.city}
                </p>
                <p className="text-xs mt-2">
                  <span className="text-green-400 font-semibold">
                    {s.seats_left} {t("seats left", "កៅអីនៅសល់")}
                  </span>{" "}
                  <span className="text-gray-500">· {t("from", "ចាប់ពី")} ${s.base_price}</span>
                </p>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Movie Description */}
      <section className="px-4 sm:px-8 py-8 sm:py-10">
        <h2 className="text-xl sm:text-2xl font-semibold mb-2">{t("Overview", "សេចក្តីសង្ខេប")}</h2>
        <p className="text-gray-300 text-sm sm:text-base leading-relaxed mb-4 sm:mb-6">
          {m.overview}
        </p>
        {m.tagline && (
          <p className="italic text-gray-400 text-sm sm:text-base mb-4 sm:mb-6">“{m.tagline}”</p>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 text-gray-400 text-sm sm:text-base">
          <p>
            <strong className="text-white">{t("Language", "ភាសា")}:</strong> {m.language}
          </p>
          <p>
            <strong className="text-white">{t("Release Date", "ថ្ងៃចេញ")}:</strong> {m.releaseDate}
          </p>
          <p>
            <strong className="text-white">{t("Production", "ផលិតកម្ម")}:</strong> {m.production}
          </p>
          <p>
            <strong className="text-white">{t("Ticket from", "តម្លៃសំបុត្រ")}:</strong> ${m.basePrice}
          </p>
        </div>
      </section>

      {/* Trailer */}
      {m.trailer && (
        <section id="trailer" className="px-4 sm:px-8 py-8 sm:py-10">
          <h2 className="text-xl sm:text-2xl font-semibold mb-4 sm:mb-6">
            {t("Trailer", "វីដេអូខ្លី")}
          </h2>
          <div className="aspect-video rounded-xl overflow-hidden shadow-lg">
            <iframe className="w-full h-full" src={m.trailer} title="Trailer" allowFullScreen></iframe>
          </div>
        </section>
      )}

      {/* Reviews */}
      <section className="px-4 sm:px-8 py-8 sm:py-10 pb-16">
        <h2 className="text-xl sm:text-2xl font-semibold mb-4">
          {t("Reviews", "មតិយោបល់")} {m.reviewCount > 0 && `(${m.reviewCount})`}
        </h2>

        {/* Write a review */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 mb-6 max-w-2xl">
          <div className="flex gap-1 mb-3">
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} onClick={() => setStars(n)}>
                <Star
                  className={`w-6 h-6 ${
                    n <= stars ? "fill-yellow-400 text-yellow-400" : "text-gray-600"
                  }`}
                />
              </button>
            ))}
          </div>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder={t("Share what you thought…", "សរសេរមតិរបស់អ្នក…")}
            className="w-full bg-gray-800 rounded-lg p-3 text-sm mb-3 focus:outline-none focus:ring-1 focus:ring-red-500"
            rows={3}
          />
          <div className="flex items-center gap-3">
            <button
              onClick={submitReview}
              className="bg-red-600 hover:bg-red-500 px-4 py-2 rounded-lg text-sm font-semibold"
            >
              {t("Post review", "ផ្ញើមតិ")}
            </button>
            {reviewMsg && <span className="text-xs text-gray-400">{reviewMsg}</span>}
          </div>
        </div>

        {/* Review list */}
        <div className="space-y-3 max-w-2xl">
          {m.reviews.length === 0 && (
            <p className="text-gray-500 text-sm">
              {t("No reviews yet — be the first.", "មិនទាន់មានមតិ — សរសេរមុនគេ។")}
            </p>
          )}
          {m.reviews.map((r, i) => (
            <div key={i} className="bg-gray-900/60 border border-gray-800 rounded-lg p-3">
              <div className="flex justify-between items-center mb-1">
                <span className="font-semibold text-sm">{r.username}</span>
                <span className="flex items-center gap-0.5 text-yellow-400 text-xs">
                  {r.stars}
                  <Star className="w-3 h-3 fill-yellow-400" />
                </span>
              </div>
              {r.comment && <p className="text-gray-300 text-sm">{r.comment}</p>}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

export default MovieDetail;