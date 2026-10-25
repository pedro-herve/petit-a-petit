// Text utilities shared by the app and by tools/validate.mjs.

// A token is a run of letters, optionally joined by apostrophes or hyphens,
// optionally ending in an apostrophe (elision): "j'ai", "aujourd'hui", "qu'est-ce", "l'".
export const TOKEN_RE = /\p{L}+(?:['’-]\p{L}+)*['’]?/gu;

export function normApos(s) {
  return String(s).replace(/[’‘]/g, "'");
}

export function tokens(text) {
  return normApos(text).match(TOKEN_RE) || [];
}

// "j'ai" -> ["j'", "ai"]; "qu'est-ce" -> ["qu'", "est", "ce"]; "appelles-tu" -> ["appelles", "tu"]
export function pieces(token) {
  return normApos(token).toLowerCase().split(/(?<=')|-/).filter(Boolean);
}

// Returns [[form, gloss|null], ...] for a token, trying the whole token first.
export function lookup(token, gloss) {
  const t = normApos(token).toLowerCase();
  if (gloss[t]) return [[t, gloss[t]]];
  return pieces(t).map((p) => [p, gloss[p] ?? null]);
}

export function isCovered(token, gloss) {
  return lookup(token, gloss).every(([, g]) => g);
}

// Proper names that never need a glossary entry.
export const NAMES = new Set(["léo", "hélène", "camille", "bernard", "lucie", "thomas", "sophie", "julien", "marc", "paul", "anne", "marie", "pierre"]);

// Loose comparison for dictation/typing: lowercase, no punctuation, single spaces.
export function normalizeAnswer(s, { keepAccents = true } = {}) {
  let t = normApos(s).toLowerCase().replace(/œ/g, "oe").replace(/æ/g, "ae");
  if (!keepAccents) t = t.normalize("NFD").replace(/\p{M}/gu, "");
  return t.replace(/['-]/g, " ").replace(/[^\p{L}\p{N} ]/gu, " ").replace(/\s+/g, " ").trim();
}

const plain = (w) => w.normalize("NFD").replace(/\p{M}/gu, "");

// Word-level comparison of an answer with the expected sentence.
// Returns { words: [{ w, status: "ok" | "accent" | "missing" }], extra: [...], score: 0..1 }.
export function compare(expected, answer) {
  const target = normalizeAnswer(expected).split(" ").filter(Boolean);
  const given = normalizeAnswer(answer).split(" ").filter(Boolean);
  const n = target.length, m = given.length;
  const L = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--)
    for (let j = m - 1; j >= 0; j--)
      L[i][j] = plain(target[i]) === plain(given[j]) ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
  const words = [];
  const extra = [];
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (plain(target[i]) === plain(given[j])) {
      words.push({ w: target[i], status: target[i] === given[j] ? "ok" : "accent", typed: given[j] });
      i++;
      j++;
    } else if (L[i + 1][j] >= L[i][j + 1]) words.push({ w: target[i++], status: "missing" });
    else extra.push(given[j++]);
  }
  while (i < n) words.push({ w: target[i++], status: "missing" });
  while (j < m) extra.push(given[j++]);
  const score = n ? words.reduce((s, x) => s + (x.status === "ok" ? 1 : x.status === "accent" ? 0.7 : 0), 0) / Math.max(n, m) : 0;
  return { words, extra, score };
}

// French typography: thin no-break space before ? ! : ; and inside « ».
export function typo(s) {
  return normApos(s).replace(/'/g, "’").replace(/\s+([?!:;»])/g, " $1").replace(/«\s*/g, "« ");
}
