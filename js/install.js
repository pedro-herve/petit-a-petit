// Installing the web app on the phone's home screen, explained for each platform.
import { h, icon, sheet, isIOS, isStandalone } from "./ui.js";

let deferred = null; // Android/Chrome's install prompt, saved for our own button
const listeners = new Set();

window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferred = e;
  listeners.forEach((fn) => fn());
});
window.addEventListener("appinstalled", () => {
  deferred = null;
  listeners.forEach((fn) => fn());
});

export const isAndroid = () => /android/i.test(navigator.userAgent);
export const isPhone = () => isIOS() || isAndroid();
export const shouldOfferInstall = () => isPhone() && !isStandalone();
export const onInstallChange = (fn) => listeners.add(fn);

// One tap on Android when Chrome allows it; otherwise the step-by-step guide.
export async function install() {
  if (deferred) {
    deferred.prompt();
    await deferred.userChoice.catch(() => null);
    deferred = null;
    return;
  }
  installHelp();
}

const step = (n, ...content) => h("li", null, h("span", { class: "step-n" }, String(n)), h("div", null, ...content));

function iosSteps() {
  return h("div", { class: "stack" },
    h("ol", { class: "install-steps" },
      step(1, "Abra este link no ", h("b", null, "Safari"), " (a bússola azul)."),
      step(2, "Toque no botão ", h("b", null, "≡"), " (três risquinhos) na barra de baixo e depois em ", h("b", null, "Compartilhar"), "."),
      step(3, "Toque em ", h("b", null, "Ver Mais"), " e depois em ", h("b", null, "Adicionar à Tela de Início"), "."),
      step(4, "Toque em ", h("b", null, "Adicionar"), ", no canto de cima."),
      step(5, "Pronto! Abra sempre pelo ícone do ", h("b", null, "passarinho"), " na tela do celular.")
    ),
    h("div", { class: "callout" }, icon("info"), h("span", null, "Em iPhones mais antigos não existe o ≡: toque direto no botão ", h("b", null, "Compartilhar"), " (o quadrado com a setinha para cima) na barra de baixo."))
  );
}

function androidSteps() {
  return h("div", { class: "stack" },
    h("ol", { class: "install-steps" },
      step(1, "Abra este link no ", h("b", null, "Chrome"), ". Se ele abrir dentro do WhatsApp, toque nos ", h("b", null, "⋮"), " (três pontinhos) e em ", h("b", null, "Abrir no Chrome"), "."),
      step(2, "Toque nos ", h("b", null, "⋮"), " no canto de cima, à direita."),
      step(3, "Toque em ", h("b", null, "Instalar app"), " (ou ", h("b", null, "Adicionar à tela inicial"), ")."),
      step(4, "Confirme em ", h("b", null, "Instalar"), "."),
      step(5, "Pronto! Abra sempre pelo ícone do ", h("b", null, "passarinho"), " na tela do celular.")
    )
  );
}

export function installHelp() {
  const ios = isIOS();
  const android = isAndroid();
  let tab = android ? "android" : "ios";
  const body = h("div", { class: "stack" });
  const draw = () =>
    body.replaceChildren(
      !ios && !android
        ? h("div", { class: "segmented" },
            h("button", { class: tab === "ios" ? "on" : "", onclick: () => { tab = "ios"; draw(); } }, "iPhone"),
            h("button", { class: tab === "android" ? "on" : "", onclick: () => { tab = "android"; draw(); } }, "Android")
          )
        : "",
      tab === "ios" ? iosSteps() : androidSteps(),
      h("a", { class: "btn soft", href: `tutorial/#${tab}`, target: "_blank", rel: "noopener" }, icon("play"), "Ver vídeo de 30 segundos"),
      h("p", { class: "muted small" }, "Instalado, o app abre em tela cheia, funciona sem internet e fica com ícone próprio, como qualquer outro aplicativo.")
    );
  draw();
  sheet(ios ? "Instalar no iPhone" : android ? "Instalar no Android" : "Instalar no celular", body);
}

// Card shown before anything else when the page is opened in the phone's browser.
export function installCard() {
  const btn = h("button", { class: "btn primary", onclick: install }, icon("download"), isAndroid() ? "Instalar o app" : "Ver como instalar");
  return h("div", { class: "install-card" },
    h("div", { class: "install-card-top" },
      h("span", { class: "install-badge" }, icon("download")),
      h("div", null,
        h("b", null, "Primeiro, instale o app"),
        h("p", null, isIOS() ? "Leva 20 segundos. Ele fica na tela do seu iPhone, como os outros aplicativos." : "Leva 10 segundos. Ele fica na tela do seu celular, como os outros aplicativos.")
      )
    ),
    btn
  );
}
