// Validates content JSON files against content/SPEC.md.
// Usage: node tools/validate.mjs content/a1.json [content/a2.json ...]
import { readFileSync } from "node:fs";
import { tokens, isCovered, lookup, NAMES } from "../js/text.js";

const LEVELS = new Set(["A1", "A2", "B1", "B2", "C1"]);
const TRACKS = new Set(["main", "mamie"]);
let failed = false;
const seenFr = new Map(); // across all files given

function err(where, msg) {
  failed = true;
  console.log(`  ✗ ${where}: ${msg}`);
}
function warn(where, msg) {
  console.log(`  ! ${where}: ${msg}`);
}
const isStr = (v) => typeof v === "string" && v.trim().length > 0;

for (const file of process.argv.slice(2)) {
  console.log(`\n${file}`);
  let units;
  try {
    units = JSON.parse(readFileSync(file, "utf8"));
  } catch (e) {
    err(file, `JSON inválido: ${e.message}`);
    continue;
  }
  if (!Array.isArray(units)) {
    err(file, "o arquivo deve conter um array de unidades");
    continue;
  }

  const gloss = {};
  for (const u of units) Object.assign(gloss, Object.fromEntries(Object.entries(u.glossary || {}).map(([k, v]) => [k.toLowerCase().replace(/’/g, "'"), v])));

  const seenIds = new Set();
  let cardTotal = 0;

  for (const u of units) {
    const w = u.id || "(sem id)";
    if (!/^(a1|a2|b1|b2|c1)-\d{2}$|^m-\d{2}$|^c-[a-z0-9-]+$/.test(u.id || "")) err(w, "id inválido");
    if (seenIds.has(u.id)) err(w, "id duplicado");
    seenIds.add(u.id);
    if (!LEVELS.has(u.level)) err(w, `level inválido: ${u.level}`);
    if (!TRACKS.has(u.track)) err(w, `track inválido: ${u.track}`);
    for (const f of ["title", "titlePt", "goal"]) if (!isStr(u[f])) err(w, `campo ${f} ausente`);

    const lines = u.dialogue?.lines;
    if (!isStr(u.dialogue?.title) || !isStr(u.dialogue?.context)) err(w, "dialogue.title/context ausentes");
    if (!Array.isArray(lines) || lines.length < 6) err(w, "dialogue.lines precisa de pelo menos 6 falas");
    else if (lines.length > 16) warn(w, `diálogo longo (${lines.length} falas)`);
    (lines || []).forEach((l, i) => {
      if (!isStr(l.who) || !isStr(l.fr) || !isStr(l.pt)) err(`${w} fala ${i + 1}`, "precisa de who, fr, pt");
    });

    const cards = u.cards || [];
    if (cards.length < 12 || cards.length > 18) err(w, `${cards.length} cards (esperado 14–16)`);
    cards.forEach((c, i) => {
      const expected = `${u.id}-${String(i + 1).padStart(2, "0")}`;
      if (c.id !== expected) err(w, `card ${i + 1} com id ${c.id}, esperado ${expected}`);
      if (!isStr(c.fr) || !isStr(c.pt)) err(c.id, "card precisa de fr e pt");
      if (c.note && c.note.length > 200) warn(c.id, "note longa");
      const key = (c.fr || "").toLowerCase().replace(/[^\p{L} ]/gu, "").trim();
      if (seenFr.has(key)) warn(c.id, `card repetido (igual a ${seenFr.get(key)})`);
      seenFr.set(key, c.id);
    });
    cardTotal += cards.length;

    const pq = u.pourquoi || [];
    if (pq.length < 1 || pq.length > 3) err(w, "pourquoi precisa de 1–3 itens");
    pq.forEach((p, i) => {
      if (!isStr(p.title) || !isStr(p.body)) err(`${w} pourquoi ${i + 1}`, "precisa de title e body");
      const words = (p.body || "").split(/\s+/).length;
      if (words > 200) warn(`${w} pourquoi ${i + 1}`, `body com ${words} palavras`);
      if (!Array.isArray(p.examples) || p.examples.length < 1) err(`${w} pourquoi ${i + 1}`, "precisa de examples");
    });
    if (!isStr(u.task?.pt) || !isStr(u.task?.model)) err(w, "task.pt/task.model ausentes");

    const texts = [
      ...(lines || []).map((l) => l.fr),
      ...cards.map((c) => c.fr),
      ...pq.flatMap((p) => (p.examples || []).map((e) => e.fr)),
      u.task?.model || "",
    ];
    const missing = new Set();
    for (const t of texts) {
      for (const tok of tokens(t || "")) {
        if (NAMES.has(tok.toLowerCase())) continue;
        if (!isCovered(tok, gloss)) {
          for (const [form, g] of lookup(tok, gloss)) if (!g && !NAMES.has(form)) missing.add(form);
        }
      }
    }
    if (missing.size) err(w, `glossário sem: ${[...missing].join(", ")}`);
    for (const t of texts) if (/[<>]/.test(t || "")) err(w, "não use < ou > no texto");
  }
  console.log(`  ${units.length} unidades, ${cardTotal} cards, ${Object.keys(gloss).length} entradas no glossário`);
}
console.log(failed ? "\nFALHOU" : "\nOK");
process.exit(failed ? 1 : 0);
