// Favorites now live in the database (favorites table), not localStorage.
import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Trash2, Loader2 } from "lucide-react";
import { useLanguage } from "../../context/LanguageContext";
import { useAuth } from "../../context/AuthContext";
import { FavoritesAPI } from "../../api/client";

function Favorites() {
  const { t, isKhmer } = useLanguage();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [favorites, setFavorites] = useState(null);
  const [error, setError] = useState("");

  const load = () =>
    FavoritesAPI.list()
      .then(setFavorites)
      .catch((e) => setError(e.message));

  useEffect(() => {
    if (!user) return;
    load();
  }, [user]);

  const removeFavorite = async (id) => {
    try {
      await FavoritesAPI.remove(id);
      setFavorites((cur) => cur.filter((m) => m.id !== id));
      window.dispatchEvent(new Event("favorites-change"));
    } catch (e) {
      alert(e.message);
    }
  };

  if (!user)
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#0f0f0f] to-[#1a1a1a] text-white pt-32 px-6 text-center">
        <h1 className="text-3xl font-extrabold mb-4">
          ❤️ {t("My Favorite Movies", "ភាពយន្តចំណូលចិត្ត")}
        </h1>
        <p className="text-gray-400 mb-6">
          {t("Log in to see your favorites.", "សូមចូលគណនីដើម្បីមើលបញ្ជីចំណូលចិត្ត។")}
        </p>
        <button
          onClick={() => navigate("/Login")}
          className="bg-red-600 hover:bg-red-500 px-6 py-2.5 rounded-lg font-semibold"
        >
          {t("Login", "ចូលគណនី")}
        </button>
      </div>
    );

  if (!favorites)
    return (
      <div className="min-h-screen bg-[#0f0f0f] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-red-500" />
      </div>
    );

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0f0f0f] to-[#1a1a1a] text-white pt-24 px-6 sm:px-12 pb-16">
      <h1 className="text-4xl font-extrabold mb-10 text-center tracking-wide">
        ❤️ {t("My Favorite Movies", "ភាពយន្តចំណូលចិត្ត")}
      </h1>

      {error && <p className="text-red-400 text-center mb-4">{error}</p>}

      {favorites.length === 0 ? (
        <p className="text-gray-400 text-lg text-center">
          {t("No favorite movies yet.", "មិនទាន់មានភាពយន្តចំណូលចិត្តទេ។")}{" "}
          <Link to="/Movie" className="text-red-400">
            {t("Browse movies →", "រកមើលភាពយន្ត →")}
          </Link>
        </p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
          {favorites.map((movie, index) => (
            <div
              key={movie.id}
              className="group relative flex flex-col bg-gray-900 rounded-2xl overflow-hidden shadow-lg hover:shadow-xl hover:shadow-red-500/20 transition-all duration-500 transform hover:-translate-y-2 hover:scale-[1.03]"
              style={{ animationDelay: `${index * 0.05}s` }}
            >
              <div className="relative block">
                <Link to={`/Detail/${movie.id}`}>
                  <img
                    src={movie.poster || "/videos/default.jpg"}
                    alt={movie.title}
                    className="w-full h-64 object-cover group-hover:opacity-80 transition"
                  />
                </Link>
                <button
                  onClick={() => removeFavorite(movie.id)}
                  title={t("Remove", "លុប")}
                  className="absolute top-2 right-2 bg-black/70 hover:bg-red-600 p-2 rounded-full transition"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              <div className="p-3">
                <Link to={`/Detail/${movie.id}`}>
                  <h3 className="font-bold text-sm line-clamp-2 hover:text-red-500 transition">
                    {isKhmer && movie.titleKm ? movie.titleKm : movie.title}
                  </h3>
                </Link>
                <p className="text-xs text-gray-400 mt-1">
                  {movie.releaseYear} · ⭐ {movie.rating}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default Favorites;
