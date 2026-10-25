// Hash router shared by all views.
let renderer = null;

export function setRenderer(fn) {
  renderer = fn;
}

export function route() {
  return location.hash.replace(/^#/, "") || "/hoje";
}

export function go(path) {
  if (route() !== path) location.hash = path;
  else rerender();
}

export function rerender() {
  renderer?.();
}
