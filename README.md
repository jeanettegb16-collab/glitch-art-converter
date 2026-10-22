# Glitch Art Converter

Browser-based glitch art / ASCII / pixel art converter with zero-dependency encoders for WebM, GIF, APNG, and ZIP.

Built with TypeScript + Vite. No frameworks, no server, no API keys — everything runs client-side.

## Features

- **ASCII / Glyph mode** — 19 character sets (blocks, fine detail, katakana, braille, runes, math, etc.), adjustable columns, gamma, contrast, edge detection, Floyd-Steinberg dithering, glow halo, invert, mirror, color-from-image
- **Pixel art mode** — blocky downscale with 18 palettes (PICO-8, NES, C64, CGA, Game Boy, CRT, etc.), auto-palette via median-cut quantisation, dithering, outline, grid, scanlines, noise
- **Text layers** — 11 animation styles (fade, typewriter, decode, scan reveal, wipe, glitch-in, scatter, slide, zoom, flicker), per-char/word/line reveal, random order, cursor, glow
- **Hard light** — crush shadows to black, flatten lit planes to capped grey tones, keep surface detail as crisp texture (3 presets: stencil, textured, deep)
- **Glitch engine** — RGB split, slice tear, row shift, block corrupt, V-hold roll, static noise, flicker, wobble, matrix rain, streak noise, scan bars, row smear. Advanced pixel stack: CRT warp, chroma split, pixel sort, row jitter, datamosh, pixel stretch, ghost echo, VHS tracking, tape dropout, contrast crush. Per-layer glitch with freeze mode.
- **Roll swap** — image sequence with 13 transition styles (V-roll, horizontal slide, sync bar, block reveal, crossfade, flash, burst, hard cut, intrude, ghost, subliminal, peek, hold)
- **Export** — WebM (WebCodecs VP9), GIF (LZW, frame differencing, lossy), APNG, PNG sequence (ZIP)
- **Deterministic** — seeded RNG means the preview shows exactly what the export contains

## Architecture

```
src/
├── types.ts              # All TypeScript interfaces (Layer, GlyphCfg, GlitchCfg, etc.)
├── constants.ts          # Charsets, palettes, presets, numeric constants
├── utils/
│   ├── rng.ts            # Mulberry32 PRNG, h01 hash, easing, clamp
│   ├── color.ts          # hexToRgb, nearestColorIdx, medianCut, mixWhite
│   ├── canvas.ts         # mkCv, concatU8, imgKey, $ helper
│   └── file.ts           # saveBlob (File System Access API + download fallback)
├── encoders/
│   ├── webm.ts           # EBML muxer → valid .webm from VP9 chunks
│   ├── gif.ts            # GIF89a + LZW + frame differencing
│   ├── apng.ts           # APNG via CompressionStream, CRC32
│   ├── zip.ts            # ZIP store (no compression)
│   └── index.ts          # Re-exports
├── render/
│   ├── glyph.ts          # Image → luminance grid → ASCII glyphs
│   ├── pixel.ts          # Image → blocky pixel art + palette + dither
│   ├── text.ts           # Text animation engine (11 styles)
│   ├── effects.ts        # Hard light, box blur, CSS filter chain
│   ├── glitch.ts         # Per-layer glitch (geometric + pixel stack)
│   ├── transitions.ts    # 13 roll-swap transition styles
│   ├── layer-buffer.ts   # Layer → offscreen buffer (cached)
│   ├── compositor.ts     # Compose all layers into one frame
│   └── timeline.ts       # Single clock for preview + export
├── state/
│   ├── store.ts          # AppState singleton + selectors
│   ├── defaults.ts       # Default configs, fixLayer, fillDefaults
│   └── project.ts        # JSON serialize / load
├── ui/
│   └── export-anim.ts    # Animation export pipeline
├── main.ts               # UI wiring + init
└── style.css             # CRT-terminal styling
```

## Getting started

```bash
npm install
npm run dev        # Vite dev server
npm run build      # tsc --noEmit && vite build → dist/
npm run test       # vitest
npm run test:watch # vitest in watch mode
```

## Tests

51 tests covering:
- **Encoders**: EBML Vint/uint/float encoding, WebM muxer blob output, GIF header validity, PNG CRC32 correctness, ZIP structure (local header + EOCD + file count)
- **RNG**: Mulberry32 determinism, h01 hash, clamp01, seedFor, easing functions
- **Color**: hexToRgb, nearestColorIdx, medianCut quantisation, mixWhite

```bash
npm test
```

## Deployment

The app is a static site — deploy `dist/` to any static host.

### GitHub Pages

A GitHub Actions workflow (`.github/workflows/deploy.yml`) builds and deploys on push to `main`.

## Tech notes

- **Vite** with `base: './'` for relative paths (works on GitHub Pages subpaths)
- **TypeScript** strict mode with targeted null-check relaxation for DOM event handlers
- **Vitest** with jsdom environment for tests that touch DOM, plus Node test files for pure encoders/RNG/color
- **Zero runtime dependencies** — only dev dependencies (TypeScript, Vite, Vitest, jsdom)
- The original single-file app (`bios-ascii-converter16.html`) is preserved as a reference

## License

MIT
