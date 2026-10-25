import { useEffect } from 'react';
import type { ImageLayer } from '../engine/types';
import { state, selLayer } from '../engine/state/store';
import { $ } from '../engine/utils/canvas';
import { saveBlob } from '../engine/utils/file';
import { serializeProject, loadProject } from '../engine/state/project';
import { resetTimeline } from '../engine/render/timeline';
import { exportAnim, savePng } from '../engine/ui/export-anim';
import { setStatus } from '../ui/status';

// ═════════════════════════════════════════════════════════════════════
// TOP BAR — INVENTORY §1 (markup: index.html L12–27; handlers: main.ts)
// ═════════════════════════════════════════════════════════════════════

// ── MODE BUTTONS (main.ts L148–171, as-is) ──

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
  syncModeBtns(); // original: renderLayerProps() — which calls syncModeBtns() first; panel lands with §4
  setStatus((all ? 'ALL IMAGE LAYERS' : 'LAYER') + ' → ' + (m === 'pixel' ? 'PIXEL ART' : m === 'image' ? 'PLAIN IMAGE' : 'ASCII'));
}

// ── PROJECT SAVE/LOAD (main.ts L646–666, as-is) ──

async function onSave(): Promise<void> {
  const blob = new Blob([JSON.stringify(serializeProject())], { type: 'application/json' });
  await saveBlob(blob, 'json', state.ui.outName || 'glitch-art');
  setStatus('PROJECT SAVED');
}

function onOpen(): void {
  ($('projIn') as HTMLElement).click();
}

async function onProjFile(e: React.ChangeEvent<HTMLInputElement>): Promise<void> {
  const f = e.target.files![0];
  if (!f) return;
  try {
    const text = await f.text();
    const d = JSON.parse(text);
    await loadProject(d);
    resetTimeline(true);
    // renderLayerList(); renderLayerProps(); — land with §3/§4
    setStatus('PROJECT LOADED');
  } catch (err) {
    setStatus('LOAD ERROR: ' + (err as Error).message);
  }
  e.target.value = '';
}

// ── UI ZOOM (main.ts L571–580, as-is) ──

let _uiZoom = 100;
function setUiZoom(z: number): void {
  _uiZoom = Math.max(80, Math.min(170, z));
  document.querySelectorAll('.left,.topbar,.right-bar,#thumbStrip,#viewSel').forEach(e => ((e as HTMLElement).style.zoom = String(_uiZoom / 100)));
  try { localStorage.setItem('glyphconv-uizoom', String(_uiZoom)); } catch {}
  setStatus('UI SIZE ' + _uiZoom + '%');
}

// ── SIDE PANEL TOGGLE (main.ts L589–592, as-is) ──

function onSide(): void {
  const l = $('leftPanel')!;
  l.style.display = l.style.display === 'none' ? '' : 'none';
}

export default function TopBar() {
  useEffect(() => {
    // settings popup open/close (main.ts L587–588, as-is)
    const docClick = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest('#settingsPop')) ($('settingsPop') as HTMLElement).classList.remove('open');
    };
    document.addEventListener('click', docClick);
    // restore zoom (main.ts L580, as-is)
    try { const z = +localStorage.getItem('glyphconv-uizoom')!; if (z) setUiZoom(z); } catch {}
    return () => document.removeEventListener('click', docClick);
  }, []);

  // Markup copied as-is from index.html L12–27
  return (
    <div className="topbar">
      <button className="mode-btn" id="btnSide" style={{ borderLeft: 'none', opacity: .8 }} onClick={onSide}>◧</button>
      <span className="topbar-title">GLITCH ART CONVERTER v1.0</span>
      <button className="mode-btn active" id="btnModeGlyph" title="Selected image layer → ASCII glyphs (Shift = all image layers)" onClick={e => setLayerMode('glyph', e.shiftKey)}>ASCII</button>
      <button className="mode-btn" id="btnModePixel" title="Selected image layer → pixel art (Shift = all image layers)" onClick={e => setLayerMode('pixel', e.shiftKey)}>PIXEL ART</button>
      <button className="mode-btn" id="btnModeImage" title="Selected image layer → plain picture (Shift = all image layers)" onClick={e => setLayerMode('image', e.shiftKey)}>IMAGE</button>
      <button className="mode-btn" id="btnSaveProj" onClick={() => { void onSave(); }}>SAVE</button>
      <button className="mode-btn" id="btnOpenProj" onClick={onOpen}>OPEN</button>
      <input type="file" id="projIn" accept=".json,.gz" style={{ display: 'none' }} onChange={e => { void onProjFile(e); }} />
      <button className="mode-btn" id="btnPng" onClick={() => savePng()}>PNG</button>
      <button className="mode-btn" id="btnAnim" onClick={() => { void exportAnim(); }}>EXPORT</button>
      <button className="mode-btn active" id="btnGlitchQ">◉ GLITCH</button>
      <button className="mode-btn" id="btnZoomDn" title="Smaller interface" onClick={() => setUiZoom(_uiZoom - 10)}>A−</button>
      <button className="mode-btn" id="btnZoomUp" title="Bigger interface" onClick={() => setUiZoom(_uiZoom + 10)}>A+</button>
      <button className="mode-btn" id="btnSettings" onClick={e => { e.stopPropagation(); ($('settingsPop') as HTMLElement).classList.toggle('open'); }}>⚙ UI</button>
    </div>
  );
}
