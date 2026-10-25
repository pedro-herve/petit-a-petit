// FSRS-5 (Free Spaced Repetition Scheduler) with its published default parameters.
// Reference: https://github.com/open-spaced-repetition/fsrs4anki/wiki/The-Algorithm
import { dayStart } from "./time.js";

const W = [0.40255, 1.18385, 3.173, 15.69105, 7.1949, 0.5345, 1.4604, 0.0046, 1.54575, 0.1192, 1.01925, 1.9395, 0.11, 0.29605, 2.2698, 0.2315, 2.9898, 0.51655, 0.6621];
const DECAY = -0.5;
const FACTOR = 19 / 81; // makes R = 90% when elapsed time equals stability
const RETENTION = 0.9;
const MAX_DAYS = 3650;
const DAY = 86400000;
const RELEARN_MS = 10 * 60000;

export const AGAIN = 1, HARD = 2, GOOD = 3, EASY = 4;

const clampD = (d) => Math.min(10, Math.max(1, d));
const initS = (g) => W[g - 1];
const initD = (g) => clampD(W[4] - Math.exp(W[5] * (g - 1)) + 1);

export function retrievability(elapsedDays, s) {
  return Math.pow(1 + (FACTOR * elapsedDays) / s, DECAY);
}

function intervalDays(s) {
  return (s / FACTOR) * (Math.pow(RETENTION, 1 / DECAY) - 1);
}

function nextD(d, g) {
  const damped = d + (-W[6] * (g - 3) * (10 - d)) / 9;
  return clampD(W[7] * initD(EASY) + (1 - W[7]) * damped);
}

function recallS(d, s, r, g) {
  const hard = g === HARD ? W[15] : 1;
  const easy = g === EASY ? W[16] : 1;
  return s * (1 + Math.exp(W[8]) * (11 - d) * Math.pow(s, -W[9]) * (Math.exp(W[10] * (1 - r)) - 1) * hard * easy);
}

function forgetS(d, s, r) {
  return Math.min(s, W[11] * Math.pow(d, -W[12]) * (Math.pow(s + 1, W[13]) - 1) * Math.exp(W[14] * (1 - r)));
}

function shortTermS(s, g) {
  return s * Math.exp(W[17] * (g - 3 + W[18]));
}

function memory(card, g, now) {
  if (!card || !card.reps) return { s: initS(g), d: initD(g) };
  const elapsed = Math.max(0, (now - card.last) / DAY);
  let s;
  if (elapsed < 1) s = shortTermS(card.s, g);
  else {
    const r = retrievability(elapsed, card.s);
    s = g === AGAIN ? forgetS(card.d, card.s, r) : recallS(card.d, card.s, r, g);
  }
  return { s: Math.max(0.1, s), d: nextD(card.d, g) };
}

// Returns the card state after each of the four ratings: { 1: card, 2: card, 3: card, 4: card }.
export function preview(card, now = Date.now()) {
  const out = {};
  const days = {};
  for (const g of [AGAIN, HARD, GOOD, EASY]) {
    const { s, d } = memory(card, g, now);
    out[g] = {
      ...(card || {}),
      s,
      d,
      reps: (card?.reps || 0) + 1,
      lapses: (card?.lapses || 0) + (g === AGAIN && card?.reps ? 1 : 0),
      last: now,
    };
    if (g !== AGAIN) days[g] = Math.min(MAX_DAYS, Math.max(1, Math.round(intervalDays(s))));
  }
  // Keep Hard < Good < Easy so every button means something different.
  days[HARD] = Math.min(days[HARD], days[GOOD]);
  days[GOOD] = Math.max(days[GOOD], days[HARD] + 1);
  days[EASY] = Math.max(days[EASY], days[GOOD] + 1);

  out[AGAIN].state = card?.reps ? "relearning" : "learning";
  out[AGAIN].due = now + RELEARN_MS;
  out[AGAIN].ivl = 0;
  for (const g of [HARD, GOOD, EASY]) {
    out[g].state = "review";
    out[g].ivl = days[g];
    out[g].due = dayStart(now) + days[g] * DAY;
  }
  return out;
}

export function schedule(card, g, now = Date.now()) {
  return preview(card, now)[g];
}

export function formatInterval(ms) {
  const min = Math.round(ms / 60000);
  if (min < 60) return `${Math.max(1, min)} min`;
  const days = Math.round(ms / DAY);
  if (days < 1) return `${Math.round(min / 60)} h`;
  if (days < 30) return days === 1 ? "1 dia" : `${days} dias`;
  if (days < 365) {
    const m = Math.round(days / 30);
    return m === 1 ? "1 mês" : `${m} meses`;
  }
  const y = Math.round(days / 365);
  return y === 1 ? "1 ano" : `${y} anos`;
}

export const MATURITY_LABEL = { nova: "nova", aprendendo: "aprendendo", jovem: "firmando", madura: "dominada" };

// How well-known a card is, for the notebook and progress screens.
export function maturity(card) {
  if (!card || !card.reps) return "nova";
  if (card.state !== "review" || card.ivl < 7) return "aprendendo";
  if (card.ivl < 21) return "jovem";
  return "madura";
}
