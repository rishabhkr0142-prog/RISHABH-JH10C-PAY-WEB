"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTheme } from "./ThemeProvider";

export function NavbarThemeToggle() {
  const { theme, setTheme, themes } = useTheme();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const onClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const active = themes.find((t) => t.id === theme) || themes[0];

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 rounded-lg border border-theme-border bg-theme-surface px-2.5 py-1.5 text-xs font-medium text-neutral-200 transition hover:border-theme-border-hover hover:text-white"
        title="Switch Visual Theme / Colors"
        aria-label="Switch Design Theme"
      >
        <span
          className="h-2.5 w-2.5 rounded-full border border-black/40 shadow-sm"
          style={{ backgroundColor: active.primary }}
        />
        <span className="hidden sm:inline font-mono text-[11px]">{active.name}</span>
        <svg
          className={`h-3 w-3 text-neutral-400 transition-transform ${open ? "rotate-180" : ""}`}
          viewBox="0 0 12 12"
          fill="currentColor"
        >
          <path d="M6 8.5 1.5 4h9L6 8.5Z" />
        </svg>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-[calc(100%+8px)] z-50 w-56 rounded-xl border border-theme-border bg-theme-surface p-2 shadow-2xl backdrop-blur-xl"
          >
            <div className="border-b border-theme-border/50 px-2 pb-1.5 pt-0.5">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400">
                Design & Color Presets
              </p>
            </div>
            <div className="mt-1 space-y-1">
              {themes.map((t) => {
                const isSelected = t.id === theme;
                return (
                  <button
                    key={t.id}
                    onClick={() => {
                      setTheme(t.id);
                      setOpen(false);
                    }}
                    className={`flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-xs transition ${
                      isSelected
                        ? "bg-white/10 font-bold text-white shadow-sm"
                        : "text-neutral-300 hover:bg-white/5 hover:text-white"
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="flex items-center -space-x-1">
                        <span
                          className="h-3.5 w-3.5 rounded-full border border-black/60 shadow-sm"
                          style={{ backgroundColor: t.primary }}
                        />
                        <span
                          className="h-3 w-3 rounded-full border border-black/60 shadow-sm opacity-90"
                          style={{ backgroundColor: t.secondary }}
                        />
                      </div>
                      <div>
                        <p className="text-xs font-semibold leading-tight">{t.name}</p>
                        <p className="text-[10px] font-normal text-neutral-400 leading-tight">
                          {t.tagline}
                        </p>
                      </div>
                    </div>
                    {isSelected && (
                      <span className="font-mono text-xs text-white">✓</span>
                    )}
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** Floating Quick Theme Switcher on bottom corner */
export function FloatingThemeSwitcher() {
  const { theme, setTheme, themes } = useTheme();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const onClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const active = themes.find((t) => t.id === theme) || themes[0];

  return (
    <aside
      ref={ref}
      className="fixed bottom-5 right-5 z-40 hidden md:block"
      aria-label="Theme switcher controls"
    >
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            className="mb-3 w-60 rounded-xl border border-theme-border bg-theme-surface p-2.5 shadow-2xl backdrop-blur-xl"
          >
            <div className="border-b border-theme-border/50 px-2 pb-1.5 pt-0.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">
                Choose Design Theme
              </span>
            </div>
            <div className="mt-1 space-y-1">
              {themes.map((t) => {
                const isSelected = t.id === theme;
                return (
                  <button
                    key={t.id}
                    onClick={() => {
                      setTheme(t.id);
                      setOpen(false);
                    }}
                    className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-xs transition ${
                      isSelected
                        ? "bg-white/10 font-bold text-white shadow-sm"
                        : "text-neutral-300 hover:bg-white/5 hover:text-white"
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="flex items-center -space-x-1">
                        <span
                          className="h-3.5 w-3.5 rounded-full border border-black/60 shadow-sm"
                          style={{ backgroundColor: t.primary }}
                        />
                        <span
                          className="h-3 w-3 rounded-full border border-black/60 shadow-sm"
                          style={{ backgroundColor: t.secondary }}
                        />
                      </div>
                      <div className="text-left">
                        <p className="text-xs font-semibold">{t.name}</p>
                        <p className="text-[9px] text-neutral-400">{t.tagline}</p>
                      </div>
                    </div>
                    {isSelected && <span className="text-xs text-white">✓</span>}
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-full border border-theme-border bg-theme-surface px-3.5 py-2 shadow-xl backdrop-blur-md transition-all hover:scale-105 hover:border-theme-border-hover active:scale-95"
        title="Change Visual Theme"
      >
        <span
          className="h-3 w-3 rounded-full border border-black/40 shadow-sm animate-pulse"
          style={{ backgroundColor: active.primary }}
        />
        <span className="font-mono text-xs font-medium text-white">{active.name}</span>
        <span className="rounded bg-white/10 px-1.5 py-0.5 text-[9px] font-bold uppercase text-neutral-300">
          5 Themes
        </span>
      </button>
    </aside>
  );
}

