import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";
import { parseThemePreference, resolveTheme, THEME_BOOTSTRAP, THEME_MEDIA_QUERY, THEME_STORAGE_KEY } from "./theme";
import { clerkAppearance } from "./clerk-appearance";

describe("theme preference boundary and prepaint parity", () => {
  for (const value of [null, undefined, "system", "light", "dark", "Dark", "", "<script>", {}, 0]) {
    for (const prefersDark of [false, true]) it(`resolves ${JSON.stringify(value)} with dark OS ${prefersDark}`, () => {
      const root = { dataset: {}, style: {} };
      runInNewContext(THEME_BOOTSTRAP, {
        document: { documentElement: root },
        localStorage: { getItem(key: string) { expect(key).toBe(THEME_STORAGE_KEY); return value; } },
        window: { matchMedia(query: string) { expect(query).toBe(THEME_MEDIA_QUERY); return { matches: prefersDark }; } },
      });
      const preference = parseThemePreference(value);
      const theme = resolveTheme(preference, prefersDark);
      expect(root).toEqual({ dataset: { theme, themePreference: preference }, style: { colorScheme: theme } });
    });
  }
  it("uses System when storage is denied", () => {
    const root = { dataset: {}, style: {} };
    runInNewContext(THEME_BOOTSTRAP, {
      document: { documentElement: root },
      get localStorage() { throw new Error("denied"); },
      window: { matchMedia: () => ({ matches: true }) },
    });
    expect(root.dataset).toEqual({ theme: "dark", themePreference: "system" });
  });
  it("gives Clerk concrete contrasting input and action colors", () => {
    expect(clerkAppearance("dark").variables).toMatchObject({ colorInput: "#171713", colorInputForeground: "#f0eee7", colorPrimary: "#f0eee7", colorPrimaryForeground: "#171713" });
    expect(clerkAppearance("light").variables).toMatchObject({ colorInput: "#ffffff", colorInputForeground: "#171713" });
  });
});
