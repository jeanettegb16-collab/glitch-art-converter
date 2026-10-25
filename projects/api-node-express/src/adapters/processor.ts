import { createCanvas, loadImage, Image } from '@napi-rs/canvas';
import { ImageData } from '@napi-rs/canvas';
import sharp from 'sharp';
import type { ProcessResponse } from '../types.js';

// ═══════════════════════════════════════════════════════════════════
// CONSTANTS (from bios-ascii-converter16.html)
// ═══════════════════════════════════════════════════════════════════
const CHARSETS = [
  ' ░▒▓█',' .`-_\':;,^"~=+|!?tfjrxnuvczXYUJCLQ0OZmwqpdbkhao*#MW&8%B@$',
  ' .\'`^",:;Il!i><~+_-?][}{1)(|\\/*tfjrxnuvczXYUJCLQ0OZmwqpdbkhao#MW&8%B@$',
  ' .:;|+#@',' 1234567890',' 0123456789ABCDEF',' .+*%&$#@',
  ' ｦｧｨｩｪｫｬｭｮｯｰｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾙﾚﾛﾜﾝ',
  ' ･ｦｲｸｺｿﾁﾄﾊﾋﾌﾘﾛﾝ012345789Z',
  ' ─━│┃┄┅┆┇┈┉┊┋┌┍┎┏┐┑┒┓└┕┖┗┘┙┚┛├┝┞┟┠┡┢┣┤┥┦┧┨┩┪┫┬┭┮┯┰┱┲┳┴┵┶┷┸┹┺┻┼┽┾┿╀╁╂╃╔╗╚╝╬',
  ' ░▒▓:./\\|#@',
  ' ⠁⠂⠃⠄⠅⠆⠇⠈⠉⠊⠋⠌⠍⠎⠏⠐⠑⠒⠓⠔⠕⠖⠗⠘⠙⠚⠛⠜⠝⠞⠟⠠⠡⠢⠣⠤⠥⠦⠧⠨⠩⠪⠫⠬⠭⠮⠯⠰⠱⠲⠳⠴⠵⠶⠷⠸⠹⠺⠻⠼⠽⠾⠿⣿',
  ' ▁▂▃▄▅▆▇█',' ·•●◉◎⬤',
  ' !"#$%&\'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~',
  ' 01',' ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃᛇᛈᛉᛊᛏᛒᛖᛗᛚᛜᛞᛟ',' ·∙∘○∑∏∫∂√∞≈≠±×÷#@',' ╌╍┈┉▪▫▬▮▯╳┼╬▚▞▓█',
];

const PALETTES: Record<string, string[]> = {
  pico8: ['#000000','#1d2b53','#7e2553','#008751','#ab5236','#5f574f','#c2c3c7','#fff1e8','#ff004d','#ffa300','#ffec27','#00e436','#29adff','#83769c','#ff77a8','#ffccaa'],
  cga:   ['#000000','#55ffff','#ff55ff','#ffffff'],
  vboy:  ['#000000','#3a0000','#7a0000','#c40000','#ff2020'],
  vapor: ['#0b0033','#1a1a40','#3a0ca3','#7209b7','#f72585','#4cc9f0','#b8f0ff','#ffffff'],
  cyber: ['#000814','#001d3d','#003566','#0033ff','#00b4d8','#90e0ef','#ff006e','#ffffff'],
  sepia: ['#1a0f08','#3b2412','#6b4423','#a06a36','#d19a5c','#f0cf9a','#fff3d6'],
  ice:   ['#000010','#00061f','#001a6b','#0033ff','#2f6bff','#66aaff','#b8f0ff','#ffffff'],
  gameboy: ['#0f380f','#306230','#8bac0f','#9bbc0f'],
  mono:    ['#000000','#333333','#555555','#888888','#bbbbbb','#ffffff'],
  crt:     ['#001100','#003300','#005500','#008800','#00bb00','#00ee00','#39ff14','#aaffaa'],
  amber:   ['#1a0800','#3d1800','#7a3200','#b34800','#e06400','#ffaa00','#ffcc44','#ffe8a0'],
  nes: ['#7C7C7C','#0000FC','#0000BC','#4428BC','#940084','#A80020','#A81000','#881400',
        '#503000','#007800','#006800','#005800','#004058','#000000','#000000','#000000',
        '#BCBCBC','#0078F8','#0058F8','#6844FC','#D800CC','#E40058','#F83800','#E45C10',
        '#AC7C00','#00B800','#00A800','#00A844','#008888','#000000','#000000','#000000',
        '#F8F8F8','#3CBCFC','#6888FC','#9878F8','#F878F8','#F85898','#F87858','#FCA044',
        '#F8B800','#B8F818','#58D854','#58F898','#00E8D8','#787878','#000000','#000000',
        '#FCFCFC','#A4E4FC','#B8B8F8','#D8B8F8','#F8B8F8','#F8A4C0','#F0D0B0','#FCE0A8',
        '#F8D878','#D8F878','#B8F8B8','#B8F8D8','#00FCFC','#F8D8F8','#000000','#000000'],
  c64: ['#000000','#ffffff','#880000','#aaffee','#cc44cc','#00cc55','#0000aa','#eeee77',
        '#dd8855','#664400','#ff7777','#333333','#777777','#aaff66','#0088ff','#bbbbbb'],
};

const REF_HEIGHT = 720;
const FONT_RATIO = 1.75;
const MONO = "'VT323','Courier New',monospace";

// ═══════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════
function hexToRgb(h: string): [number, number, number] {
  return [parseInt(h.slice(1,3),16), parseInt(h.slice(3,5),16), parseInt(h.slice(5,7),16)];
}

function mkCv(w: number, h: number) {
  return createCanvas(w, h);
}

async function loadBufferImage(buffer: Buffer): Promise<Image> {
  const base64 = buffer.toString('base64');
  return loadImage('data:image/png;base64,' + base64);
}

async function bufferToSharpCanvas(buffer: Buffer): Promise<{ canvas: any; ctx: any; width: number; height: number }> {
  const img = await loadBufferImage(buffer);
  const c = createCanvas(img.width, img.height);
  const ctx = c.getContext('2d');
  ctx.drawImage(img, 0, 0);
  return { canvas: c, ctx, width: img.width, height: img.height };
}

function clamp01(x: number) { return x < 0 ? 0 : x > 1 ? 1 : x; }

const h01 = (a: number, b = 0) => {
  let h = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263) + 1013904223) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
};

// ═══════════════════════════════════════════════════════════════════
// GLYPH RENDERING
// ═══════════════════════════════════════════════════════════════════
function buildGlyphGrid(src: Image, cfg: Record<string, unknown>) {
  const ratio = FONT_RATIO;
  const cols = Math.max(8, +(cfg.cols || 160));
  const rows = Math.max(1, Math.round((src.height / src.width) * cols / ratio));
  const off = mkCv(cols, rows);
  const c = off.getContext('2d');

  // Use sharp for filters since canvas filters don't work well in napi-rs
  // We downscale first, then read raw pixels
  const tmp = mkCv(cols, rows);
  const tctx = tmp.getContext('2d');
  tctx.imageSmoothingEnabled = true;
  tctx.drawImage(src, 0, 0, cols, rows);

  const d = tctx.getImageData(0, 0, cols, rows).data;

  // Apply contrast / brightness
  const contrast = +(cfg.contrast || 18);
  const brightness = +(cfg.brightness || 0);
  const sat = +(cfg.sat || 10);
  const gamma = +(cfg.gamma || 10);

  // Simple contrast+brightness
  if (contrast !== 18 || brightness !== 0) {
    const cMul = contrast / 10;
    const bOff = brightness;
    for (let i = 0; i < d.length; i += 4) {
      d[i] = clamp01((d[i] / 255 - 0.5) * cMul + 0.5 + bOff / 100) * 255;
      d[i+1] = clamp01((d[i+1] / 255 - 0.5) * cMul + 0.5 + bOff / 100) * 255;
      d[i+2] = clamp01((d[i+2] / 255 - 0.5) * cMul + 0.5 + bOff / 100) * 255;
    }
  }

  // Gamma
  if (Math.abs(gamma / 10 - 1) > 0.05) {
    const g = gamma / 10;
    const lut = new Uint8Array(256);
    for (let i = 0; i < 256; i++) lut[i] = Math.round(Math.pow(i / 255, g) * 255);
    for (let i = 0; i < d.length; i += 4) {
      d[i] = lut[d[i]]; d[i+1] = lut[d[i+1]]; d[i+2] = lut[d[i+2]];
    }
  }

  const lum = new Float32Array(cols * rows);
  const edge = +(cfg.edge || 0);
  if (edge) {
    const Li = (y: number, x: number) => {
      const i = (y * cols + x) * 4;
      return 0.299 * d[i] + 0.587 * d[i+1] + 0.114 * d[i+2];
    };
    for (let y = 1; y < rows - 1; y++) for (let x = 1; x < cols - 1; x++) {
      const gx = -Li(y-1,x-1)+Li(y-1,x+1)-2*Li(y,x-1)+2*Li(y,x+1)-Li(y+1,x-1)+Li(y+1,x+1);
      const gy = -Li(y-1,x-1)-2*Li(y-1,x)-Li(y-1,x+1)+Li(y+1,x-1)+2*Li(y+1,x)+Li(y+1,x+1);
      lum[y*cols+x] = Math.sqrt(gx*gx + gy*gy);
    }
    let m = 0; for (let i = 0; i < lum.length; i++) if (lum[i] > m) m = lum[i];
    if (m > 0) for (let i = 0; i < lum.length; i++) lum[i] = lum[i] / m * 255;
  } else {
    for (let i = 0; i < cols * rows; i++) {
      const p = i * 4;
      lum[i] = 0.299 * d[p] + 0.587 * d[p+1] + 0.114 * d[p+2];
    }
  }

  if (+(cfg.vig || 0) || +(cfg.grain || 0) || +(cfg.scanR || 0)) {
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
      const i = y * cols + x; let l = lum[i];
      if (+(cfg.vig || 0)) {
        const dx = x / cols - 0.5, dy = y / rows - 0.5;
        l *= 1 - Math.min(1, (dx*dx + dy*dy) * 2.2);
      }
      if (+(cfg.grain || 0)) l += (h01(i, 4242) - 0.5) * 60;
      if (+(cfg.scanR || 0) && y % 2) l *= 0.6;
      lum[i] = Math.max(0, Math.min(255, l));
    }
  }

  const charset = CHARSETS[+(cfg.charset || 0) | 0] || CHARSETS[0];
  if (+(cfg.dither || 0)) {
    const step = 255 / (charset.length - 1);
    const buf = new Float32Array(lum);
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
      const idx = y * cols + x, o = buf[idx], nw = Math.round(o / step) * step;
      buf[idx] = nw; const err = o - nw;
      if (x + 1 < cols) buf[idx+1] += err * 7/16;
      if (y + 1 < rows) {
        if (x > 0) buf[idx+cols-1] += err * 3/16;
        buf[idx+cols] += err * 5/16;
        if (x + 1 < cols) buf[idx+cols+1] += err * 1/16;
      }
    }
    lum.set(buf);
  }
  if (+(cfg.invert || 0)) for (let i = 0; i < lum.length; i++) lum[i] = 255 - lum[i];

  return { cols, rows, lum, data: d, charset };
}

function mixWhite(hex: string, t: number) {
  const [r, g, b] = hexToRgb(hex);
  const f = (v: number) => Math.round(v + (255 - v) * t);
  return `rgb(${f(r)},${f(g)},${f(b)})`;
}

async function renderGlyphs(src: Image, cfg: Record<string, unknown>, outW: number, outH: number): Promise<Buffer> {
  const { cols, rows, lum, data, charset } = buildGlyphGrid(src, cfg);
  const cw = outW / cols, ch = outH / rows;
  const glow = +(cfg.glow || 10);
  const k = Math.min(3, glow / 10);

  const outC = mkCv(outW, outH);
  const outCtx = outC.getContext('2d');
  outCtx.fillStyle = '#000';
  outCtx.fillRect(0, 0, outW, outH);

  const g = mkCv(outW, outH);
  const gc = g.getContext('2d');
  gc.clearRect(0, 0, outW, outH);
  gc.font = `${ch}px ${MONO}`;
  gc.textBaseline = 'top';

  const color = String(cfg.color || '#39ff14');
  const useColorFromImage = !!(cfg.colorFromImage || 0);
  const core = (glow > 0 && !useColorFromImage) ? mixWhite(color, Math.min(0.55, 0.12 + k * 0.08)) : color;
  gc.fillStyle = core;

  const n = charset.length - 1;
  for (let gy = 0; gy < rows; gy++) {
    const yo = gy * ch;
    for (let gx = 0; gx < cols; gx++) {
      const i = gy * cols + gx;
      const c1 = charset[Math.max(0, Math.min(n, Math.round(lum[i] / 255 * n)))];
      if (c1 === ' ') continue;
      if (useColorFromImage) {
        const p = i * 4, r = data[p], g2 = data[p+1], b2 = data[p+2], m = Math.max(r, g2, b2);
        if (m < 8) continue;
        const kk = Math.min(3, 255 / m);
        gc.fillStyle = `rgb(${Math.round(r*kk)},${Math.round(g2*kk)},${Math.round(b2*kk)})`;
      }
      gc.fillText(c1, gx * cw, yo);
    }
  }

  // Emissive halo
  if (glow > 0) {
    const sp = Math.max(0.4, +(cfg.spread || 1.5));
    outCtx.save();
    outCtx.globalCompositeOperation = 'lighter';
    const passes = [
      [sp * 8, 0.12 + k * 0.2],
      [sp * 3.2, 0.25 + k * 0.25],
      [sp * 1.2, 0.5 + k * 0.2],
    ];
    for (const [r, a] of passes) {
      outCtx.filter = `blur(${r.toFixed(1)}px)`;
      outCtx.globalAlpha = Math.min(1, a);
      outCtx.drawImage(g, 0, 0);
    }
    outCtx.restore();
  }

  outCtx.drawImage(g, 0, 0);
  return await outC.encode('png');
}

// ═══════════════════════════════════════════════════════════════════
// PIXEL RENDERING
// ═══════════════════════════════════════════════════════════════════
function nearestColorIdx(r: number, g: number, b: number, pal: [number,number,number][]) {
  let best = Infinity, bi = 0;
  for (let i = 0; i < pal.length; i++) {
    const p = pal[i];
    const d = (r-p[0])*(r-p[0])*2 + (g-p[1])*(g-p[1])*4 + (b-p[2])*(b-p[2])*3;
    if (d < best) { best = d; bi = i; }
  }
  return bi;
}

function medianCut(pixels: number[], n: number): [number, number, number][] {
  const avg = (b: [number,number,number][]) => {
    let r = 0, g = 0, bl = 0;
    for (const p of b) { r += p[0]; g += p[1]; bl += p[2]; }
    return [Math.round(r/b.length), Math.round(g/b.length), Math.round(bl/b.length)] as [number,number,number];
  };
  let pts: [number,number,number][] = [];
  for (let i = 0; i < pixels.length; i += 3) pts.push([pixels[i], pixels[i+1], pixels[i+2]]);
  let buckets: [number,number,number][][] = [pts];
  while (buckets.length < n) {
    let wi = 0, mx = 0;
    for (let i = 0; i < buckets.length; i++) {
      const b = buckets[i];
      if (!b.length) continue;
      let r0 = 255, r1 = 0, g0 = 255, g1 = 0, b0 = 255, b1 = 0;
      for (const p of b) {
        r0 = Math.min(r0, p[0]); r1 = Math.max(r1, p[0]);
        g0 = Math.min(g0, p[1]); g1 = Math.max(g1, p[1]);
        b0 = Math.min(b0, p[2]); b1 = Math.max(b1, p[2]);
      }
      const rr = Math.max(r1-r0, g1-g0, b1-b0);
      if (rr > mx) { mx = rr; wi = i; }
    }
    const b = buckets[wi];
    if (!b || b.length < 2) break;
    let r0 = 255, r1 = 0, g0 = 255, g1 = 0, b0 = 255, b1 = 0;
    for (const p of b) {
      r0 = Math.min(r0, p[0]); r1 = Math.max(r1, p[0]);
      g0 = Math.min(g0, p[1]); g1 = Math.max(g1, p[1]);
      b0 = Math.min(b0, p[2]); b1 = Math.max(b1, p[2]);
    }
    const rr = r1-r0, gr = g1-g0, br = b1-b0;
    const ch = rr >= gr && rr >= br ? 0 : gr >= br ? 1 : 2;
    b.sort((a, c) => a[ch] - c[ch]);
    const mid = Math.floor(b.length / 2);
    buckets.splice(wi, 1, b.slice(0, mid), b.slice(mid));
    if (buckets.length >= n) break;
  }
  return buckets.filter(b => b.length).map(avg);
}

function samplePalette(img: Image, n: number): [number, number, number][] {
  const sw = Math.min(img.width, 200), sh = Math.round(sw * img.height / img.width);
  const c = mkCv(sw, sh);
  c.getContext('2d').drawImage(img, 0, 0, sw, sh);
  const d = c.getContext('2d').getImageData(0, 0, sw, sh).data;
  const total = sw * sh, step = Math.max(1, Math.floor(total / 8000));
  const pts: number[] = [];
  for (let i = 0; i < total; i += step) {
    const p = i * 4;
    if (d[p+3] > 10) { pts.push(d[p], d[p+1], d[p+2]); }
  }
  return medianCut(pts, n);
}

async function renderPixels(src: Image, cfg: Record<string, unknown>, outW: number, outH: number): Promise<Buffer> {
  const bs = Math.max(1, +(cfg.block || 8));
  const bx = Math.max(1, Math.round(outW / bs));
  const by = Math.max(1, Math.round(outH / bs));
  const off = mkCv(bx, by);
  const c = off.getContext('2d');
  c.imageSmoothingEnabled = true;
  c.drawImage(src, 0, 0, bx, by);
  const d = c.getImageData(0, 0, bx, by).data;

  const paletteName = String(cfg.palette || 'full');
  let pal: [number,number,number][] | null = null;
  if (PALETTES[paletteName]) pal = PALETTES[paletteName].map(hexToRgb);
  else if (paletteName.startsWith('auto')) {
    pal = samplePalette(src, +paletteName.replace('auto', ''));
  }

  const out = new Uint8ClampedArray(d);
  if (pal) {
    if (+(cfg.dither || 0)) {
      const buf = new Float32Array(d);
      for (let y = 0; y < by; y++) for (let x = 0; x < bx; x++) {
        const idx = (y * bx + x) * 4;
        const r = Math.max(0, Math.min(255, buf[idx]));
        const g = Math.max(0, Math.min(255, buf[idx+1]));
        const b = Math.max(0, Math.min(255, buf[idx+2]));
        const [nr, ng, nb] = pal[nearestColorIdx(r, g, b, pal)];
        out[idx] = nr; out[idx+1] = ng; out[idx+2] = nb; out[idx+3] = 255;
        const er = r-nr, eg = g-ng, eb = b-nb;
        const diffs = [[1,0,7/16],[-1,1,3/16],[0,1,5/16],[1,1,1/16]];
        for (const [dx, dy, w] of diffs) {
          const nx = x + dx, ny = y + dy;
          if (nx >= 0 && nx < bx && ny >= 0 && ny < by) {
            const ni = (ny * bx + nx) * 4;
            buf[ni] += er * w; buf[ni+1] += eg * w; buf[ni+2] += eb * w;
          }
        }
      }
    } else {
      for (let i = 0; i < d.length; i += 4) {
        const [nr, ng, nb] = pal[nearestColorIdx(d[i], d[i+1], d[i+2], pal)];
        out[i] = nr; out[i+1] = ng; out[i+2] = nb; out[i+3] = 255;
      }
    }
  }

  if (+(cfg.edge || 0)) {
    const Li = (r: number, cc: number) => {
      const j = (r * bx + cc) * 4;
      return out[j]*0.299 + out[j+1]*0.587 + out[j+2]*0.114;
    };
    for (let y = 1; y < by - 1; y++) for (let x = 1; x < bx - 1; x++) {
      const i = (y * bx + x) * 4;
      const diff = Math.abs(Li(y,x)-Li(y-1,x))+Math.abs(Li(y,x)-Li(y+1,x))+Math.abs(Li(y,x)-Li(y,x-1))+Math.abs(Li(y,x)-Li(y,x+1));
      if (diff > 80) { out[i] = 0; out[i+1] = 0; out[i+2] = 0; }
    }
  }

  const srcCv = mkCv(bx, by);
  srcCv.getContext('2d').putImageData(new ImageData(out, bx, by), 0, 0);

  const outC = mkCv(outW, outH);
  const octx = outC.getContext('2d');
  octx.imageSmoothingEnabled = false;
  octx.drawImage(srcCv, 0, 0, outW, outH);

  if (+(cfg.grid || 0) && bs >= 4) {
    octx.fillStyle = 'rgba(0,0,0,.35)';
    for (let x = 0; x < outW; x += bs) octx.fillRect(x, 0, 1, outH);
    for (let y = 0; y < outH; y += bs) octx.fillRect(0, y, outW, 1);
  }
  if (+(cfg.scan || 0)) {
    octx.fillStyle = 'rgba(0,0,0,.3)';
    for (let y = 0; y < outH; y += Math.max(2, bs >> 1)) octx.fillRect(0, y, outW, 1);
  }
  if (+(cfg.noise || 0)) {
    const nd = octx.getImageData(0, 0, outW, outH);
    const dd = nd.data;
    for (let i = 0; i < dd.length; i += 4) {
      const n = (h01(i, 911) - 0.5) * 50;
      dd[i] += n; dd[i+1] += n; dd[i+2] += n;
    }
    octx.putImageData(nd, 0, 0);
  }

  return await outC.encode('png');
}

// ═══════════════════════════════════════════════════════════════════
// GLITCH EFFECTS
// ═══════════════════════════════════════════════════════════════════
async function renderGlitch(src: Image, cfg: Record<string, unknown>): Promise<Buffer> {
  const w = src.width, h = src.height;
  const outC = mkCv(w, h);
  const ctx = outC.getContext('2d');

  // Start with base image
  ctx.drawImage(src, 0, 0);

  const amt = +(cfg.amt || 50) / 100;
  const fx = cfg.fx as Record<string, number> || {};

  // RGB Split
  if (+(fx.rgb || 0) && amt > 0) {
    const off = Math.round(w * amt * 0.05);
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.drawImage(outC, off, 0);
    ctx.globalCompositeOperation = 'multiply';
    ctx.drawImage(outC, -off, 0);
    ctx.restore();
  }

  // Slice tear
  if (+(fx.slice || 0) && amt > 0) {
    const slices = Math.floor(h / (4 + Math.random() * 12));
    const id = ctx.getImageData(0, 0, w, h);
    const d = new Uint8ClampedArray(id.data);
    for (let s = 0; s < slices; s++) {
      const y1 = Math.floor(Math.random() * h);
      const hh = Math.floor(Math.random() * 40 * amt) + 1;
      const shift = Math.floor((Math.random() - 0.5) * w * amt * 0.3);
      for (let y = y1; y < Math.min(h, y1 + hh); y++) {
        if (shift > 0) {
          for (let x = w - 1; x >= shift; x--) {
            for (let c = 0; c < 4; c++) d[(y*w+x)*4+c] = d[(y*w+x-shift)*4+c];
          }
        } else if (shift < 0) {
          for (let x = 0; x < w + shift; x++) {
            for (let c = 0; c < 4; c++) d[(y*w+x)*4+c] = d[(y*w+x-shift)*4+c];
          }
        }
      }
    }
    ctx.putImageData(new ImageData(d as any, w, h), 0, 0);
  }

  // Row shift
  if (+(fx.rowshift || 0) && amt > 0) {
    const id = ctx.getImageData(0, 0, w, h);
    for (let y = 0; y < h; y++) {
      const shift = Math.floor((Math.random() - 0.5) * w * amt * 0.15);
      if (shift === 0) continue;
      const tmp = new Uint8Array(w * 4);
      for (let x = 0; x < w; x++) for (let c = 0; c < 4; c++) tmp[x*4+c] = id.data[(y*w+x)*4+c];
      for (let x = 0; x < w; x++) {
        const sx = ((x + shift) % w + w) % w;
        for (let c = 0; c < 4; c++) id.data[(y*w+x)*4+c] = tmp[sx*4+c];
      }
    }
    ctx.putImageData(id, 0, 0);
  }

  // Block corrupt
  if (+(fx.block || 0) && amt > 0) {
    const blocks = Math.floor(amt * 20);
    for (let b = 0; b < blocks; b++) {
      const bw = Math.floor(Math.random() * 80 * amt) + 8;
      const bh = Math.floor(Math.random() * 40 * amt) + 4;
      const bx = Math.floor(Math.random() * (w - bw));
      const by = Math.floor(Math.random() * (h - bh));
      const sx = Math.floor(Math.random() * (w - bw));
      const sy = Math.floor(Math.random() * (h - bh));
      const tmp = ctx.getImageData(sx, sy, bw, bh);
      ctx.putImageData(tmp, bx, by);
    }
  }

  // Static noise
  if (+(fx.noise || 0) && amt > 0) {
    const id = ctx.getImageData(0, 0, w, h);
    for (let i = 0; i < id.data.length; i += 4) {
      if (Math.random() < amt * 0.1) {
        const n = (Math.random() - 0.5) * 200 * amt;
        id.data[i] += n; id.data[i+1] += n; id.data[i+2] += n;
      }
    }
    ctx.putImageData(id, 0, 0);
  }

  // Flicker (reduce brightness randomly)
  if (+(fx.flick || 0) && amt > 0 && Math.random() < amt * 0.3) {
    const id = ctx.getImageData(0, 0, w, h);
    for (let i = 0; i < id.data.length; i += 4) {
      id.data[i] *= 0.7; id.data[i+1] *= 0.7; id.data[i+2] *= 0.7;
    }
    ctx.putImageData(id, 0, 0);
  }

  // Scan bars overlay
  if (+(fx.bars || 0) && amt > 0) {
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    for (let y = 0; y < h; y += 4) {
      if (Math.random() < amt * 0.4) ctx.fillRect(0, y, w, 2);
    }
  }

  return await outC.encode('png');
}

// ═══════════════════════════════════════════════════════════════════
// PALETTE & HISTOGRAM
// ═══════════════════════════════════════════════════════════════════
function quantizeBuffer(data: Uint8ClampedArray, w: number, h: number, maxColors: number): [number, number, number][] {
  const pts: [number, number, number][] = [];
  for (let i = 0; i < data.length; i += 4) {
    if (data[i+3] > 10) pts.push([data[i], data[i+1], data[i+2]]);
  }
  let buckets: [number, number, number][][] = [pts];
  while (buckets.length < maxColors) {
    let wi = 0, mx = 0;
    for (let i = 0; i < buckets.length; i++) {
      const b = buckets[i];
      if (!b.length) continue;
      let r0 = 255, r1 = 0, g0 = 255, g1 = 0, b0 = 255, b1 = 0;
      for (const p of b) {
        r0 = Math.min(r0, p[0]); r1 = Math.max(r1, p[0]);
        g0 = Math.min(g0, p[1]); g1 = Math.max(g1, p[1]);
        b0 = Math.min(b0, p[2]); b1 = Math.max(b1, p[2]);
      }
      const rr = Math.max(r1-r0, g1-g0, b1-b0);
      if (rr > mx) { mx = rr; wi = i; }
    }
    const b = buckets[wi];
    if (!b || b.length < 2) break;
    let r0 = 255, r1 = 0, g0 = 255, g1 = 0, b0 = 255, b1 = 0;
    for (const p of b) {
      r0 = Math.min(r0, p[0]); r1 = Math.max(r1, p[0]);
      g0 = Math.min(g0, p[1]); g1 = Math.max(g1, p[1]);
      b0 = Math.min(b0, p[2]); b1 = Math.max(b1, p[2]);
    }
    const rr = r1-r0, gr = g1-g0, br = b1-b0;
    const ch = rr >= gr && rr >= br ? 0 : gr >= br ? 1 : 2;
    b.sort((a, c) => a[ch] - c[ch]);
    const mid = Math.floor(b.length / 2);
    buckets.splice(wi, 1, b.slice(0, mid), b.slice(mid));
    if (buckets.length >= maxColors) break;
  }
  return buckets.filter(b => b.length).map(b => {
    let r = 0, g = 0, bl = 0;
    for (const p of b) { r += p[0]; g += p[1]; bl += p[2]; }
    return [Math.round(r/b.length), Math.round(g/b.length), Math.round(bl/b.length)] as [number, number, number];
  });
}

export async function processImage(
  buffer: Buffer, mode: string, config: Record<string, unknown>,
): Promise<ProcessResponse> {
  const start = Date.now();

  // Load image at reasonable size
  const imgMeta = await sharp(buffer).metadata();
  const MAX_DIM = 1280;
  const scale = Math.min(1, MAX_DIM / Math.max(imgMeta.width || 1280, imgMeta.height || 720));
  const procW = Math.round((imgMeta.width || 640) * scale);
  const procH = Math.round((imgMeta.height || 360) * scale);

  const rawImg = await sharp(buffer)
    .resize(procW, procH, { fit: 'inside' })
    .png()
    .toBuffer();

  const img = await loadBufferImage(rawImg);
  let outBuffer: Buffer;

  switch (mode) {
    case 'glyph': {
      outBuffer = await renderGlyphs(img, config, procW, procH);
      break;
    }
    case 'pixel': {
      outBuffer = await renderPixels(img, config, procW, procH);
      break;
    }
    case 'glitch': {
      outBuffer = await renderGlitch(img, config);
      break;
    }
    case 'palette': {
      const maxColors = Math.min(256, Math.max(2, +(config.colors || 16)));
      const sc = mkCv(200, 200);
      sc.getContext('2d').drawImage(img, 0, 0, 200, 200);
      const d = sc.getContext('2d').getImageData(0, 0, 200, 200).data;
      const palette = quantizeBuffer(d, 200, 200, maxColors);
      outBuffer = await createPaletteImage(palette, 64);
      break;
    }
    case 'histogram': {
      outBuffer = await buildHistogram(buffer);
      break;
    }
    default: {
      // Return resized original
      outBuffer = rawImg;
    }
  }

  return {
    success: true,
    format: 'png',
    processingTimeMs: Date.now() - start,
    data: outBuffer,
  };
}

export async function buildAsciiString(buffer: Buffer, config: Record<string, unknown>): Promise<string> {
  const maxDim = 720;
  const imgMeta = await sharp(buffer).metadata();
  const scale = Math.min(1, maxDim / Math.max(imgMeta.width || 1280, imgMeta.height || 720));
  const procW = Math.round((imgMeta.width || 640) * scale);
  const procH = Math.round((imgMeta.height || 360) * scale);

  const rawImg = await sharp(buffer).resize(procW, procH, { fit: 'inside' }).png().toBuffer();
  const img = await loadBufferImage(rawImg);

  const { cols, rows, lum, charset } = buildGlyphGrid(img, config);
  let s = '';
  const n = charset.length - 1;
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const l = lum[y * cols + x];
      s += charset[Math.max(0, Math.min(n, Math.round(l / 255 * n)))];
    }
    s += '\n';
  }
  return s;
}

export async function extractPalette(buffer: Buffer, maxColors: number): Promise<[number, number, number][]> {
  const rawImg = await sharp(buffer).resize(200, 200, { fit: 'cover' }).png().toBuffer();
  const img = await loadBufferImage(rawImg);
  const c = mkCv(200, 200);
  c.getContext('2d').drawImage(img, 0, 0, 200, 200);
  const d = c.getContext('2d').getImageData(0, 0, 200, 200).data;
  return quantizeBuffer(d, 200, 200, maxColors);
}

export async function buildHistogram(buffer: Buffer): Promise<Buffer> {
  const maxDim = 720;
  const imgMeta = await sharp(buffer).metadata();
  const scale = Math.min(1, maxDim / Math.max(imgMeta.width || 1280, imgMeta.height || 720));
  const procW = Math.round((imgMeta.width || 640) * scale);
  const procH = Math.round((imgMeta.height || 360) * scale);

  const rawImg = await sharp(buffer).resize(procW, procH, { fit: 'inside' }). grayscale().raw().toBuffer();
  const hist = new Uint32Array(256);
  for (let i = 0; i < rawImg.length; i++) hist[rawImg[i]]++;
  const max = Math.max(...hist);
  const h = 100, w = 512;
  const canvas = mkCv(w, h);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#39ff14';
  for (let x = 0; x < 256; x++) {
    const barH = Math.round((hist[x] / max) * h);
    ctx.fillRect(x * 2, h - barH, 2, barH);
  }
  return await canvas.encode('png');
}

async function createPaletteImage(palette: [number, number, number][], sw = 64): Promise<Buffer> {
  const cols = Math.min(palette.length, 8);
  const rows = Math.ceil(palette.length / cols);
  const w = cols * sw, h = rows * sw;
  const canvas = mkCv(w, h);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < palette.length; i++) {
    const [r, g, b] = palette[i];
    ctx.fillStyle = `rgb(${r},${g},${b})`;
    const x = (i % cols) * sw, y = Math.floor(i / cols) * sw;
    ctx.fillRect(x, y, sw, sw);
  }
  return canvas.encode('png');
}
