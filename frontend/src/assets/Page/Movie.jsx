import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Play, Star, Calendar, Loader2 } from "lucide-react";
import { useLanguage } from "../../context/LanguageContext";
import { MoviesAPI } from "../../api/client";

function Movie() {
  const { t, isKhmer } = useLanguage();
  const [selectedGenre, setSelectedGenre] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");

  // Movies + genres now come from the database (Oracle / demo API)
  const [movies, setMovies] = useState([]);
  const [genres, setGenres] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([MoviesAPI.list(), MoviesAPI.genres()])
      .then(([m, g]) => {
        setMovies(m);
        setGenres(g);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  // Filter locally so typing stays instant
  const filteredMovies = movies.filter((movie) => {
    const matchesGenre =
      selectedGenre === "All" || (movie.genres || []).includes(selectedGenre);
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      !q ||
      movie.title.toLowerCase().includes(q) ||
      (movie.titleKm || "").includes(searchQuery);
    return matchesGenre && matchesSearch;
  });

  const genreLabel = (name) => {
    if (name === "All") return t("All", "ទាំងអស់");
    const g = genres.find((x) => x.name === name);
    return isKhmer && g?.nameKm ? g.nameKm : name;
  };

  const genreButtons = ["All", ...genres.map((g) => g.name)];

  return (
    <div className="bg-gradient-to-b from-gray-900 via-black to-gray-900 min-h-screen text-white pt-20">
      {/* Hero Header */}
      <div className="relative h-[40vh] overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-red-600 to-purple-600 opacity-20"></div>
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1536440136628-849c177e76a1')] bg-cover bg-center opacity-10"></div>
        <div className="relative z-10 flex flex-col items-center justify-center h-full px-4">
          <h1 className="text-5xl md:text-7xl font-black text-center mb-4 bg-gradient-to-r from-red-500 to-purple-500 bg-clip-text text-transparent">
            {t("Movie Collection", "បណ្តុំភាពយន្ត")}
          </h1>
          <p className="text-gray-300 text-lg md:text-xl text-center max-w-2xl">
            {t(
              "Explore our curated collection of blockbuster movies",
              "ស្វែងរកបណ្តុំភាពយន្តដែលយើងជ្រើសរើស"
            )}
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-12">
        {/* Search & Filter Section */}
        <div className="mb-12">
          {/* Search Bar */}
          <div className="mb-8">
            <input
              type="text"
              placeholder={t("Search movies...", "ស្វែងរកភាពយន្ត...")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full max-w-2xl mx-auto block px-6 py-4 bg-gray-800/50 border border-gray-700 rounded-full text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent backdrop-blur-sm"
            />
          </div>

          {/* Genre Filter Buttons */}
          <div className="flex flex-wrap justify-center gap-3">
            {genreButtons.map((genre) => (
              <button
                key={genre}
                onClick={() => setSelectedGenre(genre)}
                className={`px-5 py-2.5 rounded-full font-semibold text-sm transition-all duration-300 ${
                  selectedGenre === genre
                    ? "bg-gradient-to-r from-red-600 to-purple-600 text-white shadow-lg shadow-red-500/50 scale-105"
                    : "bg-gray-800/50 text-gray-300 hover:bg-gray-700 border border-gray-700"
                }`}
              >
                {genreLabel(genre)}
              </button>
            ))}
          </div>
        </div>

        {/* Loading / error */}
        {loading && (
          <div className="flex justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-red-500" />
          </div>
        )}
        {error && (
          <p className="text-center text-red-400 py-10">
            {t("Could not load movies:", "មិនអាចទាញភាពយន្ត:")} {error}
          </p>
        )}

        {!loading && !error && (
          <>
            {/* Movie Results Count */}
            <div className="mb-6 text-gray-400">
              {t("Showing", "បង្ហាញ")}{" "}
              <span className="text-white font-semibold">{filteredMovies.length}</span>{" "}
              {t("movies", "ភាពយន្ត")}
            </div>

            {/* Movie Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
              {filteredMovies.map((movie) => (
                <Link
                  key={movie.id}
                  to={`/Detail/${movie.id}`}
                  className="group relative overflow-hidden rounded-xl bg-gray-800/50 backdrop-blur-sm border border-gray-700/50 hover:border-red-500/50 transition-all duration-300 hover:scale-105 hover:shadow-2xl hover:shadow-red-500/20"
                >
                  {/* Movie Poster */}
                  <div className="relative aspect-[2/3] overflow-hidden">
                    <img
                      src={movie.poster}
                      alt={isKhmer && movie.titleKm ? movie.titleKm : movie.title}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                    />

                    {/* Overlay on Hover */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                      <div className="absolute bottom-0 left-0 right-0 p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <Play className="w-5 h-5 text-red-500" />
                          <span className="text-sm font-semibold">
                            {t("Book Now", "កក់ឥឡូវ")}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Rating Badge */}
                    {movie.rating != null && (
                      <div className="absolute top-2 right-2 bg-black/80 backdrop-blur-sm px-2 py-1 rounded-lg flex items-center gap-1">
                        <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                        <span className="text-xs font-bold">{movie.rating}</span>
                      </div>
                    )}

                    {/* Genre Badge (first genre) */}
                    {movie.genres?.[0] && (
                      <div className="absolute top-2 left-2 bg-red-600/90 backdrop-blur-sm px-3 py-1 rounded-full text-xs font-bold">
                        {isKhmer && movie.genresKm?.[0]
                          ? movie.genresKm[0]
                          : movie.genres[0]}
                      </div>
                    )}
                  </div>

                  {/* Movie Info */}
                  <div className="p-4">
                    <h3 className="font-bold text-sm md:text-base mb-1 line-clamp-2 group-hover:text-red-500 transition-colors">
                      {isKhmer && movie.titleKm ? movie.titleKm : movie.title}
                    </h3>
                    <div className="flex items-center gap-2 text-gray-400 text-xs">
                      <Calendar className="w-3 h-3" />
                      <span>{movie.releaseYear}</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>

            {/* No Results */}
            {filteredMovies.length === 0 && (
              <div className="text-center py-20">
                <div className="text-6xl mb-4">🎬</div>
                <h3 className="text-2xl font-bold mb-2">
                  {t("No movies found", "រកមិនឃើញភាពយន្ត")}
                </h3>
                <p className="text-gray-400">
                  {t(
                    "Try adjusting your search or filter",
                    "សាកល្បងកែសម្រួលការស្វែងរក ឬតម្រងរបស់អ្នក"
                  )}
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default Movie;
