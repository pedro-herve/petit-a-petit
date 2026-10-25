// "Perfil": account, daily time, voice, reminder, backup, sharing and the method behind the app.
import * as store from "../store.js";
import * as auth from "../auth.js";
import { h, mount, icon, sheet, toast, confirmSheet } from "../ui.js";
import { configure, frenchVoices, speak } from "../speech.js";
import { status, syncNow, isCloudAccount } from "../sync.js";
import { minutesChooser } from "./onboarding.js";
import { installHelp } from "../install.js";
import { rerender, go } from "../nav.js";
import { startTour } from "../tour.js";
import { dayKey } from "../time.js";

export const VERSION = "1.3.0";
const appUrl = () => location.origin + location.pathname;

function row(label, control, sub) {
  return h("div", { class: "set-row" }, h("div", null, h("b", null, label), sub && h("small", { class: "muted" }, sub)), control);
}

function toggle(on, onChange) {
  return h("button", { class: `switch ${on ? "on" : ""}`, role: "switch", "aria-checked": String(on), onclick: (e) => { const v = !e.currentTarget.classList.contains("on"); e.currentTarget.classList.toggle("on", v); e.currentTarget.setAttribute("aria-checked", String(v)); onChange(v); } }, h("span"));
}

function setSetting(k, v) {
  store.update((s) => {
    s.settings = { ...s.settings, [k]: v, updatedAt: Date.now() };
  });
  configure(store.get().settings);
}

function reminderIcs(time, minutes) {
  const [hh, mm] = time.split(":").map(Number);
  const d = new Date();
  d.setDate(d.getDate() + 1);
  const pad = (n) => String(n).padStart(2, "0");
  const local = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(hh)}${pad(mm)}00`;
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+/, "");
  return [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Petit a Petit//PT", "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:petit-a-petit-${Date.now()}@petit-a-petit`,
    `DTSTAMP:${stamp}`,
    `DTSTART:${local}`,
    `DURATION:PT${minutes}M`,
    "RRULE:FREQ=DAILY",
    `SUMMARY:Francês — Petit à Petit (${minutes} min)`,
    `DESCRIPTION:Sua sessão diária de francês: ${appUrl()}`,
    `URL:${appUrl()}`,
    "BEGIN:VALARM", "ACTION:DISPLAY", "DESCRIPTION:Hora do francês !", "TRIGGER:PT0M", "END:VALARM",
    "END:VEVENT", "END:VCALENDAR", "",
  ].join("\r\n");
}

async function saveFile(name, type, text) {
  const file = new File([text], name, { type });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: name });
      return;
    } catch (e) {
      if (e.name === "AbortError") return;
    }
  }
  const a = h("a", { href: URL.createObjectURL(file), download: name });
  document.body.append(a);
  a.click();
  a.remove();
}

function addReminder() {
  const s = store.get();
  const ics = reminderIcs(s.settings.reminder || "19:00", s.profile.minutes);
  const url = URL.createObjectURL(new Blob([ics], { type: "text/calendar" }));
  // Opening a calendar file lets iOS offer "Add to Calendar"; elsewhere it downloads.
  const a = h("a", { href: url, download: "lembrete-frances.ics" });
  document.body.append(a);
  a.click();
  a.remove();
  toast("Abra o arquivo para adicionar ao Calendário.");
}

export function methodSheet() {
  const item = (t, d) => h("li", null, h("b", null, t), h("span", null, d));
  sheet("Por que este método funciona",
    h("div", { class: "stack" },
      h("ul", { class: "method-list" },
        item("Repetição espaçada.", "Cada frase volta pouco antes de você esquecê-la. O algoritmo é o FSRS, o mesmo do Anki moderno, que estima sua memória a cada resposta. Rever na hora certa fixa muito mais do que rever muito."),
        item("Recuperação ativa.", "Você tenta lembrar antes de ver a resposta. O esforço de buscar na memória é o que a fortalece (Roediger & Karpicke, 2006)."),
        item("Input compreensível.", "Diálogos um pouco acima do seu nível, com áudio e tradução por palavra. É entendendo mensagens que se adquire uma língua (Krashen)."),
        item("Frases, não palavras.", "Falantes nativos pensam em blocos (« je voudrais… », « ça fait longtemps »). Aprender blocos dá fluência mais rápido."),
        item("Produção.", "Dizer e escrever do português para o francês mostra o que falta e ativa o vocabulário (Swain)."),
        item("O porquê.", "Entender a lógica de uma estrutura, comparando com o português, ajuda a fixar (interrogação elaborativa)."),
        item("Ouvido e boca.", "Ditado e shadowing (repetir junto com o áudio) treinam o francês falado, onde metade das letras não se pronuncia."),
        item("Pouco, todo dia.", "Sessões curtas e diárias ganham de maratonas. O app ajusta a quantidade de frases novas para caber no seu tempo.")
      ),
      h("p", { class: "muted small" }, "Dica: a melhor prática é usar o que aprendeu com gente de verdade. Ligue para a família, nem que seja por 5 minutos.")
    )
  );
}

export function renderProfile(el) {
  const s = store.get();
  const p = s.profile;
  const cloud = isCloudAccount();
  const voices = frenchVoices();

  const voiceSel = h("select", { onchange: (e) => setSetting("voice", e.target.value) },
    h("option", { value: "" }, "Automática"),
    voices.map((v) => h("option", { value: v.id, selected: v.id === s.settings.voice || null }, `${v.name} (${v.lang})`))
  );
  const rate = h("input", { type: "range", min: "0.6", max: "1.2", step: "0.05", value: String(s.settings.rate), onchange: (e) => setSetting("rate", Number(e.target.value)) });
  const time = h("input", { type: "time", value: s.settings.reminder || "19:00", onchange: (e) => setSetting("reminder", e.target.value) });
  const fileIn = h("input", {
    type: "file",
    accept: "application/json,.json",
    hidden: true,
    onchange: async (e) => {
      const f = e.target.files[0];
      if (!f) return;
      try {
        const data = JSON.parse(await f.text());
        if (!data.cards) throw new Error();
        confirmSheet("Importar backup?", `O backup tem ${Object.keys(data.cards).length} frases. Ele será combinado com o progresso atual (fica o mais recente de cada frase).`, "Importar", () => {
          store.replace(store.merge(store.get(), data));
          toast("Backup importado.");
          rerender();
        });
      } catch {
        toast("Arquivo de backup inválido.");
      }
    },
  });

  mount(el, 
    h("header", { class: "page-head" }, h("div", null, h("p", { class: "eyebrow" }, "Profil"), h("h1", { class: "display" }, p.name))),

    h("section", { class: "card" },
      h("h3", null, "Conta"),
      cloud
        ? [
            row(p.email || "Conta", h("span", { class: `sync-dot ${status.state}` }), status.state === "error" ? "Não foi possível sincronizar agora" : status.at ? `Sincronizado às ${new Date(status.at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}` : "Progresso salvo na nuvem"),
            h("div", { class: "row gap wrap" },
              h("button", { class: "btn soft", onclick: async () => { await syncNow(); toast(status.state === "ok" ? "Sincronizado." : "Sem conexão agora."); rerender(); } }, icon("refresh"), "Sincronizar"),
              h("button", {
                class: "btn ghost",
                onclick: () =>
                  confirmSheet("Sair da conta?", "Seu progresso continua salvo na nuvem. Para voltar, é só entrar de novo.", "Sair", async () => {
                    await syncNow();
                    const id = store.account();
                    await auth.signOut();
                    store.forget(id);
                    store.close();
                    location.hash = "";
                    location.reload();
                  }),
              }, icon("logout"), "Sair")
            ),
          ]
        : [
            row("Perfil neste aparelho", null, auth.cloudEnabled() ? "Crie uma conta grátis para guardar o progresso na nuvem e usar em outros aparelhos." : "Seu progresso fica neste aparelho. Faça backup de vez em quando."),
            auth.cloudEnabled() &&
              h("button", { class: "btn soft", onclick: () => { store.close(); location.hash = ""; location.reload(); } }, icon("user"), "Criar conta ou entrar"),
          ]
    ),

    h("section", { class: "card" },
      h("h3", null, "Tempo por dia"),
      h("p", { class: "muted small" }, `Com ${p.minutes} min: até ${store.newPerDay(p.minutes)} frases novas por dia. Se as revisões acumularem, entram menos novas.`),
      minutesChooser(p.minutes, (m) => {
        store.update((st) => (st.profile = { ...st.profile, minutes: m, updatedAt: Date.now() }));
        rerender();
      })
    ),

    h("section", { class: "card" },
      h("h3", null, "Áudio"),
      row("Voz francesa", voiceSel),
      row("Velocidade", rate),
      row("Tocar áudio automaticamente", toggle(s.settings.autoplay, (v) => setSetting("autoplay", v))),
      row("Tradução nos diálogos", toggle(s.settings.showPt, (v) => setSetting("showPt", v)), "Mostrar o português logo de início"),
      h("div", { class: "row gap wrap" }, h("button", { class: "btn soft", onclick: () => speak("Bonjour ! Je suis ta voix française. On y va ?") }, icon("volume"), "Testar voz")),
      h("p", { class: "muted small" }, "Para uma voz bem mais natural no iPhone: Ajustes → Acessibilidade → Conteúdo Falado → Vozes → Francês → baixe uma voz “Melhorada” ou “Premium”. Depois escolha aqui.")
    ),

    h("section", { class: "card" },
      h("h3", null, "Lembrete diário"),
      row("Horário", time),
      h("button", { class: "btn soft", onclick: addReminder }, icon("calendar"), "Adicionar ao Calendário"),
      h("p", { class: "muted small" }, "Cria um evento diário com alarme no seu Calendário. Grátis e sem servidor.")
    ),

    h("section", { class: "card" },
      h("h3", null, "Backup"),
      h("p", { class: "muted small" }, cloud ? "Seu progresso já fica na nuvem, mas você pode guardar uma cópia." : "Sem conta, o progresso vive só neste aparelho. Exporte de vez em quando."),
      h("div", { class: "row gap wrap" },
        h("button", { class: "btn soft", onclick: () => saveFile(`petit-a-petit-${dayKey()}.json`, "application/json", JSON.stringify(store.get())) }, icon("download"), "Exportar"),
        h("button", { class: "btn soft", onclick: () => fileIn.click() }, icon("upload"), "Importar"),
        fileIn
      )
    ),

    h("section", { class: "card" },
      h("h3", null, "Mais"),
      h("button", { class: "list-btn", onclick: () => { go("/hoje"); setTimeout(startTour, 350); } }, icon("route"), "Ver o tour do app de novo", icon("chevron")),
      h("button", {
        class: "list-btn",
        onclick: async () => {
          const data = { title: "Petit à Petit", text: "Aprenda francês comigo: grátis, um pouco por dia.", url: appUrl() };
          try {
            if (navigator.share) await navigator.share(data);
            else {
              await navigator.clipboard.writeText(data.url);
              toast("Link copiado!");
            }
          } catch {}
        },
      }, icon("share"), "Compartilhar o app", icon("chevron")),
      h("button", { class: "list-btn", onclick: installHelp }, icon("download"), "Como instalar no celular", icon("chevron")),
      h("button", { class: "list-btn", onclick: methodSheet }, icon("info"), "Por que este método funciona", icon("chevron")),
      h("button", {
        class: "list-btn danger-text",
        onclick: () =>
          confirmSheet("Apagar todo o progresso?", "Todas as frases, estatísticas e lições criadas serão apagadas" + (cloud ? " deste aparelho e da nuvem." : " deste aparelho."), "Apagar tudo", async () => {
            const prof = store.get().profile;
            store.replace({ profile: prof, settings: store.get().settings });
            if (cloud) await auth.push(store.account(), store.get()).catch(() => {});
            toast("Progresso apagado.");
            rerender();
          }, { danger: true }),
      }, icon("x"), "Apagar progresso", icon("chevron"))
    ),
    h("p", { class: "muted small center pad" }, `Petit à Petit ${VERSION} · feito com carinho, grátis para sempre`)
  );
}
