// Renders the install-tutorial frames with headless Chrome (DevTools protocol, no dependencies).
// Usage: node tools/tutorial/render.mjs   (needs the local server: npm run serve)
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const DIR = new URL(".", import.meta.url).pathname;
const OUT = join(DIR, "out");
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PORT = 9337;
const APP = "http://localhost:5173/";
const ANDROID_UA = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36";
const COUNTS = { ios: 9, android: 8 };

mkdirSync(OUT, { recursive: true });
mkdirSync(join(DIR, "android"), { recursive: true });

const chrome = spawn(CHROME, [
  "--headless=new", `--remote-debugging-port=${PORT}`, `--user-data-dir=${mkdtempSync(join(tmpdir(), "pap-chrome-"))}`,
  "--hide-scrollbars", "--allow-file-access-from-files", "--no-first-run", "--no-default-browser-check", "about:blank",
], { stdio: "ignore" });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function connect() {
  for (let i = 0; i < 60; i++) {
    try {
      const targets = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
      const page = targets.find((t) => t.type === "page");
      if (page) return page.webSocketDebuggerUrl;
    } catch {}
    await sleep(500);
  }
  throw new Error("Chrome did not start");
}

const ws = new WebSocket(await connect());
await new Promise((r) => ws.addEventListener("open", r, { once: true }));
let seq = 0;
const pending = new Map();
const waiters = [];
ws.addEventListener("message", (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.id && pending.has(msg.id)) {
    const { resolve, reject } = pending.get(msg.id);
    pending.delete(msg.id);
    msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result);
  } else if (msg.method) {
    for (const w of [...waiters]) if (w.method === msg.method) { waiters.splice(waiters.indexOf(w), 1); w.resolve(msg.params); }
  }
});
const send = (method, params = {}) => new Promise((resolve, reject) => { const id = ++seq; pending.set(id, { resolve, reject }); ws.send(JSON.stringify({ id, method, params })); });
const waitFor = (method) => new Promise((resolve) => waiters.push({ method, resolve }));

async function load(url) {
  const loaded = waitFor("Page.loadEventFired");
  await send("Page.navigate", { url });
  await loaded;
  await send("Runtime.evaluate", { expression: "document.fonts.ready.then(() => true)", awaitPromise: true });
  await Promise.all([...Array(1)].map(() => sleep(250)));
}

async function shot(file, clip) {
  const { data } = await send("Page.captureScreenshot", { format: "png", ...(clip ? { clip } : {}) });
  writeFileSync(file, Buffer.from(data, "base64"));
}

await send("Page.enable");
await send("Runtime.enable");

// 1) The real app, as an Android phone sees it on first visit.
await send("Emulation.setUserAgentOverride", { userAgent: ANDROID_UA, platform: "Android" });
await send("Emulation.setDeviceMetricsOverride", { width: 400, height: 768, deviceScaleFactor: 2, mobile: true });
await send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });
await load(APP);
await sleep(2500);
await shot(join(DIR, "android", "app.png"));
console.log("android/app.png");

// 2) Tutorial frames.
await send("Emulation.setUserAgentOverride", { userAgent: "Mozilla/5.0 (Macintosh) Chrome/129 Safari/537.36" });
await send("Emulation.setTouchEmulationEnabled", { enabled: false });
await send("Emulation.setDeviceMetricsOverride", { width: 720, height: 1280, deviceScaleFactor: 1, mobile: false });
for (const [platform, n] of Object.entries(COUNTS)) {
  for (let i = 0; i < n; i++) {
    for (const v of ["a", "b"]) {
      await load(`file://${join(DIR, "frames.html")}?f=${platform}-${i}-${v}`);
      const name = `${platform}-${String(i).padStart(2, "0")}-${v}.png`;
      await shot(join(OUT, name));
      process.stdout.write(name + " ");
    }
  }
}
console.log("\ndone");
ws.close();
chrome.kill();
process.exit(0);
