import React from "react";
import { Link } from "react-router-dom";
import { FaFacebookF, FaTwitter, FaInstagram, FaYoutube } from "react-icons/fa";
import { useLanguage } from "../../context/LanguageContext";


function Footer() {
  const { t } = useLanguage() ;

  return (
    <footer className="bg-gray-900 text-gray-300 py-10">
      <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 md:grid-cols-4 gap-8">
        
        {/* Brand */}
        <div>
          <h2 className="text-2xl font-bold text-white">
            🎬 {t("MovieStore", "ហាងភាពយន្ត")}
          </h2>
          <p className="mt-3 text-gray-400 text-sm">
            {t(
              "Your gateway to movies. Stream, discover, and enjoy!",
              "ផ្លូវរបស់អ្នកទៅកាន់ភាពយន្ត។ មើល រកឃើញ និងរីករាយ!"
            )}
          </p>

          {/* Social Icons */}
          <div className="flex space-x-4 mt-4">
            <a href="https://www.facebook.com/profile.php?id=100088013036387" className="hover:text-blue-400 text-xl">
              <FaFacebookF />
            </a>
            <a href="#" className="hover:text-blue-400 text-xl">
              <FaTwitter />
            </a>
            <a href="#" className="hover:text-blue-400 text-xl">
              <FaInstagram />
            </a>
            <a href="#" className="hover:text-blue-400 text-xl">
              <FaYoutube />
            </a>
          </div>
        </div>

        {/* Quick Links */}
        <div>
          <h3 className="text-lg font-semibold text-white mb-3">
            {t("Quick Links", "តំណភ្ជាប់រហ័ស")}
          </h3>
          <ul className="space-y-2 text-sm">
            <li>
              <Link to="/" className="hover:text-blue-400">
                {t("Home", "ទំព័រដើម")}
              </Link>
            </li>
            <li>
              <Link to="/Movie" className="hover:text-blue-400">
                {t("Movies", "ភាពយន្ត")}
              </Link>
            </li>
            <li>
              <Link to="/products" className="hover:text-blue-400">
                {t("Pricing", "តម្លៃ")}
              </Link>
            </li>
            <li>
              <Link to="/contact" className="hover:text-blue-400">
                {t("Contact", "ទាក់ទង")}
              </Link>
            </li>
          </ul>
        </div>

        {/* Categories */}
        <div>
          <h3 className="text-lg font-semibold text-white mb-3">
            {t("Categories", "ប្រភេទ")}
          </h3>
          <ul className="space-y-2 text-sm">
            <li>
              <Link to="/category/action" className="hover:text-blue-400">
                {t("Action", "សកម្មភាព")}
              </Link>
            </li>
            <li>
              <Link to="/category/comedy" className="hover:text-blue-400">
                {t("Comedy", "កំប្លែង")}
              </Link>
            </li>
            <li>
              <Link to="/category/romance" className="hover:text-blue-400">
                {t("Romance", "រ៉ូមែនទិក")}
              </Link>
            </li>
            <li>
              <Link to="/category/sci-fi" className="hover:text-blue-400">
                {t("Sci-Fi", "វិទ្យាសាស្ត្រប្រឌិត")}
              </Link>
            </li>
          </ul>
        </div>

        {/* Newsletter */}
        <div>
          <h3 className="text-lg font-semibold text-white mb-3">
            {t("Stay Updated", "ទទួលបានព័ត៌មានថ្មីៗ")}
          </h3>
          <p className="text-sm text-gray-400 mb-3">
            {t(
              "Subscribe to get the latest movies & offers.",
              "ជាវដើម្បីទទួលបានភាពយន្តថ្មីៗ និងការផ្តល់ជូន។"
            )}
          </p>
          <form className="flex">
            <input
              type="email"
              placeholder={t("Your email", "អ៊ីមែលរបស់អ្នក")}
              className="w-full px-3 py-2 rounded-l-lg bg-gray-800 text-gray-200 focus:outline-none"
            />
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-r-lg hover:bg-blue-500 transition"
            >
              {t("Subscribe", "ជាវ")}
            </button>
          </form>
        </div>
      </div>

      {/* Bottom Footer */}
      <div className="border-t border-gray-700 mt-10 pt-6 text-center text-sm text-gray-500">
        © 2025 {t("MovieStore. All rights reserved.", "ហាងភាពយន្ត។ រក្សាសិទ្ធិគ្រប់យ៉ាង។")}
      </div>
    </footer>
  );
}

export default Footer;