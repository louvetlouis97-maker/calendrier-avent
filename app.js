// Calendrier de l'Avent — Équipe cycliste Groupama-FDJ UNITED
// Ne pas modifier : les réglages sont dans config.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import { getAuth, onAuthStateChanged, sendSignInLinkToEmail, isSignInWithEmailLink, signInWithEmailLink, signOut } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, collection, query, where, getDocs, serverTimestamp, Timestamp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { firebaseConfig, START_DATE, PARTNERS, LOGOS, RESULTS_URL } from "./config.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
auth.languageCode = "fr";
const db = getFirestore(app);

const $ = (id) => document.getElementById(id);
const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
const LS_EMAIL = "gfdj-avent-email";
const ls = {
  get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} },
  del(k) { try { localStorage.removeItem(k); } catch (e) {} }
};

// ---------- Dates (heure de Paris : UTC+1 en décembre) ----------
const [SY, SM, SD] = START_DATE.split("-").map(Number);
const DAY = 864e5;
const openAt = (n) => Date.UTC(SY, SM - 1, SD) + (n - 1) * DAY - 36e5;   // minuit à Paris
const closeAt = (n) => openAt(n) + DAY;
const resultAt = (n) => closeAt(n) + 12 * 36e5;                            // lendemain 12h
const WD = ["dim.", "lun.", "mar.", "mer.", "jeu.", "ven.", "sam."];
const MO = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
function label(n) { const d = new Date(Date.UTC(SY, SM - 1, SD + n - 1)); return `${WD[d.getUTCDay()]} ${d.getUTCDate()} ${MO[d.getUTCMonth()]}`; }
const pad = (x) => String(x).padStart(2, "0");
function cdText(ms) {
  const d = Math.floor(ms / DAY), h = Math.floor(ms % DAY / 36e5), m = Math.floor(ms % 36e5 / 6e4), s = Math.floor(ms % 6e4 / 1e3);
  return d > 0 ? `${d} j ${pad(h)} h ${pad(m)}` : `${pad(h)}:${pad(m)}:${pad(s)}`;
}
function todayN(now = Date.now()) { for (let n = 1; n <= 24; n++) if (now >= openAt(n) && now < closeAt(n)) return n; return 0; }

// ---------- État ----------
let user = null, profile = null;
const played = new Set();
const lots = {};          // n -> texte du lot (lu dans Firestore quand la case est ouverte)
let ready = false;

// ---------- Rendu de la grille ----------
const grid = $("grid");
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
function partnerName(p) { return (!p || p === "SGE") ? "Équipe cycliste Groupama-FDJ UNITED" : p; }
function logoHtml(p) {
  const k = p || "TEAM", src = LOGOS[k];
  const tall = (k === "TEAM" || k === "SGE") ? " tall" : "";
  return src ? `<div class="logo-m${tall}" role="img" aria-label="${esc(partnerName(p))}" style="--logo:url('${src}')"></div>` : `<div class="logo-t">${esc(p)}</div>`;
}
const ICON_LOCK = '<svg class="lock" viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="11" width="14" height="10"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>';
const ICON_FLAKE = '<svg class="flake" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2v20M3.3 7l17.4 10M3.3 17L20.7 7M9 4l3 3 3-3M9 20l3-3 3 3"/></svg>';
const ICON_CHECK = '<svg class="check" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M7 12.5l3.2 3.2L17 9"/></svg>';

function stateOf(n, now) {
  if (now < openAt(n)) return "L";
  if (now < closeAt(n)) return played.has(n) ? "P" : "O";
  return now < resultAt(n) ? "C" : "X";
}
let lastKey = "";
function render(force) {
  const now = Date.now();
  const key = PARTNERS.map((_, i) => stateOf(i + 1, now)).join("") + (user ? 1 : 0) + Object.keys(lots).length + (ready ? 1 : 0);
  if (!force && key === lastKey) {
    grid.querySelectorAll(".cd").forEach((el) => { el.textContent = cdText(openAt(+el.dataset.day) - now); });
    return;
  }
  lastKey = key;
  grid.innerHTML = "";
  PARTNERS.forEach((p, i) => {
    const n = i + 1, st = stateOf(n, now);
    const b = document.createElement("button");
    b.type = "button"; b.className = "patch";
    const head = `<div class="head"><div><div class="jour">${label(n)}</div><div class="num">${n}</div></div>`;
    const lot = lots[n] ? `<div class="lot">${esc(lots[n])}</div>` : "";
    if (st === "L") {
      b.classList.add("locked"); b.setAttribute("aria-disabled", "true");
      b.innerHTML = head + ICON_LOCK + `</div>${logoHtml(p)}<div class="state">S'ouvre dans<span class="cd" data-day="${n}">${cdText(openAt(n) - now)}</span></div>` + ICON_FLAKE;
    } else if (st === "O") {
      b.classList.add("open"); b.id = "today";
      b.innerHTML = `<span class="ribbon">Aujourd'hui</span>` + head + `</div>${logoHtml(p)}${lot || '<div class="lot">Un cadeau surprise</div>'}<div class="cta">${user ? "Je tente ma chance" : "Je m'inscris pour jouer"}</div>`;
      b.addEventListener("click", () => {
        if (reduce) return onToday(n);
        b.classList.add("opening");
        setTimeout(() => { b.classList.remove("opening"); onToday(n); }, 420);
      });
    } else if (st === "P") {
      b.classList.add("played");
      b.innerHTML = head + ICON_CHECK + `</div>${logoHtml(p)}<div class="state"><strong>C'est joué !</strong><br>Résultat demain à 12h sur nos réseaux.</div><span class="stamp">Joué !</span>`;
    } else {
      b.classList.add("past"); b.setAttribute("aria-disabled", "true");
      const s = st === "X" ? `Tirage effectué · <a href="${esc(RESULTS_URL)}" target="_blank" rel="noopener">Voir le gagnant</a>` : "Participations closes · Résultat à 12h";
      b.innerHTML = head + `</div>${logoHtml(p)}${lot}<div class="state">${played.has(n) ? "Tu as joué · " : ""}${s}</div>`;
    }
    grid.appendChild(b);
  });
  const t = todayN(now);
  $("goLabel").textContent = !user ? "Je m'inscris pour jouer" : t ? (played.has(t) ? "Voir le calendrier" : "Ouvrir la case du jour") : "Voir le calendrier";
}

// ---------- Fenêtre ----------
const ov = $("ov");
const VIEWS = ["vLogin", "vSent", "vConfirm", "vProfile", "vPlay", "vOk"];
function show(view, kicker, title) {
  VIEWS.forEach((v) => { $(v).hidden = v !== view; });
  $("mKicker").textContent = kicker; $("mTitle").textContent = title;
  ov.hidden = false;
  const first = $(view).querySelector("input,select,button");
  if (first) setTimeout(() => first.focus(), 50);
}
function closeModal() {
  if (!$("vProfile").hidden && user && !profile) return toast("Complète ton profil pour pouvoir jouer.");
  ov.hidden = true; render(true);
}
ov.addEventListener("click", (e) => { if (e.target === ov || e.target.closest("[data-close]")) closeModal(); });
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !ov.hidden) closeModal(); });
let toastT;
function toast(msg) { const t = $("toast"); t.textContent = msg; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => { t.hidden = true; }, 4000); }
const validEmail = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s);

// ---------- Connexion par lien e-mail ----------
function openLogin() { $("loginErr").textContent = ""; $("loginEmail").value = ls.get(LS_EMAIL) || ""; show("vLogin", "Connexion · inscription", "Ton e-mail"); }
$("btnLogin").addEventListener("click", openLogin);
$("vLogin").addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = $("loginEmail").value.trim().toLowerCase();
  if (!validEmail(email)) { $("loginErr").textContent = "Cette adresse e-mail n'est pas valide. Vérifie-la."; return; }
  const btn = $("loginBtn"); btn.disabled = true; $("loginErr").textContent = "";
  try {
    await sendSignInLinkToEmail(auth, email, { url: location.origin + location.pathname, handleCodeInApp: true });
    ls.set(LS_EMAIL, email);
    $("sentTo").textContent = email;
    show("vSent", "Connexion", "Regarde tes mails");
  } catch (err) {
    console.error(err);
    $("loginErr").textContent = err.code === "auth/quota-exceeded"
      ? "Trop de demandes en ce moment. Réessaie dans quelques minutes."
      : "L'envoi du lien a échoué. Vérifie ton adresse et réessaie.";
  } finally { btn.disabled = false; }
});
$("resend").addEventListener("click", openLogin);

async function finishLinkSignIn(email) {
  try {
    await signInWithEmailLink(auth, email, location.href);
    ls.del(LS_EMAIL);
    history.replaceState(null, "", location.pathname);
    ov.hidden = true;
    toast("Tu es connecté !");
  } catch (err) {
    console.error(err);
    history.replaceState(null, "", location.pathname);
    $("loginErr").textContent = err.code === "auth/invalid-email"
      ? "Cette adresse ne correspond pas au lien reçu."
      : "Ce lien a expiré ou a déjà servi. Demande un nouveau lien.";
    show("vLogin", "Connexion · inscription", "Ton e-mail");
  }
}
if (isSignInWithEmailLink(auth, location.href)) {
  const saved = ls.get(LS_EMAIL);
  if (saved) finishLinkSignIn(saved);
  else { $("confirmErr").textContent = ""; show("vConfirm", "Connexion", "Confirme ton e-mail"); }
}
$("vConfirm").addEventListener("submit", (e) => {
  e.preventDefault();
  const email = $("confirmEmail").value.trim().toLowerCase();
  if (!validEmail(email)) { $("confirmErr").textContent = "Cette adresse e-mail n'est pas valide."; return; }
  finishLinkSignIn(email);
});

// ---------- Profil ----------
(function fillDates() {
  const j = $("pJour"), m = $("pMois"), a = $("pAnnee");
  j.innerHTML = '<option value="">Jour</option>' + Array.from({ length: 31 }, (_, i) => `<option>${i + 1}</option>`).join("");
  const mois = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
  m.innerHTML = '<option value="">Mois</option>' + mois.map((x, i) => `<option value="${i + 1}">${x}</option>`).join("");
  const y = new Date().getFullYear();
  a.innerHTML = '<option value="">Année</option>' + Array.from({ length: 90 }, (_, i) => `<option>${y - 18 - i}</option>`).join("");
})();
function ageOn(y, m, d, ref = new Date()) {
  let age = ref.getFullYear() - y;
  if (ref.getMonth() + 1 < m || (ref.getMonth() + 1 === m && ref.getDate() < d)) age--;
  return age;
}
let cpTimer;
$("pCp").addEventListener("input", () => {
  const cp = $("pCp").value.replace(/\D/g, "").slice(0, 5); $("pCp").value = cp;
  clearTimeout(cpTimer);
  if (cp.length !== 5) return;
  cpTimer = setTimeout(async () => {
    try {
      const r = await fetch(`https://geo.api.gouv.fr/communes?codePostal=${cp}&fields=nom`);
      const list = await r.json();
      $("villes").innerHTML = list.map((c) => `<option value="${esc(c.nom)}">`).join("");
      if (list.length === 1 && !$("pVille").value) $("pVille").value = list[0].nom;
    } catch (e) { /* saisie libre */ }
  }, 250);
});
function openProfile(edit) {
  $("profileErr").textContent = "";
  const p = profile || {};
  $("pPrenom").value = p.firstName || ""; $("pNom").value = p.lastName || "";
  if (p.birthDate) { const d = p.birthDate.toDate(); $("pJour").value = d.getUTCDate(); $("pMois").value = d.getUTCMonth() + 1; $("pAnnee").value = d.getUTCFullYear(); }
  $("pSexe").value = p.gender || ""; $("pCp").value = p.postalCode || ""; $("pVille").value = p.city || "";
  $("pOptin").checked = !!p.optinNews; $("pCgu").checked = false;
  $("cguRow").hidden = !!edit;
  $("profileLead").textContent = edit ? `Connecté avec ${user.email}. Tu peux modifier tes informations.` : "Dernière étape, une seule fois : complète ton profil pour participer aux tirages.";
  $("profileBtn").textContent = edit ? "Enregistrer" : "Valider mon profil";
  show("vProfile", edit ? "Mon profil" : "Bienvenue !", edit ? "Mes informations" : "Ton profil");
}
$("vProfile").addEventListener("submit", async (e) => {
  e.preventDefault();
  const err = $("profileErr"); err.textContent = "";
  const firstName = $("pPrenom").value.trim(), lastName = $("pNom").value.trim();
  const d = +$("pJour").value, m = +$("pMois").value, y = +$("pAnnee").value;
  const postalCode = $("pCp").value.trim(), city = $("pVille").value.trim();
  const edit = !!profile;
  if (!firstName || !lastName) { err.textContent = "Renseigne ton prénom et ton nom."; return; }
  if (!d || !m || !y) { err.textContent = "Renseigne ta date de naissance complète."; return; }
  const bd = new Date(Date.UTC(y, m - 1, d));
  if (bd.getUTCDate() !== d) { err.textContent = "Cette date de naissance n'existe pas. Vérifie le jour."; return; }
  if (ageOn(y, m, d) < 18) { err.textContent = "Le jeu est réservé aux personnes de 18 ans et plus."; return; }
  if (!/^\d{5}$/.test(postalCode)) { err.textContent = "Le code postal doit contenir 5 chiffres."; return; }
  if (!city) { err.textContent = "Renseigne ta ville."; return; }
  if (!edit && !$("pCgu").checked) { err.textContent = "Coche la case du règlement pour valider ton inscription."; return; }
  const data = {
    firstName, lastName, email: user.email.toLowerCase(),
    birthDate: Timestamp.fromDate(bd), gender: $("pSexe").value, postalCode, city,
    optinNews: $("pOptin").checked,
    acceptedRulesAt: edit ? profile.acceptedRulesAt : serverTimestamp(),
    createdAt: edit ? profile.createdAt : serverTimestamp(),
    updatedAt: serverTimestamp()
  };
  const btn = $("profileBtn"); btn.disabled = true;
  try {
    await setDoc(doc(db, "users", user.uid), data);
    profile = (await getDoc(doc(db, "users", user.uid))).data();
    ov.hidden = true; updateTopbar(); render(true);
    if (!edit) {
      toast(`C'est tout bon, ${firstName} !`);
      const t = todayN(); if (t && !played.has(t)) setTimeout(() => openPlay(t), 500);
    } else toast("Profil enregistré.");
  } catch (e2) {
    console.error(e2);
    err.textContent = "L'enregistrement a échoué. Vérifie tes informations et réessaie.";
  } finally { btn.disabled = false; }
});

// ---------- Participation ----------
let cur = 0;
function onToday(n) {
  if (!user) return openLogin();
  if (!profile) return openProfile(false);
  if (played.has(n)) return toast("Tu as déjà joué aujourd'hui. Reviens demain !");
  openPlay(n);
}
function openPlay(n) {
  cur = n; $("playErr").textContent = "";
  $("playBy").textContent = "Offert par " + partnerName(PARTNERS[n - 1]);
  show("vPlay", `Case ${n} · tirage au sort`, lots[n] || "Un cadeau surprise");
}
$("playBtn").addEventListener("click", async () => {
  const n = cur, btn = $("playBtn"); btn.disabled = true; $("playErr").textContent = "";
  const ref = doc(db, "participations", `${n}_${user.uid}`);
  try {
    await setDoc(ref, {
      uid: user.uid, day: n, email: profile.email, firstName: profile.firstName,
      lastName: profile.lastName, postalCode: profile.postalCode, createdAt: serverTimestamp()
    });
    played.add(n); success(n);
  } catch (e) {
    console.error(e);
    let already = false;
    try { already = (await getDoc(ref)).exists(); } catch (e2) {}
    if (already) { played.add(n); success(n); }
    else $("playErr").textContent = "La participation n'a pas pu être enregistrée : la case est peut-être fermée. Recharge la page et réessaie.";
  } finally { btn.disabled = false; }
});
function success(n) {
  $("okTxt").textContent = `C'est noté, ${profile.firstName} ! Résultat demain à 12h sur nos réseaux, et le gagnant est prévenu par e-mail.` + (n < 24 ? ` Rendez-vous demain pour la case ${n + 1} !` : "");
  show("vOk", `Case ${n}`, "C'est joué !");
  burst(); render(true);
}

// ---------- Chargements ----------
async function loadLots() {
  const now = Date.now(), jobs = [];
  for (let n = 1; n <= 24; n++) {
    if (now < openAt(n) || lots[n]) continue;
    jobs.push(getDoc(doc(db, "days", String(n))).then((s) => { if (s.exists() && s.data().lot) lots[n] = s.data().lot; }).catch(() => {}));
  }
  await Promise.all(jobs);
}
async function loadPlayed() {
  played.clear();
  if (!user) return;
  try {
    const qs = await getDocs(query(collection(db, "participations"), where("uid", "==", user.uid)));
    qs.forEach((d) => played.add(d.data().day));
  } catch (e) { console.error(e); }
}
function updateTopbar() {
  const a = $("actions");
  if (user) {
    $("who").innerHTML = profile ? `Bonjour <b>${esc(profile.firstName)}</b>, tu es connecté.` : `Connecté avec <b>${esc(user.email)}</b>`;
    a.innerHTML = '<button class="linkbtn" type="button" id="btnProfile">Mon profil</button><button class="linkbtn" type="button" id="btnLogout">Se déconnecter</button>';
    $("btnProfile").onclick = () => openProfile(!!profile);
    $("btnLogout").onclick = async () => { await signOut(auth); toast("Tu es déconnecté."); };
  } else {
    $("who").textContent = "Inscris-toi une fois, joue chaque jour en un clic.";
    a.innerHTML = '<button class="linkbtn" type="button" id="btnLogin2">Se connecter / S\'inscrire</button>';
    $("btnLogin2").onclick = openLogin;
  }
}
onAuthStateChanged(auth, async (u) => {
  user = u; profile = null;
  if (u) {
    try { const s = await getDoc(doc(db, "users", u.uid)); profile = s.exists() ? s.data() : null; } catch (e) { console.error(e); }
    await loadPlayed();
    if (!profile) openProfile(false);
  } else played.clear();
  ready = true; updateTopbar(); render(true);
});
loadLots().then(() => render(true));
setInterval(() => {
  const before = Object.keys(lots).length;
  render();
  // une case vient de s'ouvrir : on charge son lot
  const t = todayN(); if (t && !lots[t] && Date.now() - openAt(t) < 5000) loadLots().then(() => { if (Object.keys(lots).length !== before) render(true); });
}, 1000);
render(true);

// Bouton du haut
$("goToday").addEventListener("click", (e) => {
  e.preventDefault();
  if (!user) return openLogin();
  const t = $("today") || grid;
  t.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "center" });
});

// Navigateur intégré Instagram / Facebook / TikTok
if (/Instagram|FBAN|FBAV|FB_IAB|TikTok|musical_ly|Snapchat|LinkedInApp/i.test(navigator.userAgent)) $("inapp").hidden = false;

// ---------- Neige + confettis ----------
const fx = $("fx"), cx = fx.getContext("2d");
let W, H, flakes = [], conf = [];
function size() { W = fx.width = innerWidth * devicePixelRatio; H = fx.height = innerHeight * devicePixelRatio; }
size(); addEventListener("resize", size);
const nFlakes = reduce ? 0 : Math.min(70, Math.round(innerWidth / 18));
for (let i = 0; i < nFlakes; i++) flakes.push({ x: Math.random(), y: Math.random(), r: 1 + Math.random() * 2.4, s: .0006 + Math.random() * .0012, d: Math.random() * 6 });
function burst() {
  if (reduce) return;
  const cols = ["#E10819", "#FFFFFF", "#006AB1", "#1F294C"], k = devicePixelRatio;
  for (let i = 0; i < 140; i++) conf.push({ x: W / 2, y: H * .45, vx: (Math.random() - .5) * 26 * k, vy: (-Math.random() * 22 - 6) * k, w: (5 + Math.random() * 6) * k, h: (3 + Math.random() * 4) * k, a: Math.random() * 6, va: (Math.random() - .5) * .4, c: cols[i % 4], life: 0 });
}
let tk = 0;
function loop() {
  tk++; cx.clearRect(0, 0, W, H);
  cx.fillStyle = "rgba(255,255,255,.75)";
  for (const f of flakes) { f.y += f.s; if (f.y > 1.02) { f.y = -.02; f.x = Math.random(); } cx.beginPath(); cx.arc((f.x + Math.sin(tk / 90 + f.d) * .01) * W, f.y * H, f.r * devicePixelRatio, 0, 7); cx.fill(); }
  conf = conf.filter((c) => c.life < 160);
  for (const c of conf) { c.life++; c.vy += .55 * devicePixelRatio; c.vx *= .985; c.x += c.vx; c.y += c.vy; c.a += c.va; cx.save(); cx.translate(c.x, c.y); cx.rotate(c.a); cx.fillStyle = c.c; cx.globalAlpha = Math.max(0, 1 - c.life / 160); cx.fillRect(-c.w / 2, -c.h / 2, c.w, c.h); cx.restore(); }
  requestAnimationFrame(loop);
}
if (!reduce) loop();
