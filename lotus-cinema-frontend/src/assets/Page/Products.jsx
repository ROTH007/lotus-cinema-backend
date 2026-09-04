// src/pages/Products.jsx
// Movie store — now reads the real catalogue (and real prices) from the database.
import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useLanguage } from "../../context/LanguageContext";
import { MoviesAPI } from "../../api/client";

function Products() {
  const { t, isKhmer } = useLanguage();
  const [movies, setMovies] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    MoviesAPI.list({ status: "NOW_SHOWING" })
      .then(setMovies)
      .catch((e) => setError(e.message));
  }, []);

  if (error)
    return (
      <div className="bg-gray-900 min-h-screen py-32 text-center text-red-400">{error}</div>
    );

  if (!movies)
    return (
      <div className="bg-gray-900 min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-red-500" />
      </div>
    );

  return (
    <div className="bg-gray-900 min-h-screen py-12">
      <div className="max-w-7xl mx-auto px-4">
        <h1 className="text-4xl font-bold text-white mb-2 text-center pt-5">
          🎬 {t("Movie Store", "ហាងភាពយន្ត")}
        </h1>
        <p className="text-center text-gray-400 mb-10 text-sm">
          {t(
            "Pick a movie, then choose your showtime and seats.",
            "ជ្រើសរើសភាពយន្ត បន្ទាប់មកជ្រើសម៉ោង និងកៅអី។"
          )}
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-8">
          {movies.map((movie) => (
            <div
              key={movie.id}
              className="bg-gray-800 rounded-xl shadow-lg overflow-hidden hover:shadow-2xl hover:-translate-y-2 transition-all duration-300 flex flex-col"
            >
              {/* Poster */}
              <Link to={`/Detail/${movie.id}`}>
                <img
                  src={movie.poster}
                  alt={isKhmer && movie.titleKm ? movie.titleKm : movie.title}
                  className="w-full h-64 object-cover hover:scale-105 transition duration-500"
                />
              </Link>

              {/* Card Body */}
              <div className="p-5 flex flex-col flex-1">
                <h2 className="text-xl font-semibold text-white line-clamp-2">
                  {isKhmer && movie.titleKm ? movie.titleKm : movie.title}
                </h2>
                <p className="text-sm text-gray-400">
                  {isKhmer && movie.genresKm?.[0] ? movie.genresKm[0] : movie.genres?.[0]}
                </p>
                <p className="text-lg font-bold text-blue-400 mt-2">
                  {t("from", "ចាប់ពី")} ${movie.basePrice?.toFixed(2)}
                </p>

                {/* Buy Button -> movie detail -> showtimes -> seat picker */}
                <Link to={`/Detail/${movie.id}#showtimes`} className="mt-auto pt-4">
                  <button className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-500 transition">
                    {t("Buy Now", "ទិញឥឡូវនេះ")}
                  </button>
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default Products;
