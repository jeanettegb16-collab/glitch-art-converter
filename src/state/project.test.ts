import { describe, it, expect } from 'vitest';
import { serializeProject } from './project';
import { fixLayer, defaultGl } from './defaults';
import { state, newImageLayer, newTextLayer, uid } from './store';

// Note: loadProject has DOM dependencies (updates UI elements on load) so we test
// the pure serialization round-trip here and the legacy migration logic via fixLayer.

describe('serializeProject', () => {
  it('strips canvas-only properties from layers', () => {
    // Create a mock image layer by temporarily pushing one
    const origLayers = [...state.layers];
    const origSelected = state.selected;
    const fakeImg = { src: 'data:image/png;base64,test', naturalWidth: 100, naturalHeight: 100 } as HTMLImageElement;
    const layer = newImageLayer(fakeImg, 'test-img');
    state.layers.push(layer);
    state.selected = state.layers.length - 1;

    const serialized = serializeProject();

    // Verify no canvas-only props leaked through
    for (const l of serialized.layers) {
      expect(l).not.toHaveProperty('_img');
      expect(l).not.toHaveProperty('_gs');
      expect(l).not.toHaveProperty('_lightCv');
      expect(l).not.toHaveProperty('_lightKey');
    }

    // Verify top-level structure
    expect(serialized.app).toBe('glitch-art-v1');
    expect(serialized.v).toBe(1);
    expect(serialized.selected).toBe(state.selected);
    expect(serialized.ui.color).toBe('#39ff14');
    expect(serialized.roll.style).toBe('burst');

    // Restore state
    state.layers = origLayers;
    state.selected = origSelected;
  });

  it('preserves all layer config values through serialization', () => {
    const origLayers = [...state.layers];
    const origSelected = state.selected;

    const fakeImg = { src: 'data:image/png;base64,test', naturalWidth: 200, naturalHeight: 150 } as HTMLImageElement;
    const imgLayer = newImageLayer(fakeImg, 'my-image');
    // Override some config values to verify they survive serialization
    (imgLayer as any).glyphCfg.cols = 200;
    (imgLayer as any).pixelCfg.block = 16;
    (imgLayer as any).opacity = 0.75;
    state.layers.push(imgLayer);

    const textLayer = newTextLayer('HELLO WORLD');
    (textLayer as any).anim.kind = 'typewriter';
    (textLayer as any).anim.dur = 3000;
    state.layers.push(textLayer);

    state.selected = 0;
    const serialized = serializeProject();

    // Verify image layer config preserved
    expect(serialized.layers[0].name).toBe('my-image');
    expect(serialized.layers[0].mode).toBe('glyph');
    expect(serialized.layers[0].opacity).toBe(0.75);
    expect((serialized.layers[0] as any).glyphCfg.cols).toBe(200);
    expect((serialized.layers[0] as any).pixelCfg.block).toBe(16);

    // Verify text layer config preserved
    expect(serialized.layers[1].type).toBe('text');
    expect(serialized.layers[1].content).toBe('HELLO WORLD');
    expect((serialized.layers[1] as any).anim.kind).toBe('typewriter');
    expect((serialized.layers[1] as any).anim.dur).toBe(3000);

    // Restore state
    state.layers = origLayers;
    state.selected = origSelected;
  });
});

describe('legacy v10 migration via fixLayer', () => {
  it('populates per-layer glitch from global glitch when layer has no gl field', () => {
    const legacyLayer = {
      id: 1, type: 'image' as const, name: 'old-layer', visible: true, opacity: 1,
      blend: 'source-over' as const, inRoll: true, mode: 'glyph' as const,
      light: { on: false, black: 40, soft: 4, tones: 3, ceil: 56, shade: 30, detail: 45, grain: 0, clean: 35 },
    };

    fixLayer(legacyLayer as any, defaultGl(true));

    expect((legacyLayer as any).gl).toBeDefined();
    expect((legacyLayer as any).gl.on).toBe(true);
    expect((legacyLayer as any).gl.amt).toBe(50);
    expect((legacyLayer as any).gl.spd).toBe(50);
    expect((legacyLayer as any).gl.streakCol).toBe('analog');
  });

  it('fills in missing fx sub-fields on existing glitch config', () => {
    const partialGl = {
      on: true, before: false, amt: 50, spd: 50, freq: 40,
      fx: { rgb: 1, slice: 1 }, // missing all other fx keys
      pg: { on: [], amt: 5, seed: 42, st: false },
    };

    const layer = { id: 1, type: 'image' as const, gl: partialGl } as any;
    fixLayer(layer);

    expect(layer.gl.fx.rowshift).toBe(1); // default from defaultGl().fx
    expect(layer.gl.fx.rain).toBe(0);
    expect(layer.gl.fx.streak).toBe(0);
  });

  it('fills in missing pg sub-fields on existing glitch config', () => {
    const partialGl = {
      on: true, before: false, amt: 50, spd: 50, freq: 40,
      fx: { rgb: 1, slice: 1, rowshift: 1, block: 1, roll: 0, noise: 1, flick: 1, wobble: 1, rain: 0, hold: 0, streak: 0, bars: 0, smear: 0 },
      pg: { on: ['warp'] }, // missing amt, seed, st
    };

    const layer = { id: 1, type: 'image' as const, gl: partialGl } as any;
    fixLayer(layer);

    expect(layer.gl.pg.amt).toBe(5);
    expect(layer.gl.pg.seed).toBe(42);
    expect(layer.gl.pg.st).toBe(false);
  });

  it('creates trans field if missing', () => {
    const layer = { id: 1, type: 'image' as const } as any;
    fixLayer(layer);
    expect(layer.trans).toEqual({ style: '', dur: 0, hold: 0 });
  });
});
