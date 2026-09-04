import React from "react";
import { FaFacebookF, FaTwitter, FaInstagram, FaYoutube } from "react-icons/fa";
import { useLanguage } from "../../context/LanguageContext";

function contact() {
  const { t } = useLanguage();

  return (
    <section className="bg-gray-900 text-gray-100 py-16 pt-24">
      <div className="max-w-7xl mx-auto px-6 grid md:grid-cols-2 gap-12">
        
        {/* Contact Form */}
        <div>
          <h2 className="text-4xl font-bold mb-4 text-red-500">
            {t("Contact Us", "ទាក់ទងយើង")}
          </h2>
          <p className="mb-6 text-gray-400 leading-relaxed">
            {t(
              "Have a question, suggestion, or want to collaborate with us? Fill out the form below and we'll get back to you as soon as possible.",
              "តើអ្នកមានសំណួរ ដំបូន្មាន ឬចង់សហការជាមួយយើងទេ? បំពេញទម្រង់ខាងក្រោម ហើយយើងនឹងឆ្លើយតបអ្នកឱ្យបានឆាប់តាមដែលអាចធ្វើបាន។"
            )}
          </p>

          <form className="space-y-5">
            <div>
              <label className="block mb-2 text-sm text-gray-400">
                {t("Your Name", "ឈ្មោះរបស់អ្នក")}
              </label>
              <input
                type="text"
                placeholder={t("Enter your name", "បញ្ចូលឈ្មោះរបស់អ្នក")}
                className="w-full p-3 rounded-lg bg-gray-800 border border-gray-700 focus:outline-none focus:border-red-500"
              />
            </div>

            <div>
              <label className="block mb-2 text-sm text-gray-400">
                {t("Email Address", "អាសយដ្ឋានអ៊ីមែល")}
              </label>
              <input
                type="email"
                placeholder={t("Enter your email", "បញ្ចូលអ៊ីមែលរបស់អ្នក")}
                className="w-full p-3 rounded-lg bg-gray-800 border border-gray-700 focus:outline-none focus:border-red-500"
              />
            </div>

            <div>
              <label className="block mb-2 text-sm text-gray-400">
                {t("Message", "សារ")}
              </label>
              <textarea
                placeholder={t("Write your message...", "សរសេរសាររបស់អ្នក...")}
                className="w-full h-32 p-3 rounded-lg bg-gray-800 border border-gray-700 focus:outline-none focus:border-red-500"
              ></textarea>
            </div>

            <button
              type="submit"
              className="bg-red-600 px-6 py-3 rounded-lg font-semibold hover:bg-red-700 transition-colors"
            >
              {t("Send Message", "ផ្ញើសារ")}
            </button>
          </form>
        </div>

        {/* Contact Details & Socials */}
        <div className="flex flex-col justify-center">
          <h3 className="text-3xl font-semibold mb-4 text-white">
            {t("Get in Touch", "ទាក់ទងមកយើង")}
          </h3>
          <p className="text-gray-400 mb-2">
            <strong>{t("Email", "អ៊ីមែល")}:</strong> contact@cinemahub.com
          </p>
          <p className="text-gray-400 mb-2">
            <strong>{t("Phone", "ទូរស័ព្ទ")}:</strong> +855 12 345 678
          </p>
          <p className="text-gray-400 mb-6">
            <strong>{t("Address", "អាសយដ្ឋាន")}:</strong>{" "}
            {t("Phnom Penh, Cambodia", "ភ្នំពេញ, កម្ពុជា")}
          </p>

          <h4 className="text-xl font-semibold mb-3 text-gray-300">
            {t("Follow Us", "តាមដានយើង")}
          </h4>
          <div className="flex gap-4 text-2xl">
            <a href="#" className="hover:text-red-500 transition">
              <FaFacebookF />
            </a>
            <a href="#" className="hover:text-red-500 transition">
              <FaInstagram />
            </a>
            <a href="#" className="hover:text-red-500 transition">
              <FaTwitter />
            </a>
            <a href="#" className="hover:text-red-500 transition">
              <FaYoutube />
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

export default contact;
