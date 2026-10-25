// "Trilha": every level and unit, plus the unit page (dialogue, explanations, sentences, mission).
import * as store from "../store.js";
import { LEVELS, unit, unitsOf, customUnits, unitProgress, currentUnit, content } from "../content.js";
import { maturity, MATURITY_LABEL } from "../fsrs.js";
import { h, mount, icon, frText, speakBtn, confirmSheet, toast } from "../ui.js";
import { typo } from "../text.js";
import { start, buildExtraNew, dialogueView, pourquoiView, taskView } from "./session.js";
import { go } from "../nav.js";

function unitRow(s, u, curId, n) {
  const pr = unitProgress(s, u.id);
  const state = pr.done ? "done" : u.id === curId ? "current" : pr.added ? "started" : "";
  return h("button", { class: `unit-row ${state}`, onclick: () => go(`/trilha/${u.id}`) },
    h("span", { class: "unit-num" }, pr.done ? icon("check") : String(n)),
    h("span", { class: "unit-text" },
      h("b", { class: "serif" }, typo(u.title)),
      h("small", null, u.titlePt || ""),
      pr.added > 0 && !pr.done && h("span", { class: "bar thin" }, h("span", { class: "bar-fill", style: { width: `${pr.pct * 100}%` } }))
    ),
    u.id === curId ? h("span", { class: "chip blue tiny" }, "agora") : icon("chevron")
  );
}

export function renderPath(el) {
  const s = store.get();
  const curId = currentUnit(s);
  const sections = [];

  for (const L of LEVELS) {
    const units = unitsOf(L.id, "main");
    const total = units.reduce((a, u) => a + u.cards.length, 0);
    const added = units.reduce((a, u) => a + unitProgress(s, u.id).added, 0);
    sections.push(
      h("section", { class: "level" },
        h("div", { class: "level-head" },
          h("span", { class: "level-badge" }, L.id),
          h("div", null, h("h2", null, L.title), h("p", { class: "muted small" }, L.desc)),
          units.length > 0 && h("small", { class: "muted nowrap" }, `${added}/${total}`)
        ),
        units.length
          ? h("div", { class: "unit-list" }, units.map((u, i) => unitRow(s, u, curId, i + 1)))
          : h("button", { class: "card soon", onclick: () => go("/praticar") }, icon("lock"), h("span", null, "Em construção. Enquanto isso, crie lições deste nível com IA em ", h("b", null, "Praticar"), "."))
      )
    );
    if (L.id === "A1") {
      const mamie = content.syllabus.map(unit).filter((u) => u.track === "mamie");
      if (mamie.length)
        sections.push(
          h("section", { class: "level mamie" },
            h("div", { class: "level-head" },
              h("span", { class: "level-badge rose" }, icon("heart")),
              h("div", null, h("h2", null, "Trilha Mamie"), h("p", { class: "muted small" }, "Para conversar com a avó: telefonemas, carinho, almoço em família e lembranças de Paris."))
            ),
            h("div", { class: "unit-list" }, mamie.map((u, i) => unitRow(s, u, curId, i + 1)))
          )
        );
    }
  }
  const mine = customUnits();
  if (mine.length)
    sections.push(
      h("section", { class: "level" },
        h("div", { class: "level-head" }, h("span", { class: "level-badge" }, icon("sparkle")), h("div", null, h("h2", null, "Minhas lições"), h("p", { class: "muted small" }, "Criadas por você com IA."))),
        h("div", { class: "unit-list" }, mine.map((u, i) => unitRow(s, u, curId, i + 1)))
      )
    );

  mount(el, 
    h("header", { class: "page-head" }, h("div", null, h("p", { class: "eyebrow" }, "Parcours"), h("h1", { class: "display" }, "Trilha"))),
    h("p", { class: "muted intro-text" }, "A ordem já intercala a trilha Mamie no momento certo. Toque numa unidade para rever ou estudar fora de ordem."),
    sections
  );
}

export function renderUnit(el, id) {
  const s = store.get();
  const u = unit(id);
  if (!u) return go("/trilha");
  const pr = unitProgress(s, id);
  const label = u.track === "mamie" ? `Trilha Mamie · ${u.level}` : u.id.startsWith("c-") ? `Minha lição · ${u.level}` : `${u.level} · Unidade ${Number(u.id.slice(3))}`;
  const remaining = u.cards.filter((c) => !s.cards[c.id]).length;

  const studyNow = () => {
    store.update((st) => (st.focus = id));
    start(buildExtraNew(store.get(), Math.min(remaining, store.newPerDay(s.profile.minutes))), { title: u.title });
  };

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
    ["Missão", () => (u.task ? taskView(u) : h("p", { class: "muted" }, "Sem missão nesta lição."))],
  ];
  let tab = 0;
  const panel = h("div", { class: "tab-panel" });
  const seg = h("div", { class: "segmented" });
  const drawTabs = () => {
    seg.replaceChildren(...tabs.map(([t], i) => h("button", { class: i === tab ? "on" : "", onclick: () => { tab = i; drawTabs(); } }, t)));
    panel.replaceChildren(tabs[tab][1]());
  };
  drawTabs();

  mount(el, 
    h("header", { class: "page-head with-back" },
      h("button", { class: "icon-btn", "aria-label": "Voltar", onclick: () => go("/trilha") }, icon("back")),
      h("span", { class: `chip ${u.track === "mamie" ? "rose" : ""}` }, label)
    ),
    h("h1", { class: "display" }, typo(u.title)),
    h("p", { class: "lead" }, u.titlePt),
    u.goal && h("div", { class: "goal" }, icon("star"), h("div", null, h("b", null, "Você vai conseguir: "), u.goal)),
    h("div", { class: "unit-progress" },
      h("div", { class: "bar thin" }, h("div", { class: "bar-fill", style: { width: `${pr.pct * 100}%` } })),
      h("small", { class: "muted" }, `${pr.added} de ${pr.total} frases no seu caderno`)
    ),
    remaining > 0 && h("button", { class: "btn primary big", onclick: studyNow }, icon("play"), pr.added ? "Continuar esta unidade" : "Estudar esta unidade agora"),
    u.culture && h("div", { class: "culture" }, h("b", null, "Culture · "), u.culture),
    seg,
    panel,
    u.id.startsWith("c-") &&
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
