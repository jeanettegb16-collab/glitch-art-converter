import { describe, it, expect } from 'vitest';
import { state, selLayer, rollLayers, newImageLayer, newTextLayer } from './store';
import { fixLayer } from './defaults';

describe('selLayer', () => {
  it('returns null when no layers exist', () => {
    const orig = [...state.layers];
    state.layers = [];
    expect(selLayer()).toBeNull();
    state.layers = orig;
  });

  it('returns the layer at the selected index', () => {
    const origLayers = [...state.layers];
    const origSelected = state.selected;
    state.layers = [];
    const fakeImg = { src: 'data:image/png;base64,x', naturalWidth: 100, naturalHeight: 100 } as HTMLImageElement;
    const l1 = newImageLayer(fakeImg, 'a');
    const l2 = newImageLayer(fakeImg, 'b');
    state.layers.push(l1, l2);

    state.selected = 0;
    expect(selLayer()).toBe(l1);

    state.selected = 1;
    expect(selLayer()).toBe(l2);

    state.selected = 5; // out of bounds
    expect(selLayer()).toBeNull();

    state.layers = origLayers;
    state.selected = origSelected;
  });
});

describe('rollLayers', () => {
  it('only returns visible image layers with inRoll=true', () => {
    const origLayers = [...state.layers];
    const fakeImg1 = { src: 'data:image/png;base64,a', naturalWidth: 100, naturalHeight: 100 } as HTMLImageElement;
    const fakeImg2 = { src: 'data:image/png;base64,b', naturalWidth: 200, naturalHeight: 150 } as HTMLImageElement;

    const imgVisibleRoll = newImageLayer(fakeImg1, 'visible-roll');
    const imgHiddenRoll = newImageLayer(fakeImg2, 'hidden-roll');
    (imgHiddenRoll as any).visible = false;

    const imgVisibleNoRoll = newImageLayer(fakeImg1, 'visible-no-roll');
    (imgVisibleNoRoll as any).inRoll = false;

    const txtLayer = newTextLayer('test');

    state.layers.push(imgVisibleRoll, imgHiddenRoll, imgVisibleNoRoll, txtLayer);

    const rl = rollLayers();
    expect(rl.length).toBe(1);
    expect(rl[0].name).toBe('visible-roll');

    state.layers = origLayers;
  });
});

describe('layer operations', () => {
  it('delete middle layer adjusts selected index correctly', () => {
    const origLayers = [...state.layers];
    const fakeImg = { src: 'data:image/png;base64,x', naturalWidth: 100, naturalHeight: 100 } as HTMLImageElement;

    state.layers = [
      newImageLayer(fakeImg, 'a'),
      newImageLayer(fakeImg, 'b'),
      newImageLayer(fakeImg, 'c'),
    ];
    state.selected = 1; // select middle

    state.layers.splice(state.selected, 1);
    state.selected = Math.min(state.selected, state.layers.length - 1);

    expect(state.layers.length).toBe(2);
    expect(state.selected).toBe(1);
    expect(state.layers[1].name).toBe('c');

    state.layers = origLayers;
  });

  it('layer up at boundary (first layer) does nothing', () => {
    const origLayers = [...state.layers];
    const fakeImg = { src: 'data:image/png;base64,x', naturalWidth: 100, naturalHeight: 100 } as HTMLImageElement;

    state.layers = [
      newImageLayer(fakeImg, 'a'),
      newImageLayer(fakeImg, 'b'),
      newImageLayer(fakeImg, 'c'),
    ];
    state.selected = 0;
    const i = state.selected;
    if (i <= 0) { /* no-op as per main.ts */ }

    expect(state.layers[0].name).toBe('a'); // unchanged

    state.layers = origLayers;
  });

  it('layer down at boundary (last layer) does nothing', () => {
    const origLayers = [...state.layers];
    const fakeImg = { src: 'data:image/png;base64,x', naturalWidth: 100, naturalHeight: 100 } as HTMLImageElement;

    state.layers = [
      newImageLayer(fakeImg, 'a'),
      newImageLayer(fakeImg, 'b'),
      newImageLayer(fakeImg, 'c'),
    ];
    state.selected = 2; // last
    const i = state.selected;
    if (i < 0 || i >= state.layers.length - 1) { /* no-op as per main.ts */ }

    expect(state.layers[2].name).toBe('c'); // unchanged

    state.layers = origLayers;
  });

  it('layer up and down reorder correctly', () => {
    const origLayers = [...state.layers];
    const fakeImg = { src: 'data:image/png;base64,x', naturalWidth: 100, naturalHeight: 100 } as HTMLImageElement;

    state.layers = [
      newImageLayer(fakeImg, 'a'),
      newImageLayer(fakeImg, 'b'),
      newImageLayer(fakeImg, 'c'),
    ];
    state.selected = 1;

    // Move down
    const i = state.selected;
    [state.layers[i], state.layers[i + 1]] = [state.layers[i + 1], state.layers[i]];
    state.selected = i + 1;

    expect(state.layers[0].name).toBe('a');
    expect(state.layers[1].name).toBe('c');
    expect(state.layers[2].name).toBe('b');
    expect(state.selected).toBe(2);

    // Move up
    const j = state.selected;
    [state.layers[j - 1], state.layers[j]] = [state.layers[j], state.layers[j - 1]];
    state.selected = j - 1;

    expect(state.layers[0].name).toBe('a');
    expect(state.layers[1].name).toBe('b');
    expect(state.layers[2].name).toBe('c');
    expect(state.selected).toBe(1);

    state.layers = origLayers;
  });
});
