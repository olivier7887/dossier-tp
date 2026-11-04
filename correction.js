/* =========================================================
   Dossier TP — correction automatique (V2)
   Chaque partie renvoie des constats : { g: 'ok' | 'remarque' | 'erreur', msg, code?, fiche? }
   Le barème est réparti dans la grille du cours (/215) :
     Normes /40 · Processus /80 · Communication /50 · Produit fini /45 (prof)
   ========================================================= */
const BAREME = {
  principe: 25, unifilaire: 20, cablage: 35,      // Processus /80
  bdc: 30, tva: 10, outils: 10,                    // Communication /50
  normes: 40, produit: 45,
  retrait: { erreur: 6, remarque: 2 },             // points retirés dans une partie
  retraitNormes: { erreur: 8, remarque: 3 },       // points retirés en Normes (constats avec code RGIE)
};

/* ---------- références ---------- */
const COMPLET = { sch1: '61100', sch2: '61200', sch5: '61500', sch6: '61600', sch7: '61700', prise: ['66600', '66100'] };
const SOCLE = { sch1: ['170-01100', '170-01105'], sch2: ['170-01200', '170-01205'], sch5: ['170-01500', '170-01505'], sch6: ['170-01600', '170-01605'], sch7: ['170-01700', '170-01705'], prise: ['170-33100', '170-32100', '170-33105', '170-32105'] };
const SET_FIN = { sch1: '61105', sch2: '61105', sch6: '61105', sch7: '61105', sch5: '61505', prise: ['66601', '66101'] };
const CODE_COUL = { 'crème': '100', 'blanc': '101', 'gris clair': '102' };
const FIL_COUL = { bleu: 'bleu', vj: 'vert-jaune', brun: 'brun', noir: 'noir', gris: 'gris', rouge: 'rouge' };
// Matériel de la planche (TP 0) : proposition à valider par le professeur
const REF_PLANCHE = [
  { nom: 'Rosaces en bois 95 × 95', ids: ['ISR1'], min: 3, max: 3 },
  { nom: 'Boîte de dérivation 75 × 75', ids: ['BD75'], min: 1, max: 1 },
  { nom: 'Boîte en saillie simple', match: /^10[012]-77100$/, min: 1, max: 1 },
  { nom: 'Boîtes en saillie doubles', match: /^10[012]-77500$/, min: 2, max: 2 },
  { nom: 'Embouts M20 pour les boîtes en saillie', match: /^[13]1-866$/, min: 3, max: 4 },
  { nom: 'Tube PVC Ø 16 (m)', ids: ['LLG16'], min: 1.3, max: 4.5, alim: 16 },
  { nom: 'Tube PVC Ø 20 (m)', ids: ['LLG20'], min: 0.9, max: 4, alim: 20 },
  { nom: 'Attaches Ø 16', ids: ['RDA16', 'PGL16'], min: 8, max: 16, alimN: 16 },
  { nom: 'Attaches Ø 20', ids: ['RDA20', 'PGL20'], min: 8, max: 16, alimN: 20 },
  { nom: 'Vis à bois (boîte)', ids: ['VIS4530', 'VIS3015'], min: 1, max: 2 },
];
const REF_OUTILS = {
  planche: ['metre', 'crayon', 'equerre', 'niveau', 'scie-junior', 'ebavureur', 'ressort-16', 'ressort-20', 'visseuse', 'tv-pz2', 'lunettes'],
  cablage: ['pince-coupante', 'pince-denuder', 'pince-longbec', 'tv-pz1', 'tv-4', 'jokari', 'tire-fils', 'multimetre', 'cadenas', 'lunettes'],
};

/* ---------- outils ---------- */
function UF() {
  const p = new Map();
  const f = x => { if (!p.has(x)) p.set(x, x); while (p.get(x) !== x) { p.set(x, p.get(p.get(x))); x = p.get(x); } return x; };
  return { find: f, union: (a, b) => { a = f(a); b = f(b); if (a !== b) p.set(a, b); }, clone() { const u = UF(); for (const [k] of p) u.union(k, f(k)); return u; } };
}
const maj1 = s => s.charAt(0).toUpperCase() + s.slice(1);
const nomType = t => APPAREILS[t] ? `${APPAREILS[t].nom.toLowerCase()} (${APPAREILS[t].court})` : t;
const pl = n => n > 1 ? 's' : '';

/* =========================================================
   Simulation commune : réseau de « nets », contacts, charges
   circuit = { base: UF, P, N, PE, switches: [{ id, type, etats: [[[a,b],…] par état], vars }], lamps: [{ id, a, b }], prises: [{ id, L, N, PE }] }
   ========================================================= */
function etatsCombinaisons(switches) {
  // chaque interrupteur a une ou deux « touches » (sch5)
  const touches = [];
  switches.forEach(s => { for (let k = 0; k < s.touches.length; k++) touches.push([s, k]); });
  const out = [];
  const n = touches.length;
  for (let m = 0; m < (1 << n); m++) {
    const etat = new Map();
    touches.forEach(([s, k], i) => { const arr = etat.get(s.id) || []; arr[k] = (m >> i) & 1; etat.set(s.id, arr); });
    out.push(etat);
  }
  return { touches, liste: out };
}
function resoudre(c, etat) {
  const u = c.base.clone();
  for (const s of c.switches) {
    const st = etat.get(s.id) || [];
    s.touches.forEach((t, k) => { for (const [a, b] of t[st[k] || 0]) u.union(a, b); });
  }
  const P = u.find(c.P), N = u.find(c.N), PE = u.find(c.PE);
  // lampes allumées : présentes sur un chemin simple P → N (graphe des nets, arêtes = lampes)
  const aretes = c.lamps.map(l => ({ id: l.id, a: u.find(l.a), b: u.find(l.b) }));
  const allumees = new Set();
  const dfs = (noeud, vus, chemin) => {
    if (noeud === N) { chemin.forEach(id => allumees.add(id)); return; }
    for (const e of aretes) {
      if (chemin.includes(e.id)) continue;
      const suivant = e.a === noeud ? e.b : e.b === noeud ? e.a : null;
      if (suivant === null || vus.has(suivant)) continue;
      vus.add(suivant); dfs(suivant, vus, [...chemin, e.id]); vus.delete(suivant);
    }
  };
  if (P !== N) dfs(P, new Set([P]), []);
  return { u, P, N, PE, allumees, court: P === N, defautTerre: P === PE || N === PE };
}
function analyser(c) {
  const { touches, liste } = etatsCombinaisons(c.switches);
  const etats = liste.map(e => ({ e, r: resoudre(c, e) }));
  const res = { etats, touches, courts: etats.filter(x => x.r.court), defauts: etats.filter(x => x.r.defautTerre) };
  // qui commande quelle lampe : basculer une touche change-t-il l'état de la lampe ?
  res.commande = new Map(c.lamps.map(l => [l.id, new Set()]));
  res.toujours = new Map(c.lamps.map(l => [l.id, true]));
  for (const l of c.lamps) {
    for (const x of etats) if (!x.r.allumees.has(l.id)) res.toujours.set(l.id, false);
  }
  touches.forEach(([s, k]) => {
    for (const x of etats) {
      const autre = new Map([...x.e].map(([id, arr]) => [id, arr.slice()]));
      autre.get(s.id)[k] = 1 - (x.e.get(s.id)[k] || 0);
      const y = etats.find(z => [...z.e].every(([id, arr]) => arr.every((v, i) => v === autre.get(id)[i])));
      for (const l of c.lamps) if (x.r.allumees.has(l.id) !== y.r.allumees.has(l.id)) res.commande.get(l.id).add(s.id + '#' + k);
    }
  });
  // une touche commande-t-elle la lampe dans TOUS les états (vrai va-et-vient) ?
  res.toujoursCommande = (lampId, swId, k) => etats.every(x => {
    const autre = new Map([...x.e].map(([id, arr]) => [id, arr.slice()]));
    autre.get(swId)[k] = 1 - (x.e.get(swId)[k] || 0);
    const y = etats.find(z => [...z.e].every(([id, arr]) => arr.every((v, i) => v === autre.get(id)[i])));
    return x.r.allumees.has(lampId) !== y.r.allumees.has(lampId);
  });
  return res;
}
function contactsType(type, T) {
  // T(i) = clé de la borne i ; renvoie les touches : [[contacts état 0], [contacts état 1]]
  switch (type) {
    case 'sch1': return [[[], [[T('L'), T('1')]]]];
    case 'sch2': return [[[], [[T('L1'), T('1')], [T('L2'), T('2')]]]];
    case 'sch5': return [[[], [[T('L'), T('1')]]], [[], [[T('L'), T('2')]]]];
    case 'sch6': return [[[[T('L'), T('1')]], [[T('L'), T("1'")]]]];
    case 'sch7': return [[[[T('a'), T('b')], [T('d'), T('c')]], [[T('a'), T('c')], [T('d'), T('b')]]]];
    default: return [];
  }
}

/* ---------- constats fonctionnels communs (principe et câblage) ---------- */
function constatsFonction(c, A, attendu, lieu) {
  const F = [];
  if (A.courts.length) F.push({ g: 'erreur', msg: `Court-circuit : la phase touche directement le neutre${A.courts.length < A.etats.length ? ' dans certaines positions des interrupteurs' : ''}.`, fiche: 'regles-securite' });
  if (A.defauts.length) F.push({ g: 'erreur', msg: 'La terre (PE) est reliée à la phase ou au neutre.', code: '1801', fiche: 'fils' });
  if (A.courts.length) return F;
  for (const l of c.lamps) {
    const cmd = A.commande.get(l.id);
    if (A.toujours.get(l.id)) F.push({ g: 'erreur', msg: `${l.nom} reste toujours allumée : elle n'est commandée par aucun interrupteur.` });
    else if (!A.etats.some(x => x.r.allumees.has(l.id))) F.push({ g: 'erreur', msg: `${l.nom} ne s'allume jamais : vérifiez la phase, le retour et le neutre jusqu'à la douille.` });
    else if (!cmd.size) F.push({ g: 'erreur', msg: `${l.nom} n'est commandée par aucun interrupteur.` });
  }
  // correspondance avec l'énoncé
  for (const e of attendu.lampes) {
    const l = c.lamps.find(x => x.ref === e.ref);
    if (!l) continue;
    const cmdIds = [...A.commande.get(l.id)].map(s => s.split('#')[0]);
    const types = cmdIds.map(id => (c.switches.find(s => s.id === id) || {}).type).sort();
    const ok = JSON.stringify([...new Set(types)].sort()) === JSON.stringify([...new Set(e.types)].sort());
    if (A.toujours.get(l.id) || !A.etats.some(x => x.r.allumees.has(l.id))) continue;
    if (!ok) F.push({ g: 'erreur', msg: `${l.nom} devrait être commandée par ${e.types.map(nomType).join(' et ')} ; dans votre ${lieu}, elle l'est par ${types.length ? [...new Set(types)].map(nomType).join(' et ') : 'aucun interrupteur'}.` });
    else if (e.pos && lieu === 'schéma de câblage') {
      const pos = [...new Set(cmdIds.map(id => (c.switches.find(s => s.id === id) || {}).pos))].sort();
      if (JSON.stringify(pos) !== JSON.stringify([...e.pos].sort())) F.push({ g: 'erreur', msg: `${l.nom} est commandée depuis le mauvais emplacement (voir l'énoncé).` });
    }
    // va-et-vient : chaque interrupteur doit TOUJOURS pouvoir changer l'état de la lampe
    if (ok && e.types.filter(t => t === 'sch6').length >= 2) {
      const vv = c.switches.filter(s => s.type === 'sch6' && cmdIds.includes(s.id));
      if (!vv.every(s => A.toujoursCommande(l.id, s.id, 0))) F.push({ g: 'erreur', msg: `Va-et-vient de ${l.nom} mal raccordé : un des deux interrupteurs ne commande plus la lampe dans certaines positions. Vérifiez les navettes (1 et 1') et les communs (L).`, fiche: 'app-sch6' });
      else F.push({ g: 'ok', msg: `Le va-et-vient de ${l.nom} fonctionne depuis les deux endroits.` });
    } else if (ok) F.push({ g: 'ok', msg: `${l.nom} est commandée par ${e.types.map(nomType).join(' et ')}, comme demandé.` });
  }
  // double allumage : chaque touche commande une lampe différente
  for (const s of c.switches.filter(s => s.type === 'sch5')) {
    const parTouche = [0, 1].map(k => c.lamps.filter(l => A.commande.get(l.id).has(s.id + '#' + k)).map(l => l.id).join());
    if (parTouche[0] && parTouche[1] && parTouche[0] === parTouche[1]) F.push({ g: 'erreur', msg: 'Les deux touches du double allumage commandent la même lampe : chaque touche doit commander sa propre lampe.', fiche: 'app-sch5' });
  }
  // série / parallèle
  if (attendu.montage === 'série' || attendu.montage === 'parallèle') {
    const etatsAllumes = A.etats.filter(x => x.r.allumees.size);
    const serie = c.lamps.length === 2 && etatsAllumes.length && etatsAllumes.every(x => {
      // en série : aucune lampe seule ne relie P à N
      return c.lamps.every(l => { const a = x.r.u.find(l.a), b = x.r.u.find(l.b); return !((a === x.r.P && b === x.r.N) || (a === x.r.N && b === x.r.P)); });
    });
    if (attendu.montage === 'série' && etatsAllumes.length) F.push(serie ? { g: 'ok', msg: 'Les deux lampes sont bien en série.' } : { g: 'erreur', msg: 'Les lampes devaient être raccordées en série (l\'une à la suite de l\'autre) : ici, chacune reçoit directement la phase et le neutre.' });
    if (attendu.montage === 'parallèle' && etatsAllumes.length) F.push(!serie ? { g: 'ok', msg: 'Les deux lampes sont bien en parallèle.' } : { g: 'erreur', msg: 'Les lampes devaient être en parallèle (chacune entre la phase commandée et le neutre) : ici, elles sont en série.' });
  }
  // coupure : unipolaire = phase (1902), bipolaire = phase ET neutre
  for (const l of c.lamps) {
    const cmd = [...A.commande.get(l.id)].map(s => c.switches.find(x => x.id === s.split('#')[0]));
    if (!cmd.length || A.toujours.get(l.id)) continue;
    const eteints = A.etats.filter(x => !x.r.allumees.has(l.id));
    if (cmd.every(s => s && s.type === 'sch2')) {
      const coupeTout = eteints.every(x => [l.a, l.b].every(t => { const n = x.r.u.find(t); return n !== x.r.P && n !== x.r.N; }));
      F.push(coupeTout ? { g: 'ok', msg: `Le bipolaire coupe la phase et le neutre de ${l.nom}.` } : { g: 'erreur', msg: `Quand ${l.nom} est éteinte, elle reste reliée à la phase ou au neutre : un interrupteur bipolaire doit couper les deux.`, fiche: 'app-sch2' });
    } else if (attendu.montage !== 'série') {
      const phaseRestee = eteints.some(x => [l.a, l.b].some(t => x.r.u.find(t) === x.r.P));
      if (phaseRestee) F.push({ g: 'erreur', msg: `${l.nom} : l'interrupteur coupe le neutre au lieu de la phase. Une lampe éteinte ne peut pas rester sous tension.`, code: '1902', fiche: 'app-sch1' });
      else F.push({ g: 'ok', msg: `L'interrupteur de ${l.nom} coupe bien la phase.`, code: '1902' });
    }
  }
  // prises : phase et neutre permanents, terre
  for (const p of c.prises) {
    const ok = A.etats.every(x => { const a = x.r.u.find(p.L), b = x.r.u.find(p.N); return (a === x.r.P && b === x.r.N) || (a === x.r.N && b === x.r.P); });
    F.push(ok ? { g: 'ok', msg: 'La prise reçoit la phase et le neutre en permanence.' } : { g: 'erreur', msg: 'La prise doit recevoir la phase et le neutre en permanence (elle n\'est pas commandée par un interrupteur).', fiche: 'app-prise' });
    const terre = c.base.find(p.PE) === c.base.find(c.PE);
    F.push(terre ? { g: 'ok', msg: 'Le contact de terre de la prise est raccordé.', code: '1218' } : { g: 'erreur', msg: 'Le contact de terre de la prise n\'est pas raccordé à la terre.', code: '1218', fiche: 'app-prise' });
  }
  return F;
}

/* =========================================================
   1. Schéma de câblage
   ========================================================= */
function attenduExercice(ex, v) {
  const lampes = v.lampes.map((l, j) => {
    const devs = v.devices.filter((d, i) => (ex.cmd[i] || []).includes(j));
    return { ref: l.pl, nom: l.nom, types: devs.map(d => d.type), pos: devs.map(d => d.pos) };
  });
  return { lampes, montage: ex.montage, prise: ex.devices.includes('prise') };
}
function corrigerCablage(ex, v, st) {
  const F = [];
  st = st || {};
  const placed = st.placed || {}, douilles = st.douilles || {}, wires = st.wires || [], nodes = st.nodes || [];
  if (!wires.length && !Object.keys(placed).length) return [{ g: 'erreur', msg: 'Le schéma de câblage est vide.' }];
  // emplacements
  for (const d of v.devices) {
    const t = placed[d.pos];
    if (!t) F.push({ g: 'erreur', msg: `Il manque ${nomType(d.type)} au ${d.empl}.` });
    else if (t !== d.type) F.push({ g: 'erreur', msg: `Au ${d.empl}, il faut ${nomType(d.type)} et non ${nomType(t)}.` });
  }
  for (const pos in placed) if (!v.devices.some(d => d.pos === pos)) F.push({ g: 'erreur', msg: `${maj1(nomType(placed[pos]))} placé à un emplacement non prévu (${PLANCHE.positions.find(p => p.id === pos).nom}).` });
  for (const l of v.lampes) if (!douilles[l.pl]) F.push({ g: 'erreur', msg: `Il manque la douille du ${l.empl}.` });
  for (const p in douilles) if (!v.lampes.some(l => l.pl === p)) F.push({ g: 'remarque', msg: `Douille posée sur un point lumineux non utilisé (${PLANCHE.points.find(x => x.id === p).nom}).` });
  if (!F.some(f => f.g === 'erreur')) F.push({ g: 'ok', msg: 'Appareils et douilles aux bons emplacements.' });
  // réseau
  const key = ep => ep.k === 'dev' ? `d:${ep.pos}:${ep.t}` : ep.k === 'lamp' ? `l:${ep.pl}:${ep.t}` : ep.k === 'alim' ? `a:${ep.t}` : `n:${ep.id}`;
  const base = UF();
  ['a:L', 'a:N', 'a:PE'].forEach(k => base.find(k));
  for (const w of wires) base.union(key(w.a), key(w.b));
  const c = { base, P: 'a:L', N: 'a:N', PE: 'a:PE', switches: [], lamps: [], prises: [] };
  for (const pos in placed) {
    const t = placed[pos], T = b => `d:${pos}:${b}`;
    if (t === 'prise') c.prises.push({ id: pos, L: T('L'), N: T('N'), PE: T('⏚') });
    else c.switches.push({ id: pos, pos, type: t, touches: contactsType(t, T) });
  }
  for (const p in douilles) {
    const lv = v.lampes.find(l => l.pl === p);
    c.lamps.push({ id: p, ref: p, nom: lv ? lv.nom : `La lampe du ${PLANCHE.points.find(x => x.id === p).nom}`, a: `l:${p}:L`, b: `l:${p}:N`, PE: `l:${p}:⏚`, L: `l:${p}:L`, Nb: `l:${p}:N` });
  }
  const A = analyser(c);
  F.push(...constatsFonction(c, A, attenduExercice(ex, v), 'schéma de câblage'));
  // douille : neutre sur la languette
  if (!A.courts.length) for (const l of c.lamps) {
    const surN = t => A.etats.every(x => x.r.u.find(t) === x.r.N);
    if (surN(l.L) && !surN(l.Nb)) F.push({ g: 'remarque', msg: `${l.nom} : le neutre arrive sur le plot central. Mettez le neutre sur la languette et la phase (retour) sur le plot central.`, fiche: 'app-douille' });
    const terre = base.find(l.PE) === base.find(c.PE);
    if (!terre) F.push({ g: 'erreur', msg: `La terre n'est pas amenée jusqu'au point lumineux de ${l.nom}.`, code: '1214', fiche: 'fils' });
  }
  if (c.lamps.length && c.lamps.every(l => base.find(l.PE) === base.find(c.PE))) F.push({ g: 'ok', msg: 'La terre est amenée à chaque point lumineux.', code: '1214' });
  // couleurs
  const fonctionNet = k => {
    const n = A.etats.map(x => x.r.u.find(k));
    if (A.etats.every((x, i) => n[i] === x.r.PE)) return 'PE';
    if (A.etats.some((x, i) => n[i] === x.r.N) && !A.etats.some((x, i) => n[i] === x.r.P)) return 'N';
    return 'L';
  };
  let couleursOk = true;
  for (const w of wires) {
    const f = fonctionNet(key(w.a)), coul = (COULEURS_FIL.find(x => x.id === w.color) || {}).nom || w.color;
    if (w.color === 'vj' && f !== 'PE') { couleursOk = false; F.push({ g: 'erreur', msg: `Un fil vert-jaune est utilisé comme conducteur actif (${f === 'N' ? 'neutre' : 'phase ou retour'}).`, code: '1801', fiche: 'fils' }); }
    else if (f === 'PE' && w.color !== 'vj') { couleursOk = false; F.push({ g: 'erreur', msg: `La terre doit être en fil vert-jaune (ici : ${coul.toLowerCase()}).`, code: '1215', fiche: 'fils' }); }
    else if (w.color === 'bleu' && f !== 'N') { couleursOk = false; F.push({ g: 'erreur', msg: 'Le bleu est réservé au neutre : un fil bleu sert ici de phase ou de retour.', code: '1802', fiche: 'fils' }); }
    else if (f === 'N' && w.color !== 'bleu') { couleursOk = false; F.push({ g: 'remarque', msg: `Le neutre devrait être en bleu (ici : ${coul.toLowerCase()}).`, code: '1802', fiche: 'fils' }); }
  }
  if (couleursOk && wires.length) F.push({ g: 'ok', msg: 'Couleurs des fils respectées (bleu = neutre, vert-jaune = terre).' });
  // connexions et bornes
  const parNoeud = nodes.map(n => wires.filter(w => (w.a.k === 'node' && w.a.id === n.id) || (w.b.k === 'node' && w.b.id === n.id)).length);
  if (parNoeud.some(x => x === 1)) F.push({ g: 'remarque', msg: `${parNoeud.filter(x => x === 1).length} connexion${pl(parNoeud.filter(x => x === 1).length)} dans la boîte ne relie qu'un seul fil : elle ne sert à rien.`, fiche: 'app-wago' });
  if (parNoeud.some(x => x > 5)) F.push({ g: 'erreur', msg: 'Une connexion relie plus de 5 fils : aucune borne Wago ne le permet. Répartissez sur deux bornes.', fiche: 'app-wago' });
  const directs = wires.filter(w => (w.a.k === 'alim') !== (w.b.k === 'alim') && ![w.a, w.b].some(e => e.k === 'node'));
  if (directs.length) F.push({ g: 'erreur', msg: `${directs.length} fil${pl(directs.length)} prolonge${directs.length > 1 ? 'nt' : ''} un conducteur d'alimentation sans borne de connexion : dans la boîte, chaque raccord entre deux fils se fait avec une borne Wago (un point noir).`, code: '1822', fiche: 'app-wago' });
  const parBorne = {};
  for (const w of wires) for (const e of [w.a, w.b]) if (e.k === 'dev' || e.k === 'lamp') parBorne[key(e)] = (parBorne[key(e)] || 0) + 1;
  if (Object.values(parBorne).some(n => n > 2)) F.push({ g: 'erreur', msg: 'Plus de deux conducteurs sur une même borne d\'appareil : faites la connexion dans la boîte de dérivation.', code: '1822' });
  return F;
}

/* =========================================================
   2. Schéma de principe
   ========================================================= */
function corrigerPrincipe(ex, v, st) {
  st = st || {};
  const syms = st.syms || [], wires = st.wires || [];
  if (!syms.length) return [{ g: 'erreur', msg: 'Le schéma de principe est vide.' }];
  const F = [];
  // symboles attendus
  const compte = arr => arr.reduce((m, t) => (m[t] = (m[t] || 0) + 1, m), {});
  const att = compte([...ex.devices, ...Array(ex.lampes).fill('lampe')]);
  const fait = compte(syms.map(s => s.type));
  for (const t of new Set([...Object.keys(att), ...Object.keys(fait)])) {
    const a = att[t] || 0, f = fait[t] || 0, nom = t === 'lampe' ? 'lampe' : nomType(t);
    if (f < a) F.push({ g: 'erreur', msg: `Il manque ${a - f} symbole${pl(a - f)} « ${nom} ».` });
    if (f > a) F.push({ g: 'erreur', msg: `${f - a} symbole${pl(f - a)} « ${nom} » en trop.` });
  }
  if (!F.length) F.push({ g: 'ok', msg: 'Tous les symboles demandés sont présents.' });
  // réseau géométrique
  const base = UF();
  const lignes = { L1: [[110, 40], [770, 40]], N: [[110, 420], [770, 420]], PE: [[30, 470], [480, 470]] };
  const surSeg = (p, a, b) => (a[0] === b[0] && Math.abs(p[0] - a[0]) < .5 && p[1] >= Math.min(a[1], b[1]) - .5 && p[1] <= Math.max(a[1], b[1]) + .5)
    || (a[1] === b[1] && Math.abs(p[1] - a[1]) < .5 && p[0] >= Math.min(a[0], b[0]) - .5 && p[0] <= Math.max(a[0], b[0]) + .5);
  const surPoly = (p, pts) => pts.some((q, i) => i < pts.length - 1 && surSeg(p, q, pts[i + 1]));
  const bornes = [];
  for (const s of syms) SYM_P[s.type].terms.forEach(([x, y], i) => { const [rx, ry] = rotPt(x, y, s.rot); bornes.push({ key: `s:${s.id}:${i}`, p: [s.x + rx, s.y + ry] }); });
  const traces = [...Object.entries(lignes).map(([k, pts]) => ({ key: 'b:' + k, pts })), ...wires.map(w => ({ key: 'w:' + w.id, pts: w.pts }))];
  traces.forEach(t => base.find(t.key));
  for (const w of wires) for (const p of [w.pts[0], w.pts[w.pts.length - 1]]) for (const t of traces) if (t.key !== 'w:' + w.id && surPoly(p, t.pts)) base.union('w:' + w.id, t.key);
  for (const b of bornes) for (const t of traces) if (surPoly(b.p, t.pts)) base.union(b.key, t.key);
  const c = { base, P: 'b:L1', N: 'b:N', PE: 'b:PE', switches: [], lamps: [], prises: [] };
  let nL = 0;
  for (const s of syms) {
    const T = i => `s:${s.id}:${i}`;
    const idx = { sch1: { L: 0, 1: 1 }, sch2: { L1: 0, 1: 1, L2: 2, 2: 3 }, sch5: { 1: 0, 2: 1, L: 2 }, sch6: { 1: 0, "1'": 1, L: 2 }, sch7: { a: 0, b: 2, c: 3, d: 1 } }[s.type];
    if (s.type === 'lampe') c.lamps.push({ id: s.id, nom: `Lampe ${++nL}`, a: T(0), b: T(1) });
    else if (s.type === 'prise') c.prises.push({ id: s.id, L: T(0), N: T(1), PE: T(2) });
    else c.switches.push({ id: s.id, type: s.type, touches: contactsType(s.type, b => T(idx[b])) });
  }
  // correspondance lampes : on associe chaque lampe dessinée à une lampe attendue selon ses interrupteurs
  const attendu = attenduExercice(ex, v);
  const A = analyser(c);
  const lampesAtt = attendu.lampes.map(e => ({ ...e }));
  for (const l of c.lamps) {
    const types = [...new Set([...A.commande.get(l.id)].map(s => (c.switches.find(x => x.id === s.split('#')[0]) || {}).type))].sort().join();
    const e = lampesAtt.find(x => !x.pris && [...new Set(x.types)].sort().join() === types) || lampesAtt.find(x => !x.pris);
    if (e) { e.pris = true; l.ref = e.ref; l.nom = e.nom; }
  }
  F.push(...constatsFonction(c, A, attendu, 'schéma de principe'));
  if (wires.some(w => w.pts.length < 2)) F.push({ g: 'remarque', msg: 'Une liaison est incomplète.' });
  return F;
}

/* =========================================================
   3. Schéma unifilaire
   ========================================================= */
function corrigerUnifilaire(ex, v, st) {
  st = st || {};
  const pts = st.points || [];
  if (!pts.length) return [{ g: 'erreur', msg: 'Le schéma unifilaire ne contient aucun point raccordé.' }];
  const F = [];
  const prise = ex.devices.includes('prise');
  const section = prise ? '2,5' : '1,5';
  if (st.section !== section) {
    if (st.section === '1,5' && prise) F.push({ g: 'erreur', msg: 'Avec une prise sur le circuit, la section minimale est de 2,5 mm².', code: '1807', fiche: 'fils' });
    else if (st.section === '2,5' && !prise) F.push({ g: 'remarque', msg: 'Pour un circuit d\'éclairage seul, 1,5 mm² suffit (2,5 mm² est permis mais plus cher).', fiche: 'fils' });
    else F.push({ g: 'erreur', msg: `Section attendue : ${section} mm².`, code: '1806', fiche: 'fils' });
  } else F.push({ g: 'ok', msg: `Section ${section} mm² correcte.` });
  const cal = +st.calibre, maxCal = st.section === '1,5' ? 16 : st.section === '2,5' ? 20 : 32;
  if (cal > maxCal) F.push({ g: 'erreur', msg: `Disjoncteur de ${cal} A trop élevé pour des conducteurs de ${st.section} mm² (maximum ${maxCal} A).`, code: '1708' });
  else F.push({ g: 'ok', msg: `Calibre ${cal} A adapté à la section.` });
  if (st.poles !== '2') F.push({ g: 'remarque', msg: 'La planche est protégée par un disjoncteur bipolaire (comme sur le schéma de principe).' });
  if (st.cable === 'H07V-U' && !['sous tube', 'en goulotte'].includes(st.pose)) F.push({ g: 'erreur', msg: 'Les fils H07V-U doivent être posés sous tube ou en goulotte.', code: '1815', fiche: 'fils' });
  else if (st.cable !== 'H07V-U') F.push({ g: 'remarque', msg: 'Sur la planche, on tire des fils H07V-U sous tube.' });
  else F.push({ g: 'ok', msg: 'Canalisation H07V-U sous tube.' });
  if (+st.nb < 3) F.push({ g: 'erreur', msg: 'Il faut au moins 3 conducteurs : phase, neutre et terre.', code: '1214' });
  // symboles
  const compte = arr => arr.reduce((m, t) => (m[t] = (m[t] || 0) + 1, m), {});
  const att = compte([...ex.devices, ...Array(ex.lampes).fill('lampe')]);
  const fait = compte(pts.flatMap(p => p.items));
  let symOk = true;
  for (const t of new Set([...Object.keys(att), ...Object.keys(fait)])) {
    const a = att[t] || 0, f = fait[t] || 0, nom = SYM_U[t] || t;
    if (f < a) { symOk = false; F.push({ g: 'erreur', msg: `Il manque ${a - f} symbole${pl(a - f)} « ${nom} ».` }); }
    if (f > a) { symOk = false; F.push({ g: 'erreur', msg: `${f - a} symbole${pl(f - a)} « ${nom} » en trop.` }); }
  }
  if (symOk) F.push({ g: 'ok', msg: 'Tous les symboles sont présents.' });
  pts.forEach((p, i) => {
    if (p.items.includes('lampe') && !p.items.some(t => /^sch/.test(t))) F.push({ g: 'remarque', msg: `Point ${i + 1} : le point lumineux n'a pas son interrupteur sur la même branche.` });
    if (p.items.includes('prise') && p.items.some(t => /^sch/.test(t))) F.push({ g: 'remarque', msg: `Point ${i + 1} : la prise n'est pas commandée par un interrupteur.` });
    if (!p.items.length) F.push({ g: 'remarque', msg: `Point ${i + 1} vide.` });
  });
  return F;
}

/* =========================================================
   4. Bon de commande
   ========================================================= */
function longueurFils(st) {
  // longueur de chaque fil (m) en suivant les tubes + réserves
  const out = {};
  if (!st || !(st.wires || []).length) return out;
  const ed = Object.create(CablageEditor.prototype);
  ed.st = { placed: st.placed || {}, douilles: st.douilles || {}, nodes: st.nodes || [], wires: (st.wires || []).filter(w => w.a && w.b) };
  try { ed.computeOffsets(); } catch (e) { return out; }
  for (const w of ed.st.wires) {
    let L = 0;
    try { const pts = ed.route(w); for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); } catch (e) { continue; }
    const extremites = [w.a, w.b].filter(e => e.k === 'dev' || e.k === 'lamp').length;
    L = L / 1000 + 0.15 + extremites * 0.1;
    out[w.color] = (out[w.color] || 0) + L;
  }
  return out;
}
function corrigerBdc(ex, v, d, planche) {
  const F = [];
  const lignes = (d.bdc && d.bdc.lignes || []).filter(l => l.q > 0);
  const q = id => lignes.filter(l => l.id === id).reduce((s, l) => s + l.q, 0);
  const utilise = new Set();
  if (!lignes.length) return [{ g: 'erreur', msg: 'Le bon de commande est vide.' }];
  if (ex.kind === 'planche') {
    for (const r of REF_PLANCHE) {
      let min = r.min, max = r.max;
      if (r.alim && v.alim === r.alim) { min += 0.35; max += 0.5; }
      if (r.alimN && v.alim === r.alimN) { min += 2; max += 2; }
      const ids = lignes.map(l => l.id).filter(id => (r.ids && r.ids.includes(id)) || (r.match && r.match.test(id)));
      ids.forEach(id => utilise.add(id));
      const n = ids.reduce((s, id) => s + q(id), 0);
      if (!n) F.push({ g: 'erreur', msg: `Manque : ${r.nom}.` });
      else if (n < min) F.push({ g: 'erreur', msg: `${r.nom} : quantité insuffisante (${num(n)} commandé, au moins ${num(min)}).` });
      else if (n > max) F.push({ g: 'remarque', msg: `${r.nom} : quantité trop grande (${num(n)} commandé, ${num(max)} suffisent).` });
      else F.push({ g: 'ok', msg: `${r.nom} : ${num(n)}.` });
    }
  } else {
    const cc = CODE_COUL[v.couleur];
    const besoins = {};
    v.devices.forEach(dv => besoins[dv.type] = (besoins[dv.type] || 0) + 1);
    const arr = x => Array.isArray(x) ? x : [x];
    const sets = {}; // sets disponibles par suffixe
    lignes.forEach(l => { const m = l.id.match(/^(\d{3})-(\d{5})$/); if (m && Object.values(SET_FIN).flat().includes(m[2])) { if (m[1] === cc) sets[m[2]] = (sets[m[2]] || 0) + l.q; } });
    for (const [type, n] of Object.entries(besoins)) {
      const complets = arr(COMPLET[type]).reduce((s, suf) => s + q(`${cc}-${suf}`), 0);
      arr(COMPLET[type]).forEach(suf => utilise.add(`${cc}-${suf}`));
      let reste = n - complets;
      let socles = 0;
      arr(SOCLE[type]).forEach(r => { socles += q(r); utilise.add(r); });
      for (const suf of arr(SET_FIN[type])) {
        const pris = Math.min(reste, socles, sets[suf] || 0);
        if (pris > 0) { reste -= pris; socles -= pris; sets[suf] -= pris; utilise.add(`${cc}-${suf}`); }
      }
      if (reste > 0) {
        const mauvaiseCouleur = lignes.some(l => { const m = l.id.match(/^(\d{3})-(\d{5})$/); return m && m[1] !== cc && (arr(COMPLET[type]).includes(m[2]) || arr(SET_FIN[type]).includes(m[2])); });
        F.push({ g: 'erreur', msg: mauvaiseCouleur ? `${maj1(nomType(type))} : la couleur commandée ne correspond pas à la demande du client (${v.couleur}).` : `Manque : ${reste} × ${nomType(type)} (appareil complet, ou socle + set de finition ${v.couleur}).`, fiche: 'app-boitiers' });
      } else F.push({ g: 'ok', msg: `${maj1(nomType(type))} : ${n}, finition ${v.couleur}.` });
    }
    const nL = v.lampes.length;
    [['HP760SV', 'Douilles E27', 'erreur'], ['LEDE27', 'Ampoules', 'remarque']].forEach(([id, nom, g]) => {
      utilise.add(id); const n = q(id);
      if (n < nL) F.push({ g, msg: `${nom} : ${n} commandée${pl(n)}, il en faut ${nL}.` });
      else F.push({ g: 'ok', msg: `${nom} : ${n}.` });
    });
    // bornes Wago : cohérence avec le schéma de câblage
    const st = d.cablage || {};
    const parNoeud = (st.nodes || []).map(n => (st.wires || []).filter(w => (w.a.k === 'node' && w.a.id === n.id) || (w.b.k === 'node' && w.b.id === n.id)).length).filter(x => x > 1);
    const besoinW = { 2: parNoeud.filter(x => x === 2).length, 3: parNoeud.filter(x => x === 3).length, 5: parNoeud.filter(x => x > 3 && x <= 5).length };
    const dispo = { 2: q('W221-412'), 3: q('W221-413'), 5: q('W221-415') };
    ['W221-412', 'W221-413', 'W221-415'].forEach(id => utilise.add(id));
    let manque = 0;
    for (const t of [5, 3, 2]) { let b = besoinW[t]; for (const s of [5, 3, 2].filter(s => s >= t)) { const p = Math.min(b, dispo[s]); b -= p; dispo[s] -= p; } manque += b; }
    if (!parNoeud.length) F.push({ g: 'remarque', msg: 'Bornes Wago : impossible de vérifier, le schéma de câblage n\'a pas de connexion.' });
    else if (manque) F.push({ g: 'erreur', msg: `Bornes Wago : votre schéma de câblage compte ${parNoeud.length} connexion${pl(parNoeud.length)}, il manque ${manque} borne${pl(manque)} de la bonne taille.`, fiche: 'app-wago' });
    else F.push({ g: 'ok', msg: `Bornes Wago suffisantes pour les ${parNoeud.length} connexions du schéma.` });
    // fils
    const sec = v.devices.some(x => x.type === 'prise') ? '2,5' : '1,5';
    const besoinsFil = longueurFils(st);
    for (const [coul, L] of Object.entries(besoinsFil)) {
      const nom = FIL_COUL[coul] || coul;
      const bon = q(`H07VU-${sec}-${nom}`), autre = q(`H07VU-${sec === '1,5' ? '2,5' : '1,5'}-${nom}`);
      utilise.add(`H07VU-${sec}-${nom}`); utilise.add(`H07VU-${sec === '1,5' ? '2,5' : '1,5'}-${nom}`);
      if (bon + autre === 0) F.push({ g: 'erreur', msg: `Fil ${nom} : votre schéma en utilise environ ${num(L)} m, rien n'est commandé.` });
      else if (!bon && sec === '2,5') F.push({ g: 'erreur', msg: `Fil ${nom} : avec une prise sur le circuit, il faut du 2,5 mm².`, code: '1807', fiche: 'fils' });
      else if (bon + autre < L * 0.8) F.push({ g: 'erreur', msg: `Fil ${nom} : ${num(bon + autre)} m commandés, il en faut environ ${num(L)} m (réserve comprise).` });
      else if (!bon) F.push({ g: 'remarque', msg: `Fil ${nom} : 1,5 mm² suffit pour un circuit d'éclairage.` });
      else F.push({ g: 'ok', msg: `Fil ${nom} ${sec} mm² : ${num(bon)} m (environ ${num(L)} m nécessaires).` });
    }
    if (!Object.keys(besoinsFil).length) F.push({ g: 'remarque', msg: 'Fils : impossible de calculer les longueurs, le schéma de câblage est vide.' });
  }
  const inutiles = [...new Set(lignes.map(l => l.id))].filter(id => !utilise.has(id));
  if (inutiles.length) F.push({ g: 'remarque', msg: `Article${pl(inutiles.length)} non nécessaire${pl(inutiles.length)} pour ce TP : ${inutiles.map(id => (catItem(id) || { des: id }).des.split(' — ')[0]).join(' ; ')}.` });
  return F;
}
function corrigerTva(v, d) {
  const F = [];
  const b = d.bdc || {};
  if (!b.tva) return [{ g: 'erreur', msg: 'Le taux de TVA n\'est pas choisi.', fiche: 'regles-tva' }];
  if (+b.tva === v.chantier.tva) F.push({ g: 'ok', msg: `Taux de TVA correct : ${v.chantier.tva} %.` });
  else F.push({ g: 'erreur', msg: `Taux de TVA : ${v.chantier.tva} % et non ${b.tva} %. Chantier : ${v.chantier.texte}`, fiche: 'regles-tva' });
  if ((b.justif || '').trim().length < 15) F.push({ g: 'remarque', msg: 'La justification du taux de TVA manque ou est trop courte.', fiche: 'regles-tva' });
  else F.push({ g: 'ok', msg: 'Justification du taux de TVA présente.' });
  return F;
}
function corrigerOutils(ex, d) {
  const ref = REF_OUTILS[ex.kind === 'planche' ? 'planche' : 'cablage'];
  const choisis = Object.keys(d.outils || {}).filter(k => d.outils[k]);
  const nom = id => { for (const g of OUTILLAGE) for (const [i, n] of g.items) if (i === id) return n; return id; };
  const manque = ref.filter(id => !choisis.includes(id) && !(id === 'tv-4' && choisis.includes('tv-3')));
  if (!choisis.length) return [{ g: 'erreur', msg: 'Aucun outil n\'est coché.', fiche: 'outils-coffre' }];
  const F = manque.map(id => ({ g: 'remarque', msg: `Outil oublié : ${nom(id)}.`, fiche: 'outils-coffre' }));
  if (!manque.length) F.push({ g: 'ok', msg: 'Tous les outils essentiels sont prévus.' });
  return F;
}

/* =========================================================
   Synthèse et barème
   ========================================================= */
function noter(F, max, retrait = BAREME.retrait) {
  let s = max;
  for (const f of F) if (f.g === 'erreur') s -= retrait.erreur; else if (f.g === 'remarque') s -= retrait.remarque;
  return Math.max(0, Math.round(s * 2) / 2);
}
function corrigerDossier(ex, v, d) {
  d = d || {};
  const parties = [];
  const ajoute = (id, titre, max, F, grille, retrait) => parties.push({ id, titre, max, score: noter(F, max, retrait), F, grille });
  if (ex.kind !== 'planche') {
    ajoute('principe', 'Schéma de principe', BAREME.principe, corrigerPrincipe(ex, v, d.principe), 'processus');
    ajoute('unifilaire', 'Schéma unifilaire', BAREME.unifilaire, corrigerUnifilaire(ex, v, d.unifilaire), 'processus');
    ajoute('cablage', 'Schéma de câblage', BAREME.cablage, corrigerCablage(ex, v, d.cablage), 'processus');
  }
  ajoute('bdc', 'Bon de commande', BAREME.bdc, corrigerBdc(ex, v, d), 'communication', { erreur: 4, remarque: 1.5 });
  ajoute('tva', 'TVA', BAREME.tva, corrigerTva(v, d), 'communication');
  ajoute('outils', 'Outillage', BAREME.outils, corrigerOutils(ex, d), 'communication', { erreur: 3, remarque: 1.5 });
  const somme = g => parties.filter(p => p.grille === g).reduce((s, p) => s + p.score, 0);
  const normesF = parties.flatMap(p => p.F.filter(f => f.code && f.g !== 'ok'));
  const grille = {
    normes: ex.kind === 'planche' ? null : noter(normesF, BAREME.normes, BAREME.retraitNormes),
    processus: ex.kind === 'planche' ? null : somme('processus'),
    communication: somme('communication'),
    produit: null,
  };
  return { parties, grille, date: Date.now() };
}
const GRILLE = [['normes', 'Respect des règles, normes et consignes', 40], ['processus', 'Maîtrise technique et processus', 80], ['communication', 'Communication', 50], ['produit', 'Produit fini', 45]];
