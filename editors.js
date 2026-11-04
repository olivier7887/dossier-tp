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

function drawMechanism(g, type, cx, cy, view) {
  const A = APPAREILS[type];
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
    if (type === 'prise') {
      S('circle', { cx, cy: cy + 2, r: 10, class: 'meca-socket' }, f);
      S('circle', { cx: cx - 4.5, cy: cy + 2, r: 1.6, class: 'meca-pin' }, f);
      S('circle', { cx: cx + 4.5, cy: cy + 2, r: 1.6, class: 'meca-pin' }, f);
      S('rect', { x: cx - 1, y: cy - 8.5, width: 2, height: 4, class: 'meca-pin' }, f);
    } else {
      S('rect', { x: cx - 24, y: cy - 6, width: 48, height: 16, rx: 2.5, class: 'meca-win' }, f);
      S('rect', { x: cx - 21, y: cy - 3.5, width: 7, height: 11, rx: 2.5, class: 'meca-key' }, f);
      S('rect', { x: cx + 14, y: cy - 3.5, width: 7, height: 11, rx: 2.5, class: 'meca-key' }, f);
      drawPrincipeSymbol(f, type, cx, cy + 2, 0, SYM_P[type] && SYM_P[type].large ? 0.14 : 0.18);
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
    drawPrincipeSymbol(f, type === 'prise' ? 'prise' : type, cx, cy + 1, 0, 0.5);
    T(f, cx + 27, cy + 25, A.court, { class: 'symdev-lbl', 'text-anchor': 'end' });
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
  // tubes
  for (const [id, t] of Object.entries(P.tubes)) {
    if (id === 'ALIM' && opts.noAlim) continue;
    const c = roundPolyline(t.pts, t.r);
    const g = S('g', { class: 'tube' }, svg);
    S('path', { d: pathD(c), class: 'tube-body', 'stroke-width': t.d }, g);
    S('path', { d: pathD(offsetPolyline(c, t.d / 2)), class: 'tube-edge' }, g);
    S('path', { d: pathD(offsetPolyline(c, -t.d / 2)), class: 'tube-edge' }, g);
  }
  // éléments
  for (const el of P.elements) {
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

  /* --- positions --- */
  endpointPos(ep) {
    const P = PLANCHE;
    if (ep.k === 'dev') {
      const pos = P.positions.find(p => p.id === ep.pos);
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
    if (ep.k === 'dev') return PLANCHE.positions.find(p => p.id === ep.pos).el;
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
    drawBoardBase(svg);
    // fils d'alimentation (fixes)
    const tA = P.tubes.ALIM;
    for (const f of ALIM_FILS) {
      const pts = [[tA.pts[0][0], tA.pts[0][1] + f.dy], [P.box.x + 6, P.box.y + P.box.h / 2 + f.dy]];
      this.drawWire(svg, pts, f.color, null);
    }
    T(svg, 18, tA.pts[0][1] - 14, 'Alimentation L · N · PE', { class: 'board-lbl' });
    // emplacements libres + appareils
    for (const pos of P.positions) {
      const type = st.placed[pos.id];
      const g = S('g', { class: 'pos', 'data-pos': pos.id }, svg);
      if (type) drawMechanism(g, type, pos.cx, pos.cy, st.view);
      else S('rect', { x: pos.cx - 33, y: pos.cy - 33, width: 66, height: 66, rx: 4, class: 'slot' + (this.mode === 'placer' && this.pick && this.pick !== 'douille' ? ' slot-on' : '') }, g);
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
    for (const pos of P.positions) {
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
    const types = ['sch1', 'sch2', 'sch5', 'sch6', 'sch7', 'sch62', 'sch66', 'prise', 'douille'];
    this.palette.hidden = this.mode !== 'placer';
    this.palette.innerHTML = '<span class="palette-lbl">Appareil :</span>' + types.map(t =>
      `<button type="button" class="chip${this.pick === t ? ' on' : ''}" data-type="${t}">${t === 'douille' ? 'Douille E27' : APPAREILS[t].court + ' · ' + APPAREILS[t].nom.replace('Interrupteur ', '')}</button>`).join('');
    const hints = {
      placer: this.pick ? (this.pick === 'douille' ? 'Cliquez sur une rosace libre pour y poser la douille.' : 'Cliquez sur un emplacement libre (cadre en pointillés) pour y placer l\'appareil.') : 'Choisissez un appareil, puis cliquez sur un emplacement libre.',
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
    const names = { PL1: 'tube PL1', PL2: 'tube PL2', PL3: 'tube PL3', B1: 'tube boîtier gauche', B2: 'tube boîtier central', B3: 'tube boîtier droit' };
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
      else if (this.pick !== 'douille' && posG && !st.placed[posG.dataset.pos]) { st.placed[posG.dataset.pos] = this.pick; this.changed(); }
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
  drawBoardBase(svg, {});
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
const SYM_P = {
  sch1: { terms: [[0, -30], [0, 30]], nom: 'Interrupteur simple' },
  sch2: { terms: [[-15, -30], [-15, 30], [15, -30], [15, 30]], nom: 'Interrupteur bipolaire' },
  sch5: { terms: [[-15, -30], [15, -30], [0, 30]], nom: 'Interrupteur série' },
  sch6: { terms: [[-12, -30], [12, -30], [0, 30]], nom: 'Va-et-vient' },
  sch7: { terms: [[-12, -30], [12, -30], [-12, 30], [12, 30]], nom: 'Permutateur' },
  // bornes dans l'ordre : L1, 1, 1', L2, 2, 2'
  sch62: { terms: [[-16, 30], [-26, -30], [-6, -30], [16, 30], [6, -30], [26, -30]], nom: 'Va-et-vient bipolaire', large: true },
  sch66: { terms: [[-16, 30], [-26, -30], [-6, -30], [16, 30], [6, -30], [26, -30]], nom: 'Va-et-vient double', large: true },
  lampe: { terms: [[0, -30], [0, 30]], nom: 'Lampe' },
  prise: { terms: [[-10, -30], [10, -30], [0, 30]], nom: 'Prise 2P+T' },
};
function rotPt(x, y, rot) {
  switch ((rot % 360 + 360) % 360) {
    case 90: return [-y, x];
    case 180: return [-x, -y];
    case 270: return [y, -x];
    default: return [x, y];
  }
}
function drawPrincipeSymbol(parent, type, cx, cy, rot = 0, sc = 1) {
  const g = S('g', { transform: `translate(${cx} ${cy}) rotate(${rot}) scale(${sc})`, class: 'psym' }, parent);
  const L = (d, extra = {}) => S('path', Object.assign({ d, class: 'sym-line' }, extra), g);
  const blade = (x, yb, yt, dir = -1) => `M${x} ${yb}L${x + dir * 12} ${yt + 2}`;
  switch (type) {
    case 'sch1':
      L('M0 -30V-12M0 30V12'); L(blade(0, 12, -12)); L('M-6 0H-14', { class: 'sym-line thin' }); break;
    case 'sch2':
      L('M-15 -30V-12M-15 30V12M15 -30V-12M15 30V12'); L(blade(-15, 12, -12)); L(blade(15, 12, -12));
      L('M-21 0H9', { class: 'sym-line dash' }); break;
    case 'sch5':
      L('M0 30V18M-15 18H15M-15 18V12M15 18V12M-15 -30V-12M15 -30V-12');
      L(blade(-15, 12, -12)); L(blade(15, 12, -12)); break;
    case 'sch6':
      L('M0 30V12M-12 -30V-12M12 -30V-12'); L('M0 12L-11 -11'); S('circle', { cx: 0, cy: 12, r: 1.8, class: 'sym-dot' }, g); break;
    case 'sch62': case 'sch66':
      for (const x of [-16, 16]) { L(`M${x} 30V12M${x - 10} -30V-12M${x + 10} -30V-12`); L(`M${x} 12L${x - 9} -11`); S('circle', { cx: x, cy: 12, r: 1.8, class: 'sym-dot' }, g); }
      if (type === 'sch62') L('M-20 0H12', { class: 'sym-line dash' });
      break;
    case 'sch7':
      L('M-12 -30V-12M12 -30V-12M-12 30V12M12 30V12M-12 12V-12M12 12V-12');
      L('M-12 12L12 -12M12 12L-12 -12', { class: 'sym-line dash' }); break;
    case 'lampe':
      L('M0 -30V-12M0 30V12'); S('circle', { cx: 0, cy: 0, r: 12, class: 'sym-line', fill: 'var(--paper)' }, g);
      L('M-8.5 -8.5L8.5 8.5M8.5 -8.5L-8.5 8.5'); break;
    case 'prise':
      L('M-10 -30V-4M10 -30V-4'); L('M-16 -4A16 16 0 0 0 16 -4'); L('M0 12V30'); L('M-6 30H6', { class: 'sym-line thin' }); break;
  }
  return g;
}

class PrincipeEditor {
  constructor(host, state, opts = {}) {
    this.host = host; this.st = state; this.opts = opts;
    state.syms ||= []; state.wires ||= [];
    this.mode = 'select'; this.pick = null; this.sel = null; this.draw = null; this.drag = null;
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
      <div class="tool-group" role="group" aria-label="Outil">
        <button type="button" class="tbtn" data-mode="select">Sélectionner / déplacer</button>
        <button type="button" class="tbtn" data-mode="fil">Tracer une liaison</button>
        <button type="button" class="tbtn" data-mode="gomme">Effacer</button>
      </div>
      <div class="tool-group" role="group" aria-label="Symbole sélectionné">
        <button type="button" class="tbtn" data-act="rot">Pivoter ⟳</button>
      </div>`;
    h.appendChild(bar);
    const pal = document.createElement('div'); pal.className = 'palette sym-palette';
    pal.innerHTML = '<span class="palette-lbl">Symboles :</span>' + Object.entries(SYM_P).map(([k, v]) =>
      `<button type="button" class="symbtn" data-type="${k}" title="${v.nom}"><svg viewBox="-24 -34 48 68" aria-hidden="true"></svg><span>${v.nom}</span></button>`).join('');
    h.appendChild(pal);
    pal.querySelectorAll('.symbtn').forEach(b => drawPrincipeSymbol(b.querySelector('svg'), b.dataset.type, 0, 0, 0, SYM_P[b.dataset.type].large ? 0.62 : 0.9));
    const wrap = document.createElement('div'); wrap.className = 'svg-wrap paper-wrap';
    this.svg = S('svg', { viewBox: '0 0 800 500', class: 'paper-svg', role: 'img', 'aria-label': 'Schéma de principe' });
    wrap.appendChild(this.svg); h.appendChild(wrap);
    this.hint = document.createElement('p'); this.hint.className = 'hint'; h.appendChild(this.hint);
    bar.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.mode) { this.mode = b.dataset.mode; this.pick = null; this.draw = null; }
      if (b.dataset.act === 'rot' && this.sel && this.sel.k === 'sym') {
        const s = this.st.syms.find(s => s.id === this.sel.id); if (s) { this.moveSym(s, s.x, s.y, (s.rot + 90) % 360); this.changed(); return; }
      }
      this.render();
    });
    pal.addEventListener('click', e => {
      const b = e.target.closest('[data-type]'); if (!b) return;
      this.pick = b.dataset.type; this.mode = 'placer'; this.render();
    });
    this.svg.addEventListener('pointerdown', e => this.onDown(e));
    this.svg.addEventListener('pointermove', e => this.onMove(e));
    this.svg.addEventListener('pointerup', e => this.onUp(e));
    this.svg.addEventListener('dblclick', () => { if (this.draw) this.finishWire(); });
    document.addEventListener('keydown', this._key = e => {
      if (!this.host.isConnected) return;
      if (e.key === 'Escape') { this.draw = null; this.pick = null; if (this.mode === 'placer') this.mode = 'select'; this.render(); }
      if ((e.key === 'Delete' || e.key === 'Backspace') && this.sel && !/input|textarea|select/i.test(document.activeElement.tagName)) { this.removeSel(); e.preventDefault(); }
      if ((e.key === 'r' || e.key === 'R') && this.sel && this.sel.k === 'sym' && !/input|textarea/i.test(document.activeElement.tagName)) {
        const s = this.st.syms.find(s => s.id === this.sel.id); if (s) { this.moveSym(s, s.x, s.y, (s.rot + 90) % 360); this.changed(); }
      }
    });
    this.render();
  }
  destroy() { document.removeEventListener('keydown', this._key); }
  termsOf(s) { return SYM_P[s.type].terms.map(([x, y]) => { const [rx, ry] = rotPt(x, y, s.rot); return [s.x + rx, s.y + ry]; }); }
  snap(p) {
    // borne proche ?
    for (const s of this.st.syms) for (const t of this.termsOf(s)) if (Math.hypot(t[0] - p.x, t[1] - p.y) < 9) return { x: t[0], y: t[1], term: true };
    const g = 10;
    return { x: Math.round(p.x / g) * g, y: Math.round(p.y / g) * g };
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
  render() {
    const svg = this.svg; svg.innerHTML = '';
    svg.dataset.mode = this.mode;
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
    for (const b of this.base) S('path', { d: pathD(b.pts), class: 'base-line' }, base);
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
      const lg = SYM_P[s.type] && SYM_P[s.type].large ? 6 : 0;
      S('rect', { x: s.x - 26 - lg, y: s.y - 34, width: 52 + 2 * lg, height: 68, class: 'sym-hit', transform: `rotate(${s.rot} ${s.x} ${s.y})` }, g);
      drawPrincipeSymbol(g, s.type, s.x, s.y, s.rot);
      for (const t of this.termsOf(s)) S('circle', { cx: t[0], cy: t[1], r: 2.2, class: 'pterm' }, g);
    }
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
      S('path', { d: pathD([...this.draw.pts, this.draw.cur]), class: 'pwire drawing' }, svg);
    }
    if (this.mode === 'placer' && this.pick && this.ghostAt) {
      const g = S('g', { class: 'sym-ghost' }, svg); drawPrincipeSymbol(g, this.pick, this.ghostAt.x, this.ghostAt.y, 0);
    }
    this.host.querySelectorAll('[data-mode]').forEach(b => b.classList.toggle('on', b.dataset.mode === this.mode));
    this.host.querySelectorAll('.symbtn').forEach(b => b.classList.toggle('on', this.mode === 'placer' && b.dataset.type === this.pick));
    this.host.querySelector('[data-act="rot"]').disabled = !(this.sel && this.sel.k === 'sym');
    const hints = {
      select: 'Cliquez sur un symbole pour le sélectionner, glissez pour le déplacer. Touche R : pivoter. Suppr : effacer.',
      placer: 'Cliquez sur la feuille pour poser le symbole. Échap pour arrêter.',
      fil: this.draw ? 'Cliquez pour ajouter un coude. La liaison se termine sur une borne ou sur une autre ligne (double-clic pour terminer ailleurs).' : 'Cliquez sur une borne (petit rond) ou sur une ligne L1, N ou PE pour commencer.',
      gomme: 'Cliquez sur une liaison ou un symbole pour l\'effacer.',
    };
    this.hint.textContent = hints[this.mode];
  }
  orthoAdd(pts, q) {
    const last = pts[pts.length - 1];
    if (last[0] !== q[0] && last[1] !== q[1]) pts.push([q[0], last[1]]);
    pts.push([q[0], q[1]]);
  }
  finishWire() {
    if (this.draw && this.draw.pts.length > 1) {
      // nettoyage : points alignés
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
    const p = svgPoint(this.svg, e), t = e.target;
    if (this.mode === 'placer' && this.pick) {
      const q = this.snap(p);
      const s = { id: uid(), type: this.pick, x: q.x, y: q.y, rot: 0 };
      this.st.syms.push(s); this.sel = { k: 'sym', id: s.id };
      this.changed(); return;
    }
    if (this.mode === 'gomme') {
      const sg = t.closest('[data-sym]');
      if (sg) { this.st.syms = this.st.syms.filter(s => s.id !== sg.dataset.sym); return this.changed(); }
      if (t.dataset.wire) { this.st.wires = this.st.wires.filter(w => w.id !== t.dataset.wire); return this.changed(); }
      return;
    }
    if (this.mode === 'fil') {
      const q = this.snap(p), pt = [q.x, q.y];
      const all = [...this.base.map(b => b.pts), ...this.st.wires.map(w => w.pts)];
      const onSomething = q.term || all.some(pts => this.onLine(pt, pts));
      if (!this.draw) { this.draw = { pts: [pt], cur: pt }; this.render(); return; }
      this.orthoAdd(this.draw.pts, pt);
      if (onSomething) this.finishWire(); else this.render();
      return;
    }
    // select
    const sg = t.closest('[data-sym]');
    if (sg) {
      const s = this.st.syms.find(s => s.id === sg.dataset.sym);
      this.sel = { k: 'sym', id: s.id };
      this.drag = { s, dx: p.x - s.x, dy: p.y - s.y, moved: false };
      this.svg.setPointerCapture(e.pointerId);
      this.render(); return;
    }
    if (t.dataset.wire) { this.sel = { k: 'wire', id: t.dataset.wire }; this.render(); return; }
    this.sel = null; this.render();
  }
  onMove(e) {
    const p = svgPoint(this.svg, e);
    if (this.drag) {
      const nx = Math.round((p.x - this.drag.dx) / 10) * 10, ny = Math.round((p.y - this.drag.dy) / 10) * 10;
      if (nx !== this.drag.s.x || ny !== this.drag.s.y) { this.moveSym(this.drag.s, nx, ny, this.drag.s.rot); this.drag.moved = true; this.render(); }
      return;
    }
    if (this.draw) {
      const q = this.snap(p), last = this.draw.pts[this.draw.pts.length - 1];
      this.draw.cur = (q.x !== last[0] && q.y !== last[1]) ? [q.x, q.y] : [q.x, q.y];
      const tmp = this.draw.pts.slice(); this.orthoAdd(tmp, [q.x, q.y]);
      this.draw.preview = tmp;
      this.render();
      const pr = this.svg.querySelector('.drawing'); if (pr) pr.setAttribute('d', pathD(tmp));
      return;
    }
    if (this.mode === 'placer' && this.pick) { const q = this.snap(p); this.ghostAt = q; this.render(); }
  }
  onUp() { if (this.drag) { const m = this.drag.moved; this.drag = null; if (m) this.changed(); } }
}

/* =========================================================
   3. UNIFILAIRE « À LA FAÇON TRIKKER »
   ========================================================= */
const SYM_U = {
  lampe: 'Point lumineux', sch1: 'Interr. simple', sch2: 'Interr. bipolaire', sch5: 'Interr. série',
  sch6: 'Va-et-vient', sch7: 'Permutateur', sch62: 'Va-et-vient bipolaire', sch66: 'Va-et-vient double', prise: 'Prise 2P+T',
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
      L(`M${x} ${y}H${x + 6}M${x + 6} ${y - 10}V${y + 10}`);
      L(`M${x + 6} ${y - 10}A10 10 0 0 1 ${x + 6} ${y + 10}`);
      L(`M${x + 2} ${y - 13}H${x + 10}`); return 22;
    default: {
      S('circle', { cx: x + 5, cy: y, r: 4.5, class: 'u-line', fill: 'var(--paper)' }, g);
      const c = [x + 5, y];
      if (type === 'sch6' || type === 'sch7' || type === 'sch62' || type === 'sch66') {
        L(flag(c[0] + 3, c[1] - 3, c[0] + 15, c[1] - 15));
        L(flag(c[0] - 3, c[1] + 3, c[0] - 15, c[1] + 15));
        if (type === 'sch7') L(`M${c[0] - 6} ${c[1] - 10}L${c[0] + 6} ${c[1] + 10}`);
        if (type === 'sch62') L(`M${c[0] + 7} ${c[1] - 11}l4 4M${c[0] - 7} ${c[1] + 11}l-4 -4`);
        if (type === 'sch66') { L(flag(c[0] + 1, c[1] - 4, c[0] + 5, c[1] - 20)); L(flag(c[0] - 1, c[1] + 4, c[0] - 5, c[1] + 20)); }
      } else if (type === 'sch5') {
        L(flag(c[0] + 3, c[1] - 3, c[0] + 15, c[1] - 15));
        L(flag(c[0] + 1, c[1] - 4, c[0] + 5, c[1] - 20));
      } else {
        L(flag(c[0] + 3, c[1] - 3, c[0] + 15, c[1] - 15));
        if (type === 'sch2') L(`M${c[0] + 7} ${c[1] - 11}l4 4`);
      }
      return 20;
    }
  }
}
class UnifilaireEditor {
  constructor(host, state, opts = {}) {
    this.host = host; this.st = state; this.opts = opts;
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
      if (b.dataset.act === 'add') { P[i].items.push(b.dataset.type); }
      if (b.dataset.act === 'pop') { P[i].items.pop(); }
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
        <span class="u-items">${pt.items.length ? pt.items.map(t => `<span class="u-tag">${SYM_U[t]}</span>`).join('') : '<span class="muted">vide</span>'}</span>
        <span class="u-ctl">
          <button type="button" class="ibtn" data-act="up" data-i="${i}" title="Monter" aria-label="Monter le point">↑</button>
          <button type="button" class="ibtn" data-act="down" data-i="${i}" title="Descendre" aria-label="Descendre le point">↓</button>
          <button type="button" class="ibtn" data-act="pop" data-i="${i}" title="Retirer le dernier symbole" aria-label="Retirer le dernier symbole">⌫</button>
          <button type="button" class="ibtn" data-act="del" data-i="${i}" title="Supprimer le point" aria-label="Supprimer le point">✕</button>
        </span></div>
        <div class="u-add">${Object.entries(SYM_U).map(([k, v]) => `<button type="button" class="chip" data-act="add" data-type="${k}" data-i="${i}">+ ${v}</button>`).join('')}</div>
      </li>`).join('');
    // dessin
    const svg = this.svg; svg.innerHTML = '';
    const st = this.st, X = 190, busY = 500;
    const n = Math.max(P.length, 1), sp = Math.min(70, 380 / n);
    const topY = Math.min(busY - 90 - (P.length ? (P.length - 1) * sp : 0) - 10, busY - 320);
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
      const y = busY - 90 - i * sp;
      T(svg, X + 4, y - 4, String(i + 1), { class: 'u-small' });
      let x = X + 30;
      const g = S('g', {}, svg);
      const widths = [];
      for (const t of pt.items) { widths.push(x); x += (t === 'lampe' || t === 'prise' ? 26 : 22) + 22; }
      const endX = pt.items.length ? x - 22 : X + 40;
      S('path', { d: `M${X} ${y}H${pt.items.length ? widths[widths.length - 1] : endX}`, class: 'u-line' }, g);
      pt.items.forEach((t, k) => {
        const x0 = widths[k];
        if (k > 0) S('path', { d: `M${widths[k - 1]} ${y}H${x0}`, class: 'u-line' }, g);
        drawUniSymbol(g, t, x0, y);
      });
    });
    // terre
    const ex = 470;
    S('path', { d: `M${ex} ${busY}V${busY + 6}`, class: 'u-line' }, svg);
    S('rect', { x: ex - 4, y: busY + 6, width: 8, height: 18, rx: 4, class: 'u-line', fill: 'var(--paper)' }, svg);
    S('path', { d: `M${ex} ${busY + 24}V${busY + 36}M${ex - 14} ${busY + 36}H${ex + 14}M${ex - 9} ${busY + 41}H${ex + 9}M${ex - 4} ${busY + 46}H${ex + 4}`, class: 'u-line' }, svg);
    T(svg, 550, 18, 'Schéma unifilaire', { class: 'base-cart', 'text-anchor': 'end' });
  }
}
