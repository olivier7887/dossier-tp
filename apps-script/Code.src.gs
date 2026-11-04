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
  dossiers: { nom: 'Dossiers', entetes: ['Adresse', 'Exercice', 'Données', 'Mis à jour', 'Remis', 'Remis le', 'Photo (id Drive)', 'Photo (lien)'] },
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
    if (sh.getLastRow() === 0) {
      sh.getRange(1, 1, 1, o.entetes.length).setValues([o.entetes]).setFontWeight('bold').setBackground('#e9edf1');
      sh.setFrozenRows(1);
    }
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
    corps = `<h1>Connexion impossible</h1><p>${html_(e.message)}</p>`;
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
  if (parts[parts.length - 1] === 'student') parts.pop();
  return { prenom: cap_(parts[0]), nom: parts.slice(1).map(cap_).join(' ') };
}
function utilisateur_(email) {
  if (email.split('@')[1] !== DOMAINE) throw erreurAuth_("Cette app est réservée aux comptes de l'école (…@" + DOMAINE + ').');
  if (lignes_('profs').some(r => String(r[0]).trim().toLowerCase() === email)) return { email, role: 'prof' };
  if (lignes_('bloques').some(r => String(r[0]).trim().toLowerCase() === email)) throw erreurAuth_('Votre accès à cette app a été bloqué. Parlez-en à votre professeur.');
  if (/\.student@/.test(email)) return { email, role: 'eleve' };
  throw erreurAuth_("Votre adresse n'est pas dans la liste des professeurs. Demandez à M. Lesenfants de vous ajouter.");
}
function prof_(u) { if (u.role !== 'prof') throw new Error('Réservé aux professeurs.'); }

/* =========================================================
   Élève
   ========================================================= */
function moi_(u) {
  const res = { email: u.email, role: u.role, catalogue: lireCatalogue_(u.role) };
  if (u.role === 'prof') { const n = nomDepuisEmail_(u.email); res.profil = { prenom: n.prenom, nom: n.nom, classe: '', confirme: true }; return res; }
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
    lignes_('dossiers').forEach(d => { if (String(d[0]).toLowerCase() === u.email) res.resume[d[1]] = { maj: d[3] ? new Date(d[3]).getTime() : 0, remis: d[4] === true }; });
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
  const d = json_(rows[i][2], {}) || {};
  d.remis = rows[i][4] === true; d.photoId = rows[i][6] || '';
  return d;
}
function sauverDossier_(u, ex, json) {
  if (u.role !== 'eleve') return true;
  if (json.length > 49000) throw new Error('Dossier trop volumineux pour être enregistré.');
  return verrou_(() => {
    const sh = onglet_('dossiers'), { rows, i } = ligneDossier_(u.email, ex);
    if (i >= 0 && rows[i][4] === true) throw new Error('Ce dossier a déjà été remis : il ne peut plus être modifié.');
    if (i < 0) sh.appendRow([u.email, ex, json, new Date(), false, '', '', '']);
    else sh.getRange(i + 2, 3, 1, 2).setValues([[json, new Date()]]);
    return true;
  });
}
function remettre_(u, ex, json, photo) {
  if (u.role !== 'eleve') throw new Error('Seuls les élèves remettent un dossier.');
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
    if (i < 0) sh.appendRow([u.email, ex, json, now, true, now, photoId, lien]);
    else {
      if (rows[i][4] === true) throw new Error('Ce dossier a déjà été remis.');
      sh.getRange(i + 2, 3, 1, 6).setValues([[json, now, true, now, photoId || rows[i][6], lien || rows[i][7]]]);
    }
    return { remis: true, photoId };
  });
}

/* =========================================================
   Professeur
   ========================================================= */
function profEleves_() {
  const dossiers = lignes_('dossiers');
  return lignes_('eleves').map(r => {
    const email = String(r[0]).toLowerCase(), ex = {};
    dossiers.forEach(d => { if (String(d[0]).toLowerCase() === email) ex[d[1]] = { remis: d[4] === true, maj: d[3] ? new Date(d[3]).getTime() : 0, photo: !!d[6] }; });
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
const CATALOGUE_INITIAL = __CATALOGUE__;
