// Free audio: the device's own French voices (Web Speech API), voice recording, and,
// where the browser offers it, speech recognition to check pronunciation.
import { normApos } from "./text.js";

const synth = window.speechSynthesis;
let voices = [];
let settings = { voice: "", rate: 1 };
let token = 0; // bumps on every new utterance or stop, so stale playback can tell it was superseded

export const SLOW = 0.7; // the turtle button plays at 70% of the normal speed

const MALE = ["thomas", "daniel", "nicolas", "jacques", "henri", "paul", "mathieu", "antoine", "louis", "félix", "felix"];
const FEMALE = ["amélie", "amelie", "audrey", "aurélie", "aurelie", "marie", "virginie", "chantal", "céline", "celine", "julie", "léa", "juliette", "claire"];
// Novelty voices that sound robotic or silly.
const AVOID = ["grandma", "grandpa", "rocko", "reed", "sandy", "shelley", "flo", "eddy", "albert", "bad news", "bells", "boing", "bubbles", "cellos", "good news", "jester", "organ", "superstar", "trinoids", "whisper", "wobble", "zarvox", "bahh", "junior", "ralph", "fred", "kathy"];

function loadVoices() {
  voices = (synth?.getVoices() || []).filter((v) => v.lang?.toLowerCase().startsWith("fr") && !AVOID.some((a) => v.name.toLowerCase().includes(a)));
}
if (synth) {
  loadVoices();
  synth.addEventListener?.("voiceschanged", loadVoices);
  // iOS only lets a page speak after a user gesture; a silent utterance on the first touch unlocks it.
  const unlock = () => {
    const u = new SpeechSynthesisUtterance(" ");
    u.volume = 0;
    synth.speak(u);
  };
  document.addEventListener("pointerdown", unlock, { once: true, capture: true });
}

export function configure(s) {
  settings = { ...settings, ...s };
}

const named = (v, list) => list.some((n) => v.name.toLowerCase().includes(n));
const MODERN = ["thomas", "audrey", "aurélie", "aurelie", "marie", "daniel"];
const quality = (v) =>
  (/premium|enhanced|améliorée|melhorada|neural/i.test(v.name + v.voiceURI) ? 2 : 0) + (/fr[-_]FR/i.test(v.lang) ? 1 : 0) + (named(v, MODERN) ? 0.5 : 0);

export function frenchVoices() {
  loadVoices();
  return [...voices].sort((a, b) => quality(b) - quality(a)).map((v) => ({ id: v.voiceURI, name: v.name, lang: v.lang, quality: quality(v) }));
}

function mainVoice() {
  loadVoices();
  if (settings.voice) {
    const v = voices.find((v) => v.voiceURI === settings.voice);
    if (v) return v;
  }
  return [...voices].sort((a, b) => quality(b) - quality(a))[0] || null;
}

// A voice for a dialogue character: a male or female French voice when the phone has one.
function voiceFor(gender) {
  const main = mainVoice();
  if (!gender) return { voice: main, pitch: 1 };
  const list = gender === "m" ? MALE : FEMALE;
  if (main && named(main, list)) return { voice: main, pitch: 1 };
  // Keep the accent: only switch to a voice from the same country (fr-FR voice for Paris).
  const region = (v) => (v?.lang || "").replace("_", "-").toLowerCase();
  const match = [...voices].filter((v) => named(v, list) && (!main || region(v) === region(main))).sort((a, b) => quality(b) - quality(a))[0];
  if (match) return { voice: match, pitch: 1 };
  // Same voice for everyone: a slight pitch change still tells the speakers apart.
  return { voice: main, pitch: gender === "m" ? 0.88 : 1.12 };
}

export const canSpeak = () => !!synth;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Speaks French text. Resolves to true when it played to the end, false if something else
// interrupted it. Waits for the real end of the audio (iOS sometimes skips the "end" event).
export async function speak(text, { slow = false, gender = null } = {}) {
  if (!synth) return false;
  const mine = ++token;
  if (synth.speaking || synth.pending) {
    synth.cancel();
    await sleep(80); // Safari drops an utterance queued right after cancel()
  }
  if (mine !== token) return false;
  const clean = normApos(text).replace(/[«»"]/g, "").replace(/\s+/g, " ").trim();
  if (!clean) return true;
  const u = new SpeechSynthesisUtterance(clean);
  const { voice, pitch } = voiceFor(gender);
  if (voice) u.voice = voice;
  u.lang = voice?.lang || "fr-FR";
  u.pitch = pitch;
  u.rate = (settings.rate || 1) * (slow ? SLOW : 1);
  return new Promise((resolve) => {
    let started = false;
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      clearInterval(poll);
      clearTimeout(limit);
      resolve(mine === token);
    };
    u.onstart = () => (started = true);
    u.onend = finish;
    u.onerror = finish;
    const poll = setInterval(() => {
      if (mine !== token) return finish();
      if (synth.speaking) started = true;
      else if (started) finish();
    }, 200);
    const limit = setTimeout(finish, 5000 + (clean.length * 110) / u.rate);
    synth.speak(u);
  });
}

export function stopSpeaking() {
  token++;
  synth?.cancel();
}

// ---------- recording (shadowing) ----------

export const canRecord = () => !!(navigator.mediaDevices?.getUserMedia && window.MediaRecorder);

export async function startRecording() {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const type = ["audio/mp4", "audio/webm", "audio/ogg"].find((t) => MediaRecorder.isTypeSupported?.(t));
  const rec = new MediaRecorder(stream, type ? { mimeType: type } : undefined);
  const chunks = [];
  rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  rec.start();
  return {
    stop: () =>
      new Promise((resolve) => {
        rec.onstop = () => {
          stream.getTracks().forEach((t) => t.stop());
          resolve(URL.createObjectURL(new Blob(chunks, { type: rec.mimeType })));
        };
        rec.stop();
      }),
  };
}

// ---------- recognition (optional) ----------

const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
export const canRecognize = () => !!Recognition;
export const LISTEN_MAX_MS = 8000;

const ERRORS = {
  "no-speech": "Não ouvi nada. Toque e fale logo em seguida.",
  "audio-capture": "Não encontrei o microfone.",
  "not-allowed": "O microfone ou o reconhecimento de voz foi bloqueado. Libere nos Ajustes do celular.",
  "service-not-allowed": "O reconhecimento de voz não funciona neste modo do celular. Use “Gravar minha voz” para comparar.",
  network: "O reconhecimento de voz precisa de internet.",
};
export const recognitionError = (code) => ERRORS[code] || "O reconhecimento de voz não está disponível agora.";

// Starts listening in French. Returns { done: Promise<string[]>, stop() }.
// Shows partial text through onPartial, stops by itself after LISTEN_MAX_MS.
export function startListening({ onPartial } = {}) {
  const r = new Recognition();
  r.lang = "fr-FR";
  r.interimResults = true;
  r.maxAlternatives = 3;
  r.continuous = false;
  let finals = [];
  let partial = "";
  let settled = false;
  let resolveFn;
  let rejectFn;
  const done = new Promise((res, rej) => {
    resolveFn = res;
    rejectFn = rej;
  });
  const result = () => (finals.length ? finals : partial ? [partial] : []);
  const finish = (err) => {
    if (settled) return;
    settled = true;
    clearTimeout(cap);
    err ? rejectFn(err) : resolveFn(result());
  };
  r.onresult = (e) => {
    const last = e.results[e.results.length - 1];
    partial = [...e.results].map((x) => x[0].transcript).join(" ").trim();
    if (last.isFinal) finals = [...last].map((a) => a.transcript);
    onPartial?.(partial);
  };
  r.onerror = (e) => finish(e.error === "aborted" ? null : e.error || "error");
  r.onend = () => finish();
  const stop = () => {
    try {
      r.stop();
    } catch {}
    setTimeout(() => finish(), 1500); // some phones never fire "end"
  };
  const cap = setTimeout(stop, LISTEN_MAX_MS);
  try {
    r.start();
  } catch (e) {
    finish(e.error || "error");
  }
  return { done, stop };
}
