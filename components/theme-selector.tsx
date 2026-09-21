"use client";

import { useTheme } from "@/components/theme-provider";
import { parseThemePreference } from "@/src/client/theme";

export function ThemeSelector() {
  const { preference, setPreference } = useTheme();
  return <label className="theme-selector">
    <span>Appearance</span>
    <select aria-label="Appearance" value={preference} onChange={event => setPreference(parseThemePreference(event.target.value))}>
      <option value="system">System</option>
      <option value="light">Light</option>
      <option value="dark">Dark</option>
    </select>
  </label>;
}
