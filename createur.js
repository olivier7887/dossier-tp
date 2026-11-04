/* =========================================================
   Dossier TP — création d'exercices par glisser-déposer (professeurs)
   Un exercice créé ici a exactement le même format que les TP 1 à 6 :
   { devices, lampes, cmd, montage, vv } → énoncé, variantes par élève,
   mode opératoire, correction automatique et essais sont générés d'office.
   ========================================================= */
const EX_BASE = EXERCICES.slice();
const CR_TYPES = ['sch1', 'sch2', 'sch5', 'sch6', 'sch7', 'prise'];
const CR_MAX_APP = PLANCHE.positions.length, CR_MAX_LAMPES = PLANCHE.points.length;
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

/* ---------- analyse d'une composition ---------- */
function crNoms(c) { let n = 0; return c.devices.map(d => d.type === 'prise' ? 'PC' : 'S' + (++n)); }
function crAnalyse(c) {
  const E = [], R = [], noms = crNoms(c);
  const L = i => 'L' + (i + 1);
  if (!c.devices.length) E.push('Ajoutez au moins un appareil.');
  if (c.devices.length > CR_MAX_APP) E.push(`La planche n'a que ${CR_MAX_APP} emplacements pour les appareils.`);
  if (c.lampes > CR_MAX_LAMPES) E.push(`La planche n'a que ${CR_MAX_LAMPES} points lumineux.`);
  const vvDev = c.devices.map((d, i) => i).filter(i => c.devices[i].type === 'sch6' || c.devices[i].type === 'sch7');
  const nb6 = c.devices.filter(d => d.type === 'sch6').length, nb7 = c.devices.filter(d => d.type === 'sch7').length;
  if (vvDev.length > 3) E.push('Un seul va-et-vient par exercice (2 sch 6, avec au plus 1 permutateur) : les appareils d\'un va-et-vient doivent être dans des boîtiers différents, et il n\'y en a que 3.');
  if (nb6 && nb6 !== 2) E.push('Un va-et-vient se fait avec exactement 2 interrupteurs sch 6.');
  if (nb7 && nb6 !== 2) E.push('Le permutateur (sch 7) s\'utilise entre les 2 interrupteurs sch 6 d\'un va-et-vient.');
  c.devices.forEach((d, i) => {
    const k = d.cmd.length;
    if (d.type === 'prise' && k) E.push(`${noms[i]} : une prise ne commande pas de lampe.`);
    if (d.type === 'sch5' && k !== 2) E.push(`${noms[i]} (sch 5) : chaque touche commande sa lampe, il faut donc 2 lampes.`);
    if ((d.type === 'sch6' || d.type === 'sch7') && k !== 1) E.push(`${noms[i]} (${APPAREILS[d.type].court}) : un appareil de va-et-vient commande 1 seule lampe.`);
    if ((d.type === 'sch1' || d.type === 'sch2') && !k) E.push(`${noms[i]} : choisissez la ou les lampes qu'il commande.`);
  });
  for (let j = 0; j < c.lampes; j++) {
    const par = c.devices.map((d, i) => i).filter(i => c.devices[i].cmd.includes(j));
    if (!par.length) { E.push(`${L(j)} n'est commandée par aucun interrupteur.`); continue; }
    const types = par.map(i => c.devices[i].type);
    const enVV = types.some(t => t === 'sch6' || t === 'sch7');
    if (enVV && types.some(t => t !== 'sch6' && t !== 'sch7')) E.push(`${L(j)} : une lampe se commande soit par un seul interrupteur, soit par un va-et-vient, pas les deux.`);
    if (!enVV && par.length > 1) E.push(`${L(j)} est commandée par ${par.map(i => noms[i]).join(' et ')} : pour commander une lampe depuis deux endroits, utilisez un va-et-vient (2 sch 6).`);
  }
  const ensemble = c.devices.some(d => (d.type === 'sch1' || d.type === 'sch2') && d.cmd.length > 1);
  if (ensemble && !c.montage) R.push('Choisissez le montage des lampes commandées ensemble.');
  if (c.devices.length && c.devices.every(d => d.type === 'prise')) R.push('Exercice sans interrupteur : seulement des prises.');
  return { erreurs: E, remarques: R, ensemble, noms };
}
function crCourt(c) {
  const ap = c.devices.map(d => APPAREILS[d.type].court).join(' + ');
  return c.lampes ? `${ap} · ${c.lampes} lampe${c.lampes > 1 ? 's' : ''}` : ap;
}
function crIntro(c) {
  const noms = crNoms(c), parts = [];
  for (let j = 0; j < c.lampes; j++) {
    const par = c.devices.map((d, i) => i).filter(i => c.devices[i].cmd.includes(j));
    if (!par.length) continue;
    const vv = par.some(i => c.devices[i].type === 'sch6');
    parts.push(`la lampe ${j + 1} depuis ${par.map(i => noms[i]).join(par.length > 2 ? ', ' : ' et ')}${vv ? ' (va-et-vient)' : ''}`);
  }
  const prises = c.devices.filter(d => d.type === 'prise').length;
  let t = parts.length ? 'Commander ' + parts.join(' ; ') : '';
  if (prises) t += (t ? ', et raccorder ' : 'Raccorder ') + (prises > 1 ? `${prises} prises de courant` : 'une prise de courant');
  return t ? t + '.' : '';
}
function crVersExercice(c) {
  const ensemble = crAnalyse(c).ensemble;
  const montage = ensemble ? (c.montage || 'parallèle') : (c.devices.some(d => d.type === 'sch5') ? 'double' : '');
  return {
    id: c.id || '', num: String(c.num || prochainNumero()), titre: c.titre.trim(), court: (c.court || '').trim() || crCourt(c), intro: (c.intro || '').trim() || crIntro(c),
    devices: c.devices.map(d => d.type), lampes: c.lampes, cmd: c.devices.map(d => d.cmd.slice()), montage, vv: c.devices.some(d => d.type === 'sch6'), visible: c.visible !== false,
  };
}
function crDepuisExercice(ex) {
  return { id: ex.id, num: ex.num, titre: ex.titre, court: ex.court, intro: ex.intro, courtAuto: ex.court === crCourt({ devices: ex.devices.map(t => ({ type: t })), lampes: ex.lampes }), introAuto: false,
    devices: ex.devices.map((t, i) => ({ type: t, cmd: (ex.cmd[i] || []).slice() })), lampes: ex.lampes, montage: ex.montage === 'série' || ex.montage === 'parallèle' ? ex.montage : '', visible: ex.visible !== false };
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
      <p>Glissez les appareils et les points lumineux sur la planche (ou touchez-les pour les ajouter), puis indiquez quelle lampe chaque interrupteur commande. L'app génère l'énoncé, les variantes par élève, le mode opératoire, la correction automatique et les essais.</p></section>
    <div class="cr-grid">
      <aside class="cr-palette" aria-label="Appareils disponibles">
        <h3>Appareils</h3>
        ${CR_TYPES.map(t => `<button type="button" class="cr-chip" draggable="true" data-add="${t}" title="Ajouter : ${esc(APPAREILS[t].nom)}"><svg viewBox="-36 -40 72 80" class="paper-svg" aria-hidden="true" data-psym="${t}"></svg><span><b>${APPAREILS[t].court}</b><small>${esc(APPAREILS[t].nom)}</small></span></button>`).join('')}
        <h3>Éclairage</h3>
        <button type="button" class="cr-chip" draggable="true" data-add="lampe" title="Ajouter un point lumineux"><svg viewBox="-36 -40 72 80" class="paper-svg" aria-hidden="true" data-psym="lampe"></svg><span><b>Lampe</b><small>Point lumineux</small></span></button>
      </aside>
      <div class="cr-main">
        <div class="cr-board" id="cr-board" aria-label="Planche de l'exercice : déposez les éléments ici"></div>
        <div id="cr-msgs" class="cr-msgs" role="status"></div>
        <form id="cr-form" class="form-grid two cr-form">
          <label>N° du TP <input id="cr-num" value="${esc(c.num)}" required></label>
          <label>Titre <input id="cr-titre" value="${esc(c.titre)}" placeholder="Ex. : Va-et-vient avec permutateur" required></label>
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
  const ajouter = t => {
    if (t === 'lampe') { if (c.lampes >= CR_MAX_LAMPES) return flash(`${CR_MAX_LAMPES} points lumineux au maximum sur la planche.`); c.lampes++; }
    else {
      if (c.devices.length >= CR_MAX_APP) return flash(`${CR_MAX_APP} appareils au maximum sur la planche.`);
      const d = { type: t, cmd: [] };
      // proposition : commande la première lampe libre (ou, pour un sch 5, deux lampes)
      if (t !== 'prise') {
        const libres = [...Array(c.lampes).keys()].filter(j => !c.devices.some(x => x.cmd.includes(j)));
        if (t === 'sch5') d.cmd = (libres.length >= 2 ? libres : [...Array(c.lampes).keys()]).slice(0, 2);
        else if (t === 'sch6' || t === 'sch7') { const g = c.devices.find(x => x.type === 'sch6' && x.cmd.length === 1); d.cmd = g ? [g.cmd[0]] : libres.slice(0, 1); }
        else d.cmd = libres.slice(0, 1);
      }
      c.devices.push(d);
    }
    majTout();
  };
  const flash = t => { const r = $('#cr-res'); r.textContent = t; setTimeout(() => { if (r.textContent === t) r.textContent = ''; }, 3000); };
  main.querySelectorAll('[data-add]').forEach(b => {
    b.addEventListener('click', () => ajouter(b.dataset.add));
    b.addEventListener('dragstart', e => { e.dataTransfer.setData('text/plain', b.dataset.add); e.dataTransfer.effectAllowed = 'copy'; });
  });
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
  function dessinerPlanche() {
    const a = crAnalyse(c), noms = a.noms;
    board.innerHTML = `
      <div class="cr-zone"><h3>Appareils <span class="muted small">${c.devices.length} / ${CR_MAX_APP}</span></h3>
        <div class="cr-cards">${c.devices.map((d, i) => `<div class="cr-card" data-i="${i}">
          <div class="cr-card-h"><svg viewBox="-36 -40 72 80" class="paper-svg" aria-hidden="true" data-psym="${d.type}"></svg><span><b class="mono">${noms[i]}</b> ${esc(APPAREILS[d.type].nom)}</span>
            <button type="button" class="ibtn" data-del="${i}" aria-label="Retirer ${noms[i]}">✕</button></div>
          ${d.type === 'prise' ? '<p class="muted small">Prise 2P+T, toujours sous tension.</p>' : c.lampes ? `<div class="cr-cmd"><span class="muted small">${d.type === 'sch5' ? 'Touche 1 puis touche 2 :' : 'Commande :'}</span>${[...Array(c.lampes).keys()].map(j => `<button type="button" class="chip ${d.cmd.includes(j) ? 'on' : ''}" data-cmd="${i}:${j}" aria-pressed="${d.cmd.includes(j)}">L${j + 1}${d.type === 'sch5' && d.cmd.includes(j) ? ` <small>(t.${d.cmd.indexOf(j) + 1})</small>` : ''}</button>`).join('')}</div>` : '<p class="muted small">Ajoutez une lampe à commander.</p>'}
        </div>`).join('') || '<p class="cr-vide">Déposez ici les interrupteurs et les prises.</p>'}</div></div>
      <div class="cr-zone"><h3>Points lumineux <span class="muted small">${c.lampes} / ${CR_MAX_LAMPES}</span></h3>
        <div class="cr-cards">${[...Array(c.lampes).keys()].map(j => `<div class="cr-card lampe"><div class="cr-card-h"><svg viewBox="-36 -40 72 80" class="paper-svg" aria-hidden="true" data-psym="lampe"></svg><span><b class="mono">L${j + 1}</b> Lampe ${j + 1}</span><button type="button" class="ibtn" data-dell="${j}" aria-label="Retirer la lampe ${j + 1}">✕</button></div>
          <p class="muted small">${(() => { const par = c.devices.map((d, i) => i).filter(i => c.devices[i].cmd.includes(j)); return par.length ? 'Commandée par ' + par.map(i => noms[i]).join(', ') : 'Pas encore commandée'; })()}</p></div>`).join('') || '<p class="cr-vide">Déposez ici les lampes.</p>'}</div></div>
      ${a.ensemble ? `<div class="cr-zone cr-montage"><h3>Lampes commandées ensemble</h3><div class="chips">${['parallèle', 'série'].map(m => `<button type="button" class="chip ${(c.montage || 'parallèle') === m ? 'on' : ''}" data-mont="${m}">en ${m}</button>`).join('')}</div></div>` : ''}`;
    drawIllus(board);
    board.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', () => { c.devices.splice(+b.dataset.del, 1); majTout(); }));
    board.querySelectorAll('[data-dell]').forEach(b => b.addEventListener('click', () => {
      const j = +b.dataset.dell; c.lampes--;
      c.devices.forEach(d => { d.cmd = d.cmd.filter(x => x !== j).map(x => x > j ? x - 1 : x); });
      majTout();
    }));
    board.querySelectorAll('[data-cmd]').forEach(b => b.addEventListener('click', () => {
      const [i, j] = b.dataset.cmd.split(':').map(Number), d = c.devices[i];
      if (d.cmd.includes(j)) d.cmd = d.cmd.filter(x => x !== j);
      else if (d.type === 'sch6' || d.type === 'sch7') d.cmd = [j];
      else if (d.type === 'sch5' && d.cmd.length >= 2) d.cmd = [d.cmd[1], j];
      else d.cmd.push(j);
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
