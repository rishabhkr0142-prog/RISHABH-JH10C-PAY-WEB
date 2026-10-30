"use client";

import { createContext, useContext, useEffect, useState } from "react";

export const THEMES = [
  {
    id: "mono",
    name: "Vercel Mono",
    tagline: "Minimalist B&W",
    primary: "#ffffff",
    secondary: "#a1a1a1",
    bg: "#000000",
    dot: "bg-white",
  },
  {
    id: "cyber",
    name: "Cyber Neon",
    tagline: "Purple & Cyan",
    primary: "#8b5cf6",
    secondary: "#06b6d4",
    bg: "#070712",
    dot: "bg-purple-500",
  },
  {
    id: "emerald",
    name: "Emerald Obsidian",
    tagline: "Supabase Mint",
    primary: "#10b981",
    secondary: "#34d399",
    bg: "#050c08",
    dot: "bg-emerald-500",
  },
  {
    id: "crimson",
    name: "Sunset Crimson",
    tagline: "Velvet Rose",
    primary: "#f43f5e",
    secondary: "#f59e0b",
    bg: "#0c0608",
    dot: "bg-rose-500",
  },
  {
    id: "sapphire",
    name: "Deep Sapphire",
    tagline: "Raycast Blue",
    primary: "#3b82f6",
    secondary: "#38bdf8",
    bg: "#040914",
    dot: "bg-blue-500",
  },
];

const ThemeContext = createContext({
  theme: "mono",
  setTheme: () => {},
  themes: THEMES,
});

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState("mono");

  useEffect(() => {
    try {
      const stored = localStorage.getItem("jh10c_theme");
      if (stored && THEMES.some((t) => t.id === stored)) {
        setThemeState(stored);
        document.documentElement.setAttribute("data-theme", stored);
      } else {
        document.documentElement.setAttribute("data-theme", "mono");
      }
    } catch (e) {}
  }, []);

  const setTheme = (newTheme) => {
    if (!THEMES.some((t) => t.id === newTheme)) return;
    setThemeState(newTheme);
    try {
      localStorage.setItem("jh10c_theme", newTheme);
      document.documentElement.setAttribute("data-theme", newTheme);
    } catch (e) {}
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, themes: THEMES }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}

