// src/components/Navbar.jsx
import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Heart, X, Languages, LogOut, LayoutDashboard, Ticket, Sun, Moon } from "lucide-react";
import { useLanguage } from "../../context/LanguageContext";
import { useAuth } from "../../context/AuthContext";
import { FavoritesAPI } from "../../api/client";
import { useTheme } from "../../context/ThemeContext";

function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const [favoritesCount, setFavoritesCount] = useState(0);
  const { isKhmer, toggleLanguage, t } = useLanguage();
  const { user, logout, isManager } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const closeMenu = () => setIsOpen(false);

  const handleLogout = () => {
    logout();
    closeMenu();
    navigate("/");
  };

  // Favorites count now comes from the database
  useEffect(() => {
    const updateFavorites = () => {
      if (!user) return setFavoritesCount(0);
      FavoritesAPI.list()
        .then((f) => setFavoritesCount(f.length))
        .catch(() => setFavoritesCount(0));
    };
    updateFavorites();
    window.addEventListener("favorites-change", updateFavorites);
    return () => window.removeEventListener("favorites-change", updateFavorites);
  }, [user]);

  const linkClasses =
    "relative text-sm font-semibold uppercase tracking-wide text-gray-200 transition-all duration-300 hover:text-red-500 before:content-[''] before:absolute before:-bottom-1 before:left-0 before:w-0 before:h-[2px] before:bg-red-500 before:transition-all before:duration-300 hover:before:w-full";

  return (
    <nav className="fixed top-0 w-full z-50 bg-black/40 backdrop-blur-sm border-b border-gray-800 shadow-[0_2px_20px_rgba(0,0,0,0.4)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Link
            to="/"
            className="flex items-center space-x-2 text-2xl font-extrabold text-white"
            onClick={closeMenu}
          >
            <img
              src="/videos/logo.png"
              alt="Logo"
              className="w-10 h-10 object-contain"
            />
            <span className="hidden sm:block tracking-wide">
              Lotus<span className="text-red-500">Cinema</span>
            </span>
          </Link>

          {/* Desktop Menu */}
          <div className="hidden md:flex space-x-8 items-center">
            <Link to="/" className={linkClasses}>
              {t("Home", "ទំព័រដើម")}
            </Link>
            <Link to="/products" className={linkClasses}>
              {t("Products", "ផលិតផល")}
            </Link>
            <Link to="/Movie" className={linkClasses}>
              {t("Movies", "ភាពយន្ត")}
            </Link>
            <Link to="/contact" className={linkClasses}>
              {t("Contact", "ទាក់ទង")}
            </Link>

            {/* Favorites */}
            <Link
              to="/favorites"
              className="relative flex items-center justify-center text-gray-200 hover:text-red-500 transition"
              title={t("Favorite Movies", "ភាពយន្តចំណូលចិត្ត")}
            >
              <Heart size={22} />
              {favoritesCount > 0 && (
                <span className="absolute -top-2 -right-2 bg-red-600 text-white text-xs rounded-full px-1.5">
                  {favoritesCount}
                </span>
              )}
            </Link>

            {/* Language Button */}
            <button
              onClick={toggleLanguage}
              className="flex items-center space-x-1 text-white bg-gray-800 px-3 py-2 rounded-lg text-sm font-semibold hover:bg-red-600 transition"
            >
              <Languages size={17} />
              <span>{isKhmer ? "EN" : "KM"}</span>
            </button>

            {/* Theme toggle */}
            <button
              onClick={toggleTheme}
              title={theme === "dark" ? "Light mode" : "Dark mode"}
              className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-200 transition"
            >
              {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
            </button>

            {/* Auth area */}
            {user ? (
              <div className="flex items-center gap-3">
                {isManager && (
                  <Link
                    to="/manager"
                    className="flex items-center gap-1.5 text-xs font-semibold text-[#a3c5b1] border border-[#6e957e]/60 px-3 py-2 rounded-lg hover:bg-[#6e957e]/20 transition"
                    title={t("Manager", "អ្នកគ្រប់គ្រង")}
                  >
                    <LayoutDashboard size={15} /> {t("Manager", "អ្នកគ្រប់គ្រង")}
                  </Link>
                )}
                <Link
                  to="/my-bookings"
                  className="flex items-center gap-1.5 text-xs font-semibold text-gray-200 hover:text-red-500 transition"
                  title={t("My Bookings", "ការកក់របស់ខ្ញុំ")}
                >
                  <Ticket size={16} /> {t("Tickets", "សំបុត្រ")}
                </Link>
                <span className="text-xs text-gray-400 hidden lg:block">
                  {user.username}
                </span>
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-1.5 text-white bg-gray-800 px-3 py-2 rounded-lg text-xs font-semibold hover:bg-red-600 transition"
                >
                  <LogOut size={14} /> {t("Logout", "ចេញ")}
                </button>
              </div>
            ) : (
              <Link
                to="/Login"
                className="text-white bg-gradient-to-r from-red-600 to-red-800 px-4 py-2 rounded-lg text-sm font-semibold hover:from-red-500 hover:to-red-700 transition duration-300"
              >
                {t("Login", "ចូលគណនី")}
              </Link>
            )}
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setIsOpen(true)}
            aria-label="Open Menu"
            className="md:hidden p-2 text-gray-300 hover:text-white hover:bg-gray-800/70 rounded focus:outline-none"
          >
            <svg
              className="h-6 w-6"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M4 6h16M4 12h16M4 18h16"
              />
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile Slide Menu */}
      <div
        className={`fixed top-0 right-0 h-full w-64 bg-black/95 backdrop-blur-md border-l border-gray-800 shadow-lg transform transition-transform duration-300 ease-in-out ${
          isOpen ? "translate-x-0" : "translate-x-full"
        } md:hidden z-50`}
      >
        {/* Close Button */}
        <div className="flex justify-between items-center p-4 border-b border-gray-800">
          <span className="text-xl font-bold text-white">
            Lotus<span className="text-red-500">Cinema</span>
          </span>
          <button
            onClick={closeMenu}
            aria-label="Close Menu"
            className="p-2 text-gray-400 hover:text-red-500 transition"
          >
            <X size={24} />
          </button>
        </div>

        {/* Menu Links */}
        <div className="flex flex-col space-y-6 p-6 text-center">
          <Link to="/" onClick={closeMenu} className={linkClasses}>
            {t("Home", "ទំព័រដើម")}
          </Link>
          <Link to="/products" onClick={closeMenu} className={linkClasses}>
            {t("Products", "ផលិតផល")}
          </Link>
          <Link to="/Movie" onClick={closeMenu} className={linkClasses}>
            {t("Movies", "ភាពយន្ត")}
          </Link>
          <Link to="/contact" onClick={closeMenu} className={linkClasses}>
            {t("Contact", "ទាក់ទង")}
          </Link>

          <Link
            to="/favorites"
            onClick={closeMenu}
            className="flex items-center justify-center space-x-2 text-gray-200 hover:text-red-500 transition"
          >
            <Heart size={22} />
            {favoritesCount > 0 && (
              <span className="text-sm font-semibold">
                {favoritesCount} {t("Favorites", "ចំណូលចិត្ត")}
              </span>
            )}
          </Link>

          {/* Language Button (Mobile) */}
          <button
            onClick={toggleLanguage}
            className="flex items-center justify-center space-x-2 text-white bg-gray-800 px-4 py-2 rounded-lg text-sm font-semibold hover:bg-red-600 transition"
          >
            <Languages size={18} />
            <span>{isKhmer ? "EN" : "KM"}</span>
          </button>

          <button
            onClick={toggleTheme}
            className="flex items-center justify-center gap-2 text-gray-200 bg-gray-800 px-4 py-2 rounded-lg text-sm font-semibold"
          >
            {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
            {theme === "dark" ? "Light mode" : "Dark mode"}
          </button>

          {/* Auth (mobile) */}
          {user ? (
            <>
              {isManager && (
                <Link
                  to="/manager"
                  onClick={closeMenu}
                  className="flex items-center justify-center gap-2 text-[#a3c5b1] border border-[#6e957e]/60 px-4 py-2 rounded-lg text-sm font-semibold"
                >
                  <LayoutDashboard size={16} /> {t("Manager", "អ្នកគ្រប់គ្រង")}
                </Link>
              )}
              <Link
                to="/my-bookings"
                onClick={closeMenu}
                className="flex items-center justify-center gap-2 text-gray-200 hover:text-red-500 text-sm font-semibold"
              >
                <Ticket size={16} /> {t("My Bookings", "ការកក់របស់ខ្ញុំ")}
              </Link>
              <button
                onClick={handleLogout}
                className="flex items-center justify-center gap-2 text-white bg-gray-800 px-4 py-2 rounded-lg text-sm font-semibold hover:bg-red-600 transition"
              >
                <LogOut size={16} /> {t("Logout", "ចេញ")} ({user.username})
              </button>
            </>
          ) : (
            <Link
              to="/Login"
              onClick={closeMenu}
              className="text-white bg-gradient-to-r from-red-600 to-red-800 px-4 py-2 rounded-lg text-sm font-semibold hover:from-red-500 hover:to-red-700 transition duration-300"
            >
              {t("Login", "ចូលគណនី")}
            </Link>
          )}
        </div>
      </div>

      {/* Overlay */}
      {isOpen && (
        <div
          onClick={closeMenu}
          className="fixed inset-0 bg-black/50 backdrop-blur-sm md:hidden"
        ></div>
      )}
    </nav>
  );
}

export default Navbar;