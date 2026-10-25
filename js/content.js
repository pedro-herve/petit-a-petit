// Loads lesson files and exposes the syllabus (study order) and the shared glossary.
import { normApos } from "./text.js";

const FILES = ["a1", "mamie", "a2", "b1"];

// Mamie units are interleaved where the learner already has the grammar they need.
const ORDER = [
  "a1-01", "a1-02", "a1-03", "m-01", "a1-04", "a1-05", "m-02", "a1-06", "a1-07", "a1-08", "m-03",
  "a1-09", "a1-10", "a1-11", "a1-12", "m-04", "a2-01", "a2-02", "m-05", "a2-03", "a2-04", "m-06",
  "a2-05", "a2-06", "a2-07", "a2-08", "a2-09", "a2-10", "a2-11", "a2-12",
  "b1-01", "b1-02", "b1-03", "b1-04", "b1-05", "b1-06", "b1-07", "b1-08", "b1-09", "b1-10",
];

export const LEVELS = [
  { id: "A1", title: "Primeiros passos em Paris", desc: "Cumprimentar, pedir, se localizar, falar de você e da família." },
  { id: "A2", title: "Paris au quotidien", desc: "Contar o passado, fazer planos, resolver a vida na cidade." },
  { id: "B1", title: "Parler vraiment", desc: "Opinar, levantar hipóteses, contar histórias, entender o francês da rua." },
  { id: "B2", title: "Aisance", desc: "Em construção. Por enquanto, gere lições novas com IA em Praticar." },
  { id: "C1", title: "Maîtrise", desc: "Em construção. Conteúdo autêntico, nuances e registro." },
];

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

export function unitsOf(level, track) {
  return C.syllabus.map(unit).filter((u) => u.level === level && (!track || (u.track === "mamie") === (track === "mamie")) && !u.id.startsWith("c-"));
}

export const customUnits = () => C.syllabus.map(unit).filter((u) => u.id.startsWith("c-"));

export function startIndex(start) {
  const first = { a1: "a1-01", a2: "a2-01", b1: "b1-01", mamie: "a1-01" }[start] || "a1-01";
  return Math.max(0, C.syllabus.indexOf(first));
}

// The next sentences to learn: focused unit first, then syllabus order from the learner's starting point.
export function nextNewCards(state, n) {
  if (n <= 0) return [];
  const order = [];
  if (state.focus && C.units.has(state.focus)) order.push(state.focus);
  const s = startIndex(state.profile?.start);
  order.push(...C.syllabus.slice(s), ...C.syllabus.slice(0, s));
  const seen = new Set();
  const out = [];
  for (const id of order) {
    if (seen.has(id)) continue;
    seen.add(id);
    for (const c of unit(id).cards) {
      if (!state.cards[c.id]) out.push(C.cards.get(c.id));
      if (out.length >= n) return out;
    }
  }
  return out;
}

export function unitProgress(state, id) {
  const u = unit(id);
  const total = u.cards.length;
  const added = u.cards.filter((c) => state.cards[c.id]).length;
  return { total, added, pct: total ? added / total : 0, done: added === total };
}

// The learner's working level: the highest level among units they've started.
export function currentLevel(state) {
  const rank = { A1: 1, A2: 2, B1: 3, B2: 4, C1: 5 };
  let best = state.profile?.start === "a2" ? "A2" : state.profile?.start === "b1" ? "B1" : "A1";
  for (const id of Object.keys(state.units)) {
    const u = unit(id);
    if (u && rank[u.level] > rank[best]) best = u.level;
  }
  return best;
}

export function currentUnit(state) {
  return nextNewCards(state, 1)[0]?.unit || null;
}
