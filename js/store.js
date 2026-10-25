// Local-first state, one copy per account, kept in localStorage.
// Cloud sync (js/auth.js) merges remote copies into this state; nothing here talks to the network.
import { dayKey, addDays } from "./time.js";

const KEY = "pap:state:";
const CURRENT = "pap:current";
const listeners = new Set();
let accountId = null;
let state = null;

export const DEFAULT_SETTINGS = { voice: "", rate: 0.92, autoplay: true, showPt: false, reminder: "19:00" };

function blank() {
  return {
    v: 1,
    profile: null, // { name, minutes, start, email, createdAt, updatedAt }
    settings: { ...DEFAULT_SETTINGS, updatedAt: 0 },
    cards: {}, // cardId -> FSRS state + { added }
    units: {}, // unitId -> { seen, done }
    focus: null, // unit chosen in "Trilha" to study next
    days: {}, // "YYYY-MM-DD" -> { sec, reviews, again, news, sessions }
    custom: [], // lessons imported by the user
    updatedAt: 0,
  };
}

function read(id) {
  try {
    const raw = localStorage.getItem(KEY + id);
    return raw ? { ...blank(), ...JSON.parse(raw) } : blank();
  } catch {
    return blank();
  }
}

export function currentAccount() {
  try {
    return localStorage.getItem(CURRENT);
  } catch {
    return null;
  }
}

export function open(id) {
  accountId = id;
  try {
    localStorage.setItem(CURRENT, id);
  } catch {}
  state = read(id);
  return state;
}

export function close() {
  try {
    localStorage.removeItem(CURRENT);
  } catch {}
  accountId = null;
  state = null;
}

export function get() {
  return state;
}

export function account() {
  return accountId;
}

export function persist({ silent = false, touch = true } = {}) {
  if (!state || !accountId) return;
  if (touch) state.updatedAt = Date.now();
  try {
    localStorage.setItem(KEY + accountId, JSON.stringify(state));
  } catch (e) {
    console.warn("Não foi possível salvar", e);
  }
  if (!silent) for (const fn of listeners) fn(state);
}

export function update(fn) {
  fn(state);
  persist();
}

export function onChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function replace(next, { silent = false } = {}) {
  state = { ...blank(), ...next };
  persist({ silent, touch: !silent });
}

// Wipes this device's copy of an account (used when signing out).
export function forget(id) {
  try {
    localStorage.removeItem(KEY + id);
  } catch {}
}

export function hasLocalProgress() {
  const s = read("local");
  return Object.keys(s.cards).length > 0 ? s : null;
}

// ---------- merge (used by sync and by backup import) ----------

export function merge(a, b) {
  const out = blank();
  const newer = (x, y) => ((x?.updatedAt || 0) >= (y?.updatedAt || 0) ? x : y);
  out.profile = newer(a.profile, b.profile) || a.profile || b.profile;
  out.settings = { ...DEFAULT_SETTINGS, ...newer(a.settings, b.settings) };
  out.focus = (a.updatedAt || 0) >= (b.updatedAt || 0) ? a.focus : b.focus;

  for (const src of [a.cards || {}, b.cards || {}])
    for (const [id, c] of Object.entries(src)) {
      const cur = out.cards[id];
      if (!cur || (c.last || 0) > (cur.last || 0) || (!cur.last && c.added)) out.cards[id] = c;
    }
  for (const src of [a.units || {}, b.units || {}])
    for (const [id, u] of Object.entries(src)) {
      const cur = out.units[id] || {};
      out.units[id] = { seen: Math.min(cur.seen || Infinity, u.seen || Infinity), done: cur.done || u.done || null };
      if (!isFinite(out.units[id].seen)) delete out.units[id].seen;
    }
  for (const src of [a.days || {}, b.days || {}])
    for (const [k, d] of Object.entries(src)) {
      const cur = out.days[k] || {};
      out.days[k] = Object.fromEntries(["sec", "reviews", "again", "news", "sessions"].map((f) => [f, Math.max(cur[f] || 0, d[f] || 0)]));
    }
  const custom = new Map();
  for (const u of [...(a.custom || []), ...(b.custom || [])]) custom.set(u.id, u);
  out.custom = [...custom.values()];
  out.updatedAt = Math.max(a.updatedAt || 0, b.updatedAt || 0);
  return out;
}

// ---------- study log ----------

export function logDay(fields) {
  const k = dayKey();
  const d = (state.days[k] ||= { sec: 0, reviews: 0, again: 0, news: 0, sessions: 0 });
  for (const [f, v] of Object.entries(fields)) d[f] = (d[f] || 0) + v;
}

export function today() {
  return state.days[dayKey()] || { sec: 0, reviews: 0, again: 0, news: 0, sessions: 0 };
}

export function streak() {
  const studied = (k) => (state.days[k]?.sessions || 0) > 0;
  let k = dayKey();
  if (!studied(k)) k = addDays(k, -1);
  let n = 0;
  while (studied(k)) {
    n++;
    k = addDays(k, -1);
  }
  return n;
}

// New sentences per day grows with the time the learner chose (≈ 0.6 per minute).
export function newPerDay(minutes) {
  return Math.min(30, Math.max(3, Math.round(minutes * 0.6)));
}
