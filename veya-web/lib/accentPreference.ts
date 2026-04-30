export type AccentPreference = "brand" | "white";

export const ACCENT_PREFERENCE_VALUES: AccentPreference[] = ["brand", "white"];

export function applyAccentPreferenceToDocument(value: AccentPreference) {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.accentPreference = value;
  const theme = value === "white" ? "light" : "dark";
  document.documentElement.dataset.theme = theme;
  try {
    localStorage.setItem("veya_theme", theme);
    localStorage.setItem("veya_accent_preference", value);
  } catch {
    // ignore
  }
}

export function clearAccentPreferenceFromDocument() {
  if (typeof document === "undefined") return;
  delete document.documentElement.dataset.accentPreference;
  // Signed-out users should see the default Veya dark shell, not an unset theme.
  document.documentElement.dataset.theme = "dark";
  try {
    localStorage.removeItem("veya_theme");
    localStorage.removeItem("veya_accent_preference");
  } catch {
    // ignore
  }
}
