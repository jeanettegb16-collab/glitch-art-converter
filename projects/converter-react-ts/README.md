# Glitch Art Converter — React + TypeScript + Tailwind

> A React port of the original Glitch Art Converter. Same rendering engine, same encoders, but with a declarative UI, state management via hooks, and modern tooling.

## Why this exists

The original converter is a single-file vanilla app that proves deep technical skill. This React version answers the hiring question: *"Can you build the same thing with the workflows teams actually use?"*

**What it shows:**
- React 19 + TypeScript strict mode
- Custom hooks for image processing pipeline (`useImagePipeline`, `useEncoder`)
- Tailwind CSS with custom design tokens (matching the CRT terminal look)
- Shared encoder modules (the same `encoders/` folder from the original, imported without changes)

## Architecture

```
src/
├── App.tsx                    # Main layout: sidebar + canvas + toolbar
├── components/
│   ├── LayerList.tsx           # Draggable layer stack with visibility toggles
│   ├── ModeControls.tsx        # ASCII / Pixel / Image mode buttons
│   ├── LayerProps.tsx          # Per-layer config panel (adapts to layer type)
│   ├── ExportPanel.tsx         # Format, resolution, frame count settings
│   ├── GlitchPanel.tsx         # Per-layer glitch controls (toggles + sliders)
│   ├── TextAnimPanel.tsx       # Text animation config (11 styles)
│   ├── HardLightPanel.tsx      # Illumination presets + sliders
│   ├── RollSwapPanel.tsx       # Transition style, timer, manual triggers
│   ├── CanvasView.tsx          # The output canvas (combined or solo mode)
│   ├── ThumbnailStrip.tsx      # Top-right layer thumbnails
│   └── TopBar.tsx              # Mode switch, save/load, export, zoom, settings
├── hooks/
│   ├── useImagePipeline.ts     # Core pipeline: source → grid → canvas → screen
│   ├── useEncoder.ts           # Async export hook (GIF/APNG/WebM/PNG-Zip)
│   ├── useLayerState.ts        # Layer CRUD, selection, reorder, visibility
│   ├── useGlitchState.ts       # Seeded RNG, burst timing, step replay
│   ├── useTimeline.ts          # rAF loop, TL clock, roll transitions
│   └── useKeyboardShortcuts.ts # Shift+click layer mode, hotkeys
├── context/
│   └── AppContext.tsx          # Single global state + dispatch (layer data, UI config)
├── styles/
│   └── index.css               # Tailwind directives + @font-face + custom scrollbar
└── types.ts                    # Shared TypeScript interfaces
```

## The key hook: `useImagePipeline`

This is the core insight. The vanilla app has a 200-line render loop. In React, it's a `useMemo` + `useEffect` pipeline:

```typescript
// hooks/useImagePipeline.ts
export function useImagePipeline(layer: Layer, time: number) {
  // 1. Source image → offscreen buffer (cached until image/config changes)
  const buffer = useMemo(
    () => renderLayerToBuffer(layer),
    [layer.source, layer.mode, layer.configHash]
  );

  // 2. Apply glitch (step-based, seeded RNG — deterministic)
  const glitched = useMemo(
    () => glitchBuffer(buffer, time, layer.glitchConfig),
    [buffer, glitchStep(time, layer.glitchConfig), layer.glitchConfig.seed]
  );

  return glitched;
}
```

The pipeline is **identical logic** to the vanilla version, but expressed as data transformations with React's lifecycle. No framework magic — just standard hooks applied to the same image-processing code.

## Shared modules

The `encoders/` and `utils/` directories are **copied without changes** from the original project:

```
src/encoders/     ← copied from ../../src/encoders/
src/utils/        ← copied from ../../src/encoders/ (but without DOM-dependent functions)
```

This proves the code is modular enough to drop into a different architecture.

## State management choice

We use **React Context + useReducer**, not Redux or Zustand. Why? The converter has ~20 pieces of mutable state (layers, selected index, glitch globals, roll swap, export settings, UI preferences). Context + useReducer handles this cleanly with zero dependencies:

```typescript
// Context + reducer pattern — explicit, testable, no magic
dispatch({ type: 'LAYER_UPDATE_CONFIG', layerId: 3, 
           config: { cols: 160, contrast: 25 } });
```

For a portfolio, this shows you *can* choose the right tool for the job instead of always reaching for a state library.

## Getting started

```bash
npm install
npm run dev        # Vite dev server (localhost:5173)
npm run build      # Production build → dist/
npm run test       # vitest (jsdom environment)
npm run test:watch # vitest in watch mode
```

## Deployment

Static build → deployable anywhere. GitHub Pages workflow included.

## Tech notes

- **React 19** — latest features, no class components
- **TypeScript strict mode** — same level as the original
- **Tailwind 3** — utility-first, custom terminal color palette
- **Lucide React** — consistent icon set (replacing emoji in the original)
- **No external state library** — Context + useReducer for the ~20 state pieces
- **Reuses encoder modules** from the original project (zero changes needed)

## License

MIT
