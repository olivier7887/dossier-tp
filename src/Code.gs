/**
 * Dossier TP — Institut Saint-Roch (Marche-en-Famenne)
 * Script du Google Sheet « Dossier TP – données ».
 * Créé par Lesenfants Olivier.
 *
 * Installation (une seule fois) :
 *   1. Coller ce fichier dans Extensions › Apps Script (fichier Code.gs).
 *   2. Ajouter un fichier HTML nommé exactement « Index » et y coller Index.html.
 *   3. Choisir la fonction « installer » puis cliquer sur Exécuter, accepter les autorisations.
 *   4. Déployer › Nouveau déploiement › Application Web :
 *        Exécuter en tant que : Moi
 *        Qui a accès : Tous les utilisateurs de elmarche.be (votre domaine)
 *
 * Mise à jour : recoller les fichiers, puis Déployer › Gérer les déploiements ›
 *   crayon › Version : Nouvelle version › Déployer (l'adresse reste la même).
 */

const DOMAINE = 'elmarche.be';
const ONGLETS = {
  profs: { nom: 'Profs', entetes: ['Adresse', 'Nom', 'Remarque'] },
  bloques: { nom: 'Bloqués', entetes: ['Adresse', 'Raison', 'Date'] },
  eleves: { nom: 'Élèves', entetes: ['Adresse', 'Prénom', 'Nom', 'Classe', 'Profil confirmé', 'Planche validée', 'Planche (données)', 'Validée par', 'Validée le', 'Première connexion', 'Dernière connexion'] },
  dossiers: { nom: 'Dossiers', entetes: ['Adresse', 'Exercice', 'Données', 'Mis à jour', 'Remis', 'Remis le', 'Photo (id Drive)', 'Photo (lien)'] },
  catalogue: { nom: 'Catalogue', entetes: ['id', 'Catégorie', 'Description', 'Référence', 'Marque', 'Unité', 'Prix HTVA', 'Couleur', 'Visible', 'À vérifier'] },
};

/* =========================================================
   Page web
   ========================================================= */
function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('Dossier TP')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/* =========================================================
   Installation
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
  // premier prof : le propriétaire du script
  const profs = ss.getSheetByName(ONGLETS.profs.nom);
  const moi = Session.getEffectiveUser().getEmail().toLowerCase();
  if (profs.getLastRow() < 2) profs.appendRow([moi, 'Lesenfants Olivier', 'Propriétaire']);
  // catalogue initial
  const cat = ss.getSheetByName(ONGLETS.catalogue.nom);
  if (cat.getLastRow() < 2) {
    const rows = CATALOGUE_INITIAL;
    cat.getRange(2, 1, rows.length, rows[0].length).setValues(rows);
    cat.getRange(2, 7, rows.length, 1).setNumberFormat('0.00');
    cat.getRange(2, 9, rows.length, 2).insertCheckboxes();
    cat.setColumnWidth(3, 420);
  }
  // dossier Drive des photos
  const props = PropertiesService.getScriptProperties();
  if (!props.getProperty('DOSSIER_PHOTOS')) {
    const f = DriveApp.createFolder('Dossier TP – photos des élèves');
    props.setProperty('DOSSIER_PHOTOS', f.getId());
  }
  const sh1 = ss.getSheets()[0];
  if (sh1.getName() === 'Feuille 1' || sh1.getName() === 'Sheet1') { if (sh1.getLastRow() === 0) ss.deleteSheet(sh1); }
  return 'Installation terminée.';
}

/* =========================================================
   Outils
   ========================================================= */
function onglet_(k) { return SpreadsheetApp.getActiveSpreadsheet().getSheetByName(ONGLETS[k].nom); }
function lignes_(k) {
  const sh = onglet_(k), n = sh.getLastRow();
  if (n < 2) return [];
  return sh.getRange(2, 1, n - 1, ONGLETS[k].entetes.length).getValues();
}
function cap_(s) { return String(s || '').split('-').map(p => p ? p.charAt(0).toUpperCase() + p.slice(1) : p).join('-'); }
function verrou_(fn) {
  const l = LockService.getScriptLock();
  l.waitLock(15000);
  try { return fn(); } finally { l.releaseLock(); }
}
function utilisateur_() {
  const email = String(Session.getActiveUser().getEmail() || '').toLowerCase();
  if (!email) throw new Error("Google n'a pas transmis votre adresse. Connectez-vous avec votre compte de l'école (…@" + DOMAINE + ').');
  if (email.split('@')[1] !== DOMAINE) throw new Error("Cette app est réservée aux comptes de l'école (…@" + DOMAINE + ').');
  const profs = lignes_('profs').map(r => String(r[0]).trim().toLowerCase());
  if (profs.indexOf(email) >= 0) return { email, role: 'prof' };
  const bloques = lignes_('bloques').map(r => String(r[0]).trim().toLowerCase());
  if (bloques.indexOf(email) >= 0) throw new Error("Votre accès à cette app a été bloqué. Parlez-en à votre professeur.");
  if (/\.student@/.test(email)) return { email, role: 'eleve' };
  throw new Error("Votre adresse n'est pas dans la liste des professeurs. Demandez à M. Lesenfants de vous ajouter.");
}
function exigerProf_() { const u = utilisateur_(); if (u.role !== 'prof') throw new Error('Réservé aux professeurs.'); return u; }
function nomDepuisEmail_(email) {
  const parts = email.split('@')[0].split('.');
  if (parts[parts.length - 1] === 'student') parts.pop();
  return { prenom: cap_(parts[0]), nom: parts.slice(1).map(cap_).join(' ') };
}
function json_(s, d) { try { return s ? JSON.parse(s) : d; } catch (e) { return d; } }

/* =========================================================
   API appelée par la page (google.script.run)
   ========================================================= */
function moi() {
  const u = utilisateur_();
  const res = { email: u.email, role: u.role, catalogue: lireCatalogue_(u.role) };
  if (u.role === 'prof') {
    const n = nomDepuisEmail_(u.email);
    res.profil = { prenom: n.prenom, nom: n.nom, classe: '', confirme: true };
    return res;
  }
  return verrou_(() => {
    const sh = onglet_('eleves'), rows = lignes_('eleves');
    let i = rows.findIndex(r => String(r[0]).toLowerCase() === u.email);
    const now = new Date();
    if (i < 0) {
      const n = nomDepuisEmail_(u.email);
      sh.appendRow([u.email, n.prenom, n.nom, '3Pélec', false, false, '', '', '', now, now]);
      rows.push([u.email, n.prenom, n.nom, '3Pélec', false, false, '', '', '', now, now]);
      i = rows.length - 1;
    } else sh.getRange(i + 2, 11).setValue(now);
    const r = rows[i];
    res.profil = { prenom: r[1], nom: r[2], classe: r[3], confirme: r[4] === true };
    res.planche = { validee: r[5] === true, lignes: json_(r[6], []) };
    res.resume = resumeDossiers_(u.email);
    return res;
  });
}
function resumeDossiers_(email) {
  const out = {};
  lignes_('dossiers').forEach(r => { if (String(r[0]).toLowerCase() === email) out[r[1]] = { maj: r[3] ? new Date(r[3]).toISOString() : '', remis: r[4] === true, photo: !!r[6] }; });
  return out;
}
function sauverProfil(p) {
  const u = utilisateur_();
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
function lireDossier(ex) {
  const u = utilisateur_();
  const { rows, i } = ligneDossier_(u.email, String(ex));
  if (i < 0) return null;
  const d = json_(rows[i][2], null);
  if (d) { d.remis = rows[i][4] === true; d.photoId = rows[i][6] || ''; }
  return d;
}
function sauverDossier(ex, json) {
  const u = utilisateur_();
  if (u.role !== 'eleve') return true;
  if (String(json).length > 49000) throw new Error('Dossier trop volumineux pour être enregistré (schéma trop chargé ?).');
  return verrou_(() => {
    const sh = onglet_('dossiers'), { rows, i } = ligneDossier_(u.email, String(ex));
    if (i >= 0 && rows[i][4] === true) throw new Error('Ce dossier a déjà été remis : il ne peut plus être modifié.');
    if (i < 0) sh.appendRow([u.email, String(ex), json, new Date(), false, '', '', '']);
    else sh.getRange(i + 2, 3, 1, 2).setValues([[json, new Date()]]);
    return true;
  });
}
function remettre(ex, json, photoDataUrl) {
  const u = utilisateur_();
  if (u.role !== 'eleve') throw new Error('Seuls les élèves remettent un dossier.');
  let photoId = '', lien = '';
  if (photoDataUrl) {
    const m = String(photoDataUrl).match(/^data:(image\/\w+);base64,(.+)$/);
    if (!m) throw new Error('Photo illisible.');
    const n = nomDepuisEmail_(u.email);
    const blob = Utilities.newBlob(Utilities.base64Decode(m[2]), m[1], `${n.nom} ${n.prenom} – TP ${ex} – ${Utilities.formatDate(new Date(), 'Europe/Brussels', 'yyyy-MM-dd HH.mm')}.jpg`);
    const dossier = DriveApp.getFolderById(PropertiesService.getScriptProperties().getProperty('DOSSIER_PHOTOS'));
    const f = dossier.createFile(blob);
    photoId = f.getId(); lien = f.getUrl();
  }
  return verrou_(() => {
    const sh = onglet_('dossiers'), { rows, i } = ligneDossier_(u.email, String(ex));
    const now = new Date();
    if (i < 0) sh.appendRow([u.email, String(ex), json, now, true, now, photoId, lien]);
    else {
      if (rows[i][4] === true) throw new Error('Ce dossier a déjà été remis.');
      sh.getRange(i + 2, 3, 1, 6).setValues([[json, now, true, now, photoId || rows[i][6], lien || rows[i][7]]]);
    }
    return { remis: true, photoId };
  });
}

/* ---------- professeur ---------- */
function profEleves() {
  exigerProf_();
  const dossiers = lignes_('dossiers');
  return lignes_('eleves').map(r => {
    const email = String(r[0]).toLowerCase(), ex = {};
    dossiers.forEach(d => { if (String(d[0]).toLowerCase() === email) ex[d[1]] = { remis: d[4] === true, maj: d[3] ? new Date(d[3]).toISOString() : '', photo: !!d[6] }; });
    return { email, prenom: r[1], nom: r[2], classe: r[3], planche: r[5] === true, derniere: r[10] ? new Date(r[10]).toISOString() : '', ex };
  }).sort((a, b) => (String(a.classe) + a.nom + a.prenom).localeCompare(String(b.classe) + b.nom + b.prenom));
}
function profDossier(email, ex) {
  exigerProf_();
  email = String(email).toLowerCase();
  const { rows, i } = ligneDossier_(email, String(ex));
  const el = lignes_('eleves').find(r => String(r[0]).toLowerCase() === email);
  return {
    data: i >= 0 ? json_(rows[i][2], null) : null,
    remis: i >= 0 && rows[i][4] === true,
    photoId: i >= 0 ? rows[i][6] : '',
    profil: el ? { prenom: el[1], nom: el[2], classe: el[3] } : null,
    planche: el ? { validee: el[5] === true, lignes: json_(el[6], []) } : { validee: false, lignes: [] },
  };
}
function profPhoto(fileId) {
  exigerProf_();
  const b = DriveApp.getFileById(fileId).getBlob();
  return 'data:' + b.getContentType() + ';base64,' + Utilities.base64Encode(b.getBytes());
}
function profValiderPlanche(email, lignes) {
  const u = exigerProf_();
  email = String(email).toLowerCase();
  return verrou_(() => {
    const rows = lignes_('eleves'), i = rows.findIndex(r => String(r[0]).toLowerCase() === email);
    if (i < 0) throw new Error('Élève introuvable.');
    onglet_('eleves').getRange(i + 2, 6, 1, 4).setValues([[true, JSON.stringify(lignes || []), u.email, new Date()]]);
    return true;
  });
}
function profRendre(email, ex) {
  // rouvre un dossier remis pour que l'élève puisse le corriger
  exigerProf_();
  return verrou_(() => {
    const { i } = ligneDossier_(String(email).toLowerCase(), String(ex));
    if (i < 0) throw new Error('Dossier introuvable.');
    onglet_('dossiers').getRange(i + 2, 5).setValue(false);
    return true;
  });
}

/* ---------- catalogue ---------- */
function lireCatalogue_(role) {
  return lignes_('catalogue').filter(r => r[0] !== '').map(r => ({
    id: String(r[0]), cat: String(r[1]), des: String(r[2]), ref: String(r[3]), marque: String(r[4]), unite: String(r[5] || 'pc'),
    prix: Number(r[6]) || 0, couleur: r[7] ? String(r[7]) : null, visible: r[8] !== false, verif: r[9] === true,
  })).filter(it => role === 'prof' || it.visible);
}
function catMaj(it) {
  exigerProf_();
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
function catSuppr(id) {
  exigerProf_();
  return verrou_(() => {
    const rows = lignes_('catalogue'), i = rows.findIndex(r => String(r[0]) === String(id));
    if (i >= 0) onglet_('catalogue').deleteRow(i + 2);
    return true;
  });
}

/* =========================================================
   Catalogue de départ (copié dans l'onglet Catalogue par « installer »)
   Prix Niko : liste de prix brute Niko Belgique du 01/06/2024.
   ========================================================= */
const CATALOGUE_INITIAL = __CATALOGUE__;
