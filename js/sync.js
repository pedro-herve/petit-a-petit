// Keeps the local state and the cloud copy (when logged in) in step.
// Progress is always saved on the device first; the cloud copy is only refreshed at a few
// moments (app opened, session finished, app sent to the background) to stay far below the
// free Firebase quotas: about 3 reads and 2 writes per person per day.
import * as store from "./store.js";
import * as auth from "./auth.js";

export const status = { state: "idle", at: 0 };
const REFRESH_AFTER = 5 * 60000; // coming back to the app pulls again only after 5 minutes
let running = null;

export const isCloudAccount = () => auth.cloudEnabled() && store.account() && store.account() !== "local";

// "This device has progress the cloud hasn't seen yet", kept on disk so it survives closing the app.
const pendingKey = () => `pap:pending:${store.account()}`;
function setPending(on) {
  try {
    on ? localStorage.setItem(pendingKey(), "1") : localStorage.removeItem(pendingKey());
  } catch {}
}
function hasPending() {
  try {
    return localStorage.getItem(pendingKey()) === "1";
  } catch {
    return true;
  }
}
store.onChange(() => isCloudAccount() && setPending(true));

export function syncNow() {
  if (!isCloudAccount() || !navigator.onLine) return Promise.resolve();
  if (running) return running;
  const id = store.account();
  const pending = hasPending();
  setPending(false); // changes made while this runs mark it again
  status.state = "syncing";
  running = (async () => {
    try {
      const remote = await auth.pull(id);
      if (store.account() !== id) return;
      const merged = remote ? store.merge(store.get(), remote) : store.get();
      store.replace(merged, { silent: true });
      if (pending || !remote) await auth.push(id, merged);
      status.state = "ok";
      status.at = Date.now();
    } catch (e) {
      console.warn("sync", e);
      if (pending && store.account() === id) setPending(true);
      status.state = "error";
    } finally {
      running = null;
    }
  })();
  return running;
}

// Closing or leaving the app: send pending progress. Coming back: fetch other devices' progress.
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") {
    if (hasPending()) syncNow();
  } else if (Date.now() - status.at > REFRESH_AFTER) syncNow();
});
window.addEventListener("pagehide", () => hasPending() && syncNow());
window.addEventListener("online", () => hasPending() && syncNow());
