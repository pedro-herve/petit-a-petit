// Entry point: loads content, picks the account, routes between tabs.
import * as store from "./store.js";
import * as auth from "./auth.js";
import { loadContent, indexContent } from "./content.js";
import { configure } from "./speech.js";
import { h, icon } from "./ui.js";
import { route, setRenderer, go } from "./nav.js";
import { syncNow } from "./sync.js";
import { renderWelcome, renderSetup } from "./views/onboarding.js";
import { renderHome } from "./views/home.js";
import { renderPath, renderUnit } from "./views/path.js";
import { renderPractice } from "./views/practice.js";
import { renderNotebook } from "./views/notebook.js";
import { renderProfile } from "./views/profile.js";
import { renderSession, active } from "./views/session.js";

const root = document.getElementById("app");

const TABS = [
  ["/hoje", "Hoje", "home"],
  ["/trilha", "Trilha", "route"],
  ["/praticar", "Praticar", "mic"],
  ["/caderno", "Caderno", "book"],
  ["/perfil", "Perfil", "user"],
];

function tabbar(current) {
  return h("nav", { class: "tabbar", "aria-label": "Navegação" },
    TABS.map(([path, label, ic]) =>
      h("a", { href: `#${path}`, class: current.startsWith(path) ? "on" : "", "aria-current": current.startsWith(path) ? "page" : null }, icon(ic), h("span", null, label))
    )
  );
}

function render() {
  const s = store.get();
  if (!s) return renderWelcome(root, { onReady: ready });
  if (!s.profile) return renderSetup(root, { onReady: ready });
  indexContent(s.custom);
  configure(s.settings);

  const r = route();
  if (r === "/sessao") {
    if (active()) return renderSession(root);
    return go("/hoje");
  }
  const page = h("main", { class: "page" });
  if (r.startsWith("/trilha/")) renderUnit(page, decodeURIComponent(r.slice(8)));
  else if (r === "/trilha") renderPath(page);
  else if (r === "/praticar") renderPractice(page);
  else if (r === "/caderno") renderNotebook(page);
  else if (r === "/perfil") renderProfile(page);
  else renderHome(page);
  root.replaceChildren(page, tabbar(r));
}

function ready() {
  if (!location.hash) location.hash = "/hoje";
  render();
}

async function boot() {
  setRenderer(render);
  window.addEventListener("hashchange", () => {
    render();
    if (route() !== "/sessao") window.scrollTo(0, 0);
  });
  await loadContent();

  const id = store.currentAccount();
  if (id) {
    store.open(id);
    render();
    if (id !== "local" && auth.cloudEnabled()) {
      // Confirm the session is still valid, then bring in progress from other devices.
      auth.currentUser().then((u) => {
        if (!u && navigator.onLine) {
          store.close();
          render();
        } else if (u) syncNow().then(() => route() !== "/sessao" && render());
      }).catch(() => {});
    }
  } else render();

  // Re-render when the app returns to the foreground on a new day.
  let lastDay = new Date().toDateString();
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && new Date().toDateString() !== lastDay && route() !== "/sessao") {
      lastDay = new Date().toDateString();
      render();
    }
  });

  try {
    navigator.storage?.persist?.();
  } catch {}
  if ("serviceWorker" in navigator && location.protocol !== "file:") {
    navigator.serviceWorker.register("sw.js").catch(() => {});
    let reloaded = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (!reloaded && route() !== "/sessao") {
        reloaded = true;
        location.reload();
      }
    });
  }
}

boot();
