/* =========================================================
   Dossier TP — application
   Mode « en ligne » si config.js donne les adresses du script (GitHub Pages),
   sinon mode démonstration (données dans le navigateur).
   ========================================================= */
const CFG = window.TP_CONFIG || {};
const ONLINE = !!(CFG.apiUrl && CFG.loginUrl);
const DOMAINE = 'elmarche.be';
const PROFS_DEMO = ['olivier.lesenfants@elmarche.be'];
const LISTES_DEMO = {
  classes: [['3P Élec', 'olivier.lesenfants@elmarche.be'], ['3QEM groupe 1', 'olivier.lesenfants@elmarche.be'], ['3QEM groupe 2', 'olivier.lesenfants@elmarche.be'], ['3QEM groupe 3', 'gregory.baudson@elmarche.be'], ['3P Poly', 'logan.degossly@elmarche.be']].map(([classe, prof]) => ({ classe, prof, prof2: '' })),
  profs: [['olivier.lesenfants@elmarche.be', 'Lesenfants Olivier'], ['philippe.dachelet@elmarche.be', 'Dachelet Philippe'], ['gregory.baudson@elmarche.be', 'Baudson Grégory'], ['logan.degossly@elmarche.be', 'Degossly Logan']].map(([email, nom]) => ({ email, nom })),
};
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

/* ---------- classes et professeurs (onglets Classes et Profs du Google Sheet) ---------- */
let LISTES = ONLINE ? store.get('tp3pelec:listes', { classes: [], profs: [] }) : LISTES_DEMO;
const nomProf = em => { const p = LISTES.profs.find(x => x.email === em); return p ? p.nom : (em ? nameFromEmail(em).nom + ' ' + nameFromEmail(em).prenom : ''); };
const profDeClasse = c => (LISTES.classes.find(x => x.classe === c) || {}).prof || '';
const profsDeClasse = c => { const x = LISTES.classes.find(k => k.classe === c); return x ? [x.prof, x.prof2].filter(Boolean) : []; };
const classeDuProf = (c, em) => c.prof === em || c.prof2 === em;
function profilIncomplet() {
  if (!DATA.profil.confirme) return true;
  if (!LISTES.classes.length) return false;
  return !LISTES.classes.some(c => c.classe === DATA.profil.classe) || (LISTES.profs.length > 0 && !DATA.profil.prof);
}

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
    r = await fetch(CFG.apiUrl, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(Object.assign({ a, cle: CLE, an: (DATA && DATA.annee) || undefined }, params)) });
  } catch (e) { const err = new Error('Pas de connexion internet.'); err.reseau = true; throw err; }
  let j; try { j = await r.json(); } catch (e) { throw new Error('Réponse illisible du serveur.'); }
  if (!j.ok) { const err = new Error(j.erreur || 'Erreur du serveur.'); err.auth = !!j.auth; err.annee = j.annee || ''; throw err; }
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
  DATA = store.get('tp3pelec:' + u.email, null) || { profil: { prenom: u.prenom, nom: u.nom, classe: '', prof: '', confirme: false }, ex: {}, planche: { validee: false, lignes: [] } };
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
    if (e.reseau) setSync('hors'); else if (e.auth) deconnecter(e.message); else if (e.annee) setTimeout(rafraichir, 0); else setSync('err', e.message);
  } finally { flushing = false; }
  if (Object.keys(DATA.dirty || {}).length && enLigne() && SYNC.etat === 'ok') setTimeout(flushDirty, 500);
}
function normEx(d) {
  d = d || {};
  d.principe ||= {}; migrerPrincipe(d.principe); d.unifilaire ||= {}; d.cablage ||= {}; d.bdc ||= { lignes: [], tva: '', justif: '' };
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
  // appareils dans les boîtiers, puis modulaires sur un rail DIN (gauche ou droit, en partant de la boîte)
  const boite = ex.devices.map((t, i) => i).filter(i => !estRail(ex.devices[i]));
  const rail = ex.devices.map((t, i) => i).filter(i => estRail(ex.devices[i]));
  const positions = Array(ex.devices.length);
  for (let k = 0; k < 400; k++) {
    const pick = shuffle(PLANCHE.positions.map(p => p.id), r).slice(0, boite.length);
    boite.forEach((i, j) => { positions[i] = pick[j]; });
    if (dispositionOk(ex, positions)) break;
  }
  if (rail.length) {
    const cote = r() < 0.5 ? 'RG' : 'RD', ordre = cote === 'RG' ? [6, 5, 4, 3, 2, 1] : [1, 2, 3, 4, 5, 6];
    rail.forEach((i, j) => { positions[i] = cote + '-' + ordre[j]; });
  }
  const nbP = ex.devices.filter(t => t === 'prise').length;
  const PREF = { tl: 'TL', min4: 'MI', min3: 'MI', crep: 'CR', horl: 'HO' }, cpt = {};
  let nS = 0, nP = 0;
  const reps = ex.devices.map(t => t === 'prise' ? (nbP > 1 ? 'PC' + (++nP) : 'PC') : PREF[t] ? PREF[t] + (cpt[PREF[t]] = (cpt[PREF[t]] || 0) + 1) : 'S' + (++nS));
  const nomCharge = c => {
    if (typeof c === 'string' && c[0] === 'p') return 'la prise ' + reps[+c.slice(1)];
    if (typeof c === 'string' && c[0] === 'i') { const k = +c.slice(1); return (ex.devices[k] === 'tl' ? 'le télérupteur ' : 'la minuterie ') + reps[k]; }
    return lampes[c] && lampes[c].nom;
  };
  const devices = ex.devices.map((type, i) => {
    const pos = PLANCHE.slots.find(p => p.id === positions[i]);
    const touches = touchesDe(ex, i).map(l => l.map(nomCharge).filter(Boolean));
    const cmd = [...new Set(touches.flat())];
    const par = type === 'prise' ? commandePar(ex, 'p' + i).map(([j]) => reps[j]) : IMPULSION.includes(type) ? commandePar(ex, 'i' + i).map(([j]) => reps[j]) : [];
    // crépusculaire et horloge en série sur la même charge
    const serie = AUTO_TYPES.includes(type) ? [...new Set(chargesDe(ex, i).flatMap(ch => commandePar(ex, ch).map(([j]) => j)))].filter(j => j !== i && AUTO_TYPES.includes(ex.devices[j])).map(j => reps[j]) : [];
    return { type, pos: pos.id, rep: reps[i], nom: reps[i], empl: pos.nom, cmd, touches, par: [...new Set(par)], serie };
  });
  return { couleur, chantier, alim, lampes, devices };
}
// texte « Commande » d'un appareil dans l'énoncé
function texteCommande(dv) {
  if (dv.type === 'prise') return dv.par.length ? 'commandée par ' + dv.par.join(' et ') : 'toujours sous tension';
  if (IMPULSION.includes(dv.type)) return `${maj1(dv.cmd.join(' et ') || '—')}, à l'appui sur ${dv.par.length ? dv.par.join(' ou ') : '—'}${dv.type === 'min4' || dv.type === 'min3' ? ' (temporisé)' : ''}`;
  if (dv.type === 'crep') return `${maj1(dv.cmd.join(' et ') || '—')}, à la tombée de la nuit${dv.serie.length ? ' (en série avec ' + dv.serie.join(', ') + ')' : ''}`;
  if (dv.type === 'horl') return `${maj1(dv.cmd.join(' et ') || '—')}, aux heures programmées${dv.serie.length ? ' (en série avec ' + dv.serie.join(', ') + ')' : ''}`;
  if (DEUX_TOUCHES.includes(dv.type)) return dv.touches.map((l, k) => `touche ${k + 1} : ${l.length ? l.join(' et ') : '—'}`).join(' · ');
  return dv.cmd.length ? maj1(dv.cmd.join(' et ')) : '—';
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
  if (USER.role === 'eleve' && (profilIncomplet() || VIEW.page === 'profil')) return profilView(main);
  if (VIEW.page === 'ex') return exView(main);
  if (VIEW.page === 'apprendre') return apprendreView(main);
  if (VIEW.page === 'catalogue') return catalogueView(main);
  if (VIEW.page === 'creer') return creerView(main);
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
    loadUser(u); chargerExercicesLocaux(); go({ page: 'home' });
  };
  $('#login-form').addEventListener('submit', e => { e.preventDefault(); tryLogin($('#login-email').value); });
  document.querySelectorAll('[data-demo]').forEach(b => b.addEventListener('click', () => tryLogin(b.dataset.demo)));
}
function profilView(main) {
  const p = DATA.profil, deja = p.confirme, listes = LISTES.classes.length > 0;
  const profSel = p.prof || profDeClasse(p.classe);
  const classes = LISTES.classes.map(c => c.classe);
  main.innerHTML = `<section class="card narrow">
    <h1>${deja ? 'Ma classe' : 'Bienvenue'}</h1>
    <p>${deja ? 'Choisissez votre classe et votre professeur dans les listes, puis confirmez.' : "Votre nom a été lu dans votre adresse e-mail. Une adresse n'a pas d'accents : corrigez si besoin. Choisissez ensuite votre classe et votre professeur, puis confirmez. Votre nom apparaîtra sur toutes vos feuilles."}</p>
    <form id="pf" class="form-grid">
      <label>Prénom <input id="pf-prenom" required value="${esc(p.prenom)}"></label>
      <label>Nom <input id="pf-nom" required value="${esc(p.nom)}"></label>
      ${listes ? `<label>Classe <select id="pf-classe" required><option value="">Choisir ma classe…</option>${classes.map(c => `<option ${c === p.classe ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select></label>
      <label>Professeur <select id="pf-prof" ${LISTES.profs.length ? 'required' : ''}><option value="">Choisir mon professeur…</option>${LISTES.profs.map(x => `<option value="${esc(x.email)}" ${x.email === profSel ? 'selected' : ''}>${esc(x.nom)}</option>`).join('')}</select></label>`
        : `<label>Classe <input id="pf-classe" value="${esc(p.classe)}"></label>`}
      <div class="row wrapr"><button class="btn primary" type="submit">Confirmer</button>${deja && !profilIncomplet() ? '<button type="button" class="btn ghost" id="pf-annul">Annuler</button>' : ''}</div>
    </form></section>`;
  const sc = $('#pf-classe'), sp = $('#pf-prof');
  if (sp) sc.addEventListener('change', () => { const d = profDeClasse(sc.value); if (d && LISTES.profs.some(x => x.email === d)) sp.value = d; });
  const an = $('#pf-annul'); if (an) an.addEventListener('click', () => go({ page: 'home' }));
  $('#pf').addEventListener('submit', e => {
    e.preventDefault();
    Object.assign(DATA.profil, { prenom: $('#pf-prenom').value.trim(), nom: $('#pf-nom').value.trim(), classe: sc.value.trim(), prof: sp ? sp.value : (p.prof || ''), confirme: true });
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
  if ((d && d.correction) || (r && r.corrige && (!d || d.remis !== false))) return { lbl: 'Corrigé', cls: 'ok' };
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
    <p class="ma-classe muted">Classe : <b>${esc(DATA.profil.classe || '—')}</b>${DATA.profil.prof ? ` · Professeur : <b>${esc(nomProf(DATA.profil.prof))}</b>` : ''} · <button type="button" class="as-link" id="chg-classe">Modifier</button></p>
    ${DATA.msgAnnee ? `<p class="notice">Nouvelle année scolaire ${esc(DATA.annee || '')} : vos dossiers de l'an dernier ont été archivés par le professeur. Vous repartez d'une page blanche.</p>` : ''}
    ${planche ? '' : `<p class="notice">Commencez par le <b>TP 0</b> : la liste du matériel de la planche, une fois validée par le professeur, sera reprise d'office dans les bons de commande suivants.</p>`}
    <ol class="ex-list">${EXERCICES.map(ex => {
      const e = etatEx(ex);
      return `<li><button type="button" class="ex-card" data-ex="${ex.id}">
        <span class="ex-num">TP ${ex.num}</span>
        <span class="ex-main"><span class="ex-title">${esc(ex.titre)}</span><span class="ex-sub">${esc(ex.court)}</span></span>
        <span class="state ${e.cls}">${e.lbl}</span></button></li>`;
    }).join('')}</ol>`;
  main.querySelectorAll('[data-ex]').forEach(b => b.addEventListener('click', () => go({ page: 'ex', id: b.dataset.ex, tab: 'enonce' })));
  $('#chg-classe').addEventListener('click', () => go({ page: 'profil' }));
  if (DATA.msgAnnee) { DATA.msgAnnee = false; persist(); }
}

/* ---------- exercice ---------- */
const TABS_CABLAGE = [['enonce', 'Énoncé'], ['mode', 'Mode opératoire'], ['principe', 'Principe'], ['unifilaire', 'Unifilaire'], ['cablage', 'Câblage'], ['bdc', 'Bon de commande'], ['outils', 'Outillage'], ['essais', 'Essais'], ['remise', 'Remise'], ['correction', 'Correction']];
const TABS_PLANCHE = [['enonce', 'Énoncé'], ['mode', 'Mode opératoire'], ['position', 'Schéma de position'], ['bdc', 'Bon de commande'], ['outils', 'Outillage'], ['remise', 'Remise'], ['correction', 'Correction']];
let PV = null; const SCRATCH = {}, FETCHED = {};
let CTX = { planche: { validee: false, lignes: [] }, eleve: null, lecture: false };
function exView(main) {
  const ex = EXERCICES.find(e => e.id === VIEW.id);
  if (!ex) { VIEW = { page: 'home' }; return render(); }
  const tabsTous = ex.kind === 'planche' ? TABS_PLANCHE : TABS_CABLAGE;
  let tabs = tabsTous;
  const tab0 = VIEW.tab || 'enonce';
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
  if (USER.role === 'eleve' && !(d.correction || (!ONLINE && d.remis))) tabs = tabsTous.filter(t => t[0] !== 'correction');
  const tab = tabs.some(t => t[0] === tab0) ? tab0 : 'enonce';
  const tabLbl = tabs.find(t => t[0] === tab)[1];
  main.innerHTML = `
    <div class="crumbs"><button type="button" class="as-link" data-nav2="home">← ${USER.role === 'prof' ? (CTX.eleve ? 'Mes élèves' : 'Exercices') : 'Mes TP'}</button>
      ${canPrint ? '<span class="row wrapr"><button type="button" class="btn ghost small" id="print">Imprimer cette feuille</button><button type="button" class="btn small" id="print-all">Imprimer tout le dossier</button></span>' : ''}</div>
    ${cartouche(p, ex, tabLbl)}
    ${USER.role === 'prof' && CTX.eleve ? `<p class="notice prof">Dossier de <b>${esc(p.prenom)} ${esc(p.nom)}</b> (${esc(email)}) · ${PV.remis ? 'remis' : PV.data && PV.data.maj ? 'en cours' : 'pas encore commencé'}. Consultation : vos modifications ne sont pas enregistrées.</p>` : ''}
    ${USER.role === 'prof' && !CTX.eleve && ex.perso ? `<p class="notice prof">Exercice créé${ex.auteur ? ' par ' + esc(nomProf(ex.auteur)) : ''}${ex.visible === false ? ' · masqué aux élèves' : ''}. <button type="button" class="btn small" id="ex-modif">Modifier cet exercice</button></p>` : ''}
    ${USER.role === 'prof' && !CTX.eleve ? `<p class="notice prof">Aperçu professeur : version de l'exercice pour <b>${esc(email)}</b>.${ONLINE ? ' Rien n\'est enregistré.' : ` <label class="inline">Autre élève <input id="pv-email" type="email" value="${esc(email)}"></label>`}</p>` : ''}
    ${USER.role === 'eleve' && d.remis ? (d.correction && (d.remises || 1) < 2 ? '<p class="notice">Ce dossier est corrigé. Lisez la correction : vous pouvez ensuite le corriger et le remettre une seconde fois.</p>' : d.correction ? '<p class="notice">Ce dossier est corrigé.</p>' : '<p class="notice">Ce dossier est remis : il ne peut plus être modifié en attendant la correction du professeur.</p>') : ''}
    <nav class="tabs" aria-label="Feuilles du dossier">${tabs.map(([k, l]) => `<button type="button" data-tab="${k}" class="${k === tab ? 'on' : ''}" aria-current="${k === tab ? 'page' : 'false'}">${l}</button>`).join('')}</nav>
    <section id="sheet" class="sheet"></section>`;
  main.querySelector('[data-nav2]').addEventListener('click', () => go({ page: 'home' }));
  main.querySelectorAll('[data-tab]').forEach(b => b.addEventListener('click', () => go(Object.assign({}, VIEW, { tab: b.dataset.tab }))));
  const pr = $('#print'); if (pr) pr.addEventListener('click', () => window.print());
  const em = $('#ex-modif'); if (em) em.addEventListener('click', () => { CREA = null; go({ page: 'creer', id: ex.id }); });
  const pa = $('#print-all'); if (pa) pa.addEventListener('click', () => imprimerTout(pa, { ex, v, d, p, tabs }));
  const pv = $('#pv-email'); if (pv) pv.addEventListener('change', () => { if (!parseEmail(pv.value).error) go(Object.assign({}, VIEW, { eleve: pv.value.trim().toLowerCase() })); });
  main.querySelector('[data-nav2]').addEventListener('click', () => { if (CTX.eleve) PV = null; });
  EDITOR = renderTab(tab, $('#sheet'), ex, v, d);
}
function cartouche(p, ex, tabLbl) {
  return `<section class="cartouche" aria-label="En-tête de la feuille">
      <div class="c-school"><b>Institut Saint-Roch</b><span>Marche-en-Famenne</span><span>Travaux pratiques · électricité</span></div>
      <div class="c-cell"><span class="k">Nom</span><span class="v">${esc(p.nom)}</span></div>
      <div class="c-cell"><span class="k">Prénom</span><span class="v">${esc(p.prenom)}</span></div>
      <div class="c-cell"><span class="k">Classe</span><span class="v">${esc(p.classe || '—')}</span></div>
      <div class="c-cell"><span class="k">Date</span><span class="v mono">${today()}</span></div>
      <div class="c-tp"><span class="k">TP ${esc(ex.num)}</span><span class="v">${esc(ex.titre)}</span></div>
      <div class="c-sheet"><span class="k">Feuille</span><span class="v">${esc(tabLbl)}</span></div>
    </section>`;
}
function renderTab(tab, sheet, ex, v, d) {
  const onChange = () => save();
  let ed = null;
  ({
    enonce: () => enonceSheet(sheet, ex, v),
    mode: () => modeSheet(sheet, ex, d),
    principe: () => { sheet.innerHTML = sheetHead('Schéma de principe', 'Dessinez le circuit entre L1 et N. Le disjoncteur bipolaire et la terre sont déjà imprimés.', 'sch-principe') + '<div id="ed"></div>'; ed = new PrincipeEditor($('#ed'), d.principe, { onChange }); bindFiches(sheet); mainBox(sheet, ex, d, 'principe'); },
    unifilaire: () => { sheet.innerHTML = sheetHead('Schéma unifilaire', 'Complétez la protection, la canalisation et les points raccordés. Le schéma se dessine à droite, comme dans Trikker.', 'sch-unifilaire') + '<div id="ed"></div>'; ed = new UnifilaireEditor($('#ed'), d.unifilaire, { onChange }); bindFiches(sheet); mainBox(sheet, ex, d, 'unifilaire'); },
    cablage: () => { sheet.innerHTML = sheetHead('Schéma de câblage', 'Placez les appareils aux emplacements de l\'énoncé, posez les douilles, puis tirez chaque fil. Dans la boîte, chaque point noir correspond à une borne Wago.', 'sch-cablage') + '<div id="ed"></div>'; ed = new CablageEditor($('#ed'), d.cablage, { onChange, rails: ex.devices.some(estRail) }); bindFiches(sheet); mainBox(sheet, ex, d, 'cablage'); },
    position: () => { sheet.innerHTML = sheetHead('Schéma de position', 'Planche vue de face, cotes en mm. Reportez ces cotes au crayon sur la planche avant de fixer quoi que ce soit.', 'sch-position') + '<div class="svg-wrap paper-wrap" id="pos"></div>'; renderPosition($('#pos')); bindFiches(sheet); mainBox(sheet, ex, d, 'position'); },
    bdc: () => bdcSheet(sheet, ex, v, d),
    outils: () => outilsSheet(sheet, ex, d),
    essais: () => essaisSheet(sheet, ex, v, d),
    remise: () => remiseSheet(sheet, ex, d),
    correction: () => correctionSheet(sheet, ex, v, d),
  })[tab]();
  return ed;
}

/* ---------- impression du dossier complet (toutes les feuilles + photos) ---------- */
let IMPRESSION = false;
const PDFJS_URL = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/';
let PDFJS = null;
function chargerPdfJs() {
  if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
  return PDFJS ||= new Promise((res, rej) => {
    const sc = document.createElement('script'); sc.src = PDFJS_URL + 'pdf.min.js';
    sc.onload = () => { window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_URL + 'pdf.worker.min.js'; res(window.pdfjsLib); };
    sc.onerror = () => { PDFJS = null; rej(new Error('pdf.js indisponible')); };
    document.head.appendChild(sc);
  });
}
async function pdfEnImages(dataUrl) {
  const lib = await chargerPdfJs();
  const bin = atob(dataUrl.split(',')[1]), u8 = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  const doc = await lib.getDocument({ data: u8 }).promise, out = [];
  for (let i = 1; i <= Math.min(doc.numPages, 6); i++) {
    const pg = await doc.getPage(i), vp = pg.getViewport({ scale: 2 });
    const c = document.createElement('canvas'); c.width = vp.width; c.height = vp.height;
    await pg.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise;
    out.push(c.toDataURL('image/jpeg', 0.85));
  }
  return out;
}
// renvoie la photo du montage et les schémas à la main, sous forme de data URL
async function fichiersDossier(ex, d) {
  const prof = USER.role === 'prof';
  if (prof && !CTX.eleve) return { photo: null, mains: {} };
  const photoId = prof ? PV.photoId : d.photoId;
  const mains = (prof ? PV.mains : d.mains) || {};
  const lire = id => urlPhoto(id);
  const res = { photo: null, mains: {} };
  const t = [];
  if (!prof && PHOTOS[ex.id]) res.photo = PHOTOS[ex.id];
  else if (photoId && ONLINE) t.push(lire(photoId).then(u => { res.photo = u; }).catch(() => { res.photo = 'erreur'; }));
  for (const [k, m] of Object.entries(mains)) {
    if (!PARTIES_MAIN[k] || !m) continue;
    const local = m.data || (!prof && MAIN_PREV[ex.id + '|' + k]);
    const p = local ? Promise.resolve(local) : (ONLINE && m.id ? lire(m.id) : Promise.reject(new Error('absent')));
    t.push(p.then(async u => {
      res.mains[k] = { m, imgs: /^data:application\/pdf/.test(u) ? await pdfEnImages(u).catch(() => null) : [u] };
    }).catch(() => { res.mains[k] = { m, imgs: null }; }));
  }
  await Promise.all(t);
  return res;
}
async function imprimerTout(btn, c) {
  const { ex, v, d, p, tabs } = c;
  const lbl = btn.textContent; btn.disabled = true; btn.textContent = 'Préparation…';
  let f;
  try { f = await fichiersDossier(ex, d); } catch (e) { f = { photo: null, mains: {} }; }
  btn.disabled = false; btn.textContent = lbl;
  const main = $('#main'); if (!main) return;
  if (EDITOR && EDITOR.destroy) EDITOR.destroy(); EDITOR = null;
  const eds = [];
  IMPRESSION = true;
  main.innerHTML = `<div class="crumbs no-print-all"><button type="button" class="btn small" id="pa-retour">← Revenir au dossier</button><span class="muted small">Si la fenêtre d'impression ne s'ouvre pas, utilisez Ctrl+P.</span></div><div class="print-all"></div>`;
  const root = main.querySelector('.print-all');
  const page = (titre, html) => { const sec = document.createElement('section'); sec.className = 'print-page'; sec.innerHTML = cartouche(p, ex, titre) + (html || ''); root.appendChild(sec); return sec; };
  const renommer = (sec, i) => sec.querySelectorAll('[id]').forEach(el => { if (!(el instanceof SVGElement)) el.id = el.id + '--p' + i; });
  try {
    tabs.forEach(([k, l], i) => {
      const sec = page(l, '<div class="sheet"></div>');
      const sheet = sec.querySelector('.sheet');
      try { const ed = renderTab(k, sheet, ex, v, d); if (ed) eds.push(ed); } catch (e) { sheet.innerHTML = `<p class="err">${esc(l)} : impossible d'imprimer cette feuille.</p>`; }
      sheet.querySelectorAll('.main-box').forEach(b => b.remove());
      if (k === 'remise') {
        const pb = sheet.querySelector('.photo-box');
        if (pb) pb.innerHTML = `<h3>Photo ${ex.kind === 'planche' ? 'de la planche' : 'du montage'}</h3>${f.photo && f.photo !== 'erreur' ? `<img class="print-img" src="${f.photo}" alt="Photo du montage">` : `<p class="muted">${f.photo === 'erreur' ? 'Photo indisponible (pas de connexion ?).' : 'Pas de photo jointe.'}</p>`}`;
      }
      renommer(sec, i);
      const mk = { principe: 'principe', unifilaire: 'unifilaire', cablage: 'cablage', position: 'position' }[k];
      const fm = mk && f.mains[mk];
      if (fm) {
        const s2 = page(PARTIES_MAIN[mk] + ' (à la main)', `<div class="sheet"><div class="sheet-head"><div><h2>${PARTIES_MAIN[mk]} fait à la main</h2><p>${esc(fm.m.nom || '')}</p></div></div>
          ${fm.imgs ? fm.imgs.map(u => `<img class="print-img" src="${u}" alt="${PARTIES_MAIN[mk]} fait à la main">`).join('') : '<p class="muted">Fichier joint en PDF : il n\'a pas pu être inséré ici (pas de connexion ?). Imprimez-le séparément.</p>'}</div>`);
        renommer(s2, i + 'm');
      }
    });
  } finally { IMPRESSION = false; }
  const fin = () => { eds.forEach(e => e.destroy && e.destroy()); window.removeEventListener('afterprint', fin); if (VIEW.page === 'ex') go(VIEW); };
  $('#pa-retour').addEventListener('click', fin);
  await Promise.all([...root.querySelectorAll('img')].map(im => im.decode ? im.decode().catch(() => {}) : null));
  window.addEventListener('afterprint', fin);
  setTimeout(() => window.print(), 50);
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
          ${v.devices.map(dv => `<tr><td class="mono">${dv.rep}</td><td>${esc(APPAREILS[dv.type].nom)} (${APPAREILS[dv.type].rail ? 'Hager ' + APPAREILS[dv.type].ref : APPAREILS[dv.type].court})</td><td>${esc(dv.empl)}</td><td>${esc(texteCommande(dv))}</td></tr>`).join('')}
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
    : [['Schéma de principe', (d.principe.syms || []).length > 0], ['Schéma unifilaire', (d.unifilaire.points || []).length > 0], ['Schéma de câblage', (d.cablage.wires || []).length > 0], ['Bon de commande', d.bdc.lignes.length > 0 && !!d.bdc.tva], ['Outillage', Object.values(d.outils || {}).some(Boolean)], ['Mesures hors tension (Essais)', essaisComplets(ex, variante(ex, prof ? CTX.eleve : USER.email), d)], ['Photo du montage', aPhoto]];
  const remis = prof ? PV.remis : !!d.remis;
  // l'élève peut changer sa photo avant la remise, et après tant que la correction n'est pas publiée
  const aPhotoEleve = !prof && !!(PHOTOS[ex.id] || d.photoId);
  const photoModifiable = !prof && !IMPRESSION && (!remis || (ONLINE && !d.correction));
  sheet.innerHTML = `${sheetHead('Remise du dossier', prof ? 'État du dossier de l\'élève et photo de son montage.' : 'Vérifiez que chaque partie est complète, ajoutez la photo de votre planche, puis remettez le dossier.')}
    <ul class="parts">${parts.map(([n, ok]) => `<li class="${ok ? 'ok' : ''}"><span class="dot" aria-hidden="true"></span>${n}<span class="state ${ok ? 'ok' : ''}">${ok ? 'Complété' : 'À faire'}</span></li>`).join('')}</ul>
    ${resumeMains(ex, prof ? PV.mains : d.mains)}
    <div class="photo-box">
      <h3>Photo de la planche</h3>
      ${prof ? (PV.photoId && ONLINE ? '<div class="row wrapr"><button type="button" class="btn small ghost" id="photo-del">Supprimer la photo</button><span class="muted small">L\'élève pourra en envoyer une autre.</span></div>' : '')
        : `<p class="muted">Cadrez toute la planche, de face, bien éclairée. Si l'appareil photo ne s'ouvre pas (« mémoire insuffisante »), prenez la photo avec l'app Appareil photo du téléphone, puis choisissez-la avec « Photo de la galerie ».</p>
      ${photoModifiable ? `<div class="row wrapr"><label class="btn${aPhotoEleve ? '' : ' primary'}" for="photo-cam">${aPhotoEleve ? 'Reprendre une photo' : 'Prendre une photo'}</label><input id="photo-cam" data-photo-in type="file" accept="image/*" capture="environment" class="sr">
        <label class="btn" for="photo-in">Photo de la galerie</label><input id="photo-in" data-photo-in type="file" accept="image/*" class="sr">
        ${aPhotoEleve ? '<button type="button" class="btn ghost" id="photo-del">Supprimer la photo</button>' : ''}</div>
        ${remis && ONLINE ? '<p class="muted small">Votre dossier est remis : vous pouvez encore changer la photo tant que le professeur n\'a pas publié la correction.</p>' : ''}` : ''}`}
      <div id="photo-prev">${PHOTOS[ex.id] ? `<img src="${PHOTOS[ex.id]}" alt="Photo de la planche"><p class="muted small">Photo prête : elle sera envoyée avec le dossier.</p>` : (d.photoId && !prof ? '<p class="state ok">Photo envoyée avec le dossier</p>' : '')}</div>
      <p id="photo-msg" class="muted small" role="status"></p>
      ${!ONLINE ? '<p class="muted small">Dans cette démo, la photo reste sur cet appareil.</p>' : ''}
    </div>
    ${prof
      ? `<div class="row wrapr">${PV.remis ? '<span class="state ok">Dossier remis</span><button type="button" class="btn primary" data-goto="correction">Corriger</button><button type="button" class="btn ghost" id="rendre">Rendre le dossier à l\'élève</button>' : '<span class="state">Pas encore remis</span>'}<span id="rem-msg" class="muted" role="status"></span></div>`
      : `<div class="row wrapr"><button type="button" class="btn primary" id="remettre" ${remis ? 'disabled' : ''}>${remis ? 'Dossier remis' : (d.remises || 0) >= 1 ? 'Remettre le dossier (seconde remise)' : 'Remettre le dossier'}</button>${d.correction ? '<button type="button" class="btn" data-goto="correction">Voir la correction</button>' : remis && ONLINE ? '<span class="muted">En attente de la correction du professeur.</span>' : ''}<span id="rem-msg" class="muted" role="status"></span></div>`}`;
  sheet.querySelectorAll('[data-goto]').forEach(b => b.addEventListener('click', () => go(Object.assign({}, VIEW, { tab: b.dataset.goto }))));
  if (prof && PV.photoId && !IMPRESSION) {
    $('#photo-prev').innerHTML = '<p class="muted">Chargement de la photo…</p>';
    urlPhoto(PV.photoId).then(url => { $('#photo-prev').innerHTML = `<img src="${url}" alt="Photo du montage de l'élève">`; })
      .catch(e => { $('#photo-prev').innerHTML = `<p class="err">${esc(e.message)}</p>`; });
  }
  // l'élève revoit la photo déjà envoyée, pour vérifier que c'est la bonne
  if (!prof && !PHOTOS[ex.id] && d.photoId && ONLINE && !IMPRESSION) {
    urlPhoto(d.photoId).then(url => { const el = $('#photo-prev'); if (el && url) el.innerHTML = `<img src="${url}" alt="Photo de la planche envoyée"><p class="state ok">Photo envoyée avec le dossier</p>`; }).catch(() => {});
  }
  const pmsg = t => { const el = $('#photo-msg'); if (el) el.textContent = t; };
  // envoi immédiat de la photo quand le dossier est déjà remis (ou quand une photo est déjà sur le serveur)
  const envoyerPhoto = async photo => {
    if (!enLigne()) return pmsg('Il faut une connexion internet pour changer la photo.');
    pmsg(photo ? 'Envoi de la photo…' : 'Suppression…');
    try {
      const r = await api('photo', { ex: ex.id, photo });
      d.photoId = r.photoId || ''; delete PHOTOS[ex.id]; if (r.photoId && photo) PHOTO_CACHE[r.photoId] = photo;
      persist(); go(VIEW);
    } catch (e) { pmsg(e.message); if (e.auth) deconnecter(e.message); }
  };
  const pdel = $('#photo-del');
  if (pdel) pdel.addEventListener('click', async () => {
    if (!pdel.dataset.ok) { pdel.dataset.ok = '1'; pdel.textContent = 'Confirmer la suppression'; pdel.classList.add('danger'); return; }
    pdel.disabled = true;
    if (prof) {
      try { await api('profPhotoSuppr', { email: CTX.eleve, ex: ex.id }); PV.photoId = ''; go(VIEW); }
      catch (e) { pdel.disabled = false; pmsg(e.message); }
      return;
    }
    if (PHOTOS[ex.id]) { delete PHOTOS[ex.id]; return go(VIEW); }       // photo pas encore envoyée
    if (ONLINE && d.photoId) return envoyerPhoto('');                   // photo déjà sur le serveur
    d.photoId = ''; persist(); go(VIEW);
  });
  const rendre = $('#rendre');
  if (rendre) rendre.addEventListener('click', () => {
    rendre.disabled = true;
    api('profRendre', { email: CTX.eleve, ex: ex.id }).then(() => { PV.remis = false; go(VIEW); }).catch(e => { rendre.disabled = false; $('#rem-msg').textContent = e.message; });
  });
  sheet.querySelectorAll('[data-photo-in]').forEach(pin => pin.addEventListener('change', async e => {
    const f = e.target.files[0]; e.target.value = ''; if (!f) return;
    pmsg('Préparation de la photo…');
    try {
      const data = await reduirePhoto(f, 1600, 0.8);
      if (remis && ONLINE) return envoyerPhoto(data);
      PHOTOS[ex.id] = data; go(VIEW);
    } catch (err) { pmsg(err.message); }
  }));
  const rem = $('#remettre');
  if (rem) rem.addEventListener('click', async () => {
    if (!ONLINE) { d.remis = true; d.remises = (d.remises || 0) + 1; save(); go(Object.assign({}, VIEW, { tab: 'correction' })); return; }
    if (!enLigne()) { $('#rem-msg').textContent = 'Il faut une connexion internet pour remettre le dossier.'; return; }
    rem.disabled = true; $('#rem-msg').textContent = 'Envoi du dossier…';
    try {
      d.maj = Date.now();
      const r = await api('remettre', { ex: ex.id, data: JSON.stringify(d), photo: PHOTOS[ex.id] || '' });
      d.remis = true; d.remises = r.remises || ((d.remises || 0) + 1); if (r.photoId) d.photoId = r.photoId;
      delete (DATA.dirty || {})[ex.id]; delete PHOTOS[ex.id];
      (DATA.resume ||= {})[ex.id] = { maj: Date.now(), remis: true };
      persist(); go(VIEW);
    } catch (e) { rem.disabled = false; $('#rem-msg').textContent = e.message; if (e.auth) deconnecter(e.message); }
  });
}
const PHOTOS = {};

/* ---------- schémas faits à la main (photo ou PDF, facultatif) ---------- */
const PARTIES_MAIN = { principe: 'Schéma de principe', unifilaire: 'Schéma unifilaire', cablage: 'Schéma de câblage', position: 'Schéma de position' };
const COURT_MAIN = { principe: 'principe', unifilaire: 'unifilaire', cablage: 'câblage', position: 'position' };
const MAIN_PREV = {};
const dateCourte = t => t ? new Date(t).toLocaleDateString('fr-BE', { day: '2-digit', month: '2-digit' }) + ' à ' + new Date(t).toLocaleTimeString('fr-BE', { hour: '2-digit', minute: '2-digit' }) : '';
function resumeMains(ex, mains) {
  mains = mains || {};
  const pm = ex.kind === 'planche' ? ['position'] : ['principe', 'unifilaire', 'cablage'];
  return `<p class="muted small mains-resume">Schémas faits à la main (facultatif) : ${pm.map(k => `${COURT_MAIN[k]} ${mains[k] ? '<b class="ok-txt">✓</b>' : '—'}`).join(' · ')}</p>`;
}
function htmlMainsProf(mains) {
  const ks = Object.keys(mains || {}).filter(k => PARTIES_MAIN[k]);
  if (!ks.length) return '';
  return `<div class="mains-corr"><h3>Schémas faits à la main</h3><p class="muted small">Ils ne sont pas corrigés automatiquement : tenez-en compte dans la grille, par exemple en « Communication ».</p>
    <div class="row wrapr">${ks.map(k => `<button type="button" class="btn small" data-voir-main="${k}">${PARTIES_MAIN[k]}</button>`).join('')}</div></div>`;
}
function bindVoirMains(root, mains) {
  root.querySelectorAll('[data-voir-main]').forEach(b => b.addEventListener('click', async () => {
    const k = b.dataset.voirMain, m = (mains || {})[k]; if (!m) return;
    if (m.data) return voirFichier(PARTIES_MAIN[k], m, m.data);
    const t = b.textContent; b.disabled = true; b.textContent = 'Chargement…';
    try { voirFichier(PARTIES_MAIN[k], m, await api('profPhoto', { id: m.id })); }
    catch (e) { alertMsg(e.message); }
    finally { b.disabled = false; b.textContent = t; }
  }));
}
function alertMsg(t) { const dlg = $('#dlg'); dlg.innerHTML = `<div class="dlg-in"><div class="dlg-head"><h2>Oups</h2><button type="button" class="ibtn" data-close aria-label="Fermer">✕</button></div><p>${esc(t)}</p></div>`; dlg.querySelector('[data-close]').addEventListener('click', () => dlg.close()); dlg.showModal(); }
function voirFichier(titre, m, url) {
  const dlg = $('#dlg');
  let href = url;
  if (/^data:application\/pdf/.test(url)) {
    const bin = atob(url.split(',')[1]), u8 = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    href = URL.createObjectURL(new Blob([u8], { type: 'application/pdf' }));
  }
  const pdf = /pdf/.test(m.type || url.slice(0, 30));
  dlg.innerHTML = `<div class="dlg-in voir-main"><div class="dlg-head"><div><span class="eyebrow">Fait à la main</span><h2>${esc(titre)}</h2></div><button type="button" class="ibtn" data-close aria-label="Fermer">✕</button></div>
    ${pdf ? `<iframe src="${href}" title="${esc(titre)}"></iframe>` : `<img src="${href}" alt="${esc(titre)} fait à la main">`}
    <p class="row wrapr"><span class="muted small">${esc(m.nom || '')} · ${dateCourte(m.le)}</span><a class="btn small" href="${href}" download="${esc(m.nom || 'schema')}" target="_blank" rel="noopener">${pdf ? 'Ouvrir le PDF' : 'Télécharger'}</a></p></div>`;
  dlg.querySelector('[data-close]').addEventListener('click', () => dlg.close());
  dlg.addEventListener('close', () => { if (href !== url) URL.revokeObjectURL(href); }, { once: true });
  dlg.showModal();
}
// réduit une photo du téléphone (12 à 48 Mpx) à « max » pixels de côté, en économisant la mémoire
async function reduirePhoto(f, max, q, fond) {
  if (f.type && !/^image\//.test(f.type)) throw new Error('Choisissez une photo (JPG, PNG ou HEIC).');
  let src = null, w, h, url = null;
  try {
    // décodage directement à la bonne taille quand le navigateur le permet (évite de charger 48 Mpx en mémoire)
    if (window.createImageBitmap) {
      try {
        const b0 = await createImageBitmap(f, { resizeWidth: max, resizeQuality: 'medium' });
        // resizeWidth seul garde les proportions ; si la photo est en hauteur, on la décode pour la largeur voulue
        if (b0.height > b0.width) { const k = max / b0.height; b0.close && b0.close(); src = await createImageBitmap(f, { resizeWidth: Math.round(max * k), resizeQuality: 'medium' }); }
        else src = b0;
        if (src.width > max * 1.01 || src.height > max * 1.01) { src.close && src.close(); src = null; } // option ignorée : méthode classique
      } catch (e) { src = null; }
    }
    if (!src) {
      url = URL.createObjectURL(f);
      src = await new Promise((res, rej) => { const img = new Image(); img.onload = () => res(img); img.onerror = () => rej(new Error('Photo illisible : essayez avec « Photo de la galerie » ou prenez une autre photo.')); img.src = url; });
    }
    w = src.naturalWidth || src.width; h = src.naturalHeight || src.height;
    const k = Math.min(1, max / Math.max(w, h));
    const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w * k)); c.height = Math.max(1, Math.round(h * k));
    const g = c.getContext('2d');
    if (fond) { g.fillStyle = fond; g.fillRect(0, 0, c.width, c.height); }
    g.drawImage(src, 0, 0, c.width, c.height);
    const data = c.toDataURL('image/jpeg', q);
    c.width = c.height = 0; // libère la mémoire tout de suite (important sur iPhone)
    if (data.length < 100) throw new Error('Mémoire insuffisante pour préparer la photo : fermez les autres apps et réessayez.');
    return data;
  } finally {
    if (src && src.close) src.close();
    if (src && src.src !== undefined && url) src.src = '';
    if (url) URL.revokeObjectURL(url);
  }
}
function fichierVersDataUrl(f) {
  return new Promise((res, rej) => {
    if (f.type === 'application/pdf') {
      if (f.size > 10e6) return rej(new Error('PDF trop lourd (10 Mo au maximum).'));
      const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => rej(new Error('Fichier illisible.')); r.readAsDataURL(f); return;
    }
    if (!/^image\//.test(f.type)) return rej(new Error('Envoyez une photo (JPG, PNG) ou un PDF.'));
    reduirePhoto(f, 2000, 0.82, '#fff').then(res, () => rej(new Error('Image illisible : envoyez-la en JPG ou en PDF.')));
  });
}
function mainBox(sheet, ex, d, partie) {
  let box = sheet.querySelector('.main-box');
  if (!box) { box = document.createElement('div'); box.className = 'main-box'; sheet.appendChild(box); }
  const redraw = () => mainBox(sheet, ex, d, partie);
  const titre = `<h3>${PARTIES_MAIN[partie]} fait à la main <span class="pill">facultatif</span></h3>`;
  if (USER.role === 'prof') {
    if (!CTX.eleve) { box.innerHTML = `${titre}<p class="muted">L'élève peut joindre ici une photo ou un PDF de son schéma dessiné sur papier.</p>`; return; }
    const m = (PV.mains || {})[partie];
    box.innerHTML = `${titre}${m ? `<p class="main-file"><span class="state ok">Joint</span> ${esc(m.nom)} <span class="muted small">${dateCourte(m.le)}</span> <button type="button" class="btn small" data-voir-main="${partie}">Voir</button></p>` : '<p class="muted">Pas de schéma fait à la main pour cette feuille.</p>'}`;
    bindVoirMains(box, PV.mains); return;
  }
  const m = (d.mains || {})[partie], remis = !!d.remis, key = ex.id + '|' + partie;
  const prev = m && (m.data || MAIN_PREV[key]);
  box.innerHTML = `${titre}
    <p class="muted">Vous avez aussi dessiné ce schéma sur papier, à la latte ? Prenez-le en photo, bien à plat et de face, ou joignez un scan en PDF. Le schéma dans l'app reste obligatoire.</p>
    ${m ? `<div class="main-file">${prev && !/pdf/.test(m.type) ? `<img src="${prev}" alt="Aperçu du schéma fait à la main">` : '<span class="main-ico" aria-hidden="true">PDF</span>'}
      <div><span class="state ok">Joint</span> ${esc(m.nom)}<br><span class="muted small">Envoyé le ${dateCourte(m.le)}</span></div></div>` : ''}
    ${remis ? '' : `<div class="row wrapr"><label class="btn ${m ? '' : 'primary'}" for="main-in">${m ? 'Remplacer' : 'Joindre une photo ou un PDF'}</label>
      <input id="main-in" type="file" accept="image/*,application/pdf" class="sr">${m ? '<button type="button" class="btn ghost" id="main-del">Retirer</button>' : ''}</div>`}
    <p id="main-msg" class="muted small" role="status"></p>`;
  const msg = t => { const el = box.querySelector('#main-msg'); if (el) el.textContent = t; };
  const inp = box.querySelector('#main-in');
  if (inp) inp.addEventListener('change', async e => {
    const f = e.target.files[0]; if (!f) return;
    if (ONLINE && !enLigne()) return msg('Il faut une connexion internet pour envoyer le fichier.');
    msg('Préparation…');
    try {
      const url = await fichierVersDataUrl(f), type = url.slice(5, url.indexOf(';'));
      if (!ONLINE) { (d.mains ||= {})[partie] = { nom: f.name, type, le: Date.now(), data: url }; persist(); return redraw(); }
      msg('Envoi…');
      d.mains = await api('joindre', { ex: ex.id, partie, fichier: url, nom: f.name });
      if (!/pdf/.test(type)) MAIN_PREV[key] = url;
      persist(); redraw();
    } catch (err) { msg(err.message); if (err.auth) deconnecter(err.message); }
  });
  const del = box.querySelector('#main-del');
  if (del) del.addEventListener('click', async () => {
    if (!ONLINE) { delete d.mains[partie]; persist(); return redraw(); }
    if (!enLigne()) return msg('Il faut une connexion internet.');
    del.disabled = true; msg('Suppression…');
    try { d.mains = await api('retirer', { ex: ex.id, partie }); delete MAIN_PREV[key]; persist(); redraw(); }
    catch (err) { del.disabled = false; msg(err.message); }
  });
}

/* ---------- correction (V2) ---------- */
const ORDRE_G = { erreur: 0, remarque: 1, ok: 2 };
function htmlParties(parties, ouvert, accepter) {
  return parties.map(p => {
    const err = p.F.filter(f => f.g === 'erreur').length, rem = p.F.filter(f => f.g === 'remarque').length;
    return `<details class="corr-part" ${ouvert || err || rem ? 'open' : ''}><summary><span class="corr-titre">${esc(p.titre)}</span>
      <span class="corr-badges">${err ? `<span class="pill-err">${err} erreur${err > 1 ? 's' : ''}</span>` : ''}${rem ? `<span class="pill-rem">${rem} remarque${rem > 1 ? 's' : ''}</span>` : ''}${!err && !rem ? '<span class="pill-ok">tout juste</span>' : ''}</span>
      <span class="corr-score mono">${num(p.score)} / ${p.max}</span></summary>
      <ul class="constats">${p.F.slice().sort((a, b) => ORDRE_G[a.g] - ORDRE_G[b.g]).map(f => `<li class="c-${f.g}"><span class="c-ico" aria-hidden="true">${f.g === 'ok' ? '✓' : f.g === 'erreur' ? '✕' : '!'}</span>
        <span class="c-txt">${esc(f.msg)}${f.code ? ` <span class="c-code" title="Code d'infraction Vinçotte (RGIE)">Vinçotte ${f.code}</span>` : ''}${f.accepte ? ' <span class="c-acc-lbl">accepté par le professeur</span>' : ''}</span>${f.fiche && f.g !== 'ok' ? `<button type="button" class="as-link small" data-fiche="${f.fiche}">Comment faire ?</button>` : ''}
        ${accepter && (f.g !== 'ok' || f.accepte) ? `<label class="c-acc" title="Accepter : ce point ne compte plus dans la note"><input type="checkbox" data-acc="${esc(cleConstat(p.id, f))}" ${f.accepte ? 'checked' : ''}> Accepter</label>` : ''}</li>`).join('')}</ul></details>`;
  }).join('');
}
function totalGrille(g) {
  const vide = k => g[k] == null || g[k] === '';
  return { tot: GRILLE.reduce((s, [k]) => s + (vide(k) ? 0 : +g[k]), 0), max: GRILLE.reduce((s, [k, , m]) => s + (vide(k) ? 0 : m), 0) };
}
function htmlGrille(g, editable) {
  const { tot, max } = totalGrille(g);
  return `<table class="tbl grille"><thead><tr><th>Critère</th><th class="num">Points</th><th class="num">Sur</th></tr></thead><tbody>
    ${GRILLE.map(([k, nom, m]) => `<tr><td>${nom}${k === 'produit' ? ' <span class="muted small">(montage, par le professeur)</span>' : ''}</td>
      <td class="num">${editable ? `<input type="text" inputmode="decimal" class="mono g-in" data-g="${k}" value="${g[k] == null ? '' : String(g[k]).replace('.', ',')}" aria-label="${nom}">` : `<span class="mono">${g[k] == null || g[k] === '' ? '—' : num(+g[k])}</span>`}</td><td class="num mono">${m}</td></tr>`).join('')}
    <tr class="g-tot"><td>Total</td><td class="num mono" id="g-tot">${num(tot)}</td><td class="num mono" id="g-max">${max || 215}${max ? ` <span class="muted">· ${Math.round(tot / max * 100)} %</span>` : ''}</td></tr></tbody></table>`;
}
function correctionSheet(sheet, ex, v, d) {
  const prof = USER.role === 'prof';
  let auto = corrigerDossier(ex, v, d);
  if (prof && CTX.eleve) {
    const saved = PV.correction;
    const h0a = (PV.historique || [])[0];
    // constats acceptés par le professeur (repris de la première correction pour la seconde remise)
    if (!PV.acceptes) PV.acceptes = ((saved && saved.acceptes) || (h0a && h0a.correction && h0a.correction.acceptes) || []).slice();
    auto = corrigerDossier(ex, v, d, PV.acceptes);
    const g = Object.assign({}, auto.grille, saved && saved.grille);
    const propPF = propositionProduit(ex, v, PV.essaiProf);
    if ((g.produit == null || g.produit === '') && propPF) g.produit = propPF.total;
    if (PV.annot === undefined) PV.annot = (saved && saved.annot) || null;
    const h0 = (PV.historique || [])[0];
    sheet.innerHTML = `${sheetHead('Correction', 'La correction automatique est calculée à partir du dossier de l\'élève. Ajustez les points si besoin, ajoutez un commentaire, puis publiez : l\'élève verra le détail de ses erreurs avec les explications.')}
      <p class="row wrapr">${PV.remis ? '<span class="state ok">Dossier remis</span>' : '<span class="state cur">Pas encore remis</span>'}
        <span class="state">${PV.remises >= 2 ? 'Seconde remise' : PV.remises === 1 ? 'Première remise' : 'Aucune remise'}</span>
        ${saved ? (PV.publiee ? '<span class="state ok">Correction publiée</span>' : '<span class="state todo">Brouillon enregistré</span>') : ''}</p>
      ${htmlMainsProf(PV.mains)}
      ${propPF ? `<p class="muted small">Produit fini proposé d'après la feuille Essais : ${num(propPF.total)} / 45 (réalisation ${num(propPF.real)}, essais ${num(propPF.essais)}, dépannage ${num(propPF.dep)}).</p>` : ''}
      ${PV.photoId && ONLINE ? `<div class="mains-corr"><h3>Photo du montage</h3><p class="muted small">Entourez ou fléchez ce qui ne va pas, ajoutez un mot : l'élève verra la photo annotée avec sa correction.</p>
        <div class="row wrapr"><button type="button" class="btn small" id="an-go">${PV.annot && PV.annot.items.length ? `Modifier les annotations (${PV.annot.items.length})` : 'Annoter la photo'}</button></div><div id="an-prev" class="an-prev"></div></div>` : ''}
      ${h0 && h0.correction ? `<details class="corr-hist"><summary>Correction de la première remise : ${num(totalGrille(h0.correction.grille || {}).tot)} points</summary>${htmlParties(h0.correction.parties || [])}</details>` : ''}
      <div class="corr-grid">
        <div class="corr-side">
          <h3>Grille d'évaluation</h3>
          ${htmlGrille(g, true)}
          <label class="corr-com" for="g-com">Commentaire pour l'élève</label>
          <textarea id="g-com" rows="4" placeholder="Points forts, points à revoir, conseil pour la prochaine fois…">${esc(saved && saved.commentaire || '')}</textarea>
          <div class="row wrapr"><button type="button" class="btn" id="g-save">Enregistrer le brouillon</button>
            <button type="button" class="btn primary" id="g-pub" ${PV.remis ? '' : 'disabled title="Le dossier doit être remis"'}>${PV.publiee ? 'Republier' : 'Publier à l\'élève'}</button></div>
          <p id="g-msg" class="muted small" role="status"></p>
        </div>
        <div class="corr-main"><h3>Correction automatique</h3>
          <p class="muted small">Un point que la correction n'a pas prévu, mais que vous trouvez juste (un article en plus pertinent, par exemple) ? Cochez « Accepter » : il ne compte plus dans la note et l'élève le verra comme accepté.</p>
          <div id="corr-parts">${htmlParties(auto.parties, false, true)}</div></div>
      </div>`;
    const lire = () => { const o = {}; sheet.querySelectorAll('[data-g]').forEach(i => { const t = i.value.trim().replace(',', '.'); o[i.dataset.g] = t === '' ? null : Math.max(0, +t || 0); }); return o; };
    const majTot = () => { const { tot, max } = totalGrille(lire()); $('#g-tot').textContent = num(tot); $('#g-max').innerHTML = `${max || 215}${max ? ` <span class="muted">· ${Math.round(tot / max * 100)} %</span>` : ''}`; };
    sheet.querySelectorAll('[data-g]').forEach(i => i.addEventListener('input', majTot));
    // accepter / refuser un constat : la note automatique change, et la grille suit (les retouches du prof sont gardées)
    $('#corr-parts').addEventListener('change', e => {
      const cb = e.target.closest('[data-acc]'); if (!cb) return;
      const k = cb.dataset.acc;
      PV.acceptes = PV.acceptes.filter(x => x !== k); if (cb.checked) PV.acceptes.push(k);
      const avant = auto; auto = corrigerDossier(ex, v, d, PV.acceptes);
      for (const [gk] of GRILLE) {
        const delta = (auto.grille[gk] || 0) - (avant.grille[gk] || 0), inp = sheet.querySelector(`[data-g="${gk}"]`);
        if (delta && inp && inp.value.trim() !== '') inp.value = String(Math.max(0, Math.round(((+inp.value.replace(',', '.') || 0) + delta) * 2) / 2)).replace('.', ',');
      }
      const ouverts = [...sheet.querySelectorAll('#corr-parts details')].map(x => x.open);
      $('#corr-parts').innerHTML = htmlParties(auto.parties, false, true);
      sheet.querySelectorAll('#corr-parts details').forEach((x, i) => { if (ouverts[i]) x.open = true; });
      bindFiches($('#corr-parts')); majTot();
      $('#g-msg').textContent = 'N\'oubliez pas d\'enregistrer ou de publier.';
    });
    const envoyer = publier => {
      const corr = { date: Date.now(), essai: PV.remises || 1, grille: lire(), commentaire: $('#g-com').value.trim(), parties: auto.parties.map(p => ({ id: p.id, titre: p.titre, max: p.max, score: p.score, F: p.F })), acceptes: PV.acceptes.slice(), annot: PV.annot && PV.annot.items.length ? PV.annot : null };
      $('#g-msg').textContent = publier ? 'Publication…' : 'Enregistrement…';
      api('profCorriger', { email: CTX.eleve, ex: ex.id, correction: corr, publier })
        .then(() => { PV.correction = corr; if (publier) PV.publiee = true; ELEVES = null; go(VIEW); })
        .catch(e => { $('#g-msg').textContent = e.message; });
    };
    $('#g-save').addEventListener('click', () => envoyer(false));
    $('#g-pub').addEventListener('click', () => envoyer(true));
    bindFiches(sheet); bindVoirMains(sheet, PV.mains);
    const anPrev = $('#an-prev', sheet); if (anPrev && PV.annot) blocPhotoAnnotee(anPrev, PV.annot);
    const anGo = $('#an-go', sheet);
    if (anGo) anGo.addEventListener('click', async () => {
      anGo.disabled = true; const t = anGo.textContent; anGo.textContent = 'Chargement de la photo…';
      try {
        const u = await urlPhoto(PV.photoId);
        editeurAnnotations(u, PV.annot, items => {
          PV.annot = { photoId: PV.photoId, items };
          if (anPrev) blocPhotoAnnotee(anPrev, PV.annot);
          anGo.textContent = items.length ? `Modifier les annotations (${items.length})` : 'Annoter la photo';
          $('#g-msg').textContent = 'Annotations prêtes : enregistrez le brouillon ou publiez.';
        });
      } catch (e) { $('#g-msg').textContent = e.message; anGo.textContent = t; }
      finally { anGo.disabled = false; }
    });
    return;
  }
  if (prof) {
    sheet.innerHTML = `${sheetHead('Correction', ONLINE ? 'Aperçu de la correction automatique pour les données de cet aperçu. Pour corriger un élève, ouvrez son dossier depuis « Mes élèves ».' : 'Aperçu de la correction automatique du dossier rempli dans cette démo.')}
      <div class="corr-grid"><div class="corr-side"><h3>Grille proposée</h3>${htmlGrille(auto.grille, false)}</div><div class="corr-main">${htmlParties(auto.parties)}</div></div>`;
    bindFiches(sheet);
    return;
  }
  // élève
  const corr = d.correction || (!ONLINE && d.remis ? Object.assign(auto, { commentaire: '', demo: true }) : null);
  if (!corr) { sheet.innerHTML = sheetHead('Correction', 'La correction apparaîtra ici quand le professeur l\'aura publiée.'); return; }
  const peutReprendre = d.remis && (d.remises || 1) < 2;
  sheet.innerHTML = `${sheetHead('Correction', corr.demo ? 'Démo : en vrai, la correction apparaît quand le professeur l\'a validée.' : 'Lisez chaque remarque : elle explique ce qui ne va pas et renvoie vers la fiche qui aide à corriger.')}
    <div class="corr-grid">
      <div class="corr-side"><h3>Votre évaluation</h3>${htmlGrille(corr.grille || {}, false)}
        ${corr.commentaire ? `<div class="corr-comment"><span class="k">Commentaire du professeur</span><p>${esc(corr.commentaire)}</p></div>` : ''}
        ${peutReprendre ? `<div class="corr-again"><p>Vous pouvez corriger votre dossier et le remettre <b>une seconde fois</b>. Les deux résultats sont gardés.</p>
          <button type="button" class="btn primary" id="reprendre">Corriger et remettre</button><p id="rep-msg" class="muted small" role="status"></p></div>` : ((d.remises || 0) >= 2 ? '<p class="muted small">Seconde remise utilisée.</p>' : '')}
      </div>
      <div class="corr-main"><h3>Le détail</h3>${htmlParties(corr.parties || [])}<div class="an-eleve"></div></div>
    </div>`;
  if (corr.annot) blocPhotoAnnotee(sheet.querySelector('.an-eleve'), corr.annot);
  bindFiches(sheet);
  const rp = $('#reprendre');
  if (rp) rp.addEventListener('click', async () => {
    const rouvrir = () => { (d.historique ||= []).push({ correction: d.correction || corr, le: Date.now() }); d.correction = null; d.remis = false; d.remises = Math.max(1, d.remises || 0); };
    if (!ONLINE) { rouvrir(); save(); go(Object.assign({}, VIEW, { tab: 'enonce' })); return; }
    if (!enLigne()) { $('#rep-msg').textContent = 'Il faut une connexion internet.'; return; }
    rp.disabled = true;
    try { await api('reprendre', { ex: ex.id }); rouvrir(); if (DATA.resume && DATA.resume[ex.id]) DATA.resume[ex.id].corrige = false; persist(); go(Object.assign({}, VIEW, { tab: 'enonce' })); }
    catch (e) { rp.disabled = false; $('#rep-msg').textContent = e.message; }
  });
}

/* ---------- apprendre ---------- */
function ficheIllus(f) {
  if (!f.sym) return '';
  const type = f.sym;
  return `<div class="fiche-illus"><figure><svg viewBox="-36 -40 72 80" class="paper-svg" aria-hidden="true" data-psym="${type}"></svg><figcaption>Symbole (schéma de principe)</figcaption></figure>
    ${type !== 'lampe' ? `<figure><svg viewBox="-42 -42 84 84" class="real-svg" aria-hidden="true" data-meca="${type}"></svg><figcaption>Mécanisme et bornes</figcaption></figure>` : `<figure><svg viewBox="-36 -36 72 72" class="real-svg" aria-hidden="true" data-douille="1"></svg><figcaption>Douille et bornes</figcaption></figure>`}</div>`;
}
function drawIllus(root) {
  root.querySelectorAll('[data-psym]').forEach(s => drawPrincipeSymbol(s, s.dataset.psym, 0, 0, 0, symFit(s.dataset.psym, 66, 74)));
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
let ELEVES = null, FILTRE_ELEVES = '', FILTRE_CLASSE = '';
let VUE_ELEVES = store.get('tp3pelec:vue-eleves', null);
const profEleve = e => e.prof || profDeClasse(e.classe);
// un élève est « à moi » s'il m'a choisi, ou si je suis l'un des (au plus 2) professeurs de sa classe
const estMonEleve = e => e.prof === USER.email || profsDeClasse(e.classe).includes(USER.email);
const nomsProfsEleve = e => { const l = [...new Set([e.prof, ...profsDeClasse(e.classe)].filter(Boolean))]; return l.map(nomProf).join(' / '); };
function vueEleves() {
  if (VUE_ELEVES) return VUE_ELEVES;
  return LISTES.classes.some(c => classeDuProf(c, USER.email)) || (ELEVES || []).some(estMonEleve) ? 'mes' : 'tous';
}
function classesConnues() { return [...new Set([...LISTES.classes.map(c => c.classe), ...(ELEVES || []).map(e => e.classe).filter(Boolean)])]; }
function profHome(main) {
  main.innerHTML = `
    ${ONLINE ? `<section class="hello"><h1>Élèves</h1><p>Cliquez sur une case pour ouvrir le dossier d'un élève : schémas, bon de commande, photo. Sur le bon de commande du TP 0, vous validez le matériel de la planche.</p></section>
    <div class="el-bar">
      <div class="chips" role="group" aria-label="Élèves affichés"><button type="button" class="chip" data-vue="mes">Mes élèves</button><button type="button" class="chip" data-vue="tous">Tous les élèves</button></div>
      <label class="inline">Classe <select id="el-classe"></select></label>
      <label class="inline">Rechercher <input id="el-q" type="search" value="${esc(FILTRE_ELEVES)}" placeholder="Nom, adresse…"></label>
      <button type="button" class="btn ghost small" id="el-maj">Actualiser</button>
    </div>
    <p class="muted small" id="el-compte"></p>
    <div id="eleves" class="table-wrap"><p class="empty">Chargement de la liste…</p></div>` : ''}
    <section class="hello"><div class="row between wrapr"><h2>Exercices</h2><button type="button" class="btn primary small" id="ex-creer">+ Créer un exercice</button></div>
      <p>Ouvrez un exercice pour voir ce que voit un élève. Chaque élève reçoit sa propre variante (emplacements, couleur des finitions, type de chantier pour la TVA), calculée à partir de son adresse. Un exercice créé par un professeur est visible par tous les élèves.</p></section>
    <ol class="ex-list">${EXERCICES.map(ex => `<li><button type="button" class="ex-card" data-ex="${ex.id}">
      <span class="ex-num">TP ${ex.num}</span><span class="ex-main"><span class="ex-title">${esc(ex.titre)}</span><span class="ex-sub">${esc(ex.court)}</span></span><span class="state ${ex.perso && ex.visible === false ? '' : ex.perso ? 'cur' : ''}">${ex.perso ? (ex.visible === false ? 'Masqué' : 'Créé') : 'Aperçu'}</span></button></li>`).join('')}</ol>
    ${ONLINE && DATA.admin ? `<section class="card zone-annee">
      <h2>Nouvelle année scolaire</h2>
      <p>Année en cours dans l'app : <b>${esc(DATA.annee || '')}</b>. En fin d'année, ce bouton archive tout (copie du tableur et photos, dans un dossier Drive « Dossier TP – archive ${esc(DATA.annee || '')} »), puis vide la liste des élèves et leurs dossiers. Le catalogue, les profs et les classes sont gardés : mettez-les à jour ensuite dans le Google Sheet.</p>
      <div><button type="button" class="btn" id="na-open">Démarrer une nouvelle année…</button></div>
    </section>` : ''}
    <section class="card next">
      <h2>Prochaines étapes</h2>
      <ul>
        <li>Création de nouveaux exercices par glisser-déposer.</li>
        <li><b>V3</b> : photo annotée par le prof, validation pratique par essai et grille de dépannage.</li>
      </ul>
    </section>`;
  main.querySelectorAll('[data-ex]').forEach(b => b.addEventListener('click', () => go({ page: 'ex', id: b.dataset.ex, tab: 'enonce' })));
  const na = $('#na-open'); if (na) na.addEventListener('click', openNouvelleAnnee);
  $('#ex-creer').addEventListener('click', () => { CREA = null; go({ page: 'creer' }); });
  if (!ONLINE) return;
  const majFiltres = () => {
    const vue = vueEleves();
    main.querySelectorAll('[data-vue]').forEach(b => { b.classList.toggle('on', b.dataset.vue === vue); b.setAttribute('aria-pressed', b.dataset.vue === vue); });
    const cls = classesConnues().filter(c => vue === 'tous' || LISTES.classes.some(x => x.classe === c && classeDuProf(x, USER.email)) || (ELEVES || []).some(e => e.classe === c && estMonEleve(e)));
    if (FILTRE_CLASSE && !cls.includes(FILTRE_CLASSE)) FILTRE_CLASSE = '';
    $('#el-classe').innerHTML = `<option value="">Toutes</option>${cls.map(c => `<option ${c === FILTRE_CLASSE ? 'selected' : ''}>${esc(c)}</option>`).join('')}`;
  };
  const draw = () => {
    const box = $('#eleves'); if (!box) return;
    majFiltres();
    if (!ELEVES) return;
    const q = FILTRE_ELEVES.trim().toLowerCase(), vue = vueEleves();
    const list = ELEVES.filter(e => (vue === 'tous' || estMonEleve(e)) && (!FILTRE_CLASSE || e.classe === FILTRE_CLASSE) && (!q || `${e.nom} ${e.prenom} ${e.classe} ${e.email}`.toLowerCase().includes(q)));
    $('#el-compte').textContent = list.length ? `${list.length} élève${list.length > 1 ? 's' : ''}${vue === 'mes' ? ' dans vos classes' : ''}` : '';
    if (!list.length) {
      box.innerHTML = `<p class="empty">${!ELEVES.length ? 'Aucun élève ne s\'est encore connecté.' : vue === 'mes' && !q && !FILTRE_CLASSE ? 'Aucun de vos élèves ne s\'est encore connecté. <button type="button" class="as-link" data-vue="tous">Voir tous les élèves</button>' : 'Aucun élève ne correspond.'}</p>`;
      box.querySelectorAll('[data-vue]').forEach(b => b.addEventListener('click', () => choisirVue(b.dataset.vue)));
      return;
    }
    box.innerHTML = `<table class="tbl eleves"><thead><tr><th>Élève</th><th>Classe</th><th class="c">Planche</th>${EXERCICES.map(x => `<th class="c">TP ${x.num}</th>`).join('')}</tr></thead>
      <tbody>${list.map(e => `<tr><td><b>${esc(e.nom)}</b> ${esc(e.prenom)}<span class="muted small mail">${esc(e.email)}</span></td>
        <td><span class="cl-cell"><span>${esc(e.classe || '—')}<span class="muted small mail">${esc(nomsProfsEleve(e) || 'sans professeur')}</span></span><button type="button" class="ibtn small-i" data-aff="${esc(e.email)}" title="Changer la classe ou le professeur" aria-label="Changer la classe ou le professeur de ${esc(e.prenom)} ${esc(e.nom)}">✎</button></span></td>
        <td class="c">${e.planche ? '<span class="state ok">validée</span>' : '<span class="muted">—</span>'}</td>
        ${EXERCICES.map(x => { const st = e.ex[x.id]; const lbl = st ? (st.corrige && st.remis ? 'corrigé' : st.remis ? 'à corriger' : 'en cours') : '—'; const cls = st ? (st.corrige && st.remis ? 'ok' : st.remis ? 'todo' : 'cur') : '';
          return `<td class="c"><button type="button" class="cell-btn state ${cls}" data-el="${esc(e.email)}" data-x="${x.id}" data-remis="${st && st.remis ? 1 : 0}" title="TP ${x.num} – ${esc(e.prenom)} ${esc(e.nom)}">${lbl}</button></td>`; }).join('')}</tr>`).join('')}</tbody></table>`;
    box.querySelectorAll('[data-el]').forEach(b => b.addEventListener('click', () => { PV = null; go({ page: 'ex', id: b.dataset.x, tab: b.dataset.remis === '1' ? 'correction' : 'enonce', eleve: b.dataset.el }); }));
    box.querySelectorAll('[data-aff]').forEach(b => b.addEventListener('click', () => openAffecter(ELEVES.find(e => e.email === b.dataset.aff), draw)));
  };
  const choisirVue = v => { VUE_ELEVES = v; store.set('tp3pelec:vue-eleves', v); draw(); };
  const charger = () => api('profEleves').then(r => { ELEVES = r; draw(); }).catch(e => { const box = $('#eleves'); if (box) box.innerHTML = `<p class="err">${esc(e.message)}</p>`; if (e.auth) deconnecter(e.message); });
  main.querySelectorAll('.el-bar [data-vue]').forEach(b => b.addEventListener('click', () => choisirVue(b.dataset.vue)));
  $('#el-classe').addEventListener('change', e => { FILTRE_CLASSE = e.target.value; draw(); });
  $('#el-q').addEventListener('input', e => { FILTRE_ELEVES = e.target.value; draw(); });
  $('#el-maj').addEventListener('click', () => { ELEVES = null; $('#eleves').innerHTML = '<p class="empty">Chargement de la liste…</p>'; charger(); });
  if (ELEVES) draw(); else majFiltres();
  charger(); // toujours rafraîchie en arrière-plan : nouvelles remises, nouveaux élèves
}
function openAffecter(e, redraw) {
  if (!e) return;
  const dlg = $('#dlg');
  const classes = [...new Set([...LISTES.classes.map(c => c.classe), e.classe].filter(Boolean))];
  const pr = profEleve(e);
  dlg.innerHTML = `<div class="dlg-in dlg-petit"><div class="dlg-head"><div><span class="eyebrow">Classe et professeur</span><h2>${esc(e.prenom)} ${esc(e.nom)}</h2></div><button type="button" class="ibtn" data-close aria-label="Fermer">✕</button></div>
    <form id="af" class="form-grid">
      <label>Classe <select id="af-c"><option value="">—</option>${classes.map(c => `<option ${c === e.classe ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select></label>
      <label>Professeur <select id="af-p"><option value="">—</option>${LISTES.profs.map(x => `<option value="${esc(x.email)}" ${x.email === pr ? 'selected' : ''}>${esc(x.nom)}</option>`).join('')}</select></label>
      <p class="muted small">Une classe ou un professeur manque ? Ajoutez-le dans l'onglet Classes ou Profs du Google Sheet, puis actualisez l'app.</p>
      <p id="af-msg" class="err" role="status"></p>
      <div class="row wrapr"><button type="submit" class="btn primary">Enregistrer</button><button type="button" class="btn ghost" data-close>Annuler</button></div>
    </form></div>`;
  dlg.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', () => dlg.close()));
  const sc = $('#af-c', dlg), sp = $('#af-p', dlg);
  sc.addEventListener('change', () => { const d = profDeClasse(sc.value); if (d) sp.value = d; });
  $('#af', dlg).addEventListener('submit', async ev => {
    ev.preventDefault();
    const btn = dlg.querySelector('[type=submit]'); btn.disabled = true;
    try {
      await api('profAffecter', { email: e.email, classe: sc.value, prof: sp.value });
      e.classe = sc.value; e.prof = sp.value; dlg.close(); redraw();
    } catch (err) { btn.disabled = false; $('#af-msg', dlg).textContent = err.message; }
  });
  dlg.showModal();
}
function openNouvelleAnnee() {
  const dlg = $('#dlg'), an = DATA.annee || '';
  dlg.innerHTML = `<div class="dlg-in dlg-petit"><div class="dlg-head"><div><span class="eyebrow">Fin d'année</span><h2>Nouvelle année scolaire</h2></div><button type="button" class="ibtn" data-close aria-label="Fermer">✕</button></div>
    <div id="na-corps">
    <ol class="na-etapes">
      <li><b>Archive</b> : une copie complète du Google Sheet et le dossier des photos sont rangés dans « Dossier TP – archive ${esc(an)} », dans votre Drive.</li>
      <li><b>Remise à zéro</b> : la liste des élèves, leurs dossiers, corrections et photos repartent à vide. Les élèves bloqués aussi.</li>
      <li><b>Gardé</b> : le catalogue (avec vos prix), les profs et les classes.</li>
    </ol>
    <p>Les élèves gardent l'app et le même lien : à leur prochaine connexion, elle repart à zéro et leur redemande leur classe.</p>
    <form id="na-f" class="form-grid">
      <label><span>Pour confirmer, tapez <b class="mono">${esc(an)}</b></span><input id="na-c" autocomplete="off" inputmode="numeric"></label>
      <p id="na-msg" class="err" role="status"></p>
      <div class="row wrapr"><button type="submit" class="btn danger" id="na-go" disabled>Archiver et remettre à zéro</button><button type="button" class="btn ghost" data-close>Annuler</button></div>
    </form></div></div>`;
  dlg.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', () => dlg.close()));
  const inp = $('#na-c', dlg), goB = $('#na-go', dlg);
  inp.addEventListener('input', () => { goB.disabled = inp.value.trim() !== an; });
  $('#na-f', dlg).addEventListener('submit', async ev => {
    ev.preventDefault();
    goB.disabled = true; goB.textContent = 'Archivage en cours…'; $('#na-msg', dlg).textContent = '';
    try {
      const r = await api('profNouvelleAnnee', { confirmation: inp.value.trim() });
      DATA.annee = r.annee; persist(); ELEVES = null; PV = null;
      $('#na-corps', dlg).innerHTML = `<p class="state ok">C'est fait : l'app est passée à l'année ${esc(r.annee)}.</p>
        <p>L'archive de ${esc(an)} est dans votre Drive : <a href="${esc(r.dossier)}" target="_blank" rel="noopener">ouvrir le dossier d'archive</a>.</p>
        <p>Pensez maintenant à mettre à jour les onglets <b>Classes</b> et <b>Profs</b> du Google Sheet pour la nouvelle année.</p>
        <div><button type="button" class="btn primary" data-close>Fermer</button></div>`;
      dlg.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', () => { dlg.close(); go({ page: 'home' }); }));
    } catch (err) { goB.disabled = false; goB.textContent = 'Archiver et remettre à zéro'; $('#na-msg', dlg).textContent = err.message; }
  });
  dlg.showModal(); inp.focus();
}

/* ---------- démarrage ---------- */
async function flushProfil() {
  if (!ONLINE || !DATA || !DATA.profilDirty || !enLigne()) return;
  try { await api('profil', { profil: DATA.profil }); DATA.profilDirty = false; persist(); } catch (e) { /* réessai plus tard */ }
}
function nouvelleAnneeLocale() {
  // le prof a archivé l'année : on repart à zéro sur cet appareil (la connexion est gardée)
  DATA = { profil: { prenom: USER.prenom, nom: USER.nom, classe: '', prof: '', confirme: USER.role !== 'eleve' }, ex: {}, planche: { validee: false, lignes: [] }, resume: {}, dirty: {}, msgAnnee: USER.role === 'eleve' };
  [FETCHED, SCRATCH, PHOTOS, MAIN_PREV].forEach(o => Object.keys(o).forEach(k => delete o[k]));
  ELEVES = null; PV = null; if (VIEW.page === 'ex') VIEW = { page: 'home' };
}
async function rafraichir() {
  if (!USER || !enLigne()) { if (USER) setSync('hors'); return; }
  try {
    const r = await api('moi');
    USER.role = r.role;
    if (Array.isArray(r.exercices)) { store.set('tp3pelec:exos', r.exercices); appliquerExercicesPerso(r.exercices); }
    if (Array.isArray(r.classes)) { LISTES = { classes: r.classes, profs: r.profs || [] }; store.set('tp3pelec:listes', LISTES); }
    if (r.annee) {
      if (DATA.annee && DATA.annee !== r.annee) nouvelleAnneeLocale();
      DATA.annee = r.annee;
    }
    DATA.admin = !!r.admin;
    if (r.role === 'eleve') {
      const garde = DATA.profilDirty ? DATA.profil : null;
      DATA.profil = garde || r.profil;
      DATA.planche = r.planche || DATA.planche;
      DATA.resume = r.resume || {};
    }
    if (Array.isArray(r.catalogue) && r.catalogue.length) { CATALOGUE.splice(0, CATALOGUE.length, ...r.catalogue); store.set('tp3pelec:cat-cache', r.catalogue); }
    persist(); setSync('ok');
    await flushProfil(); await flushDirty();
    if (VIEW.page !== 'ex' && VIEW.page !== 'profil' && !document.querySelector('dialog[open]') && !(document.activeElement && /input|textarea|select/i.test(document.activeElement.tagName))) render();
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
  DATA = store.get('tp3pelec:' + p.e, null) || { profil: { prenom: n.prenom, nom: n.nom, classe: '', prof: '', confirme: p.r !== 'eleve' }, ex: {}, planche: { validee: false, lignes: [] }, resume: {}, dirty: {} };
  const cat = store.get('tp3pelec:cat-cache', null);
  if (Array.isArray(cat) && cat.length) CATALOGUE.splice(0, CATALOGUE.length, ...cat);
  chargerExercicesLocaux();
  VIEW = { page: 'home' }; render();
  rafraichir();
}
(function start() {
  if (!ONLINE) {
    loadCatalogue();
    const last = store.get('tp3pelec:session', null);
    if (last) { const u = parseEmail(last); if (!u.error) { loadUser(u); chargerExercicesLocaux(); VIEW = { page: 'home' }; } }
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
