// Optional accounts + cloud copy of progress via Firebase (free Spark plan).
// The SDK is loaded from Google's CDN only when js/config.js has a configuration.
import { firebaseConfig } from "./config.js";

const SDK = "https://www.gstatic.com/firebasejs/10.12.2";
let fb = null;

export const cloudEnabled = () => !!firebaseConfig;

async function init() {
  if (fb || !firebaseConfig) return fb;
  const [app, auth, fs] = await Promise.all([
    import(`${SDK}/firebase-app.js`),
    import(`${SDK}/firebase-auth.js`),
    import(`${SDK}/firebase-firestore.js`),
  ]);
  const a = app.initializeApp(firebaseConfig);
  fb = { auth: auth.getAuth(a), db: fs.getFirestore(a), A: auth, F: fs };
  return fb;
}

export async function currentUser() {
  const f = await init();
  if (!f) return null;
  await f.auth.authStateReady();
  return f.auth.currentUser;
}

export async function signIn(email, password) {
  const f = await init();
  return (await f.A.signInWithEmailAndPassword(f.auth, email.trim(), password)).user;
}

export async function signUp(email, password) {
  const f = await init();
  return (await f.A.createUserWithEmailAndPassword(f.auth, email.trim(), password)).user;
}

export async function resetPassword(email) {
  const f = await init();
  await f.A.sendPasswordResetEmail(f.auth, email.trim());
}

export async function signOut() {
  const f = await init();
  if (f) await f.A.signOut(f.auth);
}

export async function pull(uid) {
  const f = await init();
  const snap = await f.F.getDoc(f.F.doc(f.db, "users", uid));
  return snap.exists() ? JSON.parse(snap.data().data) : null;
}

export async function push(uid, state) {
  const f = await init();
  await f.F.setDoc(f.F.doc(f.db, "users", uid), { data: JSON.stringify(state), updatedAt: f.F.serverTimestamp() });
}

export function authMessage(err) {
  const code = err?.code || "";
  return (
    {
      "auth/invalid-email": "Esse e-mail não parece válido.",
      "auth/missing-password": "Digite a senha.",
      "auth/invalid-credential": "E-mail ou senha incorretos.",
      "auth/wrong-password": "E-mail ou senha incorretos.",
      "auth/user-not-found": "Não existe conta com esse e-mail.",
      "auth/email-already-in-use": "Já existe uma conta com esse e-mail. Tente entrar.",
      "auth/weak-password": "A senha precisa ter pelo menos 6 caracteres.",
      "auth/network-request-failed": "Sem conexão. Tente de novo quando estiver online.",
      "auth/too-many-requests": "Muitas tentativas. Espere alguns minutos.",
    }[code] || "Algo deu errado. Tente de novo."
  );
}
