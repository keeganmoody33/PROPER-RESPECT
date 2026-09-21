"use client";

import { createContext, useCallback, useContext, useLayoutEffect, useRef, useState } from "react";
import { parseThemePreference, resolveTheme, THEME_MEDIA_QUERY, THEME_STORAGE_KEY, type ResolvedTheme, type ThemePreference } from "@/src/client/theme";

type ThemeContextValue = {
  preference: ThemePreference;
  resolved: ResolvedTheme;
  setPreference: (value: ThemePreference) => void;
};
const ThemeContext = createContext<ThemeContextValue | null>(null);

function applyTheme(preference: ThemePreference, prefersDark: boolean) {
  const resolved = resolveTheme(preference, prefersDark);
  document.documentElement.dataset.theme = resolved;
  document.documentElement.dataset.themePreference = preference;
  document.documentElement.style.colorScheme = resolved;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>("system");
  const [prefersDark, setPrefersDark] = useState(false);
  const currentPreference = useRef<ThemePreference>("system");
  const media = useRef<MediaQueryList | null>(null);

  const updatePreference = useCallback((value: ThemePreference) => {
    currentPreference.current = value;
    setPreferenceState(value);
    applyTheme(value, media.current?.matches ?? false);
  }, []);

  useLayoutEffect(() => {
    const query = window.matchMedia(THEME_MEDIA_QUERY);
    media.current = query;
    const synchronize = () => {
      let value: ThemePreference = "system";
      try { value = parseThemePreference(localStorage.getItem(THEME_STORAGE_KEY)); } catch {}
      setPrefersDark(query.matches);
      updatePreference(value);
    };
    synchronize();
    const onMediaChange = () => {
      setPrefersDark(query.matches);
      applyTheme(currentPreference.current, query.matches);
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key !== THEME_STORAGE_KEY && event.key !== null) return;
      try { if (event.storageArea !== window.localStorage) return; } catch { return; }
      synchronize();
    };
    query.addEventListener("change", onMediaChange);
    window.addEventListener("storage", onStorage);
    return () => {
      query.removeEventListener("change", onMediaChange);
      window.removeEventListener("storage", onStorage);
    };
  }, [updatePreference]);

  const setPreference = useCallback((value: ThemePreference) => {
    const parsed = parseThemePreference(value);
    updatePreference(parsed);
    try { localStorage.setItem(THEME_STORAGE_KEY, parsed); } catch {}
  }, [updatePreference]);

  return <ThemeContext.Provider value={{ preference, resolved: resolveTheme(preference, prefersDark), setPreference }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const theme = useContext(ThemeContext);
  if (!theme) throw new Error("Theme controls require ThemeProvider");
  return theme;
}
