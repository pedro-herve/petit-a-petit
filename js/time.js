// The study day starts at 4 a.m., so a late-night session still counts for "today".
const OFFSET = 4 * 3600000;
const pad = (n) => String(n).padStart(2, "0");

export function dayKey(ts = Date.now()) {
  const d = new Date(ts - OFFSET);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function dayStart(ts = Date.now()) {
  const d = new Date(ts - OFFSET);
  d.setHours(0, 0, 0, 0);
  return d.getTime() + OFFSET;
}

export function dayEnd(ts = Date.now()) {
  return dayStart(ts) + 86400000;
}

export function addDays(key, n) {
  const [y, m, d] = key.split("-").map(Number);
  const date = new Date(y, m - 1, d + n, 12);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
