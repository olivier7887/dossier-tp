/* =========================================================
   Dossier TP — création d'exercices par glisser-déposer (professeurs)
   Un exercice créé ici a le même format que les TP 1 à 6 :
   { devices, lampes, cmd, touches, montage, vv } → énoncé, variantes par élève,
   mode opératoire, correction automatique et essais sont générés d'office.
   Charges : lampes (0, 1, 2) et prises commandées ('p' + index de la prise).
   ========================================================= */
const EX_BASE = EXERCICES.slice();
const CR_TYPES = ['sch1', 'sch2', 'sch5', 'sch6', 'sch7', 'sch62', 'sch66', 'prise', 'bp', 'bpv', 'bp2', 'tl', 'min4', 'min3', 'crep', 'horl'];
const CR_MAX_APP = PLANCHE.positions.length, CR_MAX_RAIL = 6, CR_MAX_LAMPES = PLANCHE.points.length;
let EX_PERSO = [];

function numEx(n) { const m = String(n).match(/\d+/); return m ? +m[0] : 0; }
function appliquerExercicesPerso(list) {
  EX_PERSO = (list || []).filter(e => e && e.id && Array.isArray(e.devices));
  const vus = EX_PERSO.filter(e => e.visible !== false || (USER && USER.role === 'prof'))
    .map(e => Object.assign({}, e, { kind: 'cablage', cmd: e.cmd || [], lampes: +e.lampes || 0 }))
    .sort((a, b) => numEx(a.num) - numEx(b.num) || String(a.num).localeCompare(String(b.num)));
  EXERCICES.splice(0, EXERCICES.length, ...EX_BASE, ...vus);
}
function chargerExercicesLocaux() { appliquerExercicesPerso(store.get(ONLINE ? 'tp3pelec:exos' : 'tp3pelec:exos-demo', [])); }
function prochainNumero() { return String(Math.max(0, ...EXERCICES.map(e => numEx(e.num))) + 1); }

/* ---------- composition (modèle interne du créateur) ----------
   c.devices = [{ uid, type, touches: [[charges], …] }] ; charge = n° de lampe, 'u' + uid d'une prise,
   ou 'k' + uid de l'entrée d'un télérupteur / d'une minuterie (commandée par des boutons-poussoirs) */
let CR_UID = 1;
const nbTouches = t => t === 'prise' ? 0 : DEUX_TOUCHES.includes(t) ? 2 : 1;
const sorteUnite = t => ['sch6', 'sch62', 'sch66'].includes(t) ? 'vv' : t === 'sch7' ? 'perm' : t === 'sch2' ? 'bip' : BP_TYPES.includes(t) ? 'bp' : IMPULSION.includes(t) ? 'relais' : AUTO_TYPES.includes(t) ? 'auto' : 'simple';
const CR_PREF = { tl: 'TL', min4: 'MI', min3: 'MI', crep: 'CR', horl: 'HO' };
function crNoms(c) {
  const nbP = c.devices.filter(d => d.type === 'prise').length, cpt = {};
  let n = 0, p = 0;
  return c.devices.map(d => d.type === 'prise' ? (nbP > 1 ? 'PC' + (++p) : 'PC') : CR_PREF[d.type] ? CR_PREF[d.type] + (cpt[CR_PREF[d.type]] = (cpt[CR_PREF[d.type]] || 0) + 1) : 'S' + (++n));
}
// charges que l'on peut commander : lampes, prises, et entrées d'impulsion (télérupteur, minuterie)
function crCharges(c) { return [...crChargesLP(c), ...c.devices.filter(d => IMPULSION.includes(d.type)).map(d => 'k' + d.uid)]; }
function crChargesLP(c) { return [...[...Array(c.lampes).keys()], ...c.devices.filter(d => d.type === 'prise').map(d => 'u' + d.uid)]; }
const estEntree = ch => typeof ch === 'string' && ch[0] === 'k';
function crNomCharge(c, ch, noms) {
  if (typeof ch === 'number') return 'L' + (ch + 1);
  const i = c.devices.findIndex(d => 'u' + d.uid === ch || 'k' + d.uid === ch);
  return (noms || crNoms(c))[i];
}
function crUnites(c, ch) { // [{ i, k, sorte }]
  const r = [];
  c.devices.forEach((d, i) => d.touches.forEach((l, k) => { if (l.includes(ch)) r.push({ i, k, sorte: sorteUnite(d.type) }); }));
  return r;
}
function crVersExercice(c) {
  const idx = Object.fromEntries(c.devices.flatMap((d, i) => [['u' + d.uid, 'p' + i], ['k' + d.uid, 'i' + i]]));
  const conv = ch => typeof ch === 'number' ? ch : idx[ch];
  const touches = c.devices.map(d => d.touches.map(l => l.map(conv).filter(x => x != null)));
  const ensemble = crEnsemble(c);
  const montage = ensemble ? (c.montage || 'parallèle') : (c.devices.some(d => d.type === 'sch5') ? 'double' : '');
  // (vv : va-et-vient présent)
  return {
    id: c.id || '', num: String(c.num || prochainNumero()), titre: c.titre.trim(), court: (c.court || '').trim() || crCourt(c), intro: (c.intro || '').trim() || crIntro(c),
    devices: c.devices.map(d => d.type), lampes: c.lampes,
    cmd: touches.map(t => [...new Set(t.flat())]),
    touches: c.devices.map((d, i) => DEUX_TOUCHES.includes(d.type) ? touches[i] : null),
    montage, vv: c.devices.some(d => VV_TYPES.includes(d.type)), visible: c.visible !== false,
  };
}
function crDepuisExercice(ex) {
  const devices = ex.devices.map(t => ({ uid: CR_UID++, type: t, touches: [] }));
  devices.forEach((d, i) => {
    d.touches = d.type === 'prise' ? [] : touchesDe(ex, i).map(l => l.map(ch => typeof ch === 'string' ? (ch[0] === 'i' ? 'k' : 'u') + devices[+ch.slice(1)].uid : ch));
  });
  const c = { id: ex.id, num: ex.num, titre: ex.titre, devices, lampes: ex.lampes, montage: ex.montage === 'série' || ex.montage === 'parallèle' ? ex.montage : '', visible: ex.visible !== false };
  c.court = ex.court === crCourt(c) ? '' : ex.court; c.intro = ex.intro || '';
  c.courtAuto = !c.court; c.introAuto = false;
  return c;
}

/* ---------- vérification d'une composition ---------- */
// un même groupe d'interrupteurs commande-t-il plusieurs lampes ? (choix série / parallèle)
function crEnsemble(c) {
  const parGroupe = {};
  for (const x of [...Array(c.lampes).keys()]) { const k = crUnites(c, x).map(u => u.i + ':' + u.k).sort().join(); if (k) (parGroupe[k] ||= []).push(x); }
  return Object.values(parGroupe).some(l => l.length > 1);
}
function crAnalyse(c) {
  const E = [], R = [], noms = crNoms(c), nomC = ch => crNomCharge(c, ch, noms);
  if (!c.devices.length) E.push('Ajoutez au moins un appareil.');
  const nRail = c.devices.filter(d => estRail(d.type)).length;
  if (c.devices.length - nRail > CR_MAX_APP) E.push(`La planche n'a que ${CR_MAX_APP} emplacements dans les boîtiers.`);
  if (nRail > CR_MAX_RAIL) E.push(`Un rail DIN de la planche accepte ${CR_MAX_RAIL} modules au plus.`);
  if (c.lampes > CR_MAX_LAMPES) E.push(`La planche n'a que ${CR_MAX_LAMPES} points lumineux.`);
  // chaque touche doit commander quelque chose
  c.devices.forEach((d, i) => d.touches.forEach((l, k) => {
    if (!l.length) E.push(`${noms[i]}${d.touches.length > 1 ? ` touche ${k + 1}` : ''} : choisissez ce qu'${d.touches.length > 1 ? 'elle' : 'il'} commande.`);
  }));
  c.devices.forEach((d, i) => {
    if (d.touches.length === 2 && d.touches[0].some(ch => d.touches[1].includes(ch))) E.push(`${noms[i]} (${APPAREILS[d.type].court}) : les deux touches ne peuvent pas commander la même charge.`);
  });
  // boutons-poussoirs : ils commandent un télérupteur ou une minuterie, rien d'autre
  c.devices.forEach((d, i) => d.touches.forEach(l => {
    if (BP_TYPES.includes(d.type) && l.some(ch => !estEntree(ch))) E.push(`${noms[i]} (bouton-poussoir) : un poussoir commande un télérupteur ou une minuterie, pas directement une lampe.`);
    if (!BP_TYPES.includes(d.type) && l.some(estEntree)) E.push(`${noms[i]} : seul un bouton-poussoir commande un télérupteur ou une minuterie.`);
  }));
  for (const ch of crCharges(c).filter(estEntree)) if (!crUnites(c, ch).length) E.push(`${nomC(ch)} n'est commandé par aucun bouton-poussoir.`);
  const ens = new Map();
  for (const ch of crChargesLP(c)) {
    const U = crUnites(c, ch), n = nomC(ch);
    ens.set(ch, U.map(u => u.i + ':' + u.k).sort().join());
    if (!U.length) { if (typeof ch === 'number') E.push(`${n} n'est commandée par aucun interrupteur.`); continue; }
    const rel = U.filter(u => u.sorte === 'relais'), aut = U.filter(u => u.sorte === 'auto');
    if (rel.length) { if (U.length > 1) E.push(`${n} : une charge commandée par un télérupteur ou une minuterie ne l'est que par lui.`); continue; }
    if (aut.length) {
      if (aut.length !== U.length) E.push(`${n} : l'horloge et le crépusculaire ne se combinent qu'entre eux (en série).`);
      else if (aut.length > 2 || (aut.length === 2 && c.devices[aut[0].i].type === c.devices[aut[1].i].type)) E.push(`${n} : en série, on combine une horloge et un crépusculaire (un de chaque).`);
      continue;
    }
    const vv = U.filter(u => u.sorte === 'vv'), perm = U.filter(u => u.sorte === 'perm');
    if (vv.length || perm.length) {
      if (vv.length + perm.length !== U.length) E.push(`${n} : une charge se commande soit par un seul interrupteur, soit par un va-et-vient, pas les deux.`);
      else if (vv.length !== 2) E.push(`${n} : un va-et-vient se fait avec exactement 2 appareils de va-et-vient (sch 6, 6/2 ou une touche de 6+6)${perm.length ? ', et le ou les permutateurs entre les deux' : ''}.`);
      else if (vv[0].i === vv[1].i) E.push(`${n} : les deux touches d'un même 6+6 ne forment pas un va-et-vient. Utilisez un second appareil.`);
      const devs = new Set(U.map(u => u.i));
      if (devs.size > 3) E.push(`${n} : au plus 3 appareils pour un même va-et-vient (ils doivent être dans des boîtiers différents, il n'y en a que 3).`);
      const t62 = vv.filter(u => c.devices[u.i].type === 'sch62').length;
      if (t62 && t62 !== vv.length) E.push(`${n} : un va-et-vient bipolaire se fait avec deux sch 6/2.`);
      if (t62 && perm.length) E.push(`${n} : le permutateur (sch 7) ne s'utilise pas avec des va-et-vient bipolaires.`);
    } else if (U.length > 1) E.push(`${n} est commandée par ${U.map(u => noms[u.i]).join(' et ')} : pour commander depuis deux endroits, utilisez un va-et-vient.`);
  }
  // des charges commandées par un même interrupteur doivent l'être exactement par les mêmes appareils
  const ch = crChargesLP(c);
  for (let a = 0; a < ch.length; a++) for (let b = a + 1; b < ch.length; b++) {
    const A = ens.get(ch[a]).split(',').filter(Boolean), B = ens.get(ch[b]).split(',').filter(Boolean);
    if (A.length && B.length && A.some(x => B.includes(x)) && A.join() !== B.join()) E.push(`${nomC(ch[a])} et ${nomC(ch[b])} partagent un interrupteur mais pas les autres : commandées ensemble, elles doivent l'être par les mêmes appareils.`);
  }
  // disposition sur la planche : les appareils d'un va-et-vient dans des boîtiers différents
  if (!E.length && c.devices.length) {
    const ex = crVersExercice(Object.assign({}, c, { titre: c.titre || '-' }));
    const ids = PLANCHE.positions.map(p => p.id), boite = ex.devices.map((t, i) => i).filter(i => !estRail(ex.devices[i])), n = boite.length;
    let ok = false;
    const plein = pris => { const pos = ex.devices.map(() => 'RG-1'); boite.forEach((i, j) => { pos[i] = pris[j]; }); return pos; };
    const perm = (pris, reste) => { if (ok) return; if (pris.length === n) { ok = dispositionOk(ex, plein(pris)); return; } reste.forEach((p, k) => perm([...pris, p], reste.filter((x, j) => j !== k))); };
    perm([], ids);
    if (!ok) E.push('Disposition impossible sur la planche : les appareils de chaque va-et-vient doivent être dans des boîtiers différents (gauche, centre, droite).');
  }
  // montage série / parallèle : un même groupe d'interrupteurs commande plusieurs lampes
  const ensemble = crEnsemble(c);
  if (c.devices.length && c.devices.every(d => d.type === 'prise')) R.push('Exercice sans interrupteur : seulement des prises.');
  return { erreurs: [...new Set(E)], remarques: R, ensemble, noms };
}
function crCourt(c) {
  const ap = c.devices.map(d => APPAREILS[d.type].court).join(' + ');
  return c.lampes ? `${ap} · ${c.lampes} lampe${c.lampes > 1 ? 's' : ''}` : ap;
}
function crIntro(c) {
  const noms = crNoms(c), parts = [], vus = new Set();
  const groupes = {};
  for (const ch of crChargesLP(c)) {
    const U = crUnites(c, ch); if (!U.length) continue;
    const k = U.map(u => u.i + ':' + u.k).sort().join();
    (groupes[k] ||= { U, ch: [] }).ch.push(ch);
  }
  const NOMS_MOD = { tl: 'le télérupteur', min4: 'la minuterie', min3: 'la minuterie', crep: 'le crépusculaire', horl: "l'horloge" };
  const bpsDe = i => [...new Set(crUnites(c, 'k' + c.devices[i].uid).map(u => noms[u.i]))];
  for (const { U, ch } of Object.values(groupes)) {
    const quoi = ch.map(x => typeof x === 'number' ? `la lampe ${x + 1}` : `la prise ${crNomCharge(c, x, noms)}`);
    const mods = U.filter(u => u.sorte === 'relais' || u.sorte === 'auto');
    if (mods.length) {
      parts.push(`${quoi.join(' et ')} par ${mods.map(u => `${NOMS_MOD[c.devices[u.i].type]} ${noms[u.i]}${u.sorte === 'relais' ? ` (boutons-poussoirs ${bpsDe(u.i).join(', ') || '—'})` : ''}`).join(' et ')}${mods.length > 1 ? ' en série' : ''}`);
      continue;
    }
    const qui = [...new Set(U.map(u => noms[u.i] + (c.devices[u.i].touches.length > 1 ? ` (touche ${u.k + 1})` : '')))];
    const vv = U.some(u => u.sorte === 'vv');
    parts.push(`${quoi.join(' et ')} depuis ${qui.join(qui.length > 2 ? ', ' : ' et ')}${vv ? ' (va-et-vient)' : ''}`);
  }
  const perm = c.devices.filter(d => d.type === 'prise' && !crUnites(c, 'u' + d.uid).length).length;
  let t = parts.length ? 'Commander ' + parts.join(' ; ') : '';
  if (perm) t += (t ? ', et raccorder ' : 'Raccorder ') + (perm > 1 ? `${perm} prises de courant` : 'une prise de courant') + ' toujours sous tension';
  return t ? t + '.' : '';
}

/* ---------- vue ---------- */
let CREA = null;
function creerView(main) {
  if (USER.role !== 'prof') return go({ page: 'home' });
  if (!CREA || CREA.pour !== (VIEW.id || '')) {
    const ex = VIEW.id && EXERCICES.find(e => e.id === VIEW.id && e.perso);
    CREA = ex ? crDepuisExercice(ex) : { id: '', num: prochainNumero(), titre: '', court: '', intro: '', courtAuto: true, introAuto: true, devices: [], lampes: 0, montage: '', visible: true };
    CREA.pour = VIEW.id || '';
  }
  const c = CREA;
  main.innerHTML = `
    <div class="crumbs"><button type="button" class="as-link" id="cr-retour">← Exercices</button></div>
    <section class="hello"><h1>${c.id ? 'Modifier l\'exercice' : 'Créer un exercice'}</h1>
      <p>Glissez les appareils et les points lumineux sur la planche (ou touchez-les pour les ajouter), puis indiquez ce que chaque interrupteur commande : lampes et prises. L'app génère l'énoncé, les variantes par élève, le mode opératoire, la correction automatique et les essais.</p></section>
    <div class="cr-grid">
      <aside class="cr-palette" aria-label="Appareils disponibles">
        ${[['Interrupteurs', t => /^sch/.test(t)], ['Prise', t => t === 'prise'], ['Boutons-poussoirs', t => BP_TYPES.includes(t)], ['Rail DIN (Hager)', estRail]].map(([titre, f]) => `<h3>${titre}</h3>` + CR_TYPES.filter(f).map(t => `<button type="button" class="cr-chip" draggable="true" data-add="${t}" title="Ajouter : ${esc(APPAREILS[t].nom)}"><svg viewBox="-36 -40 72 80" class="paper-svg" aria-hidden="true" data-psym="${t}"></svg><span><b>${APPAREILS[t].court}</b><small>${esc(APPAREILS[t].nom)}</small></span></button>`).join('')).join('')}
        <h3>Éclairage</h3>
        <button type="button" class="cr-chip" draggable="true" data-add="lampe" title="Ajouter un point lumineux"><svg viewBox="-36 -40 72 80" class="paper-svg" aria-hidden="true" data-psym="lampe"></svg><span><b>Lampe</b><small>Point lumineux</small></span></button>
        <h3>Exemple</h3>
        <button type="button" class="btn small" id="cr-ex-escalier" title="Remplit la planche avec un exemple">Cage d'escalier</button>
        <button type="button" class="btn small" data-exemple="tl" title="Remplit la planche avec un exemple">Télérupteur</button>
        <button type="button" class="btn small" data-exemple="min" title="Remplit la planche avec un exemple">Minuterie</button>
        <button type="button" class="btn small" data-exemple="ext" title="Remplit la planche avec un exemple">Éclairage extérieur</button>
      </aside>
      <div class="cr-main">
        <div class="cr-board" id="cr-board" aria-label="Planche de l'exercice : déposez les éléments ici"></div>
        <div id="cr-msgs" class="cr-msgs" role="status"></div>
        <form id="cr-form" class="form-grid two cr-form">
          <label>N° du TP <input id="cr-num" value="${esc(c.num)}" required></label>
          <label>Titre <input id="cr-titre" value="${esc(c.titre)}" placeholder="Ex. : Cage d'escalier" required></label>
          <label class="span2">Résumé court <input id="cr-court" value="${esc(c.courtAuto ? '' : c.court)}" placeholder="Automatique"></label>
          <label class="span2">Consigne (début de l'énoncé) <textarea id="cr-intro" rows="2" placeholder="Automatique">${esc(c.introAuto ? '' : c.intro)}</textarea></label>
        </form>
        <div class="row wrapr cr-actions">
          <button type="button" class="btn primary" id="cr-pub">${c.id ? 'Enregistrer les modifications' : 'Publier pour tous les élèves'}</button>
          ${c.id ? `<button type="button" class="btn" id="cr-vis">${c.visible ? 'Masquer aux élèves' : 'Rendre visible aux élèves'}</button>` : ''}
          <button type="button" class="btn ghost" id="cr-annul">Annuler</button>
          <span id="cr-res" class="muted small" role="status"></span>
        </div>
        ${c.id ? '<p class="muted small">Attention : modifier les appareils d\'un exercice déjà commencé change la version des élèves (emplacements, correction).</p>' : ''}
        <section class="cr-apercu"><h2>Aperçu de l'énoncé</h2><p class="muted small">Tel que le verra un élève (exemple). Chaque élève reçoit ses propres emplacements et sa propre finition.</p><div id="cr-prev" class="sheet"></div></section>
      </div>
    </div>`;
  drawIllus(main);
  const flash = t => { const r = $('#cr-res'); r.textContent = t; setTimeout(() => { if (r.textContent === t) r.textContent = ''; }, 3500); };
  // proposition de commande à l'ajout d'un appareil
  const libres = () => [...Array(c.lampes).keys()].filter(j => !crUnites(c, j).length);
  const groupeVVIncomplet = () => crCharges(c).find(ch => { const U = crUnites(c, ch); return U.length && U.every(u => u.sorte === 'vv' || u.sorte === 'perm') && U.filter(u => u.sorte === 'vv').length < 2; });
  const ajouter = t => {
    if (t === 'lampe') { if (c.lampes >= CR_MAX_LAMPES) return flash(`${CR_MAX_LAMPES} points lumineux au maximum sur la planche.`); c.lampes++; return majTout(); }
    if (!estRail(t) && c.devices.filter(d => !estRail(d.type)).length >= CR_MAX_APP) return flash(`${CR_MAX_APP} appareils au maximum dans les boîtiers.`);
    if (estRail(t) && c.devices.filter(d => estRail(d.type)).length >= CR_MAX_RAIL) return flash(`${CR_MAX_RAIL} modules au maximum sur le rail.`);
    const d = { uid: CR_UID++, type: t, touches: Array.from({ length: nbTouches(t) }, () => []) };
    // un poussoir ajouté sans télérupteur ni minuterie : on en propose un
    let tlAuto = null;
    if (BP_TYPES.includes(t) && !c.devices.some(x => IMPULSION.includes(x.type)) && c.devices.filter(x => estRail(x.type)).length < CR_MAX_RAIL) { tlAuto = { uid: CR_UID++, type: 'tl', touches: [libres().slice(0, 1)] }; c.devices.push(tlAuto); }
    const L = libres(), g = groupeVVIncomplet();
    if (BP_TYPES.includes(t)) {
      const entrees = crCharges(c).filter(estEntree), sans = entrees.filter(ch => !crUnites(c, ch).length);
      d.touches.forEach((tc, k) => { const e = sans[k] ?? entrees[k] ?? (k ? null : entrees[0]); if (e) tc.push(e); });
    }
    else if (t === 'sch5' || t === 'sch66') d.touches.forEach((tc, k) => { if (L[k] != null) tc.push(L[k]); });
    else if (AUTO_TYPES.includes(t)) {
      const autre = [...Array(c.lampes).keys()].find(j => { const U = crUnites(c, j); return U.length === 1 && U[0].sorte === 'auto' && c.devices[U[0].i].type !== t; });
      if (L.length) d.touches[0].push(L[0]); else if (autre != null) d.touches[0].push(autre);
    }
    else if (t === 'sch6' || t === 'sch62' || t === 'sch7') {
      // sch 6 / 6-2 : complète un va-et-vient commencé ; sch 7 : s'insère dans un va-et-vient complet
      const cible = t === 'sch7' ? crCharges(c).find(ch => crUnites(c, ch).filter(u => u.sorte === 'vv').length === 2) : g;
      const memes = ch0 => crCharges(c).filter(ch => crUnites(c, ch).map(u => u.i + ':' + u.k).sort().join() === crUnites(c, ch0).map(u => u.i + ':' + u.k).sort().join());
      if (cible != null) d.touches[0].push(...memes(cible)); else if (t !== 'sch7' && L.length) d.touches[0].push(L[0]);
    }
    else if (t !== 'prise' && L.length) d.touches[0].push(L[0]);
    c.devices.push(d);
    if (tlAuto) { c.devices.splice(c.devices.indexOf(tlAuto), 1); c.devices.push(tlAuto); }
    majTout();
  };
  main.querySelectorAll('[data-add]').forEach(b => {
    b.addEventListener('click', () => ajouter(b.dataset.add));
    b.addEventListener('dragstart', e => { e.dataTransfer.setData('text/plain', b.dataset.add); e.dataTransfer.effectAllowed = 'copy'; });
  });
  $('#cr-ex-escalier').addEventListener('click', () => {
    // exemple : 6+6 en bas, un sch 6 par étage ; chaque touche du 6+6 forme un va-et-vient avec un sch 6
    const a = CR_UID++, b = CR_UID++, d = CR_UID++;
    c.lampes = 2; c.montage = '';
    c.devices = [{ uid: a, type: 'sch66', touches: [[0], [1]] }, { uid: b, type: 'sch6', touches: [[0]] }, { uid: d, type: 'sch6', touches: [[1]] }];
    if (!$('#cr-titre').value.trim()) { $('#cr-titre').value = 'Cage d\'escalier'; c.titre = 'Cage d\'escalier'; }
    majTout();
  });
  main.querySelectorAll('[data-exemple]').forEach(b => b.addEventListener('click', () => {
    const u = () => CR_UID++, k = b.dataset.exemple;
    if (k === 'tl') { const t = u(); c.lampes = 2; c.montage = 'parallèle'; c.devices = [{ uid: u(), type: 'bp', touches: [['k' + t]] }, { uid: u(), type: 'bp', touches: [['k' + t]] }, { uid: u(), type: 'bpv', touches: [['k' + t]] }, { uid: t, type: 'tl', touches: [[0, 1]] }]; }
    if (k === 'min') { const t = u(); c.lampes = 2; c.montage = 'parallèle'; c.devices = [{ uid: u(), type: 'bpv', touches: [['k' + t]] }, { uid: u(), type: 'bpv', touches: [['k' + t]] }, { uid: t, type: 'min4', touches: [[0, 1]] }]; }
    if (k === 'ext') { c.lampes = 1; c.montage = ''; c.devices = [{ uid: u(), type: 'horl', touches: [[0]] }, { uid: u(), type: 'crep', touches: [[0]] }]; }
    const titres = { tl: 'Télérupteur, 3 poussoirs', min: 'Minuterie d\'escalier', ext: 'Éclairage extérieur : horloge et crépusculaire' };
    if (!$('#cr-titre').value.trim()) { $('#cr-titre').value = titres[k]; c.titre = titres[k]; }
    majTout();
  }));
  const board = $('#cr-board');
  board.addEventListener('dragover', e => { e.preventDefault(); board.classList.add('over'); });
  board.addEventListener('dragleave', () => board.classList.remove('over'));
  board.addEventListener('drop', e => { e.preventDefault(); board.classList.remove('over'); const t = e.dataTransfer.getData('text/plain'); if (t === 'lampe' || CR_TYPES.includes(t)) ajouter(t); });
  const lireForm = () => {
    c.num = $('#cr-num').value.trim(); c.titre = $('#cr-titre').value;
    const co = $('#cr-court').value.trim(), it = $('#cr-intro').value.trim();
    c.courtAuto = !co; c.introAuto = !it; c.court = co; c.intro = it;
  };
  main.querySelectorAll('#cr-form input, #cr-form textarea').forEach(i => i.addEventListener('input', () => { lireForm(); majApercu(); }));
  function majTout() { dessinerPlanche(); majApercu(); }
  function chipsCharges(i, k, l, noms) {
    const charges = BP_TYPES.includes(c.devices[i].type) ? crCharges(c).filter(estEntree) : crChargesLP(c);
    if (BP_TYPES.includes(c.devices[i].type) && !charges.length) return '<span class="muted small">Ajoutez un télérupteur ou une minuterie.</span>';
    if (!charges.length) return '<span class="muted small">Ajoutez une lampe ou une prise.</span>';
    return charges.map(ch => { const on = l.includes(ch), n = crNomCharge(c, ch, noms); return `<button type="button" class="chip ${on ? 'on' : ''} ${typeof ch === 'string' ? 'chip-pc' : ''}" data-cmd="${i}:${k}:${ch}" aria-pressed="${on}">${n}</button>`; }).join('');
  }
  function dessinerPlanche() {
    const a = crAnalyse(c), noms = a.noms;
    board.innerHTML = `
      <div class="cr-zone"><h3>Appareils <span class="muted small">${c.devices.filter(d => !estRail(d.type)).length} / ${CR_MAX_APP} dans les boîtiers${c.devices.some(d => estRail(d.type)) ? ` · ${c.devices.filter(d => estRail(d.type)).length} / ${CR_MAX_RAIL} sur le rail DIN` : ''}</span></h3>
        <div class="cr-cards">${c.devices.map((d, i) => `<div class="cr-card" data-i="${i}">
          <div class="cr-card-h"><svg viewBox="-36 -40 72 80" class="paper-svg" aria-hidden="true" data-psym="${d.type}"></svg><span><b class="mono">${noms[i]}</b> ${esc(APPAREILS[d.type].nom)}</span>
            <button type="button" class="ibtn" data-del="${i}" aria-label="Retirer ${noms[i]}">✕</button></div>
          ${d.type === 'prise' ? `<p class="muted small">${(() => { const U = crUnites(c, 'u' + d.uid); return U.length ? 'Prise commandée par ' + [...new Set(U.map(u => noms[u.i]))].join(' et ') : 'Toujours sous tension. Pour la commander, cochez-la sur un interrupteur.'; })()}</p>`
            : d.touches.map((l, k) => `<div class="cr-cmd"><span class="muted small">${d.touches.length > 1 ? `Touche ${k + 1} :` : 'Commande :'}</span>${chipsCharges(i, k, l, noms)}</div>`).join('')}
          ${IMPULSION.includes(d.type) ? `<p class="muted small">${(() => { const U = crUnites(c, 'k' + d.uid); return U.length ? 'Commandé par ' + [...new Set(U.map(u => noms[u.i] + (c.devices[u.i].touches.length > 1 ? ` (t.${u.k + 1})` : '')))].join(', ') : 'Pas encore commandé : ajoutez un bouton-poussoir.'; })()}</p>` : ''}
        </div>`).join('') || '<p class="cr-vide">Déposez ici les interrupteurs et les prises.</p>'}</div></div>
      <div class="cr-zone"><h3>Points lumineux <span class="muted small">${c.lampes} / ${CR_MAX_LAMPES}</span></h3>
        <div class="cr-cards">${[...Array(c.lampes).keys()].map(j => `<div class="cr-card lampe"><div class="cr-card-h"><svg viewBox="-36 -40 72 80" class="paper-svg" aria-hidden="true" data-psym="lampe"></svg><span><b class="mono">L${j + 1}</b> Lampe ${j + 1}</span><button type="button" class="ibtn" data-dell="${j}" aria-label="Retirer la lampe ${j + 1}">✕</button></div>
          <p class="muted small">${(() => { const U = crUnites(c, j); return U.length ? 'Commandée par ' + [...new Set(U.map(u => noms[u.i] + (c.devices[u.i].touches.length > 1 ? ` (t.${u.k + 1})` : '')))].join(', ') : 'Pas encore commandée'; })()}</p></div>`).join('') || '<p class="cr-vide">Déposez ici les lampes.</p>'}</div></div>
      ${a.ensemble ? `<div class="cr-zone cr-montage"><h3>Lampes commandées ensemble</h3><div class="chips">${['parallèle', 'série'].map(m => `<button type="button" class="chip ${(c.montage || 'parallèle') === m ? 'on' : ''}" data-mont="${m}">en ${m}</button>`).join('')}</div></div>` : ''}`;
    drawIllus(board);
    board.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', () => {
      const d = c.devices.splice(+b.dataset.del, 1)[0];
      c.devices.forEach(x => { x.touches = x.touches.map(l => l.filter(ch => ch !== 'u' + d.uid && ch !== 'k' + d.uid)); });
      majTout();
    }));
    board.querySelectorAll('[data-dell]').forEach(b => b.addEventListener('click', () => {
      const j = +b.dataset.dell; c.lampes--;
      c.devices.forEach(d => { d.touches = d.touches.map(l => l.filter(x => x !== j).map(x => typeof x === 'number' && x > j ? x - 1 : x)); });
      majTout();
    }));
    board.querySelectorAll('[data-cmd]').forEach(b => b.addEventListener('click', () => {
      const [i, k, raw] = b.dataset.cmd.split(':'), ch = /^\d+$/.test(raw) ? +raw : raw, l = c.devices[+i].touches[+k];
      const p = l.indexOf(ch);
      if (p >= 0) l.splice(p, 1); else l.push(ch);
      majTout();
    }));
    board.querySelectorAll('[data-mont]').forEach(b => b.addEventListener('click', () => { c.montage = b.dataset.mont; majTout(); }));
  }
  function majApercu() {
    const a = crAnalyse(c);
    $('#cr-court').placeholder = 'Automatique : ' + (crCourt(c) || '—');
    $('#cr-intro').placeholder = 'Automatique : ' + (crIntro(c) || '—');
    const titreManque = !c.titre.trim();
    $('#cr-msgs').innerHTML = a.erreurs.length || a.remarques.length || titreManque
      ? `<ul class="constats">${a.erreurs.map(m => `<li class="c-erreur"><span class="c-ico" aria-hidden="true">✕</span><span class="c-txt">${esc(m)}</span></li>`).join('')}${titreManque ? '<li class="c-remarque"><span class="c-ico" aria-hidden="true">!</span><span class="c-txt">Donnez un titre à l\'exercice.</span></li>' : ''}${a.remarques.map(m => `<li class="c-remarque"><span class="c-ico" aria-hidden="true">!</span><span class="c-txt">${esc(m)}</span></li>`).join('')}</ul>`
      : '<ul class="constats"><li class="c-ok"><span class="c-ico" aria-hidden="true">✓</span><span class="c-txt">L\'exercice est complet : il peut être publié.</span></li></ul>';
    $('#cr-pub').disabled = a.erreurs.length > 0 || titreManque;
    const prev = $('#cr-prev');
    if (a.erreurs.length || !c.devices.length) { prev.innerHTML = '<p class="muted">L\'aperçu apparaît quand la composition est correcte.</p>'; return; }
    const ex = Object.assign(crVersExercice(c), { id: c.id || 'apercu', titre: c.titre || 'Nouvel exercice', kind: 'cablage' });
    try { enonceSheet(prev, ex, variante(ex, 'eleve.exemple.student@' + DOMAINE)); } catch (e) { prev.innerHTML = `<p class="err">${esc(e.message)}</p>`; }
  }
  $('#cr-retour').addEventListener('click', () => { CREA = null; go({ page: 'home' }); });
  $('#cr-annul').addEventListener('click', () => { CREA = null; go({ page: 'home' }); });
  const enregistrer = async (ex, msg) => {
    const res = $('#cr-res');
    if (!ONLINE) {
      const liste = store.get('tp3pelec:exos-demo', []).filter(e => e.id !== ex.id);
      ex.id ||= 'x' + Date.now().toString(36); liste.push(Object.assign({ perso: true, auteur: USER.email }, ex));
      store.set('tp3pelec:exos-demo', liste); appliquerExercicesPerso(liste);
      CREA = null; go({ page: 'home' }); return;
    }
    if (!enLigne()) { res.textContent = 'Il faut une connexion internet pour publier.'; return; }
    res.textContent = msg;
    try {
      const r = await api('exSauver', { exercice: ex });
      ex.id = r.id;
      const liste = store.get('tp3pelec:exos', []).filter(e => e.id !== ex.id);
      liste.push(Object.assign({ perso: true, auteur: USER.email }, ex));
      store.set('tp3pelec:exos', liste); appliquerExercicesPerso(liste);
      CREA = null; go({ page: 'home' });
    } catch (e) { res.textContent = e.message; if (e.auth) deconnecter(e.message); }
  };
  $('#cr-pub').addEventListener('click', () => {
    lireForm();
    if (crAnalyse(c).erreurs.length || !c.titre.trim()) return;
    if (EXERCICES.some(e => e.id !== c.id && String(e.num) === c.num)) { $('#cr-res').textContent = `Le numéro ${c.num} est déjà pris.`; return; }
    enregistrer(crVersExercice(c), 'Publication…');
  });
  const vis = $('#cr-vis');
  if (vis) vis.addEventListener('click', () => { lireForm(); c.visible = !c.visible; enregistrer(crVersExercice(c), c.visible ? 'Publication…' : 'Masquage…'); });
  majTout();
}
