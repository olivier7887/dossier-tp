/**
 * Dossier TP — Institut Saint-Roch (Marche-en-Famenne)
 * Script du Google Sheet « Dossier TP – données ».
 * Créé par Lesenfants Olivier.
 *
 * Ce script a DEUX déploiements (même code) :
 *   1. « Connexion » : Exécuter en tant que : Moi · Qui a accès : utilisateurs de elmarche.be
 *      → doGet : Google indique qui est connecté, le script remet une clé signée à l'app.
 *   2. « Données »   : Exécuter en tant que : Moi · Qui a accès : Tout le monde
 *      → doPost : l'app (GitHub Pages) lit et enregistre les dossiers avec cette clé.
 *
 * Installation : coller ce code dans Extensions › Apps Script, exécuter « installer » une fois,
 * puis créer les deux déploiements (Déployer › Nouveau déploiement › Application Web).
 * Mise à jour : recoller le code, puis Gérer les déploiements › crayon › Nouvelle version,
 * pour CHACUN des deux déploiements (les adresses ne changent pas).
 */

const DOMAINE = 'elmarche.be';
const APP_URL = 'https://olivier7887.github.io/dossier-tp/';
const DUREE_CLE_JOURS = 180;

const ONGLETS = {
  profs: { nom: 'Profs', entetes: ['Adresse', 'Nom', 'Remarque'] },
  bloques: { nom: 'Bloqués', entetes: ['Adresse', 'Raison', 'Date'] },
  eleves: { nom: 'Élèves', entetes: ['Adresse', 'Prénom', 'Nom', 'Classe', 'Profil confirmé', 'Planche validée', 'Planche (données)', 'Validée par', 'Validée le', 'Première connexion', 'Dernière connexion'] },
  dossiers: { nom: 'Dossiers', entetes: ['Adresse', 'Exercice', 'Données', 'Mis à jour', 'Remis', 'Remis le', 'Photo (id Drive)', 'Photo (lien)', 'Correction', 'Correction publiée', 'Remises', 'Historique'] },
  catalogue: { nom: 'Catalogue', entetes: ['id', 'Catégorie', 'Description', 'Référence', 'Marque', 'Unité', 'Prix HTVA', 'Couleur', 'Visible', 'À vérifier'] },
};

/* =========================================================
   Installation (à exécuter une fois depuis l'éditeur)
   ========================================================= */
function installer() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  for (const k in ONGLETS) {
    const o = ONGLETS[k];
    let sh = ss.getSheetByName(o.nom);
    if (!sh) sh = ss.insertSheet(o.nom);
    // (ré)écrit la ligne d'en-têtes : sans risque pour les données, utile après une mise à jour
    sh.getRange(1, 1, 1, o.entetes.length).setValues([o.entetes]).setFontWeight('bold').setBackground('#e9edf1');
    sh.setFrozenRows(1);
  }
  const profs = ss.getSheetByName(ONGLETS.profs.nom);
  const moi = Session.getEffectiveUser().getEmail().toLowerCase();
  if (profs.getLastRow() < 2) profs.appendRow([moi, 'Lesenfants Olivier', 'Propriétaire']);
  const cat = ss.getSheetByName(ONGLETS.catalogue.nom);
  if (cat.getLastRow() < 2) {
    const rows = CATALOGUE_INITIAL;
    cat.getRange(2, 1, rows.length, rows[0].length).setValues(rows);
    cat.getRange(2, 7, rows.length, 1).setNumberFormat('0.00');
    cat.getRange(2, 9, rows.length, 2).insertCheckboxes();
    cat.setColumnWidth(3, 420);
  }
  const props = PropertiesService.getScriptProperties();
  if (!props.getProperty('SECRET')) props.setProperty('SECRET', Utilities.getUuid() + Utilities.getUuid());
  if (!props.getProperty('DOSSIER_PHOTOS')) props.setProperty('DOSSIER_PHOTOS', DriveApp.createFolder('Dossier TP – photos des élèves').getId());
  const premier = ss.getSheets()[0];
  if (/^(Feuille 1|Sheet1)$/.test(premier.getName()) && premier.getLastRow() === 0 && ss.getSheets().length > 1) ss.deleteSheet(premier);
  Logger.log('Installation terminée.');
}

/* =========================================================
   1. Connexion (déploiement réservé à elmarche.be)
   ========================================================= */
function doGet() {
  const email = String(Session.getActiveUser().getEmail() || '').toLowerCase();
  let corps;
  try {
    if (!email) throw new Error("Google n'a pas transmis votre adresse. Ouvrez ce lien en étant connecté avec votre compte de l'école.");
    const u = utilisateur_(email);
    const cle = signer_({ e: u.email, r: u.role, x: Date.now() + DUREE_CLE_JOURS * 864e5 });
    const n = nomDepuisEmail_(email);
    corps = `<h1>Bonjour ${html_(n.prenom)} !</h1>
      <p>Vous êtes connecté avec <b>${html_(email)}</b>${u.role === 'prof' ? ' (professeur)' : ''}.</p>
      <a class="btn" href="${APP_URL}#cle=${cle}" target="_top">Ouvrir Dossier TP</a>
      <p class="petit">Après ce clic, l'app garde votre connexion pendant ${DUREE_CLE_JOURS} jours, même sans internet.</p>`;
  } catch (e) {
    corps = `<h1>Connexion impossible</h1><p>${html_(e.message)}</p>${email ? `<p class="petit">Adresse transmise par Google : <b>${html_(email)}</b></p>` : ''}`;
  }
  return HtmlService.createHtmlOutput(`<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1">
    <style>body{font:16px/1.5 system-ui,sans-serif;background:#eceff2;color:#1b2129;display:grid;place-items:center;min-height:100vh;margin:0;padding:16px}
    main{background:#fff;border:1px solid #d3d9e0;border-radius:14px;padding:28px;max-width:440px}
    h1{margin:0 0 8px;font-size:1.6rem}.btn{display:inline-block;margin:14px 0;background:#8c1d2e;color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:600}
    .petit{font-size:.85rem;color:#5a6573}</style><main>${corps}</main>`).setTitle('Dossier TP – connexion');
}

/* =========================================================
   2. Données (déploiement « Tout le monde »), appelé par l'app
   ========================================================= */
function doPost(e) {
  let rep;
  try {
    const q = JSON.parse(e.postData.contents);
    const email = verifier_(q.cle);
    const u = utilisateur_(email);
    const fn = ACTIONS[q.a];
    if (!fn) throw new Error('Action inconnue.');
    rep = { ok: true, data: fn(u, q) };
  } catch (err) {
    rep = { ok: false, erreur: err.message, auth: !!err.auth };
  }
  return ContentService.createTextOutput(JSON.stringify(rep)).setMimeType(ContentService.MimeType.JSON);
}

const ACTIONS = {
  moi: (u) => moi_(u),
  profil: (u, q) => sauverProfil_(u, q.profil || {}),
  lireDossier: (u, q) => lireDossier_(u, String(q.ex)),
  sauverDossier: (u, q) => sauverDossier_(u, String(q.ex), String(q.data || '')),
  remettre: (u, q) => remettre_(u, String(q.ex), String(q.data || ''), q.photo || ''),
  profEleves: (u) => (prof_(u), profEleves_()),
  profDossier: (u, q) => (prof_(u), profDossier_(String(q.email).toLowerCase(), String(q.ex))),
  profPhoto: (u, q) => (prof_(u), profPhoto_(String(q.id))),
  profValiderPlanche: (u, q) => (prof_(u), profValiderPlanche_(u, String(q.email).toLowerCase(), q.lignes || [])),
  profRendre: (u, q) => (prof_(u), profRendre_(String(q.email).toLowerCase(), String(q.ex))),
  profCorriger: (u, q) => (prof_(u), profCorriger_(String(q.email).toLowerCase(), String(q.ex), q.correction, !!q.publier)),
  reprendre: (u, q) => reprendre_(u, String(q.ex)),
  catMaj: (u, q) => (prof_(u), catMaj_(q.item || {})),
  catSuppr: (u, q) => (prof_(u), catSuppr_(String(q.id))),
};

/* =========================================================
   Clé signée (HMAC-SHA256)
   ========================================================= */
function secret_() { return PropertiesService.getScriptProperties().getProperty('SECRET'); }
function b64_(s) { return Utilities.base64EncodeWebSafe(s).replace(/=+$/, ''); }
function signer_(payload) {
  const p = b64_(JSON.stringify(payload));
  return p + '.' + b64_(Utilities.computeHmacSha256Signature(p, secret_()));
}
function erreurAuth_(msg) { const e = new Error(msg); e.auth = true; return e; }
function verifier_(cle) {
  const parts = String(cle || '').split('.');
  if (parts.length !== 2) throw erreurAuth_('Connectez-vous avec votre compte de l’école.');
  if (b64_(Utilities.computeHmacSha256Signature(parts[0], secret_())) !== parts[1]) throw erreurAuth_('Connexion non valide : reconnectez-vous.');
  const pad = parts[0] + '==='.slice((parts[0].length + 3) % 4);
  const p = JSON.parse(Utilities.newBlob(Utilities.base64DecodeWebSafe(pad)).getDataAsString());
  if (!p.e || Date.now() > p.x) throw erreurAuth_('Votre connexion a expiré : reconnectez-vous.');
  return String(p.e).toLowerCase();
}

/* =========================================================
   Outils
   ========================================================= */
function onglet_(k) { return SpreadsheetApp.getActiveSpreadsheet().getSheetByName(ONGLETS[k].nom); }
function lignes_(k) {
  const sh = onglet_(k), n = sh.getLastRow();
  return n < 2 ? [] : sh.getRange(2, 1, n - 1, ONGLETS[k].entetes.length).getValues();
}
function cap_(s) { return String(s || '').split('-').map(p => p ? p.charAt(0).toUpperCase() + p.slice(1) : p).join('-'); }
function html_(s) { return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function verrou_(fn) { const l = LockService.getScriptLock(); l.waitLock(15000); try { return fn(); } finally { l.releaseLock(); } }
function json_(s, d) { try { return s ? JSON.parse(s) : d; } catch (e) { return d; } }
function nomDepuisEmail_(email) {
  const parts = email.split('@')[0].split('.');
  if (/^students?\d*$/.test(parts[parts.length - 1])) parts.pop();
  return { prenom: cap_(parts[0]), nom: parts.slice(1).map(cap_).join(' ') };
}
function utilisateur_(email) {
  if (email.split('@')[1] !== DOMAINE) throw erreurAuth_("Cette app est réservée aux comptes de l'école (…@" + DOMAINE + ').');
  if (lignes_('profs').some(r => String(r[0]).trim().toLowerCase() === email)) return { email, role: 'prof' };
  if (lignes_('bloques').some(r => String(r[0]).trim().toLowerCase() === email)) throw erreurAuth_('Votre accès à cette app a été bloqué. Parlez-en à votre professeur.');
  // Toute autre adresse de l'école est un élève (avec ou sans « .student »).
  // Un collègue absent de l'onglet Profs arrive donc en vue élève : il suffit de l'y ajouter.
  return { email, role: 'eleve' };
}
function prof_(u) { if (u.role !== 'prof') throw new Error('Réservé aux professeurs.'); }

/* =========================================================
   Élève
   ========================================================= */
function moi_(u) {
  const res = { email: u.email, role: u.role, catalogue: lireCatalogue_(u.role) };
  if (u.role === 'prof') { const n = nomDepuisEmail_(u.email); res.profil = { prenom: n.prenom, nom: n.nom, classe: '', confirme: true }; return res; }
  // (les élèves reçoivent aussi l'état de correction de chaque TP)
  return verrou_(() => {
    const sh = onglet_('eleves'), rows = lignes_('eleves'), now = new Date();
    let i = rows.findIndex(r => String(r[0]).toLowerCase() === u.email);
    if (i < 0) {
      const n = nomDepuisEmail_(u.email), row = [u.email, n.prenom, n.nom, '3Pélec', false, false, '', '', '', now, now];
      sh.appendRow(row); rows.push(row); i = rows.length - 1;
    } else sh.getRange(i + 2, 11).setValue(now);
    const r = rows[i];
    res.profil = { prenom: r[1], nom: r[2], classe: r[3], confirme: r[4] === true };
    res.planche = { validee: r[5] === true, lignes: json_(r[6], []) };
    res.resume = {};
    lignes_('dossiers').forEach(d => { if (String(d[0]).toLowerCase() === u.email) res.resume[d[1]] = { maj: d[3] ? new Date(d[3]).getTime() : 0, remis: d[4] === true, corrige: d[9] === true, remises: Number(d[10]) || 0 }; });
    return res;
  });
}
function sauverProfil_(u, p) {
  if (u.role !== 'eleve') return true;
  return verrou_(() => {
    const rows = lignes_('eleves'), i = rows.findIndex(r => String(r[0]).toLowerCase() === u.email);
    if (i < 0) throw new Error('Profil introuvable.');
    onglet_('eleves').getRange(i + 2, 2, 1, 4).setValues([[String(p.prenom || '').slice(0, 60), String(p.nom || '').slice(0, 60), String(p.classe || '').slice(0, 20), true]]);
    return true;
  });
}
function ligneDossier_(email, ex) {
  const rows = lignes_('dossiers');
  return { rows, i: rows.findIndex(r => String(r[0]).toLowerCase() === email && String(r[1]) === ex) };
}
function lireDossier_(u, ex) {
  const { rows, i } = ligneDossier_(u.email, ex);
  if (i < 0) return null;
  const r = rows[i], d = json_(r[2], {}) || {};
  d.remis = r[4] === true; d.photoId = r[6] || ''; d.remises = Number(r[10]) || 0;
  d.correction = r[9] === true ? json_(r[8], null) : null;
  d.historique = json_(r[11], []);
  return d;
}
const CHAMPS_SERVEUR = ['remis', 'photoId', 'remises', 'correction', 'historique'];
function nettoyer_(json) { const d = json_(json, {}) || {}; CHAMPS_SERVEUR.forEach(k => delete d[k]); return JSON.stringify(d); }
function sauverDossier_(u, ex, json) {
  if (u.role !== 'eleve') return true;
  json = nettoyer_(json);
  if (json.length > 49000) throw new Error('Dossier trop volumineux pour être enregistré.');
  return verrou_(() => {
    const sh = onglet_('dossiers'), { rows, i } = ligneDossier_(u.email, ex);
    if (i >= 0 && rows[i][4] === true) throw new Error('Ce dossier a déjà été remis : il ne peut plus être modifié.');
    if (i < 0) sh.appendRow([u.email, ex, json, new Date(), false, '', '', '', '', false, 0, '']);
    else sh.getRange(i + 2, 3, 1, 2).setValues([[json, new Date()]]);
    return true;
  });
}
function remettre_(u, ex, json, photo) {
  if (u.role !== 'eleve') throw new Error('Seuls les élèves remettent un dossier.');
  json = nettoyer_(json);
  const avant = ligneDossier_(u.email, ex);
  if (avant.i >= 0 && (Number(avant.rows[avant.i][10]) || 0) >= 2) throw new Error('Vous avez déjà remis ce dossier deux fois.');
  let photoId = '', lien = '';
  if (photo) {
    const m = String(photo).match(/^data:(image\/\w+);base64,(.+)$/);
    if (!m) throw new Error('Photo illisible.');
    const n = nomDepuisEmail_(u.email);
    const nomFichier = `${n.nom} ${n.prenom} – TP ${ex} – ${Utilities.formatDate(new Date(), 'Europe/Brussels', 'yyyy-MM-dd HH.mm')}.jpg`;
    const f = DriveApp.getFolderById(PropertiesService.getScriptProperties().getProperty('DOSSIER_PHOTOS')).createFile(Utilities.newBlob(Utilities.base64Decode(m[2]), m[1], nomFichier));
    photoId = f.getId(); lien = f.getUrl();
  }
  return verrou_(() => {
    const sh = onglet_('dossiers'), { rows, i } = ligneDossier_(u.email, ex), now = new Date();
    if (i < 0) { sh.appendRow([u.email, ex, json, now, true, now, photoId, lien, '', false, 1, '']); return { remis: true, photoId, remises: 1 }; }
    if (rows[i][4] === true) throw new Error('Ce dossier a déjà été remis.');
    const n = (Number(rows[i][10]) || 0) + 1;
    sh.getRange(i + 2, 3, 1, 6).setValues([[json, now, true, now, photoId || rows[i][6], lien || rows[i][7]]]);
    sh.getRange(i + 2, 11).setValue(n);
    return { remis: true, photoId, remises: n };
  });
}

function reprendre_(u, ex) {
  // seconde remise : l'élève rouvre son dossier après avoir lu la correction
  return verrou_(() => {
    const { rows, i } = ligneDossier_(u.email, ex);
    if (i < 0) throw new Error('Dossier introuvable.');
    const r = rows[i];
    if (r[4] !== true || r[9] !== true) throw new Error('Le dossier doit être remis et corrigé avant de pouvoir le reprendre.');
    if ((Number(r[10]) || 0) >= 2) throw new Error('La seconde remise a déjà été utilisée.');
    const hist = json_(r[11], []);
    hist.push({ correction: json_(r[8], null), le: new Date().getTime() });
    onglet_('dossiers').getRange(i + 2, 5, 1, 1).setValue(false);
    onglet_('dossiers').getRange(i + 2, 9, 1, 2).setValues([['', false]]);
    onglet_('dossiers').getRange(i + 2, 12).setValue(JSON.stringify(hist));
    return true;
  });
}

/* =========================================================
   Professeur
   ========================================================= */
function profEleves_() {
  const dossiers = lignes_('dossiers');
  return lignes_('eleves').map(r => {
    const email = String(r[0]).toLowerCase(), ex = {};
    dossiers.forEach(d => { if (String(d[0]).toLowerCase() === email) ex[d[1]] = { remis: d[4] === true, maj: d[3] ? new Date(d[3]).getTime() : 0, photo: !!d[6], corrige: d[9] === true, brouillon: !!d[8] && d[9] !== true, remises: Number(d[10]) || 0 }; });
    return { email, prenom: r[1], nom: r[2], classe: r[3], planche: r[5] === true, derniere: r[10] ? new Date(r[10]).getTime() : 0, ex };
  }).sort((a, b) => (String(a.classe) + ' ' + a.nom + ' ' + a.prenom).localeCompare(String(b.classe) + ' ' + b.nom + ' ' + b.prenom));
}
function profDossier_(email, ex) {
  const { rows, i } = ligneDossier_(email, ex);
  const el = lignes_('eleves').find(r => String(r[0]).toLowerCase() === email);
  return {
    data: i >= 0 ? json_(rows[i][2], null) : null,
    remis: i >= 0 && rows[i][4] === true,
    photoId: i >= 0 ? rows[i][6] : '',
    correction: i >= 0 ? json_(rows[i][8], null) : null,
    publiee: i >= 0 && rows[i][9] === true,
    remises: i >= 0 ? Number(rows[i][10]) || 0 : 0,
    historique: i >= 0 ? json_(rows[i][11], []) : [],
    profil: el ? { prenom: el[1], nom: el[2], classe: el[3] } : null,
    planche: el ? { validee: el[5] === true, lignes: json_(el[6], []) } : { validee: false, lignes: [] },
  };
}
function profPhoto_(id) {
  const b = DriveApp.getFileById(id).getBlob();
  return 'data:' + b.getContentType() + ';base64,' + Utilities.base64Encode(b.getBytes());
}
function profValiderPlanche_(u, email, lignes) {
  return verrou_(() => {
    const rows = lignes_('eleves'), i = rows.findIndex(r => String(r[0]).toLowerCase() === email);
    if (i < 0) throw new Error('Élève introuvable.');
    onglet_('eleves').getRange(i + 2, 6, 1, 4).setValues([[true, JSON.stringify(lignes), u.email, new Date()]]);
    return true;
  });
}
function profCorriger_(email, ex, correction, publier) {
  return verrou_(() => {
    const { rows, i } = ligneDossier_(email, ex);
    if (i < 0) throw new Error('Dossier introuvable.');
    if (publier && rows[i][4] !== true) throw new Error("Le dossier n'est pas remis : la correction ne peut pas encore être publiée.");
    const json = JSON.stringify(correction || {});
    if (json.length > 49000) throw new Error('Correction trop volumineuse.');
    onglet_('dossiers').getRange(i + 2, 9, 1, 2).setValues([[json, !!publier]]);
    return true;
  });
}
function profRendre_(email, ex) {
  return verrou_(() => {
    const { i } = ligneDossier_(email, ex);
    if (i < 0) throw new Error('Dossier introuvable.');
    onglet_('dossiers').getRange(i + 2, 5).setValue(false);
    return true;
  });
}

/* =========================================================
   Catalogue
   ========================================================= */
function lireCatalogue_(role) {
  return lignes_('catalogue').filter(r => r[0] !== '').map(r => ({
    id: String(r[0]), cat: String(r[1]), des: String(r[2]), ref: String(r[3]), marque: String(r[4]), unite: String(r[5] || 'pc'),
    prix: Number(r[6]) || 0, couleur: r[7] ? String(r[7]) : null, visible: r[8] !== false, verif: r[9] === true,
  })).filter(it => role === 'prof' || it.visible);
}
function catMaj_(it) {
  return verrou_(() => {
    const sh = onglet_('catalogue'), rows = lignes_('catalogue');
    const vals = [String(it.id), it.cat || '', it.des || '', it.ref || '', it.marque || '', it.unite || 'pc', Number(it.prix) || 0, it.couleur || '', it.visible !== false, it.verif === true];
    const i = rows.findIndex(r => String(r[0]) === String(it.id));
    if (i < 0) {
      sh.appendRow(vals);
      const n = sh.getLastRow();
      sh.getRange(n, 9, 1, 2).insertCheckboxes().setValues([[vals[8], vals[9]]]);
      sh.getRange(n, 7).setNumberFormat('0.00');
    } else sh.getRange(i + 2, 1, 1, vals.length).setValues([vals]);
    return true;
  });
}
function catSuppr_(id) {
  return verrou_(() => {
    const rows = lignes_('catalogue'), i = rows.findIndex(r => String(r[0]) === id);
    if (i >= 0) onglet_('catalogue').deleteRow(i + 2);
    return true;
  });
}

/* =========================================================
   Catalogue de départ (copié dans l'onglet Catalogue par « installer »)
   Prix Niko : liste de prix brute Niko Belgique du 01/06/2024.
   ========================================================= */
const CATALOGUE_INITIAL = [["170-01100","Socles (mécanismes)","Socle interrupteur unipolaire (sch 1), bornes à vis, griffes — Niko","170-01100","Niko","pc",4.78,"",true,false],["170-01200","Socles (mécanismes)","Socle interrupteur bipolaire (sch 2), bornes à vis, griffes — Niko","170-01200","Niko","pc",8.92,"",true,false],["170-01500","Socles (mécanismes)","Socle interrupteur double allumage (sch 5), bornes à vis, griffes — Niko","170-01500","Niko","pc",7.28,"",true,false],["170-01600","Socles (mécanismes)","Socle interrupteur va-et-vient (sch 6), bornes à vis, griffes — Niko","170-01600","Niko","pc",5.22,"",true,false],["170-01700","Socles (mécanismes)","Socle interrupteur permutateur (sch 7), bornes à vis, griffes — Niko","170-01700","Niko","pc",10.58,"",true,false],["170-02600","Socles (mécanismes)","Socle interrupteur va-et-vient double (sch 6+6), bornes à vis, griffes — Niko","170-02600","Niko","pc",11.95,"",true,false],["170-33100","Socles (mécanismes)","Socle prise 2P+T (28,5 mm), obturateurs, bornes à vis, griffes — Niko","170-33100","Niko","pc",6.77,"",true,false],["170-32100","Socles (mécanismes)","Socle prise 2P+T (21 mm), obturateurs, bornes à vis, griffes — Niko","170-32100","Niko","pc",6.77,"",true,false],["100-61100","Appareils complets","Interrupteur unipolaire complet (sch 1), bornes à vis — Niko Original crème","100-61100","Niko","pc",8.19,"crème",true,false],["101-61100","Appareils complets","Interrupteur unipolaire complet (sch 1), bornes à vis — Niko Original blanc","101-61100","Niko","pc",7.67,"blanc",true,false],["100-61200","Appareils complets","Interrupteur bipolaire complet (sch 2), bornes à vis — Niko Original crème","100-61200","Niko","pc",12.33,"crème",true,false],["101-61200","Appareils complets","Interrupteur bipolaire complet (sch 2), bornes à vis — Niko Original blanc","101-61200","Niko","pc",11.81,"blanc",true,false],["100-61500","Appareils complets","Interrupteur double allumage complet (sch 5), bornes à vis — Niko Original crème","100-61500","Niko","pc",11.74,"crème",true,false],["101-61500","Appareils complets","Interrupteur double allumage complet (sch 5), bornes à vis — Niko Original blanc","101-61500","Niko","pc",11.22,"blanc",true,false],["100-61600","Appareils complets","Interrupteur va-et-vient complet (sch 6), bornes à vis — Niko Original crème","100-61600","Niko","pc",8.64,"crème",true,false],["101-61600","Appareils complets","Interrupteur va-et-vient complet (sch 6), bornes à vis — Niko Original blanc","101-61600","Niko","pc",8.12,"blanc",true,false],["100-61700","Appareils complets","Interrupteur permutateur complet (sch 7), bornes à vis — Niko Original crème","100-61700","Niko","pc",14,"crème",true,false],["101-61700","Appareils complets","Interrupteur permutateur complet (sch 7), bornes à vis — Niko Original blanc","101-61700","Niko","pc",13.48,"blanc",true,false],["100-62600","Appareils complets","Interrupteur va-et-vient double complet (sch 6+6), bornes à vis — Niko Original crème","100-62600","Niko","pc",16.4,"crème",true,false],["101-62600","Appareils complets","Interrupteur va-et-vient double complet (sch 6+6), bornes à vis — Niko Original blanc","101-62600","Niko","pc",15.88,"blanc",true,false],["100-66600","Appareils complets","Prise 2P+T complète (28,5 mm), obturateurs, bornes à vis — Niko Original crème","100-66600","Niko","pc",9.59,"crème",true,false],["101-66600","Appareils complets","Prise 2P+T complète (28,5 mm), obturateurs, bornes à vis — Niko Original blanc","101-66600","Niko","pc",9.07,"blanc",true,false],["100-66100","Appareils complets","Prise 2P+T complète (21 mm), obturateurs, bornes à vis — Niko Original crème","100-66100","Niko","pc",9.59,"crème",true,false],["101-66100","Appareils complets","Prise 2P+T complète (21 mm), obturateurs, bornes à vis — Niko Original blanc","101-66100","Niko","pc",9.07,"blanc",true,false],["100-61105","Sets de finition","Set de finition, touche simple (sch 1, 2, 6, 7) — Niko Original crème","100-61105","Niko","pc",3.43,"crème",true,false],["101-61105","Sets de finition","Set de finition, touche simple (sch 1, 2, 6, 7) — Niko Original blanc","101-61105","Niko","pc",2.91,"blanc",true,false],["102-61105","Sets de finition","Set de finition, touche simple (sch 1, 2, 6, 7) — Niko Original gris clair","102-61105","Niko","pc",4.1,"gris clair",true,false],["100-61505","Sets de finition","Set de finition, touche double (sch 5, 6+6) — Niko Original crème","100-61505","Niko","pc",4.46,"crème",true,false],["101-61505","Sets de finition","Set de finition, touche double (sch 5, 6+6) — Niko Original blanc","101-61505","Niko","pc",3.94,"blanc",true,false],["102-61505","Sets de finition","Set de finition, touche double (sch 5, 6+6) — Niko Original gris clair","102-61505","Niko","pc",6.7,"gris clair",true,false],["100-66601","Sets de finition","Set de finition prise avec terre (28,5 mm) — Niko Original crème","100-66601","Niko","pc",2.85,"crème",true,false],["101-66601","Sets de finition","Set de finition prise avec terre (28,5 mm) — Niko Original blanc","101-66601","Niko","pc",2.33,"blanc",true,false],["102-66601","Sets de finition","Set de finition prise avec terre (28,5 mm) — Niko Original gris clair","102-66601","Niko","pc",4.49,"gris clair",true,false],["100-66101","Sets de finition","Set de finition prise avec terre (21 mm) — Niko Original crème","100-66101","Niko","pc",2.85,"crème",true,false],["101-66101","Sets de finition","Set de finition prise avec terre (21 mm) — Niko Original blanc","101-66101","Niko","pc",2.33,"blanc",true,false],["102-66101","Sets de finition","Set de finition prise avec terre (21 mm) — Niko Original gris clair","102-66101","Niko","pc",4.49,"gris clair",true,false],["100-77100","Boîtiers et plaques","Boîte en saillie simple — Niko Original crème","100-77100","Niko","pc",6.94,"crème",true,false],["101-77100","Boîtiers et plaques","Boîte en saillie simple — Niko Original blanc","101-77100","Niko","pc",5.88,"blanc",true,false],["102-77100","Boîtiers et plaques","Boîte en saillie simple — Niko Original gris clair","102-77100","Niko","pc",7.65,"gris clair",true,false],["100-77500","Boîtiers et plaques","Boîte en saillie double (158 × 87 mm) — Niko Original crème","100-77500","Niko","pc",9.74,"crème",true,false],["101-77500","Boîtiers et plaques","Boîte en saillie double (158 × 87 mm) — Niko Original blanc","101-77500","Niko","pc",8.25,"blanc",true,false],["102-77500","Boîtiers et plaques","Boîte en saillie double (158 × 87 mm) — Niko Original gris clair","102-77500","Niko","pc",9.4,"gris clair",true,false],["100-76100","Boîtiers et plaques","Plaque de recouvrement simple (83 × 83 mm) — Niko Original crème","100-76100","Niko","pc",2.53,"crème",true,false],["101-76100","Boîtiers et plaques","Plaque de recouvrement simple (83 × 83 mm) — Niko Original blanc","101-76100","Niko","pc",2.14,"blanc",true,false],["102-76100","Boîtiers et plaques","Plaque de recouvrement simple (83 × 83 mm) — Niko Original gris clair","102-76100","Niko","pc",4.1,"gris clair",true,false],["100-76800","Boîtiers et plaques","Plaque double, entraxe 71 mm (83 × 154 mm) — Niko Original crème","100-76800","Niko","pc",5,"crème",true,false],["101-76800","Boîtiers et plaques","Plaque double, entraxe 71 mm (83 × 154 mm) — Niko Original blanc","101-76800","Niko","pc",4.24,"blanc",true,false],["102-76800","Boîtiers et plaques","Plaque double, entraxe 71 mm (83 × 154 mm) — Niko Original gris clair","102-76800","Niko","pc",8.21,"gris clair",true,false],["100-76700","Boîtiers et plaques","Plaque triple, entraxe 71 mm (83 × 225 mm) — Niko Original crème","100-76700","Niko","pc",8.24,"crème",true,false],["101-76700","Boîtiers et plaques","Plaque triple, entraxe 71 mm (83 × 225 mm) — Niko Original blanc","101-76700","Niko","pc",6.98,"blanc",true,false],["102-76700","Boîtiers et plaques","Plaque triple, entraxe 71 mm (83 × 225 mm) — Niko Original gris clair","102-76700","Niko","pc",13.54,"gris clair",true,false],["100-76200","Boîtiers et plaques","Plaque double, entraxe 60 mm (83 × 143 mm) — Niko Original crème","100-76200","Niko","pc",5,"crème",true,false],["101-76200","Boîtiers et plaques","Plaque double, entraxe 60 mm (83 × 143 mm) — Niko Original blanc","101-76200","Niko","pc",4.24,"blanc",true,false],["102-76200","Boîtiers et plaques","Plaque double, entraxe 60 mm (83 × 143 mm) — Niko Original gris clair","102-76200","Niko","pc",8.21,"gris clair",true,false],["100-76300","Boîtiers et plaques","Plaque triple, entraxe 60 mm (83 × 203 mm) — Niko Original crème","100-76300","Niko","pc",8.24,"crème",true,false],["101-76300","Boîtiers et plaques","Plaque triple, entraxe 60 mm (83 × 203 mm) — Niko Original blanc","101-76300","Niko","pc",6.98,"blanc",true,false],["102-76300","Boîtiers et plaques","Plaque triple, entraxe 60 mm (83 × 203 mm) — Niko Original gris clair","102-76300","Niko","pc",13.54,"gris clair",true,false],["11-865","Boîtiers et plaques","Embout de tube M16 pour boîte en saillie — Niko crème","11-865","Niko","pc",1.77,"crème",true,false],["31-865","Boîtiers et plaques","Embout de tube M16 pour boîte en saillie — Niko blanc","31-865","Niko","pc",1.77,"blanc",true,false],["11-866","Boîtiers et plaques","Embout de tube M20 pour boîte en saillie — Niko crème","11-866","Niko","pc",1.77,"crème",true,false],["31-866","Boîtiers et plaques","Embout de tube M20 pour boîte en saillie — Niko blanc","31-866","Niko","pc",1.77,"blanc",true,false],["ISR1","Planche et canalisations","Rosace en bois 95 × 95 mm (point lumineux)","ISR1","","pc",0.55,"",true,true],["BD75","Planche et canalisations","Boîte de dérivation 75 × 75 mm, 3 opercules par côté","030/30496-024","Vynckier","pc",1.83,"",true,true],["LLG16","Planche et canalisations","Tube PVC gris rigide Ø 16 mm (5/8\")","LLG5","","m",0.2,"",true,true],["LLG20","Planche et canalisations","Tube PVC gris rigide Ø 20 mm (3/4\")","LLG34","","m",0.22,"",true,true],["PC145-16","Planche et canalisations","Entrée lisse (embout) Ø 16 mm","PC-145/01","","pc",0.59,"",true,true],["PC145-20","Planche et canalisations","Entrée lisse (embout) Ø 20 mm","PC-145/02","","pc",0.68,"",true,true],["RDA16","Planche et canalisations","Attache simple à 2 vis Ø 16 mm","RDA5","","pc",0.93,"",true,true],["RDA20","Planche et canalisations","Attache simple à 2 vis Ø 20 mm","RDA34","","pc",1.25,"",true,true],["PGL16","Planche et canalisations","Attache PGL simple Ø 16 mm","115","","pc",0.07,"",true,true],["PGL20","Planche et canalisations","Attache PGL simple Ø 20 mm","118","","pc",0.08,"",true,true],["VIS4530","Planche et canalisations","Vis à bois 4,5 × 30 (boîte de 50)","7153045","","boîte",4.35,"",true,true],["VIS3015","Planche et canalisations","Vis à bois 3,0 × 15 (boîte de 50)","7151530","","boîte",3.25,"",true,true],["W221-412","Connexions","Borne à levier 2 conducteurs 0,2–4 mm²","221-412","Wago","pc",0.4,"",true,true],["W221-413","Connexions","Borne à levier 3 conducteurs 0,2–4 mm²","221-413","Wago","pc",0.45,"",true,true],["W221-415","Connexions","Borne à levier 5 conducteurs 0,2–4 mm²","221-415","Wago","pc",0.6,"",true,true],["HP760SV","Éclairage","Douille E27 (socket)","HP760SV","","pc",0.62,"",true,true],["LEDE27","Éclairage","Ampoule LED E27 806 lm, 2700 K","LED-E27-806","","pc",3.5,"",true,true],["H07VU-1,5-bleu","Fils et câbles","Fil H07V-U 1,5 mm² bleu","H07V-U 1,5","","m",0.07,"bleu",true,true],["H07VU-1,5-vert-jaune","Fils et câbles","Fil H07V-U 1,5 mm² vert-jaune","H07V-U 1,5","","m",0.07,"vert-jaune",true,true],["H07VU-1,5-brun","Fils et câbles","Fil H07V-U 1,5 mm² brun","H07V-U 1,5","","m",0.07,"brun",true,true],["H07VU-1,5-noir","Fils et câbles","Fil H07V-U 1,5 mm² noir","H07V-U 1,5","","m",0.07,"noir",true,true],["H07VU-1,5-gris","Fils et câbles","Fil H07V-U 1,5 mm² gris","H07V-U 1,5","","m",0.07,"gris",true,true],["H07VU-1,5-rouge","Fils et câbles","Fil H07V-U 1,5 mm² rouge","H07V-U 1,5","","m",0.07,"rouge",true,true],["H07VU-2,5-bleu","Fils et câbles","Fil H07V-U 2,5 mm² bleu","H07V-U 2,5","","m",0.12,"bleu",true,true],["H07VU-2,5-vert-jaune","Fils et câbles","Fil H07V-U 2,5 mm² vert-jaune","H07V-U 2,5","","m",0.12,"vert-jaune",true,true],["H07VU-2,5-brun","Fils et câbles","Fil H07V-U 2,5 mm² brun","H07V-U 2,5","","m",0.12,"brun",true,true],["H07VU-2,5-noir","Fils et câbles","Fil H07V-U 2,5 mm² noir","H07V-U 2,5","","m",0.12,"noir",true,true],["H07VU-2,5-gris","Fils et câbles","Fil H07V-U 2,5 mm² gris","H07V-U 2,5","","m",0.12,"gris",true,true],["H07VU-2,5-rouge","Fils et câbles","Fil H07V-U 2,5 mm² rouge","H07V-U 2,5","","m",0.12,"rouge",true,true],["XVB3G15","Fils et câbles","Câble XVB-F2 3G1,5 mm²","XVB-F2 3G1,5","","m",0.5,"",true,true],["XVB3G25","Fils et câbles","Câble XVB-F2 3G2,5 mm²","XVB-F2 3G2,5","","m",0.57,"",true,true],["DJ2P10","Protection","Disjoncteur bipolaire 10 A","060 73","Legrand","pc",4.61,"",true,true],["DJ2P16","Protection","Disjoncteur bipolaire 16 A","060 75","Legrand","pc",4.61,"",true,true],["DJ2P20","Protection","Disjoncteur bipolaire 20 A","060 76","Legrand","pc",4.61,"",true,true]];
