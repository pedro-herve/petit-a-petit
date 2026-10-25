// First-visit guided tour: spotlights each part of the home screen and the tabs.
import * as store from "./store.js";
import { h, mount, icon } from "./ui.js";
import { planToday, buildDaily, start } from "./views/session.js";

let active = null; // { steps, i, root, spot, card }

function allSteps() {
  const { name, minutes } = store.get().profile;
  const n = store.newPerDay(minutes);
  return [
    {
      title: `Bienvenue, ${name} !`,
      text: "Em um minuto te mostro onde está cada coisa. A proposta é simples: um pouco de francês todo dia. O app decide o que revisar, o que aprender e quando, e você só precisa aparecer.",
    },
    {
      target: ".today",
      title: "A Sessão de hoje: seu treino",
      text: `É aqui que você estuda todo dia, e é o único botão ▶ do app. A sessão junta as revisões que vencem hoje (de tudo o que você já viu) com até ${n} frases novas da sua estação, cabendo nos seus ${minutes} minutos.`,
    },
    {
      target: ".unit-card",
      title: "A estação: o conteúdo",
      text: "Cada estação é uma lição: diálogo, porquês, frases e missão. A sessão vai te ensinando as frases dela aos poucos. Toque em Abrir estação para ler e ouvir tudo com calma, antes ou depois da sessão.",
    },
    {
      title: "Sessão × estação",
      rule: true,
      text: "Resumindo:",
    },
    {
      target: ".streak",
      title: "Dias seguidos",
      text: "Cada dia com pelo menos uma sessão conta aqui. Pouco todo dia vale mais do que muito de vez em quando.",
    },
    {
      target: ".week",
      title: "Sua semana",
      text: "Cada bolinha é um dia. Ela vai enchendo de azul conforme você se aproxima da meta diária.",
    },
    {
      target: '.tabbar a[href="#/trilha"]',
      title: "Trilha",
      text: "O mapa do curso: cada nível (A1 a C1) é uma linha de metrô e cada lição é uma estação, com a Trilha Mamie intercalada. As estações abrem em sequência e, no fim de cada linha, uma prova libera a próxima.",
    },
    {
      target: '.tabbar a[href="#/praticar"]',
      title: "Praticar",
      text: "Treinos livres de ditado, escuta e fala; conversa com IA grátis (até com a Mamie!); e criação de lições novas sobre qualquer tema.",
    },
    {
      target: '.tabbar a[href="#/caderno"]',
      title: "Caderno",
      text: "Todas as frases que você já aprendeu, o seu progresso e os Porquês: uma gramática de bolso com tudo o que foi explicado até agora.",
    },
    {
      target: '.tabbar a[href="#/perfil"]',
      title: "Perfil",
      text: "Mude o tempo por dia, escolha a voz francesa, crie um lembrete no Calendário, faça backup e compartilhe o app. Este tour também fica lá.",
    },
    {
      final: true,
      title: "Como é uma sessão",
      list: [
        ["headphones", "Diálogo", "primeiro só ouvindo; depois lendo e tocando nas palavras para ver a tradução."],
        ["sparkle", "Pourquoi ?", "a explicação curta do porquê, comparando com o português."],
        ["mic", "Frases novas", "ouça e repita em voz alta. Dá para gravar a sua voz e comparar."],
        ["refresh", "Revisão", "tente lembrar antes de ver a resposta e avalie com sinceridade. É isso que decide quando a frase volta."],
        ["pencil", "Ditado", "para fechar. E pronto: à demain !"],
      ],
    },
  ];
}

function finish({ startSession = false } = {}) {
  if (!active) return;
  window.removeEventListener("resize", place);
  document.removeEventListener("keydown", onKey);
  active.root.remove();
  active = null;
  store.update((s) => {
    s.seen = { ...(s.seen || {}), tour: s.seen?.tour || Date.now(), tour2: Date.now() };
  });
  if (startSession) start(buildDaily(store.get()), { daily: true });
}

function onKey(e) {
  if (e.key === "Escape") finish();
  if (e.key === "ArrowRight") go(active.i + 1);
  if (e.key === "ArrowLeft") go(active.i - 1);
}

function go(i) {
  if (!active) return;
  if (i < 0) return;
  if (i >= active.steps.length) return finish();
  active.i = i;
  render();
}

function render() {
  const { steps, i, card, root } = active;
  const step = steps[i];
  const last = i === steps.length - 1;
  const hasSession = planToday(store.get()).reviews.length + planToday(store.get()).news.length > 0;

  const body = step.final
    ? h("ul", { class: "tour-list" },
        step.list.map(([ic, b, t]) => h("li", null, icon(ic), h("span", null, h("b", null, b), " — ", t)))
      )
    : step.rule
      ? h("div", { class: "stack tight" },
          h("p", { class: "tour-text" }, step.text),
          h("div", { class: "rule-row" }, h("span", { class: "btn primary small" }, icon("play"), "Começar a sessão"), h("span", null, "treinar: revisões + frases novas")),
          h("div", { class: "rule-row" }, h("span", { class: "btn soft small" }, icon("book"), "Abrir estação"), h("span", null, "ler e ouvir o conteúdo da lição"))
        )
      : h("p", { class: "tour-text" }, step.text);

  const actions = last
    ? h("div", { class: "tour-actions column" },
        hasSession && h("button", { class: "btn primary", onclick: () => finish({ startSession: true }) }, icon("play"), "Começar minha primeira sessão"),
        h("button", { class: `btn ${hasSession ? "ghost" : "primary"}`, onclick: () => finish() }, hasSession ? "Explorar sozinho" : "Entendi")
      )
    : h("div", { class: "tour-actions" },
        h("button", { class: "btn link", onclick: () => finish() }, "Pular"),
        i > 0 && h("button", { class: "btn ghost small", onclick: () => go(i - 1) }, "Voltar"),
        h("button", { class: "btn primary small", onclick: () => go(i + 1) }, i === 0 ? "Vamos lá" : "Próximo")
      );

  mount(card,
    h("div", { class: "tour-head" },
      h("span", { class: "tour-count" }, `${i + 1} de ${steps.length}`),
      h("div", { class: "dots" }, steps.map((_, k) => h("span", { class: k === i ? "on" : "" })))
    ),
    h("h3", null, step.title),
    body,
    actions
  );
  root.classList.toggle("dim", !step.target);
  place();
  card.querySelector(".btn.primary")?.focus({ preventScroll: true });
}

function place() {
  if (!active) return;
  const { steps, i, spot, card } = active;
  const step = steps[i];
  const target = step.target && document.querySelector(step.target);
  const cw = card.offsetWidth;
  const ch = card.offsetHeight;
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  if (!target) {
    Object.assign(spot.style, { left: `${vw / 2}px`, top: `${vh / 2}px`, width: "0px", height: "0px" });
    Object.assign(card.style, { left: `${(vw - cw) / 2}px`, top: `${Math.max(16, (vh - ch) / 2)}px` });
    return;
  }
  if (getComputedStyle(target).position !== "fixed" && !target.closest(".tabbar")) {
    const r0 = target.getBoundingClientRect();
    if (r0.top < 80 || r0.bottom > vh - 260) window.scrollTo({ top: window.scrollY + r0.top - 90 });
  }
  const r = target.getBoundingClientRect();
  const pad = 6;
  Object.assign(spot.style, { left: `${r.left - pad}px`, top: `${r.top - pad}px`, width: `${r.width + pad * 2}px`, height: `${r.height + pad * 2}px` });
  const below = vh - r.bottom - 16 >= ch + 12;
  const top = below ? r.bottom + pad + 12 : Math.max(16, r.top - pad - 12 - ch);
  const left = Math.min(vw - cw - 16, Math.max(16, r.left + r.width / 2 - cw / 2));
  Object.assign(card.style, { left: `${left}px`, top: `${top}px` });
}

export function startTour() {
  if (active || !store.get()?.profile) return;
  const steps = allSteps().filter((s) => !s.target || document.querySelector(s.target));
  const spot = h("div", { class: "tour-spot" });
  const card = h("div", { class: "tour-card", role: "dialog", "aria-modal": "true", "aria-label": "Tour do app" });
  const root = h("div", { class: "tour" }, spot, card);
  document.body.append(root);
  active = { steps, i: 0, root, spot, card };
  window.addEventListener("resize", place);
  document.addEventListener("keydown", onKey);
  render();
}

export const tourActive = () => !!active;

export function maybeStartTour() {
  if (!store.get()?.seen?.tour2) setTimeout(() => location.hash.replace(/^#/, "") === "/hoje" && startTour(), 450);
}
