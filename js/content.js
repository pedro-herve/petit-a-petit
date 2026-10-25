// Loads lesson files and exposes the syllabus (study order) and the shared glossary.
import { normApos } from "./text.js";

const FILES = ["a1", "mamie", "a2", "b1", "b2", "c1"];

// Mamie units are interleaved where the learner already has the grammar they need.
const ORDER = [
  "a1-01", "a1-02", "a1-03", "m-01", "a1-04", "a1-05", "m-02", "a1-06", "a1-07", "a1-08", "m-03",
  "a1-09", "a1-10", "a1-11", "a1-12", "m-04", "a2-01", "a2-02", "m-05", "a2-03", "a2-04", "m-06",
  "a2-05", "a2-06", "a2-07", "a2-08", "a2-09", "a2-10", "a2-11", "a2-12",
  "b1-01", "b1-02", "b1-03", "b1-04", "b1-05", "b1-06", "b1-07", "b1-08", "b1-09", "b1-10",
  "b2-01", "b2-02", "b2-03", "b2-04", "b2-05", "b2-06", "b2-07", "b2-08", "b2-09", "b2-10",
  "c1-01", "c1-02", "c1-03", "c1-04", "c1-05", "c1-06", "c1-07", "c1-08", "c1-09", "c1-10",
];

// Each level is a Paris metro "line" with its own colour.
export const LEVELS = [
  { id: "A1", line: "1", color: "#FFCD00", ink: "#1c2540", title: "Primeiros passos em Paris", desc: "Cumprimentar, pedir, se localizar, falar de você e da família." },
  { id: "A2", line: "2", color: "#2c5cc5", ink: "#ffffff", title: "Paris au quotidien", desc: "Contar o passado, fazer planos, resolver a vida na cidade." },
  { id: "B1", line: "4", color: "#BE418D", ink: "#ffffff", title: "Parler vraiment", desc: "Opinar, levantar hipóteses, contar histórias, entender o francês da rua." },
  { id: "B2", line: "5", color: "#FF7E2E", ink: "#1c2540", title: "Aisance", desc: "Nuançar, debater, trabalhar e entender a França de hoje." },
  { id: "C1", line: "14", color: "#62259D", ink: "#ffffff", title: "Maîtrise", desc: "Registro, ironia, cultura, e uma carta para a Mamie." },
];
export const LEVEL_IDS = LEVELS.map((l) => l.id);
export const levelInfo = (id) => LEVELS.find((l) => l.id === id);
export const EXAM_PASS = 0.8;

const C = { units: new Map(), cards: new Map(), syllabus: [], gloss: {}, loaded: false };
export const content = C;

export async function loadContent() {
  const results = await Promise.all(
    FILES.map((f) =>
      fetch(`content/${f}.json`)
        .then((r) => (r.ok ? r.json() : []))
        .catch(() => [])
    )
  );
  C.base = results.flat();
  C.loaded = true;
}

// Rebuilds indexes with the user's imported lessons appended.
export function indexContent(custom = []) {
  C.units.clear();
  C.cards.clear();
  C.gloss = {};
  for (const u of [...(C.base || []), ...custom]) {
    C.units.set(u.id, u);
    for (const c of u.cards || []) C.cards.set(c.id, { ...c, unit: u.id });
    for (const [k, v] of Object.entries(u.glossary || {})) {
      const key = normApos(k).toLowerCase();
      if (!C.gloss[key]) C.gloss[key] = v;
    }
  }
  const known = ORDER.filter((id) => C.units.has(id));
  const rest = [...C.units.keys()].filter((id) => !ORDER.includes(id));
  C.syllabus = [...known, ...rest];
}

export const unit = (id) => C.units.get(id);
export const card = (id) => C.cards.get(id);

export const customUnits = () => C.syllabus.map(unit).filter((u) => u.id.startsWith("c-"));

// The stations of a level's line, in study order (Mamie units included where they fit).
export function lineOf(level) {
  return C.syllabus.map(unit).filter((u) => u.level === level && !u.id.startsWith("c-"));
}

export function unitProgress(state, id) {
  const u = unit(id);
  const total = u.cards.length;
  const added = u.cards.filter((c) => state.cards[c.id]).length;
  return { total, added, pct: total ? added / total : 0, done: total > 0 && added === total };
}

// ⭐ all sentences seen · ⭐⭐ mission done too · ⭐⭐⭐ every sentence mastered (3+ weeks interval)
export function stars(state, u) {
  const p = unitProgress(state, u.id);
  if (!p.done) return 0;
  const mission = !u.task || !!state.units[u.id]?.done;
  if (!mission) return 1;
  const mastered = u.cards.every((c) => (state.cards[c.id]?.ivl || 0) >= 21);
  return mastered ? 3 : 2;
}

export const levelPassed = (state, L) => !!state.levels?.[L]?.passed;
export function levelUnlocked(state, L) {
  const i = LEVEL_IDS.indexOf(L);
  return i <= 0 || levelPassed(state, LEVEL_IDS[i - 1]);
}

// Status of every station on a line: done · current · open · locked, plus the exam at the terminus.
export function levelState(state, L) {
  const unlocked = levelUnlocked(state, L);
  const passed = levelPassed(state, L);
  let prevDone = true;
  let currentSet = false;
  const stations = lineOf(L).map((u) => {
    const p = unitProgress(state, u.id);
    let status;
    if (p.done) status = "done";
    else if ((unlocked && prevDone) || passed || p.added > 0) {
      status = !currentSet && unlocked && !passed ? "current" : "open";
      if (status === "current") currentSet = true;
    } else status = "locked";
    prevDone = p.done;
    return { u, status, ...p, stars: stars(state, u) };
  });
  const allDone = stations.length > 0 && stations.every((s) => s.status === "done");
  const exam = passed ? "passed" : unlocked && allDone ? "ready" : "locked";
  return { L, unlocked, passed, stations, exam, doneCount: stations.filter((s) => s.status === "done").length, record: state.levels?.[L] || null };
}

export function unitStatus(state, id) {
  const u = unit(id);
  if (!u) return "locked";
  if (u.id.startsWith("c-")) return unitProgress(state, id).done ? "done" : "open";
  return levelState(state, u.level).stations.find((s) => s.u.id === id)?.status || "locked";
}
export const isUnitOpen = (state, id) => unitStatus(state, id) !== "locked";

// The level the learner is working on: the first one unlocked and not yet passed.
export function currentLevel(state) {
  return LEVEL_IDS.find((L) => levelUnlocked(state, L) && !levelPassed(state, L)) || LEVEL_IDS[LEVEL_IDS.length - 1];
}

// The next sentences to learn: the chosen unit (if open), then the current line, station by station.
// A station only follows once the previous one is complete, and a new line only after the exam.
export function nextNewCards(state, n) {
  if (n <= 0) return [];
  const out = [];
  const take = (u) => {
    for (const c of u.cards) {
      if (out.length >= n) return false;
      if (!state.cards[c.id] && !out.some((x) => x.id === c.id)) out.push(C.cards.get(c.id));
    }
    return out.length < n || u.cards.every((c) => state.cards[c.id] || out.some((x) => x.id === c.id));
  };
  if (state.focus && C.units.has(state.focus) && isUnitOpen(state, state.focus)) take(unit(state.focus));
  const L = currentLevel(state);
  if (!levelPassed(state, L))
    for (const u of lineOf(L)) {
      if (out.length >= n) break;
      if (!take(u)) break;
    }
  return out.slice(0, n);
}

export function currentUnit(state) {
  return nextNewCards(state, 1)[0]?.unit || null;
}

// The level whose terminus exam is waiting, if any.
export function examReady(state) {
  const L = currentLevel(state);
  return levelState(state, L).exam === "ready" ? L : null;
}

// Older profiles chose a starting level without a placement test: treat earlier levels as cleared.
export function migrateLevels(state) {
  const start = state.profile?.start;
  const skip = { a2: ["A1"], b1: ["A1", "A2"] }[start] || [];
  let changed = false;
  state.levels ||= {};
  for (const L of skip)
    if (!state.levels[L]) {
      state.levels[L] = { passed: state.profile.createdAt || Date.now(), via: "start" };
      changed = true;
    }
  return changed;
}
