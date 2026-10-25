# STEP 1 — TOP BAR (§1 INVENTORY) — Report

All tests done on Chrome 126 (headless) against dev server `http://localhost:5181/` vs original on `http://localhost:5180/glitch-art-converter/`.

## Screenshots captured

| File | Description |
|---|---|
| `orig-baseline.png` | Original app at 1280×800 (no layers) |
| `port-baseline.png` | React port at 1280×800 (no layers) |
| `port-btnSide-click.png` | After clicking btnSide (panel hidden) |
| `port-settings-open.png` | After clicking btnSettings (popup open) |
| `port-zoom-up.png` | After clicking btnZoomUp (UI zoom 110%) |

## Per-control checklist (TOP BAR §1)

| # | Control | Used? | Result | Notes |
|---|---|---|---|---|
| 1.1 | `btnSide` "◧" | ✅ OK | Toggles `#leftPanel` display none/''. Revert works. | Same as original. |
| 1.2 | `.topbar-title` span | ✅ OK | Text "GLITCH ART CONVERTER v1.0" present. | Identical. |
| 1.3 | `btnModeGlyph` "ASCII" | ✅ OK | No image layer → status "SELECT AN IMAGE LAYER FIRST"; opacity 0.25. | Same. Shift-click path exists (setLayerMode uses e.shiftKey). |
| 1.4 | `btnModePixel` "PIXEL ART" | ✅ OK | Same empty-state behavior. | Same. |
| 1.5 | `btnModeImage` "IMAGE" | ✅ OK | Same empty-state behavior. | Same. |
| 1.6 | `btnSaveProj` "SAVE" | ✅ OK | Click → JSON saved, status "PROJECT SAVED". | saveBlob output path identical (download via anchor tag). |
| 1.7 | `btnOpenProj` "OPEN" | ✅ OK | Clicks hidden `projIn`; no-op without file, no error. | Same. |
| 1.8 | `projIn` file input `.json,.gz` | ⚪ N/A | File needed for meaningful test; handler wired correctly. | Cannot automate file-open dialog in headless; handler code unchanged. |
| 1.9 | `btnPng` "PNG" | ✅ OK | Click → status "NOTHING TO EXPORT" (no layers present). | Delegates to savePng() from engine. |
| 1.10 | `btnAnim` "EXPORT" | ✅ OK | Click → status "NOTHING TO EXPORT". | Delegates to exportAnim() from engine. |
| 1.11 | `btnGlitchQ` "◉ GLITCH" | ✅ OK | Inert element (no handler), appears in markup with `.active`. | Same as original — confirmed by source audit no handler exists. |
| 1.12 | `btnZoomDn` "A−" | ✅ OK | Decrements UI zoom by 10%, clamped 80–170. | LocalStorage persistence path intact. |
| 1.13 | `btnZoomUp` "A+" | ✅ OK | Increments UI zoom by 10%. Revert confirmed. | Same. |
| 1.14 | `btnSettings` "⚙ UI" | ✅ OK | Opens `#settingsPop`; doc-click outside closes it. stopPropagation correct. | Same. |

## Known limitations at this stage

- `syncModeBtns` is called only by `setLayerMode()` and would be re-called by `renderLayerProps()` once §4 lands.
- `renderLayerList()` / `renderLayerProps()` / `updateInRollToggle()` are empty/no-op because §3/§4 panels are not yet ported.
- `btnPng` / `btnAnim` produce "NOTHING TO EXPORT" because no layer-list logic exists yet to add images; this is expected.
- `exportAnim()` / `savePng()` read DOM fields (`gifW`, `vidSecs`, `animFmt`, `syncPrev`, etc.) that will exist only after §7 export panel is ported.
   → Buttons behave correctly (error/status) when those elements are missing.

## Build status

- `tsc --noEmit`: ✅ clean
- `vite build`: ✅ clean (59 modules, 275 KB JS)

## Files changed/added (STEP 1)

| Path | Change |
|---|---|
| `projects/converter-react-ts/index.html` | Replaced with original markup shell |
| `projects/converter-react-ts/src/main.tsx` | Removed StrictMode, imported `style.css` |
| `projects/converter-react-ts/src/style.css` | Copied verbatim from `src/style.css` |
| `projects/converter-react-ts/src/App.tsx` | Skeleton layout; only top bar mounted |
| `projects/converter-react-ts/src/components/TopBar.tsx` | NEW — §1 markup + all handlers |
| `projects/converter-react-ts/src/ui/status.ts` | NEW — `setStatus` extracted from main.ts |
| `projects/converter-react-ts/src/engine/render/compositor.ts` | Synced with root `src/render/compositor.ts` |
| `projects/converter-react-ts/src/engine/ui/export-anim.ts` | NEW — copied from `src/ui/export-anim.ts` (import path adjusted for `setStatus`) |
| `projects/converter-react-ts/src/engine/encoders/` | NEW — copies of all encoder modules (needed by export-anim) |

---
**Stopped. Waiting for "next" to begin STEP 2 (Settings Popup).**
