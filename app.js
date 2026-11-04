/* =========================================================
   Dossier TP — application
   Mode « en ligne » si config.js donne les adresses du script (GitHub Pages),
   sinon mode démonstration (données dans le navigateur).
   ========================================================= */
const CFG = window.TP_CONFIG || {};
const ONLINE = !!(CFG.apiUrl && CFG.loginUrl);
const DOMAINE = 'elmarche.be';
const PROFS_DEMO = ['olivier.lesenfants@elmarche.be'];
const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const eur = n => (Math.round(n * 100) / 100).toLocaleString('fr-BE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
const num = n => (Math.round(n * 100) / 100).toLocaleString('fr-BE', { maximumFractionDigits: 2 });
const today = () => new Date().toLocaleDateString('fr-BE', { day: '2-digit', month: '2-digit', year: 'numeric' });
const canPrint = (() => { try { return window.top === window.self; } catch (e) { return false; } })();
const enLigne = () => navigator.onLine !== false;

/* ---------- stockage ---------- */
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* stockage indisponible : on garde en mémoire */ } },
};

/* ---------- utilisateur ---------- */
function cap(s) { return s.split('-').map(p => p ? p[0].toUpperCase() + p.slice(1) : p).join('-'); }
function parseEmail(email) {
  const e = email.trim().toLowerCase();
  const [local, dom] = e.split('@');
  if (!local || dom !== DOMAINE) return { error: `Utilisez votre adresse de l'école (…@${DOMAINE}).` };
  const parts = local.split('.');
  const eleve = parts[parts.length - 1] === 'student';
  if (eleve) parts.pop();
  const prenom = cap(parts[0] || '');
  const nom = parts.slice(1).map(cap).join(' ');
  const prof = !eleve && PROFS_DEMO.includes(e);
  if (!eleve && !prof) return { error: "Cette adresse n'est pas dans la liste des professeurs. Demandez à M. Lesenfants de l'ajouter." };
  return { email: e, prenom, nom, role: eleve ? 'eleve' : 'prof' };
}

function nameFromEmail(email) {
  const parts = String(email).split('@')[0].split('.');
  if (/^students?\d*$/.test(parts[parts.length - 1])) parts.pop();
  return { email, prenom: cap(parts[0] || ''), nom: parts.slice(1).map(cap).join(' ') };
}

/* ---------- échange avec le script du Google Sheet ---------- */
let CLE = null;
async function api(a, params = {}) {
  let r;
  try {
    r = await fetch(CFG.apiUrl, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(Object.assign({ a, cle: CLE }, params)) });
  } catch (e) { const err = new Error('Pas de connexion internet.'); err.reseau = true; throw err; }
  let j; try { j = await r.json(); } catch (e) { throw new Error('Réponse illisible du serveur.'); }
  if (!j.ok) { const err = new Error(j.erreur || 'Erreur du serveur.'); err.auth = !!j.auth; throw err; }
  return j.data;
}
function lireCle(cle) {
  try { const p = cle.split('.')[0].replace(/-/g, '+').replace(/_/g, '/'); return JSON.parse(atob(p + '==='.slice((p.length + 3) % 4))); } catch (e) { return null; }
}
let SYNC = { etat: 'ok', msg: '' };
function setSync(etat, msg = '') {
  SYNC = { etat, msg };
  const el = $('#sync'); if (!el) return;
  const t = { ok: 'Enregistré', cours: 'Enregistrement…', hors: 'Hors connexion · enregistré sur l\'appareil', err: msg || 'Erreur' }[etat];
  el.textContent = t; el.className = 'sync sync-' + etat; el.title = msg || t;
}

let USER = null, DATA = null;
function loadUser(u) {
  USER = u;
  DATA = store.get('tp3pelec:' + u.email, null) || { profil: { prenom: u.prenom, nom: u.nom, classe: '3Pélec', confirme: false }, ex: {}, planche: { validee: false, lignes: [] } };
  store.set('tp3pelec:session', u.email);
}
function persist() { if (USER) store.set('tp3pelec:' + USER.email, DATA); }
let CUR_EX = null, syncTimer = null;
function save() {
  if (!USER) return;
  if (ONLINE && USER.role === 'prof') return; // le prof consulte : rien n'est enregistré
  if (ONLINE && CUR_EX && DATA.ex[CUR_EX]) {
    if (DATA.ex[CUR_EX].remis) return;
    DATA.ex[CUR_EX].maj = Date.now();
    (DATA.dirty ||= {})[CUR_EX] = true;
  }
  persist();
  if (ONLINE) { clearTimeout(syncTimer); syncTimer = setTimeout(flushDirty, 1500); if (!enLigne()) setSync('hors'); }
}
let flushing = false;
async function flushDirty() {
  if (!ONLINE || !USER || USER.role !== 'eleve' || flushing) return;
  const ids = Object.keys(DATA.dirty || {});
  if (!ids.length) return;
  if (!enLigne()) { setSync('hors'); return; }
  flushing = true; setSync('cours');
  try {
    for (const id of ids) {
      const d = DATA.ex[id];
      if (!d || d.remis) { delete DATA.dirty[id]; continue; }
      const m = d.maj;
      await api('sauverDossier', { ex: id, data: JSON.stringify(d) });
      if (DATA.ex[id].maj === m) delete DATA.dirty[id];
      (DATA.resume ||= {})[id] = Object.assign(DATA.resume[id] || {}, { maj: Date.now() });
    }
    persist(); setSync('ok');
  } catch (e) {
    if (e.reseau) setSync('hors'); else if (e.auth) deconnecter(e.message); else setSync('err', e.message);
  } finally { flushing = false; }
  if (Object.keys(DATA.dirty || {}).length && enLigne() && SYNC.etat === 'ok') setTimeout(flushDirty, 500);
}
function normEx(d) {
  d = d || {};
  d.principe ||= {}; d.unifilaire ||= {}; d.cablage ||= {}; d.bdc ||= { lignes: [], tva: '', justif: '' };
  d.bdc.lignes ||= []; d.outils ||= {}; d.etapes ||= {};
  return d;
}
function exData(id) {
  DATA.ex[id] = normEx(DATA.ex[id]);
  return DATA.ex[id];
}

/* ---------- variantes par élève ---------- */
function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function rng(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function shuffle(a, r) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
function variante(ex, email) {
  const r = rng(hashStr(email + '|' + ex.id));
  const couleur = r() < 0.5 ? 'crème' : 'blanc';
  const chantier = CHANTIERS[Math.floor(r() * CHANTIERS.length)];
  const alim = r() < 0.5 ? 16 : 20;
  const pls = shuffle(PLANCHE.points.map(p => p.id), r).slice(0, ex.lampes || 0);
  const lampes = pls.map((pl, i) => ({ pl, nom: `Lampe ${i + 1}`, empl: PLANCHE.points.find(p => p.id === pl).nom }));
  let positions;
  for (let k = 0; k < 50; k++) {
    positions = shuffle(PLANCHE.positions.map(p => p.id), r).slice(0, ex.devices.length);
    if (!ex.vv) break;
    const els = ex.devices.map((t, i) => t === 'sch6' ? positions[i].split('-')[0] : null).filter(Boolean);
    if (new Set(els).size === els.length) break;
  }
  let nS = 0;
  const devices = ex.devices.map((type, i) => {
    const rep = type === 'prise' ? 'PC' : 'S' + (++nS);
    const pos = PLANCHE.positions.find(p => p.id === positions[i]);
    const cmd = (ex.cmd && ex.cmd[i] || []).map(j => lampes[j] && lampes[j].nom).filter(Boolean);
    return { type, pos: pos.id, rep, nom: rep, empl: pos.nom, cmd };
  });
  return { couleur, chantier, alim, lampes, devices };
}

/* ---------- navigation ---------- */
let VIEW = { page: 'login' }, EDITOR = null;
function go(v) { if (EDITOR && EDITOR.destroy) EDITOR.destroy(); EDITOR = null; CUR_EX = null; VIEW = v; render(); window.scrollTo(0, 0); }

function render() {
  const app = $('#app');
  if (!USER) { app.innerHTML = loginView(); bindLogin(); return; }
  app.innerHTML = topBar() + '<main id="main" class="wrap"></main>' + footer();
  bindTop();
  const main = $('#main');
  if (USER.role === 'eleve' && !DATA.profil.confirme) return profilView(main);
  if (VIEW.page === 'ex') return exView(main);
  if (VIEW.page === 'apprendre') return apprendreView(main);
  if (VIEW.page === 'catalogue') return catalogueView(main);
  return USER.role === 'prof' ? profHome(main) : homeEleve(main);
}

/* ---------- connexion ---------- */
let LOGIN_MSG = '';
function loginOnline() {
  return `<div class="login">
    <div class="login-card">
      <div class="brand"><span class="brand-mark" aria-hidden="true"><svg viewBox="0 0 32 32"><path d="M18 2 6 18h8l-2 12 12-16h-8z"/></svg></span>
        <div><div class="brand-name">Dossier TP</div><div class="brand-sub">Électricité · 3Pélec · Institut Saint-Roch</div></div></div>
      <h1>Connexion</h1>
      <p class="lead">Connectez-vous une fois avec votre compte Google de l'école (…@${DOMAINE}). L'app garde ensuite votre connexion, même sans internet.</p>
      ${LOGIN_MSG ? `<p class="err" role="alert">${esc(LOGIN_MSG)}</p>` : ''}
      <button type="button" class="btn primary google" id="login-go">Se connecter avec mon compte de l'école</button>
      <ol class="login-steps">
        <li>Une page Google s'ouvre dans un nouvel onglet.</li>
        <li>Cliquez sur « Ouvrir Dossier TP ».</li>
        <li>C'est fait. Si cette fenêtre ne change pas toute seule, rechargez-la.</li>
      </ol>
      <p class="muted small" id="login-net"></p>
      <p class="small"><a href="aide.html">Mode d'emploi : installer et utiliser l'app</a></p>
    </div>
  </div>`;
}
function loginView() {
  if (ONLINE) return loginOnline();
  return `<div class="login">
    <div class="login-card">
      <div class="brand"><span class="brand-mark" aria-hidden="true"><svg viewBox="0 0 32 32"><path d="M18 2 6 18h8l-2 12 12-16h-8z"/></svg></span>
        <div><div class="brand-name">Dossier TP</div><div class="brand-sub">Électricité · 3Pélec · Institut Saint-Roch</div></div></div>
      <h1>Connexion</h1>
      <p class="lead">Connectez-vous avec votre compte Google de l'école.</p>
      <button type="button" class="btn google" disabled title="Disponible quand l'app sera reliée au Google Sheet">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M21.6 12.2c0-.7-.1-1.4-.2-2H12v3.8h5.4a4.6 4.6 0 0 1-2 3v2.5h3.2c1.9-1.7 3-4.3 3-7.3zM12 22c2.7 0 5-.9 6.6-2.4l-3.2-2.5c-.9.6-2 1-3.4 1-2.6 0-4.8-1.8-5.6-4.1H3.1v2.6A10 10 0 0 0 12 22zm-5.6-8a6 6 0 0 1 0-3.9V7.5H3.1a10 10 0 0 0 0 9zM12 6c1.5 0 2.8.5 3.8 1.5l2.9-2.9A10 10 0 0 0 3.1 7.5l3.3 2.6C7.2 7.8 9.4 6 12 6z"/></svg>
        Se connecter avec Google</button>
      <div class="demo-box">
        <p class="demo-title"><span class="pill">Démo</span> En attendant la liaison au Google Sheet, entrez une adresse de l'école :</p>
        <form id="login-form" class="row">
          <label class="sr" for="login-email">Adresse e-mail</label>
          <input id="login-email" type="email" placeholder="prenom.nom.student@elmarche.be" autocomplete="email" required>
          <button class="btn primary" type="submit">Entrer</button>
        </form>
        <p id="login-err" class="err" role="alert"></p>
        <div class="row wrapr">
          <button type="button" class="btn ghost small" data-demo="jean.dupont.student@elmarche.be">Élève de démo</button>
          <button type="button" class="btn ghost small" data-demo="olivier.lesenfants@elmarche.be">Professeur</button>
        </div>
      </div>
    </div>
  </div>`;
}
function bindLogin() {
  if (ONLINE) {
    $('#login-go').addEventListener('click', () => {
      if (!enLigne()) { $('#login-net').textContent = 'La première connexion demande internet.'; return; }
      window.open(CFG.loginUrl, '_blank');
    });
    return;
  }
  const tryLogin = email => {
    const u = parseEmail(email);
    if (u.error) { $('#login-err').textContent = u.error; return; }
    loadUser(u); go({ page: 'home' });
  };
  $('#login-form').addEventListener('submit', e => { e.preventDefault(); tryLogin($('#login-email').value); });
  document.querySelectorAll('[data-demo]').forEach(b => b.addEventListener('click', () => tryLogin(b.dataset.demo)));
}
function profilView(main) {
  main.innerHTML = `<section class="card narrow">
    <h1>Bienvenue</h1>
    <p>Votre nom a été lu dans votre adresse e-mail. Une adresse n'a pas d'accents : corrigez si besoin, puis confirmez. Il apparaîtra sur toutes vos feuilles.</p>
    <form id="pf" class="form-grid">
      <label>Prénom <input id="pf-prenom" required value="${esc(DATA.profil.prenom)}"></label>
      <label>Nom <input id="pf-nom" required value="${esc(DATA.profil.nom)}"></label>
      <label>Classe <input id="pf-classe" value="${esc(DATA.profil.classe)}"></label>
      <div><button class="btn primary" type="submit">Confirmer</button></div>
    </form></section>`;
  $('#pf').addEventListener('submit', e => {
    e.preventDefault();
    Object.assign(DATA.profil, { prenom: $('#pf-prenom').value.trim(), nom: $('#pf-nom').value.trim(), classe: $('#pf-classe').value.trim(), confirme: true });
    if (ONLINE) { DATA.profilDirty = true; persist(); flushProfil(); } else save();
    go({ page: 'home' });
  });
}

/* ---------- barre du haut ---------- */
function topBar() {
  const p = USER.role === 'prof' ? { prenom: USER.prenom, nom: USER.nom } : DATA.profil;
  return `<header class="topbar"><div class="wrap topbar-in">
    <button type="button" class="brand as-link" data-nav="home" aria-label="Accueil">
      <span class="brand-mark" aria-hidden="true"><svg viewBox="0 0 32 32"><path d="M18 2 6 18h8l-2 12 12-16h-8z"/></svg></span>
      <span><span class="brand-name">Dossier TP</span><span class="brand-sub">Institut Saint-Roch · Marche-en-Famenne</span></span>
    </button>
    <nav class="topnav" aria-label="Navigation principale">
      <button type="button" data-nav="home" class="${VIEW.page === 'home' ? 'on' : ''}">${USER.role === 'prof' ? 'Exercices' : 'Mes TP'}</button>
      <button type="button" data-nav="apprendre" class="${VIEW.page === 'apprendre' ? 'on' : ''}">Apprendre</button>
      <button type="button" data-nav="catalogue" class="${VIEW.page === 'catalogue' ? 'on' : ''}">Catalogue</button>
      ${ONLINE ? '<a class="navlink" href="aide.html">Aide</a>' : ''}
    </nav>
    <div class="who">${ONLINE && USER.role === 'eleve' ? '<span id="sync" class="sync" role="status"></span>' : ''}<span class="who-name">${esc(p.prenom)} ${esc(p.nom)}</span><span class="pill ${USER.role === 'prof' ? 'pill-prof' : ''}">${USER.role === 'prof' ? 'Professeur' : esc(DATA.profil.classe)}</span>
      <button type="button" class="btn ghost small" id="logout">Déconnexion</button></div>
  </div></header>`;
}
function footer() {
  return `<footer class="foot wrap"><span>${ONLINE ? 'Dossier TP · Institut Saint-Roch · Marche-en-Famenne' : 'Dossier TP · version de démonstration · les données restent dans ce navigateur.'}</span><span>Créé par Lesenfants Olivier</span></footer>`;
}
function bindTop() {
  document.querySelectorAll('[data-nav]').forEach(b => b.addEventListener('click', () => go({ page: b.dataset.nav })));
  $('#logout').addEventListener('click', () => {
    if (ONLINE) return deconnecter('');
    store.set('tp3pelec:session', null); USER = null; DATA = null; go({ page: 'login' });
  });
  if ($('#sync')) setSync(SYNC.etat, SYNC.msg);
}
function deconnecter(msg) {
  store.set('tp3pelec:cle', null); CLE = null; USER = null; DATA = null; LOGIN_MSG = msg || ''; go({ page: 'login' });
}

/* ---------- accueil élève ---------- */
function etatEx(ex) {
  const d = DATA.ex[ex.id], r = (DATA.resume || {})[ex.id];
  if ((d && d.remis) || (!d && r && r.remis)) return { lbl: 'Remis', cls: 'ok' };
  if (!d && r) return { lbl: 'En cours', cls: 'cur' };
  const touche = d && (d.bdc.lignes.length || (d.cablage.wires || []).length || (d.cablage.placed && Object.keys(d.cablage.placed).length) || (d.principe.syms || []).length || (d.unifilaire.points || []).length || Object.values(d.etapes || {}).some(Boolean) || Object.values(d.outils || {}).some(Boolean));
  return touche ? { lbl: 'En cours', cls: 'cur' } : { lbl: 'À commencer', cls: '' };
}
function homeEleve(main) {
  const planche = DATA.planche.validee;
  main.innerHTML = `
    <section class="hello">
      <h1>Mes travaux pratiques</h1>
      <p>Chaque TP contient l'énoncé, le mode opératoire, les schémas, le bon de commande et la liste d'outillage. Votre version de l'exercice est personnelle : emplacements et finitions changent d'un élève à l'autre.</p>
    </section>
    ${planche ? '' : `<p class="notice">Commencez par le <b>TP 0</b> : la liste du matériel de la planche, une fois validée par le professeur, sera reprise d'office dans les bons de commande suivants.</p>`}
    <ol class="ex-list">${EXERCICES.map(ex => {
      const e = etatEx(ex);
      return `<li><button type="button" class="ex-card" data-ex="${ex.id}">
        <span class="ex-num">TP ${ex.num}</span>
        <span class="ex-main"><span class="ex-title">${esc(ex.titre)}</span><span class="ex-sub">${esc(ex.court)}</span></span>
        <span class="state ${e.cls}">${e.lbl}</span></button></li>`;
    }).join('')}</ol>`;
  main.querySelectorAll('[data-ex]').forEach(b => b.addEventListener('click', () => go({ page: 'ex', id: b.dataset.ex, tab: 'enonce' })));
}

/* ---------- exercice ---------- */
const TABS_CABLAGE = [['enonce', 'Énoncé'], ['mode', 'Mode opératoire'], ['principe', 'Principe'], ['unifilaire', 'Unifilaire'], ['cablage', 'Câblage'], ['bdc', 'Bon de commande'], ['outils', 'Outillage'], ['remise', 'Remise']];
const TABS_PLANCHE = [['enonce', 'Énoncé'], ['mode', 'Mode opératoire'], ['position', 'Schéma de position'], ['bdc', 'Bon de commande'], ['outils', 'Outillage'], ['remise', 'Remise']];
let PV = null; const SCRATCH = {}, FETCHED = {};
let CTX = { planche: { validee: false, lignes: [] }, eleve: null, lecture: false };
function exView(main) {
  const ex = EXERCICES.find(e => e.id === VIEW.id);
  const tabs = ex.kind === 'planche' ? TABS_PLANCHE : TABS_CABLAGE;
  const tab = VIEW.tab || 'enonce';
  const email = USER.role === 'prof' ? (VIEW.eleve || 'jean.dupont.student@elmarche.be') : USER.email;
  const v = variante(ex, email);
  let d, p;
  CTX = { planche: DATA.planche, eleve: null, lecture: false };
  if (USER.role === 'prof' && ONLINE && VIEW.eleve) {
    const key = VIEW.eleve + '|' + ex.id;
    if (!PV || PV.key !== key) {
      main.innerHTML = '<p class="muted">Chargement du dossier de l\'élève…</p>';
      api('profDossier', { email: VIEW.eleve, ex: ex.id })
        .then(r => { PV = Object.assign({ key }, r, { data: normEx(r.data) }); if (VIEW.page === 'ex' && VIEW.eleve + '|' + VIEW.id === key) exView(main); })
        .catch(e => { main.innerHTML = `<p class="err">${esc(e.message)}</p>`; });
      return;
    }
    d = PV.data; p = PV.profil || nameFromEmail(email);
    CTX = { planche: PV.planche, eleve: VIEW.eleve, lecture: true };
  } else if (USER.role === 'prof') {
    d = ONLINE ? (SCRATCH[ex.id] ||= normEx({})) : exData(ex.id);
    p = nameFromEmail(email);
  } else {
    d = exData(ex.id); p = DATA.profil; CUR_EX = ex.id;
    if (ONLINE && !FETCHED[ex.id] && enLigne()) {
      FETCHED[ex.id] = true;
      api('lireDossier', { ex: ex.id }).then(r => {
        if (!r) return;
        const loc = DATA.ex[ex.id];
        if ((DATA.dirty || {})[ex.id] && !r.remis) return;
        if (!loc || (r.maj || 0) >= (loc.maj || 0) || r.remis !== !!loc.remis) {
          const avant = JSON.stringify(loc);
          DATA.ex[ex.id] = normEx(r); persist();
          if (avant !== JSON.stringify(DATA.ex[ex.id]) && VIEW.page === 'ex' && VIEW.id === ex.id) go(VIEW);
        }
      }).catch(e => { if (e.auth) deconnecter(e.message); });
    }
  }
  const tabLbl = tabs.find(t => t[0] === tab)[1];
  main.innerHTML = `
    <div class="crumbs"><button type="button" class="as-link" data-nav2="home">← ${USER.role === 'prof' ? (CTX.eleve ? 'Mes élèves' : 'Exercices') : 'Mes TP'}</button>
      ${canPrint ? '<button type="button" class="btn ghost small" id="print">Imprimer cette feuille</button>' : ''}</div>
    <section class="cartouche" aria-label="En-tête de la feuille">
      <div class="c-school"><b>Institut Saint-Roch</b><span>Marche-en-Famenne</span><span>Travaux pratiques · électricité</span></div>
      <div class="c-cell"><span class="k">Nom</span><span class="v">${esc(p.nom)}</span></div>
      <div class="c-cell"><span class="k">Prénom</span><span class="v">${esc(p.prenom)}</span></div>
      <div class="c-cell"><span class="k">Classe</span><span class="v">${esc(p.classe || '3Pélec')}</span></div>
      <div class="c-cell"><span class="k">Date</span><span class="v mono">${today()}</span></div>
      <div class="c-tp"><span class="k">TP ${esc(ex.num)}</span><span class="v">${esc(ex.titre)}</span></div>
      <div class="c-sheet"><span class="k">Feuille</span><span class="v">${esc(tabLbl)}</span></div>
    </section>
    ${USER.role === 'prof' && CTX.eleve ? `<p class="notice prof">Dossier de <b>${esc(p.prenom)} ${esc(p.nom)}</b> (${esc(email)}) · ${PV.remis ? 'remis' : PV.data && PV.data.maj ? 'en cours' : 'pas encore commencé'}. Consultation : vos modifications ne sont pas enregistrées.</p>` : ''}
    ${USER.role === 'prof' && !CTX.eleve ? `<p class="notice prof">Aperçu professeur : version de l'exercice pour <b>${esc(email)}</b>.${ONLINE ? ' Rien n\'est enregistré.' : ` <label class="inline">Autre élève <input id="pv-email" type="email" value="${esc(email)}"></label>`}</p>` : ''}
    ${USER.role === 'eleve' && d.remis ? '<p class="notice">Ce dossier est remis : il ne peut plus être modifié. Si vous devez le corriger, demandez au professeur de vous le rendre.</p>' : ''}
    <nav class="tabs" aria-label="Feuilles du dossier">${tabs.map(([k, l]) => `<button type="button" data-tab="${k}" class="${k === tab ? 'on' : ''}" aria-current="${k === tab ? 'page' : 'false'}">${l}</button>`).join('')}</nav>
    <section id="sheet" class="sheet"></section>`;
  main.querySelector('[data-nav2]').addEventListener('click', () => go({ page: 'home' }));
  main.querySelectorAll('[data-tab]').forEach(b => b.addEventListener('click', () => go(Object.assign({}, VIEW, { tab: b.dataset.tab }))));
  const pr = $('#print'); if (pr) pr.addEventListener('click', () => window.print());
  const pv = $('#pv-email'); if (pv) pv.addEventListener('change', () => { if (!parseEmail(pv.value).error) go(Object.assign({}, VIEW, { eleve: pv.value.trim().toLowerCase() })); });
  main.querySelector('[data-nav2]').addEventListener('click', () => { if (CTX.eleve) PV = null; });
  const sheet = $('#sheet');
  const onChange = () => save();
  ({
    enonce: () => enonceSheet(sheet, ex, v),
    mode: () => modeSheet(sheet, ex, d),
    principe: () => { sheet.innerHTML = sheetHead('Schéma de principe', 'Dessinez le circuit entre L1 et N. Le disjoncteur bipolaire et la terre sont déjà imprimés.', 'sch-principe') + '<div id="ed"></div>'; EDITOR = new PrincipeEditor($('#ed'), d.principe, { onChange }); bindFiches(sheet); },
    unifilaire: () => { sheet.innerHTML = sheetHead('Schéma unifilaire', 'Complétez la protection, la canalisation et les points raccordés. Le schéma se dessine à droite, comme dans Trikker.', 'sch-unifilaire') + '<div id="ed"></div>'; EDITOR = new UnifilaireEditor($('#ed'), d.unifilaire, { onChange }); bindFiches(sheet); },
    cablage: () => { sheet.innerHTML = sheetHead('Schéma de câblage', 'Placez les appareils aux emplacements de l\'énoncé, posez les douilles, puis tirez chaque fil. Dans la boîte, chaque point noir correspond à une borne Wago.', 'sch-cablage') + '<div id="ed"></div>'; EDITOR = new CablageEditor($('#ed'), d.cablage, { onChange }); bindFiches(sheet); },
    position: () => { sheet.innerHTML = sheetHead('Schéma de position', 'Planche vue de face, cotes en mm. Reportez ces cotes au crayon sur la planche avant de fixer quoi que ce soit.', 'sch-position') + '<div class="svg-wrap paper-wrap" id="pos"></div>'; renderPosition($('#pos')); bindFiches(sheet); },
    bdc: () => bdcSheet(sheet, ex, v, d),
    outils: () => outilsSheet(sheet, ex, d),
    remise: () => remiseSheet(sheet, ex, d),
  })[tab]();
}
function sheetHead(titre, txt, fiche) {
  return `<div class="sheet-head"><div><h2>${titre}</h2><p>${txt}</p></div>${fiche ? `<button type="button" class="btn ghost small" data-fiche="${fiche}">Comment faire ?</button>` : ''}</div>`;
}
function bindFiches(root) { root.querySelectorAll('[data-fiche]').forEach(b => b.addEventListener('click', () => openFiche(b.dataset.fiche))); }

/* ---------- énoncé ---------- */
function enonceSheet(sheet, ex, v) {
  if (ex.kind === 'planche') {
    sheet.innerHTML = `${sheetHead('Énoncé', '')}
      <div class="enonce">
        <p class="situation">${esc(ex.intro)}</p>
        <dl class="facts">
          <div><dt>Chantier</dt><dd>${esc(v.chantier.texte)}</dd></div>
          <div><dt>Support</dt><dd>Planche en bois de 800 × 600 mm.</dd></div>
          <div><dt>À fixer</dt><dd>3 rosaces 95 × 95 mm (points lumineux), 2 boîtiers en saillie doubles, 1 boîtier en saillie simple, 1 boîte de dérivation 75 × 75 mm.</dd></div>
          <div><dt>Tubes</dt><dd>PVC gris rigide : Ø 16 mm vers les points lumineux, Ø 20 mm vers les boîtiers du bas. Alimentation : <b>Ø ${v.alim} mm</b>.</dd></div>
          <div><dt>À remettre</dt><dd>Bon de commande complet (avec TVA), liste d'outillage, photo de la planche terminée.</dd></div>
        </dl>
        <p class="notice">La liste du matériel de ce TP, une fois validée par le professeur, sera reprise d'office dans tous les bons de commande suivants.</p>
      </div>`;
    return;
  }
  const finitions = `Niko Original <b>${v.couleur}</b>, montage apparent dans les boîtiers en saillie ${v.couleur} existants.`;
  const montage = ex.montage === 'série' ? 'Les deux lampes sont raccordées <b>en série</b>.' : ex.montage === 'parallèle' ? 'Les deux lampes sont raccordées <b>en parallèle</b>.' : ex.montage === 'double' ? 'Chaque touche commande sa propre lampe.' : '';
  sheet.innerHTML = `${sheetHead('Énoncé', '')}
    <div class="enonce">
      <p class="situation">Vous travaillez dans une entreprise d'électricité générale. Votre patron vous charge du raccordement de l'installation apparente décrite ci-dessous, sur la planche déjà équipée de ses tubes et boîtiers. ${esc(ex.intro)}</p>
      <dl class="facts">
        <div><dt>Chantier</dt><dd>${esc(v.chantier.texte)}</dd></div>
        <div><dt>Demande du client</dt><dd>${finitions}</dd></div>
        ${montage ? `<div><dt>Montage</dt><dd>${montage}</dd></div>` : ''}
      </dl>
      <div class="table-wrap"><table class="tbl">
        <thead><tr><th>Repère</th><th>Appareil</th><th>Emplacement</th><th>Commande</th></tr></thead>
        <tbody>
          ${v.devices.map(dv => `<tr><td class="mono">${dv.rep}</td><td>${esc(APPAREILS[dv.type].nom)} (${APPAREILS[dv.type].court})</td><td>${esc(dv.empl)}</td><td>${dv.cmd.length ? esc(dv.cmd.join(' et ')) : '—'}</td></tr>`).join('')}
          ${v.lampes.map(l => `<tr><td class="mono">${l.nom.replace('Lampe ', 'L')}</td><td>Point lumineux (douille E27 + ampoule LED)</td><td>${esc(l.empl)}</td><td>—</td></tr>`).join('')}
        </tbody></table></div>
      <h3>Plan des emplacements</h3>
      <div class="svg-wrap paper-wrap" id="plan"></div>
    </div>`;
  renderPlanEnonce($('#plan'), v);
}

/* ---------- mode opératoire ---------- */
function modeSheet(sheet, ex, d) {
  const etapes = ex.kind === 'planche' ? ETAPES_PLANCHE : ETAPES_CABLAGE;
  d.etapes ||= {};
  const n = () => etapes.filter((_, i) => d.etapes[i]).length;
  sheet.innerHTML = `${sheetHead('Mode opératoire', 'Suivez les étapes dans l\'ordre et cochez-les au fur et à mesure. « Comment faire ? » ouvre la fiche qui explique l\'étape.')}
    <p class="progress"><span id="mo-n">${n()}</span> / ${etapes.length} étapes faites</p>
    <ol class="steps">${etapes.map((s, i) => `
      <li class="${d.etapes[i] ? 'done' : ''}">
        <label class="step"><input type="checkbox" data-i="${i}" ${d.etapes[i] ? 'checked' : ''}><span class="step-n">${i + 1}</span><span class="step-t">${esc(s.t)}</span></label>
        <span class="step-side">${s.prof ? '<span class="pill pill-prof">Avec le prof</span>' : ''}${s.f ? `<button type="button" class="as-link" data-fiche="${s.f}">Comment faire ?</button>` : ''}</span>
      </li>`).join('')}</ol>`;
  sheet.querySelectorAll('input[type=checkbox]').forEach(c => c.addEventListener('change', () => {
    d.etapes[c.dataset.i] = c.checked; c.closest('li').classList.toggle('done', c.checked); $('#mo-n').textContent = n(); save();
  }));
  bindFiches(sheet);
}

/* ---------- bon de commande ---------- */
function catItem(id) { return CATALOGUE.find(c => c.id === id); }
const CATALOGUE_ORIGINE = CATALOGUE.map(it => ({ ...it }));
function loadCatalogue() { const c = store.get('tp3pelec:catalogue', null); if (Array.isArray(c) && c.length) CATALOGUE.splice(0, CATALOGUE.length, ...c); }
function saveCatalogue() { store.set('tp3pelec:catalogue', CATALOGUE); }
const RETIRE = id => ({ id, des: 'Article retiré du catalogue', ref: id, marque: '', unite: 'pc', prix: 0, verif: false });
function bdcSheet(sheet, ex, v, d) {
  const isPlanche = ex.kind === 'planche';
  const planche = CTX.planche || { validee: false, lignes: [] };
  const base = isPlanche ? [] : (planche.validee ? planche.lignes : []);
  const draw = () => {
    const rows = [...base.map(l => ({ ...l, lock: true })), ...d.bdc.lignes];
    let total = 0;
    const body = rows.map((l, i) => {
      const it = catItem(l.id) || RETIRE(l.id); const pt = it.prix * (l.q || 0); total += pt;
      return `<tr class="${l.lock ? 'locked' : ''}">
        <td class="mono c">${i + 1}</td>
        <td>${esc(it.des)}${it.marque && !it.des.includes(it.marque) ? ' — ' + esc(it.marque) : ''}${it.verif ? '<span class="verif" title="Prix à vérifier">*</span>' : ''}${l.lock ? '<span class="lock" title="Matériel de la planche, validé au TP 0">planche</span>' : ''}</td>
        <td class="mono">${esc(it.ref)}</td>
        <td class="num">${l.lock ? num(l.q) : `<input type="number" min="0" step="${it.unite === 'm' ? '0.1' : '1'}" value="${l.q}" data-q="${i - base.length}" aria-label="Quantité">`}</td>
        <td>${it.unite}</td>
        <td class="num mono">${eur(it.prix)}</td>
        <td class="num mono">${eur(pt)}</td>
        <td>${l.lock ? '' : `<button type="button" class="ibtn" data-del="${i - base.length}" aria-label="Retirer la ligne">✕</button>`}</td></tr>`;
    }).join('');
    const tva = d.bdc.tva ? +d.bdc.tva : 0, mt = total * tva / 100;
    sheet.querySelector('#bdc-body').innerHTML = body || `<tr><td colspan="8" class="empty">Aucune ligne. Ajoutez le matériel depuis le catalogue.</td></tr>`;
    sheet.querySelector('#t-ht').textContent = eur(total);
    sheet.querySelector('#t-tva').textContent = d.bdc.tva ? eur(mt) : '—';
    sheet.querySelector('#t-ttc').textContent = d.bdc.tva ? eur(total + mt) : '—';
    sheet.querySelectorAll('[data-q]').forEach(inp => inp.addEventListener('change', () => { d.bdc.lignes[+inp.dataset.q].q = Math.max(0, +inp.value || 0); save(); draw(); }));
    sheet.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', () => { d.bdc.lignes.splice(+b.dataset.del, 1); save(); draw(); }));
  };
  sheet.innerHTML = `${sheetHead('Bon de commande', isPlanche ? 'Listez tout le matériel nécessaire pour monter la planche. Un oubli vous pénalise : le matériel n\'est commandé qu\'une fois.' : 'Le matériel de la planche est repris d\'office. Ajoutez seulement ce qui est propre à ce TP : appareils, douilles, ampoules, bornes, fils.', 'regles-tva')}
    ${!isPlanche && !planche.validee ? '<p class="notice">Le matériel de la planche n\'est pas encore validé (TP 0). Il apparaîtra ici automatiquement après validation par le professeur.</p>' : ''}
    <div class="row between wrapr"><button type="button" class="btn primary" id="add">Ajouter depuis le catalogue</button>
      ${isPlanche ? `<span class="demo-inline">${planche.validee ? '<span class="state ok">Liste validée par le professeur</span>' : ''}${CTX.eleve ? `<button type="button" class="btn ${planche.validee ? 'ghost small' : 'primary'}" id="valid-prof">${planche.validee ? 'Valider à nouveau cette liste' : 'Valider cette liste (matériel de la planche)'}</button>` : ''}${!ONLINE && !planche.validee ? '<button type="button" class="btn ghost small" id="valid-demo" title="En vrai, c\'est le professeur qui valide depuis son app">Démo : simuler la validation par le prof</button>' : ''}<span id="valid-msg" class="muted small" role="status"></span></span>` : ''}</div>
    <div class="table-wrap"><table class="tbl bdc">
      <thead><tr><th class="c">N°</th><th>Description</th><th>Réf.</th><th class="num">Quant.</th><th>Unité</th><th class="num">Prix unit.</th><th class="num">Prix total</th><th><span class="sr">Actions</span></th></tr></thead>
      <tbody id="bdc-body"></tbody></table></div>
    <div class="totals">
      <div class="tva-box">
        <label for="tva">Taux de TVA</label>
        <select id="tva"><option value="">— choisir —</option><option value="6">6 %</option><option value="21">21 %</option></select>
        <label for="justif">Justification <span class="muted">(pourquoi ce taux ?)</span></label>
        <textarea id="justif" rows="2" placeholder="Ex. : rénovation d'un logement privé de plus de 10 ans…">${esc(d.bdc.justif)}</textarea>
      </div>
      <dl class="sum">
        <div><dt>Total HTVA</dt><dd id="t-ht" class="mono">0,00 €</dd></div>
        <div><dt>TVA</dt><dd id="t-tva" class="mono">—</dd></div>
        <div class="grand"><dt>Total TVAC</dt><dd id="t-ttc" class="mono">—</dd></div>
      </dl>
    </div>
    <p class="foot-note">Prix HTVA. Appareillage Niko : ${NIKO_PRIX_SOURCE}. <span class="verif">*</span> Autres articles : prix de l'ancienne liste ou estimés, à vérifier.</p>`;
  $('#tva').value = d.bdc.tva || '';
  $('#tva').addEventListener('change', e => { d.bdc.tva = e.target.value; save(); draw(); });
  $('#justif').addEventListener('input', e => { d.bdc.justif = e.target.value; save(); });
  $('#add').addEventListener('click', () => openCatalogue(id => {
    const it = catItem(id);
    const ex2 = d.bdc.lignes.find(l => l.id === id);
    if (ex2) ex2.q = (ex2.q || 0) + 1; else d.bdc.lignes.push({ id, q: it.unite === 'm' ? 1 : 1 });
    save(); draw();
  }));
  const vp = $('#valid-prof');
  if (vp) vp.addEventListener('click', () => {
    if (!d.bdc.lignes.length) { $('#valid-msg').textContent = 'La liste de l\'élève est vide.'; return; }
    const lignes = d.bdc.lignes.map(l => ({ id: l.id, q: l.q }));
    vp.disabled = true; $('#valid-msg').textContent = 'Validation…';
    api('profValiderPlanche', { email: CTX.eleve, lignes }).then(() => { PV.planche = { validee: true, lignes }; go(VIEW); })
      .catch(e => { vp.disabled = false; $('#valid-msg').textContent = e.message; });
  });
  const vd = $('#valid-demo');
  if (vd) vd.addEventListener('click', () => {
    if (!d.bdc.lignes.length) { vd.textContent = 'Ajoutez d\'abord des lignes'; return; }
    DATA.planche = { validee: true, lignes: d.bdc.lignes.map(l => ({ id: l.id, q: l.q })) }; save(); go(VIEW);
  });
  bindFiches(sheet);
  draw();
}

/* ---------- catalogue (dialogue de sélection et page) ---------- */
function catalogueFilters(state) {
  return `<div class="cat-filters">
    <label class="sr" for="cat-q">Rechercher</label>
    <input id="cat-q" type="search" placeholder="Rechercher : va-et-vient, Wago, tube 20…" value="${esc(state.q)}">
    <div class="chips">${['Tout', ...categories()].map(c => `<button type="button" class="chip ${state.cat === c ? 'on' : ''}" data-cat="${c}">${c}</button>`).join('')}</div>
    <div class="chips"><span class="muted">Couleur Niko :</span>${['toutes', 'crème', 'blanc', 'gris clair'].map(c => `<button type="button" class="chip ${state.coul === c ? 'on' : ''}" data-coul="${c}">${c}</button>`).join('')}</div>
  </div>`;
}
function categories() { return [...new Set([...CAT_ORDER, ...CATALOGUE.map(c => c.cat).filter(Boolean)])]; }
function catalogueFiltered(state) {
  const q = state.q.trim().toLowerCase();
  return CATALOGUE.filter(it => (state.tous || it.visible !== false) &&
    (state.cat === 'Tout' || it.cat === state.cat) &&
    (state.coul === 'toutes' || it.marque !== 'Niko' || it.couleur === state.coul) &&
    (!q || (it.des + ' ' + it.ref + ' ' + it.marque).toLowerCase().includes(q)));
}
function openCatalogue(onPick) {
  const dlg = $('#dlg'); const state = { q: '', cat: 'Tout', coul: 'toutes' };
  const draw = () => {
    const list = catalogueFiltered(state);
    dlg.innerHTML = `<div class="dlg-in"><div class="dlg-head"><h2>Catalogue</h2><button type="button" class="ibtn" data-close aria-label="Fermer">✕</button></div>
      ${catalogueFilters(state)}
      <ul class="cat-list">${list.map(it => `<li><div><span class="cat-des">${esc(it.des)}</span><span class="cat-meta mono">${esc(it.ref)}${it.marque ? ' · ' + esc(it.marque) : ''} · ${eur(it.prix)} / ${it.unite}</span></div>
        <button type="button" class="btn small" data-pick="${it.id}">Ajouter</button></li>`).join('') || '<li class="empty">Aucun article ne correspond.</li>'}</ul>
      <p class="muted small" id="cat-msg" role="status"></p></div>`;
    const qi = $('#cat-q', dlg); qi.addEventListener('input', () => { state.q = qi.value; const pos = qi.selectionStart; draw(); const n = $('#cat-q', dlg); n.focus(); n.setSelectionRange(pos, pos); });
    dlg.querySelectorAll('[data-cat]').forEach(b => b.addEventListener('click', () => { state.cat = b.dataset.cat; draw(); }));
    dlg.querySelectorAll('[data-coul]').forEach(b => b.addEventListener('click', () => { state.coul = b.dataset.coul; draw(); }));
    dlg.querySelectorAll('[data-pick]').forEach(b => b.addEventListener('click', () => { onPick(b.dataset.pick); $('#cat-msg', dlg).textContent = 'Ajouté : ' + catItem(b.dataset.pick).des; }));
    dlg.querySelector('[data-close]').addEventListener('click', () => dlg.close());
  };
  draw(); dlg.showModal();
}
function catalogueView(main) {
  if (USER.role === 'prof') return catalogueEditView(main);
  const state = { q: '', cat: 'Tout', coul: 'toutes' };
  const draw = () => {
    const list = catalogueFiltered(state);
    main.innerHTML = `<section class="hello"><h1>Catalogue</h1><p>${list.length} articles. Appareillage Niko Original (100 = crème, 101 = blanc, 102 = gris clair), prix bruts HTVA de la ${NIKO_PRIX_SOURCE}. Les prix marqués <span class="verif">*</span> sont à vérifier.</p></section>
      ${catalogueFilters(state)}
      <div class="table-wrap"><table class="tbl"><thead><tr><th>Catégorie</th><th>Description</th><th>Réf.</th><th>Marque</th><th>Unité</th><th class="num">Prix HTVA</th></tr></thead>
      <tbody>${list.map(it => `<tr><td class="muted">${esc(it.cat)}</td><td>${esc(it.des)}${it.verif ? '<span class="verif">*</span>' : ''}</td><td class="mono">${esc(it.ref)}</td><td>${esc(it.marque)}</td><td>${esc(it.unite)}</td><td class="num mono">${eur(it.prix)}</td></tr>`).join('')}</tbody></table></div>`;
    bindCatFilters(main, state, draw);
  };
  draw();
}
function bindCatFilters(root, state, draw) {
  const qi = $('#cat-q', root); qi.addEventListener('input', () => { state.q = qi.value; const pos = qi.selectionStart; draw(); const n = $('#cat-q', root); n.focus(); n.setSelectionRange(pos, pos); });
  root.querySelectorAll('[data-cat]').forEach(b => b.addEventListener('click', () => { state.cat = b.dataset.cat; draw(); }));
  root.querySelectorAll('[data-coul]').forEach(b => b.addEventListener('click', () => { state.coul = b.dataset.coul; draw(); }));
}
const UNITES = ['pc', 'm', 'boîte', 'lot', 'rouleau'];
function enregistrerArticle(it, saved) {
  if (!ONLINE) { saveCatalogue(); saved('Enregistré : ' + it.des); return; }
  saved('Enregistrement…');
  api('catMaj', { item: it }).then(() => { store.set('tp3pelec:cat-cache', CATALOGUE); saved('Enregistré : ' + it.des); })
    .catch(e => saved('Non enregistré : ' + e.message));
}
function catalogueEditView(main) {
  const state = { q: '', cat: 'Tout', coul: 'toutes', tous: true, reset: false };
  const draw = () => {
    const list = catalogueFiltered(state);
    const nbCaches = CATALOGUE.filter(c => c.visible === false).length;
    main.innerHTML = `<section class="hello"><h1>Catalogue</h1>
      <p>Modifiez un prix, une description ou une référence directement dans le tableau : chaque changement est enregistré tout de suite. Décochez « Visible » pour cacher un article aux élèves sans le supprimer.</p></section>
      <p class="notice prof">${ONLINE ? 'Les modifications sont enregistrées dans l\'onglet Catalogue du Google Sheet et s\'appliquent chez tous les élèves.' : 'Démo : les modifications restent dans ce navigateur. Avec le Google Sheet, elles s\'appliqueront chez tous les élèves.'}</p>
      <div class="row between wrapr">
        <div class="row wrapr"><button type="button" class="btn primary" id="cat-new">Ajouter un article</button>
          <span class="muted small">${CATALOGUE.length} articles${nbCaches ? ` · ${nbCaches} caché(s) aux élèves` : ''}</span></div>
        <div class="row wrapr"><span id="cat-saved" class="muted small" role="status"></span>
          ${ONLINE ? '' : `<button type="button" class="btn ghost small" id="cat-reset">${state.reset ? 'Confirmer : tout rétablir' : 'Rétablir le catalogue d\'origine'}</button>`}</div>
      </div>
      ${catalogueFilters(state)}
      <datalist id="cat-list">${categories().map(c => `<option value="${esc(c)}">`).join('')}</datalist>
      <div class="table-wrap"><table class="tbl cat-edit"><thead><tr>
        <th class="c">Visible</th><th>Catégorie</th><th>Description</th><th>Réf.</th><th>Marque</th><th>Unité</th><th class="num">Prix HTVA (€)</th><th><span class="sr">Actions</span></th></tr></thead>
      <tbody>${list.map(it => `<tr data-id="${esc(it.id)}" class="${it.visible === false ? 'hidden-row' : ''}">
        <td class="c"><input type="checkbox" data-f="visible" ${it.visible === false ? '' : 'checked'} aria-label="Visible pour les élèves"></td>
        <td><input data-f="cat" list="cat-list" value="${esc(it.cat)}" aria-label="Catégorie"></td>
        <td class="w-des"><input data-f="des" value="${esc(it.des)}" aria-label="Description"></td>
        <td><input data-f="ref" class="mono" value="${esc(it.ref)}" aria-label="Référence"></td>
        <td><input data-f="marque" value="${esc(it.marque)}" aria-label="Marque"></td>
        <td><select data-f="unite" aria-label="Unité">${[...new Set([...UNITES, it.unite])].map(u => `<option ${u === it.unite ? 'selected' : ''}>${esc(u)}</option>`).join('')}</select></td>
        <td class="num"><span class="pr"><input data-f="prix" type="text" inputmode="decimal" class="mono num-in" value="${String(it.prix.toFixed(2)).replace('.', ',')}" aria-label="Prix HTVA">${it.verif ? '<span class="verif" title="Prix à vérifier">*</span>' : ''}</span></td>
        <td><button type="button" class="ibtn" data-delart="${esc(it.id)}" aria-label="Supprimer l'article">✕</button></td>
      </tr>`).join('') || '<tr><td colspan="8" class="empty">Aucun article ne correspond.</td></tr>'}</tbody></table></div>`;
    bindCatFilters(main, state, draw);
    const saved = (txt) => { const el = $('#cat-saved'); if (el) el.textContent = txt; };
    main.querySelector('tbody').addEventListener('change', e => {
      const inp = e.target.closest('[data-f]'); if (!inp) return;
      const tr = inp.closest('tr'), it = catItem(tr.dataset.id), f = inp.dataset.f;
      if (f === 'visible') { it.visible = inp.checked; tr.classList.toggle('hidden-row', !inp.checked); }
      else if (f === 'prix') { const v = Math.round((parseFloat(String(inp.value).replace(',', '.')) || 0) * 100) / 100; it.prix = v; it.verif = false; inp.value = v.toFixed(2).replace('.', ','); const m = inp.parentElement.querySelector('.verif'); if (m) m.remove(); }
      else it[f] = inp.value.trim();
      enregistrerArticle(it, saved);
    });
    main.querySelectorAll('[data-delart]').forEach(b => b.addEventListener('click', () => {
      if (b.dataset.confirm) {
        const id = b.dataset.delart, i = CATALOGUE.findIndex(c => c.id === id);
        if (ONLINE) { b.disabled = true; api('catSuppr', { id }).then(() => { if (i >= 0) CATALOGUE.splice(i, 1); draw(); saved('Article supprimé.'); }).catch(e => { b.disabled = false; saved('Erreur : ' + e.message); }); return; }
        if (i >= 0) CATALOGUE.splice(i, 1); saveCatalogue(); draw(); saved('Article supprimé.'); return;
      }
      b.dataset.confirm = '1'; b.textContent = 'Sûr ?'; b.classList.add('confirm'); b.setAttribute('aria-label', 'Confirmer la suppression');
    }));
    $('#cat-new').addEventListener('click', () => openNewArticle(state, draw));
    if ($('#cat-reset')) $('#cat-reset').addEventListener('click', () => {
      if (!state.reset) { state.reset = true; draw(); return; }
      CATALOGUE.splice(0, CATALOGUE.length, ...CATALOGUE_ORIGINE.map(it => ({ ...it }))); store.set('tp3pelec:catalogue', null); state.reset = false; draw(); saved('Catalogue d\'origine rétabli.');
    });
  };
  draw();
}
function openNewArticle(state, redraw) {
  const dlg = $('#dlg');
  dlg.innerHTML = `<div class="dlg-in"><div class="dlg-head"><h2>Nouvel article</h2><button type="button" class="ibtn" data-close aria-label="Fermer">✕</button></div>
    <form id="na" class="form-grid two">
      <label class="span2">Description <input id="na-des" required placeholder="Ex. : Borne à levier 5 conducteurs 0,2–4 mm²"></label>
      <label>Référence <input id="na-ref" required class="mono" placeholder="Ex. : 221-415"></label>
      <label>Marque <input id="na-marque" placeholder="Ex. : Wago"></label>
      <label>Catégorie <input id="na-cat" list="cat-list2" required value="${esc(state.cat !== 'Tout' ? state.cat : '')}" placeholder="Choisir ou écrire"></label>
      <label>Unité <select id="na-unite">${UNITES.map(u => `<option>${u}</option>`).join('')}</select></label>
      <label>Prix HTVA (€) <input id="na-prix" type="text" inputmode="decimal" required class="mono" placeholder="0,00"></label>
      <label>Couleur <span class="muted">(facultatif)</span> <input id="na-coul" placeholder="Ex. : crème"></label>
      <label class="check span2"><input type="checkbox" id="na-vis" checked> Visible pour les élèves</label>
      <p id="na-err" class="err span2" role="alert"></p>
      <div class="span2 row"><button class="btn primary" type="submit">Ajouter au catalogue</button><button type="button" class="btn ghost" data-close>Annuler</button></div>
    </form>
    <datalist id="cat-list2">${categories().map(c => `<option value="${esc(c)}">`).join('')}</datalist></div>`;
  dlg.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', () => dlg.close()));
  $('#na').addEventListener('submit', e => {
    e.preventDefault();
    const ref = $('#na-ref').value.trim();
    let id = ref, k = 2; while (catItem(id)) id = `${ref}~${k++}`;
    const prix = Math.round((parseFloat(String($('#na-prix').value).replace(',', '.')) || 0) * 100) / 100;
    if (!ref || !$('#na-des').value.trim()) { $('#na-err').textContent = 'La description et la référence sont obligatoires.'; return; }
    const it = { id, cat: $('#na-cat').value.trim(), des: $('#na-des').value.trim(), ref, marque: $('#na-marque').value.trim(), unite: $('#na-unite').value, prix, couleur: $('#na-coul').value.trim() || null, verif: false, visible: $('#na-vis').checked };
    CATALOGUE.push(it);
    dlg.close(); state.q = ''; state.cat = 'Tout'; redraw();
    enregistrerArticle(it, txt => { const el = $('#cat-saved'); if (el) el.textContent = txt.replace('Enregistré', 'Article ajouté'); });
  });
  dlg.showModal(); $('#na-des').focus();
}

/* ---------- outillage ---------- */
function outilsSheet(sheet, ex, d) {
  d.outils ||= {};
  const count = () => Object.values(d.outils).filter(Boolean).length;
  sheet.innerHTML = `${sheetHead('Liste d\'outillage', 'Cochez les outils nécessaires pour réaliser ce TP. Le professeur compare votre liste à la sienne.', 'outils-coffre')}
    <p class="progress"><span id="ou-n">${count()}</span> outil(s) sélectionné(s)</p>
    <div class="tool-cols">${OUTILLAGE.map(g => `<fieldset class="tool-col"><legend>${g.groupe}</legend>
      ${g.items.map(([id, nom]) => `<label class="check"><input type="checkbox" data-o="${id}" ${d.outils[id] ? 'checked' : ''}><span>${esc(nom)}</span></label>`).join('')}</fieldset>`).join('')}</div>`;
  sheet.querySelectorAll('[data-o]').forEach(c => c.addEventListener('change', () => { d.outils[c.dataset.o] = c.checked; $('#ou-n').textContent = count(); save(); }));
  bindFiches(sheet);
}

/* ---------- remise ---------- */
function remiseSheet(sheet, ex, d) {
  const prof = USER.role === 'prof' && CTX.eleve;
  const aPhoto = !!(PHOTOS[ex.id] || d.photoId || (prof && PV.photoId));
  const parts = ex.kind === 'planche'
    ? [['Bon de commande', d.bdc.lignes.length > 0 && !!d.bdc.tva], ['Outillage', Object.values(d.outils || {}).some(Boolean)], ['Photo de la planche', aPhoto]]
    : [['Schéma de principe', (d.principe.syms || []).length > 0], ['Schéma unifilaire', (d.unifilaire.points || []).length > 0], ['Schéma de câblage', (d.cablage.wires || []).length > 0], ['Bon de commande', d.bdc.lignes.length > 0 && !!d.bdc.tva], ['Outillage', Object.values(d.outils || {}).some(Boolean)], ['Photo du montage', aPhoto]];
  const remis = prof ? PV.remis : !!d.remis;
  sheet.innerHTML = `${sheetHead('Remise du dossier', prof ? 'État du dossier de l\'élève et photo de son montage.' : 'Vérifiez que chaque partie est complète, ajoutez la photo de votre planche, puis remettez le dossier.')}
    <ul class="parts">${parts.map(([n, ok]) => `<li class="${ok ? 'ok' : ''}"><span class="dot" aria-hidden="true"></span>${n}<span class="state ${ok ? 'ok' : ''}">${ok ? 'Complété' : 'À faire'}</span></li>`).join('')}</ul>
    <div class="photo-box">
      <h3>Photo de la planche</h3>
      ${prof ? '' : `<p class="muted">Sur smartphone, le bouton ouvre l'appareil photo. Cadrez toute la planche, de face, bien éclairée.</p>
      ${remis ? '' : '<label class="btn" for="photo-in">Prendre ou choisir une photo</label><input id="photo-in" type="file" accept="image/*" capture="environment" class="sr">'}`}
      <div id="photo-prev">${PHOTOS[ex.id] ? `<img src="${PHOTOS[ex.id]}" alt="Photo de la planche">` : (d.photoId && !prof ? '<p class="state ok">Photo envoyée avec le dossier</p>' : '')}</div>
      ${!ONLINE ? '<p class="muted small">Dans cette démo, la photo reste sur cet appareil.</p>' : ''}
    </div>
    ${prof
      ? `<div class="row wrapr">${PV.remis ? '<span class="state ok">Dossier remis</span><button type="button" class="btn ghost" id="rendre">Rendre le dossier à l\'élève</button>' : '<span class="state">Pas encore remis</span>'}<span id="rem-msg" class="muted" role="status"></span></div>`
      : `<div class="row wrapr"><button type="button" class="btn primary" id="remettre" ${remis ? 'disabled' : ''}>${remis ? 'Dossier remis' : 'Remettre le dossier'}</button><span id="rem-msg" class="muted" role="status"></span></div>`}`;
  if (prof && PV.photoId) {
    $('#photo-prev').innerHTML = '<p class="muted">Chargement de la photo…</p>';
    api('profPhoto', { id: PV.photoId }).then(url => { $('#photo-prev').innerHTML = `<img src="${url}" alt="Photo du montage de l'élève">`; })
      .catch(e => { $('#photo-prev').innerHTML = `<p class="err">${esc(e.message)}</p>`; });
  }
  const rendre = $('#rendre');
  if (rendre) rendre.addEventListener('click', () => {
    rendre.disabled = true;
    api('profRendre', { email: CTX.eleve, ex: ex.id }).then(() => { PV.remis = false; go(VIEW); }).catch(e => { rendre.disabled = false; $('#rem-msg').textContent = e.message; });
  });
  const pin = $('#photo-in');
  if (pin) pin.addEventListener('change', e => {
    const f = e.target.files[0]; if (!f) return;
    const img = new Image(), url = URL.createObjectURL(f);
    img.onload = () => {
      const max = 1600, k = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas'); c.width = img.width * k; c.height = img.height * k;
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      PHOTOS[ex.id] = c.toDataURL('image/jpeg', 0.8); URL.revokeObjectURL(url); go(VIEW);
    };
    img.src = url;
  });
  const rem = $('#remettre');
  if (rem) rem.addEventListener('click', async () => {
    if (!ONLINE) { d.remis = true; save(); rem.disabled = true; rem.textContent = 'Dossier remis'; $('#rem-msg').textContent = 'Démo : enregistré sur cet appareil.'; return; }
    if (!enLigne()) { $('#rem-msg').textContent = 'Il faut une connexion internet pour remettre le dossier.'; return; }
    rem.disabled = true; $('#rem-msg').textContent = 'Envoi du dossier…';
    try {
      d.maj = Date.now();
      const r = await api('remettre', { ex: ex.id, data: JSON.stringify(d), photo: PHOTOS[ex.id] || '' });
      d.remis = true; if (r.photoId) d.photoId = r.photoId;
      delete (DATA.dirty || {})[ex.id]; delete PHOTOS[ex.id];
      (DATA.resume ||= {})[ex.id] = { maj: Date.now(), remis: true };
      persist(); go(VIEW);
    } catch (e) { rem.disabled = false; $('#rem-msg').textContent = e.message; if (e.auth) deconnecter(e.message); }
  });
}
const PHOTOS = {};

/* ---------- apprendre ---------- */
function ficheIllus(f) {
  if (!f.sym) return '';
  const type = f.sym;
  return `<div class="fiche-illus"><figure><svg viewBox="-36 -40 72 80" class="paper-svg" aria-hidden="true" data-psym="${type}"></svg><figcaption>Symbole (schéma de principe)</figcaption></figure>
    ${type !== 'lampe' ? `<figure><svg viewBox="-42 -42 84 84" class="real-svg" aria-hidden="true" data-meca="${type}"></svg><figcaption>Mécanisme et bornes</figcaption></figure>` : `<figure><svg viewBox="-36 -36 72 72" class="real-svg" aria-hidden="true" data-douille="1"></svg><figcaption>Douille et bornes</figcaption></figure>`}</div>`;
}
function drawIllus(root) {
  root.querySelectorAll('[data-psym]').forEach(s => drawPrincipeSymbol(s, s.dataset.psym, 0, 0, 0, 1));
  root.querySelectorAll('[data-meca]').forEach(s => drawMechanism(s, s.dataset.meca, 0, 0, 'reel'));
  root.querySelectorAll('[data-douille]').forEach(s => drawDouille(s, 0, -6, 'reel'));
}
function openFiche(id) {
  const f = FICHES.find(x => x.id === id); if (!f) return;
  const dlg = $('#dlg');
  dlg.innerHTML = `<div class="dlg-in fiche"><div class="dlg-head"><div><span class="eyebrow">${esc(f.cat)}</span><h2>${esc(f.titre)}</h2></div><button type="button" class="ibtn" data-close aria-label="Fermer">✕</button></div>${ficheIllus(f)}<div class="fiche-body">${f.html}</div></div>`;
  drawIllus(dlg);
  dlg.querySelector('[data-close]').addEventListener('click', () => dlg.close());
  dlg.showModal();
}
function apprendreView(main) {
  const cats = [...new Set(FICHES.map(f => f.cat))];
  main.innerHTML = `<section class="hello"><h1>Apprendre</h1><p>Les fiches de base : appareils, outils, fils et tubes, schémas et règles. Chaque étape du mode opératoire renvoie vers la bonne fiche.</p></section>
    ${cats.map(c => `<section class="fiche-cat"><h2>${esc(c)}</h2><div class="fiche-grid">${FICHES.filter(f => f.cat === c).map(f => `
      <button type="button" class="fiche-card" data-fiche="${f.id}">${f.sym ? `<svg viewBox="-36 -40 72 80" class="paper-svg mini" aria-hidden="true" data-psym="${f.sym}"></svg>` : ''}<span>${esc(f.titre)}</span></button>`).join('')}</div></section>`).join('')}`;
  drawIllus(main); bindFiches(main);
}

/* ---------- accueil professeur ---------- */
let ELEVES = null, FILTRE_ELEVES = '';
function profHome(main) {
  main.innerHTML = `
    ${ONLINE ? `<section class="hello"><h1>Mes élèves</h1><p>Cliquez sur une case pour ouvrir le dossier d'un élève : schémas, bon de commande, photo. Sur le bon de commande du TP 0, vous validez le matériel de la planche.</p></section>
    <div class="row between wrapr"><label class="inline">Rechercher <input id="el-q" type="search" value="${esc(FILTRE_ELEVES)}" placeholder="Nom, classe…"></label>
      <button type="button" class="btn ghost small" id="el-maj">Actualiser</button></div>
    <div id="eleves" class="table-wrap"><p class="empty">Chargement de la liste…</p></div>` : ''}
    <section class="hello"><h2>Exercices</h2>
      <p>Ouvrez un exercice pour voir ce que voit un élève. Chaque élève reçoit sa propre variante (emplacements, couleur des finitions, type de chantier pour la TVA), calculée à partir de son adresse.</p></section>
    <ol class="ex-list">${EXERCICES.map(ex => `<li><button type="button" class="ex-card" data-ex="${ex.id}">
      <span class="ex-num">TP ${ex.num}</span><span class="ex-main"><span class="ex-title">${esc(ex.titre)}</span><span class="ex-sub">${esc(ex.court)}</span></span><span class="state">Aperçu</span></button></li>`).join('')}</ol>
    <section class="card next">
      <h2>Prochaines étapes</h2>
      <ul>
        <li><b>V2</b> : création d'exercices par glisser-déposer, correction automatique détaillée (avec codes Vinçotte), retour à l'élève.</li>
        <li><b>V3</b> : photo annotée par le prof, validation pratique par essai et grille de dépannage, évaluation /215.</li>
      </ul>
    </section>`;
  main.querySelectorAll('[data-ex]').forEach(b => b.addEventListener('click', () => go({ page: 'ex', id: b.dataset.ex, tab: 'enonce' })));
  if (!ONLINE) return;
  const draw = () => {
    const box = $('#eleves'); if (!box) return;
    const q = FILTRE_ELEVES.trim().toLowerCase();
    const list = (ELEVES || []).filter(e => !q || `${e.nom} ${e.prenom} ${e.classe} ${e.email}`.toLowerCase().includes(q));
    if (!ELEVES) return;
    if (!list.length) { box.innerHTML = `<p class="empty">${ELEVES.length ? 'Aucun élève ne correspond.' : 'Aucun élève ne s\'est encore connecté.'}</p>`; return; }
    box.innerHTML = `<table class="tbl eleves"><thead><tr><th>Élève</th><th>Classe</th><th class="c">Planche</th>${EXERCICES.map(x => `<th class="c">TP ${x.num}</th>`).join('')}</tr></thead>
      <tbody>${list.map(e => `<tr><td><b>${esc(e.nom)}</b> ${esc(e.prenom)}<span class="muted small mail">${esc(e.email)}</span></td><td>${esc(e.classe)}</td>
        <td class="c">${e.planche ? '<span class="state ok">validée</span>' : '<span class="muted">—</span>'}</td>
        ${EXERCICES.map(x => { const st = e.ex[x.id]; const lbl = st ? (st.remis ? 'remis' : 'en cours') : '—'; const cls = st ? (st.remis ? 'ok' : 'cur') : '';
          return `<td class="c"><button type="button" class="cell-btn state ${cls}" data-el="${esc(e.email)}" data-x="${x.id}" data-remis="${st && st.remis ? 1 : 0}" title="TP ${x.num} – ${esc(e.prenom)} ${esc(e.nom)}">${lbl}</button></td>`; }).join('')}</tr>`).join('')}</tbody></table>`;
    box.querySelectorAll('[data-el]').forEach(b => b.addEventListener('click', () => { PV = null; go({ page: 'ex', id: b.dataset.x, tab: b.dataset.remis === '1' ? 'remise' : 'enonce', eleve: b.dataset.el }); }));
  };
  const charger = () => api('profEleves').then(r => { ELEVES = r; draw(); }).catch(e => { const box = $('#eleves'); if (box) box.innerHTML = `<p class="err">${esc(e.message)}</p>`; if (e.auth) deconnecter(e.message); });
  $('#el-q').addEventListener('input', e => { FILTRE_ELEVES = e.target.value; draw(); });
  $('#el-maj').addEventListener('click', () => { ELEVES = null; $('#eleves').innerHTML = '<p class="empty">Chargement de la liste…</p>'; charger(); });
  if (ELEVES) draw(); else charger();
}

/* ---------- démarrage ---------- */
async function flushProfil() {
  if (!ONLINE || !DATA || !DATA.profilDirty || !enLigne()) return;
  try { await api('profil', { profil: DATA.profil }); DATA.profilDirty = false; persist(); } catch (e) { /* réessai plus tard */ }
}
async function rafraichir() {
  if (!USER || !enLigne()) { if (USER) setSync('hors'); return; }
  try {
    const r = await api('moi');
    USER.role = r.role;
    if (r.role === 'eleve') {
      const garde = DATA.profilDirty ? DATA.profil : null;
      DATA.profil = garde || r.profil;
      DATA.planche = r.planche || DATA.planche;
      DATA.resume = r.resume || {};
    }
    if (Array.isArray(r.catalogue) && r.catalogue.length) { CATALOGUE.splice(0, CATALOGUE.length, ...r.catalogue); store.set('tp3pelec:cat-cache', r.catalogue); }
    persist(); setSync('ok');
    await flushProfil(); await flushDirty();
    if (VIEW.page !== 'ex' && !document.querySelector('dialog[open]') && !(document.activeElement && /input|textarea|select/i.test(document.activeElement.tagName))) render();
  } catch (e) {
    if (e.auth) deconnecter(e.message); else if (e.reseau) setSync('hors'); else setSync('err', e.message);
  }
}
function demarrerEnLigne() {
  CLE = store.get('tp3pelec:cle', null);
  const p = CLE && lireCle(CLE);
  if (!p || !p.e || Date.now() > p.x) { if (CLE) LOGIN_MSG = 'Votre connexion a expiré : reconnectez-vous.'; CLE = null; USER = null; render(); return; }
  const n = nameFromEmail(p.e);
  USER = { email: p.e, role: p.r, prenom: n.prenom, nom: n.nom };
  DATA = store.get('tp3pelec:' + p.e, null) || { profil: { prenom: n.prenom, nom: n.nom, classe: '3Pélec', confirme: p.r !== 'eleve' }, ex: {}, planche: { validee: false, lignes: [] }, resume: {}, dirty: {} };
  const cat = store.get('tp3pelec:cat-cache', null);
  if (Array.isArray(cat) && cat.length) CATALOGUE.splice(0, CATALOGUE.length, ...cat);
  VIEW = { page: 'home' }; render();
  rafraichir();
}
(function start() {
  if (!ONLINE) {
    loadCatalogue();
    const last = store.get('tp3pelec:session', null);
    if (last) { const u = parseEmail(last); if (!u.error) { loadUser(u); VIEW = { page: 'home' }; } }
    render();
    return;
  }
  const m = location.hash.match(/cle=([\w.\-]+)/);
  if (m) { store.set('tp3pelec:cle', m[1]); history.replaceState(null, '', location.pathname + location.search); }
  window.addEventListener('storage', e => { if (e.key === 'tp3pelec:cle' && e.newValue && !USER) demarrerEnLigne(); });
  window.addEventListener('online', () => rafraichir());
  window.addEventListener('offline', () => setSync('hors'));
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flushDirty(); });
  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
  demarrerEnLigne();
})();
