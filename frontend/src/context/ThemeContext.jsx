import React, { createContext, useContext, useEffect, useState } from "react";

const ThemeContext = createContext();
export const useTheme = () => useContext(ThemeContext);

const KEY = "lotus_theme";

export function ThemeProvider({ children }) {
  // remembered choice, else follow the OS setting
  // Cinema sites are dark by default; only a saved choice overrides it.
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem(KEY);
    return saved === "light" ? "light" : "dark";
  });

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("light", theme === "light");
    root.classList.toggle("dark", theme === "dark");
    root.style.colorScheme = theme;
    localStorage.setItem(KEY, theme);
  }, [theme]);

  const toggleTheme = () => setTheme((t) => (t === "dark" ? "light" : "dark"));

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, isLight: theme === "light" }}>
      {children}
    </ThemeContext.Provider>
  );
}