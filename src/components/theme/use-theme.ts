"use client";

import { useCallback, useSyncExternalStore } from "react";
import { DEFAULT_THEME, THEME_KEY } from "./theme-script";

export type ThemePreference = "light" | "dark" | "system";

const listeners = new Set<() => void>();

function read(): ThemePreference {
  try {
    const v = localStorage.getItem(THEME_KEY);
    return v === "light" || v === "dark" || v === "system" ? v : DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
}

function apply(pref: ThemePreference) {
  const dark = pref === "dark" || (pref === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
  document.documentElement.style.colorScheme = dark ? "dark" : "light";
}

export function useTheme() {
  const theme = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    read,
    () => DEFAULT_THEME as ThemePreference,
  );
  const setTheme = useCallback((pref: ThemePreference) => {
    try {
      localStorage.setItem(THEME_KEY, pref);
    } catch {
      // storage unavailable — still apply for this session
    }
    apply(pref);
    listeners.forEach((l) => l());
  }, []);
  return { theme, setTheme };
}
