// Keeps the local state and the cloud copy (when logged in) in step.
import * as store from "./store.js";
import * as auth from "./auth.js";

export const status = { state: "idle", at: 0 };
let timer = null;
let running = null;

export const isCloudAccount = () => auth.cloudEnabled() && store.account() && store.account() !== "local";

export function syncNow() {
  if (!isCloudAccount() || !navigator.onLine) return Promise.resolve();
  if (running) return running;
  const id = store.account();
  status.state = "syncing";
  running = (async () => {
    try {
      const remote = await auth.pull(id);
      if (store.account() !== id) return;
      const merged = remote ? store.merge(store.get(), remote) : store.get();
      store.replace(merged, { silent: true });
      await auth.push(id, merged);
      status.state = "ok";
      status.at = Date.now();
    } catch (e) {
      console.warn("sync", e);
      status.state = "error";
    } finally {
      running = null;
    }
  })();
  return running;
}

export function schedule(delay = 4000) {
  if (!isCloudAccount()) return;
  clearTimeout(timer);
  timer = setTimeout(syncNow, delay);
}

store.onChange(() => schedule());
window.addEventListener("online", () => schedule(500));
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") schedule(500);
});
