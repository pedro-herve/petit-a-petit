// Free audio: the device's own French voices (Web Speech API), voice recording, and,
// where the browser offers it, speech recognition to check pronunciation.
import { normApos } from "./text.js";

const synth = window.speechSynthesis;
let voices = [];
let settings = { voice: "", rate: 0.92 };

const PREFERRED = ["amélie", "amelie", "thomas", "audrey", "aurélie", "aurelie", "marie", "virginie", "google français"];

function loadVoices() {
  voices = (synth?.getVoices() || []).filter((v) => v.lang?.toLowerCase().startsWith("fr"));
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

export function frenchVoices() {
  loadVoices();
  return voices
    .map((v) => ({ id: v.voiceURI, name: v.name, lang: v.lang, quality: /premium|enhanced|améliorée|neural/i.test(v.name + v.voiceURI) ? 2 : 1 }))
    .sort((a, b) => b.quality - a.quality || (a.lang === "fr-FR" ? -1 : 1));
}

function pickVoice() {
  loadVoices();
  if (settings.voice) {
    const v = voices.find((v) => v.voiceURI === settings.voice);
    if (v) return v;
  }
  const fr = voices.filter((v) => v.lang === "fr-FR" || v.lang === "fr_FR");
  const pool = fr.length ? fr : voices;
  return (
    pool.find((v) => /premium|enhanced|neural/i.test(v.name + v.voiceURI)) ||
    pool.find((v) => PREFERRED.some((p) => v.name.toLowerCase().includes(p))) ||
    pool[0] ||
    null
  );
}

export const canSpeak = () => !!synth;

// Speaks French text; resolves when finished (with a timeout because iOS sometimes skips "end").
export function speak(text, { slow = false } = {}) {
  if (!synth) return Promise.resolve();
  synth.cancel();
  const clean = normApos(text).replace(/[«»"]/g, "").replace(/\s+/g, " ").trim();
  const u = new SpeechSynthesisUtterance(clean);
  const v = pickVoice();
  if (v) u.voice = v;
  u.lang = v?.lang || "fr-FR";
  u.rate = slow ? Math.max(0.5, settings.rate - 0.3) : settings.rate;
  return new Promise((resolve) => {
    const limit = setTimeout(resolve, 1500 + clean.length * 140 * (slow ? 1.6 : 1));
    u.onend = u.onerror = () => {
      clearTimeout(limit);
      resolve();
    };
    synth.speak(u);
  });
}

export function stopSpeaking() {
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

export function listen() {
  return new Promise((resolve, reject) => {
    const r = new Recognition();
    r.lang = "fr-FR";
    r.interimResults = false;
    r.maxAlternatives = 3;
    let done = false;
    r.onresult = (e) => {
      done = true;
      resolve([...e.results[0]].map((a) => a.transcript));
    };
    r.onerror = (e) => !done && reject(e.error || e);
    r.onend = () => !done && resolve([]);
    r.start();
  });
}
