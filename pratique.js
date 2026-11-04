/* =========================================================
   Dossier TP — V3 : essais, dépannage, produit fini, photo annotée
   ========================================================= */

/* ---------- barème du produit fini (/45), à ajuster ici ---------- */
const PF = { realisation: 15, essais: 20, depannage: 10 };
const DEP_GRILLE = [
  ['securite', 'Sécurité : coupure, consignation, vérification d\'absence de tension (VAT)', 3],
  ['methode', 'Méthode : symptôme décrit, hypothèses, mesures logiques', 3],
  ['localisation', 'Défaut localisé et cause correctement identifiée', 2],
  ['reparation', 'Réparation soignée et essai final réussi', 2],
];
const REALISATION = [
  ['fix', 'Appareils et rosaces bien fixés, de niveau'],
  ['fin', 'Finitions posées et alignées, dans la couleur demandée'],
  ['boite', 'Boîte de dérivation : réserve ± 15 cm, conducteurs rangés, Wago bien enfoncés'],
  ['iso', 'Isolant jusqu\'à la borne, pas de cuivre apparent'],
  ['coul', 'Couleurs des conducteurs respectées'],
  ['poste', 'Poste de travail propre, outillage rangé'],
];
const DEP_CHAMPS = [
  ['symptome', 'Symptôme constaté', 'Ex. : la lampe 1 ne s\'allume pas avec S1, la lampe 2 fonctionne.'],
  ['hypotheses', 'Hypothèses (causes possibles)', 'Ex. : fil coupé entre S1 et la boîte, mauvaise connexion dans un Wago, ampoule…'],
  ['mesures', 'Mesures effectuées (hors tension) et résultats', 'Ex. : continuité L arrivée → borne L de S1 : OK ; borne 1 de S1 → L de la lampe : OL…'],
  ['cause', 'Cause trouvée', ''],
  ['reparation', 'Réparation effectuée', ''],
];

/* ---------- essais générés à partir de l'exercice ---------- */
const VAL = { cont: 'Continuité (≈ 0 Ω, bip)', ol: 'OL (pas de continuité)', conf: 'Conforme', nonconf: 'Non conforme' };
function lampesDe(ex, v) {
  return v.lampes.map((l, j) => {
    const par = ex.devices.map((t, i) => i).filter(i => (ex.cmd[i] || []).includes(j));
    return { j, nom: l.nom, court: 'L' + (j + 1), par, vv: par.some(i => ex.devices[i] === 'sch6') };
  });
}
function mesuresEssai(ex, v) {
  const R = [], reps = v.devices.map(d => d.rep);
  const lp = lampesDe(ex, v), serie = ex.montage === 'série';
  const prises = v.devices.filter(d => d.type === 'prise');
  R.push({ id: 'iso-ln', txt: 'Ampoules retirées, tous les interrupteurs fermés : entre L et N de l\'arrivée', att: 'ol' });
  R.push({ id: 'iso-lpe', txt: 'Tous les interrupteurs fermés : entre L et ⏚ de l\'arrivée', att: 'ol' });
  [...lp.map(l => [l.court, l.nom]), ...prises.map(p => [p.rep, 'la prise ' + p.rep])].forEach(([k, n]) => R.push({ id: 'pe-' + k, txt: `Conducteur de protection : ⏚ de l'arrivée → ⏚ de ${n}`, att: 'ohm', kind: 'ohm' }));
  if (serie) {
    const groupe = lp.filter(l => l.par.length);
    const d = groupe[0] && groupe[0].par[0];
    if (d != null) R.push({ id: 'serie', txt: `Ampoules en place, ${reps[d]} fermé : entre L et N de l'arrivée, la résistance des ampoules en série est mesurée (pas 0 Ω, pas OL)`, att: 'conf', kind: 'conf' });
  } else lp.forEach(l => {
    const sch2 = l.par.find(i => ex.devices[i] === 'sch2');
    if (sch2 != null) {
      R.push({ id: 'n-f-' + l.court, txt: `${reps[sch2]} fermé : N de l'arrivée → N de ${l.nom}`, att: 'cont' });
      R.push({ id: 'n-o-' + l.court, txt: `${reps[sch2]} ouvert : N de l'arrivée → N de ${l.nom}`, att: 'ol' });
    } else R.push({ id: 'n-' + l.court, txt: `Neutre : N de l'arrivée → N de ${l.nom}`, att: 'cont' });
    if (!l.par.length) return;
    if (l.vv) R.push({ id: 'vv-' + l.court, txt: `Basculer ${l.par.map(i => reps[i]).join(', puis ')} : à chaque manœuvre, la continuité L de l'arrivée → L de ${l.nom} s'établit ou se coupe`, att: 'conf', kind: 'conf' });
    else {
      const i = l.par[0], t = ex.devices[i] === 'sch5' ? ` (touche ${(ex.cmd[i] || []).indexOf(l.j) + 1})` : '';
      R.push({ id: 'c-f-' + l.court, txt: `${reps[i]}${t} fermé : L de l'arrivée → L de ${l.nom}`, att: 'cont' });
      R.push({ id: 'c-o-' + l.court, txt: `${reps[i]}${t} ouvert : L de l'arrivée → L de ${l.nom}`, att: 'ol' });
    }
  });
  prises.forEach(p => {
    R.push({ id: 'pl-' + p.rep, txt: `L de l'arrivée → L de la prise ${p.rep}`, att: 'cont' });
    R.push({ id: 'pn-' + p.rep, txt: `N de l'arrivée → N de la prise ${p.rep}`, att: 'cont' });
  });
  return R;
}
function testsProf(ex, v) {
  const T = [{ id: 'mesures', txt: 'Mesures hors tension faites et correctes avant la mise sous tension' }], reps = v.devices.map(d => d.rep);
  const lp = lampesDe(ex, v);
  if (ex.montage === 'série') {
    const g = lp.filter(l => l.par.length);
    if (g.length) T.push({ id: 'serie', txt: `${g.map(l => l.court).join(' et ')} s'allument ensemble avec ${reps[g[0].par[0]]} (éclairage plus faible : lampes en série)` });
  } else lp.forEach(l => {
    if (!l.par.length) return;
    if (l.vv) T.push({ id: 'l-' + l.court, txt: `${l.nom} s'allume et s'éteint depuis ${l.par.map(i => reps[i]).join(' et depuis ')}, dans toutes les positions` });
    else { const i = l.par[0], t = ex.devices[i] === 'sch5' ? ` (touche ${(ex.cmd[i] || []).indexOf(l.j) + 1})` : ''; T.push({ id: 'l-' + l.court, txt: `${l.nom} s'allume et s'éteint avec ${reps[i]}${t}` }); }
  });
  v.devices.forEach((d, i) => { if (d.type === 'sch2') T.push({ id: 'bip-' + d.rep, txt: `${d.rep} ouvert : plus de tension sur la phase ni sur le neutre de la lampe (VAT)` }); });
  v.devices.filter(d => d.type === 'prise').forEach(p => T.push({ id: 'pc-' + p.rep, txt: `Prise ${p.rep} : tension L–N ≈ 230 V, terre raccordée (testeur de prise)` }));
  T.push({ id: 'disj', txt: 'Pas de déclenchement du disjoncteur ni du différentiel, pas d\'échauffement' });
  return T;
}
function mesureOk(m, val) {
  if (val == null || val === '') return null;
  if (m.kind === 'ohm') { const x = parseFloat(String(val).replace(',', '.')); return isNaN(x) ? null : x <= 1; }
  return val === m.att;
}
function premierEssai(ep, tests) {
  const t = (ep && ep.tests) || {};
  if (tests.some(x => t[x.id] === 'ko')) return 'ko';
  return tests.every(x => t[x.id] === 'ok') ? 'ok' : '';
}
// proposition de note « Produit fini » /45 (null tant que le professeur n'a rien rempli)
function propositionProduit(ex, v, ep) {
  if (!ep || ex.kind === 'planche') return null;
  const tests = testsProf(ex, v), t = ep.tests || {}, r = ep.real || {};
  const remplis = Object.values(t).some(Boolean) || Object.values(r).some(Boolean);
  if (!remplis) return null;
  const real = PF.realisation * REALISATION.filter(([k]) => r[k] === 'ok').length / REALISATION.length;
  const ess = PF.essais * tests.filter(x => t[x.id] === 'ok').length / tests.length;
  const pr = premierEssai(ep, tests);
  let dep = 0;
  if (pr === 'ok') dep = PF.depannage;
  else if (pr === 'ko') dep = DEP_GRILLE.reduce((s, [k, , m]) => s + Math.min(m, Math.max(0, +((ep.dep || {})[k]) || 0)), 0);
  const arr = x => Math.round(x * 2) / 2;
  return { real: arr(real), essais: arr(ess), dep: arr(dep), total: arr(real + ess + dep), premier: pr };
}

/* ---------- feuille « Essais » ---------- */
function essaiProfCourant(d) { return USER.role === 'prof' && CTX.eleve ? (PV.essaiProf ||= {}) : (d.essaiProf ||= {}); }
function essaisSheet(sheet, ex, v, d) {
  const profEl = USER.role === 'prof' && CTX.eleve;
  const profEdit = USER.role === 'prof' && (CTX.eleve || !ONLINE);
  const eleveEdit = USER.role === 'eleve' && !d.remis;
  d.essais ||= {}; d.essais.mesures ||= {}; d.essais.dep ||= {};
  const ep = essaiProfCourant(d); ep.tests ||= {}; ep.real ||= {}; ep.dep ||= {};
  const M = mesuresEssai(ex, v), T = testsProf(ex, v);
  const tri = (k, val, nom) => `<span class="tri" role="group" aria-label="${esc(nom)}">${['ok', 'ko'].map(x => `<button type="button" class="tri-b ${x} ${val === x ? 'on' : ''}" data-${k}="${x}" ${profEdit ? '' : 'disabled'} aria-pressed="${val === x}">${x === 'ok' ? '✓ OK' : '✕ KO'}</button>`).join('')}</span>`;
  const draw = () => {
    const pr = premierEssai(ep, T), prop = propositionProduit(ex, v, ep);
    const nbM = M.filter(m => mesureOk(m, d.essais.mesures[m.id]) !== null).length;
    sheet.innerHTML = `${sheetHead('Essais', USER.role === 'eleve' ? 'Faites d\'abord les mesures hors tension, ampoules retirées et alimentation débranchée. Ensuite seulement, demandez l\'essai sous tension au professeur.' : 'L\'élève note ses mesures hors tension ; vous cochez l\'essai sous tension et la réalisation. L\'app propose la note « Produit fini » de la grille.', 'outils-multimetre')}
      <section class="ess-bloc"><h3>1. Mesures hors tension <span class="muted small">(par l'élève · ${nbM} / ${M.length})</span></h3>
        <div class="table-wrap"><table class="tbl ess-tbl"><thead><tr><th>N°</th><th>Mesure</th><th>Attendu</th><th>Résultat</th><th class="c"></th></tr></thead><tbody>
        ${M.map((m, i) => { const val = d.essais.mesures[m.id], ok = mesureOk(m, val);
          const champ = m.kind === 'ohm'
            ? `<span class="ohm"><input type="text" inputmode="decimal" data-mes="${m.id}" value="${esc(val || '')}" ${eleveEdit ? '' : 'disabled'} aria-label="Résultat ${i + 1}"> Ω</span>`
            : `<select data-mes="${m.id}" ${eleveEdit ? '' : 'disabled'} aria-label="Résultat ${i + 1}"><option value="">—</option>${(m.kind === 'conf' ? ['conf', 'nonconf'] : ['cont', 'ol']).map(o => `<option value="${o}" ${val === o ? 'selected' : ''}>${VAL[o]}</option>`).join('')}</select>`;
          return `<tr><td class="mono">${i + 1}</td><td>${esc(m.txt)}</td><td class="muted small">${m.kind === 'ohm' ? '≤ 1 Ω' : VAL[m.att]}</td><td>${champ}</td><td class="c">${ok === null ? '' : ok ? '<span class="ok-txt" title="Conforme">✓</span>' : '<span class="ko-txt" title="Pas conforme : cherchez l\'erreur avant l\'essai">✕</span>'}</td></tr>`; }).join('')}
        </tbody></table></div>
        ${USER.role === 'eleve' && M.some(m => mesureOk(m, d.essais.mesures[m.id]) === false) ? '<p class="notice">Une mesure n\'est pas conforme : ne demandez pas l\'essai sous tension. Recherchez d\'abord l\'erreur, hors tension.</p>' : ''}
      </section>
      <section class="ess-bloc"><h3>2. Essai sous tension <span class="muted small">(par le professeur)</span></h3>
        ${!profEdit && !Object.values(ep.tests).some(Boolean) ? '<p class="muted">Pas encore fait. La mise sous tension se fait uniquement en présence du professeur.</p>' : `
        <ul class="ess-list">${T.map(x => `<li><span>${esc(x.txt)}</span>${tri('test', ep.tests[x.id], x.txt).replace(/data-test="/g, `data-t="${x.id}" data-test="`)}</li>`).join('')}</ul>
        <p class="ess-res ${pr}">${pr === 'ok' ? '✓ Fonctionne du premier coup.' : pr === 'ko' ? '✕ Ne fonctionne pas du premier coup : dépannage.' : 'Résultat : à compléter.'}</p>`}
      </section>
      ${pr === 'ko' || (d.essais.dep && Object.values(d.essais.dep).some(Boolean)) ? `<section class="ess-bloc dep"><h3>3. Dépannage</h3>
        <p class="muted">${USER.role === 'eleve' ? 'Avant toute intervention : coupez, consignez, vérifiez l\'absence de tension. Notez votre démarche au fur et à mesure.' : 'Fiche remplie par l\'élève. Notez sa démarche avec la grille.'}</p>
        <div class="form-grid dep-fiche">${DEP_CHAMPS.map(([k, n, ph]) => `<label>${n}<textarea rows="2" data-dep="${k}" placeholder="${esc(ph)}" ${eleveEdit ? '' : 'disabled'}>${esc(d.essais.dep[k] || '')}</textarea></label>`).join('')}</div>
        <h4>Grille de dépannage <span class="muted small">(par le professeur, /${PF.depannage})</span></h4>
        <table class="tbl grille"><tbody>${DEP_GRILLE.map(([k, n, m]) => `<tr><td>${n}</td><td class="num">${profEdit ? `<input type="text" inputmode="decimal" class="mono g-in" data-dg="${k}" value="${ep.dep[k] == null ? '' : String(ep.dep[k]).replace('.', ',')}" aria-label="${esc(n)}">` : `<span class="mono">${ep.dep[k] == null || ep.dep[k] === '' ? '—' : num(+ep.dep[k])}</span>`}</td><td class="num mono">${m}</td></tr>`).join('')}</tbody></table>
        <div class="ess-apres"><span>Essai après réparation</span>${tri('apres', ep.apres, 'Essai après réparation')}</div>
      </section>` : pr === 'ok' ? `<section class="ess-bloc"><h3>3. Dépannage</h3><p class="ess-res ok">Le montage a fonctionné du premier coup : pas de dépannage, points maximum (${PF.depannage} / ${PF.depannage}).</p></section>` : ''}
      <section class="ess-bloc"><h3>4. Réalisation <span class="muted small">(par le professeur)</span></h3>
        ${!profEdit && !Object.values(ep.real).some(Boolean) ? '<p class="muted">Pas encore évaluée.</p>' : `<ul class="ess-list">${REALISATION.map(([k, n]) => `<li><span>${esc(n)}</span>${tri('real', ep.real[k], n).replace(/data-real="/g, `data-r="${k}" data-real="`)}</li>`).join('')}</ul>`}
      </section>
      ${prop ? `<section class="ess-bloc pf"><h3>Produit fini : ${num(prop.total)} / 45</h3>
        <p class="muted small">Réalisation ${num(prop.real)} / ${PF.realisation} · Essais ${num(prop.essais)} / ${PF.essais} · Dépannage ${num(prop.dep)} / ${PF.depannage}${USER.role === 'prof' ? ' — proposition reprise dans la grille de correction, modifiable.' : ''}</p></section>` : ''}
      ${profEdit ? `<label class="corr-com" for="ess-com">Remarque du professeur</label><textarea id="ess-com" rows="2">${esc(ep.commentaire || '')}</textarea>
        <div class="row wrapr"><button type="button" class="btn primary" id="ess-save">${ONLINE ? 'Enregistrer l\'essai' : 'Enregistrer (démo)'}</button><span id="ess-msg" class="muted small" role="status"></span></div>`
        : ep.commentaire ? `<div class="corr-comment"><span class="k">Remarque du professeur</span><p>${esc(ep.commentaire)}</p></div>` : ''}`;
    bindFiches(sheet);
    sheet.querySelectorAll('[data-mes]').forEach(el => el.addEventListener('change', () => { d.essais.mesures[el.dataset.mes] = el.value.trim(); save(); draw(); }));
    sheet.querySelectorAll('[data-dep]').forEach(el => el.addEventListener('input', () => { d.essais.dep[el.dataset.dep] = el.value; save(); }));
    const marquer = () => { const m = $('#ess-msg', sheet); if (m) m.textContent = 'Modifications non enregistrées.'; };
    sheet.querySelectorAll('[data-t]').forEach(b => b.addEventListener('click', () => { const k = b.dataset.t; ep.tests[k] = ep.tests[k] === b.dataset.test ? '' : b.dataset.test; draw(); marquer(); }));
    sheet.querySelectorAll('[data-r]').forEach(b => b.addEventListener('click', () => { const k = b.dataset.r; ep.real[k] = ep.real[k] === b.dataset.real ? '' : b.dataset.real; draw(); marquer(); }));
    sheet.querySelectorAll('[data-apres]').forEach(b => b.addEventListener('click', () => { ep.apres = ep.apres === b.dataset.apres ? '' : b.dataset.apres; draw(); marquer(); }));
    sheet.querySelectorAll('[data-dg]').forEach(i => i.addEventListener('change', () => { const t = i.value.trim().replace(',', '.'); ep.dep[i.dataset.dg] = t === '' ? null : Math.max(0, +t || 0); draw(); marquer(); }));
    const com = $('#ess-com', sheet); if (com) com.addEventListener('input', () => { ep.commentaire = com.value; marquer(); });
    const sv = $('#ess-save', sheet);
    if (sv) sv.addEventListener('click', async () => {
      ep.premier = premierEssai(ep, T);
      if (!ONLINE || !CTX.eleve) { if (!CTX.eleve) { d.essaiProf = ep; save(); } $('#ess-msg', sheet).textContent = 'Enregistré sur cet appareil.'; return; }
      sv.disabled = true; $('#ess-msg', sheet).textContent = 'Enregistrement…';
      try { await api('profEssai', { email: CTX.eleve, ex: ex.id, essai: ep }); ELEVES = null; $('#ess-msg', sheet).textContent = 'Enregistré.'; }
      catch (e) { $('#ess-msg', sheet).textContent = e.message; }
      finally { sv.disabled = false; }
    });
  };
  draw();
}
function essaisComplets(ex, v, d) {
  const M = mesuresEssai(ex, v), m = (d.essais && d.essais.mesures) || {};
  return M.every(x => mesureOk(x, m[x.id]) !== null);
}

/* ---------- photo annotée ---------- */
const PHOTO_CACHE = {};
const ANNOT_ROUGE = '#e11d2e';
function svgAnnot(items, W, H, uid) {
  const sw = Math.max(3, W * 0.006), fs = Math.max(16, W * 0.03);
  return `<defs><marker id="ah${uid}" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="4" markerHeight="4" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="${ANNOT_ROUGE}"/></marker></defs>` +
    (items || []).map(a => {
      if (a.t === 'cercle') return `<ellipse cx="${a.x * W}" cy="${a.y * H}" rx="${Math.abs(a.rx) * W}" ry="${Math.abs(a.ry) * H}" fill="none" stroke="${ANNOT_ROUGE}" stroke-width="${sw}"/>`;
      if (a.t === 'fleche') return `<line x1="${a.x1 * W}" y1="${a.y1 * H}" x2="${a.x2 * W}" y2="${a.y2 * H}" stroke="${ANNOT_ROUGE}" stroke-width="${sw}" stroke-linecap="round" marker-end="url(#ah${uid})"/>`;
      if (a.t === 'trait') return `<polyline points="${a.pts.map(([x, y]) => `${(x * W).toFixed(1)},${(y * H).toFixed(1)}`).join(' ')}" fill="none" stroke="${ANNOT_ROUGE}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"/>`;
      if (a.t === 'texte') return `<text x="${a.x * W}" y="${a.y * H}" font-size="${fs}" font-weight="700" fill="${ANNOT_ROUGE}" stroke="#fff" stroke-width="${fs * 0.12}" paint-order="stroke" font-family="system-ui, sans-serif">${esc(a.s)}</text>`;
      return '';
    }).join('');
}
let ANNOT_UID = 0;
function htmlPhotoAnnotee(url, annot) {
  const uid = ++ANNOT_UID;
  return `<div class="annot-wrap" data-annot-uid="${uid}"><img src="${url}" alt="Photo du montage annotée par le professeur"><svg class="annot-svg" aria-hidden="true"></svg></div>`;
}
function poserAnnotations(root, annot) {
  root.querySelectorAll('.annot-wrap').forEach(w => {
    const img = w.querySelector('img'), svg = w.querySelector('svg');
    const go2 = () => { const W = img.naturalWidth || 1000, H = img.naturalHeight || 750; svg.setAttribute('viewBox', `0 0 ${W} ${H}`); svg.innerHTML = svgAnnot(annot.items, W, H, w.dataset.annotUid); };
    if (img.complete && img.naturalWidth) go2(); else img.addEventListener('load', go2, { once: true });
  });
}
async function urlPhoto(id) {
  if (!id) return null;
  if (PHOTO_CACHE[id]) return PHOTO_CACHE[id];
  if (!ONLINE) return null;
  const u = await api(USER.role === 'prof' ? 'profPhoto' : 'monFichier', { id });
  PHOTO_CACHE[id] = u; return u;
}
// bloc à afficher (élève ou prof) ; remplit le conteneur, même s'il a été déplacé
function blocPhotoAnnotee(box, annot) {
  if (!annot || !annot.items || !annot.items.length) { box.innerHTML = ''; return; }
  const titre = '<h3>Photo annotée par le professeur</h3>';
  const remplir = u => { box.innerHTML = titre + htmlPhotoAnnotee(u, annot); poserAnnotations(box, annot); };
  if (PHOTO_CACHE[annot.photoId]) return remplir(PHOTO_CACHE[annot.photoId]);
  box.innerHTML = titre + '<p class="muted">Chargement de la photo…</p>';
  urlPhoto(annot.photoId).then(u => { if (u) remplir(u); else box.innerHTML = titre + '<p class="muted">Photo indisponible hors connexion.</p>'; })
    .catch(e => { box.innerHTML = titre + `<p class="err">${esc(e.message)}</p>`; });
}
function editeurAnnotations(url, annot, onFin) {
  const dlg = $('#dlg');
  const items = (annot && annot.items ? annot.items : []).map(a => JSON.parse(JSON.stringify(a)));
  let outil = 'cercle', cours = null;
  dlg.innerHTML = `<div class="dlg-in annot-dlg"><div class="dlg-head"><div><span class="eyebrow">Correction</span><h2>Annoter la photo du montage</h2></div><button type="button" class="ibtn" data-close aria-label="Fermer">✕</button></div>
    <div class="annot-tools" role="toolbar" aria-label="Outils d'annotation">
      ${[['cercle', '◯ Entourer'], ['fleche', '↗ Flèche'], ['trait', '✎ Trait libre'], ['texte', 'T Texte']].map(([k, l]) => `<button type="button" class="chip ${k === outil ? 'on' : ''}" data-outil="${k}">${l}</button>`).join('')}
      <input id="an-txt" type="text" placeholder="Texte à poser, puis cliquez sur la photo" maxlength="60">
      <button type="button" class="btn small ghost" id="an-undo">Annuler le dernier</button>
      <button type="button" class="btn small ghost" id="an-clear">Tout effacer</button>
    </div>
    <div class="annot-wrap edit"><img src="${url}" alt="Photo du montage"><svg class="annot-svg"></svg></div>
    <div class="row wrapr"><button type="button" class="btn primary" id="an-ok">Terminer</button><span class="muted small">Les annotations partent avec la correction quand vous la publiez.</span></div></div>`;
  const img = $('.annot-wrap img', dlg), svg = $('.annot-wrap svg', dlg), txt = $('#an-txt', dlg);
  let W = 1000, H = 750;
  const dessiner = () => { svg.innerHTML = svgAnnot(cours ? [...items, cours] : items, W, H, 'ed'); };
  const init = () => { W = img.naturalWidth || 1000; H = img.naturalHeight || 750; svg.setAttribute('viewBox', `0 0 ${W} ${H}`); dessiner(); };
  if (img.complete && img.naturalWidth) init(); else img.addEventListener('load', init, { once: true });
  txt.style.display = 'none';
  dlg.querySelectorAll('[data-outil]').forEach(b => b.addEventListener('click', () => {
    outil = b.dataset.outil; dlg.querySelectorAll('[data-outil]').forEach(x => x.classList.toggle('on', x === b));
    txt.style.display = outil === 'texte' ? '' : 'none'; if (outil === 'texte') txt.focus();
  }));
  const pos = e => { const r = svg.getBoundingClientRect(); return [Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), Math.min(1, Math.max(0, (e.clientY - r.top) / r.height))]; };
  svg.addEventListener('pointerdown', e => {
    e.preventDefault(); const [x, y] = pos(e);
    if (outil === 'texte') { const s = txt.value.trim(); if (!s) { txt.focus(); txt.placeholder = 'Tapez d\'abord le texte'; return; } items.push({ t: 'texte', x, y, s }); txt.value = ''; dessiner(); return; }
    svg.setPointerCapture(e.pointerId);
    cours = outil === 'cercle' ? { t: 'cercle', x, y, rx: 0, ry: 0, x0: x, y0: y } : outil === 'fleche' ? { t: 'fleche', x1: x, y1: y, x2: x, y2: y } : { t: 'trait', pts: [[x, y]] };
  });
  svg.addEventListener('pointermove', e => {
    if (!cours) return; const [x, y] = pos(e);
    if (cours.t === 'cercle') { cours.x = (cours.x0 + x) / 2; cours.y = (cours.y0 + y) / 2; cours.rx = Math.abs(x - cours.x0) / 2; cours.ry = Math.abs(y - cours.y0) / 2; }
    else if (cours.t === 'fleche') { cours.x2 = x; cours.y2 = y; }
    else cours.pts.push([+x.toFixed(4), +y.toFixed(4)]);
    dessiner();
  });
  const fin = () => {
    if (!cours) return;
    const c = cours; cours = null;
    const petit = (c.t === 'cercle' && c.rx < 0.01 && c.ry < 0.01) || (c.t === 'fleche' && Math.hypot(c.x2 - c.x1, c.y2 - c.y1) < 0.015) || (c.t === 'trait' && c.pts.length < 2);
    if (!petit) { delete c.x0; delete c.y0; if (c.t === 'trait' && c.pts.length > 400) c.pts = c.pts.filter((p, i) => i % Math.ceil(c.pts.length / 400) === 0); items.push(c); }
    dessiner();
  };
  svg.addEventListener('pointerup', fin); svg.addEventListener('pointercancel', fin);
  $('#an-undo', dlg).addEventListener('click', () => { items.pop(); dessiner(); });
  $('#an-clear', dlg).addEventListener('click', () => { items.length = 0; dessiner(); });
  const fermer = () => { dlg.close(); onFin(items); };
  $('#an-ok', dlg).addEventListener('click', fermer);
  dlg.querySelector('[data-close]').addEventListener('click', fermer);
  dlg.showModal();
}
