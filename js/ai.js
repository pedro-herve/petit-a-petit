// Free AI practice: the app writes the prompt; the learner pastes it into the free tier of
// Claude or ChatGPT. No API key, no server, no cost.
import { toast } from "./ui.js";

export const PROVIDERS = [
  { id: "claude", name: "Claude", url: (q) => `https://claude.ai/new?q=${encodeURIComponent(q)}` },
  { id: "chatgpt", name: "ChatGPT", url: (q) => `https://chatgpt.com/?q=${encodeURIComponent(q)}` },
];

const LEVEL_HINT = {
  A1: "presente, passé composé, futur proche e vocabulário do dia a dia",
  A2: "presente, passé composé, imparfait, futur simple, pronomes le/la/lui/y/en",
  B1: "todos os tempos comuns, subjuntivo, condicional e conectores de argumentação",
  B2: "francês natural e variado, com expressões idiomáticas",
  C1: "francês nativo, com nuances de registro",
};

export const SCENARIOS = [
  { id: "mamie", title: "Ligar para a Mamie", sub: "Sua avó parisiense quer saber da sua semana", role: "minha avó, Mamie Hélène, 84 anos, parisiense do 15e arrondissement, ex-professora de piano, carinhosa e espirituosa. Ela me trata por « tu »", situation: "Eu ligo do Brasil para conversar com ela sobre a minha semana e a dela." },
  { id: "cafe", title: "No café", sub: "Pedir, perguntar o preço, pagar", role: "um garçom simpático de um café parisiense, que me trata por « vous »", situation: "Eu chego para tomar café da manhã e não conheço bem o cardápio." },
  { id: "rue", title: "Perdido na rua", sub: "Pedir direções até o metrô", role: "uma parisiense apressada mas educada, que me trata por « vous »", situation: "Estou perdido perto da Tour Eiffel e preciso chegar à estação de metrô mais próxima." },
  { id: "camille", title: "Papo com a Camille", sub: "O que você fez e o que vai fazer", role: "minha prima Camille, 28 anos, designer, parisiense, fala de forma informal e me trata por « tu »", situation: "A gente conversa sobre o que fizemos na semana e sobre os planos para o fim de semana." },
  { id: "pharma", title: "Na farmácia", sub: "Explicar o que sente e pedir conselho", role: "um farmacêutico atencioso, que me trata por « vous »", situation: "Não estou me sentindo bem e peço um conselho e um remédio." },
  { id: "debat", title: "Debate leve (B1+)", sub: "Dar opinião e argumentar", role: "minha prima Camille, que adora discordar com bom humor e me trata por « tu »", situation: "Debatemos um tema atual escolhido por você; você defende a opinião contrária à minha." },
];

export function conversationPrompt(scenario, { level = "A1", name = "" } = {}) {
  return `Vamos praticar francês por conversa. Eu sou ${name || "um(a) estudante"}, brasileiro(a), nível ${level} do Quadro Europeu.

Regras:
- Você interpreta ${scenario.role}. Situação: ${scenario.situation}
- Fale SOMENTE em francês, com frases curtas e naturais, adequadas ao nível ${level} (${LEVEL_HINT[level] || LEVEL_HINT.A1}).
- Uma fala por vez; espere a minha resposta.
- Depois de cada resposta minha que tiver erro, acrescente no fim uma linha começando com "✏️" com a forma correta e uma explicação curtíssima em português. Se eu acertar, não comente.
- Se eu escrever em português ou travar, me ajude a dizer aquilo em francês e siga a conversa.
- A cada 8 trocas, me dê 3 frases úteis da conversa (francês + português) para eu revisar.

Comece você, com a primeira fala da situação.`;
}

export function correctionPrompt(taskPt, text, level = "A1") {
  return `Sou brasileiro(a) e estou aprendendo francês, nível ${level}. A tarefa era: "${taskPt}"

Meu texto:
"""
${text}
"""

Por favor:
1. Reescreva meu texto em francês correto e natural (mantendo o nível ${level}).
2. Liste cada erro com uma explicação curta em português — principalmente o PORQUÊ da forma correta.
3. Dê uma nota de 0 a 10 e uma dica para a próxima vez.
Seja encorajador e direto.`;
}

export function lessonPrompt(topic, level = "A2") {
  return `Crie uma lição de francês para brasileiros, nível ${level} do Quadro Europeu, sobre: "${topic}".

Responda SOMENTE com um objeto JSON válido (sem comentários, sem texto antes ou depois), neste formato:
{
  "level": "${level}",
  "title": "título curto em francês",
  "titlePt": "título em português",
  "goal": "o que o aluno vai conseguir fazer, em português",
  "dialogue": {
    "title": "título do diálogo em francês",
    "context": "situação em português",
    "lines": [ { "who": "nome", "fr": "fala em francês", "pt": "tradução" } ]
  },
  "cards": [ { "fr": "frase útil em francês", "pt": "tradução natural", "note": "dica opcional de pronúncia ou uso" } ],
  "pourquoi": [ { "title": "pergunta sobre a gramática", "body": "explicação curta em português que mostre o porquê e compare com o português", "examples": [ { "fr": "...", "pt": "..." } ] } ],
  "task": { "pt": "missão de produção em português", "model": "resposta-modelo em francês" },
  "culture": "curiosidade cultural opcional em português",
  "glossary": { "palavra em minúsculas exatamente como aparece no texto": "tradução curta" }
}

Regras: 10 a 14 falas no diálogo; 14 a 16 cards (frases curtas, frequentes e naturais, francês atual); 1 a 2 itens em "pourquoi"; português do Brasil; use apóstrofo reto ('); o glossário deve cobrir todas as palavras do diálogo e dos cards (elisões com apóstrofo, ex.: "j'", "l'").`;
}

export async function sendTo(provider, prompt) {
  try {
    await navigator.clipboard.writeText(prompt);
    toast("Prompt copiado. Se não aparecer pronto lá, é só colar.");
  } catch {}
  window.open(provider.url(prompt), "_blank", "noopener");
}

export async function copyPrompt(prompt) {
  try {
    await navigator.clipboard.writeText(prompt);
    toast("Copiado!");
  } catch {
    toast("Não consegui copiar automaticamente.");
  }
}

// Turns pasted AI output into a lesson the app can use. Throws with a readable message.
export function parseLesson(raw) {
  const text = String(raw).replace(/```(?:json)?/g, "");
  const start = text.search(/[[{]/);
  const end = Math.max(text.lastIndexOf("}"), text.lastIndexOf("]"));
  if (start < 0 || end < start) throw new Error("Não encontrei um JSON no texto colado.");
  let data = JSON.parse(text.slice(start, end + 1));
  if (Array.isArray(data)) data = data[0];
  const ok = (s) => typeof s === "string" && s.trim();
  if (!ok(data?.title)) throw new Error("A lição precisa de um título.");
  const lines = (data.dialogue?.lines || []).filter((l) => ok(l.fr) && ok(l.pt));
  const cards = (data.cards || []).filter((c) => ok(c.fr) && ok(c.pt));
  if (cards.length < 5) throw new Error("A lição precisa de pelo menos 5 frases (cards).");
  const id = `c-${Date.now().toString(36)}`;
  return {
    id,
    level: ["A1", "A2", "B1", "B2", "C1"].includes(data.level) ? data.level : "A2",
    track: "main",
    title: data.title.trim(),
    titlePt: ok(data.titlePt) ? data.titlePt : "",
    goal: ok(data.goal) ? data.goal : "",
    dialogue: { title: data.dialogue?.title || data.title, context: data.dialogue?.context || "", lines: lines.map(({ who, fr, pt }) => ({ who: who || "—", fr, pt })) },
    cards: cards.map((c, i) => ({ id: `${id}-${String(i + 1).padStart(2, "0")}`, fr: c.fr, pt: c.pt, ...(ok(c.note) ? { note: c.note } : {}) })),
    pourquoi: (data.pourquoi || []).filter((p) => ok(p.title) && ok(p.body)).map((p) => ({ title: p.title, body: p.body, examples: (p.examples || []).filter((e) => ok(e.fr)) })),
    task: ok(data.task?.pt) ? { pt: data.task.pt, model: data.task.model || "" } : null,
    culture: ok(data.culture) ? data.culture : "",
    glossary: data.glossary && typeof data.glossary === "object" ? data.glossary : {},
    importedAt: Date.now(),
  };
}
