// "Hoje": today's session, streak, current unit and the week at a glance.
import * as store from "../store.js";
import { unit, currentUnit, unitProgress } from "../content.js";
import { dayKey, addDays } from "../time.js";
import { h, mount, icon, progressRing } from "../ui.js";
import { install, shouldOfferInstall, isAndroid } from "../install.js";
import { typo } from "../text.js";
import { planToday, buildDaily, buildExtraNew, start } from "./session.js";
import { go } from "../nav.js";

const WEEKDAYS = ["D", "S", "T", "Q", "Q", "S", "S"];

export function renderHome(el) {
  const s = store.get();
  const p = s.profile;
  const plan = planToday(s);
  const today = store.today();
  const goalSec = p.minutes * 60;
  const streak = store.streak();
  const has = plan.reviews.length + plan.news.length > 0;
  const studiedToday = today.sessions > 0;
  const dateFr = new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
  const curId = currentUnit(s);
  const cur = curId && unit(curId);

  const todayCard = has
    ? h("section", { class: "card today" },
        h("div", { class: "today-top" },
          progressRing(today.sec / goalSec, 72, 7, `${Math.round(today.sec / 60)}′`),
          h("div", null,
            h("h2", null, studiedToday ? "Continuar hoje" : "Sessão de hoje"),
            h("p", { class: "muted" }, `${plan.reviews.length} revisões · ${plan.news.length} frases novas · ≈ ${plan.minutes} min`)
          )
        ),
        plan.dueTotal > plan.reviews.length &&
          h("div", { class: "callout warn" }, icon("info"), h("span", null, `Há ${plan.dueTotal} revisões acumuladas; hoje faremos ${plan.reviews.length}. As frases novas voltam quando as revisões estiverem em dia.`)),
        plan.news.length === 0 && plan.cap > 0 && plan.dueTotal > 0 && plan.dueTotal <= plan.reviews.length &&
          h("div", { class: "callout" }, icon("info"), h("span", null, "Hoje as revisões ocupam o seu tempo. Isso é bom: é a fase em que a memória se consolida.")),
        h("button", { class: "btn primary big", onclick: () => start(buildDaily(store.get()), { daily: true }) }, icon("play"), "Commencer")
      )
    : h("section", { class: "card today done" },
        h("div", { class: "today-top" },
          progressRing(Math.max(today.sec / goalSec, studiedToday ? 1 : 0), 72, 7, studiedToday ? "✓" : "0′"),
          h("div", null,
            h("h2", null, studiedToday ? "Tout est fait !" : "Tudo em dia"),
            h("p", { class: "muted" }, studiedToday ? "Você cumpriu a sessão de hoje. Amanhã tem mais." : "Nenhuma revisão pendente agora.")
          )
        ),
        h("div", { class: "row gap wrap" },
          h("button", { class: "btn soft", onclick: () => start(buildExtraNew(store.get(), 5), { title: "Mais frases" }) }, icon("sparkle"), "Aprender mais 5 frases"),
          h("button", { class: "btn soft", onclick: () => go("/praticar") }, icon("mic"), "Praticar")
        )
      );

  const week = [];
  for (let i = 6; i >= 0; i--) {
    const k = addDays(dayKey(), -i);
    const d = s.days[k];
    const [y, m, dd] = k.split("-").map(Number);
    const wd = new Date(y, m - 1, dd).getDay();
    const lvl = !d?.sessions ? 0 : d.sec >= goalSec ? 3 : d.sec >= goalSec / 2 ? 2 : 1;
    week.push(h("div", { class: `day ${i === 0 ? "is-today" : ""}` }, h("span", { class: `dot l${lvl}` }), h("small", null, WEEKDAYS[wd])));
  }

  mount(el, 
    h("header", { class: "page-head home-head" },
      h("div", null,
        h("p", { class: "eyebrow" }, dateFr),
        h("h1", { class: "display" }, `Bonjour, ${p.name}`)
      ),
      h("div", { class: `streak ${streak ? "on" : ""}`, title: "Dias seguidos" }, icon("flame"), h("b", null, String(streak)))
    ),
    shouldOfferInstall() &&
      h("button", { class: "install-banner", onclick: install }, icon("download"), h("span", null, h("b", null, isAndroid() ? "Instale o app" : "Instale no iPhone"), " para usar em tela cheia, com ícone próprio e sem internet."), icon("chevron")),
    todayCard,
    cur &&
      (() => {
        const pr = unitProgress(s, cur.id);
        return h("section", { class: "card unit-card", onclick: () => go(`/trilha/${cur.id}`) },
          h("div", { class: "unit-card-top" },
            h("span", { class: `chip ${cur.track === "mamie" ? "rose" : ""}` }, cur.track === "mamie" ? `Trilha Mamie · ${cur.level}` : `${cur.level} · Unidade ${Number(cur.id.slice(3)) || ""}`),
            icon("chevron")
          ),
          h("h3", { class: "serif" }, typo(cur.title)),
          h("p", { class: "muted" }, cur.titlePt),
          h("div", { class: "bar thin" }, h("div", { class: "bar-fill", style: { width: `${pr.pct * 100}%` } })),
          h("small", { class: "muted" }, `${pr.added} de ${pr.total} frases`)
        );
      })(),
    h("section", { class: "card week" },
      h("div", { class: "week-head" }, h("h3", null, "Esta semana"), h("small", { class: "muted" }, `Meta: ${p.minutes} min/dia`)),
      h("div", { class: "week-row" }, week)
    ),
    h("p", { class: "proverb" }, "« Petit à petit, l’oiseau fait son nid. »", h("br"), h("small", null, "Pouco a pouco, o passarinho faz seu ninho."))
  );
}
