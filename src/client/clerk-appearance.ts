import type { ResolvedTheme } from "./theme";

export function clerkAppearance(theme: ResolvedTheme) {
  const dark = theme === "dark";
  return { variables: {
    colorPrimary: dark ? "#ffffff" : "#000000",
    colorPrimaryForeground: dark ? "#000000" : "#ffffff",
    colorForeground: dark ? "#ffffff" : "#000000",
    colorNeutral: dark ? "#ffffff" : "#000000",
    colorMutedForeground: dark ? "#b5b5b5" : "#666666",
    colorBackground: dark ? "#181818" : "#ffffff",
    colorInput: dark ? "#000000" : "#ffffff",
    colorInputForeground: dark ? "#ffffff" : "#000000",
    borderRadius: "0.125rem",
    fontFamily: "var(--homepage-sans), Arial, sans-serif",
  } };
}
