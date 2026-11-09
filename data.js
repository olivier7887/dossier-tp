/* =========================================================
   TP 3Pélec — données : catalogue, outillage, exercices, fiches
   Toutes les données ci-dessous migreront vers le Google Sheet
   (onglets Catalogue, Outillage, Exercices) à l'étape suivante.
   ========================================================= */

/* ---------- Catalogue ---------- */
// prix HTVA en euros ; verif:true = prix repris d'une ancienne liste ou estimé, à contrôler
// Références : catalogue général Niko 2026 (gamme Niko Original).
// Prix bruts HTVA : liste de prix Niko Belgique du 01/06/2024 (Q2 2024)
const NIKO_PRIX = {"170-01100":4.78,"170-01200":8.92,"170-01500":7.28,"170-01600":5.22,"170-01700":10.58,"170-02600":11.95,"170-02200":13.31,"170-00000":6.84,"170-05000":14.83,"170-37323":8.42,"100-60010":10.24,"101-60010":9.72,"100-60000":10.5,"101-60000":9.98,"100-65000":19.26,"101-65000":18.74,"100-60005":3.69,"101-60005":3.17,"102-60005":4.57,"100-61507":5.91,"101-61507":5.39,"102-61507":8.87,"100-62200":16.73,"101-62200":16.21,"170-33100":6.77,"170-32100":6.77,"11-865":1.77,"31-865":1.77,"11-866":1.77,"31-866":1.77,"100-61100":8.19,"100-61200":12.33,"100-61500":11.74,"100-61600":8.64,"100-61700":14.0,"100-62600":16.4,"100-66600":9.59,"100-66100":9.59,"100-61105":3.43,"100-61505":4.46,"100-66601":2.85,"100-66101":2.85,"100-77100":6.94,"100-77500":9.74,"100-76100":2.53,"100-76800":5.0,"100-76700":8.24,"100-76200":5.0,"100-76300":8.24,"101-61100":7.67,"101-61200":11.81,"101-61500":11.22,"101-61600":8.12,"101-61700":13.48,"101-62600":15.88,"101-66600":9.07,"101-66100":9.07,"101-61105":2.91,"101-61505":3.94,"101-66601":2.33,"101-66101":2.33,"101-77100":5.88,"101-77500":8.25,"101-76100":2.14,"101-76800":4.24,"101-76700":6.98,"101-76200":4.24,"101-76300":6.98,"102-61105":4.1,"102-61505":6.7,"102-66601":4.49,"102-66101":4.49,"102-77100":7.65,"102-77500":9.4,"102-76100":4.1,"102-76800":8.21,"102-76700":13.54,"102-76200":8.21,"102-76300":13.54};
const NIKO_PRIX_SOURCE = 'liste de prix brute Niko Belgique du 01/06/2024';
const COULEURS_NIKO = [
  { code: '100', nom: 'crème' },
  { code: '101', nom: 'blanc' },
  { code: '102', nom: 'gris clair' },
];
// Socles (mécanismes) : sans couleur, bornes à vis, fixation par griffes
const NIKO_SOCLES = [
  ['170-01100', 'Socle interrupteur unipolaire (sch 1), bornes à vis, griffes', 2.80],
  ['170-01200', 'Socle interrupteur bipolaire (sch 2), bornes à vis, griffes', 4.60],
  ['170-01500', 'Socle interrupteur double allumage (sch 5), bornes à vis, griffes', 4.90],
  ['170-01600', 'Socle interrupteur va-et-vient (sch 6), bornes à vis, griffes', 3.00],
  ['170-01700', 'Socle interrupteur permutateur (sch 7), bornes à vis, griffes', 5.60],
  ['170-02600', 'Socle interrupteur va-et-vient double (sch 6+6), bornes à vis, griffes', 6.50],
  ['170-02200', 'Socle interrupteur va-et-vient bipolaire (sch 6/2), bornes à vis, griffes', 13.31],
  ['170-00000', 'Socle bouton-poussoir N.O. (3 bornes), bornes à vis, griffes', 6.84],
  ['170-05000', 'Socle double bouton-poussoir N.O. ou N.F., bornes à vis, griffes', 14.83],
  ['170-37323', 'Élément d\'éclairage à LED ambre 230 V pour bouton-poussoir à voyant (bornes à vis)', 8.42],
  ['170-33100', 'Socle prise 2P+T (28,5 mm), obturateurs, bornes à vis, griffes', 3.90],
  ['170-32100', 'Socle prise 2P+T (21 mm), obturateurs, bornes à vis, griffes', 3.90],
];
// Par couleur : [suffixe, désignation, prix, catégorie, couleurs disponibles]
const NIKO_COUL = [
  ['61100', 'Interrupteur unipolaire complet (sch 1), bornes à vis', 4.61, 'Appareils complets', ['100', '101']],
  ['61200', 'Interrupteur bipolaire complet (sch 2), bornes à vis', 7.01, 'Appareils complets', ['100', '101']],
  ['61500', 'Interrupteur double allumage complet (sch 5), bornes à vis', 7.53, 'Appareils complets', ['100', '101']],
  ['61600', 'Interrupteur va-et-vient complet (sch 6), bornes à vis', 4.81, 'Appareils complets', ['100', '101']],
  ['61700', 'Interrupteur permutateur complet (sch 7), bornes à vis', 8.12, 'Appareils complets', ['100', '101']],
  ['62600', 'Interrupteur va-et-vient double complet (sch 6+6), bornes à vis', 9.91, 'Appareils complets', ['100', '101']],
  ['62200', 'Interrupteur va-et-vient bipolaire complet (sch 6/2), bornes à vis', 16.21, 'Appareils complets', ['100', '101']],
  ['60010', 'Bouton-poussoir N.O. complet, bornes à vis', 9.72, 'Appareils complets', ['100', '101']],
  ['60000', 'Bouton-poussoir N.O. complet avec petit voyant transparent (élément LED en plus), bornes à vis', 9.98, 'Appareils complets', ['100', '101']],
  ['65000', 'Double bouton-poussoir N.O. ou N.F. complet, bornes à vis', 18.74, 'Appareils complets', ['100', '101']],
  ['66600', 'Prise 2P+T complète (28,5 mm), obturateurs, bornes à vis', 5.40, 'Appareils complets', ['100', '101']],
  ['66100', 'Prise 2P+T complète (21 mm), obturateurs, bornes à vis', 5.40, 'Appareils complets', ['100', '101']],
  ['61105', 'Set de finition, touche simple (sch 1, 2, 6, 6/2, 7)', 1.80, 'Sets de finition', ['100', '101', '102']],
  ['61505', 'Set de finition, touche double (sch 5, 6+6, double BP)', 2.50, 'Sets de finition', ['100', '101', '102']],
  ['60005', 'Set de finition bouton-poussoir avec petit voyant transparent', 3.17, 'Sets de finition', ['100', '101', '102']],
  ['61507', 'Set de finition double bouton-poussoir avec deux petits voyants', 5.39, 'Sets de finition', ['100', '101', '102']],
  ['66601', 'Set de finition prise avec terre (28,5 mm)', 1.48, 'Sets de finition', ['100', '101', '102']],
  ['66101', 'Set de finition prise avec terre (21 mm)', 1.48, 'Sets de finition', ['100', '101', '102']],
  ['77100', 'Boîte en saillie simple', 3.80, 'Boîtiers et plaques', ['100', '101', '102']],
  ['77500', 'Boîte en saillie double (158 × 87 mm)', 5.54, 'Boîtiers et plaques', ['100', '101', '102']],
  ['76100', 'Plaque de recouvrement simple (83 × 83 mm)', 1.25, 'Boîtiers et plaques', ['100', '101', '102']],
  ['76800', 'Plaque double, entraxe 71 mm (83 × 154 mm)', 2.63, 'Boîtiers et plaques', ['100', '101', '102']],
  ['76700', 'Plaque triple, entraxe 71 mm (83 × 225 mm)', 4.35, 'Boîtiers et plaques', ['100', '101', '102']],
  ['76200', 'Plaque double, entraxe 60 mm (83 × 143 mm)', 2.54, 'Boîtiers et plaques', ['100', '101', '102']],
  ['76300', 'Plaque triple, entraxe 60 mm (83 × 203 mm)', 4.35, 'Boîtiers et plaques', ['100', '101', '102']],
];

const CATALOGUE = (() => {
  const list = [];
  const add = (o) => list.push(Object.assign({ marque: '', unite: 'pc', couleur: null, verif: true }, o));
  for (const [ref, des, prix] of NIKO_SOCLES) add({ id: ref, cat: 'Socles (mécanismes)', des: des + ' — Niko', ref, marque: 'Niko', prix: NIKO_PRIX[ref] ?? prix, verif: !(ref in NIKO_PRIX) });
  for (const [suf, des, prix, cat, codes] of NIKO_COUL) {
    for (const c of COULEURS_NIKO.filter(c => codes.includes(c.code))) {
      const ref = `${c.code}-${suf}`;
      add({ id: ref, cat, des: `${des} — Niko Original ${c.nom}`, ref, marque: 'Niko', prix: NIKO_PRIX[ref] ?? prix, verif: !(ref in NIKO_PRIX), couleur: c.nom });
    }
  }
  add({ id: '11-865', cat: 'Boîtiers et plaques', des: 'Embout de tube M16 pour boîte en saillie — Niko crème', ref: '11-865', marque: 'Niko', prix: NIKO_PRIX['11-865'], verif: false, couleur: 'crème' });
  add({ id: '31-865', cat: 'Boîtiers et plaques', des: 'Embout de tube M16 pour boîte en saillie — Niko blanc', ref: '31-865', marque: 'Niko', prix: NIKO_PRIX['31-865'], verif: false, couleur: 'blanc' });
  add({ id: '11-866', cat: 'Boîtiers et plaques', des: 'Embout de tube M20 pour boîte en saillie — Niko crème', ref: '11-866', marque: 'Niko', prix: NIKO_PRIX['11-866'], verif: false, couleur: 'crème' });
  add({ id: '31-866', cat: 'Boîtiers et plaques', des: 'Embout de tube M20 pour boîte en saillie — Niko blanc', ref: '31-866', marque: 'Niko', prix: NIKO_PRIX['31-866'], verif: false, couleur: 'blanc' });
  // Planche / canalisations
  add({ id: 'ISR1', cat: 'Planche et canalisations', des: 'Rosace en bois 95 × 95 mm (point lumineux)', ref: 'ISR1', prix: 0.55 });
  add({ id: 'BD75', cat: 'Planche et canalisations', des: 'Boîte de dérivation 75 × 75 mm, 3 opercules par côté', ref: '030/30496-024', marque: 'Vynckier', prix: 1.83 });
  add({ id: 'LLG16', cat: 'Planche et canalisations', des: 'Tube PVC gris rigide Ø 16 mm (5/8")', ref: 'LLG5', unite: 'm', prix: 0.20 });
  add({ id: 'LLG20', cat: 'Planche et canalisations', des: 'Tube PVC gris rigide Ø 20 mm (3/4")', ref: 'LLG34', unite: 'm', prix: 0.22 });
  add({ id: 'PC145-16', cat: 'Planche et canalisations', des: 'Entrée lisse (embout) Ø 16 mm', ref: 'PC-145/01', prix: 0.59 });
  add({ id: 'PC145-20', cat: 'Planche et canalisations', des: 'Entrée lisse (embout) Ø 20 mm', ref: 'PC-145/02', prix: 0.68 });
  add({ id: 'RDA16', cat: 'Planche et canalisations', des: 'Attache simple à 2 vis Ø 16 mm', ref: 'RDA5', prix: 0.93 });
  add({ id: 'RDA20', cat: 'Planche et canalisations', des: 'Attache simple à 2 vis Ø 20 mm', ref: 'RDA34', prix: 1.25 });
  add({ id: 'PGL16', cat: 'Planche et canalisations', des: 'Attache PGL simple Ø 16 mm', ref: '115', prix: 0.07 });
  add({ id: 'PGL20', cat: 'Planche et canalisations', des: 'Attache PGL simple Ø 20 mm', ref: '118', prix: 0.08 });
  add({ id: 'VIS4530', cat: 'Planche et canalisations', des: 'Vis à bois 4,5 × 30 (boîte de 50)', ref: '7153045', unite: 'boîte', prix: 4.35 });
  add({ id: 'VIS3015', cat: 'Planche et canalisations', des: 'Vis à bois 3,0 × 15 (boîte de 50)', ref: '7151530', unite: 'boîte', prix: 3.25 });
  // Connexions
  add({ id: 'W221-412', cat: 'Connexions', des: 'Borne à levier 2 conducteurs 0,2–4 mm²', ref: '221-412', marque: 'Wago', prix: 0.40 });
  add({ id: 'W221-413', cat: 'Connexions', des: 'Borne à levier 3 conducteurs 0,2–4 mm²', ref: '221-413', marque: 'Wago', prix: 0.45 });
  add({ id: 'W221-415', cat: 'Connexions', des: 'Borne à levier 5 conducteurs 0,2–4 mm²', ref: '221-415', marque: 'Wago', prix: 0.60 });
  // Éclairage
  add({ id: 'HP760SV', cat: 'Éclairage', des: 'Douille E27 (socket)', ref: 'HP760SV', prix: 0.62 });
  add({ id: 'LEDE27', cat: 'Éclairage', des: 'Ampoule LED E27 806 lm, 2700 K', ref: 'LED-E27-806', prix: 3.50 });
  // Fils
  const couleursFil = ['bleu', 'vert-jaune', 'brun', 'noir', 'gris', 'rouge'];
  for (const s of ['1,5', '2,5']) {
    for (const coul of couleursFil) {
      add({ id: `H07VU-${s}-${coul}`, cat: 'Fils et câbles', des: `Fil H07V-U ${s} mm² ${coul}`, ref: `H07V-U ${s}`, unite: 'm', prix: s === '1,5' ? 0.07 : 0.12, couleur: coul });
    }
  }
  add({ id: 'XVB3G15', cat: 'Fils et câbles', des: 'Câble XVB-F2 3G1,5 mm²', ref: 'XVB-F2 3G1,5', unite: 'm', prix: 0.50 });
  add({ id: 'XVB3G25', cat: 'Fils et câbles', des: 'Câble XVB-F2 3G2,5 mm²', ref: 'XVB-F2 3G2,5', unite: 'm', prix: 0.57 });
  // Modulaires sur rail DIN (Hager) : prix indicatifs à vérifier
  add({ id: 'EPN510', cat: 'Modulaires (rail DIN)', des: 'Télérupteur 16 A 1F, bobine 230 V, 1 module', ref: 'EPN510', marque: 'Hager', prix: 38.00 });
  add({ id: 'EMN001', cat: 'Modulaires (rail DIN)', des: 'Minuterie d\'escalier 16 A, 0,5–10 min, 3 ou 4 fils, 1 module', ref: 'EMN001', marque: 'Hager', prix: 52.00 });
  add({ id: 'EEN100', cat: 'Modulaires (rail DIN)', des: 'Interrupteur crépusculaire 1 voie, 1 module, cellule en saillie fournie', ref: 'EEN100', marque: 'Hager', prix: 88.00 });
  add({ id: 'EG071', cat: 'Modulaires (rail DIN)', des: 'Interrupteur horaire digital 1 canal, 1 inverseur 16 A, 1 module', ref: 'EG071', marque: 'Hager', prix: 92.00 });
  add({ id: 'RAILDIN', cat: 'Modulaires (rail DIN)', des: 'Rail DIN 35 mm perforé (le mètre)', ref: 'rail DIN 35', unite: 'm', prix: 4.50 });
  // Protection
  add({ id: 'DJ2P10', cat: 'Protection', des: 'Disjoncteur bipolaire 10 A', ref: '060 73', marque: 'Legrand', prix: 4.61 });
  add({ id: 'DJ2P16', cat: 'Protection', des: 'Disjoncteur bipolaire 16 A', ref: '060 75', marque: 'Legrand', prix: 4.61 });
  add({ id: 'DJ2P20', cat: 'Protection', des: 'Disjoncteur bipolaire 20 A', ref: '060 76', marque: 'Legrand', prix: 4.61 });
  return list;
})();

const CAT_ORDER = ['Socles (mécanismes)', 'Sets de finition', 'Appareils complets', 'Modulaires (rail DIN)', 'Boîtiers et plaques', 'Éclairage', 'Connexions', 'Planche et canalisations', 'Fils et câbles', 'Protection'];

/* ---------- Outillage ---------- */
const OUTILLAGE = [
  { groupe: 'Coffre personnel', items: [
    ['coffre', 'Coffre électricien PVC 410 × 225 × 185'],
    ['marteau', "Marteau d'ajusteur 300 g"],
    ['pince-coupante', 'Pince coupante isolée 1000 V, 160 mm'],
    ['pince-denuder', 'Pince à dénuder isolée 1000 V, 160 mm'],
    ['pince-longbec', 'Pince à long bec droit isolée 1000 V, 160 mm'],
    ['pince-universelle', 'Pince universelle 1000 V, 160 mm'],
    ['tv-pz1', 'Tournevis cruciforme isolé 1000 V, PZ1'],
    ['tv-pz2', 'Tournevis cruciforme isolé 1000 V, PZ2'],
    ['tv-3', 'Tournevis plat isolé 1000 V, 3 × 100'],
    ['tv-4', 'Tournevis plat isolé 1000 V, 4 × 100'],
    ['tv-55', 'Tournevis plat isolé 1000 V, 5,5 × 100'],
    ['jokari', 'Couteau électricien type Jokari'],
    ['metre', 'Mètre ruban 3 m'],
    ['scie-junior', 'Monture de scie junior'],
    ['lunettes', 'Lunettes de protection'],
    ['cadenas', 'Cadenas 30 mm (consignation)'],
    ['multimetre', 'Multimètre digital (Stanley FatMax)'],
  ]},
  { groupe: "Outillage de l'atelier", items: [
    ['ressort-16', 'Ressort à cintrer Ø 16 mm'],
    ['ressort-20', 'Ressort à cintrer Ø 20 mm'],
    ['ebavureur', 'Ébavureur'],
    ['tire-fils', 'Tire-fils'],
    ['niveau', 'Niveau à bulle'],
    ['equerre', 'Équerre'],
    ['crayon', 'Crayon'],
    ['visseuse', 'Visseuse sans fil + embouts PZ'],
    ['lampe-temoin', 'Lampe-témoin'],
  ]},
];

/* ---------- Géométrie de la planche (mm, vue paysage 800 × 600) ---------- */
const PLANCHE = (() => {
  const W = 800, H = 600;
  const box = { x: 362.5, y: 231, w: 75, h: 75 };       // centre (400 ; 268,5)
  const cy = box.y + box.h / 2;
  const rosace = (id, x) => ({ id, kind: 'rosace', x, y: 40, w: 95, h: 95 });
  const elements = [
    rosace('PL1', 40), rosace('PL2', 352.5), rosace('PL3', 665),
    { id: 'B1', kind: 'double', x: 40, y: 402, w: 87, h: 158 },
    { id: 'B2', kind: 'simple', x: 356.5, y: 402, w: 87, h: 87 },
    { id: 'B3', kind: 'double', x: 673, y: 402, w: 87, h: 158 },
    // rails DIN (montés seulement pour les exercices avec modulaires)
    { id: 'RG', kind: 'rail', x: 150, y: 432, w: 190, h: 76 },
    { id: 'RD', kind: 'rail', x: 460, y: 432, w: 190, h: 76 },
  ];
  // tubes : de la bouche de l'élément vers l'opercule de la boîte
  const oT = box.y + 17.5, oB = box.y + box.h - 17.5;   // opercules haut / bas des côtés
  const tubes = {
    PL1: { d: 16, r: 80, pts: [[87.5, 135], [87.5, oT], [box.x, oT]] },
    PL2: { d: 16, r: 0, pts: [[400, 135], [400, box.y]] },
    PL3: { d: 16, r: 80, pts: [[712.5, 135], [712.5, oT], [box.x + box.w, oT]] },
    B1:  { d: 20, r: 100, pts: [[83.5, 402], [83.5, oB], [box.x, oB]] },
    B2:  { d: 20, r: 0, pts: [[400, 402], [400, box.y + box.h]] },
    B3:  { d: 20, r: 100, pts: [[716.5, 402], [716.5, oB], [box.x + box.w, oB]] },
    ALIM:{ d: 16, r: 0, pts: [[14, cy], [box.x, cy]] },
    // vers les rails DIN : opercules gauche et droit du bas de la boîte
    RG:  { d: 16, r: 40, pts: [[245, 420], [245, 362], [box.x + 17.5, 362], [box.x + 17.5, box.y + box.h]], rail: true },
    RD:  { d: 16, r: 40, pts: [[555, 420], [555, 362], [box.x + box.w - 17.5, 362], [box.x + box.w - 17.5, box.y + box.h]], rail: true },
  };
  // positions d'appareillage (mécanismes)
  const positions = [
    { id: 'B1-H', el: 'B1', cx: 83.5, cy: 445.5, nom: 'boîtier gauche, position haute' },
    { id: 'B1-B', el: 'B1', cx: 83.5, cy: 516.5, nom: 'boîtier gauche, position basse' },
    { id: 'B2',   el: 'B2', cx: 400,  cy: 445.5, nom: 'boîtier central' },
    { id: 'B3-H', el: 'B3', cx: 716.5, cy: 445.5, nom: 'boîtier droit, position haute' },
    { id: 'B3-B', el: 'B3', cx: 716.5, cy: 516.5, nom: 'boîtier droit, position basse' },
  ];
  const points = [
    { id: 'PL1', cx: 87.5, cy: 87.5, nom: 'point lumineux gauche' },
    { id: 'PL2', cx: 400, cy: 87.5, nom: 'point lumineux central' },
    { id: 'PL3', cx: 712.5, cy: 87.5, nom: 'point lumineux droit' },
  ];
  // emplacements de modules sur les rails (largeur dessinée : 30 mm par module, pour la lisibilité)
  const railSlots = [];
  for (const [el, x0, nom] of [['RG', 155, 'rail DIN gauche'], ['RD', 465, 'rail DIN droit']]) {
    for (let k = 0; k < 6; k++) railSlots.push({ id: `${el}-${k + 1}`, el, kind: 'rail', cx: x0 + 15 + 30 * k, cy: 470, nom: `${nom}, module ${k + 1}` });
  }
  const slots = [...positions, ...railSlots];
  return { W, H, box, elements, tubes, positions, points, railSlots, slots };
})();

/* ---------- Appareils de l'éditeur de câblage ---------- */
// Bornes : [identifiant, x, y, marquage affiché] relatifs au centre du mécanisme (mm).
// Socles Niko : une rangée de 4 bornes en haut (x = -21, -7, 7, 21), marquage d'après les schémas
// de raccordement du catalogue Niko 2026 (p. 4.D-25). Sch 1 et prise : disposition à confirmer.
const BX = [-21, -7, 7, 21], BY = -17;
const APPAREILS = {
  sch1:  { nom: 'Interrupteur simple', court: 'Sch 1', socle: '170-01100', bornes: [['L', BX[0], BY], ['1', BX[1], BY]], vides: [2, 3] },
  sch2:  { nom: 'Interrupteur bipolaire', court: 'Sch 2', socle: '170-01200', bornes: [['L1', BX[0], BY], ['1', BX[1], BY], ['2', BX[2], BY], ['L2', BX[3], BY]], vides: [] },
  sch5:  { nom: 'Interrupteur double allumage', court: 'Sch 5', socle: '170-01500', bornes: [['1', BX[0], BY], ['L', BX[1], BY], ['2', BX[3], BY]], vides: [2] },
  sch6:  { nom: 'Interrupteur va-et-vient', court: 'Sch 6', socle: '170-01600', bornes: [['L', BX[0], BY], ['1', BX[1], BY], ["1'", BX[2], BY]], vides: [3] },
  sch7:  { nom: 'Interrupteur permutateur', court: 'Sch 7', socle: '170-01700', bornes: [['a', BX[0], BY, '✱'], ['b', BX[1], BY, '✱'], ['c', BX[2], BY, '✱'], ['d', BX[3], BY, '✱']], vides: [] },
  sch62: { nom: 'Interrupteur va-et-vient bipolaire', court: 'Sch 6/2', socle: '170-02200', bornes: [['L1', BX[0], BY], ['1', BX[1], BY], ['2', BX[2], BY], ['L2', BX[3], BY], ["1'", -5, 18.5], ["2'", 5, 18.5]], vides: [] },
  sch66: { nom: 'Interrupteur va-et-vient double', court: 'Sch 6+6', socle: '170-02600', bornes: [['L1', BX[0], BY], ['1', BX[1], BY], ['2', BX[2], BY], ['L2', BX[3], BY], ["1'", -5, 18.5], ["2'", 5, 18.5]], vides: [] },
  // boutons-poussoirs Niko (catalogue 2026, p. 4.A-33 à 4.A-35 et 4.D-26)
  bp:    { nom: 'Bouton-poussoir', court: 'BP', socle: '170-00000', bornes: [['L', BX[0], BY], ['1', BX[1], BY], ['0', BX[3], BY]], vides: [2] },
  bpv:   { nom: 'Bouton-poussoir à voyant', court: 'BP voyant', socle: '170-00000', bornes: [['L', BX[0], BY], ['1', BX[1], BY], ['0', BX[3], BY]], vides: [2] },
  bp2:   { nom: 'Double bouton-poussoir', court: 'Double BP', socle: '170-05000', bornes: [['L1', BX[0], BY], ['1', BX[1], BY], ['2', BX[2], BY], ['L2', BX[3], BY], ["1'", -5, 18.5], ["2'", 5, 18.5]], vides: [] },
  // modulaires Hager sur rail DIN : bornes en haut (y = -28) et en bas (y = 28) du module.
  // EPN510 : A1-A2 bobine, 1-2 contact. EG071 : L, N, contact 1-2-3 (2 = commun, 2-3 = marche).
  // EMN001 et EEN100 : marquage à confirmer sur l'appareil de l'atelier.
  tl:    { nom: 'Télérupteur', court: 'TL', rail: true, ref: 'EPN510', bornes: [['A1', -7, -28], ['1', 7, -28], ['A2', -7, 28], ['2', 7, 28]] },
  min4:  { nom: 'Minuterie (montage 4 fils)', court: 'Minuterie', rail: true, ref: 'EMN001', bornes: [['L', -7, -28], ['N', 7, -28], ['BP', -7, 28, 'BP'], ['LA', 7, 28, '⊗']] },
  min3:  { nom: 'Minuterie (montage 3 fils)', court: 'Minuterie', rail: true, ref: 'EMN001', bornes: [['L', -7, -28], ['N', 7, -28], ['BP', -7, 28, 'BP'], ['LA', 7, 28, '⊗']] },
  crep:  { nom: 'Interrupteur crépusculaire', court: 'Crépusc.', rail: true, ref: 'EEN100', bornes: [['L', -7, -28], ['N', 7, -28], ['1', -7, 28], ['2', 7, 28]] },
  horl:  { nom: 'Interrupteur horaire', court: 'Horloge', rail: true, ref: 'EG071', bornes: [['L', -7, -28], ['N', 7, -28], ['1', -9, 28], ['2', 0, 28], ['3', 9, 28]] },
  prise: { nom: 'Prise de courant 2P+T', court: 'PC', socle: '170-33100', bornes: [['L', BX[0], BY], ['⏚', 0, BY - 1], ['N', BX[3], BY]], vides: [] },
  douille: { nom: 'Douille E27 sur rosace', court: 'Douille', bornes: [['N', -17, 27], ['L', 0, 27], ['⏚', 17, 27]] },
};

const COULEURS_FIL = [
  { id: 'bleu', nom: 'Bleu', hex: '#1f5fd1' },
  { id: 'vj', nom: 'Vert-jaune', hex: '#2fa84f', hex2: '#e8c71a' },
  { id: 'brun', nom: 'Brun', hex: '#7a4a24' },
  { id: 'noir', nom: 'Noir', hex: '#1b1b1b' },
  { id: 'gris', nom: 'Gris', hex: '#8a8f96' },
  { id: 'rouge', nom: 'Rouge', hex: '#d42a2a' },
];

/* ---------- Chantiers (TVA) ---------- */
const CHANTIERS = [
  { id: 'reno', texte: "Rénovation d'une maison construite en 1985, habitée par ses propriétaires.", tva: 6 },
  { id: 'reno2', texte: "Rénovation d'un appartement occupé depuis 2008, loué à un particulier qui y habite.", tva: 6 },
  { id: 'recent', texte: "Transformation d'une maison occupée pour la première fois en 2021.", tva: 21 },
  { id: 'neuf', texte: 'Installation dans une maison en construction (nouvelle construction).', tva: 21 },
];

/* ---------- Exercices ---------- */
// devices : appareils à placer dans les boîtiers du bas ; lampes : nombre de points lumineux
// cmd : pour chaque appareil, les lampes qu'il commande (indices dans la liste des lampes)
const EXERCICES = [
  { id: 'tp0', num: '0', titre: 'Montage de la planche', court: 'Tubes et boîtiers',
    kind: 'planche', devices: [], lampes: 0,
    intro: "Votre patron vous demande de préparer le support d'une petite installation apparente : fixer les boîtiers, la boîte de dérivation et les tubes PVC sur la planche de 800 × 600 mm, en respectant le schéma de position coté." },
  { id: 'tp1', num: '1', titre: 'Simple allumage', court: 'Sch 1 · 1 lampe',
    devices: ['sch1'], lampes: 1, cmd: [[0]],
    intro: 'Commander un point lumineux depuis un seul endroit.' },
  { id: 'tp2', num: '2', titre: 'Interrupteur bipolaire', court: 'Sch 2 · 1 lampe',
    devices: ['sch2'], lampes: 1, cmd: [[0]],
    intro: 'Commander un point lumineux en coupant la phase et le neutre.' },
  { id: 'tp3', num: '3', titre: 'Bipolaire, 2 lampes en série', court: 'Sch 2 · 2 L série',
    devices: ['sch2'], lampes: 2, cmd: [[0, 1]], montage: 'série',
    intro: 'Commander deux points lumineux raccordés en série.' },
  { id: 'tp3bis', num: '3bis', titre: 'Bipolaire, 2 lampes en parallèle', court: 'Sch 2 · 2 L parallèle',
    devices: ['sch2'], lampes: 2, cmd: [[0, 1]], montage: 'parallèle',
    intro: 'Commander deux points lumineux raccordés en parallèle.' },
  { id: 'tp4', num: '4', titre: 'Double allumage', court: 'Sch 5 · 2 lampes',
    devices: ['sch5'], lampes: 2, cmd: [[0, 1]], montage: 'double',
    intro: 'Commander deux points lumineux séparément depuis un seul endroit.' },
  { id: 'tp5', num: '5', titre: 'Simple + bipolaire + prise', court: 'Sch 1 + Sch 2 + PC',
    devices: ['sch1', 'sch2', 'prise'], lampes: 2, cmd: [[0], [1], []],
    intro: 'Deux circuits de commande et une prise de courant sur la même planche.' },
  { id: 'tp6', num: '6', titre: 'Va-et-vient + simple allumage', court: 'Sch 6 + Sch 1',
    devices: ['sch6', 'sch6', 'sch1'], lampes: 2, cmd: [[0], [0], [1]], vv: true,
    intro: 'Commander un point lumineux depuis deux endroits, et un second depuis un seul endroit.' },
];

/* ---------- charges commandées : lampes et prises ---------- */
// Dans ex.cmd[i], une charge est un n° de lampe (0, 1, 2) ou 'p' + index de la prise dans ex.devices
// (prise commandée). Appareils à deux touches (sch 5, sch 6+6) : ex.touches[i] = [[touche 1], [touche 2]].
const VV_TYPES = ['sch6', 'sch7', 'sch62', 'sch66'];
const DEUX_TOUCHES = ['sch5', 'sch66', 'bp2'];
const BP_TYPES = ['bp', 'bpv', 'bp2'];                 // commandent l'entrée d'un télérupteur ou d'une minuterie
const IMPULSION = ['tl', 'min4', 'min3'];              // appareils commandés par boutons-poussoirs (charge 'i' + index)
const AUTO_TYPES = ['crep', 'horl'];                   // commande automatique ; les deux peuvent être en série
const estRail = t => !!(APPAREILS[t] && APPAREILS[t].rail);
function touchesDe(ex, i) {
  const t = ex.touches && ex.touches[i];
  if (t) return [0, 1].slice(0, DEUX_TOUCHES.includes(ex.devices[i]) ? 2 : 1).map(k => (t[k] || []).slice());
  const c = (ex.cmd && ex.cmd[i]) || [];
  return DEUX_TOUCHES.includes(ex.devices[i]) ? [0, 1].map(k => c[k] != null ? [c[k]] : []) : [c.slice()];
}
function chargesDe(ex, i) { return [...new Set(touchesDe(ex, i).flat())]; }
function commandePar(ex, charge) { // [[index appareil, touche], …]
  const r = [];
  ex.devices.forEach((t, i) => touchesDe(ex, i).forEach((l, k) => { if (l.includes(charge)) r.push([i, k]); }));
  return r;
}
function chargesEx(ex) { return [...Array(ex.lampes || 0).keys(), ...ex.devices.map((t, i) => t === 'prise' ? 'p' + i : null).filter(x => x !== null)]; }
// entrées d'impulsion (bobine du télérupteur, entrée poussoirs de la minuterie)
function entreesEx(ex) { return ex.devices.map((t, i) => IMPULSION.includes(t) ? 'i' + i : null).filter(x => x !== null); }
function prisesCommandees(ex) { return ex.devices.map((t, i) => t === 'prise' && commandePar(ex, 'p' + i).length ? i : null).filter(x => x !== null); }
// groupes de va-et-vient : appareils (sch 6, 7, 6/2, 6+6) qui commandent ensemble une même charge ; ils doivent être dans des boîtiers différents
function groupesVV(ex) {
  const vus = new Set(), out = [];
  for (const c of chargesEx(ex)) {
    const g = [...new Set(commandePar(ex, c).map(([i]) => i))].filter(i => VV_TYPES.includes(ex.devices[i]));
    const k = g.slice().sort().join();
    if (g.length > 1 && !vus.has(k)) { vus.add(k); out.push(g); }
  }
  return out;
}
function dispositionOk(ex, positions) {
  return groupesVV(ex).every(g => new Set(g.map(i => positions[i].split('-')[0])).size === g.length);
}

/* ---------- Mode opératoire ---------- */
// f : fiche liée ; prof : étape à faire en présence du professeur
const ETAPES_PLANCHE = [
  { t: "Lire l'énoncé et le schéma de position coté.", f: 'sch-position' },
  { t: 'Établir la liste du matériel (bon de commande) et la liste de l\'outillage.', f: 'outils-coffre' },
  { t: 'Faire contrôler le bon de commande par le professeur, puis retirer le matériel.', prof: true },
  { t: 'Tracer au crayon les axes et l\'emplacement des boîtiers : 40 mm des bords, axe central, distances « a » égales.', f: 'sch-position' },
  { t: 'Fixer les rosaces, les boîtiers en saillie et la boîte de dérivation. Contrôler au niveau à bulle.', f: 'app-boitiers' },
  { t: 'Ouvrir les opercules nécessaires de la boîte de dérivation (pas un de plus).', f: 'app-boite' },
  { t: 'Mesurer chaque tube en suivant son axe. Le tube entre dans les boîtiers : prévoir la longueur de l\'embout.', f: 'tubes' },
  { t: 'Couper le tube à la scie junior, puis ébavurer l\'intérieur et l\'extérieur.', f: 'outils-scie' },
  { t: 'Cintrer avec le ressort du bon diamètre. Rayon minimum : 5 × le diamètre (80 mm pour Ø 16, 100 mm pour Ø 20).', f: 'tubes' },
  { t: 'Placer les embouts et enfoncer les tubes jusqu\'au fond des entrées.', f: 'tubes' },
  { t: 'Fixer les tubes : une attache à 5 cm de chaque boîtier et à l\'entrée et la sortie de chaque coude, sans écraser le tube.', f: 'tubes' },
  { t: 'Contrôle visuel : tubes droits, parallèles aux bords, coudes réguliers, boîtiers de niveau.' },
  { t: 'Prendre une photo de la planche (vue de face, toute la planche dans le cadre) et la joindre au devoir.' },
  { t: 'Nettoyer le poste de travail et ranger l\'outillage.' },
];
const ETAPES_CABLAGE = [
  { t: "Lire l'énoncé : quels appareils, à quels emplacements, quelle finition demandée par le client.", f: 'sch-principe' },
  { t: 'Dessiner le schéma de principe.', f: 'sch-principe' },
  { t: 'Dessiner le schéma unifilaire.', f: 'sch-unifilaire' },
  { t: 'Dessiner le schéma de câblage sur la planche : appareils, fils et connexions dans la boîte.', f: 'sch-cablage' },
  { t: 'Compléter le bon de commande (le matériel de la planche est déjà repris) et la liste d\'outillage.', f: 'regles-tva' },
  { t: 'Faire contrôler le dossier par le professeur.', prof: true },
  { t: 'Placer les mécanismes dans les boîtiers et les douilles sur les rosaces.', f: 'app-douille' },
  { t: 'Mesurer et couper les fils en gardant ± 15 cm de réserve dans la boîte de dérivation.', f: 'fils' },
  { t: 'Tirer les fils d\'un même tube en une seule fois, avec le tire-fils.', f: 'outils-tirefils' },
  { t: 'Repérer les conducteurs aux deux extrémités.', f: 'fils' },
  { t: 'Dénuder sans blesser l\'âme du conducteur (8 mm pour les bornes Niko, voir la borne Wago).', f: 'outils-pinces' },
  { t: 'Réaliser les connexions dans la boîte avec des bornes Wago : l\'isolant doit arriver jusqu\'à la borne.', f: 'app-wago' },
  { t: 'Raccorder les appareils suivant le schéma de câblage. Phase sur le plot central de la douille, neutre sur la languette.', f: 'app-douille' },
  { t: 'Contrôle visuel des raccordements, puis contrôle de continuité au multimètre, hors tension.', f: 'outils-multimetre' },
  { t: 'Fermer les boîtiers et poser les finitions.' },
  { t: 'Mise sous tension et essai, uniquement en présence du professeur.', prof: true },
  { t: 'En cas de défaut : couper, consigner, rechercher le défaut hors tension, corriger, puis redemander l\'essai.', f: 'regles-securite', prof: true },
  { t: 'Prendre une photo du montage et la joindre au devoir. Nettoyer le poste de travail.' },
];

/* ---------- Fiches « Apprendre » ---------- */
const FICHES = [
  // Appareils
  { id: 'app-sch1', cat: 'Appareils', titre: 'Interrupteur simple (sch 1)', sym: 'sch1',
    html: `<p>Il ouvre ou ferme <strong>un seul conducteur</strong> : la phase. On l'utilise pour commander un ou plusieurs points lumineux depuis un seul endroit.</p>
<ul><li>Socle Niko 170-01100 : bornes <b>L</b> (arrivée de la phase) et <b>1</b> (départ vers la lampe, appelé « retour »).</li>
<li>Il doit toujours couper la <b>phase</b>, jamais le neutre (code Vinçotte 1902).</li></ul>` },
  { id: 'app-sch2', cat: 'Appareils', titre: 'Interrupteur bipolaire (sch 2)', sym: 'sch2',
    html: `<p>Il ouvre ou ferme <strong>deux conducteurs en même temps</strong> : la phase et le neutre. Le circuit est complètement isolé quand il est ouvert.</p>
<ul><li>Socle Niko 170-01200 : 4 bornes dans l'ordre <b>L1 · 1 · 2 · L2</b>. L1 et L2 = arrivée (phase et neutre), 1 et 2 = départs vers la lampe.</li>
<li>Utile pour les lieux humides, les appareils qu'on veut couper totalement, ou une prise de plus de 16 A.</li></ul>` },
  { id: 'app-sch5', cat: 'Appareils', titre: 'Interrupteur série, double allumage (sch 5)', sym: 'sch5',
    html: `<p>Deux interrupteurs dans un seul mécanisme, avec une <strong>arrivée commune</strong>. Chaque touche commande sa lampe (ou son groupe de lampes).</p>
<ul><li>Socle Niko 170-01500 : bornes dans l'ordre <b>1 · L · (vide) · 2</b>. L = phase commune, 1 et 2 = un retour par touche.</li>
<li>Exemple : les spots d'un côté, le plafonnier de l'autre.</li></ul>` },
  { id: 'app-sch6', cat: 'Appareils', titre: 'Interrupteur va-et-vient (sch 6)', sym: 'sch6',
    html: `<p>Il commande une lampe depuis <strong>deux endroits</strong> (couloir, escalier). On en utilise toujours deux.</p>
<ul><li>Socle Niko 170-01600 : bornes <b>L · 1 · 1'</b>. L = commun, 1 et 1' = les deux « navettes ».</li>
<li>Le commun du premier reçoit la phase, le commun du second part vers la lampe. Les navettes relient les deux interrupteurs.</li></ul>` },
  { id: 'app-sch7', cat: 'Appareils', titre: 'Permutateur (sch 7)', sym: 'sch7',
    html: `<p>Appelé aussi inverseur. Il s'ajoute entre deux va-et-vient pour commander une lampe depuis <strong>trois endroits ou plus</strong>. Il croise les deux navettes.</p>
<ul><li>Socle Niko 170-01700 : 4 bornes marquées ✱. Les deux bornes extérieures reçoivent les navettes d'un va-et-vient, les deux bornes du milieu repartent vers l'autre va-et-vient.</li></ul>` },
  { id: 'app-sch62', cat: 'Appareils', titre: 'Va-et-vient bipolaire (sch 6/2)', sym: 'sch62',
    html: `<p>Un va-et-vient qui coupe <strong>la phase et le neutre</strong> en même temps, avec une seule touche. Deux sch 6/2 commandent une lampe depuis deux endroits, en coupure bipolaire.</p>
<ul><li>Socle Niko 170-02200 : en haut <b>L1 · 1 · 2 · L2</b>, en bas <b>1' · 2'</b>.</li>
<li>Pôle 1 : commun L1, navettes 1 et 1'. Pôle 2 : commun L2, navettes 2 et 2'.</li>
<li>Sur le premier : phase sur L1, neutre sur L2. Les navettes (1-1', 2-2') vont vers le second, qui alimente la lampe par L1 et L2.</li>
<li>Set de finition : touche simple (1xx-61105).</li></ul>` },
  { id: 'app-sch66', cat: 'Appareils', titre: 'Va-et-vient double (sch 6+6)', sym: 'sch66',
    html: `<p>Deux va-et-vient <strong>indépendants</strong> dans un seul appareil, avec deux touches. Idéal en cage d'escalier : un 6+6 en bas commande la lampe du rez et celle de l'étage, chacune avec son propre sch 6.</p>
<ul><li>Socle Niko 170-02600 : en haut <b>L1 · 1 · 2 · L2</b>, en bas <b>1' · 2'</b>.</li>
<li>Touche 1 : commun L1, navettes 1 et 1'. Touche 2 : commun L2, navettes 2 et 2'.</li>
<li>Les deux communs (L1 et L2) reçoivent la phase. Chaque paire de navettes part vers le va-et-vient (sch 6) de sa lampe.</li>
<li>Set de finition : touche double (1xx-61505).</li></ul>` },
  { id: 'app-prise', cat: 'Appareils', titre: 'Prise de courant 2P+T', sym: 'prise',
    html: `<p>Prise avec contact de terre et sécurité enfants (obligatoire, NBN C 61-112).</p>
<ul><li>3 bornes : phase, neutre et <b>terre</b> (⏚). La terre est toujours raccordée (code 1218).</li>
<li>Un circuit de prises se câble en <b>2,5 mm²</b> minimum (code 1806).</li>
<li><b>Prise commandée</b> : une prise peut être commandée par un interrupteur (lampe de chevet, guirlande…). La phase passe alors par l'interrupteur, comme pour une lampe ; le neutre et la terre arrivent directement.</li></ul>` },
  { id: 'app-bp', cat: 'Appareils', titre: 'Boutons-poussoirs (simple, à voyant, double)', sym: 'bp',
    html: `<p>Un bouton-poussoir ferme le circuit <strong>seulement pendant l'appui</strong> et revient seul au repos. Il ne commande jamais une lampe directement : il envoie une impulsion à un <b>télérupteur</b> ou à une <b>minuterie</b>.</p>
<ul><li>Socle Niko 170-00000 : bornes <b>L</b> (phase) et <b>1</b> (départ vers la bobine A1 ou l'entrée BP de la minuterie).</li>
<li><b>Poussoir à voyant</b> : même socle, avec l'élément d'éclairage à LED <b>170-37323</b> à commander en plus. Le voyant a besoin du <b>neutre</b>, amené sur la borne <b>0</b> : il reste allumé et permet de repérer le poussoir dans le noir.</li>
<li><b>Double poussoir</b> (socle 170-05000) : deux poussoirs indépendants dans un seul appareil, bornes L1 · 1 · 2 · L2 en haut et 1' · 2' en bas.</li>
<li>Plusieurs poussoirs se raccordent <b>en parallèle</b> : tous reçoivent la phase sur L, et toutes les bornes 1 vont ensemble vers la bobine.</li>
<li>Sets de finition : touche simple 1xx-60005, touche double 1xx-61507.</li></ul>` },
  { id: 'app-tl', cat: 'Appareils', titre: 'Télérupteur (Hager EPN510)', sym: 'tl',
    html: `<p>Un relais « bistable » posé sur le rail DIN. Chaque impulsion sur sa bobine fait <strong>changer d'état</strong> son contact : une impulsion allume, la suivante éteint. On le commande depuis autant d'endroits que l'on veut, avec des boutons-poussoirs en parallèle.</p>
<ul><li>Bornes de la <b>bobine</b> : <b>A1</b> (reçoit la phase par les poussoirs) et <b>A2</b> (au neutre).</li>
<li>Bornes du <b>contact</b> : <b>1</b> (phase en permanence) et <b>2</b> (départ vers les lampes).</li>
<li>La bobine ne doit être alimentée que <b>pendant l'appui</b> : si A1 reçoit la phase en permanence, elle chauffe et grille.</li>
<li>Avantage sur le va-et-vient : on ajoute un point de commande avec un simple poussoir et deux fils, sans navette.</li></ul>` },
  { id: 'app-modulaires', cat: 'Appareils', titre: 'Minuterie, crépusculaire et horloge (rail DIN)', sym: 'min4',
    html: `<p>Ces appareils modulaires Hager se posent sur le <b>rail DIN</b> de la planche (à gauche ou à droite, entre le boîtier double et le simple). Ils ont tous besoin d'une <strong>alimentation permanente</strong> : la phase sur <b>L</b> et le neutre sur <b>N</b>, en direct, sans passer par un interrupteur.</p>
<h3>Minuterie d'escalier (EMN001)</h3>
<ul><li>Une impulsion sur un poussoir allume l'éclairage pendant un temps réglé, puis il s'éteint seul.</li>
<li>Bornes : <b>L</b>, <b>N</b>, <b>BP</b> (entrée des poussoirs) et <b>⊗</b> (départ vers les lampes).</li>
<li><b>Câblage 4 fils</b> : les poussoirs reçoivent la phase et la renvoient sur la borne BP. Les lampes sont seulement sur ⊗.</li>
<li><b>Câblage 3 fils</b> : les poussoirs sont raccordés entre la phase et le fil qui part vers les lampes (borne ⊗, reliée à la borne BP). Un appui allume directement les lampes et lance la temporisation. Un fil de moins entre les boîtiers, mais un poussoir bloqué laisse l'éclairage allumé.</li></ul>
<h3>Interrupteur crépusculaire (EEN100)</h3>
<ul><li>Il ferme son contact <b>1 → 2</b> quand la lumière du jour baisse sous le seuil réglé, et l'ouvre au lever du jour.</li>
<li>La cellule se place à l'extérieur, à l'abri du soleil direct et de l'éclairage qu'elle commande (sur la planche, elle n'est pas câblée).</li></ul>
<h3>Interrupteur horaire (EG071)</h3>
<ul><li>Une horloge à programmes qui bascule son inverseur aux heures choisies. Contact : commun <b>2</b>, <b>3</b> fermé pendant la plage programmée, <b>1</b> fermé hors plage.</li>
<li><b>Horloge + crépusculaire en série</b> : l'éclairage extérieur s'allume à la tombée de la nuit et s'éteint à l'heure programmée (par exemple 23 h), au lieu de rester allumé toute la nuit.</li></ul>
<p class="muted">Le marquage exact des bornes de la minuterie et du crépusculaire est à vérifier sur les modules de l'atelier.</p>` },
  { id: 'app-douille', cat: 'Appareils', titre: 'Douille E27 et rosace', sym: 'lampe',
    html: `<p>La douille (« socket ») est vissée sur la rosace en bois de 95 × 95 mm.</p>
<ul><li>Le <b>neutre</b> va sur la languette verticale, la <b>phase</b> (le retour) sur le plot central : en changeant l'ampoule, on ne touche pas la phase.</li>
<li>Les ergots de la douille doivent être dans les encoches : sinon la douille tourne quand on visse l'ampoule.</li>
<li>L'isolant du fil arrive jusqu'à la borne. La terre est amenée jusqu'au point lumineux.</li></ul>` },
  { id: 'app-boite', cat: 'Appareils', titre: 'Boîte de dérivation', sym: null,
    html: `<p>C'est là que se font toutes les connexions entre les fils (code 1822 : pas de connexion dans un tube).</p>
<ul><li>Notre boîte : 75 × 75 mm, 3 opercules par côté. On ouvre seulement ceux qui servent.</li>
<li>Gardez ± 15 cm de réserve : on doit pouvoir refaire une connexion et fermer le couvercle.</li>
<li>Rangez les fils proprement : une boîte en vrac est dangereuse à ouvrir.</li></ul>` },
  { id: 'app-wago', cat: 'Appareils', titre: 'Bornes Wago à levier', sym: null,
    html: `<p>Elles relient plusieurs fils dans la boîte. On choisit le modèle selon le nombre de fils : 2, 3 ou 5.</p>
<ul><li>Dénuder sur 11 mm (gabarit sur la borne). L'isolant doit toucher la borne : pas de cuivre visible.</li>
<li>Lever le levier, enfoncer le fil jusqu'au fond, rabattre. Tirer légèrement pour contrôler.</li>
<li>Une borne par point de connexion du schéma de câblage.</li></ul>` },
  { id: 'app-boitiers', cat: 'Appareils', titre: 'Mécanisme, finition, boîtier', sym: null,
    html: `<p>Un interrupteur Niko est composé du <b>socle</b> (le mécanisme avec les bornes, référence 170-…, sans couleur) et du <b>set de finition</b> (touche ou enjoliveur, dans la couleur du client). On peut aussi commander l'<b>appareil complet</b> (socle + set de finition).</p>
<ul><li>En <b>apparent</b>, le mécanisme se fixe dans un boîtier en saillie (simple ou double, 158 × 87 mm).</li>
<li>En <b>encastré</b>, il se fixe dans une boîte d'encastrement et reçoit une plaque de recouvrement.</li>
<li>Les références Niko Original commencent par la couleur : <b>100</b> = crème, <b>101</b> = blanc, <b>102</b> = gris clair.</li>
<li>Les plaques de recouvrement se commandent séparément (simple, double ou triple, entraxe 60 ou 71 mm).</li></ul>` },
  // Outils
  { id: 'outils-coffre', cat: 'Outils', titre: 'Le coffre de l\'électricien', sym: null,
    html: `<p>Chaque élève a son coffre. Avant chaque TP, vérifiez qu'il est complet : un outil manquant, c'est du temps perdu.</p>
<ul><li>Outils <b>isolés 1000 V</b> (poignées rouge et jaune) : ils protègent si on touche par erreur une pièce sous tension, mais on travaille toujours <b>hors tension</b>.</li>
<li>Un outil abîmé (isolant fendu) ne s'utilise plus.</li></ul>` },
  { id: 'outils-pinces', cat: 'Outils', titre: 'Les pinces', sym: null,
    html: `<ul><li><b>Pince coupante</b> : couper les fils. Jamais sur une vis ou un clou.</li>
<li><b>Pince à dénuder</b> : retirer l'isolant sans entailler le cuivre. Une âme blessée casse ou chauffe.</li>
<li><b>Pince à long bec</b> : former les œillets, guider un fil dans un endroit étroit.</li>
<li><b>Pince universelle</b> : tenir, plier, serrer.</li></ul>` },
  { id: 'outils-tournevis', cat: 'Outils', titre: 'Les tournevis', sym: null,
    html: `<ul><li><b>Plats 3, 4 et 5,5 mm</b> : la lame doit remplir la fente de la vis, sinon elle glisse et abîme la tête.</li>
<li><b>Cruciformes PZ1 et PZ2</b> : pour les vis Pozidriv. Les bornes à vis Niko ont une tête mixte : PZ1 ou plat.</li>
<li>Serrer fermement, sans forcer au point d'écraser le fil.</li></ul>` },
  { id: 'outils-scie', cat: 'Outils', titre: 'Scie junior et ébavureur', sym: null,
    html: `<ul><li>Couper le tube bien droit, en le tenant fermement, sans l'écraser.</li>
<li>Toujours <b>ébavurer</b> l'intérieur et l'extérieur : une bavure arrache l'isolant des fils pendant le tirage.</li></ul>` },
  { id: 'outils-tirefils', cat: 'Outils', titre: 'Le tire-fils', sym: null,
    html: `<p>Un ressort ou une lame qu'on glisse dans le tube pour tirer les fils.</p>
<ul><li>On attache un seul fil au tire-fils, les autres sont torsadés sur ce fil « tracteur ».</li>
<li>Le tirage se fait à deux : un tire régulièrement, l'autre pousse et guide les fils.</li>
<li>Tous les fils d'un même tube passent en une fois.</li></ul>` },
  { id: 'outils-multimetre', cat: 'Outils', titre: 'Le multimètre', sym: null,
    html: `<ul><li>Cordon noir sur <b>COM</b>, cordon rouge sur <b>V/Ω</b>.</li>
<li><b>Continuité</b> (hors tension) : bip ou 0 Ω = le fil n'est pas coupé et c'est le bon fil. « 1 » ou OL = circuit ouvert.</li>
<li><b>Tension</b> : choisir V~ (alternatif). Uniquement avec l'accord du professeur.</li></ul>` },
  // Fils et tubes
  { id: 'fils', cat: 'Fils et tubes', titre: 'Couleurs et sections des fils', sym: null,
    html: `<ul><li><b>Vert-jaune</b> : uniquement la terre (PE). Jamais un conducteur actif (code 1801).</li>
<li><b>Bleu</b> : réservé au neutre quand le circuit en a un (code 1802).</li>
<li><b>Autres couleurs</b> (brun, noir, gris, rouge…) : phase, retours, navettes.</li>
<li>Section : <b>1,5 mm²</b> pour un circuit d'éclairage seul, <b>2,5 mm²</b> dès qu'il y a une prise (code 1806–1807).</li>
<li>Fil rigide <b>H07V-U</b> : toujours sous tube ou goulotte (code 1815).</li></ul>` },
  { id: 'tubes', cat: 'Fils et tubes', titre: 'Tubes, cintrage et attaches', sym: null,
    html: `<ul><li>Sur notre planche : <b>Ø 16 mm</b> vers les points lumineux, <b>Ø 20 mm</b> vers les boîtiers du bas.</li>
<li>Rayon de courbure minimum : <b>5 × le diamètre extérieur</b>. Toujours cintrer avec le ressort du bon diamètre.</li>
<li>Longueur d'une courbe ≈ 5 × le diamètre. Mesurer en suivant l'axe du tube.</li>
<li>Attaches : à 5 cm de chaque boîtier, à l'entrée et à la sortie de chaque coude. L'attache ne doit pas aplatir le tube.</li>
<li>Le tube entre jusqu'au fond de la tubulure de la boîte.</li></ul>` },
  // Schémas
  { id: 'sch-principe', cat: 'Schémas', titre: 'Le schéma de principe', sym: null,
    html: `<p>Il montre <b>comment fonctionne</b> le circuit, sans tenir compte de l'emplacement des appareils.</p>
<ol><li>En haut la phase (L1), en bas le neutre (N), sous le neutre la terre (PE). Le disjoncteur est déjà dessiné.</li>
<li>Placez les symboles entre L1 et N : l'interrupteur côté phase, la lampe côté neutre.</li>
<li>Reliez par des traits horizontaux et verticaux. Un point noir marque une connexion.</li>
<li>Vérifiez avec le doigt : en fermant l'interrupteur, le courant va de L1 à N en passant par la lampe.</li></ol>` },
  { id: 'sch-unifilaire', cat: 'Schémas', titre: 'Le schéma unifilaire', sym: null,
    html: `<p>Il montre en <b>un seul trait</b> ce qui est raccordé sur un même circuit, comme pour le contrôle Vinçotte (codes 1501, 1503).</p>
<ol><li>En bas : le disjoncteur, son calibre (ex. 10 A) et la lettre du circuit (A).</li>
<li>Le long du trait vertical : le type de canalisation et le nombre de conducteurs (ex. H07V-U 3 × 1,5 mm² sous tube).</li>
<li>Chaque point raccordé reçoit un numéro (1, 2, 3…) et une branche horizontale avec ses symboles.</li></ol>` },
  { id: 'sch-position', cat: 'Schémas', titre: 'Le schéma de position', sym: null,
    html: `<p>Il montre <b>où</b> se trouvent les appareils sur le support, avec les cotes en mm.</p>
<ul><li>Notre planche : 800 × 600 mm. Les boîtiers des coins sont à 40 mm des bords.</li>
<li>Le point lumineux central, la boîte de dérivation et le boîtier central sont sur l'axe vertical.</li>
<li>La boîte de dérivation est à égale distance (a = a) des deux boîtiers de l'axe.</li></ul>` },
  { id: 'sch-cablage', cat: 'Schémas', titre: 'Le schéma de câblage', sym: null,
    html: `<p>Il montre chaque fil, avec sa couleur, <b>tel qu'il sera posé</b> sur la planche.</p>
<ol><li>Placez les appareils aux emplacements demandés.</li>
<li>Tirez chaque fil d'une borne vers la boîte de dérivation. Le fil suit le tube.</li>
<li>Dans la boîte, créez un point de connexion (= une borne Wago) et reliez-y les fils.</li>
<li>Évitez les croisements inutiles. Comptez les fils dans chaque tube.</li></ol>` },
  // Règles
  { id: 'regles-securite', cat: 'Règles', titre: 'Sécurité au TP', sym: null,
    html: `<ul><li>Toute mise sous tension se fait <b>en présence du professeur</b>. Un essai sans accord annule le montage, même s'il fonctionne.</li>
<li>Tout dépannage se fait <b>hors tension</b> : couper, consigner (cadenas), vérifier l'absence de tension.</li>
<li>Méthode de dépannage : observer le symptôme, contrôle visuel, contrôle de continuité, trouver le défaut, corriger, redemander l'essai.</li></ul>` },
  { id: 'regles-tva', cat: 'Règles', titre: 'Bon de commande et TVA', sym: null,
    html: `<ul><li>Tout le matériel doit être dans la liste : un oubli vous pénalise, le matériel n'est commandé qu'une fois.</li>
<li>Prix total = prix unitaire × quantité. Total HTVA = somme des prix totaux.</li>
<li><b>TVA 6 %</b> : rénovation d'un logement privé d'au moins 10 ans (compté depuis l'année de première occupation), facturée directement au particulier.</li>
<li><b>TVA 21 %</b> : construction neuve, logement de moins de 10 ans, ou bâtiment qui n'est pas un logement privé.</li>
<li>Total TVAC = Total HTVA + TVA.</li></ul>` },
];
