import './style.css';

// ═════════════════════════════════════════════════════════════════════
// MAIN ENTRY — UI wiring + init
// ═════════════════════════════════════════════════════════════════════

import type { Layer, ImageLayer, TextLayer } from './types';
import {
  CHARSETS, CHARSET_NAMES, COLOR_SET, colorBtns, PALETTES,
  LIGHT_PRESETS, PASSIVE_STYLES, TEMP_STYLES, GBG, MONO,
  REF_HEIGHT, MAX_LIGHT_IMG_DIM,
} from './constants';
import { $, mkCv, imgKey } from './utils/canvas';
import { mulberry, seedFor } from './utils/rng';
import { hexToRgb } from './utils/color';
import { saveBlob } from './utils/file';
import {
  state, selLayer, rollLayers, canvasAspect,
  newImageLayer, newTextLayer, uid,
} from './state/store';
import { fixLayer, normAnim, fillDefaults, defaultLight } from './state/defaults';
import { serializeProject, loadProject } from './state/project';
import { renderGlyphs, buildAsciiString, resetFontRatio } from './render/glyph';
import { glitchNoise } from './render/glitch';
import { setViewMode } from './render/compositor';
import {
  tick, resetTimeline, replayAnim, startRollTransition, rollStep,
  exportTiming, exportFps, getTL, setTL, setLastNow,
} from './render/timeline';
import { autoDur } from './render/transitions';
import { exportAnim, savePng } from './ui/export-anim';

// ── Status ──
export function setStatus(m: string): void {
  ($('status') as HTMLElement).textContent = '> ' + m;
}

// ── DOM refs ──
const cv = $('outCv') as HTMLCanvasElement;
const ctx = cv.getContext('2d')!;

// ═════════════════════════════════════════════════════════════════════
// LAYER LIST + THUMBNAILS
// ═════════════════════════════════════════════════════════════════════

const _thumbCache = new Map<number, { key: string; url: string }>();

function thumbURL(L: Layer): string {
  const key = L.type === 'image' ? 'i' + imgKey((L as ImageLayer)._img) : 't' + L.content + '|' + (L as TextLayer).color;
  const e = _thumbCache.get(L.id);
  if (e && e.key === key) return e.url;
  const TW = 64, TH = 48;
  const c = mkCv(TW, TH), x = c.getContext('2d')!;
  let url = '';
  if (L.type === 'image' && (L as ImageLayer)._img) {
    const im = (L as ImageLayer)._img!;
    const iw = im.naturalWidth || im.width, ih = im.naturalHeight || im.height;
    const sc = Math.min(TW / iw, TH / ih);
    c.width = Math.max(1, Math.round(iw * sc));
    c.height = Math.max(1, Math.round(ih * sc));
    x.drawImage(im, 0, 0, c.width, c.height);
    url = c.toDataURL('image/jpeg', .7);
  } else {
    c.width = TW; c.height = TH;
    x.fillStyle = '#040400'; x.fillRect(0, 0, TW, TH);
    x.fillStyle = (L as TextLayer).color || '#39ff14';
    x.font = `18px ${MONO}`;
    x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText(String((L as TextLayer).content || 'T').split('\n')[0].slice(0, 6), TW / 2, TH / 2 - 3);
    url = c.toDataURL();
  }
  _thumbCache.set(L.id, { key, url });
  return url;
}

let _liveId = '';

function renderThumbs(): void {
  const box = $('thumbStrip');
  box.innerHTML = '';
  state.layers.forEach((L, i) => {
    const d = document.createElement('div');
    d.className = 'thumb' + (i === state.selected ? ' sel' : '') + (L.visible ? '' : ' off');
    d.dataset.id = String(L.id);
    d.title = `${L.name} (${L.type})`;
    d.innerHTML = `<img src="${thumbURL(L)}" alt=""><span class="tn">${i + 1} ${L.name}</span><i></i>`;
    d.onclick = () => selectLayer(i);
    box.appendChild(d);
  });
  _liveId = ''; updateThumbLive();
}

function updateThumbLive(): void {
  const rl = rollLayers();
  const live = rl.length > 1 ? String(rl[state.roll.cur % rl.length].id) : '';
  if (live === _liveId) return;
  _liveId = live;
  document.querySelectorAll('#thumbStrip .thumb').forEach(t => {
    (t as HTMLElement).classList.toggle('live', t.getAttribute('data-id') === live);
  });
}

function selectLayer(i: number): void {
  const L = state.layers[i];
  if (!L) return;
  state.selected = i;
  if (L.type === 'image' && L.inRoll && L.visible) {
    const k = rollLayers().indexOf(L as ImageLayer);
    if (k >= 0) { state.roll.cur = k; resetTimeline(true); }
  }
  renderLayerList(); renderLayerProps(); updateInRollToggle();
}

function renderLayerList(): void {
  const box = $('layerList');
  box.innerHTML = '';
  state.layers.forEach((L, i) => {
    const el = document.createElement('div');
    el.className = 'layer' + (i === state.selected ? ' sel' : '') + ((L as ImageLayer)._broken ? ' broken' : '');
    el.innerHTML = `<span class="eye${L.visible ? ' on' : ''}">${L.visible ? '◉' : '○'}</span>
      <span class="nm">${(L as ImageLayer)._broken ? '⚠ ' : ''}${L.name}${L.inRoll ? ' ⇄' : ''}</span>
      <span class="tp">${L.type.slice(0, 3).toUpperCase()}</span>`;
    (el.querySelector('.eye') as HTMLElement).onclick = e => {
      e.stopPropagation();
      L.visible = !L.visible;
      renderLayerList();
    };
    el.onclick = () => selectLayer(i);
    box.appendChild(el);
  });
  updateInRollToggle();
  renderThumbs();
}

function updateInRollToggle(): void {
  const L = selLayer();
  const t = $('tInRoll');
  if (!L) { t.dataset.on = '0'; t.classList.remove('on'); return; }
  const on = L.inRoll ? '1' : '0';
  t.dataset.on = on;
  t.classList.toggle('on', on === '1');
}

// ═════════════════════════════════════════════════════════════════════
// MODE BUTTONS
// ═════════════════════════════════════════════════════════════════════

function syncModeBtns(): void {
  const L = selLayer() as ImageLayer | null;
  const img = !!L && L.type === 'image';
  $('btnModeGlyph').classList.toggle('active', !!img && L!.mode === 'glyph');
  $('btnModePixel').classList.toggle('active', !!img && L!.mode === 'pixel');
  $('btnModeImage').classList.toggle('active', !!img && L!.mode === 'image');
  ($('btnModeGlyph') as HTMLElement).style.opacity =
    ($('btnModePixel') as HTMLElement).style.opacity =
    ($('btnModeImage') as HTMLElement).style.opacity = img ? '' : '.25';
}

function setLayerMode(m: string, all: boolean): void {
  const tgt = all
    ? state.layers.filter(l => l.type === 'image')
    : [selLayer()].filter(l => l && l.type === 'image');
  if (!tgt.length) { setStatus('SELECT AN IMAGE LAYER FIRST'); return; }
  (tgt as ImageLayer[]).forEach(l => l.mode = m as any);
  renderLayerProps();
  setStatus((all ? 'ALL IMAGE LAYERS' : 'LAYER') + ' → ' + (m === 'pixel' ? 'PIXEL ART' : m === 'image' ? 'PLAIN IMAGE' : 'ASCII'));
}

($('btnModeGlyph') as HTMLElement).onclick = (e: MouseEvent) => setLayerMode('glyph', e.shiftKey);
($('btnModePixel') as HTMLElement).onclick = (e: MouseEvent) => setLayerMode('pixel', e.shiftKey);
($('btnModeImage') as HTMLElement).onclick = (e: MouseEvent) => setLayerMode('image', e.shiftKey);

// ═════════════════════════════════════════════════════════════════════
// LAYER PROPERTIES PANEL
// ═════════════════════════════════════════════════════════════════════

function syncGlitchUI(): void {
  const L = selLayer();
  if (!L) { fixLayer(L as any, state.glitch as any); }
  const g = L ? L.gl : null;
  ($('glLayerName') as HTMLElement).textContent = L ? L.name : '(no layer selected)';
  if (!g) return;
  [['gAmt', 'gAmtVal', 'amt'], ['gSpd', 'gSpdVal', 'spd'], ['gFreq', 'gFreqVal', 'freq']].forEach(([id, out, k]) => {
    ($(id) as HTMLInputElement).value = String((g as any)[k]);
    ($(out) as HTMLElement).textContent = String((g as any)[k]);
  });
  document.querySelectorAll('.tog[data-fx]').forEach(t => {
    const fk = (t as HTMLElement).dataset.fx!;
    const v = fk && (g as any).fx[fk] ? '1' : '0';
    (t as HTMLElement).dataset.on = v;
    (t as HTMLElement).classList.toggle('on', v === '1');
  });
  document.querySelectorAll('.tog[data-pg]').forEach(t => {
    const v = (g as any).pg.on.includes((t as HTMLElement).dataset.pg) ? '1' : '0';
    (t as HTMLElement).dataset.on = v;
    (t as HTMLElement).classList.toggle('on', v === '1');
  });
  ($('tPgStatic') as HTMLElement).dataset.on = g.pg.st ? '1' : '0';
  $('tPgStatic').classList.toggle('on', !!g.pg.st);
  ($('pgAmt') as HTMLInputElement).value = String(g.pg.amt);
  ($('pgAmtVal') as HTMLElement).textContent = String(g.pg.amt);
  ($('pgSeed') as HTMLInputElement).value = String(g.pg.seed);
  ($('pgSeedVal') as HTMLElement).textContent = String(g.pg.seed);
  $('ordAfter').classList.toggle('pri', !g.before);
  $('ordBefore').classList.toggle('pri', !!g.before);
  ($('tLayerGl') as HTMLElement).dataset.on = g.on ? '1' : '0';
  $('tLayerGl').classList.toggle('on', !!g.on);
  ($('gStreakCol') as HTMLSelectElement).value = g.streakCol || 'analog';
}

function renderLayerProps(): void {
  const box = $('layerProps');
  box.innerHTML = '';
  const L = selLayer();
  syncModeBtns();
  syncGlitchUI();
  if (!L) { box.innerHTML = '<span class="slabel">NO LAYER SELECTED</span>'; return; }

  const label = (s: string) => { const e = document.createElement('span'); e.className = 'slabel'; e.textContent = ':: ' + s; box.appendChild(e); };
  const row = (lbl: string, html: string) => {
    const d = document.createElement('div'); d.className = 'ctrl';
    d.innerHTML = `<div class="ch">${lbl}</div>${html}`;
    box.appendChild(d); return d;
  };
  const tog = (lbl: string, val: boolean, cb: () => void) => {
    const d = document.createElement('div'); d.className = 'tr';
    d.innerHTML = `<span class="tl">${lbl}</span><div class="tog${val ? ' on' : ''}"></div>`;
    (d.querySelector('.tog') as HTMLElement).onclick = cb; box.appendChild(d);
  };

  const nameRow = row('NAME', `<input type="text" value="${L.name.replace(/"/g, '&quot;')}">`);
  (nameRow.querySelector('input') as HTMLInputElement).oninput = e => { L.name = (e.target as HTMLInputElement).value; renderLayerList(); };

  label(L.name);

  const opRow = row(`OPACITY <span>${Math.round(L.opacity * 100)}%</span>`, `<input type="range" min="0" max="100" value="${Math.round(L.opacity * 100)}">`);
  (opRow.querySelector('input') as HTMLInputElement).oninput = e => { L.opacity = +(e.target as HTMLInputElement).value / 100; (opRow.querySelector('span') as HTMLElement).textContent = (e.target as HTMLInputElement).value + '%'; };

  const bl = row('BLEND', `<select>
    <option value="source-over">NORMAL</option><option value="lighter">ADD</option>
    <option value="screen">SCREEN</option><option value="multiply">MULTIPLY</option>
    <option value="overlay">OVERLAY</option><option value="difference">DIFFERENCE</option>
  </select>`);
  (bl.querySelector('select') as HTMLSelectElement).value = L.blend;
  (bl.querySelector('select') as HTMLSelectElement).onchange = e => { L.blend = (e.target as HTMLSelectElement).value as GlobalCompositeOperation; };

  if (L.type === 'image') {
    const md = row('MODE', `<select><option value="glyph">GLYPH</option><option value="pixel">PIXEL</option><option value="image">IMAGE (plain picture)</option></select>`);
    (md.querySelector('select') as HTMLSelectElement).value = L.mode;
    (md.querySelector('select') as HTMLSelectElement).onchange = e => { L.mode = (e.target as HTMLSelectElement).value as any; renderLayerProps(); };

    if (L.mode === 'glyph') {
      const g = L.glyphCfg;
      const r1 = row(`COLS <span>${g.cols}</span>`, `<input type="range" min="20" max="400" value="${g.cols}">`);
      (r1.querySelector('input') as HTMLInputElement).oninput = e => { g.cols = +(e.target as HTMLInputElement).value; (r1.querySelector('span') as HTMLElement).textContent = String(g.cols); };
      const cs = row('CHARSET', `<select>${CHARSETS.map((c, i) => `<option value="${i}">${CHARSET_NAMES[i] || ('SET ' + i)}</option>`).join('')}</select>`);
      (cs.querySelector('select') as HTMLSelectElement).value = String(g.charset);
      (cs.querySelector('select') as HTMLSelectElement).onchange = e => { g.charset = +(e.target as HTMLSelectElement).value; };
      const col = row('COLOR', `<div class="cbtn-grid">${colorBtns(g.color)}</div>`);
      col.querySelectorAll('.cbtn').forEach(b => (b as HTMLElement).onclick = () => { g.color = (b as HTMLElement).dataset.c!; renderLayerProps(); });
      const gl = row(`GLOW <span>${g.glow}</span>`, `<input type="range" min="0" max="30" value="${g.glow}">`);
      (gl.querySelector('input') as HTMLInputElement).oninput = e => { g.glow = +(e.target as HTMLInputElement).value; (gl.querySelector('span') as HTMLElement).textContent = String(g.glow); };
      const sp = row(`SPREAD <span>${g.spread.toFixed(1)}</span>`, `<input type="range" min="0" max="40" value="${Math.round(g.spread * 10)}">`);
      (sp.querySelector('input') as HTMLInputElement).oninput = e => { g.spread = +(e.target as HTMLInputElement).value / 10; (sp.querySelector('span') as HTMLElement).textContent = g.spread.toFixed(1); };
      const ct = row(`CONTRAST <span>${(g.contrast / 10).toFixed(1)}</span>`, `<input type="range" min="1" max="60" value="${g.contrast}">`);
      (ct.querySelector('input') as HTMLInputElement).oninput = e => { g.contrast = +(e.target as HTMLInputElement).value; (ct.querySelector('span') as HTMLElement).textContent = (g.contrast / 10).toFixed(1); };
      const br = row(`BRIGHT <span>${g.brightness}</span>`, `<input type="range" min="-100" max="100" value="${g.brightness}">`);
      (br.querySelector('input') as HTMLInputElement).oninput = e => { g.brightness = +(e.target as HTMLInputElement).value; (br.querySelector('span') as HTMLElement).textContent = String(g.brightness); };
      tog('COLOR FROM IMAGE', !!g.colorFromImage, () => { g.colorFromImage = g.colorFromImage ? 0 : 1; renderLayerProps(); });
      tog('EDGE DETECT', !!g.edge, () => { g.edge = g.edge ? 0 : 1; renderLayerProps(); });
      tog('DITHER', !!g.dither, () => { g.dither = g.dither ? 0 : 1; renderLayerProps(); });
      tog('INVERT', !!g.invert, () => { g.invert = g.invert ? 0 : 1; renderLayerProps(); });
      tog('MIRROR', !!g.mirror, () => { g.mirror = g.mirror ? 0 : 1; renderLayerProps(); });
    } else if (L.mode === 'pixel') {
      const p = L.pixelCfg;
      const r1 = row(`BLOCK <span>${p.block}px</span>`, `<input type="range" min="2" max="64" value="${p.block}">`);
      (r1.querySelector('input') as HTMLInputElement).oninput = e => { p.block = +(e.target as HTMLInputElement).value; (r1.querySelector('span') as HTMLElement).textContent = p.block + 'px'; };
      const pl = row('PALETTE', `<select><option value="full">FULL COLOR</option><option value="auto32">AUTO 32</option><option value="auto16">AUTO 16</option><option value="auto8">AUTO 8</option><option value="auto4">AUTO 4</option><option value="gameboy">GAME BOY</option><option value="mono">MONO 6-STEP</option><option value="crt">CRT GREEN</option><option value="amber">AMBER</option><option value="nes">NES</option><option value="c64">C64</option><option value="pico8">PICO-8</option><option value="cga">CGA</option><option value="vboy">VIRTUAL BOY</option><option value="vapor">VAPORWAVE</option><option value="cyber">CYBER BLUE</option><option value="sepia">SEPIA</option><option value="ice">ICE</option></select>`);
      (pl.querySelector('select') as HTMLSelectElement).value = p.palette;
      (pl.querySelector('select') as HTMLSelectElement).onchange = e => { p.palette = (e.target as HTMLSelectElement).value; };
      const pc = row(`CONTRAST <span>${(p.contrast / 10).toFixed(1)}</span>`, `<input type="range" min="1" max="40" value="${p.contrast}">`);
      (pc.querySelector('input') as HTMLInputElement).oninput = e => { p.contrast = +(e.target as HTMLInputElement).value; (pc.querySelector('span') as HTMLElement).textContent = (p.contrast / 10).toFixed(1); };
      const pb = row(`BRIGHTNESS <span>${p.brightness}</span>`, `<input type="range" min="-100" max="100" value="${p.brightness}">`);
      (pb.querySelector('input') as HTMLInputElement).oninput = e => { p.brightness = +(e.target as HTMLInputElement).value; (pb.querySelector('span') as HTMLElement).textContent = String(p.brightness); };
      const ps = row(`SATURATION <span>${(p.sat / 10).toFixed(1)}</span>`, `<input type="range" min="0" max="30" value="${p.sat}">`);
      (ps.querySelector('input') as HTMLInputElement).oninput = e => { p.sat = +(e.target as HTMLInputElement).value; (ps.querySelector('span') as HTMLElement).textContent = (p.sat / 10).toFixed(1); };
      tog('DITHER', !!p.dither, () => { p.dither = p.dither ? 0 : 1; renderLayerProps(); });
      tog('OUTLINE', !!p.edge, () => { p.edge = p.edge ? 0 : 1; renderLayerProps(); });
      tog('GRID', !!p.grid, () => { p.grid = p.grid ? 0 : 1; renderLayerProps(); });
      tog('SCANLINES', !!p.scan, () => { p.scan = p.scan ? 0 : 1; renderLayerProps(); });
      tog('NOISE', !!p.noise, () => { p.noise = p.noise ? 0 : 1; renderLayerProps(); });
      tog('HARD LIGHT', L.light.on, () => { L.light.on = !L.light.on; renderLayerProps(); });
      if (L.light.on) {
        const pk = row('', `<button class="abtn" style="width:100%">▶ PIXEL STENCIL (stencil preset)</button>`);
        (pk.querySelector('button') as HTMLElement).onclick = () => { Object.assign(L.light, LIGHT_PRESETS.stencil, { on: true }); renderLayerProps(); setStatus('PIXEL STENCIL APPLIED'); };
        row('', '<div class="hint">In PIXEL mode HARD LIGHT works on the pixel grid itself: each block becomes one flat tone (shadow black / a few greys), then the PALETTE is applied.</div>');
      }
    } else {
      row('', '<div class="hint">Plain picture, no glyphs or pixels. Use HARD LIGHT below for the crushed-shadow look.</div>');
    }
  } else if (L.type === 'text') {
    const ta = row('TEXT', `<textarea>${L.content.replace(/</g, '&lt;')}</textarea>`);
    (ta.querySelector('textarea') as HTMLTextAreaElement).oninput = e => { L.content = (e.target as HTMLInputElement).value; };
    const sz = row(`SIZE <span>${L.size}px</span>`, `<input type="range" min="8" max="200" value="${L.size}">`);
    (sz.querySelector('input') as HTMLInputElement).oninput = e => { L.size = +(e.target as HTMLInputElement).value; (sz.querySelector('span') as HTMLElement).textContent = L.size + 'px'; };
    const xr = row(`X <span>${Math.round(L.x * 100)}%</span>`, `<input type="range" min="0" max="100" value="${Math.round(L.x * 100)}">`);
    (xr.querySelector('input') as HTMLInputElement).oninput = e => { L.x = +(e.target as HTMLInputElement).value / 100; (xr.querySelector('span') as HTMLElement).textContent = (e.target as HTMLInputElement).value + '%'; };
    const yr = row(`Y <span>${Math.round(L.y * 100)}%</span>`, `<input type="range" min="0" max="100" value="${Math.round(L.y * 100)}">`);
    (yr.querySelector('input') as HTMLInputElement).oninput = e => { L.y = +(e.target as HTMLInputElement).value / 100; (yr.querySelector('span') as HTMLElement).textContent = (e.target as HTMLInputElement).value + '%'; };
    const al = row('ALIGN', `<select><option value="left">LEFT</option><option value="center">CENTER</option><option value="right">RIGHT</option></select>`);
    (al.querySelector('select') as HTMLSelectElement).value = L.align;
    (al.querySelector('select') as HTMLSelectElement).onchange = e => { L.align = (e.target as HTMLSelectElement).value as any; };
    const gw = row(`GLOW <span>${L.glow ?? 10}</span>`, `<input type="range" min="0" max="40" value="${L.glow ?? 10}">`);
    (gw.querySelector('input') as HTMLInputElement).oninput = e => { L.glow = +(e.target as HTMLInputElement).value; (gw.querySelector('span') as HTMLElement).textContent = String(L.glow); };
    const tk = row(`LETTER SPACING <span>${L.track || 0}px</span>`, `<input type="range" min="-6" max="60" value="${L.track || 0}">`);
    (tk.querySelector('input') as HTMLInputElement).oninput = e => { L.track = +(e.target as HTMLInputElement).value; (tk.querySelector('span') as HTMLElement).textContent = L.track + 'px'; };
    const col = row('COLOR', `<div class="cbtn-grid">${colorBtns(L.color)}</div>`);
    col.querySelectorAll('.cbtn').forEach(b => (b as HTMLElement).onclick = () => { L.color = (b as HTMLElement).dataset.c!; renderLayerProps(); });

    label('ANIMATION');
    L.anim = normAnim(L.anim);
    const A = L.anim;
    const rp = () => replayAnim();
    const ak = row('EFFECT', `<select>
      <option value="none">NONE (static)</option><option value="fade">FADE IN</option><option value="typewriter">TYPEWRITER</option>
      <option value="decode">DECODE (scramble → text)</option><option value="scanreveal">SCAN REVEAL ↓</option><option value="wipe">WIPE →</option>
      <option value="glitchin">GLITCH IN</option><option value="scatter">SCATTER</option><option value="slide">SLIDE UP</option>
      <option value="zoom">ZOOM IN</option><option value="flicker">NEON FLICKER</option></select>`);
    (ak.querySelector('select') as HTMLSelectElement).value = A.kind;
    (ak.querySelector('select') as HTMLSelectElement).onchange = e => { A.kind = (e.target as HTMLSelectElement).value; renderLayerProps(); rp(); };
    const un = row('REVEAL BY', `<select><option value="char">CHARACTER</option><option value="word">WORD</option><option value="line">LINE</option></select>`);
    (un.querySelector('select') as HTMLSelectElement).value = A.unit;
    (un.querySelector('select') as HTMLSelectElement).onchange = e => { A.unit = (e.target as HTMLSelectElement).value; rp(); };
    const od = row('ORDER', `<select><option value="forward">FORWARD</option><option value="reverse">REVERSE</option><option value="center">CENTER OUT</option><option value="edges">EDGES IN</option><option value="random">RANDOM</option></select>`);
    (od.querySelector('select') as HTMLSelectElement).value = A.order;
    (od.querySelector('select') as HTMLSelectElement).onchange = e => { A.order = (e.target as HTMLSelectElement).value; rp(); };
    if (A.kind !== 'typewriter' && A.kind !== 'scanreveal' && A.kind !== 'wipe' && A.kind !== 'none') {
      const sf = row(`SOFTNESS <span>${Math.round(A.soft * 100)}%</span>`, `<input type="range" min="0" max="100" value="${Math.round(A.soft * 100)}">`);
      (sf.querySelector('input') as HTMLInputElement).oninput = e => { A.soft = +(e.target as HTMLInputElement).value / 100; (sf.querySelector('span') as HTMLElement).textContent = (e.target as HTMLInputElement).value + '%'; rp(); };
    }
    const perCh = () => A.kind === 'typewriter' ? ` · ${Math.round(A.dur / Math.max(1, L.content.replace(/\s/g, '').length))}ms/char` : '';
    const du = row(`DURATION <span>${A.dur}ms${perCh()}</span>`, `<input type="range" min="200" max="20000" step="100" value="${A.dur}">`);
    (du.querySelector('input') as HTMLInputElement).oninput = e => { A.dur = +(e.target as HTMLInputElement).value; (du.querySelector('span') as HTMLElement).textContent = A.dur + 'ms' + perCh(); rp(); };
    const de = row(`START DELAY <span>${A.delay}ms</span>`, `<input type="range" min="0" max="5000" step="50" value="${A.delay}">`);
    (de.querySelector('input') as HTMLInputElement).oninput = e => { A.delay = +(e.target as HTMLInputElement).value; (de.querySelector('span') as HTMLElement).textContent = A.delay + 'ms'; rp(); };
    const ea = row('EASE', `<select><option value="linear">LINEAR</option><option value="in">EASE IN</option><option value="out">EASE OUT</option><option value="inout">IN-OUT</option></select>`);
    (ea.querySelector('select') as HTMLSelectElement).value = A.ease;
    (ea.querySelector('select') as HTMLSelectElement).onchange = e => { A.ease = (e.target as HTMLSelectElement).value; rp(); };
    tog('LOOP  (in → hold → out → again)', A.loop, () => { A.loop = !A.loop; renderLayerProps(); rp(); });
    if (A.loop) {
      const ho = row(`HOLD (text stays) <span>${(A.hold / 1000).toFixed(1)}s</span>`, `<input type="range" min="0" max="20000" step="100" value="${A.hold}">`);
      (ho.querySelector('input') as HTMLInputElement).oninput = e => { A.hold = +(e.target as HTMLInputElement).value; (ho.querySelector('span') as HTMLElement).textContent = (A.hold / 1000).toFixed(1) + 's'; rp(); };
      const ok = row('THEN', `<select><option value="reverse">PLAY OUT BACKWARDS (backspace)</option><option value="fade">FADE OUT</option><option value="cut">CUT TO NOTHING</option></select>`);
      (ok.querySelector('select') as HTMLSelectElement).value = A.outKind;
      (ok.querySelector('select') as HTMLSelectElement).onchange = e => { A.outKind = (e.target as HTMLSelectElement).value; renderLayerProps(); rp(); };
      if (A.outKind !== 'cut') {
        const odur = row(`OUT DURATION <span>${A.outDur}ms</span>`, `<input type="range" min="100" max="10000" step="100" value="${A.outDur}">`);
        (odur.querySelector('input') as HTMLInputElement).oninput = e => { A.outDur = +(e.target as HTMLInputElement).value; (odur.querySelector('span') as HTMLElement).textContent = A.outDur + 'ms'; rp(); };
      }
      const gp = row(`EMPTY PAUSE <span>${(A.gap / 1000).toFixed(1)}s</span>`, `<input type="range" min="0" max="8000" step="100" value="${A.gap}">`);
      (gp.querySelector('input') as HTMLInputElement).oninput = e => { A.gap = +(e.target as HTMLInputElement).value; (gp.querySelector('span') as HTMLElement).textContent = (A.gap / 1000).toFixed(1) + 's'; rp(); };
      const lp = row(`REPEATS <span>${A.loops || '∞'}</span>`, `<input type="range" min="0" max="20" value="${A.loops}">`);
      (lp.querySelector('input') as HTMLInputElement).oninput = e => { A.loops = +(e.target as HTMLInputElement).value; (lp.querySelector('span') as HTMLElement).textContent = String(A.loops || '∞'); rp(); };
    }
    if (A.kind === 'typewriter' || A.kind === 'decode') {
      const cu = row('CURSOR', `<select><option value="off">OFF</option><option value="block">█ BLOCK</option><option value="bar">▏BAR</option><option value="under">_ UNDERLINE</option></select>`);
      (cu.querySelector('select') as HTMLSelectElement).value = A.cursor;
      (cu.querySelector('select') as HTMLSelectElement).onchange = e => { A.cursor = (e.target as HTMLSelectElement).value; rp(); };
    }
    const bt = row('', `<div class="seg"><button class="abtn">↻ REPLAY</button><button class="abtn">⤮ NEW RANDOM</button></div>`);
    const bb = bt.querySelectorAll('button');
    (bb[0] as HTMLElement).onclick = rp;
    (bb[1] as HTMLElement).onclick = () => { A.seed = (Math.random() * 1e6) | 0; rp(); };
  }

  // Light section (image layers)
  if (L.type === 'image') {
    const Lt = L.light;
    label('LIGHT (hard illumination)');
    tog('HARD LIGHT', Lt.on, () => { Lt.on = !Lt.on; renderLayerProps(); });
    if (Lt.on) {
      const sl = (name: string, key: string, min: number, max: number, unit = '') => {
        const r = row(`${name} <span>${(Lt as any)[key]}${unit}</span>`, `<input type="range" min="${min}" max="${max}" value="${(Lt as any)[key]}">`);
        (r.querySelector('input') as HTMLInputElement).oninput = e => { (Lt as any)[key] = +(e.target as HTMLInputElement).value; (r.querySelector('span') as HTMLElement).textContent = (Lt as any)[key] + unit; };
      };
      sl('SHADOW CUT', 'black', 0, 95, '%');
      sl('EDGE SOFTNESS', 'soft', 0, 50, '%');
      sl('LIGHT TONES', 'tones', 2, 8);
      sl('LIGHT CEILING', 'ceil', 15, 100, '%');
      sl('SHADING IN LIGHT', 'shade', 0, 100, '%');
      sl('DETAIL / TEXTURE', 'detail', 0, 100, '%');
      sl('CLEAN EDGES', 'clean', 0, 100, '%');
      sl('GRAIN', 'grain', 0, 100, '%');
      const pr = row('PRESET', `<div class="seg"><button class="abtn">STENCIL</button><button class="abtn">TEXTURED</button><button class="abtn">DEEP</button></div>`);
      const pb = pr.querySelectorAll('button');
      ['stencil', 'textured', 'deep'].forEach((k, i) => (pb[i] as HTMLElement).onclick = () => { Object.assign(Lt, LIGHT_PRESETS[k]); renderLayerProps(); });
      const rf = row('', `<button class="abtn" style="width:100%">▶ REFERENCE LOOK (plain image + stencil)</button>`);
      (rf.querySelector('button') as HTMLElement).onclick = () => { Object.assign(Lt, LIGHT_PRESETS.stencil, { on: true }); L.mode = 'image'; renderLayerProps(); setStatus('REFERENCE LOOK APPLIED'); };
      row('', '<div class="hint">Shadows are crushed to black, lit areas are flattened to a capped grey with a few tones, and local contrast keeps panel lines and surface detail.</div>');
    }
  }

  // Transition section
  if (L.type === 'image' && L.inRoll) {
    const T = L.trans;
    label('TRANSITION (this layer)');
    const ts = row('INTO THIS LAYER', `<select><option value="">GLOBAL DEFAULT</option>${[...($('rollStyle') as HTMLSelectElement).options].filter(o => !PASSIVE_STYLES.has(o.value)).map(o => `<option value="${o.value}">${o.textContent}</option>`).join('')}</select>`);
    (ts.querySelector('select') as HTMLSelectElement).value = T.style;
    (ts.querySelector('select') as HTMLSelectElement).onchange = e => { T.style = (e.target as HTMLSelectElement).value; };
    const td = row(`LENGTH <span>${T.dur ? T.dur + 'ms' : 'DEFAULT'}</span>`, `<input type="range" min="0" max="3000" step="50" value="${T.dur}">`);
    (td.querySelector('input') as HTMLInputElement).oninput = e => { T.dur = +(e.target as HTMLInputElement).value; (td.querySelector('span') as HTMLElement).textContent = T.dur ? T.dur + 'ms' : 'DEFAULT'; };
    const th = row(`STAYS ON SCREEN <span>${T.hold ? T.hold + 's' : 'DEFAULT'}</span>`, `<input type="range" min="0" max="30" value="${T.hold}">`);
    (th.querySelector('input') as HTMLInputElement).oninput = e => { T.hold = +(e.target as HTMLInputElement).value; (th.querySelector('span') as HTMLElement).textContent = T.hold ? T.hold + 's' : 'DEFAULT'; };
  }

  // Effects section
  label('EFFECTS (per-layer)');
  const fx = L.effects;
  const mkFxRow = (lbl: string, key: string, min: number, max: number, step: number, mult = 1, dec = 0) => {
    const r = row(`${lbl} <span>${(fx[key as keyof typeof fx] * mult).toFixed(dec)}</span>`, `<input type="range" min="${min * mult}" max="${max * mult}" step="${step * mult}" value="${fx[key as keyof typeof fx] * mult}">`);
    (r.querySelector('input') as HTMLInputElement).oninput = e => { (fx as any)[key] = +(e.target as HTMLInputElement).value / mult; (r.querySelector('span') as HTMLElement).textContent = ((fx as any)[key] * mult).toFixed(dec); };
  };
  mkFxRow('BLUR', 'blur', 0, 20, 0.5, 1, 1);
  mkFxRow('BRIGHTNESS', 'brightness', 0, 3, 0.05, 1, 2);
  mkFxRow('CONTRAST', 'contrast', 0, 3, 0.05, 1, 2);
  mkFxRow('SATURATE', 'saturate', 0, 3, 0.05, 1, 2);
  mkFxRow('HUE', 'hue', 0, 360, 1, 1, 0);
  mkFxRow('SEPIA', 'sepia', 0, 1, 0.05, 1, 2);
  mkFxRow('GRAYSCALE', 'grayscale', 0, 1, 0.05, 1, 2);
  mkFxRow('INVERT', 'invert', 0, 1, 0.05, 1, 2);
  mkFxRow('POSTERIZE', 'posterize', 0, 16, 1, 1, 0);
  mkFxRow('THRESHOLD', 'threshold', 0, 1, 0.02, 1, 2);
}

// ═════════════════════════════════════════════════════════════════════
// LAYER OPERATIONS
// ═════════════════════════════════════════════════════════════════════

function addImageFromFile(file: File): Promise<void> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = ev => {
      const i = new Image();
      i.onload = () => {
        const L = newImageLayer(i, file.name.replace(/\.[^.]+$/, ''));
        state.layers.push(L);
        selectLayer(state.layers.length - 1);
        res();
      };
      i.onerror = rej;
      i.src = ev.target!.result as string;
    };
    r.onerror = rej;
    r.readAsDataURL(file);
  });
}

($('btnAddImg') as HTMLElement).onclick = () => ($('fileImg') as HTMLElement).click();
($('fileImg') as HTMLInputElement).onchange = async (e: Event) => {
  const files = [...(e.target as HTMLInputElement).files!];
  for (const f of files) if (f.type.startsWith('image/')) await addImageFromFile(f);
  (e.target as HTMLInputElement).value = '';
};
($('btnAddTxt') as HTMLElement).onclick = () => {
  state.layers.push(newTextLayer('HELLO'));
  selectLayer(state.layers.length - 1);
};
($('btnLayerDel') as HTMLElement).onclick = () => {
  if (!state.layers.length) return;
  state.layers.splice(state.selected, 1);
  state.selected = Math.min(state.selected, state.layers.length - 1);
  renderLayerList(); renderLayerProps();
};
($('btnLayerUp') as HTMLElement).onclick = () => {
  const i = state.selected;
  if (i <= 0) return;
  [state.layers[i - 1], state.layers[i]] = [state.layers[i], state.layers[i - 1]];
  state.selected = i - 1; renderLayerList(); renderLayerProps();
};
($('btnLayerDn') as HTMLElement).onclick = () => {
  const i = state.selected;
  if (i < 0 || i >= state.layers.length - 1) return;
  [state.layers[i], state.layers[i + 1]] = [state.layers[i + 1], state.layers[i]];
  state.selected = i + 1; renderLayerList(); renderLayerProps();
};
($('tInRoll') as HTMLElement).onclick = () => {
  const L = selLayer() as ImageLayer | null;
  if (!L || L.type !== 'image') return;
  L.inRoll = !L.inRoll;
  updateInRollToggle();
  renderLayerList(); renderLayerProps();
};

// ═════════════════════════════════════════════════════════════════════
// GLITCH UI
// ═════════════════════════════════════════════════════════════════════

($('tGlitch') as HTMLElement).dataset.on = state.glitch.on ? '1' : '0';
$('tGlitch').classList.toggle('on', state.glitch.on);
($('tGlitch') as HTMLElement).onclick = () => {
  state.glitch.on = !state.glitch.on;
  ($('tGlitch') as HTMLElement).dataset.on = state.glitch.on ? '1' : '0';
  $('tGlitch').classList.toggle('on', state.glitch.on);
  setStatus(state.glitch.on ? 'GLITCH: LIVE' : 'GLITCH: OFF');
};

const GLm = () => { const L = selLayer(); if (!L) return null; fixLayer(L, state.glitch as any); return L.gl; };

($('tLayerGl') as HTMLElement).onclick = () => { const g = GLm(); if (!g) return; g.on = !g.on; syncGlitchUI(); };
[['gAmt', 'gAmtVal', 'amt'], ['gSpd', 'gSpdVal', 'spd'], ['gFreq', 'gFreqVal', 'freq']].forEach(([id, out, key]) => {
  ($(id) as HTMLInputElement).oninput = () => { const g = GLm(); if (!g) return; (g as any)[key] = +($(id) as HTMLInputElement).value; ($(out) as HTMLElement).textContent = String((g as any)[key]); };
});
document.querySelectorAll('.tog[data-fx]').forEach(t => (t as HTMLElement).onclick = () => { const g = GLm(); if (!g) return; const fk = (t as HTMLElement).dataset.fx!; if (!fk) return; (g as any).fx[fk] = (t as HTMLElement).dataset.on === '1' ? 0 : 1; syncGlitchUI(); });
($('ordAfter') as HTMLElement).onclick = () => { const g = GLm(); if (g) { g.before = false; syncGlitchUI(); } };
($('ordBefore') as HTMLElement).onclick = () => { const g = GLm(); if (g) { g.before = true; syncGlitchUI(); } };
document.querySelectorAll('.tog[data-pg]').forEach(t => (t as HTMLElement).onclick = () => {
  const g = GLm(); if (!g) return; const k = (t as HTMLElement).dataset.pg!;
  g.pg.on = g.pg.on.includes(k) ? g.pg.on.filter(x => x !== k) : [...g.pg.on, k]; syncGlitchUI();
});
($('tPgStatic') as HTMLElement).onclick = () => { const g = GLm(); if (!g) return; g.pg.st = !g.pg.st; syncGlitchUI(); };
($('pgAmt') as HTMLInputElement).oninput = () => { const g = GLm(); if (!g) return; g.pg.amt = +($('pgAmt') as HTMLInputElement).value; ($('pgAmtVal') as HTMLElement).textContent = String(g.pg.amt); };
($('pgSeed') as HTMLInputElement).oninput = () => { const g = GLm(); if (!g) return; g.pg.seed = +($('pgSeed') as HTMLInputElement).value; ($('pgSeedVal') as HTMLElement).textContent = String(g.pg.seed); };
($('gStreakCol') as HTMLSelectElement).onchange = () => { const g = GLm(); if (g) g.streakCol = ($('gStreakCol') as HTMLSelectElement).value as any; };
($('btnBreakup') as HTMLElement).onclick = () => {
  const g = GLm(); if (!g) return;
  (['rgb', 'slice', 'rowshift', 'block', 'noise', 'flick', 'wobble', 'hold', 'streak', 'bars', 'smear'] as const).forEach(k => { (g.fx as any)[k] = 1; });
  g.amt = 70; g.spd = 65; g.freq = 65; g.on = true; syncGlitchUI(); setStatus('PRESET: SIGNAL BREAKUP');
};
($('btnGlCopyAll') as HTMLElement).onclick = () => {
  const g = GLm(); if (!g) return; const c = JSON.stringify(g);
  state.layers.forEach(L => { if (L !== selLayer()) { (L as any).gl = JSON.parse(c); delete (L as any)._gs; } });
  setStatus('GLITCH SETTINGS COPIED TO ALL LAYERS');
};

// ═════════════════════════════════════════════════════════════════════
// ROLL UI
// ═════════════════════════════════════════════════════════════════════

($('rollStyle') as HTMLSelectElement).onchange = () => {
  state.roll.style = ($('rollStyle') as HTMLSelectElement).value;
  resetTimeline(true);
  setStatus('SWITCH STYLE: ' + ($('rollStyle') as HTMLSelectElement).selectedOptions[0].textContent);
};
const syncRollOn = () => { const on = state.roll.on !== false; ($('tRollOn') as HTMLElement).dataset.on = on ? '1' : '0'; $('tRollOn').classList.toggle('on', on); };
($('tRollOn') as HTMLElement).onclick = () => { state.roll.on = state.roll.on === false; syncRollOn(); setStatus(state.roll.on ? 'ROLL SWAP: ON' : 'ROLL SWAP: OFF'); };
syncRollOn();
($('rollEvery') as HTMLInputElement).oninput = () => { state.roll.every = +($('rollEvery') as HTMLInputElement).value; ($('rollEveryVal') as HTMLElement).textContent = String(state.roll.every); };
($('rollDur') as HTMLInputElement).oninput = () => { state.roll.dur = +($('rollDur') as HTMLInputElement).value; ($('rollDurVal') as HTMLElement).textContent = state.roll.dur ? state.roll.dur + 'ms' : 'AUTO'; };
($('btnRollNow') as HTMLElement).onclick = () => { startRollTransition(performance.now()); setStatus('SWITCH: ' + ($('rollStyle') as HTMLSelectElement).selectedOptions[0].textContent); };
($('btnRollReset') as HTMLElement).onclick = () => { state.roll.cur = 0; resetTimeline(true); setStatus('ROLL RESET'); };

// ═════════════════════════════════════════════════════════════════════
// UI COLOR / ZOOM / GLOW
// ═════════════════════════════════════════════════════════════════════

function setUiColor(c: string): void {
  document.documentElement.style.setProperty('--c', c);
  state.ui.color = c;
  document.querySelectorAll('.cbtn[data-ui]').forEach(b => (b as HTMLElement).classList.toggle('active', (b as HTMLElement).dataset.color === c));
}

(function() {
  const wrap = document.createElement('div');
  wrap.className = 'cbtn-grid'; wrap.style.marginTop = '8px';
  wrap.innerHTML = colorBtns('', 'data-ui="1"');
  wrap.querySelectorAll('.cbtn').forEach(b => (b as HTMLElement).onclick = () => setUiColor((b as HTMLElement).dataset.color!));
  ($('uiColorPanel') as HTMLElement).appendChild(wrap);
  setUiColor('#39ff14');
})();

let _uiZoom = 100;
function setUiZoom(z: number): void {
  _uiZoom = Math.max(80, Math.min(170, z));
  document.querySelectorAll('.left,.topbar,.right-bar,#thumbStrip,#viewSel').forEach(e => ((e as HTMLElement).style.zoom = String(_uiZoom / 100)));
  try { localStorage.setItem('glyphconv-uizoom', String(_uiZoom)); } catch {}
  setStatus('UI SIZE ' + _uiZoom + '%');
}
($('btnZoomDn') as HTMLElement).onclick = () => setUiZoom(_uiZoom - 10);
($('btnZoomUp') as HTMLElement).onclick = () => setUiZoom(_uiZoom + 10);
try { const z = +localStorage.getItem('glyphconv-uizoom')!; if (z) setUiZoom(z); } catch {}

($('uiGlow') as HTMLInputElement).oninput = () => {
  const v = +($('uiGlow') as HTMLInputElement).value / 100;
  document.documentElement.style.setProperty('--ug', String(v));
  ($('uiGlowVal') as HTMLElement).textContent = Math.round(v * 100) + '%';
};
($('btnSettings') as HTMLElement).onclick = (e: MouseEvent) => { e.stopPropagation(); ($('settingsPop') as HTMLElement).classList.toggle('open'); };
document.addEventListener('click', e => { if (!(e.target as HTMLElement).closest('#settingsPop')) ($('settingsPop') as HTMLElement).classList.remove('open'); });
($('btnSide') as HTMLElement).onclick = () => {
  const l = $('leftPanel');
  l.style.display = l.style.display === 'none' ? '' : 'none';
};

// ═════════════════════════════════════════════════════════════════════
// VIEW MODE BUTTONS
// ═════════════════════════════════════════════════════════════════════

document.querySelectorAll('#viewSel .abtn').forEach(b => (b as HTMLElement).onclick = () => {
  const v = (b as HTMLElement).dataset.v as 'combined' | 'solo';
  setViewMode(v);
  document.querySelectorAll('#viewSel .abtn').forEach(x => x.classList.toggle('pri', x === b));
  setStatus(v === 'solo' ? 'VIEW: SELECTED LAYER ONLY' : 'VIEW: COMBINED OUTPUT');
});

// ═════════════════════════════════════════════════════════════════════
// EXPORT UI
// ═════════════════════════════════════════════════════════════════════

function updAnimUi(): void {
  const f = ($('animFmt') as HTMLSelectElement).value, vid = f === 'webm';
  ($('rowFrames') as HTMLElement).style.display = vid ? 'none' : '';
  ($('rowSecs') as HTMLElement).style.display = vid ? '' : 'none';
  ($('rowBps') as HTMLElement).style.display = vid ? '' : 'none';
  ($('rowGifOpts') as HTMLElement).style.display = f === 'gif' ? '' : 'none';
}
($('animFmt') as HTMLSelectElement).onchange = updAnimUi; updAnimUi();
($('vidSecs') as HTMLInputElement).oninput = () => ($('vidSecsVal') as HTMLElement).textContent = ($('vidSecs') as HTMLInputElement).value;
($('vidBps') as HTMLInputElement).oninput = () => ($('vidBpsVal') as HTMLElement).textContent = (+(($('vidBps') as HTMLInputElement).value)).toFixed(1);
($('gifW') as HTMLInputElement).oninput = () => ($('gifWVal') as HTMLElement).textContent = ($('gifW') as HTMLInputElement).value;
($('gifFrames') as HTMLInputElement).oninput = () => ($('gifFramesVal') as HTMLElement).textContent = ($('gifFrames') as HTMLInputElement).value;
($('gifLossy') as HTMLInputElement).oninput = () => ($('gifLossyVal') as HTMLElement).textContent = String(+(($('gifLossy') as HTMLInputElement).value) || 'OFF');
($('exSwapAt') as HTMLInputElement).oninput = () => ($('exSwapAtVal') as HTMLElement).textContent = ($('exSwapAt') as HTMLInputElement).value;

($('btnExport') as HTMLElement).onclick = exportAnim;
($('btnAnim') as HTMLElement).onclick = () => exportAnim();
($('btnPng') as HTMLElement).onclick = savePng;
($('btnPng2') as HTMLElement).onclick = savePng;
($('btnTxt') as HTMLElement).onclick = () => {
  const L = state.layers.find(l => l.type === 'image' && l.mode === 'glyph') as ImageLayer | undefined;
  if (!L || !L._img) { setStatus('NO GLYPH LAYER'); return; }
  const s = buildAsciiString(L._img, L.glyphCfg);
  saveBlob(new Blob([s], { type: 'text/plain' }), 'txt', state.ui.outName || 'glitch-art');
};
($('btnCopy') as HTMLElement).onclick = () => {
  const L = state.layers.find(l => l.type === 'image' && l.mode === 'glyph') as ImageLayer | undefined;
  if (!L || !L._img) { setStatus('NO GLYPH LAYER'); return; }
  const s = buildAsciiString(L._img, L.glyphCfg);
  navigator.clipboard.writeText(s).then(() => setStatus('COPIED')).catch(() => setStatus('COPY FAILED'));
};
($('outName') as HTMLInputElement).oninput = () => { state.ui.outName = ($('outName') as HTMLInputElement).value; };

// ═════════════════════════════════════════════════════════════════════
// PROJECT SAVE/LOAD
// ═════════════════════════════════════════════════════════════════════

($('btnSaveProj') as HTMLElement).onclick = async () => {
  const blob = new Blob([JSON.stringify(serializeProject())], { type: 'application/json' });
  await saveBlob(blob, 'json', state.ui.outName || 'glitch-art');
  setStatus('PROJECT SAVED');
};
($('btnOpenProj') as HTMLElement).onclick = () => ($('projIn') as HTMLElement).click();
($('projIn') as HTMLInputElement).onchange = async (e: Event) => {
  const f = (e.target as HTMLInputElement).files![0];
  if (!f) return;
  try {
    const text = await f.text();
    const d = JSON.parse(text);
    await loadProject(d);
    resetTimeline(true);
    renderLayerList(); renderLayerProps();
    setStatus('PROJECT LOADED');
  } catch (err) {
    setStatus('LOAD ERROR: ' + (err as Error).message);
  }
  (e.target as HTMLInputElement).value = '';
};

// ═════════════════════════════════════════════════════════════════════
// INIT
// ═════════════════════════════════════════════════════════════════════

// Auto-collapse other accordion sections when one opens
document.querySelectorAll('details.sec').forEach(d => {
  d.addEventListener('toggle', () => {
    if ((d as HTMLDetailsElement).open) {
      document.querySelectorAll('details.sec').forEach(o => { if (o !== d) (o as HTMLDetailsElement).open = false; });
    }
  });
});

($('canvasAspect') as HTMLSelectElement).onchange = () => {
  state.canvas.aspect = ($('canvasAspect') as HTMLSelectElement).value;
  setStatus('CANVAS: ' + ($('canvasAspect') as HTMLSelectElement).selectedOptions[0].textContent);
};

// Sync export settings to timeline reset
['gifW', 'gifFrames', 'vidSecs', 'animFmt', 'exSwapAt', 'syncPrev'].forEach(id => {
  const e = $(id) as HTMLElement;
  e.addEventListener('input', () => resetTimeline(true));
  e.addEventListener('change', () => resetTimeline(true));
});

// Font loading: when the web font arrives, drop cached glyph buffers
if (document.fonts && document.fonts.load) {
  document.fonts.load('20px VT323').then(() => { resetFontRatio(); }).catch(() => {});
}

glitchNoise();
renderLayerList();
renderLayerProps();
resetTimeline(true);
tick();
setStatus('READY — ADD AN IMAGE TO BEGIN');
