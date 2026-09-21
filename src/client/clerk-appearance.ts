import type { ResolvedTheme } from "./theme";

export function clerkAppearance(theme: ResolvedTheme) {
  const dark = theme === "dark";
  return { variables: {
    colorPrimary: dark ? "#f0eee7" : "#171713",
    colorPrimaryForeground: dark ? "#171713" : "#fbfaf6",
    colorForeground: dark ? "#f0eee7" : "#171713",
    colorNeutral: dark ? "#f0eee7" : "#171713",
    colorMutedForeground: dark ? "#b8b6ac" : "#706f68",
    colorBackground: dark ? "#24241f" : "#fbfaf6",
    colorInput: dark ? "#171713" : "#ffffff",
    colorInputForeground: dark ? "#f0eee7" : "#171713",
    borderRadius: "0.125rem",
    fontFamily: "var(--homepage-sans), Arial, sans-serif",
  } };
}
