// Small DOM helpers, icons, popovers and sheets.
import { tokens, lookup, typo, normApos } from "./text.js";
import { content } from "./content.js";
import { speak } from "./speech.js";

export function h(tag, props, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === "class") el.className = v;
    else if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === "style" && typeof v === "object") for (const [p, val] of Object.entries(v)) p.startsWith("--") ? el.style.setProperty(p, val) : (el.style[p] = val);
    else if (k === "html") el.innerHTML = v;
    else if (k === "value") el.value = v;
    else if (v === true) el.setAttribute(k, "");
    else el.setAttribute(k, v);
  }
  for (const c of children.flat(Infinity)) {
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : String(c));
  }
  return el;
}

// replaceChildren that skips empty conditionals and flattens arrays.
export function mount(el, ...children) {
  el.replaceChildren(...children.flat(Infinity).filter((c) => c != null && c !== false && c !== ""));
  return el;
}

const ICONS = {
  home: '<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
  route: '<circle cx="6" cy="19" r="2.5"/><path d="M8.5 19h8a3.5 3.5 0 0 0 0-7h-9a3.5 3.5 0 0 1 0-7H15.5"/><circle cx="18" cy="5" r="2.5"/>',
  mic: '<rect x="9" y="2.5" width="6" height="11.5" rx="3"/><path d="M19 10.5v.5a7 7 0 0 1-14 0v-.5M12 18v3.5"/>',
  book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5z"/><path d="M4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  volume: '<path d="M11 5 6 9H3v6h3l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  chevron: '<path d="m9 18 6-6-6-6"/>',
  back: '<path d="m15 18-6-6 6-6"/>',
  flame: '<path d="M12 22c4 0 7-2.7 7-7 0-3.5-2.2-6-4-8 0 2.2-1.2 3.6-2.5 4C12.8 8 11.8 4.7 9 2c0 3.5-2 5.4-3.5 7.4C4.6 10.7 5 12.4 5 15c0 4.3 3 7 7 7z"/>',
  copy: '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  external: '<path d="M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
  download: '<path d="M12 3v12m-5-5 5 5 5-5M5 21h14"/>',
  upload: '<path d="M12 21V9m-5 5 5-5 5 5M5 3h14"/>',
  share: '<path d="M12 3v13M7 8l5-5 5 5M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  headphones: '<path d="M3 14v-2a9 9 0 0 1 18 0v2M21 14v4a2 2 0 0 1-2 2h-1v-7h3M3 14v4a2 2 0 0 0 2 2h1v-7H3"/>',
  pencil: '<path d="M17 3a2.85 2.85 0 0 1 4 4L7.5 20.5 2 22l1.5-5.5z"/>',
  sparkle: '<path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/><path d="M19 16.5l.6 1.4 1.4.6-1.4.6-.6 1.4-.6-1.4-1.4-.6 1.4-.6z"/>',
  chat: '<path d="M21 12a8 8 0 0 1-11.6 7.1L4 21l1.9-5.4A8 8 0 1 1 21 12z"/>',
  eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  sliders: '<path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/>',
  calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  refresh: '<path d="M21 12a9 9 0 1 1-3-6.7L21 8M21 3v5h-5"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
  play: '<path d="M7 4.5v15l12.5-7.5z" fill="currentColor"/>',
  stop: '<rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor"/>',
  record: '<circle cx="12" cy="12" r="6.5" fill="currentColor"/>',
  star: '<path d="M12 3l2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3 6.5 20.2l1-6.2L3 9.6l6.2-.9z"/>',
  type: '<path d="M4 7V4h16v3M9 20h6M12 4v16"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.01"/>',
  heart: '<path d="M12 20s-7.5-4.6-9.2-9.4C1.6 7.1 4 4 7.2 4c2 0 3.6 1.1 4.8 2.8C13.2 5.1 14.8 4 16.8 4 20 4 22.4 7.1 21.2 10.6 19.5 15.4 12 20 12 20z"/>',
  bird: '<path d="M16 7h.01M3.4 18H12a8 8 0 0 0 8-8V7a4 4 0 0 0-7.28-2.3L2 20"/><path d="m20 7 2 .5-2 .5M10 18v3M14 17.75V21M7 18a6 6 0 0 0 3.84-10.61"/>',
  turtle: '<path d="M12 10a6 6 0 0 0-6 6h12a6 6 0 0 0-6-6zM18 16h2a2 2 0 0 0 2-2v-1a2 2 0 0 0-2-2h-1M6 16H3M7 16v3M17 16v3"/>',
};

export function icon(name, cls = "") {
  const span = document.createElement("span");
  span.className = `icon ${cls}`;
  span.setAttribute("aria-hidden", "true");
  span.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ICONS[name] || ""}</svg>`;
  return span;
}

// Escaped mini-markdown: **bold**, *italic*, line breaks.
export function md(text) {
  const esc = String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return h("div", {
    class: "md",
    html: esc
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.+?)\*/g, "<em>$1</em>")
      .replace(/\n/g, "<br>"),
  });
}

export function toast(msg, ms = 2400) {
  const el = h("div", { class: "toast", role: "status" }, msg);
  document.body.append(el);
  requestAnimationFrame(() => el.classList.add("show"));
  setTimeout(() => {
    el.classList.remove("show");
    setTimeout(() => el.remove(), 300);
  }, ms);
}

// Bottom sheet. Returns a function that closes it.
export function sheet(title, body, { onClose } = {}) {
  const close = () => {
    wrap.classList.remove("open");
    setTimeout(() => wrap.remove(), 250);
    onClose?.();
  };
  const panel = h("div", { class: "sheet-panel", role: "dialog", "aria-modal": "true", "aria-label": title },
    h("div", { class: "sheet-head" }, h("h3", null, title), h("button", { class: "icon-btn", "aria-label": "Fechar", onclick: close }, icon("x"))),
    h("div", { class: "sheet-body" }, body)
  );
  const wrap = h("div", { class: "sheet", onclick: (e) => e.target === wrap && close() }, panel);
  document.body.append(wrap);
  requestAnimationFrame(() => wrap.classList.add("open"));
  return close;
}

export function confirmSheet(title, text, okLabel, onOk, { danger = false, cancelLabel = "Cancelar", onCancel } = {}) {
  let close;
  let confirmed = false;
  const body = h("div", null,
    h("p", { class: "muted" }, text),
    h("div", { class: "row gap" },
      h("button", { class: "btn ghost grow", onclick: () => close() }, cancelLabel),
      h("button", { class: `btn grow ${danger ? "danger" : "primary"}`, onclick: () => { confirmed = true; close(); onOk(); } }, okLabel)
    )
  );
  close = sheet(title, body, { onClose: () => !confirmed && onCancel?.() });
}

// ---------- tap-to-translate French text ----------

let pop = null;
function closePop() {
  pop?.remove();
  pop = null;
}
document.addEventListener("pointerdown", (e) => {
  if (pop && !pop.contains(e.target) && !e.target.closest?.(".w")) closePop();
});
window.addEventListener("scroll", closePop, true);

function showGloss(btn, token) {
  closePop();
  const parts = lookup(token, content.gloss);
  pop = h("div", { class: "gloss-pop", role: "tooltip" },
    h("div", { class: "gloss-parts" },
      parts.map(([form, g]) => h("div", { class: "gloss-row" }, h("b", null, typo(form)), h("span", null, g || "—")))
    ),
    h("button", { class: "icon-btn small", "aria-label": "Ouvir", onclick: () => speak(token) }, icon("volume"))
  );
  document.body.append(pop);
  const r = btn.getBoundingClientRect();
  const pr = pop.getBoundingClientRect();
  const left = Math.min(window.innerWidth - pr.width - 12, Math.max(12, r.left + r.width / 2 - pr.width / 2));
  const top = r.top - pr.height - 8 > 8 ? r.top - pr.height - 8 : r.bottom + 8;
  Object.assign(pop.style, { left: `${left}px`, top: `${top}px` });
  speak(token);
}

// French sentence where each word can be tapped for its meaning.
export function frText(text, cls = "fr") {
  const src = normApos(text);
  const el = h("span", { class: cls, lang: "fr" });
  let last = 0;
  for (const m of src.matchAll(/\p{L}+(?:['’-]\p{L}+)*['’]?/gu)) {
    if (m.index > last) el.append(typo(src.slice(last, m.index)));
    const tok = m[0];
    // Inline spans (not buttons) so punctuation never wraps away from its word.
    const open = (e) => {
      e.stopPropagation();
      showGloss(e.currentTarget, tok);
    };
    el.append(h("span", { class: "w", role: "button", tabindex: "0", onclick: open, onkeydown: (e) => e.key === "Enter" && open(e) }, typo(tok)));
    last = m.index + tok.length;
  }
  if (last < src.length) el.append(typo(src.slice(last)));
  return el;
}

export function speakBtn(text, { slow = false, label = "Ouvir", cls = "" } = {}) {
  return h("button", { class: `icon-btn ${cls}`, "aria-label": slow ? "Ouvir devagar" : label, onclick: (e) => { e.stopPropagation(); speak(text, { slow }); } }, icon(slow ? "turtle" : "volume"));
}

export function progressRing(pct, size = 64, stroke = 6, label = "") {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const wrap = h("div", { class: "ring", style: { width: `${size}px`, height: `${size}px` } });
  wrap.innerHTML = `<svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke-width="${stroke}" class="ring-bg"/><circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke-width="${stroke}" class="ring-fg" stroke-linecap="round" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - Math.min(1, pct))}" transform="rotate(-90 ${size / 2} ${size / 2})"/></svg>`;
  wrap.append(h("div", { class: "ring-label" }, label));
  return wrap;
}

export const isStandalone = () => window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
export const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
