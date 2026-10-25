import type { AppState, Layer, ImageLayer } from '../types';
import { state, newImageLayer, newTextLayer } from './store';
import { fixLayer, fillDefaults, defaultLight, normAnim } from './defaults';
import { $ } from '../utils/canvas';

// ═════════════════════════════════════════════════════════════════════
// PROJECT SAVE / LOAD — serialise state to JSON and back
// ═════════════════════════════════════════════════════════════════════

interface SerializedProject {
  app: string;
  v: number;
  ui: AppState['ui'];
  canvas: AppState['canvas'];
  glitch: Partial<AppState['glitch']>;
  roll: { on: boolean; style: string; every: number; dur: number };
  layers: Record<string, unknown>[];
  selected: number;
}

export function serializeProject(): SerializedProject {
  return {
    app: 'glitch-art-v1', v: 1,
    ui: state.ui,
    canvas: state.canvas,
    glitch: { ...state.glitch },
    roll: { on: state.roll.on !== false, style: state.roll.style, every: state.roll.every, dur: state.roll.dur },
    layers: state.layers.map(L => {
      const o = { ...L } as Record<string, unknown>;
      delete o._img; delete o._gs; delete o._lightCv; delete o._lightKey;
      return o;
    }),
    selected: state.selected,
  };
}

export async function loadProject(d: SerializedProject): Promise<void> {
  state.layers = [];
  state.selected = 0;

  for (const o of d.layers) {
    const L = { ...o } as unknown as Layer;
    if (L.type === 'image' && (o as Record<string, unknown>).src) {
      try {
        (L as ImageLayer)._img = await new Promise<HTMLImageElement>((res, rej) => {
          const i = new Image();
          i.onload = () => res(i);
          i.onerror = () => rej(new Error(L.name || 'image'));
          i.src = (L as ImageLayer).src;
        });
      } catch {
        (L as ImageLayer)._img = null;
        (L as ImageLayer)._broken = true;
      }
    }
    state.layers.push(L);
  }

  state.selected = d.selected || 0;
  if (d.ui) { state.ui = d.ui; ($('outName') as HTMLInputElement).value = d.ui.outName || 'glitch-art'; }
  if (d.canvas) { state.canvas = { ...state.canvas, ...d.canvas }; ($('canvasAspect') as HTMLSelectElement).value = state.canvas.aspect; }
  if (d.glitch) {
    state.glitch = { ...state.glitch, ...d.glitch };
    const tg = $('tGlitch') as HTMLElement;
    tg.dataset.on = state.glitch.on ? '1' : '0';
    tg.classList.toggle('on', state.glitch.on);
  }
  if (d.roll) {
    state.roll.style = d.roll.style;
    ($('rollStyle') as HTMLSelectElement).value = d.roll.style;
    state.roll.every = d.roll.every;
    ($('rollEvery') as HTMLInputElement).value = String(d.roll.every);
    ($('rollEveryVal') as HTMLElement).textContent = String(d.roll.every);
    state.roll.dur = d.roll.dur;
    ($('rollDur') as HTMLInputElement).value = String(d.roll.dur);
    ($('rollDurVal') as HTMLElement).textContent = d.roll.dur ? d.roll.dur + 'ms' : 'AUTO';
    state.roll.on = d.roll.on !== false;
  }

  state.layers.forEach(L => fixLayer(L, state.glitch as any));
  state.roll.cur = 0;
}
