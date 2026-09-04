// Central API client for Lotus Cinema.
// In dev, Vite proxies /api -> http://localhost:4000 (see vite.config.js).
// In production (frontend on Vercel, backend on Render), VITE_API_URL
// points at the deployed backend, e.g. https://lotus-cinema-backend.onrender.com

const API_BASE = import.meta.env.VITE_API_URL || "";

const TOKEN_KEY = "lotus_token";
const USER_KEY = "lotus_user";

export const Auth = {
  get token() {
    return localStorage.getItem(TOKEN_KEY);
  },
  get user() {
    try {
      return JSON.parse(localStorage.getItem(USER_KEY));
    } catch {
      return null;
    }
  },
  save(token, user) {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    window.dispatchEvent(new Event("auth-change"));
  },
  clear() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    window.dispatchEvent(new Event("auth-change"));
  },
};

export async function api(path, { method = "GET", body } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (Auth.token) headers.Authorization = `Bearer ${Auth.token}`;

  const res = await fetch(`${API_BASE}/api${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Something went wrong");
  return data;
}

// convenience helpers
export const MoviesAPI = {
  list: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return api(`/movies${qs ? "?" + qs : ""}`);
  },
  get: (id) => api(`/movies/${id}`),
  genres: () => api(`/movies/genres`),
  addReview: (id, stars, comment) =>
    api(`/movies/${id}/reviews`, { method: "POST", body: { stars, comment } }),
  // manager
  create: (m) => api(`/movies`, { method: "POST", body: m }),
  update: (id, m) => api(`/movies/${id}`, { method: "PUT", body: m }),
  archive: (id) => api(`/movies/${id}`, { method: "DELETE" }),
};

export const ShowtimesAPI = {
  seats: (id) => api(`/showtimes/${id}/seats`),
  halls: () => api(`/showtimes/meta/halls`),
  byDate: (date) => api(`/showtimes/by-date/${date}`),
  calendar: (from, to) => api(`/showtimes/calendar/${from}/${to}`),
  create: (s) => api(`/showtimes`, { method: "POST", body: s }),
  // manager
  list: () => api(`/showtimes`),
  update: (id, s) => api(`/showtimes/${id}`, { method: "PUT", body: s }),
  remove: (id) => api(`/showtimes/${id}`, { method: "DELETE" }),
};

export const BookingsAPI = {
  create: (b) => api(`/bookings`, { method: "POST", body: b }),
  mine: () => api(`/bookings/mine`),
  get: (id) => api(`/bookings/${id}`),
  cancel: (id) => api(`/bookings/${id}/cancel`, { method: "POST" }),
};

export const FavoritesAPI = {
  list: () => api(`/favorites`),
  add: (movieId) => api(`/favorites/${movieId}`, { method: "POST" }),
  remove: (movieId) => api(`/favorites/${movieId}`, { method: "DELETE" }),
};

// Snacks & drinks (concessions)
export const ConcessionsAPI = {
  list: () => api(`/concessions`),
  listAll: () => api(`/concessions?all=1`),
  // manager
  create: (i) => api(`/concessions`, { method: "POST", body: i }),
  update: (id, i) => api(`/concessions/${id}`, { method: "PUT", body: i }),
  remove: (id) => api(`/concessions/${id}`, { method: "DELETE" }),
};

export const AcledaAPI = {
  status: () => api(`/acleda/status`),
  pay: (bookingId) => api(`/acleda/pay/${bookingId}`, { method: "POST" }),
  check: (bookingId) => api(`/acleda/check/${bookingId}`),
};

export const ManagerAPI = {
  dashboard: () => api(`/manager/dashboard`),
  bookings: () => api(`/manager/bookings`),
  occupancy: () => api(`/manager/occupancy`),
  reports: () => api(`/manager/reports`),
};

export const AuthAPI = {
  login: (email, password) =>
    api(`/auth/login`, { method: "POST", body: { email, password } }),
  register: (payload) => api(`/auth/register`, { method: "POST", body: payload }),
  me: () => api(`/auth/me`),
};