/* =========================================================
   TP 3Pélec — éditeurs SVG : planche (câblage), principe, unifilaire
   ========================================================= */
const NS = 'http://www.w3.org/2000/svg';
function S(tag, attrs = {}, parent) {
  const el = document.createElementNS(NS, tag);
  for (const k in attrs) if (attrs[k] !== undefined && attrs[k] !== null) el.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(el);
  return el;
}
function T(parent, x, y, txt, attrs = {}) {
  const t = S('text', Object.assign({ x, y }, attrs), parent);
  t.textContent = txt;
  return t;
}
const uid = () => Math.random().toString(36).slice(2, 9);
function svgPoint(svg, evt) {
  const p = svg.createSVGPoint();
  p.x = evt.clientX; p.y = evt.clientY;
  const m = svg.getScreenCTM();
  return m ? p.matrixTransform(m.inverse()) : { x: 0, y: 0 };
}

/* ---------- géométrie : polylignes arrondies et décalées ---------- */
function roundPolyline(pts, r) {
  if (!r || pts.length < 3) return pts.map(p => [p[0], p[1]]);
  const out = [[pts[0][0], pts[0][1]]];
  for (let i = 1; i < pts.length - 1; i++) {
    const [x0, y0] = pts[i - 1], [x1, y1] = pts[i], [x2, y2] = pts[i + 1];
    const l1 = Math.hypot(x1 - x0, y1 - y0), l2 = Math.hypot(x2 - x1, y2 - y1);
    const rr = Math.min(r, l1 * 0.95, l2 * 0.95);
    const u1 = [(x1 - x0) / l1, (y1 - y0) / l1], u2 = [(x2 - x1) / l2, (y2 - y1) / l2];
    const a = [x1 - u1[0] * rr, y1 - u1[1] * rr], b = [x1 + u2[0] * rr, y1 + u2[1] * rr];
    // centre de l'arc (coins à 90°)
    const c = [a[0] + u2[0] * rr, a[1] + u2[1] * rr];
    const a0 = Math.atan2(a[1] - c[1], a[0] - c[0]);
    let a1 = Math.atan2(b[1] - c[1], b[0] - c[0]);
    let da = a1 - a0;
    while (da > Math.PI) da -= 2 * Math.PI;
    while (da < -Math.PI) da += 2 * Math.PI;
    const n = 10;
    for (let k = 0; k <= n; k++) {
      const ang = a0 + da * k / n;
      out.push([c[0] + rr * Math.cos(ang), c[1] + rr * Math.sin(ang)]);
    }
  }
  out.push([pts[pts.length - 1][0], pts[pts.length - 1][1]]);
  return out;
}
function offsetPolyline(pts, d) {
  if (!d) return pts.map(p => [p[0], p[1]]);
  const n = pts.length, out = [];
  const segN = [];
  for (let i = 0; i < n - 1; i++) {
    const dx = pts[i + 1][0] - pts[i][0], dy = pts[i + 1][1] - pts[i][1];
    const l = Math.hypot(dx, dy) || 1;
    segN.push([-dy / l, dx / l]);
  }
  for (let i = 0; i < n; i++) {
    let nx, ny;
    if (i === 0) [nx, ny] = segN[0];
    else if (i === n - 1) [nx, ny] = segN[n - 2];
    else {
      nx = segN[i - 1][0] + segN[i][0]; ny = segN[i - 1][1] + segN[i][1];
      const l = Math.hypot(nx, ny) || 1; nx /= l; ny /= l;
      const dot = nx * segN[i][0] + ny * segN[i][1];
      const k = 1 / Math.max(dot, 0.5); nx *= k; ny *= k;
    }
    out.push([pts[i][0] + nx * d, pts[i][1] + ny * d]);
  }
  return out;
}
const pathD = pts => pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(2) + ' ' + p[1].toFixed(2)).join(' ');

/* =========================================================
   1. ÉDITEUR DE CÂBLAGE SUR LA PLANCHE
   ========================================================= */
const ALIM_FILS = [
  { term: 'L', color: 'brun', dy: -5 },
  { term: 'N', color: 'bleu', dy: 0 },
  { term: 'PE', color: 'vj', dy: 5 },
];
function colorHex(id) { return (COULEURS_FIL.find(c => c.id === id) || COULEURS_FIL[3]).hex; }

function drawModule(g, type, cx, cy, view) {
  const A = APPAREILS[type];
  const f = S('g', { class: 'module' }, g);
  if (view === 'reel') {
    S('rect', { x: cx - 14, y: cy - 38, width: 28, height: 76, rx: 2, class: 'mod-body' }, f);
    S('rect', { x: cx - 14, y: cy - 24, width: 28, height: 48, class: 'mod-face' }, f);
    T(f, cx, cy - 13, A.court, { class: 'mod-txt', 'text-anchor': 'middle' });
    if (type === 'tl') { S('rect', { x: cx - 4, y: cy - 6, width: 8, height: 14, rx: 1.5, class: 'mod-lever' }, f); }
    else if (type === 'horl') { S('rect', { x: cx - 10, y: cy - 6, width: 20, height: 11, rx: 1, class: 'mod-lcd' }, f); T(f, cx, cy + 1.8, '12:00', { class: 'mod-lcd-txt', 'text-anchor': 'middle' }); }
    else { S('circle', { cx, cy: cy + 2, r: 6, class: 'mod-dial' }, f); S('line', { x1: cx, y1: cy + 2, x2: cx + 3.5, y2: cy - 2, class: 'mod-dial-hand' }, f); }
    T(f, cx, cy + 19, 'hager', { class: 'mod-brand', 'text-anchor': 'middle' });
  } else {
    S('rect', { x: cx - 14, y: cy - 38, width: 28, height: 76, rx: 2, class: 'symdev-box' }, f);
    drawPrincipeSymbol(f, type, cx, cy + 1, 0, symFit(type, 24, 36));
    T(f, cx, cy + 34, A.court, { class: 'symdev-lbl', 'text-anchor': 'middle' });
  }
  for (const [id, bx, by, aff] of A.bornes) T(g, cx + bx, cy + by + (by > 0 ? 9.5 : -6.5), aff || id, { class: 'borne-lbl', 'text-anchor': 'middle' });
}
function drawMechanism(g, type, cx, cy, view) {
  const A = APPAREILS[type];
  if (A.rail) return drawModule(g, type, cx, cy, view);
  if (view === 'reel') {
    // cadre métallique à griffes (dessin générique)
    const f = S('g', { class: 'meca' }, g);
    S('rect', { x: cx - 35.5, y: cy - 35.5, width: 71, height: 71, rx: 3, class: 'meca-frame' }, f);
    for (const [dx, dy] of [[-28, -28], [28, -28], [-28, 28], [28, 28]]) S('circle', { cx: cx + dx, cy: cy + dy, r: 2.2, class: 'meca-hole' }, f);
    S('rect', { x: cx - 34, y: cy - 8, width: 5, height: 16, rx: 2, class: 'meca-hole' }, f);
    S('rect', { x: cx + 29, y: cy - 8, width: 5, height: 16, rx: 2, class: 'meca-hole' }, f);
    S('rect', { x: cx - 4, y: cy - 34, width: 8, height: 3.5, rx: 1.5, class: 'meca-hole' }, f);
    S('circle', { cx: cx - 30.5, cy, r: 2.6, class: 'meca-screw' }, f);
    S('circle', { cx: cx + 30.5, cy, r: 2.6, class: 'meca-screw' }, f);
    // socle blanc : rangée de 4 bornes en haut, fenêtre centrale, encoches en bas (style socle Niko)
    S('path', { d: `M${cx - 28} ${cy - 26}h56v40h-6a4 4 0 0 0-8 0v6h-28v-6a4 4 0 0 0-8 0h-6z`, class: 'meca-body' }, f);
    if (BP_TYPES.includes(type)) {
      // poussoir : fenêtre avec bouton rond (deux pour le double poussoir)
      S('rect', { x: cx - 24, y: cy - 6, width: 48, height: 16, rx: 2.5, class: 'meca-win' }, f);
      for (const x of type === 'bp2' ? [cx - 10, cx + 10] : [cx]) S('circle', { cx: x, cy: cy + 2, r: 5, class: 'meca-key' }, f);
      if (type === 'bpv') S('circle', { cx: cx + 15, cy: cy + 2, r: 2.2, class: 'meca-led' }, f);
      if (type === 'bp2') { S('rect', { x: cx - 8, y: cy + 14, width: 6, height: 9, class: 'meca-win' }, f); S('rect', { x: cx + 2, y: cy + 14, width: 6, height: 9, class: 'meca-win' }, f); }
    } else if (type === 'prise') {
      S('circle', { cx, cy: cy + 2, r: 10, class: 'meca-socket' }, f);
      S('circle', { cx: cx - 4.5, cy: cy + 2, r: 1.6, class: 'meca-pin' }, f);
      S('circle', { cx: cx + 4.5, cy: cy + 2, r: 1.6, class: 'meca-pin' }, f);
      S('rect', { x: cx - 1, y: cy - 8.5, width: 2, height: 4, class: 'meca-pin' }, f);
    } else {
      S('rect', { x: cx - 24, y: cy - 6, width: 48, height: 16, rx: 2.5, class: 'meca-win' }, f);
      S('rect', { x: cx - 21, y: cy - 3.5, width: 7, height: 11, rx: 2.5, class: 'meca-key' }, f);
      S('rect', { x: cx + 14, y: cy - 3.5, width: 7, height: 11, rx: 2.5, class: 'meca-key' }, f);
      drawPrincipeSymbol(f, type, cx, cy + 2, 0, symFit(type, 24, 13));
      S('rect', { x: cx - 8, y: cy + 14, width: 6, height: 9, class: 'meca-win' }, f);
      S('rect', { x: cx + 2, y: cy + 14, width: 6, height: 9, class: 'meca-win' }, f);
    }
    // fenêtres de bornes
    const bx = [-21, -7, 7, 21];
    for (const x of bx) S('rect', { x: cx + x - 5, y: cy - 23.5, width: 10, height: 13, rx: 1, class: 'meca-term' }, f);
    if (!A.bornes.some(b => b[2] > 0)) T(f, cx - 22, cy + 32.5, '10AX 250V~', { class: 'meca-txt' });
  } else {
    const f = S('g', { class: 'sym-dev' }, g);
    S('rect', { x: cx - 30, y: cy - 28, width: 60, height: 56, rx: 3, class: 'symdev-box' }, f);
    drawPrincipeSymbol(f, type, cx, cy + 3, 0, symFit(type, 50, 26));
    // appareils à bornes en bas (6/2, 6+6) : étiquette courte pour ne pas couvrir 1' et 2'
    T(f, cx + 27, cy + 25, A.bornes.some(b => b[2] > 0) ? A.court.replace('Sch ', '') : A.court, { class: 'symdev-lbl', 'text-anchor': 'end' });
  }
  for (const [id, bx, by, aff] of A.bornes) {
    // bornes du bas (1', 2') : étiquette sous la borne
    const dy = by > 0 ? (view === 'reel' ? 9.5 : 8.5) : -(view === 'reel' ? 8.2 : 4.5);
    T(g, cx + bx, cy + by + dy, aff || id, { class: 'borne-lbl', 'text-anchor': 'middle' });
  }
}
function drawDouille(g, cx, cy, view) {
  if (view === 'reel') {
    S('circle', { cx, cy, r: 21, class: 'douille' }, g);
    S('circle', { cx, cy, r: 14, class: 'douille-in' }, g);
    S('circle', { cx, cy, r: 3, class: 'douille-plot' }, g);
    S('rect', { x: cx - 13, y: cy - 2, width: 4, height: 9, rx: 1, class: 'douille-plot' }, g);
  } else {
    S('circle', { cx, cy, r: 13, class: 'sym-line', fill: 'var(--paper)' }, g);
    S('path', { d: `M${cx - 9.2} ${cy - 9.2}L${cx + 9.2} ${cy + 9.2}M${cx + 9.2} ${cy - 9.2}L${cx - 9.2} ${cy + 9.2}`, class: 'sym-line' }, g);
  }
  for (const [lbl, bx, by] of APPAREILS.douille.bornes) {
    T(g, cx + bx, cy + by - 4.5, lbl, { class: 'borne-lbl', 'text-anchor': 'middle' });
  }
}

function drawBoardBase(svg, opts = {}) {
  const P = PLANCHE;
  S('rect', { x: 0, y: 0, width: P.W, height: P.H, rx: 4, class: 'board' }, svg);
  // rails DIN (sous les tubes)
  if (opts.rails) for (const el of P.elements.filter(e => e.kind === 'rail')) {
    S('rect', { x: el.x, y: 452.5, width: el.w, height: 35, rx: 1, class: 'din' }, svg);
    for (let x = el.x + 12; x < el.x + el.w - 6; x += 25) S('rect', { x: x - 6, y: 467, width: 12, height: 6, rx: 3, class: 'din-hole' }, svg);
  }
  // tubes
  for (const [id, t] of Object.entries(P.tubes)) {
    if (id === 'ALIM' && opts.noAlim) continue;
    if (t.rail && !opts.rails) continue;
    const c = roundPolyline(t.pts, t.r);
    const g = S('g', { class: 'tube' }, svg);
    S('path', { d: pathD(c), class: 'tube-body', 'stroke-width': t.d }, g);
    S('path', { d: pathD(offsetPolyline(c, t.d / 2)), class: 'tube-edge' }, g);
    S('path', { d: pathD(offsetPolyline(c, -t.d / 2)), class: 'tube-edge' }, g);
  }
  // éléments
  for (const el of P.elements) {
    if (el.kind === 'rail') continue;
    if (el.kind === 'rosace') {
      S('rect', { x: el.x, y: el.y, width: el.w, height: el.h, rx: 2, class: 'rosace' }, svg);
      for (const [dx, dy] of [[9, 9], [el.w - 9, 9], [9, el.h - 9], [el.w - 9, el.h - 9]]) {
        S('circle', { cx: el.x + dx, cy: el.y + dy, r: 3.2, class: 'vis' }, svg);
        S('circle', { cx: el.x + dx, cy: el.y + dy, r: 1.3, class: 'vis-in' }, svg);
      }
    } else {
      S('rect', { x: el.x, y: el.y, width: el.w, height: el.h, rx: 6, class: 'saillie' }, svg);
      if (el.kind === 'double') S('line', { x1: el.x + 4, x2: el.x + el.w - 4, y1: el.y + el.h / 2, y2: el.y + el.h / 2, class: 'saillie-sep' }, svg);
    }
  }
  const b = P.box;
  S('rect', { x: b.x, y: b.y, width: b.w, height: b.h, rx: 3, class: 'boite' }, svg);
  return svg;
}

class CablageEditor {
  constructor(host, state, opts = {}) {
    this.host = host; this.st = state; this.opts = opts;
    state.placed ||= {}; state.douilles ||= {}; state.nodes ||= []; state.wires ||= [];
    state.view ||= 'reel';
    this.mode = 'fil'; this.color = 'brun'; this.pick = null; this.pending = null;
    this.zoom = 'full';
    this.build();
  }
  changed() { this.render(); this.opts.onChange && this.opts.onChange(); }
  build() {
    const h = this.host; h.innerHTML = '';
    h.classList.add('editor');
    const bar = document.createElement('div'); bar.className = 'toolbar';
    bar.innerHTML = `
      <div class="tool-group" role="group" aria-label="Outil">
        <button type="button" data-mode="placer" class="tbtn">Placer un appareil</button>
        <button type="button" data-mode="fil" class="tbtn">Tirer un fil</button>
        <button type="button" data-mode="gomme" class="tbtn">Effacer</button>
      </div>
      <div class="tool-group swatches" role="group" aria-label="Couleur du fil">
        ${COULEURS_FIL.map(c => `<button type="button" class="swatch" data-color="${c.id}" title="${c.nom}" aria-label="Fil ${c.nom}" style="--c:${c.hex};${c.hex2 ? `--c2:${c.hex2}` : ''}"></button>`).join('')}
      </div>
      <div class="tool-group" role="group" aria-label="Affichage">
        <button type="button" data-view="reel" class="tbtn">Vue réaliste</button>
        <button type="button" data-view="symboles" class="tbtn">Vue symboles</button>
      </div>
      <div class="tool-group" role="group" aria-label="Zoom">
        <button type="button" data-zoom="full" class="tbtn">Planche entière</button>
        <button type="button" data-zoom="boite" class="tbtn">Zoom boîte</button>
      </div>`;
    h.appendChild(bar);
    this.palette = document.createElement('div'); this.palette.className = 'palette';
    h.appendChild(this.palette);
    const wrap = document.createElement('div'); wrap.className = 'svg-wrap';
    this.svg = S('svg', { viewBox: '0 0 800 600', class: 'board-svg', role: 'img', 'aria-label': 'Schéma de câblage sur la planche' });
    wrap.appendChild(this.svg); h.appendChild(wrap);
    this.hint = document.createElement('p'); this.hint.className = 'hint'; h.appendChild(this.hint);
    this.summary = document.createElement('div'); this.summary.className = 'cab-summary'; h.appendChild(this.summary);

    bar.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.mode) { this.mode = b.dataset.mode; this.pending = null; }
      if (b.dataset.color) { this.color = b.dataset.color; if (this.mode !== 'fil') this.mode = 'fil'; }
      if (b.dataset.view) { this.st.view = b.dataset.view; this.opts.onChange && this.opts.onChange(); }
      if (b.dataset.zoom) this.zoom = b.dataset.zoom;
      this.render();
    });
    this.palette.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      this.pick = b.dataset.type; this.mode = 'placer'; this.render();
    });
    this.svg.addEventListener('click', e => this.onClick(e));
    this.svg.addEventListener('pointermove', e => this.onMove(e));
    document.addEventListener('keydown', this._key = e => { if (e.key === 'Escape') { this.pending = null; this.render(); } });
    this.render();
  }
  destroy() { document.removeEventListener('keydown', this._key); }
  // rails DIN visibles : exercice avec modulaires, ou module déjà posé
  railsOn() { return !!this.opts.rails || Object.keys(this.st.placed || {}).some(p => /^R[GD]-/.test(p)); }

  /* --- positions --- */
  endpointPos(ep) {
    const P = PLANCHE;
    if (ep.k === 'dev') {
      const pos = P.slots.find(p => p.id === ep.pos);
      const b = APPAREILS[this.st.placed[ep.pos]].bornes.find(x => x[0] === ep.t);
      return [pos.cx + b[1], pos.cy + b[2]];
    }
    if (ep.k === 'lamp') {
      const pt = P.points.find(p => p.id === ep.pl);
      const b = APPAREILS.douille.bornes.find(x => x[0] === ep.t);
      return [pt.cx + b[1], pt.cy + b[2]];
    }
    if (ep.k === 'node') { const n = this.st.nodes.find(n => n.id === ep.id); return [n.x, n.y]; }
    if (ep.k === 'alim') { const f = ALIM_FILS.find(f => f.term === ep.t); return [P.box.x + 6, P.box.y + P.box.h / 2 + f.dy]; }
  }
  elemOf(ep) {
    if (ep.k === 'dev') return PLANCHE.slots.find(p => p.id === ep.pos).el;
    if (ep.k === 'lamp') return ep.pl;
    return null;
  }
  valid(ep) {
    if (ep.k === 'dev') return !!this.st.placed[ep.pos] && APPAREILS[this.st.placed[ep.pos]].bornes.some(b => b[0] === ep.t);
    if (ep.k === 'lamp') return !!this.st.douilles[ep.pl];
    if (ep.k === 'node') return this.st.nodes.some(n => n.id === ep.id);
    return true;
  }
  /* --- routage --- */
  computeOffsets() {
    const counts = {}; this.off = new Map();
    for (const w of this.st.wires) {
      for (const side of ['a', 'b']) {
        const el = this.elemOf(w[side]);
        if (!el) continue;
        if (side === 'b' && el === this.elemOf(w.a)) continue;
        (counts[el] ||= []).push(w.id + side);
      }
    }
    for (const el in counts) {
      const list = counts[el], n = list.length, d = PLANCHE.tubes[el].d;
      const sp = Math.min(3, (d - 5) / Math.max(n, 1));
      list.forEach((key, i) => this.off.set(key, (i - (n - 1) / 2) * sp));
    }
  }
  leg(ep, key) {
    // du terminal jusqu'à l'intérieur de la boîte ; renvoie {pts, dir}
    const el = this.elemOf(ep), t = PLANCHE.tubes[el];
    const o = this.off.get(key) || 0;
    const tube = offsetPolyline(roundPolyline(t.pts, t.r), o);
    const [tx, ty] = this.endpointPos(ep);
    const m = tube[0];
    const pts = [[tx, ty]];
    if (ep.k === 'lamp') {
      const yl = ty + 7 + o * 0.6;
      pts.push([tx, yl], [m[0], yl]);
    } else if (PLANCHE.slots.find(p => p.id === ep.pos).kind === 'rail') {
      // module sur rail : vers le haut du module, puis la bouche du tube
      const pos = PLANCHE.slots.find(p => p.id === ep.pos), elx = PLANCHE.elements.find(e => e.id === el);
      const yl = elx.y - 4 - Math.abs(o) * 0.5;
      if (ty < pos.cy) pts.push([tx, yl], [m[0] + o, yl]);
      else { const lane = (tx < pos.cx ? pos.cx - 15 : pos.cx + 15) + o * 0.3; pts.push([tx, ty + 5], [lane, ty + 5], [lane, yl], [m[0] + o, yl]); }
    } else {
      const pos = PLANCHE.positions.find(p => p.id === ep.pos);
      const elx = PLANCHE.elements.find(e => e.id === el);
      const topRow = ty < pos.cy && pos.cy < elx.y + 80;
      if (topRow) {
        const yl = ty - 6 - Math.abs(o) * 0.4;
        pts.push([tx, yl], [m[0], yl]);
      } else {
        const lane = (tx < pos.cx ? elx.x + 5 : elx.x + elx.w - 5) + o * 0.5;
        const yl = elx.y + 6 + Math.abs(o);
        pts.push([tx < pos.cx ? tx - 6 : tx + 6, ty], [lane, ty], [lane, yl], [m[0], yl]);
      }
    }
    for (const p of tube) pts.push(p);
    const last = t.pts[t.pts.length - 1], prev = t.pts[t.pts.length - 2];
    const dx = Math.sign(last[0] - prev[0]), dy = Math.sign(last[1] - prev[1]);
    const end = tube[tube.length - 1];
    pts.push([end[0] + dx * 5, end[1] + dy * 5]);
    return { pts, dir: [dx, dy] };
  }
  route(w) {
    const ea = this.elemOf(w.a), eb = this.elemOf(w.b);
    if (ea && ea === eb) {
      const A = this.endpointPos(w.a), B = this.endpointPos(w.b);
      const y = Math.min(A[1], B[1]) - 7;
      return [A, [A[0], y], [B[0], y], B];
    }
    let A, B, dirA = null;
    if (ea) { const l = this.leg(w.a, w.id + 'a'); A = l.pts; dirA = l.dir; } else A = [this.endpointPos(w.a)];
    if (eb) { const l = this.leg(w.b, w.id + 'b'); B = l.pts.reverse(); } else B = [this.endpointPos(w.b)];
    // dans la boîte : liaison directe (comme sur un schéma de câblage dessiné à la main)
    // pour ne jamais longer les bords ni passer sur les bornes d'alimentation
    const p = A[A.length - 1], q = B[0];
    const mid = [];
    // un fil qui ne s'arrête pas à une connexion la contourne, pour ne pas faire croire qu'il y est raccordé
    const own = [w.a, w.b].filter(e => e.k === 'node').map(e => e.id);
    const dx = q[0] - p[0], dy = q[1] - p[1], L2 = dx * dx + dy * dy || 1;
    for (const n of this.st.nodes) {
      if (own.includes(n.id)) continue;
      const t = ((n.x - p[0]) * dx + (n.y - p[1]) * dy) / L2;
      if (t <= 0.05 || t >= 0.95) continue;
      const px = p[0] + t * dx, py = p[1] + t * dy, d = Math.hypot(n.x - px, n.y - py);
      if (d < 4.5) {
        const l = Math.sqrt(L2), nx = -dy / l, ny = dx / l;
        const side = ((n.x - px) * nx + (n.y - py) * ny) > 0 ? -1 : 1;
        mid.push([n.x + nx * side * 6, n.y + ny * side * 6]);
        break;
      }
    }
    return [...A, ...mid, ...B];
  }

  /* --- rendu --- */
  render() {
    const svg = this.svg, st = this.st, P = PLANCHE;
    svg.innerHTML = ''; this.ghost = null;
    svg.setAttribute('viewBox', this.zoom === 'boite' ? '250 170 300 200' : '0 0 800 600');
    svg.dataset.mode = this.mode;
    const rails = this.railsOn();
    drawBoardBase(svg, { rails });
    // fils d'alimentation (fixes)
    const tA = P.tubes.ALIM;
    for (const f of ALIM_FILS) {
      const pts = [[tA.pts[0][0], tA.pts[0][1] + f.dy], [P.box.x + 6, P.box.y + P.box.h / 2 + f.dy]];
      this.drawWire(svg, pts, f.color, null);
    }
    T(svg, 18, tA.pts[0][1] - 14, 'Alimentation L · N · PE', { class: 'board-lbl' });
    // emplacements libres + appareils
    const pickRail = this.pick && estRail(this.pick);
    for (const pos of P.positions) {
      const type = st.placed[pos.id];
      const g = S('g', { class: 'pos', 'data-pos': pos.id }, svg);
      if (type) drawMechanism(g, type, pos.cx, pos.cy, st.view);
      else S('rect', { x: pos.cx - 33, y: pos.cy - 33, width: 66, height: 66, rx: 4, class: 'slot' + (this.mode === 'placer' && this.pick && this.pick !== 'douille' && !pickRail ? ' slot-on' : '') }, g);
    }
    if (rails) for (const pos of P.railSlots) {
      const type = st.placed[pos.id];
      const g = S('g', { class: 'pos', 'data-pos': pos.id }, svg);
      if (type) drawMechanism(g, type, pos.cx, pos.cy, st.view);
      else S('rect', { x: pos.cx - 13, y: pos.cy - 36, width: 26, height: 72, rx: 2, class: 'slot' + (this.mode === 'placer' && pickRail ? ' slot-on' : '') }, g);
    }
    for (const pt of P.points) {
      const g = S('g', { class: 'pos', 'data-pl': pt.id }, svg);
      if (st.douilles[pt.id]) drawDouille(g, pt.cx, pt.cy, st.view);
      else S('circle', { cx: pt.cx, cy: pt.cy, r: 24, class: 'slot' + (this.mode === 'placer' && this.pick === 'douille' ? ' slot-on' : '') }, g);
    }
    // étiquettes du plan
    for (const pt of P.points) T(svg, pt.cx, 30, pt.id, { class: 'board-lbl', 'text-anchor': 'middle' });
    // fils
    st.wires = st.wires.filter(w => this.valid(w.a) && this.valid(w.b));
    this.computeOffsets();
    for (const w of st.wires) {
      const pts = this.route(w);
      this.drawWire(svg, pts, w.color, w.id);
    }
    // zone cliquable de la boîte (création de connexions)
    S('rect', { x: P.box.x + 12, y: P.box.y + 4, width: P.box.w - 16, height: P.box.h - 8, class: 'box-zone' }, svg).dataset.box = '1';
    // nœuds
    for (const n of st.nodes) {
      const cnt = st.wires.filter(w => (w.a.k === 'node' && w.a.id === n.id) || (w.b.k === 'node' && w.b.id === n.id)).length;
      S('circle', { cx: n.x, cy: n.y, r: 2.3, class: 'node', 'data-node': n.id }, svg);
      S('circle', { cx: n.x, cy: n.y, r: 6, class: 'hit', 'data-node': n.id }, svg);
      if (this.zoom === 'boite' && cnt) T(svg, n.x + 3.5, n.y - 3, String(cnt), { class: 'node-cnt' });
    }
    // bornes cliquables
    const term = (x, y, data, small) => {
      const c = S('circle', Object.assign({ cx: x, cy: y, r: small ? 2.1 : 2.6, class: 'term' }, data), svg);
      S('circle', Object.assign({ cx: x, cy: y, r: small ? 2.6 : 6, class: 'hit' }, data), svg);
      return c;
    };
    for (const pos of P.slots) {
      const type = st.placed[pos.id]; if (!type) continue;
      for (const [lbl, bx, by] of APPAREILS[type].bornes) term(pos.cx + bx, pos.cy + by, { 'data-ep': JSON.stringify({ k: 'dev', pos: pos.id, t: lbl }) });
    }
    for (const pt of P.points) {
      if (!st.douilles[pt.id]) continue;
      for (const [lbl, bx, by] of APPAREILS.douille.bornes) term(pt.cx + bx, pt.cy + by, { 'data-ep': JSON.stringify({ k: 'lamp', pl: pt.id, t: lbl }) });
    }
    for (const f of ALIM_FILS) term(P.box.x + 6, P.box.y + P.box.h / 2 + f.dy, { 'data-ep': JSON.stringify({ k: 'alim', t: f.term }) }, true);
    if (this.pending) {
      const p = this.endpointPos(this.pending);
      if (p) S('circle', { cx: p[0], cy: p[1], r: 5, class: 'pending' }, svg);
      this.ghost = S('line', { x1: p[0], y1: p[1], x2: p[0], y2: p[1], class: 'ghost-wire', stroke: colorHex(this.color) }, svg);
    }
    this.renderChrome();
  }
  drawWire(svg, pts, color, id) {
    const d = pathD(pts);
    const g = S('g', { class: 'wire' + (id ? '' : ' wire-fixed'), 'data-wire': id || '' }, svg);
    if (color === 'vj') {
      S('path', { d, stroke: '#2fa84f', class: 'wire-line' }, g);
      S('path', { d, stroke: '#e8c71a', class: 'wire-line wire-stripe' }, g);
    } else S('path', { d, stroke: colorHex(color), class: 'wire-line' }, g);
    if (id) S('path', { d, class: 'wire-hit', 'data-wire': id }, g);
  }
  renderChrome() {
    const h = this.host;
    h.querySelectorAll('[data-mode]').forEach(b => b.classList.toggle('on', b.dataset.mode === this.mode));
    h.querySelectorAll('[data-color]').forEach(b => b.classList.toggle('on', b.dataset.color === this.color));
    h.querySelectorAll('[data-view]').forEach(b => b.classList.toggle('on', b.dataset.view === this.st.view));
    h.querySelectorAll('[data-zoom]').forEach(b => b.classList.toggle('on', b.dataset.zoom === this.zoom));
    const types = ['sch1', 'sch2', 'sch5', 'sch6', 'sch7', 'sch62', 'sch66', 'bp', 'bpv', 'bp2', 'prise', ...(this.railsOn() ? ['tl', 'min4', 'min3', 'crep', 'horl'] : []), 'douille'];
    this.palette.hidden = this.mode !== 'placer';
    this.palette.innerHTML = '<span class="palette-lbl">Appareil :</span>' + types.map(t =>
      `<button type="button" class="chip${this.pick === t ? ' on' : ''}" data-type="${t}">${t === 'douille' ? 'Douille E27' : APPAREILS[t].court + ' · ' + APPAREILS[t].nom.replace('Interrupteur ', '')}</button>`).join('');
    const hints = {
      placer: this.pick ? (this.pick === 'douille' ? 'Cliquez sur une rosace libre pour y poser la douille.' : estRail(this.pick) ? 'Cliquez sur un emplacement libre du rail DIN pour y clipser le module.' : 'Cliquez sur un emplacement libre (cadre en pointillés) pour y placer l\'appareil.') : 'Choisissez un appareil, puis cliquez sur un emplacement libre.',
      fil: this.pending ? 'Cliquez sur la borne d\'arrivée, ou dans la boîte de dérivation pour créer une connexion (borne Wago). Échap pour annuler.' : 'Cliquez sur une borne de départ. Les fils suivent automatiquement les tubes.',
      gomme: 'Cliquez sur un fil, une connexion ou un appareil pour l\'effacer.',
    };
    this.hint.textContent = hints[this.mode];
    // résumé : fils par tube et connexions
    const perTube = {};
    for (const w of this.st.wires) for (const s of ['a', 'b']) {
      const el = this.elemOf(w[s]); if (!el) continue;
      if (s === 'b' && el === this.elemOf(w.a)) continue;
      perTube[el] = (perTube[el] || 0) + 1;
    }
    const wagos = this.st.nodes.map(n => this.st.wires.filter(w => (w.a.k === 'node' && w.a.id === n.id) || (w.b.k === 'node' && w.b.id === n.id)).length).filter(c => c > 0);
    const w2 = wagos.filter(c => c <= 2).length, w3 = wagos.filter(c => c === 3).length, w5 = wagos.filter(c => c > 3 && c <= 5).length, wx = wagos.filter(c => c > 5).length;
    const names = { PL1: 'tube PL1', PL2: 'tube PL2', PL3: 'tube PL3', B1: 'tube boîtier gauche', B2: 'tube boîtier central', B3: 'tube boîtier droit', RG: 'tube rail gauche', RD: 'tube rail droit' };
    this.summary.innerHTML = `<div><span class="k">Fils par tube</span> ${Object.keys(perTube).length ? Object.entries(perTube).map(([k, v]) => `${names[k]} : <b>${v}</b>`).join(' · ') : '—'}</div>
      <div><span class="k">Connexions dans la boîte</span> ${wagos.length ? `${wagos.length} point(s) : ${w2 ? w2 + ' × 2 fils ' : ''}${w3 ? w3 + ' × 3 fils ' : ''}${w5 ? w5 + ' × 4–5 fils ' : ''}${wx ? `<span class="warn">${wx} avec plus de 5 fils</span>` : ''}` : '—'}</div>`;
  }
  onMove(e) {
    if (!this.ghost) return;
    const p = svgPoint(this.svg, e);
    this.ghost.setAttribute('x2', p.x); this.ghost.setAttribute('y2', p.y);
  }
  onClick(e) {
    const t = e.target, st = this.st;
    const p = svgPoint(this.svg, e);
    if (this.mode === 'placer') {
      if (!this.pick) return;
      const posG = t.closest('[data-pos]'), plG = t.closest('[data-pl]');
      if (this.pick === 'douille' && plG && !st.douilles[plG.dataset.pl]) { st.douilles[plG.dataset.pl] = true; this.changed(); }
      else if (this.pick !== 'douille' && posG && !st.placed[posG.dataset.pos] && estRail(this.pick) === /^R[GD]-/.test(posG.dataset.pos)) { st.placed[posG.dataset.pos] = this.pick; this.changed(); }
      return;
    }
    if (this.mode === 'gomme') {
      const w = t.dataset.wire || (t.closest('[data-wire]') && t.closest('[data-wire]').dataset.wire);
      if (w) { st.wires = st.wires.filter(x => x.id !== w); return this.changed(); }
      if (t.dataset.node) {
        const id = t.dataset.node;
        st.nodes = st.nodes.filter(n => n.id !== id);
        st.wires = st.wires.filter(x => !((x.a.k === 'node' && x.a.id === id) || (x.b.k === 'node' && x.b.id === id)));
        return this.changed();
      }
      const posG = t.closest('[data-pos]'), plG = t.closest('[data-pl]');
      if (posG && st.placed[posG.dataset.pos]) { delete st.placed[posG.dataset.pos]; return this.changed(); }
      if (plG && st.douilles[plG.dataset.pl]) { delete st.douilles[plG.dataset.pl]; return this.changed(); }
      return;
    }
    // mode fil
    let ep = null;
    if (t.dataset.ep) ep = JSON.parse(t.dataset.ep);
    else if (t.dataset.node) ep = { k: 'node', id: t.dataset.node };
    else if (t.dataset.box) {
      const n = { id: uid(), x: Math.round(p.x * 2) / 2, y: Math.round(p.y * 2) / 2 };
      st.nodes.push(n); ep = { k: 'node', id: n.id };
      if (!this.pending) { this.changed(); return; }
    }
    if (!ep) return;
    if (!this.pending) { this.pending = ep; this.render(); return; }
    if (JSON.stringify(ep) === JSON.stringify(this.pending)) { this.pending = null; this.render(); return; }
    st.wires.push({ id: uid(), a: this.pending, b: ep, color: this.color });
    this.pending = null;
    this.changed();
  }
}

/* ---------- plan d'implantation (énoncé) et schéma de position coté ---------- */
function renderPlanEnonce(host, variant) {
  host.innerHTML = '';
  const svg = S('svg', { viewBox: '-10 -10 820 620', class: 'plan-svg', role: 'img', 'aria-label': 'Plan des emplacements' }, host);
  const rails = variant.devices.some(d => estRail(d.type));
  drawBoardBase(svg, { rails });
  const lab = (x, y, txt, cls) => {
    const w = txt.length * 6.4 + 12;
    S('rect', { x: x - w / 2, y: y - 11, width: w, height: 20, rx: 10, class: 'tag-bg ' + (cls || '') }, svg);
    T(svg, x, y + 3.5, txt, { class: 'tag-txt', 'text-anchor': 'middle' });
  };
  for (const pt of PLANCHE.points) {
    const lamp = variant.lampes.find(l => l.pl === pt.id);
    if (lamp) { drawDouille(S('g', {}, svg), pt.cx, pt.cy, 'symboles'); lab(pt.cx, pt.cy + 40, lamp.nom, 'tag-lamp'); }
    else T(svg, pt.cx, pt.cy + 4, 'non utilisé', { class: 'board-lbl muted', 'text-anchor': 'middle' });
  }
  for (const pos of PLANCHE.positions) {
    const d = variant.devices.find(x => x.pos === pos.id);
    if (d) {
      S('rect', { x: pos.cx - 30, y: pos.cy - 28, width: 60, height: 56, rx: 3, class: 'symdev-box' }, svg);
      drawPrincipeSymbol(svg, d.type, pos.cx, pos.cy, 0, 0.5);
      lab(pos.cx, pos.cy + (pos.id.endsWith('-B') ? 43 : -40), d.nom, 'tag-dev');
    }
  }
  for (const pos of PLANCHE.railSlots) {
    const d = variant.devices.find(x => x.pos === pos.id);
    if (!d) continue;
    S('rect', { x: pos.cx - 14, y: pos.cy - 38, width: 28, height: 76, rx: 2, class: 'symdev-box' }, svg);
    drawPrincipeSymbol(svg, d.type, pos.cx, pos.cy, 0, symFit(d.type, 24, 40));
    lab(pos.cx, pos.cy + 52, d.nom, 'tag-dev');
  }
  T(svg, 18, PLANCHE.tubes.ALIM.pts[0][1] - 14, 'Alimentation', { class: 'board-lbl' });
}

function renderPosition(host) {
  host.innerHTML = '';
  const svg = S('svg', { viewBox: '-70 -60 940 730', class: 'plan-svg', role: 'img', 'aria-label': 'Schéma de position coté de la planche' }, host);
  drawBoardBase(svg);
  const P = PLANCHE, b = P.box;
  S('line', { x1: 400, y1: -30, x2: 400, y2: 630, class: 'axis' }, svg);
  T(svg, 406, 622, 'axe', { class: 'dim-txt' });
  const dimH = (x1, x2, y, txt, ext = 0) => {
    S('line', { x1, x2, y1: y, y2: y, class: 'dim', 'marker-start': 'url(#arr)', 'marker-end': 'url(#arr)' }, svg);
    if (ext) { S('line', { x1, x2: x1, y1: y - 6, y2: y + ext, class: 'dim-ext' }, svg); S('line', { x1: x2, x2, y1: y - 6, y2: y + ext, class: 'dim-ext' }, svg); }
    T(svg, (x1 + x2) / 2, y - 5, txt, { class: 'dim-txt', 'text-anchor': 'middle' });
  };
  const dimV = (y1, y2, x, txt, ext = 0) => {
    S('line', { x1: x, x2: x, y1, y2, class: 'dim', 'marker-start': 'url(#arr)', 'marker-end': 'url(#arr)' }, svg);
    if (ext) { S('line', { y1, y2: y1, x1: x - 6, x2: x + ext, class: 'dim-ext' }, svg); S('line', { y1: y2, y2, x1: x - 6, x2: x + ext, class: 'dim-ext' }, svg); }
    const t = T(svg, x - 6, (y1 + y2) / 2, txt, { class: 'dim-txt', 'text-anchor': 'middle', transform: `rotate(-90 ${x - 6} ${(y1 + y2) / 2})` });
    return t;
  };
  const defs = S('defs', {}, svg);
  const m = S('marker', { id: 'arr', viewBox: '0 0 10 10', refX: 5, refY: 5, markerWidth: 6, markerHeight: 6, orient: 'auto-start-reverse' }, defs);
  S('path', { d: 'M0 1 L9 5 L0 9 z', class: 'arrow' }, m);
  dimH(0, 800, -40, '800', 0);
  dimV(0, 600, -45, '600', 0);
  dimH(0, 40, 20, '40'); dimV(0, 40, 160, '40');
  dimH(760, 800, 20, '40'); dimV(0, 40, 640, '40');
  dimH(0, 40, 580, '40'); dimV(560, 600, 160, '40');
  dimH(760, 800, 580, '40'); dimV(560, 600, 640, '40');
  dimV(135, b.y, 470, 'a', 0); dimV(b.y + b.h, 402, 470, 'a', 0);
  T(svg, 478, 380, 'a = a', { class: 'dim-txt' });
  T(svg, 87.5, 152, 'rosace 95 × 95', { class: 'dim-note', 'text-anchor': 'middle' });
  T(svg, 400, 152, 'rosace 95 × 95', { class: 'dim-note', 'text-anchor': 'middle' });
  T(svg, 712.5, 152, 'rosace 95 × 95', { class: 'dim-note', 'text-anchor': 'middle' });
  T(svg, b.x + b.w + 6, b.y - 6, 'boîte 75 × 75', { class: 'dim-note' });
  T(svg, 83.5, 578, 'boîtier double', { class: 'dim-note', 'text-anchor': 'middle' });
  T(svg, 400, 505, 'boîtier simple', { class: 'dim-note', 'text-anchor': 'middle' });
  T(svg, 716.5, 578, 'boîtier double', { class: 'dim-note', 'text-anchor': 'middle' });
  T(svg, 200, 236, 'tube Ø 16 · R min 80', { class: 'dim-note', 'text-anchor': 'middle' });
  T(svg, 600, 236, 'tube Ø 16 · R min 80', { class: 'dim-note', 'text-anchor': 'middle' });
  T(svg, 200, 318, 'tube Ø 20 · R min 100', { class: 'dim-note', 'text-anchor': 'middle' });
  T(svg, 600, 318, 'tube Ø 20 · R min 100', { class: 'dim-note', 'text-anchor': 'middle' });
  T(svg, 180, 260, 'alimentation Ø 16 ou 20', { class: 'dim-note', 'text-anchor': 'middle' });
  T(svg, 400, 650, 'Les 3 boîtiers du bas sont alignés par le haut. Cotes en mm.', { class: 'dim-note', 'text-anchor': 'middle' });
}

/* =========================================================
   2. SYMBOLES DE PRINCIPE + ÉDITEUR
   ========================================================= */
/* Symboles du schéma de principe : mêmes dessins que le Banc de câblage
   (coordonnées du banc, bornes à ± 40), affichés à l'échelle 0,75 (bornes à ± 30).
   L'ordre des bornes (pins) est celui utilisé par la correction automatique. */
const BANC_K = 0.75;
const bLn = (x1, y1, x2, y2, c) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"${c ? ` class="${c}"` : ''}/>`;
const bBlade = x => bLn(x, -40, x, -14) + bLn(x, 14, x, 40) + bLn(x, 14, x - 13, -16, 'bl');                // contact ouvert (repos)
const bMan = (xb, xe, vx) => `<path d="M${xb + 5},-8 H${xb} V8 H${xb + 5}"/>` + bLn(xb, 0, xe, 0, 'dash') + `<path class="thin" d="M${vx - 3},2 L${vx},6 L${vx + 3},2"/>`;
const bPush = x => bLn(x - 7, 0, x - 22, 0, 'dash') + `<path d="M${x - 17},-8 H${x - 22} V8 H${x - 17}"/>`;   // commande par poussoir
const bCoil = (x, mark) => bLn(x, -40, x, -12) + bLn(x, 12, x, 40) + `<rect x="${x - 10}" y="-12" width="20" height="24"/>` + (mark || '');
const bLink = (x1, x2) => bLn(x1, 0, x2, 0, 'dash');
const mClock = (x, y) => `<circle cx="${x}" cy="${y}" r="6" class="thin"/>` + bLn(x, y, x, y - 4, 'thin') + bLn(x, y, x + 3, y, 'thin');
const mSun = (x, y) => `<circle cx="${x}" cy="${y}" r="3" class="thin"/>` + [0, 45, 90, 135, 180, 225, 270, 315].map(a => { const c = Math.cos(a * Math.PI / 180), sn = Math.sin(a * Math.PI / 180); return bLn((x + c * 5).toFixed(2), (y + sn * 5).toFixed(2), (x + c * 7.5).toFixed(2), (y + sn * 7.5).toFixed(2), 'thin'); }).join('');
const mStep = (x, y) => `<path class="thin" d="M${x - 6},${y + 4} h4 v-8 h4 v8 h4"/>`;
const bVV = ox => bLn(ox, -40, ox, -18) + bLn(ox - 20, 40, ox - 20, 18) + bLn(ox + 20, 40, ox + 20, 20) + bLn(ox, -18, ox - 19, 17, 'bl');
const BANC_SYM = {
  sch1: { pins: [[0, -40], [0, 40]], box: [-38, -40, 60, 80], draw: () => bBlade(0) + bMan(-28, -6, -10) },
  sch2: { pins: [[-20, -40], [-20, 40], [20, -40], [20, 40]], box: [-56, -40, 86, 80], draw: () => bBlade(-20) + bBlade(20) + bMan(-48, 14, -30) },
  // ordre : 1, 2, commun
  sch5: { pins: [[-20, 40], [40, 40], [-20, -40]], box: [-52, -40, 100, 80], draw: () => bBlade(-20) + bBlade(40) + bLn(-20, -40, 40, -40) + '<circle cx="40" cy="-40" r="3" class="tdot"/>' + bMan(-48, -26, -30) + bMan(12, 34, 30) },
  // ordre : 1, 1', commun
  sch6: { pins: [[-20, 40], [20, 40], [0, -40]], box: [-52, -40, 80, 80], draw: () => bVV(0) + bMan(-46, -10, -15) },
  sch7: { pins: [[-40, -40], [20, -40], [-20, 40], [40, 40]], box: [-66, -40, 120, 80],
    draw: () => bLn(-40, -40, -40, -22) + bLn(-40, -22, -30, -22) + bLn(-40, -40, -34, -32) + bLn(-34, -32, 48, -32) + bLn(48, -32, 48, -20) +
      bLn(20, -40, 20, -22) + bLn(8, -22, 32, -22) + bLn(-20, 40, -20, 20) + bLn(40, 40, 40, 20) + bLn(-20, 20, -31, -20, 'bl') + bLn(40, 20, 31, -20, 'bl') + bMan(-60, 35, -27) },
  // ordre : L1, 1, 1', L2, 2, 2'
  sch62: { pins: [[-40, -40], [-60, 40], [-20, 40], [40, -40], [20, 40], [60, 40]], box: [-92, -40, 160, 80], draw: () => bVV(-40) + bVV(40) + bMan(-86, 30, -55) },
  sch66: { pins: [[-50, -40], [-70, 40], [-30, 40], [50, -40], [30, 40], [70, 40]], box: [-102, -40, 180, 80], draw: () => '<g transform="translate(-10 0)">' + bVV(-40) + bMan(-86, -50, -55) + bVV(60) + bMan(14, 50, 45) + '</g>' },
  // bouton-poussoir N.O. : ordre L, 1
  bp: { pins: [[0, -40], [0, 40]], box: [-30, -40, 52, 80], draw: () => bBlade(0) + bPush(0) },
  bpv: { pins: [[0, -40], [0, 40]], box: [-30, -40, 64, 80], draw: () => bBlade(0) + bPush(0) + '<circle cx="22" cy="0" r="7" class="bulb"/>' + bLn(17, -5, 27, 5, 'thin') + bLn(17, 5, 27, -5, 'thin') },
  // double bouton-poussoir N.O./N.F. : ordre L1, 1, 1', L2, 2, 2' (au repos, le commun touche 1' et 2')
  bp2: { pins: [[-40, -40], [-20, 40], [-60, 40], [40, -40], [60, 40], [20, 40]], box: [-92, -40, 160, 80], draw: () => bVV(-40) + bPush(-50) + bVV(40) + bPush(30) },
  // télérupteur : bobine A1-A2, contact 1-2 ; ordre A1, A2, 1, 2
  tl: { pins: [[-20, -40], [-20, 40], [20, -40], [20, 40]], box: [-34, -40, 68, 80], draw: () => bCoil(-20, mStep(-20, 0)) + bBlade(20) + bLink(-10, 13) },
  // minuterie : entrée poussoirs BP-N, contact L-sortie ; ordre L, N, BP, sortie
  min4: { pins: [[20, -40], [-20, 40], [-20, -40], [20, 40]], box: [-34, -40, 68, 80], draw: () => bCoil(-20, mClock(-20, 0)) + bBlade(20) + bLink(-10, 13) },
  min3: { pins: [[20, -40], [-20, 40], [-20, -40], [20, 40]], box: [-34, -40, 68, 80], draw: () => bCoil(-20, mClock(-20, 0)) + bBlade(20) + bLink(-10, 13) },
  // crépusculaire : alimentation L-N, contact 1-2 ; ordre L, N, 1, 2
  crep: { pins: [[-20, -40], [-20, 40], [20, -40], [20, 40]], box: [-34, -40, 68, 80], draw: () => bCoil(-20, mSun(-20, 0)) + bBlade(20) + bLink(-10, 13) },
  // horloge : alimentation L-N, inverseur 2 (commun) - 1 (arrêt) / 3 (marche) ; ordre L, N, 1, 2, 3
  horl: { pins: [[-30, -40], [-30, 40], [0, 40], [20, -40], [40, 40]], box: [-44, -40, 92, 80], draw: () => bCoil(-30, mClock(-30, 0)) + bVV(20) + bLink(-20, 10) },
  lampe: { pins: [[0, -40], [0, 40]], box: [-28, -40, 56, 80], draw: () => bLn(0, -40, 0, -14) + bLn(0, 14, 0, 40) + '<circle r="14" class="bulb"/>' + bLn(-10, -10, 10, 10) + bLn(-10, 10, 10, -10) },
  // ordre : L, N, PE
  prise: { pins: [[-20, -40], [20, -40], [0, -40]], box: [-30, -40, 60, 74],
    draw: () => bLn(-20, -40, -20, 10) + bLn(20, -40, 20, 10) + bLn(0, -40, 0, -10) + '<circle cy="10" r="20" class="bulb"/>' +
      '<circle cx="-8" cy="12" r="3" class="tdot"/><circle cx="8" cy="12" r="3" class="tdot"/><rect x="-2.5" y="-10" width="5" height="9" class="tdot"/>' },
};
const SYM_NOMS = { bp: 'Bouton-poussoir', bpv: 'Poussoir à voyant', bp2: 'Double poussoir', tl: 'Télérupteur', min4: 'Minuterie 4 fils', min3: 'Minuterie 3 fils', crep: 'Crépusculaire', horl: 'Horloge', sch1: 'Interrupteur simple', sch2: 'Interrupteur bipolaire', sch5: 'Double allumage', sch6: 'Va-et-vient', sch7: 'Permutateur', sch62: 'Va-et-vient bipolaire', sch66: 'Va-et-vient double', lampe: 'Lampe', prise: 'Prise 2P+T' };
const SYM_P = Object.fromEntries(Object.entries(BANC_SYM).map(([k, v]) => [k, {
  nom: SYM_NOMS[k], terms: v.pins.map(([x, y]) => [x * BANC_K, y * BANC_K]),
  box: v.box.map(n => n * BANC_K),
}]));
// échelle pour faire tenir un symbole dans une case de w × h
function symFit(type, w, h) { const b = SYM_P[type].box; return Math.min(1, w / b[2], h / b[3]); }
// anciennes bornes (avant novembre 2026), pour convertir les schémas déjà dessinés
const SYM_P_V1 = {
  sch1: [[0, -30], [0, 30]], sch2: [[-15, -30], [-15, 30], [15, -30], [15, 30]], sch5: [[-15, -30], [15, -30], [0, 30]],
  sch6: [[-12, -30], [12, -30], [0, 30]], sch7: [[-12, -30], [12, -30], [-12, 30], [12, 30]],
  sch62: [[-16, 30], [-26, -30], [-6, -30], [16, 30], [6, -30], [26, -30]], sch66: [[-16, 30], [-26, -30], [-6, -30], [16, 30], [6, -30], [26, -30]],
  lampe: [[0, -30], [0, 30]], prise: [[-10, -30], [10, -30], [0, 30]],
};
function migrerPrincipe(st) {
  if (!st || st.v === 2) return st;
  st.v = 2;
  const syms = st.syms || [], wires = st.wires || [];
  if (!syms.length || !wires.length) return st;
  const place = (terms, sy) => terms.map(([x, y]) => { const [rx, ry] = rotPt(x, y, sy.rot || 0); return [sy.x + rx, sy.y + ry]; });
  const corr = [];
  for (const sy of syms) {
    if (!SYM_P_V1[sy.type] || !SYM_P[sy.type]) continue;
    const A = place(SYM_P_V1[sy.type], sy), B = place(SYM_P[sy.type].terms, sy);
    A.forEach((p, i) => corr.push([p, B[i]]));
  }
  const proche = (p, q) => Math.abs(p[0] - q[0]) < 0.5 && Math.abs(p[1] - q[1]) < 0.5;
  for (const w of wires) {
    if (!w.pts || w.pts.length < 2) continue;
    const debut = corr.find(([a]) => proche(a, w.pts[0])), fin = corr.find(([a]) => proche(a, w.pts[w.pts.length - 1]));
    // nouvelle borne → coude → ancienne position : le fil reste raccordé, en segments horizontaux et verticaux
    if (debut && !proche(debut[0], debut[1])) { const [A, B] = debut; w.pts.splice(0, 0, B, [A[0], B[1]]); }
    if (fin && !proche(fin[0], fin[1])) { const [A, B] = fin; w.pts.push([A[0], B[1]], B); }
    w.pts = w.pts.filter((p, i, a) => i === 0 || p[0] !== a[i - 1][0] || p[1] !== a[i - 1][1]);
  }
  return st;
}
function rotPt(x, y, rot) {
  switch ((rot % 360 + 360) % 360) {
    case 90: return [-y, x];
    case 180: return [-x, -y];
    case 270: return [y, -x];
    default: return [x, y];
  }
}
function drawPrincipeSymbol(parent, type, cx, cy, rot = 0, sc = 1) {
  const g = S('g', { transform: `translate(${cx} ${cy}) rotate(${rot}) scale(${sc * BANC_K})`, class: 'psym' }, parent);
  if (BANC_SYM[type]) g.innerHTML = BANC_SYM[type].draw();
  return g;
}

class PrincipeEditor {
  /* Comme le Banc de câblage : on touche un symbole de la palette puis la feuille pour le poser,
     on glisse un symbole pour le déplacer, on touche une borne puis une autre pour les relier.
     Pas de mode à choisir ; la feuille ne défile pas pendant qu'on dessine. */
  constructor(host, state, opts = {}) {
    this.host = host; this.st = state; this.opts = opts;
    state.syms ||= []; state.wires ||= [];
    this.pick = null; this.sel = null; this.draw = null; this.down = null;
    this.base = [
      { id: 'L1', pts: [[110, 40], [770, 40]] },
      { id: 'N', pts: [[110, 420], [770, 420]] },
      { id: 'PE', pts: [[30, 470], [480, 470]] },
    ];
    this.build();
  }
  changed() { this.render(); this.opts.onChange && this.opts.onChange(); }
  build() {
    const h = this.host; h.innerHTML = ''; h.classList.add('editor');
    const bar = document.createElement('div'); bar.className = 'toolbar';
    bar.innerHTML = `
      <div class="tool-group" role="group" aria-label="Sélection">
        <button type="button" class="tbtn" data-act="rot">Pivoter ⟳</button>
        <button type="button" class="tbtn" data-act="del">Supprimer</button>
        <button type="button" class="tbtn" data-act="stop">Annuler la liaison</button>
      </div>`;
    h.appendChild(bar);
    const pal = document.createElement('div'); pal.className = 'palette sym-palette';
    pal.innerHTML = '<span class="palette-lbl">Symboles :</span>' + Object.entries(SYM_P).map(([k, v]) =>
      `<button type="button" class="symbtn" data-type="${k}" title="${v.nom}"><svg viewBox="${v.box[0] - 3} ${v.box[1] - 3} ${v.box[2] + 6} ${v.box[3] + 6}" style="width:${Math.round((v.box[2] + 6) / (v.box[3] + 6) * 44)}px;height:44px" aria-hidden="true"></svg><span>${v.nom}</span></button>`).join('');
    h.appendChild(pal);
    pal.querySelectorAll('.symbtn').forEach(b => drawPrincipeSymbol(b.querySelector('svg'), b.dataset.type, 0, 0, 0, 1));
    const wrap = document.createElement('div'); wrap.className = 'svg-wrap paper-wrap';
    this.svg = S('svg', { viewBox: '0 0 800 500', class: 'paper-svg principe-svg', role: 'img', 'aria-label': 'Schéma de principe' });
    wrap.appendChild(this.svg); h.appendChild(wrap);
    this.hint = document.createElement('p'); this.hint.className = 'hint'; h.appendChild(this.hint);
    bar.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.act === 'rot') this.pivoter();
      if (b.dataset.act === 'del') this.removeSel();
      if (b.dataset.act === 'stop') { this.draw = null; this.render(); }
    });
    pal.addEventListener('click', e => {
      const b = e.target.closest('[data-type]'); if (!b) return;
      this.pick = this.pick === b.dataset.type ? null : b.dataset.type; this.draw = null; this.render();
    });
    this.svg.addEventListener('pointerdown', e => this.onDown(e));
    this.svg.addEventListener('pointermove', e => this.onMove(e));
    this.svg.addEventListener('pointerup', e => this.onUp(e));
    this.svg.addEventListener('pointercancel', () => { this.down = null; });
    this.svg.addEventListener('pointerleave', () => { if (this.pick && !this.down) { this.ghostAt = null; this.render(); } });
    this.svg.addEventListener('dblclick', () => { if (this.draw && this.draw.pts.length > 1) this.finishWire(); });
    document.addEventListener('keydown', this._key = e => {
      if (!this.host.isConnected) return;
      if (/input|textarea|select/i.test(document.activeElement.tagName)) return;
      if (e.key === 'Escape') { this.draw = null; this.pick = null; this.render(); }
      if ((e.key === 'Delete' || e.key === 'Backspace') && this.sel) { this.removeSel(); e.preventDefault(); }
      if (e.key === 'r' || e.key === 'R') this.pivoter();
    });
    this.render();
  }
  destroy() { document.removeEventListener('keydown', this._key); }
  pivoter() {
    const s = this.sel && this.sel.k === 'sym' && this.st.syms.find(s => s.id === this.sel.id);
    if (s) { this.moveSym(s, s.x, s.y, (s.rot + 90) % 360); this.changed(); }
  }
  termsOf(s) { return SYM_P[s.type].terms.map(([x, y]) => { const [rx, ry] = rotPt(x, y, s.rot); return [s.x + rx, s.y + ry]; }); }
  // sens dans lequel le fil quitte une borne : vertical pour une borne du haut ou du bas
  termDir(s, i) { const [x, y] = SYM_P[s.type].terms[i], [rx, ry] = rotPt(x, y, s.rot); return Math.abs(rx) > Math.abs(ry) ? 'h' : 'v'; }
  snapGrid(p) { const g = 10; return { x: Math.round(p.x / g) * g, y: Math.round(p.y / g) * g }; }
  snap(p) {
    for (const s of this.st.syms) for (const t of this.termsOf(s)) if (Math.hypot(t[0] - p.x, t[1] - p.y) < 9) return { x: t[0], y: t[1], term: true };
    return this.snapGrid(p);
  }
  // point d'une ligne (L1, N, PE ou liaison) le plus proche, sur la grille ; renvoie aussi le sens perpendiculaire
  surLigne(pts, p) {
    let best = null;
    for (let i = 0; i < pts.length - 1; i++) {
      const [a, b] = [pts[i], pts[i + 1]];
      let q, dir;
      if (a[1] === b[1]) { q = [Math.min(Math.max(Math.round(p.x / 10) * 10, Math.min(a[0], b[0])), Math.max(a[0], b[0])), a[1]]; dir = 'v'; }
      else if (a[0] === b[0]) { q = [a[0], Math.min(Math.max(Math.round(p.y / 10) * 10, Math.min(a[1], b[1])), Math.max(a[1], b[1]))]; dir = 'h'; }
      else continue;
      const d = Math.hypot(q[0] - p.x, q[1] - p.y);
      if (!best || d < best.d) best = { d, pt: q, dir };
    }
    return best;
  }
  onLine(p, pts) {
    for (let i = 0; i < pts.length - 1; i++) {
      const [a, b] = [pts[i], pts[i + 1]];
      if (a[0] === b[0] && Math.abs(p[0] - a[0]) < 0.5 && p[1] >= Math.min(a[1], b[1]) - 0.5 && p[1] <= Math.max(a[1], b[1]) + 0.5) return true;
      if (a[1] === b[1] && Math.abs(p[1] - a[1]) < 0.5 && p[0] >= Math.min(a[0], b[0]) - 0.5 && p[0] <= Math.max(a[0], b[0]) + 0.5) return true;
    }
    return false;
  }
  moveSym(s, x, y, rot) {
    const old = this.termsOf(s);
    s.x = x; s.y = y; s.rot = rot;
    const nw = this.termsOf(s);
    for (const w of this.st.wires) {
      for (const end of [0, w.pts.length - 1]) {
        const p = w.pts[end];
        const i = old.findIndex(o => o[0] === p[0] && o[1] === p[1]);
        if (i < 0) continue;
        const nb = w.pts[end === 0 ? 1 : end - 1];
        if (nb) { if (nb[0] === p[0]) nb[0] = nw[i][0]; else if (nb[1] === p[1]) nb[1] = nw[i][1]; }
        w.pts[end] = [nw[i][0], nw[i][1]];
      }
    }
  }
  // tracé à angles droits de a vers b : dirA = sens de départ, dirB = sens d'arrivée (si b est une borne ou une ligne)
  route(a, dirA, b, dirB) {
    if (a[0] === b[0] || a[1] === b[1]) return [b];
    if (dirA === 'v' && dirB === 'v') { const my = Math.round((a[1] + b[1]) / 20) * 10; return [[a[0], my], [b[0], my], b]; }
    if (dirA === 'h' && dirB === 'h') { const mx = Math.round((a[0] + b[0]) / 20) * 10; return [[mx, a[1]], [mx, b[1]], b]; }
    if (dirA === 'v' || dirB === 'h') return [[a[0], b[1]], b];
    return [[b[0], a[1]], b];
  }
  // cible sous le doigt pendant une liaison : borne, ligne de base, liaison, ou point libre
  cible(p, t) {
    const te = t && t.closest && t.closest('[data-term]');
    if (te) { const [sid, i] = te.dataset.term.split(':'), s = this.st.syms.find(x => x.id === sid); if (s) { const q = this.termsOf(s)[+i]; return { pt: [q[0], q[1]], dir: this.termDir(s, +i), fin: true, term: te.dataset.term }; } }
    const q = this.snap(p);
    if (q.term) { for (const s of this.st.syms) this.termsOf(s).forEach((t2, i) => { if (t2[0] === q.x && t2[1] === q.y) q.dir = this.termDir(s, i); }); return { pt: [q.x, q.y], dir: q.dir || 'v', fin: true }; }
    const lineEl = t && t.closest && t.closest('[data-wire], [data-base]');
    if (lineEl) {
      const pts = lineEl.dataset.base ? this.base.find(b => b.id === lineEl.dataset.base).pts : (this.st.wires.find(w => w.id === lineEl.dataset.wire) || {}).pts;
      const r = pts && this.surLigne(pts, p); if (r) return { pt: r.pt, dir: r.dir, fin: true };
    }
    return { pt: [q.x, q.y], dir: null, fin: false };
  }
  render() {
    const svg = this.svg; svg.innerHTML = '';
    svg.dataset.etat = this.pick ? 'placer' : this.draw ? 'fil' : 'libre';
    // grille légère
    const grid = S('g', { class: 'grid' }, svg);
    for (let x = 0; x <= 800; x += 10) S('line', { x1: x, x2: x, y1: 0, y2: 500, class: x % 50 ? 'g1' : 'g2' }, grid);
    for (let y = 0; y <= 500; y += 10) S('line', { y1: y, y2: y, x1: 0, x2: 800, class: y % 50 ? 'g1' : 'g2' }, grid);
    // base imprimée
    const base = S('g', { class: 'base' }, svg);
    T(base, 22, 36, 'L1', { class: 'base-lbl' }); T(base, 22, 416, 'N', { class: 'base-lbl' }); T(base, 6, 466, 'PE', { class: 'base-lbl' });
    S('path', { d: 'M22 40H62', class: 'base-line' }, base);
    S('path', { d: 'M22 420H62', class: 'base-line' }, base);
    for (const y of [40, 420]) {
      S('path', { d: `M62 ${y + 18}L110 ${y}`, class: 'base-line' }, base);
      S('rect', { x: 56, y: y + 14, width: 9, height: 7, transform: `rotate(-22 60 ${y + 18})`, class: 'base-fill' }, base);
    }
    S('path', { d: 'M86 49V429', class: 'base-line dash' }, base);
    for (const b of this.base) { S('path', { d: pathD(b.pts), class: 'base-line' }, base); S('path', { d: pathD(b.pts), class: 'pwire-hit base-hit', 'data-base': b.id }, base); }
    S('circle', { cx: 60, cy: 470, r: 2.6, class: 'base-fill' }, base);
    S('path', { d: 'M60 470V482M46 482H74M51 487H69M56 492H64', class: 'base-line' }, base);
    T(base, 790, 494, 'Schéma de principe', { class: 'base-cart', 'text-anchor': 'end' });
    // liaisons
    const all = [...this.base.map(b => b.pts), ...this.st.wires.map(w => w.pts)];
    for (const w of this.st.wires) {
      const sel = this.sel && this.sel.k === 'wire' && this.sel.id === w.id;
      S('path', { d: pathD(w.pts), class: 'pwire' + (sel ? ' sel' : '') }, svg);
      S('path', { d: pathD(w.pts), class: 'pwire-hit', 'data-wire': w.id }, svg);
    }
    // symboles
    for (const s of this.st.syms) {
      const sel = this.sel && this.sel.k === 'sym' && this.sel.id === s.id;
      const g = S('g', { class: 'sym' + (sel ? ' sel' : ''), 'data-sym': s.id }, svg);
      const bx = SYM_P[s.type].box;
      S('rect', { x: s.x + bx[0] - 4, y: s.y + bx[1] - 4, width: bx[2] + 8, height: bx[3] + 8, class: 'sym-hit', transform: `rotate(${s.rot} ${s.x} ${s.y})` }, g);
      drawPrincipeSymbol(g, s.type, s.x, s.y, s.rot);
      this.termsOf(s).forEach(t => S('circle', { cx: t[0], cy: t[1], r: 2.2, class: 'pterm' }, g));
    }
    // bornes : grandes zones à toucher, au-dessus des symboles
    for (const s of this.st.syms) this.termsOf(s).forEach((t, i) => {
      const k = s.id + ':' + i, dep = this.draw && this.draw.depart === k;
      S('circle', { cx: t[0], cy: t[1], r: 8, class: 'pterm-hit' + (dep ? ' dep' : ''), 'data-term': k }, svg);
    });
    // points de connexion
    const ends = [];
    for (const w of this.st.wires) ends.push(w.pts[0], w.pts[w.pts.length - 1]);
    const termSet = new Set(this.st.syms.flatMap(s => this.termsOf(s).map(t => t.join(','))));
    const seen = new Set();
    for (const p of ends) {
      const key = p.join(','); if (seen.has(key)) continue; seen.add(key);
      const sameEnds = ends.filter(q => q[0] === p[0] && q[1] === p[1]).length;
      const onOther = all.some(pts => {
        const isEnd = (pts[0][0] === p[0] && pts[0][1] === p[1]) || (pts[pts.length - 1][0] === p[0] && pts[pts.length - 1][1] === p[1]);
        return !isEnd && this.onLine(p, pts);
      });
      if (onOther || sameEnds >= 3 || (termSet.has(key) && sameEnds >= 2)) S('circle', { cx: p[0], cy: p[1], r: 3.3, class: 'pjoint' }, svg);
    }
    // tracé en cours
    if (this.draw) {
      S('path', { d: pathD(this.draw.preview || this.draw.pts), class: 'pwire drawing' }, svg);
      S('circle', { cx: this.draw.pts[0][0], cy: this.draw.pts[0][1], r: 4, class: 'pstart' }, svg);
    }
    if (this.pick && this.ghostAt) {
      const g = S('g', { class: 'sym-ghost' }, svg); drawPrincipeSymbol(g, this.pick, this.ghostAt.x, this.ghostAt.y, 0);
    }
    this.host.querySelectorAll('.symbtn').forEach(b => b.classList.toggle('on', b.dataset.type === this.pick));
    this.host.querySelector('[data-act="rot"]').disabled = !(this.sel && this.sel.k === 'sym');
    this.host.querySelector('[data-act="del"]').disabled = !this.sel;
    this.host.querySelector('[data-act="stop"]').hidden = !this.draw;
    this.hint.textContent = this.pick ? `Touchez la feuille pour poser : ${SYM_P[this.pick].nom.toLowerCase()}. Touchez à nouveau le symbole de la palette pour annuler.`
      : this.draw ? 'Touchez la borne d\'arrivée, ou la ligne L1, N, PE ou une autre liaison. Toucher un endroit libre ajoute un coude. Échap ou « Annuler la liaison » pour arrêter.'
      : 'Choisissez un symbole dans la palette puis touchez la feuille pour le poser. Glissez un symbole pour le déplacer. Pour relier : touchez une borne (petit rond) ou la ligne L1, N ou PE, puis la borne d\'arrivée. Touchez un symbole ou une liaison pour le sélectionner (Pivoter, Supprimer).';
  }
  finishWire() {
    if (this.draw && this.draw.pts.length > 1) {
      // nettoyage : points répétés et points alignés
      const p = this.draw.pts.filter((pt, i, a) => i === 0 || pt[0] !== a[i - 1][0] || pt[1] !== a[i - 1][1]);
      const c = [p[0]];
      for (let i = 1; i < p.length - 1; i++) {
        const a = c[c.length - 1], b = p[i], d = p[i + 1];
        if ((a[0] === b[0] && b[0] === d[0]) || (a[1] === b[1] && b[1] === d[1])) continue;
        c.push(b);
      }
      c.push(p[p.length - 1]);
      if (c.length > 1) this.st.wires.push({ id: uid(), pts: c });
    }
    this.draw = null; this.changed();
  }
  removeSel() {
    if (!this.sel) return;
    if (this.sel.k === 'sym') this.st.syms = this.st.syms.filter(s => s.id !== this.sel.id);
    else this.st.wires = this.st.wires.filter(w => w.id !== this.sel.id);
    this.sel = null; this.changed();
  }
  onDown(e) {
    if (e.button > 0) return;
    const p = svgPoint(this.svg, e), t = e.target;
    const symEl = t.closest('[data-sym]'), termEl = t.closest('[data-term]');
    this.down = { cx: e.clientX, cy: e.clientY, sx: e.screenX, sy: e.screenY, wx: this.svg.parentNode.scrollLeft, wy: window.scrollY, touch: e.pointerType !== 'mouse', p, t, moved: false, sym: !termEl && !this.pick && !this.draw && symEl ? this.st.syms.find(s => s.id === symEl.dataset.sym) : null };
    if (this.down.sym) this.down.off = { dx: p.x - this.down.sym.x, dy: p.y - this.down.sym.y };
    try { this.svg.setPointerCapture(e.pointerId); } catch (err) { /* pas grave */ }
    e.preventDefault();
  }
  onMove(e) {
    const p = svgPoint(this.svg, e), d = this.down;
    if (d && !d.moved && Math.hypot(e.clientX - d.cx, e.clientY - d.cy) > 5) {
      d.moved = true;
      // glisser depuis une borne commence une liaison (comme un toucher)
      if (!this.draw && !this.pick && d.t.closest && d.t.closest('[data-term]')) { this.clic(d.p, d.t); d.tire = true; }
    }
    // au doigt, glisser sur une zone libre fait défiler la feuille et la page, comme d'habitude
    if (d && d.moved && d.touch && !d.sym && !d.tire && !this.draw && !this.pick) {
      this.svg.parentNode.scrollLeft = d.wx - (e.screenX - d.sx); window.scrollTo(window.scrollX, d.wy - (e.screenY - d.sy)); return;
    }
    if (d && d.sym && d.moved) {
      const s = d.sym, nx = Math.round((p.x - d.off.dx) / 10) * 10, ny = Math.round((p.y - d.off.dy) / 10) * 10;
      if (this.sel?.id !== s.id) this.sel = { k: 'sym', id: s.id };
      if (nx !== s.x || ny !== s.y) { this.moveSym(s, nx, ny, s.rot); d.drag = true; this.render(); }
      return;
    }
    if (this.draw) {
      const c = this.cible(p, document.elementFromPoint(e.clientX, e.clientY));
      const last = this.draw.pts[this.draw.pts.length - 1];
      this.draw.preview = [...this.draw.pts, ...this.route(last, this.draw.dir, c.pt, c.dir)];
      const pr = this.svg.querySelector('.drawing'); if (pr) pr.setAttribute('d', pathD(this.draw.preview));
      return;
    }
    if (this.pick) { const q = this.snapGrid(p); if (!this.ghostAt || q.x !== this.ghostAt.x || q.y !== this.ghostAt.y) { this.ghostAt = q; this.render(); } }
  }
  onUp(e) {
    const d = this.down; this.down = null;
    if (!d) return;
    if (d.drag) { this.changed(); return; }
    if (d.moved) {
      // liaison tirée en glissant depuis une borne : on la termine là où le doigt se lève
      if (d.tire && this.draw) { const t2 = document.elementFromPoint(e.clientX, e.clientY), c = this.cible(svgPoint(this.svg, e), t2); if (c.fin) this.clic(svgPoint(this.svg, e), t2); }
      return;
    }
    this.clic(d.p, d.t);
  }
  clic(p, t) {
    // 1. poser le symbole choisi dans la palette
    if (this.pick) {
      const q = this.snapGrid(p), s = { id: uid(), type: this.pick, x: q.x, y: q.y, rot: 0 };
      this.st.syms.push(s); this.sel = { k: 'sym', id: s.id }; this.pick = null; this.ghostAt = null;
      return this.changed();
    }
    const c = this.cible(p, t);
    // 2. liaison en cours : une borne ou une ligne la termine, un point libre ajoute un coude
    if (this.draw) {
      if (c.term && c.term === this.draw.depart && this.draw.pts.length === 1) { this.draw = null; return this.render(); }
      const last = this.draw.pts[this.draw.pts.length - 1];
      if (c.pt[0] === last[0] && c.pt[1] === last[1]) return;
      const seg = this.route(last, this.draw.dir, c.pt, c.fin ? c.dir : null);
      this.draw.pts.push(...seg);
      if (c.fin) return this.finishWire();
      const a = this.draw.pts[this.draw.pts.length - 2], b = this.draw.pts[this.draw.pts.length - 1];
      this.draw.dir = a[0] === b[0] ? 'h' : 'v';
      return this.render();
    }
    // 3. une borne ou une ligne L1 / N / PE : on commence une liaison
    if (c.fin && (c.term || (t && t.closest && t.closest('[data-base]')))) {
      this.draw = { pts: [c.pt], dir: c.dir || 'v', depart: c.term }; this.sel = null; return this.render();
    }
    // 4. sinon : sélection
    const symEl = t && t.closest && t.closest('[data-sym]');
    if (symEl) { this.sel = { k: 'sym', id: symEl.dataset.sym }; return this.render(); }
    const wEl = t && t.closest && t.closest('[data-wire]');
    if (wEl) { this.sel = { k: 'wire', id: wEl.dataset.wire }; return this.render(); }
    this.sel = null; this.render();
  }
}

/* =========================================================
   3. UNIFILAIRE « À LA FAÇON TRIKKER »
   ========================================================= */
const SYM_U = {
  lampe: 'Point lumineux', sch1: 'Interr. simple', sch2: 'Interr. bipolaire', sch5: 'Double allumage',
  sch6: 'Va-et-vient', sch7: 'Permutateur', sch62: 'Va-et-vient bipolaire', sch66: 'Va-et-vient double',
  bp: 'Bouton-poussoir', bpv: 'Poussoir à voyant', bp2: 'Double poussoir', tl: 'Télérupteur', min4: 'Minuterie 4 fils', min3: 'Minuterie 3 fils', crep: 'Crépusculaire', horl: 'Horloge', prise: 'Prise 2P+T',
};
function drawUniSymbol(g, type, x, y) {
  // x = début du symbole sur la branche ; renvoie la largeur occupée
  const L = (d, c = 'u-line') => S('path', { d, class: c }, g);
  const flag = (x0, y0, x1, y1) => {
    const dx = x1 - x0, dy = y1 - y0, l = Math.hypot(dx, dy);
    const nx = -dy / l * 5, ny = dx / l * 5;
    return `M${x0} ${y0}L${x1} ${y1}L${x1 + nx} ${y1 + ny}`;
  };
  switch (type) {
    case 'lampe':
      S('circle', { cx: x + 11, cy: y, r: 10, class: 'u-line', fill: 'var(--paper)' }, g);
      L(`M${x + 4} ${y - 7}L${x + 18} ${y + 7}M${x + 18} ${y - 7}L${x + 4} ${y + 7}`); return 26;
    case 'prise':
      // symbole de l'école : trait de terre en travers, arc ouvert avec deux petits pieds (tourné pour suivre la ligne)
      L(`M${x} ${y}H${x + 6}M${x + 6} ${y - 9}V${y + 9}`);
      L(`M${x + 19} ${y - 10}V${y - 7}Q${x + 6} ${y - 7} ${x + 6} ${y}Q${x + 6} ${y + 7} ${x + 19} ${y + 7}V${y + 10}`); return 22;
    default: {
      // symboles unifilaires de l'école (mêmes dessins que le Banc de câblage)
      const d = [], C = [];
      const Ln = (x1, y1, x2, y2) => d.push(`M${x1} ${y1}L${x2} ${y2}`);
      const up = (cx, n) => { Ln(cx + 3, y - 3, cx + 16, y - 16); Ln(cx + 16, y - 16, cx + 22, y - 16); if (n > 1) Ln(cx + 12, y - 12, cx + 18, y - 12); };
      const thr = (cx, n) => { up(cx, n); Ln(cx - 3, y + 3, cx - 16, y + 16); Ln(cx - 16, y + 16, cx - 22, y + 16); if (n > 1) Ln(cx - 12, y + 12, cx - 18, y + 12); };
      let w = 22;
      const boite = (txt) => { S('rect', { x, y: y - 8, width: 26, height: 16, rx: 1, class: 'u-line', fill: 'var(--paper)' }, g); T(g, x + 13, y + 3.5, txt, { class: 'u-small', 'text-anchor': 'middle' }); };
      const bpU = cx => { C.push(cx); d.push(`M${cx} ${y - 4.5}V${y - 12}`); };
      switch (type) {
        case 'bp': bpU(x + 5); w = 14; break;
        case 'bpv': bpU(x + 5); S('circle', { cx: x + 14, cy: y - 10, r: 3.5, class: 'u-line', fill: 'var(--paper)' }, g); Ln(x + 11.5, y - 12.5, x + 16.5, y - 7.5); Ln(x + 11.5, y - 7.5, x + 16.5, y - 12.5); w = 20; break;
        case 'bp2': bpU(x + 5); bpU(x + 17); w = 26; break;
        case 'tl': boite('TL'); return 26;
        case 'min4': case 'min3': boite('Min'); return 26;
        case 'crep': boite('Cr'); return 26;
        case 'horl': boite('Hor'); return 26;
        case 'sch1': up(x + 5, 1); C.push(x + 5); w = 27; break;
        case 'sch2': up(x + 5, 2); C.push(x + 5); w = 27; break;
        case 'sch5': { const c = x + 19; Ln(c - 3, y - 3, c - 14, y - 22); Ln(c - 14, y - 22, c - 19, y - 18); Ln(c + 3, y - 3, c + 14, y - 22); Ln(c + 14, y - 22, c + 19, y - 18); C.push(c); w = 40; break; }
        case 'sch6': thr(x + 22, 1); C.push(x + 22); w = 44; break;
        case 'sch62': thr(x + 22, 2); C.push(x + 22); w = 44; break;
        case 'sch7': { const c = x + 17; Ln(c - 17, y - 17, c + 17, y + 17); Ln(c + 17, y - 17, c - 17, y + 17); Ln(c - 17, y - 17, c - 11, y - 17); Ln(c - 17, y + 17, c - 11, y + 17); Ln(c + 17, y - 17, c + 11, y - 17); Ln(c + 17, y + 17, c + 11, y + 17); C.push(c); w = 36; break; }
        case 'sch66': thr(x + 22, 1); thr(x + 44, 1); C.push(x + 22, x + 44); w = 66; break;
        default: up(x + 5, 1); C.push(x + 5); w = 27;
      }
      if (d.length) L(d.join(''));
      for (const cx of C) S('circle', { cx, cy: y, r: 4.5, class: 'u-line', fill: 'var(--paper)' }, g);
      return w;
    }
  }
}
// largeur occupée sur la branche (avant l'espace de 22 entre deux symboles)
const UNI_W = { lampe: 26, prise: 22, sch1: 27, sch2: 27, sch5: 40, sch6: 44, sch62: 44, sch7: 36, sch66: 66, bp: 14, bpv: 20, bp2: 26, tl: 26, min4: 26, min3: 26, crep: 26, horl: 26 };
const uniLargeur = t => UNI_W[t] || 27;
class UnifilaireEditor {
  constructor(host, state, opts = {}) {
    this.host = host; this.st = state; this.opts = opts;
    this.cible = {}; // point → 'b2' quand on ajoute sur la seconde branche du double allumage
    Object.assign(state, Object.assign({ lettre: 'A', calibre: '10', poles: '2', cable: 'H07V-U', nb: '3', section: '1,5', pose: 'sous tube', points: [] }, state));
    this.build();
  }
  changed() { this.render(); this.opts.onChange && this.opts.onChange(); }
  build() {
    const h = this.host; h.innerHTML = ''; h.classList.add('editor', 'uni');
    h.innerHTML = `
      <div class="uni-grid">
        <div class="uni-form">
          <fieldset><legend>Protection</legend>
            <label>Circuit <select id="u-lettre">${['A', 'B', 'C', 'D', 'E'].map(l => `<option>${l}</option>`).join('')}</select></label>
            <label>Disjoncteur <select id="u-poles"><option value="2">bipolaire</option><option value="1">unipolaire</option><option value="4">tétrapolaire</option></select></label>
            <label>Calibre <select id="u-calibre">${['6', '10', '16', '20', '25', '32'].map(c => `<option value="${c}">${c} A</option>`).join('')}</select></label>
          </fieldset>
          <fieldset><legend>Canalisation</legend>
            <label>Type <select id="u-cable"><option>H07V-U</option><option>XVB</option><option>XGB</option><option>VVB</option></select></label>
            <label>Conducteurs <select id="u-nb">${['2', '3', '4', '5'].map(c => `<option>${c}</option>`).join('')}</select></label>
            <label>Section <select id="u-section"><option value="1,5">1,5 mm²</option><option value="2,5">2,5 mm²</option><option value="4">4 mm²</option><option value="6">6 mm²</option></select></label>
            <label>Pose <select id="u-pose"><option>sous tube</option><option>en goulotte</option><option>encastré</option><option>apparent</option></select></label>
          </fieldset>
          <fieldset class="u-points"><legend>Points raccordés (du bas vers le haut)</legend>
            <ol id="u-list"></ol>
            <button type="button" class="btn small" id="u-add">Ajouter un point</button>
          </fieldset>
        </div>
        <div class="svg-wrap paper-wrap"><svg viewBox="0 0 560 560" class="paper-svg uni-svg" role="img" aria-label="Schéma unifilaire"></svg></div>
      </div>`;
    this.svg = h.querySelector('svg');
    for (const k of ['lettre', 'poles', 'calibre', 'cable', 'nb', 'section', 'pose']) {
      const el = h.querySelector('#u-' + k); el.value = this.st[k];
      el.addEventListener('change', () => { this.st[k] = el.value; this.changed(); });
    }
    h.querySelector('#u-add').addEventListener('click', () => { this.st.points.push({ items: [] }); this.changed(); });
    h.querySelector('#u-list').addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      const i = +b.dataset.i, P = this.st.points;
      if (b.dataset.act === 'cible') { this.cible[i] = b.dataset.c; this.render(); return; }
      const liste = this.cible[i] === 'b2' && P[i].items.includes('sch5') ? (P[i].b2 ||= []) : P[i].items;
      if (b.dataset.act === 'add') liste.push(b.dataset.type);
      if (b.dataset.act === 'pop') { (liste.length ? liste : P[i].items).pop(); if (!P[i].items.includes('sch5') && P[i].b2) { P[i].items.push(...P[i].b2); delete P[i].b2; } }
      if (b.dataset.act === 'up' || b.dataset.act === 'down' || b.dataset.act === 'del') this.cible = {};
      if (b.dataset.act === 'up' && i < P.length - 1) [P[i], P[i + 1]] = [P[i + 1], P[i]];
      if (b.dataset.act === 'down' && i > 0) [P[i], P[i - 1]] = [P[i - 1], P[i]];
      if (b.dataset.act === 'del') P.splice(i, 1);
      this.changed();
    });
    this.render();
  }
  render() {
    const P = this.st.points, list = this.host.querySelector('#u-list');
    list.innerHTML = P.map((pt, i) => `
      <li><div class="u-row"><b>Point ${i + 1}</b>
        <span class="u-items">${pt.items.length ? pt.items.map(t => `<span class="u-tag">${SYM_U[t]}</span>`).join('') : '<span class="muted">vide</span>'}${(pt.b2 || []).length ? `<span class="u-b2">touche 2 : ${pt.b2.map(t => `<span class="u-tag">${SYM_U[t]}</span>`).join('')}</span>` : ''}</span>
        <span class="u-ctl">
          <button type="button" class="ibtn" data-act="up" data-i="${i}" title="Monter" aria-label="Monter le point">↑</button>
          <button type="button" class="ibtn" data-act="down" data-i="${i}" title="Descendre" aria-label="Descendre le point">↓</button>
          <button type="button" class="ibtn" data-act="pop" data-i="${i}" title="Retirer le dernier symbole" aria-label="Retirer le dernier symbole">⌫</button>
          <button type="button" class="ibtn" data-act="del" data-i="${i}" title="Supprimer le point" aria-label="Supprimer le point">✕</button>
        </span></div>
        ${pt.items.includes('sch5') ? `<div class="u-cible" role="group" aria-label="Où ajouter les symboles"><span class="muted small">Ajouter sur :</span>
          <button type="button" class="chip${this.cible[i] !== 'b2' ? ' on' : ''}" data-act="cible" data-c="b1" data-i="${i}">touche 1 · branche du haut</button>
          <button type="button" class="chip${this.cible[i] === 'b2' ? ' on' : ''}" data-act="cible" data-c="b2" data-i="${i}">touche 2 · branche du bas</button></div>` : ''}
        <div class="u-add">${Object.entries(SYM_U).map(([k, v]) => `<button type="button" class="chip" data-act="add" data-type="${k}" data-i="${i}">+ ${v}</button>`).join('')}</div>
      </li>`).join('');
    // dessin
    const svg = this.svg; svg.innerHTML = '';
    const st = this.st, X = 190, busY = 500;
    // double allumage : la touche 2 part en seconde branche, sous la première (place en plus sous le point)
    const B2 = 34, bas = P.map(pt => (pt.b2 || []).length && pt.items.includes('sch5') ? B2 : 0);
    const n = Math.max(P.length, 1), sp = Math.min(70, (380 - bas.reduce((a, b) => a + b, 0)) / n);
    const ys = []; P.forEach((pt, i) => { ys.push((i ? ys[i - 1] - sp : busY - 90) - bas[i]); });
    const topY = Math.min((P.length ? ys[P.length - 1] : busY - 90) - 10, busY - 320);
    S('path', { d: `M60 ${busY}H470`, class: 'u-line' }, svg);
    // disjoncteur
    S('path', { d: `M${X} ${busY}V${busY - 20}L${X - 14} ${busY - 50}`, class: 'u-line' }, svg);
    S('rect', { x: X - 19, y: busY - 56, width: 9, height: 7, transform: `rotate(-28 ${X - 14} ${busY - 52})`, class: 'u-fill' }, svg);
    if (st.poles !== '1') T(svg, X + 6, busY - 36, st.poles === '2' ? '2P' : '4P', { class: 'u-small' });
    T(svg, X + 14, busY - 52, `${st.calibre} A`, { class: 'u-txt' });
    T(svg, X, busY + 22, st.lettre, { class: 'u-txt b', 'text-anchor': 'middle' });
    S('path', { d: `M${X} ${busY - 56}V${topY}`, class: 'u-line' }, svg);
    const cab = `${st.cable} ${st.nb} × ${st.section} mm² ${st.pose}`;
    const cy = (busY - 70 + topY) / 2;
    T(svg, X - 12, cy, cab, { class: 'u-txt', 'text-anchor': 'middle', transform: `rotate(-90 ${X - 12} ${cy})` });
    P.forEach((pt, i) => {
      const y = ys[i];
      T(svg, X + 4, y - 4, String(i + 1), { class: 'u-small' });
      let x = X + 30;
      const g = S('g', {}, svg);
      const widths = [];
      for (const t of pt.items) { widths.push(x); x += uniLargeur(t) + 14 + (t === 'sch5' && bas[i] ? 12 : 0); }
      const endX = pt.items.length ? x - 14 : X + 40;
      S('path', { d: `M${X} ${y}H${pt.items.length ? widths[widths.length - 1] : endX}`, class: 'u-line' }, g);
      pt.items.forEach((t, k) => {
        const x0 = widths[k];
        if (k > 0) S('path', { d: `M${widths[k - 1]} ${y}H${x0}`, class: 'u-line' }, g);
        drawUniSymbol(g, t, x0, y);
      });
      // seconde branche du double allumage : elle part juste après l'interrupteur et descend
      const k5 = pt.items.indexOf('sch5');
      if (bas[i] && k5 >= 0) {
        const xn = widths[k5] + uniLargeur('sch5') + 7, y2 = y + B2;
        if (k5 === pt.items.length - 1) S('path', { d: `M${widths[k5]} ${y}H${xn}`, class: 'u-line' }, g);
        let x2 = xn + 19; const w2 = []; // même alignement que la touche 1
        for (const t of pt.b2) { w2.push(x2); x2 += uniLargeur(t) + 14; }
        S('path', { d: `M${xn} ${y}V${y2}H${w2[w2.length - 1]}`, class: 'u-line' }, g);
        pt.b2.forEach((t, k) => drawUniSymbol(g, t, w2[k], y2));
      }
    });
    // terre
    const ex = 470;
    S('path', { d: `M${ex} ${busY}V${busY + 6}`, class: 'u-line' }, svg);
    S('rect', { x: ex - 4, y: busY + 6, width: 8, height: 18, rx: 4, class: 'u-line', fill: 'var(--paper)' }, svg);
    S('path', { d: `M${ex} ${busY + 24}V${busY + 36}M${ex - 14} ${busY + 36}H${ex + 14}M${ex - 9} ${busY + 41}H${ex + 9}M${ex - 4} ${busY + 46}H${ex + 4}`, class: 'u-line' }, svg);
    T(svg, 550, 18, 'Schéma unifilaire', { class: 'base-cart', 'text-anchor': 'end' });
  }
}
