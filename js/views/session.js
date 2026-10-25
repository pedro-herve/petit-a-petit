// The study session: builds the step list from the learner's time budget and plays it.
import * as store from "../store.js";
import { content, nextNewCards, unit, card as getCard, currentLevel } from "../content.js";
import { preview, schedule, formatInterval, AGAIN, HARD, GOOD, EASY } from "../fsrs.js";
import { dayEnd } from "../time.js";
import { h, mount, icon, frText, md, speakBtn, toast, confirmSheet } from "../ui.js";
import { speak, stopSpeaking, canRecord, startRecording, canRecognize, listen } from "../speech.js";
import { compare, typo } from "../text.js";
import { PROVIDERS, correctionPrompt, sendTo } from "../ai.js";
import { go } from "../nav.js";
import { syncNow } from "../sync.js";

// Rough seconds per activity, used to fit the session into the chosen daily time.
const COST = { review: 12, learn: 40, dialogue: 120, pourquoi: 45, dictation: 25 };

const shuffle = (a) => {
  const b = [...a];
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
};

export function dueIds(state, now = Date.now()) {
  return Object.entries(state.cards)
    .filter(([id, c]) => c.due <= dayEnd(now) && content.cards.has(id))
    .sort((a, b) => a[1].due - b[1].due)
    .map(([id]) => id);
}

// What today's session will contain, given the minutes the learner chose.
export function planToday(state, { minutes = state.profile.minutes, allowNew = true } = {}) {
  const budget = minutes * 60;
  const due = dueIds(state);
  const reviews = due.slice(0, Math.max(15, Math.floor((budget * 1.5) / COST.review)));
  let left = budget - reviews.length * COST.review - 2 * COST.dictation;
  const cap = allowNew ? Math.max(0, store.newPerDay(minutes) - store.today().news) : 0;
  const news = [];
  const intro = new Set();
  let secs = reviews.length * COST.review;
  for (const c of nextNewCards(state, cap)) {
    const u = unit(c.unit);
    let cost = COST.learn;
    const needsIntro = !state.units[u.id]?.seen && !intro.has(u.id);
    if (needsIntro) cost += COST.dialogue + COST.pourquoi * (u.pourquoi?.length || 0);
    const starter = news.length < 3 && reviews.length < 10;
    if (left < cost && !starter) break;
    news.push(c);
    if (needsIntro) intro.add(u.id);
    left -= cost;
    secs += cost;
  }
  if (reviews.length + news.length) secs += 2 * COST.dictation;
  return { reviews, news, dueTotal: due.length, cap, minutes: Math.max(1, Math.round(secs / 60)) };
}

function reviewMode(c) {
  if (!c || (c.ivl || 0) < 3) return Math.random() < 0.5 ? "recognize" : "listen";
  return Math.random() < 0.65 ? "produce" : "listen";
}

function newSteps(state, news) {
  const steps = [];
  let i = 0;
  while (i < news.length) {
    const u = unit(news[i].unit);
    const group = [];
    while (i < news.length && news[i].unit === u.id) group.push(news[i++]);
    if (!state.units[u.id]?.seen) {
      steps.push({ type: "intro", unit: u.id }, { type: "dialogue", unit: u.id });
      (u.pourquoi || []).forEach((_, k) => steps.push({ type: "pourquoi", unit: u.id, index: k }));
    }
    for (let j = 0; j < group.length; j += 4) {
      const chunk = group.slice(j, j + 4);
      for (const c of chunk) steps.push({ type: "learn", id: c.id });
      for (const c of shuffle(chunk)) steps.push({ type: "review", id: c.id, mode: "produce", first: true });
    }
    const remaining = u.cards.filter((c) => !state.cards[c.id] && !group.some((g) => g.id === c.id));
    if (!remaining.length && u.task) steps.push({ type: "task", unit: u.id });
  }
  return steps;
}

function dictationSteps(state, n, extra = []) {
  const learned = Object.entries(state.cards)
    .filter(([id]) => content.cards.has(id))
    .sort((a, b) => (b[1].last || 0) - (a[1].last || 0))
    .slice(0, 40)
    .map(([id]) => id);
  const pool = [...new Set([...extra, ...learned])];
  return shuffle(pool).slice(0, n).map((id) => ({ type: "dictation", id }));
}

export function buildDaily(state, opts = {}) {
  const p = planToday(state, opts);
  const steps = shuffle(p.reviews).map((id) => ({ type: "review", id, mode: reviewMode(state.cards[id]) }));
  steps.push(...newSteps(state, p.news));
  if (steps.length) steps.push(...dictationSteps(state, 2, p.news.map((c) => c.id)));
  return steps;
}

export function buildExtraNew(state, n) {
  const news = nextNewCards(state, n);
  return [...newSteps(state, news), ...dictationSteps(state, 2, news.map((c) => c.id))];
}

export function buildPractice(state, kind, n = 10) {
  const learned = shuffle(Object.keys(state.cards).filter((id) => content.cards.has(id))).slice(0, n);
  if (kind === "dictation") return learned.map((id) => ({ type: "dictation", id }));
  if (kind === "listen") return learned.map((id) => ({ type: "review", id, mode: "listen", practice: true }));
  if (kind === "produce") return learned.map((id) => ({ type: "review", id, mode: "produce", practice: true }));
  if (kind === "unit") return []; // filled by caller
  return [];
}

// ---------------------------------------------------------------------------
// Player

let S = null; // { steps, idx, title, tick, sec, counted, stats, requeued }

export function start(steps, { title = "Sessão de hoje", daily = false } = {}) {
  if (!steps.length) {
    toast("Nada para estudar agora.");
    return;
  }
  S = { steps: [...steps, { type: "done" }], idx: 0, title, daily, tick: Date.now(), sec: 0, counted: false, stats: { reviews: 0, again: 0, news: 0 }, requeued: {} };
  go("/sessao");
}

export const active = () => S;

function addTime() {
  const now = Date.now();
  const d = Math.min(120, Math.round((now - S.tick) / 1000));
  S.tick = now;
  S.sec += d;
  store.logDay({ sec: d });
}

function next(root) {
  stopSpeaking();
  addTime();
  S.idx++;
  if (!S.counted && S.idx >= 3) {
    S.counted = true;
    store.logDay({ sessions: 1 });
  }
  store.persist();
  renderSession(root);
}

function exit() {
  stopSpeaking();
  if (S) addTime();
  store.persist();
  S = null;
  syncNow();
  go("/hoje");
}

export function renderSession(root) {
  if (!S) return go("/hoje");
  const step = S.steps[S.idx];
  const total = S.steps.length - 1;
  const pct = Math.min(1, S.idx / Math.max(1, total));
  const body = h("div", { class: "session-body" });
  root.replaceChildren(
    h("div", { class: "session" },
      h("header", { class: "session-top" },
        h("button", {
          class: "icon-btn",
          "aria-label": "Sair da sessão",
          onclick: () => (step.type === "done" || S.idx === 0 ? exit() : confirmSheet("Sair da sessão?", "O que você já fez fica salvo.", "Sair", exit)),
        }, icon("x")),
        h("div", { class: "bar" }, h("div", { class: "bar-fill", style: { width: `${pct * 100}%` } })),
        h("span", { class: "session-count" }, step.type === "done" ? "" : `${S.idx + 1}/${total}`)
      ),
      body
    )
  );
  const R = { intro, dialogue, pourquoi, learn, review, dictation, task, done }[step.type];
  R(body, step, () => next(root));
  window.scrollTo(0, 0);
}

const chip = (text, cls = "") => h("span", { class: `chip ${cls}` }, text);

function unitLabel(u) {
  if (u.track === "mamie") return `Trilha Mamie · ${u.level}`;
  if (u.id.startsWith("c-")) return `Minha lição · ${u.level}`;
  return `${u.level} · Unidade ${Number(u.id.slice(3))}`;
}

// ---------- steps ----------

function intro(el, step, done) {
  const u = unit(step.unit);
  store.update((s) => {
    s.units[u.id] = { ...(s.units[u.id] || {}), seen: s.units[u.id]?.seen || Date.now() };
  });
  el.append(
    h("div", { class: "step intro-step" },
      chip(unitLabel(u), u.track === "mamie" ? "rose" : ""),
      h("h1", { class: "display" }, typo(u.title)),
      h("p", { class: "lead" }, u.titlePt),
      u.goal && h("div", { class: "goal" }, icon("star"), h("div", null, h("b", null, "Você vai conseguir: "), u.goal)),
      u.culture && h("div", { class: "culture" }, h("b", null, "Culture · "), u.culture)
    ),
    h("div", { class: "step-actions" }, h("button", { class: "btn primary big", onclick: done }, icon("headphones"), "Ouvir o diálogo"))
  );
}

function bubble(line, i, { hidden = false, showPt = false } = {}) {
  const me = /^léo$/i.test(line.who);
  return h("div", { class: `bubble ${me ? "me" : ""}`, "data-i": i },
    h("div", { class: "who" }, line.who),
    hidden
      ? h("div", { class: "fr hidden-line" }, "• • • • • • •")
      : h("div", { class: "bubble-text" }, frText(line.fr), h("div", { class: "pt", hidden: !showPt }, line.pt)),
    !hidden && speakBtn(line.fr, { cls: "small" })
  );
}

async function playLines(lines, list, from = 0) {
  for (let i = from; i < lines.length; i++) {
    if (!list.isConnected) return;
    list.querySelectorAll(".bubble").forEach((b) => b.classList.toggle("playing", Number(b.dataset.i) === i));
    list.querySelector(`[data-i="${i}"]`)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    await speak(lines[i].fr);
    await new Promise((r) => setTimeout(r, 350));
  }
  list.querySelectorAll(".bubble").forEach((b) => b.classList.remove("playing"));
}

export function dialogueView(u, { startHidden = true, onDone } = {}) {
  const lines = u.dialogue.lines;
  let phase = startHidden ? "listen" : "read";
  let showPt = store.get().settings.showPt;
  const wrap = h("div", { class: "step" });
  const draw = () => {
    const list = h("div", { class: "dialogue" }, lines.map((l, i) => bubble(l, i, { hidden: phase === "listen", showPt })));
    wrap.replaceChildren(
      h("div", { class: "dialogue-head" },
        chip(phase === "listen" ? "1 · Escute sem ler" : "2 · Leia e toque nas palavras"),
        h("h2", null, typo(u.dialogue.title)),
        h("p", { class: "muted" }, u.dialogue.context)
      ),
      h("div", { class: "row gap wrap" },
        h("button", { class: "btn soft", onclick: () => playLines(lines, list) }, icon("play"), "Tocar tudo"),
        phase === "read" && h("button", { class: `btn soft ${showPt ? "on" : ""}`, onclick: () => { showPt = !showPt; draw(); } }, icon("eye"), showPt ? "Esconder tradução" : "Mostrar tradução")
      ),
      list,
      h("div", { class: "step-actions" },
        phase === "listen"
          ? h("button", { class: "btn primary big", onclick: () => { stopSpeaking(); phase = "read"; draw(); } }, "Mostrar o texto")
          : onDone && h("button", { class: "btn primary big", onclick: onDone }, "Continuar")
      )
    );
    if (phase === "listen" && store.get().settings.autoplay) setTimeout(() => playLines(lines, list), 400);
  };
  draw();
  return wrap;
}

function dialogue(el, step, done) {
  el.append(dialogueView(unit(step.unit), { onDone: done }));
}

export function pourquoiView(p) {
  return h("div", { class: "pourquoi" },
    h("h2", null, p.title),
    md(p.body),
    h("div", { class: "examples" },
      (p.examples || []).map((e) => h("div", { class: "example" }, speakBtn(e.fr, { cls: "small" }), h("div", null, frText(e.fr), h("div", { class: "pt" }, e.pt))))
    )
  );
}

function pourquoi(el, step, done) {
  const p = unit(step.unit).pourquoi[step.index];
  el.append(
    h("div", { class: "step" }, chip("Pourquoi ?", "gold"), pourquoiView(p)),
    h("div", { class: "step-actions" }, h("button", { class: "btn primary big", onclick: done }, "Entendi"))
  );
}

function shadowTools(text) {
  const box = h("div", { class: "shadow" });
  const res = h("div", { class: "shadow-result" });
  if (canRecord()) {
    let rec = null;
    let mine = null;
    const btn = h("button", { class: "btn soft" }, icon("mic"), "Gravar minha voz");
    btn.onclick = async () => {
      if (!rec) {
        try {
          stopSpeaking();
          rec = await startRecording();
          btn.replaceChildren(icon("stop"), "Parar");
          btn.classList.add("recording");
        } catch {
          toast("Permita o microfone para gravar.");
        }
      } else {
        const url = await rec.stop();
        rec = null;
        btn.replaceChildren(icon("mic"), "Gravar de novo");
        btn.classList.remove("recording");
        mine = new Audio(url);
        res.replaceChildren(
          h("div", { class: "row gap" },
            h("button", { class: "btn ghost small", onclick: () => mine.play() }, icon("play"), "Minha voz"),
            h("button", { class: "btn ghost small", onclick: () => speak(text) }, icon("volume"), "Original")
          )
        );
        mine.play();
      }
    };
    box.append(btn);
  }
  if (canRecognize()) {
    box.append(
      h("button", {
        class: "btn soft",
        onclick: async (e) => {
          const b = e.currentTarget;
          b.disabled = true;
          b.replaceChildren(icon("mic"), "Ouvindo…");
          try {
            const alts = await listen();
            const best = alts.map((a) => compare(text, a)).sort((x, y) => y.score - x.score)[0];
            res.replaceChildren(best ? diffView(best, alts[0]) : h("p", { class: "muted" }, "Não ouvi nada. Tente de novo."));
          } catch {
            res.replaceChildren(h("p", { class: "muted" }, "O reconhecimento de voz não está disponível agora."));
          }
          b.disabled = false;
          b.replaceChildren(icon("sparkle"), "Testar pronúncia");
        },
      }, icon("sparkle"), "Testar pronúncia")
    );
  }
  return box.childElementCount ? h("div", null, box, res) : null;
}

function diffView(result, heard) {
  const pct = Math.round(result.score * 100);
  return h("div", { class: "diff" },
    h("div", { class: "diff-words" }, result.words.map((w) => h("span", { class: `dw ${w.status}` }, w.w))),
    result.extra.length ? h("div", { class: "muted small" }, "A mais: ", result.extra.join(" ")) : null,
    heard != null && h("div", { class: "muted small" }, `Entendi: “${heard}”`),
    h("div", { class: `score ${pct >= 90 ? "good" : pct >= 60 ? "mid" : "low"}` }, `${pct}%`)
  );
}

function learn(el, step, done) {
  const c = getCard(step.id);
  el.append(
    h("div", { class: "step card-step" },
      chip("Nova frase", "blue"),
      h("div", { class: "big-fr" }, frText(c.fr)),
      h("div", { class: "row gap center" }, speakBtn(c.fr, { cls: "round" }), speakBtn(c.fr, { slow: true, cls: "round" })),
      h("div", { class: "big-pt" }, c.pt),
      c.note && h("div", { class: "note" }, icon("info"), h("span", null, c.note)),
      h("p", { class: "hint" }, "Ouça e repita em voz alta 2 ou 3 vezes, imitando a melodia."),
      shadowTools(c.fr)
    ),
    h("div", { class: "step-actions" }, h("button", { class: "btn primary big", onclick: done }, "Continuar"))
  );
  if (store.get().settings.autoplay) setTimeout(() => speak(c.fr), 250);
}

function hintFor(fr) {
  return typo(fr).replace(/\p{L}+/gu, (w) => w[0] + "·".repeat(Math.max(0, Math.min(w.length - 1, 6))));
}

function review(el, step, done) {
  const c = getCard(step.id);
  const st = store.get().cards[step.id];
  const mode = step.mode;
  let typed = "";
  const prompts = {
    recognize: "O que essa frase quer dizer?",
    listen: "Ouça. Você entende?",
    produce: "Como se diz em francês?",
  };

  const ask = h("div", { class: "step card-step" });
  const input = h("textarea", { class: "answer", rows: 2, placeholder: "Escreva em francês (opcional)", autocapitalize: "off", autocomplete: "off", autocorrect: "off", spellcheck: "false", lang: "fr" });
  const hint = h("div", { class: "hint-letters", hidden: true }, hintFor(c.fr));

  mount(ask, 
    chip(step.first ? "Primeira tentativa" : step.practice ? "Prática" : "Revisão", step.first ? "blue" : ""),
    h("p", { class: "prompt" }, prompts[mode]),
    mode === "recognize" && h("div", { class: "big-fr" }, frText(c.fr)),
    mode === "recognize" && h("div", { class: "row center" }, speakBtn(c.fr, { cls: "round" })),
    mode === "listen" && h("div", { class: "row gap center listen-big" }, speakBtn(c.fr, { cls: "round huge" }), speakBtn(c.fr, { slow: true, cls: "round" })),
    mode === "produce" && h("div", { class: "big-pt strong" }, c.pt),
    mode === "produce" && input,
    mode === "produce" && hint,
    mode === "produce" && h("button", { class: "btn link", onclick: (e) => { hint.hidden = false; e.currentTarget.remove(); } }, "Mostrar dica")
  );

  const reveal = () => {
    typed = input.value.trim();
    ask.remove();
    actions.remove();
    showAnswer();
  };
  const actions = h("div", { class: "step-actions" }, h("button", { class: "btn primary big", onclick: reveal }, "Mostrar resposta"));
  el.append(ask, actions);
  if (mode !== "produce" && store.get().settings.autoplay) setTimeout(() => speak(c.fr), 250);
  if (mode === "produce") input.addEventListener("keydown", (e) => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), reveal()));

  function showAnswer() {
    const result = typed ? compare(c.fr, typed) : null;
    const suggested = result ? (result.score >= 0.95 ? GOOD : result.score >= 0.7 ? HARD : AGAIN) : null;
    el.append(
      h("div", { class: "step card-step answer-step" },
        mode === "produce" && h("div", { class: "big-pt dim" }, c.pt),
        h("div", { class: "big-fr" }, frText(c.fr)),
        h("div", { class: "row gap center" }, speakBtn(c.fr, { cls: "round" }), speakBtn(c.fr, { slow: true, cls: "round" })),
        mode !== "produce" && h("div", { class: "big-pt" }, c.pt),
        result && diffView(result),
        c.note && h("div", { class: "note" }, icon("info"), h("span", null, c.note)),
        mode === "produce" && shadowTools(c.fr)
      ),
      step.practice ? practiceButtons() : ratingButtons(suggested)
    );
    if (mode === "produce" && store.get().settings.autoplay) setTimeout(() => speak(c.fr), 200);
  }

  function practiceButtons() {
    return h("div", { class: "step-actions two" },
      h("button", { class: "btn rate again", onclick: done }, "Errei"),
      h("button", { class: "btn rate good", onclick: done }, "Acertei")
    );
  }

  function ratingButtons(suggested) {
    const now = Date.now();
    const pv = preview(st, now);
    const label = { [AGAIN]: "Errei", [HARD]: "Difícil", [GOOD]: "Bom", [EASY]: "Fácil" };
    const cls = { [AGAIN]: "again", [HARD]: "hard", [GOOD]: "good", [EASY]: "easy" };
    return h("div", { class: "rating" },
      h("p", { class: "muted small center" }, "Quão bem você lembrou?"),
      h("div", { class: "rate-row" },
        [AGAIN, HARD, GOOD, EASY].map((g) =>
          h("button", { class: `btn rate ${cls[g]} ${suggested === g ? "suggested" : ""}`, onclick: () => rate(g, now) },
            h("span", null, label[g]),
            h("small", null, formatInterval(pv[g].due - now))
          )
        )
      )
    );
  }

  function rate(g, now) {
    const isNew = !st || !st.reps;
    store.update((s) => {
      s.cards[step.id] = { ...schedule(st, g, now), added: st?.added || now };
    });
    store.logDay({ reviews: isNew ? 0 : 1, news: isNew ? 1 : 0, again: g === AGAIN ? 1 : 0 });
    S.stats[isNew ? "news" : "reviews"]++;
    if (g === AGAIN) S.stats.again++;
    if (g === AGAIN && (S.requeued[step.id] || 0) < 2) {
      S.requeued[step.id] = (S.requeued[step.id] || 0) + 1;
      const at = Math.min(S.idx + 5, S.steps.length - 1);
      S.steps.splice(at, 0, { type: "review", id: step.id, mode: "recognize" });
    }
    done();
  }
}

function dictation(el, step, done) {
  const c = getCard(step.id);
  const input = h("textarea", { class: "answer", rows: 3, placeholder: "Escreva o que ouviu…", autocapitalize: "off", autocomplete: "off", autocorrect: "off", spellcheck: "false", lang: "fr" });
  const out = h("div");
  const check = () => {
    const r = compare(c.fr, input.value);
    input.disabled = true;
    out.replaceChildren(
      diffView(r),
      h("div", { class: "big-fr small-fr" }, frText(c.fr)),
      h("div", { class: "big-pt" }, c.pt)
    );
    actions.replaceChildren(h("button", { class: "btn primary big", onclick: done }, "Continuar"));
  };
  const actions = h("div", { class: "step-actions two" },
    h("button", { class: "btn ghost", onclick: done }, "Pular"),
    h("button", { class: "btn primary", onclick: check }, "Verificar")
  );
  input.addEventListener("keydown", (e) => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), !input.disabled && check()));
  el.append(
    h("div", { class: "step card-step" },
      chip("Ditado"),
      h("p", { class: "prompt" }, "Ouça e escreva exatamente o que ouvir."),
      h("div", { class: "row gap center listen-big" }, speakBtn(c.fr, { cls: "round huge" }), speakBtn(c.fr, { slow: true, cls: "round" })),
      input,
      h("p", { class: "muted small" }, "Acentos contam pela metade. Pontuação não conta."),
      out
    ),
    actions
  );
  setTimeout(() => speak(c.fr), 300);
}

export function taskView(u, { onDone } = {}) {
  const level = currentLevel(store.get());
  const area = h("textarea", { class: "answer", rows: 5, placeholder: "Escreva (ou dite) em francês…", lang: "fr", autocapitalize: "sentences", spellcheck: "false" });
  const model = h("div", { class: "model", hidden: true }, h("div", { class: "muted small" }, "Resposta-modelo"), frText(u.task.model), speakBtn(u.task.model, { cls: "small" }));
  return h("div", { class: "step" },
    chip("Missão", "rose"),
    h("h2", null, "Agora é com você"),
    h("p", { class: "lead" }, u.task.pt),
    area,
    h("p", { class: "muted small" }, "Dica: depois de escrever, leia em voz alta. Produzir frases suas é o que mais fixa."),
    h("div", { class: "row gap wrap" },
      h("button", { class: "btn soft", onclick: () => (model.hidden = !model.hidden) }, icon("eye"), "Ver modelo"),
      PROVIDERS.map((p) =>
        h("button", {
          class: "btn soft",
          onclick: () => (area.value.trim() ? sendTo(p, correctionPrompt(u.task.pt, area.value.trim(), level)) : toast("Escreva algo primeiro.")),
        }, icon("sparkle"), `Corrigir com ${p.name}`)
      )
    ),
    model,
    onDone && h("div", { class: "step-actions" }, h("button", { class: "btn primary big", onclick: onDone }, "Concluir unidade"))
  );
}

function task(el, step, done) {
  const u = unit(step.unit);
  el.append(
    taskView(u, {
      onDone: () => {
        store.update((s) => {
          s.units[u.id] = { ...(s.units[u.id] || {}), done: Date.now() };
        });
        done();
      },
    })
  );
}

function done(el) {
  if (!S.counted) {
    S.counted = true;
    store.logDay({ sessions: 1 });
    store.persist();
  }
  const { reviews, news, again } = S.stats;
  const total = reviews + news;
  const acc = total ? Math.round(((total - again) / total) * 100) : null;
  const mins = Math.max(1, Math.round(S.sec / 60));
  const st = store.streak();
  el.append(
    h("div", { class: "step done-step" },
      h("div", { class: "done-badge" }, icon("bird")),
      h("h1", { class: "display" }, "Bravo !"),
      h("p", { class: "lead" }, S.daily ? "Sessão de hoje concluída. Petit à petit, l’oiseau fait son nid." : "Prática concluída."),
      h("div", { class: "stats-grid" },
        stat(mins, mins === 1 ? "minuto" : "minutos"),
        stat(news, news === 1 ? "frase nova" : "frases novas"),
        stat(reviews, "revisões"),
        stat(acc == null ? "—" : `${acc}%`, "acertos")
      ),
      h("div", { class: "streak-line" }, icon("flame"), st === 1 ? "1 dia seguido" : `${st} dias seguidos`)
    ),
    h("div", { class: "step-actions" }, h("button", { class: "btn primary big", onclick: exit }, "Voltar ao início"))
  );
}

const stat = (n, label) => h("div", { class: "stat" }, h("b", null, String(n)), h("span", null, label));
