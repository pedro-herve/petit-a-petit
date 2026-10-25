// "Caderno": every sentence learned, progress numbers, and the library of explanations.
import * as store from "../store.js";
import { content, unit } from "../content.js";
import { maturity, MATURITY_LABEL } from "../fsrs.js";
import { dayKey, addDays } from "../time.js";
import { h, mount, icon, frText, speakBtn } from "../ui.js";
import { pourquoiView } from "./session.js";

let tab = "frases";
let filter = "todas";
let query = "";

function stats(s) {
  const ids = Object.keys(s.cards).filter((id) => content.cards.has(id));
  const mature = ids.filter((id) => maturity(s.cards[id]) === "madura").length;
  let rev = 0, again = 0, secs = 0, days = 0;
  for (const [k, d] of Object.entries(s.days)) {
    secs += d.sec || 0;
    if (d.sessions) days++;
    if (k >= addDays(dayKey(), -30)) {
      rev += d.reviews || 0;
      again += d.again || 0;
    }
  }
  return { learned: ids.length, mature, retention: rev ? Math.round(((rev - again) / rev) * 100) : null, hours: secs / 3600, days };
}

function chart(s) {
  const bars = [];
  const goal = s.profile.minutes;
  let max = goal;
  const vals = [];
  for (let i = 13; i >= 0; i--) {
    const k = addDays(dayKey(), -i);
    const v = Math.round((s.days[k]?.sec || 0) / 60);
    vals.push([k, v]);
    max = Math.max(max, v);
  }
  for (const [k, v] of vals)
    bars.push(h("div", { class: "cbar", title: `${k}: ${v} min` }, h("span", { style: { height: `${(v / max) * 100}%` }, class: v >= goal ? "hit" : "" }), h("small", null, k.slice(8))));
  return h("div", { class: "card chart" },
    h("div", { class: "week-head" }, h("h3", null, "Minutos por dia"), h("small", { class: "muted" }, "últimos 14 dias")),
    h("div", { class: "chart-area", style: { "--goal": String(goal / max) } }, h("div", { class: "goal-line" }), bars)
  );
}

export function renderNotebook(el) {
  const s = store.get();
  const st = stats(s);
  const list = h("div");

  const drawList = () => {
    if (tab === "frases") {
      const q = query.trim().toLowerCase();
      const rows = Object.entries(s.cards)
        .filter(([id]) => content.cards.has(id))
        .map(([id, c]) => ({ card: content.cards.get(id), st: c, m: maturity(c) }))
        .filter((r) => filter === "todas" || r.m === filter)
        .filter((r) => !q || r.card.fr.toLowerCase().includes(q) || r.card.pt.toLowerCase().includes(q))
        .sort((a, b) => (b.st.added || 0) - (a.st.added || 0));
      list.replaceChildren(
        rows.length
          ? h("div", { class: "phrase-list" },
              rows.slice(0, 300).map((r) =>
                h("div", { class: "phrase" },
                  speakBtn(r.card.fr, { cls: "small" }),
                  h("div", { class: "phrase-text" }, frText(r.card.fr), h("small", null, r.card.pt)),
                  h("span", { class: `badge ${r.m}` }, MATURITY_LABEL[r.m])
                )
              )
            )
          : h("p", { class: "muted center pad" }, Object.keys(s.cards).length ? "Nada encontrado." : "As frases que você aprender aparecem aqui.")
      );
    } else {
      const seen = content.syllabus.filter((id) => s.units[id]?.seen).map(unit).filter((u) => u.pourquoi?.length);
      list.replaceChildren(
        seen.length
          ? h("div", { class: "stack" },
              seen.flatMap((u) =>
                u.pourquoi.map((p) =>
                  h("details", { class: "card pq-item" }, h("summary", null, h("span", null, p.title), h("small", { class: "muted" }, `${u.level} · ${u.title}`)), pourquoiView(p))
                )
              )
            )
          : h("p", { class: "muted center pad" }, "As explicações das unidades que você começar ficam guardadas aqui, como uma gramática de bolso.")
      );
    }
  };

  const search = h("input", { type: "search", placeholder: "Buscar frase em francês ou português", value: query, oninput: (e) => { query = e.target.value; drawList(); } });
  const filters = h("div", { class: "chips-row" });
  const drawFilters = () =>
    filters.replaceChildren(
      ...["todas", "aprendendo", "jovem", "madura"].map((f) => h("button", { class: `chip-btn ${f === filter ? "on" : ""}`, onclick: () => { filter = f; drawFilters(); drawList(); } }, MATURITY_LABEL[f] || f))
    );
  drawFilters();
  const seg = h("div", { class: "segmented" });
  const drawSeg = () =>
    seg.replaceChildren(
      ...[["frases", "Frases"], ["porques", "Porquês"]].map(([id, t]) =>
        h("button", { class: id === tab ? "on" : "", onclick: () => { tab = id; drawSeg(); tools.hidden = tab !== "frases"; drawList(); } }, t)
      )
    );
  const tools = h("div", { class: "stack tight" }, search, filters);
  drawSeg();
  tools.hidden = tab !== "frases";
  drawList();

  mount(el, 
    h("header", { class: "page-head" }, h("div", null, h("p", { class: "eyebrow" }, "Carnet"), h("h1", { class: "display" }, "Caderno"))),
    h("div", { class: "stats-grid four" },
      h("div", { class: "stat" }, h("b", null, String(st.learned)), h("span", null, "frases")),
      h("div", { class: "stat" }, h("b", null, String(st.mature)), h("span", null, "dominadas")),
      h("div", { class: "stat" }, h("b", null, st.retention == null ? "—" : `${st.retention}%`), h("span", null, "retenção 30d")),
      h("div", { class: "stat" }, h("b", null, st.hours < 1 ? `${Math.round(st.hours * 60)}′` : `${st.hours.toFixed(1)}h`), h("span", null, st.days === 1 ? "em 1 dia" : `em ${st.days} dias`))
    ),
    chart(s),
    h("p", { class: "muted small" }, h("b", null, "Dominada"), " = você lembra mesmo com 3 semanas ou mais de intervalo. É o sinal de que foi para a memória de longo prazo."),
    seg,
    tools,
    list
  );
}
