// First access: account (or local profile) and the daily time the learner wants to study.
import * as store from "../store.js";
import * as auth from "../auth.js";
import { h, icon, toast, confirmSheet } from "../ui.js";
import { syncNow } from "../sync.js";
import { go } from "../nav.js";
import { installCard, shouldOfferInstall } from "../install.js";
import { startExam } from "./session.js";

export const MINUTE_OPTIONS = [5, 10, 15, 20, 30, 45, 60];

const logo = () => h("div", { class: "logo-mark" }, icon("bird"));

export function renderWelcome(root, { onReady }) {
  const cloud = auth.cloudEnabled();
  root.replaceChildren(
    h("main", { class: "welcome" },
      shouldOfferInstall() && installCard(),
      h("div", { class: "welcome-hero" },
        logo(),
        h("h1", { class: "brand" }, "Petit à Petit"),
        h("p", { class: "tagline" }, "Francês de verdade, um pouco por dia.")
      ),
      h("ul", { class: "welcome-list" },
        h("li", null, icon("refresh"), h("div", null, h("b", null, "Revisão no momento certo. "), "O app calcula quando você está prestes a esquecer cada frase, e é aí que ela volta.")),
        h("li", null, icon("headphones"), h("div", null, h("b", null, "Frases reais com áudio. "), "Diálogos em Paris, ditados e repetição em voz alta.")),
        h("li", null, icon("sparkle"), h("div", null, h("b", null, "O porquê, sem decoreba. "), "Explicações curtas que comparam com o português.")),
        h("li", null, icon("heart"), h("div", null, h("b", null, "Trilha Mamie. "), "Para conversar de verdade com a família francesa."))
      ),
      h("div", { class: "welcome-actions" },
        cloud
          ? [
              h("button", { class: "btn primary big", onclick: () => renderAuth(root, "signup", { onReady }) }, "Criar conta grátis"),
              h("button", { class: "btn ghost big", onclick: () => renderAuth(root, "signin", { onReady }) }, "Já tenho conta"),
              h("button", { class: "btn link", onclick: () => startLocal(root, onReady) }, "Usar sem conta (só neste aparelho)"),
            ]
          : [
              h("button", { class: "btn primary big", onclick: () => startLocal(root, onReady) }, "Começar"),
              h("p", { class: "muted small center" }, "Seu progresso fica salvo neste aparelho. Dá para fazer backup em Perfil."),
            ]
      )
    )
  );
}

function startLocal(root, onReady) {
  store.open("local");
  if (store.get().profile) onReady();
  else renderSetup(root, { onReady });
}

function renderAuth(root, mode, { onReady }) {
  const email = h("input", { type: "email", autocomplete: "email", inputmode: "email", placeholder: "voce@email.com", required: true });
  const pass = h("input", { type: "password", autocomplete: mode === "signup" ? "new-password" : "current-password", placeholder: mode === "signup" ? "Mínimo de 6 caracteres" : "Sua senha", required: true });
  const msg = h("p", { class: "form-msg", role: "alert" });
  const submit = h("button", { class: "btn primary big", type: "submit" }, mode === "signup" ? "Criar conta" : "Entrar");

  const onSubmit = async (e) => {
    e.preventDefault();
    msg.textContent = "";
    submit.disabled = true;
    submit.textContent = "Um instante…";
    try {
      const user = mode === "signup" ? await auth.signUp(email.value, pass.value) : await auth.signIn(email.value, pass.value);
      await afterLogin(root, user, { onReady, isNew: mode === "signup" });
    } catch (err) {
      msg.textContent = auth.authMessage(err);
      submit.disabled = false;
      submit.textContent = mode === "signup" ? "Criar conta" : "Entrar";
    }
  };

  root.replaceChildren(
    h("main", { class: "welcome auth" },
      h("button", { class: "icon-btn back-btn", "aria-label": "Voltar", onclick: () => renderWelcome(root, { onReady }) }, icon("back")),
      h("div", { class: "welcome-hero small" }, logo(), h("h1", { class: "brand" }, mode === "signup" ? "Criar conta" : "Entrar")),
      h("form", { class: "form", onsubmit: onSubmit },
        h("label", null, h("span", null, "E-mail"), email),
        h("label", null, h("span", null, "Senha"), pass),
        msg,
        submit
      ),
      h("div", { class: "center" },
        mode === "signin"
          ? [
              h("button", {
                class: "btn link",
                onclick: async () => {
                  if (!email.value.trim()) return (msg.textContent = "Digite seu e-mail acima para receber o link.");
                  try {
                    await auth.resetPassword(email.value);
                    toast("Enviamos um link para redefinir a senha.");
                  } catch (err) {
                    msg.textContent = auth.authMessage(err);
                  }
                },
              }, "Esqueci minha senha"),
              h("button", { class: "btn link", onclick: () => renderAuth(root, "signup", { onReady }) }, "Não tenho conta"),
            ]
          : h("button", { class: "btn link", onclick: () => renderAuth(root, "signin", { onReady }) }, "Já tenho conta"),
        h("p", { class: "muted small" }, "A conta serve para guardar seu progresso na nuvem e usar em mais de um aparelho. É grátis.")
      )
    )
  );
  setTimeout(() => email.focus(), 50);
}

async function afterLogin(root, user, { onReady, isNew }) {
  const local = store.hasLocalProgress();
  store.open(user.uid);
  await syncNow();
  const finish = () => {
    if (!store.get().profile) renderSetup(root, { onReady, email: user.email });
    else {
      store.update((s) => (s.profile = { ...s.profile, email: user.email }));
      onReady();
    }
  };
  if (isNew && local) {
    confirmSheet(
      "Levar seu progresso para a conta?",
      `Encontramos ${Object.keys(local.cards).length} frases estudadas sem conta neste aparelho. Quer juntá-las à sua nova conta?`,
      "Sim, levar",
      () => {
        store.replace(store.merge(local, store.get()));
        syncNow();
        finish();
      },
      { cancelLabel: "Não, começar do zero", onCancel: finish }
    );
  } else finish();
}

export function minutesChooser(selected, onPick) {
  return h("div", { class: "minutes-grid" },
    MINUTE_OPTIONS.map((m) =>
      h("button", { class: `minute-opt ${m === selected ? "on" : ""}`, type: "button", onclick: () => onPick(m) },
        h("b", null, String(m)),
        h("span", null, "min"),
        h("small", null, `${store.newPerDay(m)} novas`)
      )
    )
  );
}

export function renderSetup(root, { onReady, email = "" }) {
  const data = { name: "", minutes: 15, start: "a1" };
  let stepIdx = 0;

  const draw = () => {
    const steps = [
      () =>
        h("div", { class: "setup-step" },
          h("h2", null, "Como podemos te chamar?"),
          h("input", { class: "big-input", type: "text", value: data.name, placeholder: "Seu nome", autocomplete: "given-name", oninput: (e) => (data.name = e.target.value) })
        ),
      () =>
        h("div", { class: "setup-step" },
          h("h2", null, "Quanto tempo por dia?"),
          h("p", { class: "muted" }, "O app monta cada sessão para caber nesse tempo. Mais tempo, mais frases novas por dia. Quando acumulam revisões, entram menos novas."),
          minutesChooser(data.minutes, (m) => {
            data.minutes = m;
            draw();
          }),
          h("div", { class: "callout" }, icon("info"), h("span", null, "Pouco todo dia vence muito de vez em quando. 15 minutos diários é um ótimo começo. Dá para mudar a qualquer momento."))
        ),
      () =>
        h("div", { class: "setup-step" },
          h("h2", null, "Por onde começar?"),
          [
            ["a1", "Do zero", "Começar pela Linha A1: cumprimentos, café, metrô, família. A Trilha Mamie aparece ao longo do caminho."],
            ["test", "Já me viro no básico", "Faça um teste rápido de 20 perguntas. Se acertar 80%, você começa direto na Linha A2."],
          ].map(([id, t, d]) =>
            h("button", { class: `choice ${data.start === id ? "on" : ""}`, type: "button", onclick: () => { data.start = id; draw(); } },
              h("b", null, t),
              h("span", null, d)
            )
          )
        ),
    ];
    const last = stepIdx === steps.length - 1;
    root.replaceChildren(
      h("main", { class: "welcome setup" },
        h("div", { class: "dots" }, steps.map((_, i) => h("span", { class: i === stepIdx ? "on" : "" }))),
        steps[stepIdx](),
        h("div", { class: "welcome-actions" },
          h("button", {
            class: "btn primary big",
            onclick: () => {
              if (stepIdx === 0 && !data.name.trim()) return toast("Digite seu nome.");
              if (!last) {
                stepIdx++;
                return draw();
              }
              store.update((s) => {
                s.profile = { name: data.name.trim(), minutes: data.minutes, start: "a1", email, createdAt: Date.now(), updatedAt: Date.now() };
              });
              onReady();
              go("/hoje");
              if (data.start === "test") setTimeout(() => startExam("A1", { placement: true }), 100);
            },
          }, last ? "C’est parti !" : "Continuar"),
          stepIdx > 0 && h("button", { class: "btn link", onclick: () => { stepIdx--; draw(); } }, "Voltar")
        )
      )
    );
    root.querySelector(".big-input")?.focus();
  };
  draw();
}
