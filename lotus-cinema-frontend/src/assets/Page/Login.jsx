import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import "@fortawesome/fontawesome-free/css/all.min.css";
import { useLanguage } from "../../context/LanguageContext";
import { useAuth } from "../../context/AuthContext";

function Login() {
  const { t } = useLanguage();
  const { login, register } = useAuth();
  const navigate = useNavigate();

  const [mode, setMode] = useState("login"); // 'login' | 'signup'
  const [form, setForm] = useState({ username: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      let user;
      if (mode === "login") {
        user = await login(form.email, form.password);
      } else {
        user = await register({
          username: form.username,
          email: form.email,
          password: form.password,
        });
      }
      navigate(user.role === "MANAGER" ? "/manager" : "/Movie");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center bg-cover bg-center px-4 sm:px-6 md:px-10"
      style={{
        backgroundImage:
          "url('https://i.pinimg.com/1200x/19/8b/2f/198b2f01e73b905772279616eccc7c65.jpg')",
      }}
    >
      <div className="w-full max-w-5xl border border-gray-600 rounded-[30px] p-4 sm:p-6 md:p-8 text-white font-sans bg-black/90 backdrop-blur-sm">
        <div className="flex flex-col md:flex-row bg-black rounded-[24px] overflow-hidden">
          {/* Left Section */}
          <div className="w-full md:w-1/2 bg-[#1A1A1A] p-6 flex flex-col items-center justify-center">
            <div className="flex flex-col items-center">
              <img
                src="/videos/logo.png"
                alt="Logo"
                className="w-20 sm:w-28 md:w-32 mb-2 drop-shadow-lg"
              />
              <h1 className="text-2xl sm:text-3xl font-bold text-[#a3c5b1] tracking-wide">
                Lotus Cinema
              </h1>
            </div>

            {/* Mode toggle */}
            <div className="mt-4 flex gap-2 bg-[#111] rounded-lg p-1">
              <button
                onClick={() => setMode("login")}
                className={`text-xs sm:text-sm px-6 py-2 rounded-md font-semibold transition ${
                  mode === "login" ? "bg-[#6e957e] text-[#0d0d0d]" : "text-[#a3c5b1]"
                }`}
              >
                {t("LOGIN", "ចូលគណនី")}
              </button>
              <button
                onClick={() => setMode("signup")}
                className={`text-xs sm:text-sm px-6 py-2 rounded-md font-semibold transition ${
                  mode === "signup" ? "bg-[#6e957e] text-[#0d0d0d]" : "text-[#a3c5b1]"
                }`}
              >
                {t("SIGN UP", "ចុះឈ្មោះ")}
              </button>
            </div>

            <h2 className="text-center text-xl sm:text-2xl font-semibold my-4">
              {t("Welcome!", "សូមស្វាគមន៍!")}
            </h2>

            <p className="text-center text-[11px] sm:text-sm leading-relaxed text-gray-300">
              {t(
                "Welcome to Lotus Cinema. Log in to book seats, or sign up to get started.",
                "សូមស្វាគមន៍មកកាន់ Lotus Cinema។ ចូលគណនីដើម្បីកក់កៅអី ឬចុះឈ្មោះថ្មី។"
              )}
            </p>

            <form onSubmit={submit} className="mt-6 w-[80%] sm:w-[70%] space-y-3">
              {mode === "signup" && (
                <div className="relative">
                  <i className="fa-solid fa-user absolute left-3 top-2.5 text-gray-400 text-sm"></i>
                  <input
                    type="text"
                    value={form.username}
                    onChange={set("username")}
                    placeholder={t("Username", "ឈ្មោះអ្នកប្រើប្រាស់")}
                    className="w-full h-[38px] bg-transparent border border-[#3b3b3b] rounded px-9 text-sm focus:outline-none focus:border-[#6e957e] transition"
                  />
                </div>
              )}

              <div className="relative">
                <i className="fa-solid fa-envelope absolute left-3 top-2.5 text-gray-400 text-sm"></i>
                <input
                  type="text"
                  value={form.email}
                  onChange={set("email")}
                  placeholder={t("Email or username", "អ៊ីមែល ឬ ឈ្មោះ")}
                  className="w-full h-[38px] bg-transparent border border-[#3b3b3b] rounded px-9 text-sm focus:outline-none focus:border-[#6e957e] transition"
                />
              </div>

              <div className="relative">
                <i className="fa-solid fa-lock absolute left-3 top-2.5 text-gray-400 text-sm"></i>
                <input
                  type="password"
                  value={form.password}
                  onChange={set("password")}
                  placeholder={t("Password", "ពាក្យសម្ងាត់")}
                  className="w-full h-[38px] bg-transparent border border-[#3b3b3b] rounded px-9 text-sm focus:outline-none focus:border-[#6e957e] transition"
                />
              </div>

              {error && <p className="text-red-400 text-xs">{error}</p>}

              <button
                type="submit"
                disabled={busy}
                className="w-full mt-3 bg-[#6e957e] text-[#0d0d0d] text-sm py-2 rounded-md font-semibold hover:bg-[#7da88d] transition disabled:opacity-60"
              >
                {busy
                  ? "…"
                  : mode === "login"
                  ? t("Log In", "ចូលគណនី")
                  : t("Create Account", "បង្កើតគណនី")}
              </button>
            </form>

            {/* Demo hint */}
            <p className="text-[10px] text-gray-500 mt-4 text-center leading-relaxed">
              {t("Demo — Manager:", "សាកល្បង — អ្នកគ្រប់គ្រង:")} manager@lotus.com / manager123
              <br />
              {t("Customer:", "អតិថិជន:")} sophea@mail.com / user123
            </p>
          </div>

          {/* Right Section */}
          <div className="w-full md:w-1/2">
            <img
              src="https://i.pinimg.com/1200x/a4/56/84/a456849c8a44dde3e65a0821a0dce138.jpg"
              alt="login-banner"
              className="w-full h-full object-cover"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default Login;
