// "Trilha": each level is a Paris metro line; units are stations, the level exam is the terminus.
import * as store from "../store.js";
import { LEVELS, LEVEL_IDS, levelInfo, levelState, lineOf, unit, customUnits, unitProgress, unitStatus, currentLevel, stars, EXAM_PASS } from "../content.js";
import { maturity, MATURITY_LABEL } from "../fsrs.js";
import { h, mount, icon, frText, speakBtn, confirmSheet, toast, progressRing } from "../ui.js";
import { typo } from "../text.js";
import { start, buildExtraNew, buildUnitPractice, startExam, dialogueView, pourquoiView, taskView } from "./session.js";
import { go, rerender } from "../nav.js";

let shown = null; // level (or "mine") currently displayed
let shownFor = null; // current level when `shown` was chosen; a new current level resets the view

const lineVars = (L) => ({ "--metro": levelInfo(L).color, "--metro-ink": levelInfo(L).ink });

function starRow(n) {
  return h("span", { class: "stars", "aria-label": `${n} de 3 estrelas` }, [1, 2, 3].map((i) => h("span", { class: i <= n ? "on" : "" }, "★")));
}

export function studyUnit(id) {
  const s = store.get();
  const remaining = unit(id).cards.filter((c) => !s.cards[c.id]).length;
  store.update((st) => (st.focus = id));
  start(buildExtraNew(store.get(), Math.min(remaining, store.newPerDay(s.profile.minutes))), { title: unit(id).title });
}

function chips(s, cur) {
  const mine = customUnits();
  return h("div", { class: "line-chips", role: "tablist" },
    LEVELS.map((L) => {
      const st = levelState(s, L.id);
      const pct = st.stations.length ? st.doneCount / st.stations.length : 0;
      const status = st.passed ? "passed" : st.unlocked ? "open" : "locked";
      return h("button", {
        class: `line-chip ${status} ${shown === L.id ? "on" : ""}`,
        style: lineVars(L.id),
        role: "tab",
        "aria-selected": String(shown === L.id),
        onclick: () => { shown = L.id; rerender(); },
      },
        h("span", { class: "chip-badge" }, L.id),
        status === "passed" ? icon("check", "chip-state") : status === "locked" ? icon("lock", "chip-state") : h("span", { class: "chip-pct" }, `${Math.round(pct * 100)}%`),
        L.id === cur && status !== "passed" && h("span", { class: "chip-here" })
      );
    }),
    mine.length > 0 &&
      h("button", { class: `line-chip mine ${shown === "mine" ? "on" : ""}`, onclick: () => { shown = "mine"; rerender(); } }, icon("sparkle"), h("span", null, "Minhas"))
  );
}

function station(s, st, L, n) {
  const { u, status, added, total, pct } = st;
  const mamie = u.track === "mamie";
  const open = () => (status === "locked" ? toast("Conclua a estação anterior para liberar esta.") : go(`/trilha/${u.id}`));
  return h("li", { class: `station ${status} ${mamie ? "mamie" : ""}` },
    h("button", { class: "st-main", onclick: open, "aria-label": `${typo(u.title)}, ${status === "locked" ? "bloqueada" : status === "done" ? "concluída" : "aberta"}` },
      h("span", { class: "st-dot" }, status === "done" ? icon("check") : status === "locked" ? icon("lock") : status === "current" ? h("span", { class: "st-pulse" }) : String(n)),
      h("span", { class: "st-text" },
        h("b", { class: "serif" }, typo(u.title), mamie && h("span", { class: "st-mamie" }, icon("heart"), "Mamie")),
        h("small", null, u.titlePt || "")
      ),
      h("span", { class: "st-meta" }, status === "done" && starRow(st.stars), status === "open" && added > 0 && `${added}/${total}`, status !== "locked" && icon("chevron"))
    ),
    status === "current" &&
      h("div", { class: "st-current" },
        h("span", { class: "here-tag" }, "Vous êtes ici"),
        h("div", { class: "bar thin" }, h("div", { class: "bar-fill", style: { width: `${pct * 100}%` } })),
        h("small", { class: "muted" }, added ? `${added} de ${total} frases vistas` : `${total} frases novas te esperam`),
        h("div", { class: "row gap" },
          h("button", { class: "view-link plain grow", onclick: () => go(`/trilha/${u.id}`) }, "Ver estação", icon("chevron")),
          h("button", { class: "btn primary small", onclick: () => studyUnit(u.id) }, icon("play"), added ? "Continuar" : "Estudar")
        )
      )
  );
}

function terminus(st, L) {
  const record = st.record;
  const next = LEVEL_IDS[LEVEL_IDS.indexOf(L) + 1];
  return h("li", { class: `station terminus ${st.exam}` },
    h("div", { class: "st-main" },
      h("span", { class: "st-dot" }, st.exam === "passed" ? icon("check") : st.exam === "locked" ? icon("lock") : icon("star")),
      h("span", { class: "st-text" },
        h("b", null, `Terminus · Prova do ${L}`),
        h("small", null,
          st.exam === "passed"
            ? record?.via === "placement" ? "Dispensado no teste de nivelamento" : record?.via === "start" ? "Nível dispensado na escolha inicial" : `Aprovado com ${Math.round((record?.best || 0) * 100)}%`
            : `20 perguntas · ${Math.round(EXAM_PASS * 100)}% para passar${next ? ` e abrir a Linha ${next}` : ""}`
        )
      ),
      st.exam === "passed" ? h("span", { class: "mini-stamp" }, "Validé") : st.exam === "ready" ? "" : h("span", { class: "st-meta" })
    ),
    st.exam === "ready" &&
      h("div", { class: "st-current" },
        h("span", { class: "here-tag" }, "Prova liberada"),
        h("button", { class: "btn primary", onclick: () => startExam(L) }, icon("play"), "Fazer a prova"),
        record?.attempts ? h("small", { class: "muted" }, `Melhor tentativa: ${Math.round(record.best * 100)}%`) : ""
      )
  );
}

function lineView(s, L) {
  const st = levelState(s, L);
  const info = levelInfo(L);
  const total = st.stations.length;
  const left = total - st.doneCount;
  const starsTotal = st.stations.reduce((a, x) => a + x.stars, 0);
  const prev = LEVEL_IDS[LEVEL_IDS.indexOf(L) - 1];
  const hint = !st.unlocked
    ? `Esta linha abre quando você passar na prova do ${prev}.`
    : st.passed
      ? left ? "Linha liberada. Estações abertas para estudar quando quiser." : "Linha concluída. Bravo !"
      : st.exam === "ready"
        ? "Você chegou ao Terminus! Faça a prova para abrir a próxima linha."
        : left === 1 ? "Falta 1 estação para o Terminus." : `Faltam ${left} estações para o Terminus.`;
  return h("section", { class: `line ${st.unlocked ? "" : "is-locked"}`, style: lineVars(L) },
    h("div", { class: "line-head" },
      progressRing(total ? st.doneCount / total : 0, 64, 6, h("span", { class: "line-badge" }, L)),
      h("div", { class: "grow" },
        h("small", { class: "line-kicker" }, `Ligne ${info.line} · ${total} estações`),
        h("h2", { class: "serif" }, info.title),
        h("p", { class: "muted small" }, info.desc)
      )
    ),
    h("div", { class: "line-status" },
      !st.unlocked && icon("lock"),
      h("span", null, hint),
      h("span", { class: "line-stars" }, "★ ", `${starsTotal}/${total * 3}`)
    ),
    total
      ? h("ol", { class: "stations" }, st.stations.map((x, i) => station(s, x, L, i + 1)), terminus(st, L))
      : h("div", { class: "card soon" }, icon("lock"), h("span", null, "Conteúdo a caminho."))
  );
}

function mineView() {
  const s = store.get();
  return h("section", { class: "line mine" },
    h("div", { class: "line-head" },
      h("span", { class: "line-badge solo" }, icon("sparkle")),
      h("div", null, h("small", { class: "line-kicker" }, "Fora da linha"), h("h2", { class: "serif" }, "Minhas lições"), h("p", { class: "muted small" }, "Criadas por você com IA. Sempre abertas."))
    ),
    h("ol", { class: "stations plain" },
      customUnits().map((u, i) => station(s, { u, status: unitStatus(s, u.id), ...unitProgress(s, u.id), stars: stars(s, u) }, u.level, i + 1))
    ),
    h("button", { class: "btn soft", onclick: () => go("/praticar") }, icon("sparkle"), "Criar outra lição")
  );
}

export function renderPath(el) {
  const s = store.get();
  const cur = currentLevel(s);
  if (!shown || shownFor !== cur) {
    shown = cur;
    shownFor = cur;
  }
  const curState = levelState(s, cur);
  const here = curState.stations.findIndex((x) => x.status === "current");
  const allStars = LEVEL_IDS.reduce((a, L) => a + levelState(s, L).stations.reduce((b, x) => b + x.stars, 0), 0);

  mount(el,
    h("header", { class: "page-head" },
      h("div", null, h("p", { class: "eyebrow" }, "Parcours"), h("h1", { class: "display" }, "Trilha")),
      h("div", { class: "streak on stars-pill", title: "Estrelas conquistadas" }, h("span", null, "★"), h("b", null, String(allStars)))
    ),
    h("p", { class: "muted intro-text" },
      here >= 0
        ? ["Você está na ", h("b", null, `Linha ${cur}`), `, estação ${here + 1} de ${curState.stations.length}.`]
        : curState.exam === "ready" ? ["Você chegou ao ", h("b", null, `Terminus da Linha ${cur}`), "."] : "Escolha uma linha para ver as estações."
    ),
    chips(s, cur),
    shown === "mine" ? mineView() : lineView(s, shown)
  );
}

// ---------- unit page ----------

export function renderUnit(el, id) {
  const s = store.get();
  const u = unit(id);
  if (!u) return go("/trilha");
  const status = unitStatus(s, id);
  const pr = unitProgress(s, id);
  const custom = u.id.startsWith("c-");
  const n = custom ? 0 : lineOf(u.level).findIndex((x) => x.id === id) + 1;
  const label = custom ? `Minha lição · ${u.level}` : `Linha ${u.level} · Estação ${n}`;
  const remaining = u.cards.length - pr.added;
  const head = [
    h("header", { class: "page-head with-back" },
      h("button", { class: "icon-btn", "aria-label": "Voltar", onclick: () => go("/trilha") }, icon("back")),
      h("span", { class: `chip line-tag ${u.track === "mamie" ? "rose" : ""}`, style: custom ? null : lineVars(u.level) }, u.track === "mamie" ? `${label} · Mamie` : label)
    ),
    h("h1", { class: "display" }, typo(u.title)),
    h("p", { class: "lead" }, u.titlePt),
    u.goal && h("div", { class: "goal" }, icon("star"), h("div", null, h("b", null, "Você vai conseguir: "), u.goal)),
  ];

  if (status === "locked") {
    const line = lineOf(u.level);
    const prev = line[n - 2];
    const levelOpen = levelState(s, u.level).unlocked;
    return mount(el, head,
      h("div", { class: "card locked-card", style: lineVars(u.level) },
        icon("lock"),
        h("div", null,
          h("b", null, "Estação ainda fechada"),
          h("p", { class: "muted" }, levelOpen && prev ? ["Ela abre quando você concluir ", h("b", null, typo(prev.title)), "."] : `Ela abre quando você passar na prova do nível anterior.`)
        )
      ),
      h("button", { class: "btn primary big", onclick: () => go("/trilha") }, icon("route"), "Ver onde estou na trilha")
    );
  }

  const tabs = [
    ["Diálogo", () => dialogueView(u, { startHidden: false })],
    ["Porquês", () => h("div", { class: "stack" }, (u.pourquoi || []).length ? u.pourquoi.map((p) => h("div", { class: "card" }, pourquoiView(p))) : h("p", { class: "muted" }, "Sem explicações nesta lição."))],
    ["Frases", () =>
      h("div", { class: "phrase-list" },
        u.cards.map((c) => {
          const m = maturity(s.cards[c.id]);
          return h("div", { class: "phrase" },
            speakBtn(c.fr, { cls: "small" }),
            h("div", { class: "phrase-text" }, frText(c.fr), h("small", null, c.pt), c.note && h("small", { class: "note-inline" }, c.note)),
            h("span", { class: `badge ${m}` }, MATURITY_LABEL[m])
          );
        })
      )],
    ["Missão", () =>
      u.task
        ? taskView(u, {
            doneLabel: s.units[id]?.done ? null : "Marcar missão como feita",
            onDone: s.units[id]?.done ? null : () => {
              store.update((st) => (st.units[id] = { ...(st.units[id] || {}), done: Date.now() }));
              toast(pr.done ? "Missão feita: ★★ nesta estação!" : "Missão feita!");
              rerender();
            },
          })
        : h("p", { class: "muted" }, "Sem missão nesta lição.")],
  ];
  let tab = 0;
  const panel = h("div", { class: "tab-panel" });
  const seg = h("div", { class: "segmented" });
  const drawTabs = () => {
    seg.replaceChildren(...tabs.map(([t], i) => h("button", { class: i === tab ? "on" : "", onclick: () => { tab = i; drawTabs(); } }, t)));
    panel.replaceChildren(tabs[tab][1]());
  };
  drawTabs();

  mount(el, head,
    h("div", { class: "unit-progress" },
      h("div", { class: "row gap" }, h("small", { class: "muted grow" }, `${pr.added} de ${pr.total} frases no seu caderno`), pr.done && starRow(stars(s, u))),
      h("div", { class: "bar thin", style: custom ? null : lineVars(u.level) }, h("div", { class: "bar-fill line-fill", style: { width: `${pr.pct * 100}%` } })),
      pr.done && stars(s, u) < 3 &&
        h("small", { class: "muted" }, stars(s, u) === 1 && u.task ? "Faça a missão para ganhar ★★. Domine todas as frases para ★★★." : "Domine todas as frases (3 semanas de intervalo) para ganhar ★★★.")
    ),
    remaining > 0
      ? h("button", { class: "btn primary big", onclick: () => studyUnit(id) }, icon("play"), pr.added ? "Continuar esta estação" : "Estudar esta estação")
      : h("button", { class: "btn primary big", onclick: () => start(buildUnitPractice(u), { title: u.title }) }, icon("play"), "Praticar as frases desta estação"),
    remaining === 0 && h("p", { class: "muted small center" }, "Prática livre: não mexe no calendário de revisões. Para rever o conteúdo, use as abas abaixo."),
    u.culture && h("div", { class: "culture" }, h("b", null, "Culture · "), u.culture),
    seg,
    panel,
    custom &&
      h("button", {
        class: "btn link danger-text",
        onclick: () =>
          confirmSheet("Remover esta lição?", "As frases dela saem do seu caderno.", "Remover", () => {
            store.update((st) => {
              st.custom = st.custom.filter((x) => x.id !== id);
              for (const c of u.cards) delete st.cards[c.id];
              if (st.focus === id) st.focus = null;
            });
            toast("Lição removida.");
            location.reload();
          }, { danger: true }),
      }, "Remover lição")
  );
}
