import React, { useState, useEffect, useRef } from "react";
import { Play, Info } from "lucide-react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { useLanguage } from "../../context/LanguageContext";
import { MoviesAPI } from "../../api/client";
import NowShowing from "./NowShowing";

function Homes() {
  const { t, isKhmer } = useLanguage();
  const [loading, setLoading] = useState(true);

  // Movie rows now come from the database (was a hardcoded list of image URLs).
  const [moviesData, setMoviesData] = useState({ trending: [], topRated: [], action: [] });

  useEffect(() => {
    MoviesAPI.list({ status: "NOW_SHOWING" })
      .then((all) => {
        const withPoster = all.filter((m) => m.poster);
        const byRating = [...withPoster].sort((a, b) => (b.rating || 0) - (a.rating || 0));
        setMoviesData({
          trending: withPoster.slice(0, 13),
          topRated: byRating.slice(0, 13),
          action: withPoster.filter((m) => m.genres.includes("Action")).slice(0, 13),
        });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Keep the cinematic intro on screen a moment, but never longer than the data fetch needs.
  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 8000);
    return () => clearTimeout(timer);
  }, []);

  // === Hero Slider ===
  const [index, setIndex] = useState(0);
  const autoplayRef = useRef(null);

  useEffect(() => {
    if (!loading) {
      autoplayRef.current = setInterval(() => {
        setIndex((i) => (moviesData.trending.length ? (i + 1) % moviesData.trending.length : 0));
      }, 6000);
    }
    return () => clearInterval(autoplayRef.current);
  }, [loading, moviesData.trending.length]);

  // Render movie section
  const renderMovieSection = (title, movies) => (
    <div className="px-4 py-6 sm:px-6 sm:py-10">
      <h2 className="text-xl sm:text-2xl md:text-3xl font-bold mb-4 sm:mb-6">{title}</h2>
      <div className="relative overflow-hidden">
        <div
          className="flex gap-3 sm:gap-4 md:gap-6 whitespace-nowrap animate-marquee"
          onMouseEnter={(e) => (e.currentTarget.style.animationPlayState = "paused")}
          onMouseLeave={(e) => (e.currentTarget.style.animationPlayState = "running")}
        >
          {[...movies, ...movies].map((movie, idx) => (
            <Link
              key={`${movie.id}-${idx}`}
              to={`/Detail/${movie.id}`}
              className="flex-none transform hover:scale-105 transition duration-300"
            >
              <img
                src={movie.poster}
                alt={movie.title}
                title={movie.title}
                className="w-32 h-48 sm:w-40 sm:h-60 md:w-52 md:h-72 object-cover rounded-lg shadow-lg"
                draggable={false}
              />
            </Link>
          ))}
        </div>
      </div>
    </div>
  );

  // Show loading screen
  if (loading) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center bg-black text-white z-50 overflow-hidden px-4">
        {/* Animated grid background */}
        <div className="absolute inset-0 opacity-20">
          <div className="absolute inset-0 grid-background" />
        </div>

        {/* Flying energy particles */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {[...Array(20)].map((_, i) => (
            <motion.div
              key={`particle-${i}`}
              className="absolute w-2 h-2 bg-red-500 rounded-full"
              style={{
                left: '50%',
                top: '50%',
                boxShadow: '0 0 10px rgba(239, 68, 68, 0.8)'
              }}
              animate={{
                x: [0, (Math.random() - 0.5) * 600],
                y: [0, (Math.random() - 0.5) * 600],
                opacity: [1, 0],
                scale: [1, 0]
              }}
              transition={{
                duration: 2 + Math.random() * 2,
                repeat: Infinity,
                delay: i * 0.15,
                ease: "easeOut"
              }}
            />
          ))}
        </div>

        {/* Speed lines effect */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {[...Array(15)].map((_, i) => (
            <motion.div
              key={`line-${i}`}
              className="absolute h-0.5 bg-gradient-to-r from-transparent via-cyan-400 to-transparent"
              style={{
                width: `${80 + Math.random() * 150}px`,
                top: `${Math.random() * 100}%`,
                left: '-200px'
              }}
              animate={{
                x: ['0vw', '120vw'],
                opacity: [0, 1, 0]
              }}
              transition={{
                duration: 1 + Math.random() * 1,
                repeat: Infinity,
                delay: i * 0.3,
                ease: "linear"
              }}
            />
          ))}
        </div>

        {/* Explosion rings */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          {[...Array(4)].map((_, i) => (
            <motion.div
              key={`ring-${i}`}
              className="absolute border-2 border-red-500 rounded-full"
              initial={{ width: 0, height: 0, opacity: 0.8 }}
              animate={{
                width: [0, 500],
                height: [0, 500],
                opacity: [0.8, 0],
                borderWidth: [4, 0]
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                delay: i * 0.5,
                ease: "easeOut"
              }}
            />
          ))}
        </div>

        {/* Scanning lines effect */}
        <motion.div
          className="absolute inset-0 pointer-events-none scan-line"
          animate={{ y: ['-200px', '100vh'] }}
          transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
        />

        {/* Hexagonal particles */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {[...Array(8)].map((_, i) => (
            <motion.div
              key={`hex-${i}`}
              className="absolute w-8 h-8 border border-red-500 opacity-30 hexagon"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`
              }}
              animate={{
                y: [0, -150],
                rotate: [0, 360],
                opacity: [0, 0.5, 0],
                scale: [0.5, 1.5, 0.5]
              }}
              transition={{
                duration: 3 + i * 0.5,
                repeat: Infinity,
                delay: i * 0.4
              }}
            />
          ))}
        </div>

        {/* Logo with holographic frame and shake effect */}
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{
            opacity: 1,
            scale: 1,
            rotate: [0, -2, 2, -2, 0]
          }}
          transition={{
            opacity: { duration: 0.8 },
            scale: { duration: 0.8 },
            rotate: { duration: 0.5, repeat: Infinity, repeatDelay: 2 }
          }}
          className="relative mb-8 sm:mb-12 z-10"
        >
          {/* Outer frame corners with glow */}
          <div className="absolute -inset-3 sm:-inset-4">
            <motion.div
              className="absolute top-0 left-0 w-4 h-4 sm:w-6 sm:h-6 border-t-2 border-l-2 border-red-500"
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 1, repeat: Infinity }}
            />
            <motion.div
              className="absolute top-0 right-0 w-4 h-4 sm:w-6 sm:h-6 border-t-2 border-r-2 border-red-500"
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 1, repeat: Infinity, delay: 0.25 }}
            />
            <motion.div
              className="absolute bottom-0 left-0 w-4 h-4 sm:w-6 sm:h-6 border-b-2 border-l-2 border-red-500"
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 1, repeat: Infinity, delay: 0.5 }}
            />
            <motion.div
              className="absolute bottom-0 right-0 w-4 h-4 sm:w-6 sm:h-6 border-b-2 border-r-2 border-red-500"
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 1, repeat: Infinity, delay: 0.75 }}
            />
          </div>

          {/* Glowing pulse effect */}
          <motion.div
            className="absolute inset-0 blur-2xl bg-red-500"
            animate={{
              opacity: [0.2, 0.6, 0.2],
              scale: [1, 1.2, 1]
            }}
            transition={{ duration: 1.5, repeat: Infinity }}
          />

          <img
            src="/videos/logo.png"
            alt="Logo"
            className="relative z-10 h-14 sm:h-20 md:h-24 w-auto logo-glow"
          />

          {/* Multiple scanning lines */}
          <motion.div className="absolute inset-0 overflow-hidden">
            {[0, 0.3, 0.6].map((delay, i) => (
              <motion.div
                key={`scan-${i}`}
                className="absolute w-full h-1 bg-gradient-to-r from-transparent via-cyan-400 to-transparent"
                style={{ opacity: 0.6 }}
                animate={{ y: ['-100%', '200%'] }}
                transition={{ duration: 1.5, repeat: Infinity, ease: "linear", delay }}
              />
            ))}
          </motion.div>
        </motion.div>

        {/* Advanced circular HUD spinner with trails */}
        <div className="relative w-24 h-24 sm:w-32 sm:h-32 md:w-40 md:h-40 mb-6 sm:mb-8">
          {/* Outer ring segments with trails */}
          {[...Array(12)].map((_, i) => (
            <motion.div
              key={`segment-${i}`}
              className="absolute inset-0"
              style={{ rotate: `${i * 30}deg` }}
              animate={{
                opacity: [0.2, 1, 0.2],
                scale: [0.9, 1.1, 0.9]
              }}
              transition={{
                duration: 1.5,
                repeat: Infinity,
                delay: i * 0.08
              }}
            >
              <div className="w-1 h-5 sm:w-1.5 sm:h-8 bg-gradient-to-b from-red-500 to-transparent rounded-full mx-auto" />
            </motion.div>
          ))}

          {/* Fast rotating outer ring */}
          <motion.div
            className="absolute inset-2 border-2 border-red-500 rounded-full rotating-ring"
            animate={{ rotate: 360 }}
            transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
          />

          {/* Counter-rotating middle ring */}
          <motion.div
            className="absolute inset-4 sm:inset-6 border-2 border-cyan-400 rounded-full"
            style={{ borderTopColor: 'transparent', borderLeftColor: 'transparent' }}
            animate={{ rotate: -360 }}
            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
          />

          {/* Inner pulsing circle with energy */}
          <motion.div
            className="absolute inset-7 sm:inset-10 border-2 border-red-400 rounded-full"
            animate={{
              scale: [1, 1.3, 1],
              opacity: [0.3, 1, 0.3],
              rotate: 360
            }}
            transition={{ duration: 2, repeat: Infinity }}
          />

          {/* Center energy core */}
          <div className="absolute inset-0 flex items-center justify-center">
            <motion.div
              className="w-3 h-3 sm:w-4 sm:h-4 bg-red-500 rounded-full"
              animate={{
                scale: [1, 1.8, 1],
                boxShadow: [
                  '0 0 10px rgba(239, 68, 68, 0.8)',
                  '0 0 30px rgba(239, 68, 68, 1)',
                  '0 0 10px rgba(239, 68, 68, 0.8)'
                ]
              }}
              transition={{ duration: 1, repeat: Infinity }}
            />
          </div>
        </div>

        {/* System status text with glitch effect */}
        <motion.div
          className="text-center space-y-2 sm:space-y-3 px-2"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <div className="flex items-center justify-center gap-2 sm:gap-3 font-mono text-cyan-400 text-xs sm:text-sm">
            <motion.span
              className="text-red-500 text-base sm:text-lg"
              animate={{ scale: [1, 1.5, 1] }}
              transition={{ duration: 1, repeat: Infinity }}
            >
              ●
            </motion.span>
            <motion.span
              className="whitespace-nowrap"
              animate={{
                opacity: [0.5, 1, 0.5],
                textShadow: [
                  '0 0 5px rgba(6, 182, 212, 0.5)',
                  '0 0 10px rgba(6, 182, 212, 1)',
                  '0 0 5px rgba(6, 182, 212, 0.5)'
                ]
              }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              INITIALIZING SYSTEM
            </motion.span>
            {[0, 0.2, 0.4].map((delay, i) => (
              <motion.span
                key={`dot-${i}`}
                animate={{ opacity: [0, 1, 0] }}
                transition={{ duration: 1.5, repeat: Infinity, delay, times: [0, 0.5, 1] }}
              >
                .
              </motion.span>
            ))}
          </div>

          <motion.div
            className="font-mono text-red-500 text-[10px] sm:text-xs tracking-widest"
            animate={{
              opacity: [0.7, 1, 0.7],
              scale: [1, 1.05, 1]
            }}
            transition={{ duration: 1, repeat: Infinity }}
          >
            LOADING PROTOCOL
          </motion.div>
        </motion.div>

        {/* Dynamic progress bars with energy flow */}
        <div className="mt-6 sm:mt-8 space-y-2 w-full max-w-[260px] sm:max-w-xs md:max-w-sm">
          {[60, 80, 45].map((width, i) => (
            <motion.div
              key={`bar-${i}`}
              className="flex items-center gap-3"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.8 + i * 0.1 }}
            >
              <div className="w-full h-1.5 bg-gray-900 border border-gray-800 rounded-full overflow-hidden relative">
                <motion.div
                  className="h-full bg-gradient-to-r from-red-600 via-red-500 to-cyan-400 rounded-full progress-bar relative"
                  initial={{ width: "0%" }}
                  animate={{ width: `${width}%` }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    ease: "easeInOut",
                    delay: i * 0.3
                  }}
                >
                  {/* Energy spark at the end */}
                  <motion.div
                    className="absolute right-0 top-1/2 -translate-y-1/2 w-2 h-2 bg-white rounded-full"
                    animate={{
                      boxShadow: [
                        '0 0 5px rgba(255, 255, 255, 1)',
                        '0 0 15px rgba(255, 255, 255, 1)',
                        '0 0 5px rgba(255, 255, 255, 1)'
                      ]
                    }}
                    transition={{ duration: 0.5, repeat: Infinity }}
                  />
                </motion.div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Corner UI elements with animation */}
        <motion.div
          className="hidden sm:block absolute top-6 left-6 md:top-8 md:left-8 font-mono text-[10px] md:text-xs text-gray-600"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
        >
          <div>VER 2.0.1</div>
          <motion.div
            className="text-red-500"
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          >
            ONLINE
          </motion.div>
        </motion.div>

        <motion.div
          className="hidden sm:block absolute bottom-6 right-6 md:bottom-8 md:right-8 font-mono text-[10px] md:text-xs text-gray-600 text-right"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
        >
          <div>SYS_ID: {Date.now().toString().slice(-6)}</div>
          <motion.div
            className="text-cyan-400"
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          >
            ACTIVE
          </motion.div>
        </motion.div>

        <style>{`
          .grid-background {
            background-image: linear-gradient(rgba(239, 68, 68, 0.1) 1px, transparent 1px),
                              linear-gradient(90deg, rgba(239, 68, 68, 0.1) 1px, transparent 1px);
            background-size: 50px 50px;
            animation: gridMove 20s linear infinite;
          }
          @keyframes gridMove {
            0% { transform: translateY(0); }
            100% { transform: translateY(50px); }
          }
          .scan-line {
            background: linear-gradient(180deg, transparent 0%, rgba(239, 68, 68, 0.1) 50%, transparent 100%);
            height: 200px;
          }
          .hexagon {
            clip-path: polygon(30% 0%, 70% 0%, 100% 50%, 70% 100%, 30% 100%, 0% 50%);
          }
          .logo-glow {
            filter: drop-shadow(0 0 20px rgba(239, 68, 68, 0.5));
          }
          .rotating-ring {
            border-top-color: transparent;
            border-right-color: transparent;
          }
          .progress-bar {
            box-shadow: 0 0 15px rgba(239, 68, 68, 0.7);
          }
        `}</style>
      </div>
    );
  }

  const heroMovie = moviesData.trending[index];

  return (
    <div className="bg-black text-white min-h-screen font-sans overflow-x-hidden">
      {/* ===== HERO SLIDER ===== */}
      <section className="relative h-[60vh] sm:h-[75vh] md:h-[90vh] flex items-end justify-start overflow-hidden">
        <div className="absolute inset-0">
          {moviesData.trending.map((movie, i) => (
            <img
              key={movie.id}
              src={movie.banner || movie.poster}
              alt={movie.title}
              className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-700 ${
                i === index ? "opacity-100" : "opacity-0"
              }`}
            />
          ))}
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/70 to-transparent" />
        </div>

        <div className="relative z-10 w-full max-w-3xl p-4 sm:p-6 md:p-10">
          <p className="text-red-500 font-semibold tracking-widest text-xs sm:text-sm mb-2">
            {t("NOW SHOWING", "កំពុងចាក់បញ្ចាំង")}
          </p>
          <h1 className="text-2xl sm:text-3xl md:text-5xl lg:text-6xl font-extrabold mb-3 sm:mb-4 drop-shadow-lg">
            {heroMovie
              ? isKhmer && heroMovie.titleKm
                ? heroMovie.titleKm
                : heroMovie.title
              : t("Up Coming Movie !!", "ភាពយន្តដែលនឹងមកដល់ឆាប់ៗនេះ !!")}
          </h1>
          <p className="text-gray-300 text-sm sm:text-base md:text-lg max-w-2xl mb-4 sm:mb-6 line-clamp-2 sm:line-clamp-3">
            {heroMovie?.overview ||
              t(
                "Book your seat at Lotus Cinema.",
                "កក់កៅអីរបស់អ្នកនៅ Lotus Cinema។"
              )}
          </p>

          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
            <Link
              to={heroMovie ? `/Detail/${heroMovie.id}` : "/Movie"}
              className="flex items-center justify-center sm:justify-start gap-2 w-full sm:w-auto bg-red-600 text-white px-6 py-3 rounded-md font-semibold hover:bg-red-700 transition"
            >
              <Play size={18} /> {t("Book Now", "កក់ឥឡូវ")}
            </Link>
            <Link
              to={heroMovie ? `/Detail/${heroMovie.id}` : "/Movie"}
              className="flex items-center justify-center sm:justify-start gap-2 w-full sm:w-auto bg-gray-700 text-white px-6 py-3 rounded-md font-semibold hover:bg-gray-600 transition"
            >
              <Info size={18} /> {t("More Info", "ព័ត៌មានបន្ថែម")}
            </Link>
          </div>
        </div>
      </section>

      {/* ===== NOW SHOWING / COMING SOON (date strip) ===== */}
      <NowShowing />

      {/* ===== MOVIE SECTIONS ===== */}
      {renderMovieSection(t("Trending Now", "កំពុងពេញនិយម"), moviesData.trending)}
      {renderMovieSection(t("Top Rated", "ពិន្ទុខ្ពស់បំផុត"), moviesData.topRated)}
      {renderMovieSection(t("Action & Adventure", "សកម្មភាព និងផ្សងព្រេង"), moviesData.action)}

      {/* ===== CUSTOM STYLES ===== */}
      <style>{`
        .animate-marquee {
          display: inline-flex;
          animation: marquee 25s linear infinite;
        }
        @keyframes marquee {
          0% { transform: translateX(0%); }
          100% { transform: translateX(-50%); }
        }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
}

export default Homes;