// Light / dark appearance: "auto" follows the phone, or the learner forces one.
// The choice is mirrored in localStorage so index.html can apply it before the first paint.
const KEY = "pap:theme";
const COLORS = { light: "#FBF7F0", dark: "#11151E" };

export function applyTheme(mode = "auto") {
  const root = document.documentElement;
  if (mode === "light" || mode === "dark") root.dataset.theme = mode;
  else delete root.dataset.theme;
  try {
    localStorage.setItem(KEY, mode);
  } catch {}
  const dark = mode === "dark" || (mode !== "light" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.setAttribute("content", dark ? COLORS.dark : COLORS.light));
}
