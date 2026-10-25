// "Praticar": quick drills, free AI conversation, and AI-made lessons the learner can import.
import * as store from "../store.js";
import { currentLevel, indexContent } from "../content.js";
import { h, mount, icon, sheet, toast } from "../ui.js";
import { PROVIDERS, SCENARIOS, conversationPrompt, lessonPrompt, sendTo, copyPrompt, parseLesson } from "../ai.js";
import { start, buildPractice } from "./session.js";
import { go } from "../nav.js";

function drill(title, sub, ic, onClick, disabled) {
  return h("button", { class: "drill", onclick: onClick, disabled }, h("span", { class: "drill-icon" }, icon(ic)), h("span", null, h("b", null, title), h("small", null, sub)));
}

function promptSheet(title, prompt) {
  sheet(title,
    h("div", { class: "stack" },
      h("p", { class: "muted small" }, "O app prepara as instruções; a conversa acontece na versão gratuita do Claude ou do ChatGPT. Nada é pago e o app não envia seus dados a ninguém."),
      h("pre", { class: "prompt-box" }, prompt),
      h("div", { class: "row gap wrap" },
        PROVIDERS.map((p) => h("button", { class: "btn primary", onclick: () => sendTo(p, prompt) }, icon("external"), `Abrir no ${p.name}`)),
        h("button", { class: "btn ghost", onclick: () => copyPrompt(prompt) }, icon("copy"), "Copiar")
      )
    )
  );
}

function lessonSheet() {
  const s = store.get();
  const topic = h("input", { type: "text", placeholder: "Ex.: ir ao cabeleireiro, futebol, receitas da vovó…" });
  const level = h("select", null, ["A1", "A2", "B1", "B2", "C1"].map((l) => h("option", { value: l, selected: l === currentLevel(s) || null }, l)));
  const paste = h("textarea", { rows: 6, placeholder: "Cole aqui o JSON que a IA respondeu", spellcheck: "false" });
  const msg = h("p", { class: "form-msg" });
  sheet("Criar lição com IA",
    h("div", { class: "stack" },
      h("p", { class: "muted small" }, "1. Escolha um tema. 2. Abra a IA gratuita: ela devolve a lição pronta em JSON. 3. Cole a resposta aqui embaixo e importe."),
      h("label", { class: "field" }, h("span", null, "Tema"), topic),
      h("label", { class: "field" }, h("span", null, "Nível"), level),
      h("div", { class: "row gap wrap" },
        PROVIDERS.map((p) =>
          h("button", { class: "btn soft", onclick: () => (topic.value.trim() ? sendTo(p, lessonPrompt(topic.value.trim(), level.value)) : toast("Escreva um tema.")) }, icon("external"), `Gerar no ${p.name}`)
        )
      ),
      h("label", { class: "field" }, h("span", null, "Resposta da IA"), paste),
      msg,
      h("button", {
        class: "btn primary big",
        onclick: () => {
          try {
            const lesson = parseLesson(paste.value);
            store.update((st) => st.custom.push(lesson));
            indexContent(store.get().custom);
            document.querySelector(".sheet")?.remove();
            toast("Lição importada!");
            go(`/trilha/${lesson.id}`);
          } catch (e) {
            msg.textContent = e.message?.startsWith("Unexpected") || e instanceof SyntaxError ? "O JSON colado está incompleto ou inválido. Peça para a IA responder só com o JSON." : e.message;
          }
        },
      }, icon("download"), "Importar lição")
    )
  );
}

export function renderPractice(el) {
  const s = store.get();
  const learned = Object.keys(s.cards).length;
  const enough = learned >= 4;
  const level = currentLevel(s);

  mount(el, 
    h("header", { class: "page-head" }, h("div", null, h("p", { class: "eyebrow" }, "Pratique"), h("h1", { class: "display" }, "Praticar"))),
    h("section", null,
      h("h2", { class: "section-title" }, "Treinos rápidos"),
      !enough && h("p", { class: "muted small" }, "Aprenda pelo menos 4 frases na sessão de hoje para liberar os treinos."),
      h("div", { class: "drill-grid" },
        drill("Ditado", "Ouvir e escrever", "pencil", () => start(buildPractice(s, "dictation"), { title: "Ditado" }), !enough),
        drill("Escuta", "Entender só de ouvido", "headphones", () => start(buildPractice(s, "listen"), { title: "Escuta" }), !enough),
        drill("Falar", "Do português ao francês", "mic", () => start(buildPractice(s, "produce"), { title: "Falar" }), !enough)
      ),
      h("p", { class: "muted small" }, "Os treinos não mexem no calendário de revisões; são prática livre.")
    ),
    h("section", null,
      h("h2", { class: "section-title" }, "Conversar com IA ", h("span", { class: "chip gold tiny" }, "grátis")),
      h("p", { class: "muted small" }, `Role-play no seu nível (${level}), com correção em português. Usa a sua conta gratuita do Claude ou do ChatGPT.`),
      h("div", { class: "scenario-list" },
        SCENARIOS.map((sc) =>
          h("button", { class: `scenario ${sc.id === "mamie" ? "mamie" : ""}`, onclick: () => promptSheet(sc.title, conversationPrompt(sc, { level, name: s.profile.name })) },
            icon(sc.id === "mamie" ? "heart" : "chat"),
            h("span", null, h("b", null, sc.title), h("small", null, sc.sub)),
            icon("chevron")
          )
        ),
        h("button", {
          class: "scenario",
          onclick: () => {
            const t = prompt("Sobre o que você quer conversar?");
            if (t) promptSheet("Tema livre", conversationPrompt({ role: "um(a) parisiense simpático(a) da minha idade, que me trata por « tu »", situation: `Conversamos sobre: ${t}.` }, { level, name: s.profile.name }));
          },
        }, icon("sparkle"), h("span", null, h("b", null, "Tema livre"), h("small", null, "Você escolhe o assunto")), icon("chevron"))
      )
    ),
    h("section", null,
      h("h2", { class: "section-title" }, "Criar lições novas"),
      h("p", { class: "muted small" }, "O conteúdo não acaba: peça à IA uma lição sobre qualquer tema e nível, no formato do app. Ela entra na Trilha em “Minhas lições” e nas suas revisões."),
      h("button", { class: "btn soft big", onclick: lessonSheet }, icon("sparkle"), "Criar lição com IA")
    )
  );
}
