import type { Layer, GlitchState } from '../types';
import {
  GBG, MONO, EXPORT_SEED, GLITCH_MAX_CATCHUP,
} from '../constants';
import { mulberry, h01, seedFor } from '../utils/rng';
import { mkCv } from '../utils/canvas';
import { state } from '../state/store';
import { fixLayer } from '../state/defaults';

// ═════════════════════════════════════════════════════════════════════
// GLITCH NOISE PATTERN (shared, created once)
// ═════════════════════════════════════════════════════════════════════
let _noisePattern: CanvasPattern | null = null;

export function glitchNoise(): void {
  const rn = mulberry(EXPORT_SEED);
  const n = mkCv(256, 256), nx = n.getContext('2d')!;
  const nd = nx.createImageData(256, 256);
  const cr = parseInt(state.ui.color.slice(1, 3), 16);
  const cg = parseInt(state.ui.color.slice(3, 5), 16);
  const cb = parseInt(state.ui.color.slice(5, 7), 16);
  for (let i = 0; i < nd.data.length; i += 4) {
    if (rn() < 0.3) {
      const k = rn();
      nd.data[i] = cr + (255 - cr) * k * .5;
      nd.data[i + 1] = cg + (255 - cg) * k * .5;
      nd.data[i + 2] = cb + (255 - cb) * k * .5;
      nd.data[i + 3] = rn() * 255;
    }
  }
  nx.putImageData(nd, 0, 0);
  const tmp = mkCv(2, 2);
  _noisePattern = tmp.getContext('2d')!.createPattern(n, 'repeat');
}

export function getNoisePattern(): CanvasPattern | null { return _noisePattern; }

// ═════════════════════════════════════════════════════════════════════
// ADVANCED PIXEL-STACK GLITCHES (operates on ImageData in-place)
// ═════════════════════════════════════════════════════════════════════

interface PixelGlitchOpts {
  on: string[];
  amt: number;
  seed: number;
  st: boolean;
}

export function pxGlitch(
  c: CanvasRenderingContext2D, w: number, h: number, off: number, cfg: PixelGlitchOpts,
): void {
  const T = cfg.on;
  if (!T.length) return;
  const n = cfg.amt, seedOff = cfg.st ? 0 : off;
  const R = mulberry(cfg.seed + 1 + seedOff);
  const has = (k: string) => T.includes(k);
  const ri = (a: number, b: number) => a + Math.floor(R() * Math.max(1, b - a));
  const id = c.getImageData(0, 0, w, h), d = id.data;
  const snap = () => new Uint8ClampedArray(d);
  const W4 = w * 4;

  if (has('warp')) {
    const s = snap(), k = n / 20, cx = w / 2, cy = h / 2;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const xn = (x - cx) / cx, yn = (y - cy) / cy, f = 1 + (xn * xn + yn * yn) * k;
      const sx = Math.min(w - 1, Math.max(0, (cx + xn * f * cx) | 0));
      const sy = Math.min(h - 1, Math.max(0, (cy + yn * f * cy) | 0));
      const o = (y * w + x) * 4, q = (sy * w + sx) * 4;
      d[o] = s[q]; d[o + 1] = s[q + 1]; d[o + 2] = s[q + 2];
    }
  }
  if (has('chroma')) {
    const s = snap(), sh = Math.max(1, Math.round(n * w / 400));
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const o = (y * w + x) * 4;
      d[o] = s[(y * w + Math.max(0, x - sh)) * 4];
      d[o + 2] = s[(y * w + Math.min(w - 1, x + sh)) * 4 + 2];
    }
  }
  if (has('sort')) {
    const thr = (255 - n * 20) * 3;
    for (let i = 0, c2 = Math.floor(n / 10 * h * .4); i < c2; i++) {
      const y = ri(0, h), o = y * W4;
      let a = -1, e = -1;
      for (let x = 0; x < w; x++) if (d[o + x * 4] + d[o + x * 4 + 1] + d[o + x * 4 + 2] > thr) { if (a < 0) a = x; e = x; }
      if (e - a > 2) {
        const seg: number[][] = [];
        for (let x = a; x < e; x++) seg.push([d[o + x * 4], d[o + x * 4 + 1], d[o + x * 4 + 2], d[o + x * 4 + 3]]);
        seg.sort((p, q) => p[0] + p[1] + p[2] - q[0] - q[1] - q[2]);
        seg.forEach((p, j) => d.set(p, o + (a + j) * 4));
      }
    }
  }
  if (has('jitter')) {
    const m = Math.max(1, n * 3);
    for (let i = 0, c2 = Math.floor(n / 10 * h * .5); i < c2; i++) {
      const y = ri(0, h), o = y * W4, sh = ri(-m, m + 1);
      if (sh > 0) d.copyWithin(o + sh * 4, o, o + W4 - sh * 4);
      else if (sh < 0) d.copyWithin(o, o - sh * 4, o + W4);
    }
  }
  if (has('rowshift')) {
    const s = snap(), maxSh = Math.max(2, Math.round(n * w * 0.015)), bandH = Math.max(1, Math.round(1 + R() * 3));
    for (let y = 0; y < h; y += bandH) {
      const hh = Math.min(bandH, h - y);
      if (R() < 0.3) continue;
      const dir = R() < 0.5 ? -1 : 1, sh = Math.round(dir * maxSh * (0.2 + R() * 0.9));
      if (sh === 0) continue;
      const wrap = (x: number) => (((x - sh) % w + w) % w);
      for (let yy = y; yy < y + hh; yy++) for (let x = 0; x < w; x++) {
        const sx = wrap(x), dst = (yy * w + x) * 4, src = (yy * w + sx) * 4;
        d[dst] = s[src]; d[dst + 1] = s[src + 1]; d[dst + 2] = s[src + 2];
      }
    }
  }
  if (has('mosh')) {
    const s = snap();
    for (let i = 0, c2 = Math.floor(n / 10 * 18); i < c2; i++) {
      const bw = ri(Math.max(2, w * .05 | 0), (w * .3 | 0) + 2), bh = ri(Math.max(2, h * .02 | 0), (h * .12 | 0) + 2);
      if (bw >= w || bh >= h) continue;
      const sx = ri(0, w - bw), sy = ri(0, h - bh), dx = ri(0, w - bw), dy = ri(0, h - bh);
      for (let y = 0; y < bh; y++) d.set(s.subarray(((sy + y) * w + sx) * 4, ((sy + y) * w + sx + bw) * 4), ((dy + y) * w + dx) * 4);
    }
  }
  if (has('stretch')) {
    const s = snap(), lo = Math.max(1, h / 6 | 0);
    for (let i = 0, c2 = Math.floor(n / 10 * w * .12); i < c2; i++) {
      const x = ri(0, w), sy = ri(0, h >> 1), len = ri(lo, Math.max(lo + 1, (h * .7 * n / 10 | 0) + 1)), q = (sy * w + x) * 4;
      for (let y = sy; y < Math.min(h, sy + len); y++) d.set(s.subarray(q, q + 4), (y * w + x) * 4);
    }
  }
  if (has('ghost')) {
    const s = snap(), it = n / 10, sx = ri(-(15 * it | 0), (15 * it | 0) + 1), sy = ri(-(10 * it | 0), (10 * it | 0) + 1), a = it * .4;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const o = (y * w + x) * 4, q = (((y - sy + h) % h) * w + ((x - sx + w) % w)) * 4;
      for (let k = 0; k < 3; k++) d[o + k] = s[o + k] * (1 - a) + s[q + k] * a;
    }
  }
  if (has('vhs')) for (let i = 0, c2 = Math.floor(n / 10 * 20); i < c2; i++) {
    const y = ri(0, h), o = y * W4, sh = ri(-8, 9), m = .7 + R() * .3, row = d.slice(o, o + W4);
    for (let x = 0; x < w; x++) { const sx = Math.min(w - 1, Math.max(0, x - sh)); d[o + x * 4] = row[sx * 4] * m; d[o + x * 4 + 1] *= m; d[o + x * 4 + 2] *= m; }
  }
  if (has('dropout')) for (let i = 0, c2 = Math.floor(n / 10 * 12); i < c2; i++) {
    const y = ri(0, h), len = ri(1, (w / 10 | 0) + 2), x = ri(0, w - len);
    for (let j = 0; j < len; j++) { const o = (y * w + x + j) * 4; d[o] = R() * 255; d[o + 1] = R() * 255; d[o + 2] = R() * 255; }
  }
  if (has('crush')) {
    const bp = n * 4, k = 255 / Math.max(1, 255 - n * 2.5 - bp);
    for (let i = 0; i < d.length; i += 4) { d[i] = (d[i] - bp) * k; d[i + 1] = (d[i + 1] - bp) * k; d[i + 2] = (d[i + 2] - bp) * k; }
  }
  c.putImageData(id, 0, 0);
}

// ═════════════════════════════════════════════════════════════════════
// GEOMETRIC GLITCH EFFECTS (operate on canvas draw operations)
// ═════════════════════════════════════════════════════════════════════

interface GeomFx {
  slice: number;
  rowshift: number;
  block: number;
  smear: number;
}

export function applyGeomEffects(
  v: CanvasRenderingContext2D, srcCanvas: HTMLCanvasElement,
  W: number, H: number, s: number, e: number, inB: boolean,
  R: () => number, fx: Partial<GeomFx>,
): void {
  if (fx.slice) {
    const n = inB ? 2 + Math.floor(e * 14 * R()) : (R() < e * .6 ? 1 : 0);
    for (let i = 0; i < n; i++) {
      const sy = Math.floor(R() * H), sh = Math.max(1, Math.min(H - sy, Math.floor((1 + R() * R() * 70) * s)));
      const sg = R() < .5 ? -1 : 1, shift = sg * (4 * s + R() * R() * e * W * .2);
      const tmp = mkCv(W, sh);
      tmp.getContext('2d')!.drawImage(srcCanvas, 0, sy, W, sh, 0, 0, W, sh);
      v.clearRect(0, sy, W, sh);
      v.drawImage(tmp, shift, sy);
      v.drawImage(tmp, shift - sg * W, sy);
    }
  }
  if (fx.rowshift) {
    const maxAmt = s * (3 + e * 60), bandH = Math.max(1, Math.round(s * (1 + R() * 2)));
    const tmp = mkCv(W, H);
    tmp.getContext('2d')!.drawImage(srcCanvas, 0, 0);
    for (let y = 0; y < H; y += bandH) {
      const h = Math.min(bandH, H - y);
      if (R() < .35) continue;
      const dir = R() < .5 ? -1 : 1, amt = Math.round(dir * maxAmt * (.15 + R() * R()));
      if (Math.abs(amt) < 1) continue;
      v.clearRect(0, y, W, h);
      v.drawImage(tmp, 0, y, W, h, amt, y, W, h);
      v.drawImage(tmp, 0, y, W, h, amt + (amt > 0 ? -W : W), y, W, h);
    }
  }
  if (fx.block && inB) {
    const n = Math.floor(e * 7 * R());
    for (let i = 0; i < n; i++) {
      const w = Math.floor((30 + R() * 220) * s), h = Math.floor((4 + R() * 40) * s);
      const sx = Math.floor(R() * Math.max(1, W - w)), sy = Math.floor(R() * Math.max(1, H - h));
      const dx = sx + Math.floor((R() - .5) * W * .3), dy = sy + Math.floor((R() - .5) * 40 * s);
      v.drawImage(srcCanvas, sx, sy, w, h, dx, dy, w, h);
    }
  }
  if (fx.smear) {
    const nb = inB ? 1 + Math.floor(e * 5 * R()) : (R() < .25 ? 1 : 0), rh = Math.max(1, Math.round(s));
    const tmp = mkCv(W, H);
    tmp.getContext('2d')!.drawImage(srcCanvas, 0, 0);
    for (let b = 0; b < nb; b++) {
      const y0 = Math.floor(R() * H), bh = Math.floor((6 + R() * 50) * s), amp = (4 + e * 40) * s;
      for (let y = y0; y < Math.min(H - rh, y0 + bh); y += rh) {
        const dx = (R() - .5) * amp * (.3 + R());
        v.clearRect(0, y, W, rh);
        v.drawImage(tmp, 0, y, W, rh, dx, y, W, rh);
        v.drawImage(tmp, 0, y, W, rh, dx + (dx > 0 ? -W : W), y, W, rh);
      }
    }
  }
}

// ═════════════════════════════════════════════════════════════════════
// MATRIX RAIN
// ═════════════════════════════════════════════════════════════════════

interface Drop {
  on: boolean;
  y: number;
  v: number;
  l: number;
}

export function glitchRain(
  v: CanvasRenderingContext2D, W: number, H: number,
  s: number, R: () => number, S: GlitchState,
): void {
  const cw = Math.round(14 * s), n = Math.floor(W / cw);
  const CH = 'ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿ0123456789ABCDEF';
  if (!S.drops || S.drops.length !== n) {
    S.drops = Array.from({ length: n }, () => ({ on: R() < .35, y: R() * H, v: cw * (.5 + R() * 1.2), l: 6 + Math.floor(R() * 16) }));
  }
  v.globalCompositeOperation = 'lighter';
  v.font = `${cw}px ${MONO}`;
  v.textBaseline = 'top';
  S.drops.forEach((d, i) => {
    if (!d.on) { if (R() < .02) d.on = true; return; }
    d.y += d.v;
    if (d.y - d.l * cw > H) { d.y = -R() * H * .3; d.v = cw * (.5 + R() * 1.2); d.on = R() < .8; return; }
    for (let k = 0; k < d.l; k++) {
      v.globalAlpha = (1 - k / d.l) * .8;
      v.fillStyle = k ? state.ui.color : '#fff';
      v.fillText(CH[Math.floor(R() * CH.length)], i * cw, d.y - k * cw);
    }
  });
  v.globalAlpha = 1;
  v.globalCompositeOperation = 'source-over';
}

// ═════════════════════════════════════════════════════════════════════
// GHOST COPY (for RGB split)
// ═════════════════════════════════════════════════════════════════════

function ghostCopy(
  S: GlitchState, key: 'gR' | 'gC',
  base: HTMLCanvasElement, color: string,
  W: number, H: number,
): HTMLCanvasElement {
  let c = S[key];
  if (!c || c.width !== W || c.height !== H) { c = mkCv(W, H); S[key] = c; }
  const x = c.getContext('2d')!;
  x.setTransform(1, 0, 0, 1, 0, 0);
  x.globalAlpha = 1;
  x.globalCompositeOperation = 'source-over';
  x.clearRect(0, 0, W, H);
  x.filter = 'grayscale(1) contrast(1.4) brightness(1.3)';
  x.drawImage(base, 0, 0);
  x.filter = 'none';
  x.globalCompositeOperation = 'multiply';
  x.fillStyle = color;
  x.fillRect(0, 0, W, H);
  x.globalCompositeOperation = 'destination-in';
  x.drawImage(base, 0, 0);
  x.globalCompositeOperation = 'source-over';
  return c;
}

// ═════════════════════════════════════════════════════════════════════
// GLITCH BUFFER — main entry point
// ═════════════════════════════════════════════════════════════════════

/**
 * Returns the glitched version of one layer's buffer
 * (or the buffer itself when this layer has glitch off).
 * Runs on a fixed grid of steps with a seeded RNG per layer,
 * so the same timeline position produces the same pixels in preview and export.
 */
export function glitchBuffer(L: Layer, buf: HTMLCanvasElement, t: number): HTMLCanvasElement {
  if (!L.gl || !L.trans) fixLayer(L, state.glitch as any);
  const gl = L.gl;
  if (!state.glitch.on || !gl.on) return buf;

  const W = buf.width, H = buf.height, fx = gl.fx, e0 = gl.amt / 100, s = 1;
  const interval = 1000 / (4 + gl.spd * 0.26);
  const step = Math.floor(t / interval);

  let S = L._gs;
  if (S && step < S.step) S = null;
  if (!S) {
    S = {
      step: -1, rng: mulberry(seedFor(L.id)), fn: 0,
      nextBurst: 0, burstEnd: 0, roll: 0, bars: [], drops: null,
      out: null, base: null, gR: null, gC: null,
    };
    L._gs = S;
  }

  const frozen = !!(gl.pg && gl.pg.st);
  if (S.out && S.out.width === W && S.out.height === H && S.step === step && !frozen) return S.out;

  const R = () => S!.rng();
  const k0 = frozen ? step : S.step < 0 ? Math.max(0, step - GLITCH_MAX_CATCHUP) : (S.step === step ? step : Math.max(S.step + 1, step - GLITCH_MAX_CATCHUP));

  for (let kk = k0; kk <= step; kk++) {
    const tk = kk * interval;
    if (frozen) {
      S.rng = mulberry(seedFor(L.id) ^ 0x7F4A7C15);
      S.bars = []; S.roll = 0; S.drops = null; S.fn = 0;
      S.nextBurst = Infinity; S.burstEnd = Infinity;
    }
    if (tk >= S.nextBurst) {
      S.burstEnd = tk + 120 + R() * (200 + e0 * 500);
      const f = gl.freq / 100;
      S.nextBurst = S.burstEnd + (f >= .99 ? 0 : (200 + (1 - f) * 3500) * (.4 + R() * 1.2));
    }
    const inB = tk < S.burstEnd, e = e0 * (inB ? .45 + R() * .55 : .07);
    const cvs = (k: 'base' | 'out'): HTMLCanvasElement => {
      let c = S![k];
      if (!c || c.width !== W || c.height !== H) { c = mkCv(W, H); S![k] = c; }
      return c;
    };
    const base = cvs('base'), out = cvs('out');
    const bx = base.getContext('2d')!;
    bx.setTransform(1, 0, 0, 1, 0, 0);
    bx.globalAlpha = 1;
    bx.globalCompositeOperation = 'copy';
    bx.drawImage(buf, 0, 0);
    bx.globalCompositeOperation = 'source-over';

    const pg = () => { if (gl.pg.on.length) pxGlitch(bx, W, H, S!.fn, gl.pg); };
    if (gl.before) pg();
    if (fx.slice || fx.rowshift || fx.block || fx.smear) applyGeomEffects(bx, base, W, H, s, e, inB, R, fx);
    if (!gl.before) pg();

    const o = out.getContext('2d')!;
    o.setTransform(1, 0, 0, 1, 0, 0);
    o.globalCompositeOperation = 'source-over';
    o.globalAlpha = 1;
    o.filter = 'none';
    o.shadowBlur = 0;
    o.clearRect(0, 0, W, H);

    let d = fx.rgb ? e * 18 * s * (.4 + R() * .6) : 0;
    let dy = fx.rgb ? (R() - .5) * e * 4 * s : 0;
    if (fx.hold) { d = Math.max(d, (2 + e0 * 9) * s * (.7 + R() * .6)); if (!dy) dy = (R() - .5) * e0 * 2 * s; }
    const ox = fx.wobble ? (R() - .5) * e * 24 * s : 0;
    if (fx.roll && inB) { if (R() < .7) S.roll = (S.roll + (.03 + R() * .12) * H * e0) % H; } else S.roll = 0;
    o.drawImage(base, ox, S.roll);
    if (S.roll) o.drawImage(base, ox, S.roll - H);

    if (d > 0.5) {
      const gR = ghostCopy(S, 'gR', base, '#ff2255', W, H);
      const gC = ghostCopy(S, 'gC', base, '#00e5ff', W, H);
      o.globalCompositeOperation = 'lighter';
      o.globalAlpha = .55;
      o.drawImage(gR, ox - d, S.roll + dy);
      o.drawImage(gC, ox + d, S.roll - dy);
      o.globalAlpha = 1;
      o.globalCompositeOperation = 'source-over';
    }
    if (fx.flick && R() < .35) {
      o.globalCompositeOperation = 'source-atop';
      o.fillStyle = `rgba(0,0,0,${e * .55 * R()})`;
      o.fillRect(0, 0, W, H);
      o.globalCompositeOperation = 'source-over';
    }
    if (fx.noise && _noisePattern) {
      o.save();
      o.globalCompositeOperation = 'source-atop';
      o.globalAlpha = .06 + e * .5;
      const sc = 1.5 * s;
      o.translate(-Math.floor(R() * 256 * sc), -Math.floor(R() * 256 * sc));
      o.scale(sc, sc);
      o.fillStyle = _noisePattern;
      o.fillRect(0, 0, W / sc + 256, H / sc + 256);
      o.restore();
      if (inB) {
        const k = Math.floor(e * 8 * R());
        o.globalCompositeOperation = 'lighter';
        o.globalAlpha = .5;
        o.fillStyle = state.ui.color;
        for (let i = 0; i < k; i++) o.fillRect(R() * W, R() * H, R() * W * .4, Math.max(1, s * (1 + R() * 2)));
        o.globalCompositeOperation = 'source-over';
        o.globalAlpha = 1;
      }
    }
    if (fx.streak) {
      const ks = e0 * (inB ? .55 + R() * .45 : .3), n = Math.floor(ks * 900 * W * H / 921600);
      const PAL = gl.streakCol === 'phos'
        ? [state.ui.color, '#ffffff', state.ui.color, state.ui.color]
        : ['#ff2255', '#ff00aa', '#3d5cff', '#7a2cff', '#00e5ff', '#ff2255', '#b8f0ff'];
      o.globalCompositeOperation = 'lighter';
      for (let c = 0; c < PAL.length; c++) {
        o.fillStyle = PAL[c];
        for (let i = 0, m = Math.floor(n / PAL.length); i < m; i++) {
          const y = R() * H, len = (3 + Math.pow(R(), 2.5) * 150) * s;
          o.globalAlpha = .12 + R() * .6;
          o.fillRect(R() * W - len * .3, y, len, Math.max(1, Math.round(s * (R() < .15 ? 2 : 1))));
        }
      }
      o.globalAlpha = 1;
      o.globalCompositeOperation = 'source-over';
    }
    if (fx.bars) {
      if (S.bars.length < 4 && R() < (inB ? .35 : .08) * (.4 + e0)) {
        const len = W * (.1 + R() * .3), left = R() < .5;
        S.bars.push({ x: left ? 0 : W - len, y: R() * H, len, ttl: 3 + Math.floor(R() * 10), h: Math.max(2, s * (2 + R() * 3)), c: R() < .7 ? '#00e5ff' : '#ff2255' });
      }
      S.bars = S.bars.filter(b => b.ttl-- > 0);
      o.globalCompositeOperation = 'lighter';
      S.bars.forEach(b => {
        o.shadowColor = b.c; o.shadowBlur = 12 * s; o.globalAlpha = .55 + R() * .4;
        o.fillStyle = b.c;
        o.fillRect(b.x, b.y + (R() - .5) * s, b.len, b.h);
      });
      o.shadowBlur = 0; o.shadowColor = 'transparent';
      o.globalAlpha = 1; o.globalCompositeOperation = 'source-over';
    }
    if (fx.rain) glitchRain(o, W, H, s, R, S);
    S.fn++; S.step = kk;
  }

  return S.out!;
}
