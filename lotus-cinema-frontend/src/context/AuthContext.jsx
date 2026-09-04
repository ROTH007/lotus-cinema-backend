import React, { createContext, useContext, useEffect, useState } from "react";
import { Auth, AuthAPI } from "../api/client";

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(Auth.user);

  useEffect(() => {
    const sync = () => setUser(Auth.user);
    window.addEventListener("auth-change", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("auth-change", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const login = async (email, password) => {
    const { token, user } = await AuthAPI.login(email, password);
    Auth.save(token, user);
    setUser(user);
    return user;
  };

  const register = async (payload) => {
    const { token, user } = await AuthAPI.register(payload);
    Auth.save(token, user);
    setUser(user);
    return user;
  };

  const logout = () => {
    Auth.clear();
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{ user, login, register, logout, isManager: user?.role === "MANAGER" }}
    >
      {children}
    </AuthContext.Provider>
  );
}
