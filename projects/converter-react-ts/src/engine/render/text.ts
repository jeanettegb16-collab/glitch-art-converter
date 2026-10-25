import type { TextLayer, TextAnim } from '../types';
import { MONO, SCRAMBLE } from '../constants';
import { h01, clamp01, ease } from '../utils/rng';
import { hexToRgb } from '../utils/color';
import { mkCv } from '../utils/canvas';
import { VIEW_K } from './glyph';

// ═════════════════════════════════════════════════════════════════════
// TEXT ANIMATION — a cycle: [delay] → IN → HOLD → OUT → GAP → (repeat)
// ═════════════════════════════════════════════════════════════════════

interface TimelineState {
  p: number;       // reveal amount 0..1
  fo: number;      // whole-text fade-out multiplier
  phase: string;   // 'wait'|'in'|'hold'|'out'|'gap'
}

export function textTimeline(a: TextAnim, t: number): TimelineState {
  if (a.kind === 'none') return { p: 1, fo: 1, phase: 'hold' };
  const tt = t - (a.delay || 0);
  if (tt < 0) return { p: 0, fo: 1, phase: 'wait' };

  const inD = Math.max(1, a.dur);
  if (!a.loop) {
    const x = Math.min(1, tt / inD);
    return { p: ease(a.ease, x), fo: 1, phase: x < 1 ? 'in' : 'hold' };
  }

  const hold = Math.max(0, a.hold), gap = Math.max(0, a.gap);
  const outD = a.outKind === 'cut' ? 0 : Math.max(1, a.outDur);
  const len = inD + hold + outD + gap;
  const cyc = Math.floor(tt / len);
  let x = tt - cyc * len;

  if (a.loops > 0 && cyc >= a.loops - 1) {
    x = tt - (a.loops - 1) * len;
    return x < inD ? { p: ease(a.ease, x / inD), fo: 1, phase: 'in' } : { p: 1, fo: 1, phase: 'hold' };
  }

  if (x < inD) return { p: ease(a.ease, x / inD), fo: 1, phase: 'in' };
  x -= inD;
  if (x < hold) return { p: 1, fo: 1, phase: 'hold' };
  x -= hold;
  if (outD > 0 && x < outD) {
    const q = x / outD;
    return a.outKind === 'fade' ? { p: 1, fo: 1 - q, phase: 'out' } : { p: 1 - ease(a.ease, q), fo: 1, phase: 'out' };
  }
  return { p: 0, fo: 1, phase: 'gap' };
}

let _txtScratch: HTMLCanvasElement | null = null;

interface Cell {
  ch: string;
  x: number;
  y: number;
  u: number;   // unit index (-1 = space)
  i: number;   // flat index
}

/** Render a text layer with its animation onto outCtx. */
export function renderTextLayer(
  L: TextLayer,
  W: number, H: number, t: number,
  outCtx: CanvasRenderingContext2D,
): void {
  const A = L.anim;
  const tl = textTimeline(A, t);
  const SZ = L.size * VIEW_K;

  if (!_txtScratch) _txtScratch = mkCv(W, H);
  const g = _txtScratch;
  if (g.width !== W || g.height !== H) { g.width = W; g.height = H; }
  const gc = g.getContext('2d')!;
  gc.setTransform(1, 0, 0, 1, 0, 0);
  gc.globalAlpha = 1;
  gc.clearRect(0, 0, W, H);
  gc.font = `${SZ}px ${MONO}`;
  gc.textBaseline = 'middle';
  gc.textAlign = 'left';

  const track = (L.track || 0) * VIEW_K;
  const cw = gc.measureText('M').width + track;
  const lh = SZ * 1.05;
  const lines = L.content.split('\n');
  const totalH = lines.length * lh;
  const cx = L.x * W, cy = L.y * H, y0 = cy - totalH / 2 + lh / 2;

  // Layout from full text (no jumping while typing)
  const cells: Cell[] = [];
  let nU = 0, bx0 = 1e9, bx1 = -1e9;
  lines.forEach((line, li) => {
    const lw = line.length * cw;
    const xs = L.align === 'left' ? cx : L.align === 'right' ? cx - lw : cx - lw / 2;
    bx0 = Math.min(bx0, xs);
    bx1 = Math.max(bx1, xs + lw);
    let prevSpace = true;
    for (let j = 0; j < line.length; j++) {
      const ch = line[j];
      const sp = ch === ' ';
      let u = -1;
      if (!sp) {
        if (A.unit === 'line') u = li;
        else if (A.unit === 'word') { if (prevSpace) nU++; u = nU - 1; }
        else { u = nU; nU++; }
      }
      prevSpace = sp;
      cells.push({ ch, x: xs + j * cw, y: y0 + li * lh, u, i: cells.length });
    }
    if (A.unit === 'line') nU = li + 1;
  });

  // Per-unit reveal order → rank 0..1
  const n = Math.max(1, nU);
  const rank = new Float32Array(n);
  const rnd = [...Array(n).keys()].map(i => [h01(i, A.seed), i]).sort((a, b) => a[0] - b[0]);
  const rr = new Float32Array(n);
  rnd.forEach(([, i], k) => { rr[i] = n > 1 ? k / (n - 1) : 0; });
  for (let i = 0; i < n; i++) {
    const f = n > 1 ? i / (n - 1) : 0;
    const d = n > 1 ? Math.abs(i - (n - 1) / 2) / ((n - 1) / 2) : 0;
    rank[i] = A.order === 'reverse' ? 1 - f : A.order === 'center' ? d : A.order === 'edges' ? 1 - d : A.order === 'random' ? rr[i] : f;
  }

  const soft = A.kind === 'typewriter' ? 0.0001 : n > 1 ? Math.max(0.0001, A.soft) : 1;
  const U = new Float32Array(n);
  for (let i = 0; i < n; i++) U[i] = clamp01((tl.p - rank[i] * (1 - soft)) / soft);

  const col = L.color;
  const [r, gg, b] = hexToRgb(col);
  const eo = (u: number) => 1 - Math.pow(1 - u, 3);
  const tick = Math.floor(t / 55);

  let clip: { x: number; y: number; w: number; h: number } | null = null;
  if (A.kind === 'scanreveal') clip = { x: bx0 - 8, y: cy - totalH / 2, w: bx1 - bx0 + 16, h: totalH * tl.p + 1 };
  if (A.kind === 'wipe') clip = { x: bx0 - 8, y: cy - totalH / 2 - 4, w: (bx1 - bx0 + 16) * tl.p, h: totalH + 8 };

  gc.save();
  if (clip) { gc.beginPath(); gc.rect(clip.x, clip.y, clip.w, clip.h); gc.clip(); }

  const put = (c: Cell, dx: number, dy: number, alpha: number, sc: number, fill: string, glyph: string) => {
    if (alpha <= 0.003) return;
    gc.globalAlpha = Math.min(1, alpha);
    gc.fillStyle = fill;
    if (sc !== 1) {
      gc.save();
      gc.translate(c.x + cw / 2 + dx, c.y + dy);
      gc.scale(sc, sc);
      gc.fillText(glyph, -cw / 2, 0);
      gc.restore();
    } else {
      gc.fillText(glyph, c.x + dx, c.y + dy);
    }
  };

  for (const c of cells) {
    if (c.u < 0) continue;
    const u = U[c.u];
    const full = A.kind === 'none' ? 1 : u;
    if (full <= 0 && A.kind !== 'none') continue;
    const e = eo(u);

    switch (A.kind) {
      case 'none':
      case 'scanreveal':
      case 'wipe':
        put(c, 0, 0, 1, 1, col, c.ch);
        break;
      case 'fade':
        put(c, 0, 0, u, 1, col, c.ch);
        break;
      case 'typewriter':
        put(c, 0, 0, 1, 1, col, c.ch);
        break;
      case 'slide':
        put(c, 0, (1 - e) * SZ * .8, e, 1, col, c.ch);
        break;
      case 'zoom':
        put(c, 0, 0, e, 1 + (1 - e) * 1.6, col, c.ch);
        break;
      case 'scatter': {
        const R = SZ * 1.2 * (1 - e);
        put(c, (h01(c.i, A.seed + 1) - .5) * 2 * R, (h01(c.i, A.seed + 2) - .5) * 2 * R, e, 1, col, c.ch);
        break;
      }
      case 'flicker': {
        const on = u >= 1 || h01(c.i, tick + A.seed) < u;
        put(c, 0, 0, on ? (u >= 1 ? 1 : .5 + .5 * h01(c.i, tick)) : .08, 1, col, c.ch);
        break;
      }
      case 'decode': {
        if (u >= 1) { put(c, 0, 0, 1, 1, col, c.ch); break; }
        const gl = SCRAMBLE[Math.floor(h01(c.i, tick + A.seed) * SCRAMBLE.length)];
        put(c, 0, 0, .55 + .45 * u, 1, col, gl);
        break;
      }
      case 'glitchin': {
        if (u >= 1) { put(c, 0, 0, 1, 1, col, c.ch); break; }
        const k = 1 - u, jx = (h01(c.i, tick) - .5) * SZ * .5 * k;
        const bad = h01(c.i, tick + 99) < k * .5;
        const gl = bad ? SCRAMBLE[Math.floor(h01(c.i, tick + 7) * SCRAMBLE.length)] : c.ch;
        const sp = k * SZ * .16;
        put(c, jx - sp, 0, .55, 1, `rgb(${r},${Math.max(0, gg - 110)},${Math.max(0, b - 110)})`, gl);
        put(c, jx + sp, 0, .55, 1, `rgb(${Math.max(0, r - 110)},${Math.max(0, gg - 60)},${b})`, gl);
        put(c, jx, 0, Math.min(1, u * 2.2), 1, col, gl);
        break;
      }
      default:
        put(c, 0, 0, 1, 1, col, c.ch);
    }
  }
  gc.restore();

  // Scan / wipe bar
  gc.globalAlpha = 1; gc.fillStyle = col;
  if (clip && tl.p > 0 && tl.p < 1) {
    if (A.kind === 'scanreveal') gc.fillRect(clip.x, clip.y + clip.h, clip.w, Math.max(2, SZ * .06));
    else gc.fillRect(clip.x + clip.w, clip.y, Math.max(2, SZ * .06), clip.h);
  }

  // Cursor (Typed.js style)
  if (A.cursor !== 'off' && (A.kind === 'typewriter' || A.kind === 'decode') && cells.length) {
    const vis = tl.phase === 'in' || tl.phase === 'out' || Math.floor(t / 530) % 2 === 0;
    if (vis) {
      let last = -1;
      cells.forEach((c, i) => { if (c.u >= 0 && U[c.u] > 0) last = i; });
      const c0 = last < 0 ? cells[0] : cells[last];
      const px = last < 0 ? c0.x : c0.x + cw, py = c0.y;
      gc.globalAlpha = .9;
      if (A.cursor === 'block') gc.fillRect(px, py - lh * .45, cw * .8, lh * .9);
      else if (A.cursor === 'bar') gc.fillRect(px, py - lh * .45, Math.max(2, cw * .14), lh * .9);
      else gc.fillRect(px, py + lh * .34, cw * .9, Math.max(2, lh * .08));
    }
  }

  // Composite: glow halo + hot core, with whole-text fade-out
  const glow = L.glow == null ? 10 : L.glow;
  outCtx.save();
  outCtx.globalAlpha = tl.fo;
  if (glow > 0) {
    outCtx.globalCompositeOperation = 'lighter';
    [[glow * 1.1, .55], [glow * .3, .8]].forEach(([rad, al]) => {
      outCtx.filter = `blur(${rad.toFixed(1)}px)`;
      outCtx.globalAlpha = tl.fo * al;
      outCtx.drawImage(g, 0, 0);
    });
    outCtx.filter = 'none';
    outCtx.globalCompositeOperation = 'source-over';
    outCtx.globalAlpha = tl.fo;
  }
  outCtx.drawImage(g, 0, 0);
  outCtx.restore();
}
