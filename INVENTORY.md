# INVENTORY — GLITCH ART CONVERTER v1.0

Source of truth read: `index.html` (static markup) + `src/main.ts` (all UI wiring, 704 lines).
Supporting facts from `src/state/store.ts`, `src/state/defaults.ts`, `src/constants.ts`, `src/ui/export-anim.ts`.

Conventions used below:
- **id** = DOM id in index.html; generated controls (no id) are listed by their label + parent.
- **default** = value attribute / selected option, or the state default that first fills it.
- **calls** = handler in main.ts (line ref) and what it does.
- `tog` = `.tog` toggle div (data-on 0/1, class `on`). `seg` = button row.
- Translation order for STEP 1+ = the section order in this file (1 → 9).

---

## 1. TOP BAR (`div.topbar`, index.html L12–27)

| Control | Type / options | Default | Calls |
|---|---|---|---|
| `btnSide` | button `.mode-btn` "◧" (inline style `border-left:none;opacity:.8`) | — | toggle display of `#leftPanel` (L589) |
| `.topbar-title` | static span | "GLITCH ART CONVERTER v1.0" | — |
| `btnModeGlyph` | button, class `active` by default, title "Selected image layer → ASCII glyphs (Shift = all image layers)" | active | `setLayerMode('glyph', e.shiftKey)` (L169) |
| `btnModePixel` | button, title "Selected image layer → pixel art (Shift = all image layers)" | — | `setLayerMode('pixel', shift)` (L170) |
| `btnModeImage` | button, title "Selected image layer → plain picture (Shift = all image layers)" | — | `setLayerMode('image', shift)` (L171) |
| `btnSaveProj` | button "SAVE" | — | `serializeProject()` → `saveBlob(...,'json')`, status "PROJECT SAVED" (L646) |
| `btnOpenProj` | button "OPEN" | — | clicks hidden `projIn` (L651) |
| `projIn` | input file, accept `.json,.gz`, display:none | — | change → `loadProject(JSON.parse)`, `resetTimeline(true)`, re-render list/props, status "PROJECT LOADED" / "LOAD ERROR: …" (L652) |
| `btnPng` | button "PNG" | — | `savePng()` from ui/export-anim.ts (L626) |
| `btnAnim` | button "EXPORT" | — | `exportAnim()` (L625) |
| `btnGlitchQ` | button "◉ GLITCH", class `active` by default | active | **NO handler in main.ts — inert element** (exists in markup only) |
| `btnZoomDn` | button "A−", title "Smaller interface" | — | `setUiZoom(_uiZoom − 10)` (L578) |
| `btnZoomUp` | button "A+", title "Bigger interface" | — | `setUiZoom(_uiZoom + 10)` (L579) |
| `btnSettings` | button "⚙ UI" | — | toggle `.open` on `#settingsPop`, stopPropagation; doc-click outside closes it (L587–588) |

`setLayerMode(m, all)` (L159): target = selected image layer, or ALL image layers when Shift. No image layer → status "SELECT AN IMAGE LAYER FIRST". Sets `l.mode`, `renderLayerProps()`, status "LAYER/ALL IMAGE LAYERS → ASCII|PIXEL ART|PLAIN IMAGE".
`syncModeBtns()` (L148): toggles `.active` on the 3 mode buttons for the selected image layer's mode; sets all three to opacity `.25` when selection is not an image layer.

## 2. SETTINGS POPUP (`div.pop#settingsPop`, index.html L28–32)

| Control | Type / options | Default | Calls |
|---|---|---|---|
| slabel | static ":: Interface" | — | — |
| `uiGlow` | range 0–250, label "UI GLOW" + value span `uiGlowVal` | 130 (shows "130%") | oninput → CSS var `--ug` = v/100, update label (L582) |
| `uiColorPanel` | div, filled at init with `.cbtn-grid` of `colorBtns('', 'data-ui="1"')` — 15 buttons from COLOR_SET | GREEN active | each button → `setUiColor(c)` (L562–569) |

COLOR_SET (constants.ts L56): GREEN #39ff14, AMBER #ffb000, WHITE #e8e8d8 (swatch #aaa), BLUE #00cfff, CYAN #00ffee, VIOLET #cc44ff, RED #ff3b3b, ORANGE #ff7a1a, YELLOW #ffe600, LIME #b6ff00, MINT #7dffb2, PINK #ff6ad5, MAGENTA #ff00aa, COBALT #3d5cff, ICE #b8f0ff.
`setUiColor(c)` (L556): CSS var `--c`, `state.ui.color = c`, toggles `.active` on matching button. Init calls `setUiColor('#39ff14')`.

UI zoom (L571–580): `_uiZoom` starts 100; clamped 80–170; applies `style.zoom` to selectors `.left,.topbar,.right-bar,#thumbStrip,#viewSel`; persists to localStorage key `glyphconv-uizoom`; status "UI SIZE n%". Restored from localStorage at init.

## 3. LEFT PANEL — LAYERS section (`details.sec[data-k=layers]`, open by default, index.html L36–51)

Accordion behavior (L673): opening any `details.sec` closes all others.

| Control | Type / options | Default | Calls |
|---|---|---|---|
| `canvasAspect` | select: AUTO (first image) `auto` / 16:9 / 4:3 / 3:2 / 1:1 square / 3:4 portrait / 9:16 portrait / 21:9 wide. Label "CANVAS ASPECT · fits the window, never stretched" | `auto` | onchange → `state.canvas.aspect`, status "CANVAS: …" (L681) |
| `layerList` | div, dynamic per-layer rows (see below) | empty | row click → `selectLayer(i)`; eye click → toggle `L.visible` + re-render (L114) |
| `btnAddImg` | button "+ IMAGE" in `.seg` | — | clicks hidden `fileImg` (L458) |
| `btnAddTxt` | button "+ TEXT" in `.seg` | — | `newTextLayer('HELLO')`, push, select last (L464) |
| `btnLayerUp` | button "↑" in `.seg3` | — | swap selected with previous, keep selection (L474) |
| `btnLayerDn` | button "↓" in `.seg3` | — | swap selected with next (L480) |
| `btnLayerDel` | button "DEL" in `.seg3` | — | splice selected, clamp selection, re-render (L468) |
| `tInRoll` | tog, label "IN ROLL SWAP" | off | onclick → toggle `inRoll` on selected **image** layer only; re-render list/props (L486). `updateInRollToggle()` syncs state from selection (L135) |
| `fileImg` | input file accept `image/*`, display:none | — | change → for each image file: FileReader→Image→`newImageLayer(img, filename-without-ext)`, push, select last (L459) |

Layer row markup (L120): `.layer(.sel)(.broken)` containing `.eye` span ("◉" visible / "○" hidden), `.nm` span ("⚠ " prefix if `_broken`, name, " ⇄" suffix if `inRoll`), `.tp` span (type first 3 chars upper: IMG/TXT).

`selectLayer(i)` (L103): sets `state.selected`; if selected is a visible image layer with `inRoll`, jumps `state.roll.cur` to it and `resetTimeline(true)`; then re-renders list, props, in-roll toggle.

## 4. LAYER PROPERTIES PANEL (`div#layerProps`, dynamic — built by `renderLayerProps()` main.ts L211–433)

Rendered inside the LAYERS section, below the layer list. No layer selected → only slabel "NO LAYER SELECTED".
Every row is `.ctrl` with `.ch` label; toggles are `.tr` + `.tog`. All handlers mutate config in place (no re-render except where noted).

### 4a. Common rows (all layers)

| Control | Type / options | Default | Calls |
|---|---|---|---|
| NAME | text input | `L.name` ("IMAGE n" / "TEXT n") | oninput → `L.name`, re-render layer list (L231) |
| slabel | ":: L.name" | — | — |
| OPACITY | range 0–100, label shows % | image 100% / text 85% (`L.opacity`) | oninput → `L.opacity = v/100`, update label (L236) |
| BLEND | select: NORMAL `source-over` / ADD `lighter` / SCREEN `screen` / MULTIPLY `multiply` / OVERLAY `overlay` / DIFFERENCE `difference` | image `source-over` / text `lighter` | onchange → `L.blend` (L239) |

### 4b. MODE row (image layers only)

| Control | Type / options | Default | Calls |
|---|---|---|---|
| MODE | select: GLYPH `glyph` / PIXEL `pixel` / IMAGE "IMAGE (plain picture)" `image` | `glyph` | onchange → `L.mode`, re-render props (L248) |

### 4c. GLYPH settings (image layer, mode = glyph; cfg `L.glyphCfg`)

Defaults (store.ts L43): cols 160, charset 1, color #39ff14, glow 10, spread 1.5, contrast 18, brightness 0, gamma 10, sat 10, hue 0, sharp 0, post 0, edge 0, dither 0, invert 0, mirror 0, vig 0, grain 0, scanR 0, colorFromImage 0.
**UI-exposed only:** (gamma/sat/hue/sharp/post/vig/grain/scanR are config-only, no control).

| Control | Type / options | Default | Calls |
|---|---|---|---|
| COLS | range 20–400 | 160 | oninput → `g.cols`, label (L254) |
| CHARSET | select, 19 options index 0–18: DENSE BLOCKS ░▒▓█ / FINE DETAIL 16-level classic / ULTRA FINE 22-level / MINIMAL . : \| # / NUMBERS / HEX / SYMBOLS / KATAKANA / MATRIX / BOX DRAWING / HATCHING / BRAILLE / UNICODE BLOCKS ▁▂▃▄▅▆▇█ / DOTS · • ● ◉ ◎ / MIXED DENSE all printable / BINARY 0 1 / RUNES ᚠᚢᚦᚨᚱ / MATH ∑∫∂√∞≈ / CIRCUIT ╌┼╬▚▞▓ | 1 (FINE DETAIL) | onchange → `g.charset` (L256) |
| COLOR | `.cbtn-grid` via `colorBtns(g.color)` — same 15 colors as §2 | #39ff14 | click → `g.color`, re-render props (L259) |
| GLOW | range 0–30 | 10 | oninput → `g.glow` (L261) |
| SPREAD | range 0–4 (raw 0–40 ÷10, label 1 decimal) | 1.5 | oninput → `g.spread = v/10` (L263) |
| CONTRAST | range 1–60 (label ÷10, 1 decimal) | 18 (shows 1.8) | oninput → `g.contrast` (L265) |
| BRIGHT | range −100–100 | 0 | oninput → `g.brightness` (L267) |
| COLOR FROM IMAGE | tog | off | toggle `g.colorFromImage`, re-render props (L269) |
| EDGE DETECT | tog | off | toggle `g.edge` (L270) |
| DITHER | tog | off | toggle `g.dither` (L271) |
| INVERT | tog | off | toggle `g.invert` (L272) |
| MIRROR | tog | off | toggle `g.mirror` (L273) |

### 4d. PIXEL settings (image layer, mode = pixel; cfg `L.pixelCfg`)

Defaults: block 8, palette 'full', contrast 10, brightness 0, sat 10, dither 0, edge 0, grid 0, scan 0, noise 0.

| Control | Type / options | Default | Calls |
|---|---|---|---|
| BLOCK | range 2–64, label px | 8 | oninput → `p.block` (L276) |
| PALETTE | select, 18 options: FULL COLOR `full` / AUTO 32 `auto32` / AUTO 16 `auto16` / AUTO 8 `auto8` / AUTO 4 `auto4` / GAME BOY `gameboy` / MONO 6-STEP `mono` / CRT GREEN `crt` / AMBER `amber` / NES `nes` / C64 `c64` / PICO-8 `pico8` / CGA `cga` / VIRTUAL BOY `vboy` / VAPORWAVE `vapor` / CYBER BLUE `cyber` / SEPIA `sepia` / ICE `ice` | `full` | onchange → `p.palette` (L278) |
| CONTRAST | range 1–40 (label ÷10) | 10 (shows 1.0) | oninput → `p.contrast` (L281) |
| BRIGHTNESS | range −100–100 | 0 | oninput → `p.brightness` (L283) |
| SATURATION | range 0–30 (label ÷10) | 10 (shows 1.0) | oninput → `p.sat` (L285) |
| DITHER | tog | off | toggle `p.dither`, re-render props (L287) |
| OUTLINE | tog | off | toggle `p.edge` (L288) |
| GRID | tog | off | toggle `p.grid` (L289) |
| SCANLINES | tog | off | toggle `p.scan` (L290) |
| NOISE | tog | off | toggle `p.noise` (L291) |
| HARD LIGHT | tog | off (`L.light.on`) | toggle `L.light.on`, re-render props (L292) |
| ▶ PIXEL STENCIL (stencil preset) | button, full width, only when HARD LIGHT on | — | `Object.assign(L.light, LIGHT_PRESETS.stencil, {on:true})`, status "PIXEL STENCIL APPLIED" (L294) |
| hint | static: "In PIXEL mode HARD LIGHT works on the pixel grid itself: each block becomes one flat tone (shadow black / a few greys), then the PALETTE is applied." | — | — |

Image layer, mode = image: only a hint row: "Plain picture, no glyphs or pixels. Use HARD LIGHT below for the crushed-shadow look." (L299)

### 4e. TEXT settings (text layers; cfg `L` directly + `L.anim`)

Layer defaults (store.ts L59): content 'HELLO', size 64, color #39ff14, x 0.5, y 0.5, align 'center'; opacity 0.85, blend lighter, inRoll false; glow/track unset (UI falls back to 10 / 0).

| Control | Type / options | Default | Calls |
|---|---|---|---|
| TEXT | textarea | "HELLO" | oninput → `L.content` (L302) |
| SIZE | range 8–200, label px | 64 | oninput → `L.size` (L304) |
| X | range 0–100, label % | 50 | oninput → `L.x = v/100` (L306) |
| Y | range 0–100, label % | 50 | oninput → `L.y = v/100` (L308) |
| ALIGN | select: LEFT / CENTER / RIGHT | center | onchange → `L.align` (L310) |
| GLOW | range 0–40 | `L.glow ?? 10` | oninput → `L.glow` (L313) |
| LETTER SPACING | range −6–60, label px | `L.track \|\| 0` | oninput → `L.track` (L315) |
| COLOR | `.cbtn-grid` `colorBtns(L.color)` — same 15 colors | #39ff14 | click → `L.color`, re-render props (L317) |

### 4f. TEXT ANIMATION sub-panel (slabel ":: ANIMATION"; cfg `L.anim = normAnim(...)`)

Defaults (ANIM_DEFAULT, constants.ts L107): kind fade, dur 1400, delay 200, ease out, loop false, hold 2500, outKind reverse, outDur 900, gap 500, loops 0, unit char, order forward, soft 0.35, seed 7, cursor off.
`rp()` = `replayAnim()` (render/timeline.ts).

| Control | Type / options | Default | Calls |
|---|---|---|---|
| EFFECT | select: NONE (static) `none` / FADE IN `fade` / TYPEWRITER `typewriter` / DECODE (scramble → text) `decode` / SCAN REVEAL ↓ `scanreveal` / WIPE → `wipe` / GLITCH IN `glitchin` / SCATTER `scatter` / SLIDE UP `slide` / ZOOM IN `zoom` / NEON FLICKER `flicker` | fade | onchange → `A.kind`, re-render props, rp() (L324) |
| REVEAL BY | select: CHARACTER `char` / WORD `word` / LINE `line` | char | onchange → `A.unit`, rp() (L331) |
| ORDER | select: FORWARD `forward` / REVERSE `reverse` / CENTER OUT `center` / EDGES IN `edges` / RANDOM `random` | forward | onchange → `A.order`, rp() (L334) |
| SOFTNESS | range 0–100, label % — **only when kind ∉ {typewriter, scanreveal, wipe, none}** | 35% (`soft .35`) | oninput → `A.soft = v/100`, rp() (L338) |
| DURATION | range 200–20000 step 100, label ms (+ " · Nms/char" when typewriter, N = dur / non-space char count) | 1400 | oninput → `A.dur`, rp() (L342) |
| START DELAY | range 0–5000 step 50, label ms | 200 | oninput → `A.delay`, rp() (L344) |
| EASE | select: LINEAR `linear` / EASE IN `in` / EASE OUT `out` / IN-OUT `inout` | out | onchange → `A.ease`, rp() (L346) |
| LOOP (in → hold → out → again) | tog | off | toggle `A.loop`, re-render props, rp() (L349) |
| HOLD (text stays) | range 0–20000 step 100, label s — **only when loop on** | 2500 (2.5s) | oninput → `A.hold`, rp() (L351) |
| THEN | select: PLAY OUT BACKWARDS (backspace) `reverse` / FADE OUT `fade` / CUT TO NOTHING `cut` — **only when loop on** | reverse | onchange → `A.outKind`, re-render props, rp() (L353) |
| OUT DURATION | range 100–10000 step 100, label ms — **only when loop on AND outKind ≠ cut** | 900 | oninput → `A.outDur`, rp() (L357) |
| EMPTY PAUSE | range 0–8000 step 100, label s — **only when loop on** | 500 (0.5s) | oninput → `A.gap`, rp() (L360) |
| REPEATS | range 0–20, label ∞ when 0 — **only when loop on** | 0 (∞) | oninput → `A.loops`, rp() (L362) |
| CURSOR | select: OFF `off` / █ BLOCK `block` / ▏BAR `bar` / _ UNDERLINE `under` — **only when kind ∈ {typewriter, decode}** | off | onchange → `A.cursor`, rp() (L366) |
| ↻ REPLAY | button in `.seg` | — | rp() (L370) |
| ⤮ NEW RANDOM | button in `.seg` | — | `A.seed = (Math.random()*1e6)|0`, rp() (L373) |

### 4g. LIGHT (hard illumination) section (image layers only; cfg `L.light`)

Defaults (defaultLight): on false, black 40, soft 4, tones 3, ceil 56, shade 30, detail 45, grain 0, clean 35.

| Control | Type / options | Default | Calls |
|---|---|---|---|
| HARD LIGHT | tog | off | toggle `Lt.on`, re-render props (L380) |
| SHADOW CUT | range 0–95, label % — only when on | 40 | oninput → `Lt.black` (L386) |
| EDGE SOFTNESS | range 0–50, label % — only when on | 4 | oninput → `Lt.soft` (L387) |
| LIGHT TONES | range 2–8 — only when on | 3 | oninput → `Lt.tones` (L388) |
| LIGHT CEILING | range 15–100, label % — only when on | 56 | oninput → `Lt.ceil` (L389) |
| SHADING IN LIGHT | range 0–100, label % — only when on | 30 | oninput → `Lt.shade` (L390) |
| DETAIL / TEXTURE | range 0–100, label % — only when on | 45 | oninput → `Lt.detail` (L391) |
| CLEAN EDGES | range 0–100, label % — only when on | 35 | oninput → `Lt.clean` (L392) |
| GRAIN | range 0–100, label % — only when on | 0 | oninput → `Lt.grain` (L393) |
| PRESET: STENCIL / TEXTURED / DEEP | 3 buttons in `.seg` — only when on | — | `Object.assign(Lt, LIGHT_PRESETS[k])`, re-render props (L394). Presets: stencil {black 40, soft 4, tones 3, ceil 56, shade 30, detail 45, grain 0, clean 35}; textured {34, 10, 5, 72, 70, 85, 18, 20}; deep {55, 2, 2, 82, 10, 25, 0, 45} |
| ▶ REFERENCE LOOK (plain image + stencil) | button full width — only when on | — | assign stencil preset + on:true, `L.mode='image'`, status "REFERENCE LOOK APPLIED" (L397) |
| hint | static: "Shadows are crushed to black, lit areas are flattened to a capped grey with a few tones, and local contrast keeps panel lines and surface detail." — only when on | — | — |

### 4h. TRANSITION section (image layers with `inRoll` only; cfg `L.trans` default {style:'', dur:0, hold:0})

| Control | Type / options | Default | Calls |
|---|---|---|---|
| INTO THIS LAYER | select: GLOBAL DEFAULT `''` + every rollStyle option **except** PASSIVE_STYLES (intrude, ghost) → vroll, hslide, sync, blocks, crossfade, flash, burst, hardcut, subliminal, peek, hold | '' (GLOBAL DEFAULT) | onchange → `T.style` (L407) |
| LENGTH | range 0–3000 step 50, label "DEFAULT" when 0 else Nms | 0 | oninput → `T.dur` (L410) |
| STAYS ON SCREEN | range 0–30, label "DEFAULT" when 0 else Ns | 0 | oninput → `T.hold` (L412) |

### 4i. EFFECTS section (all layers; cfg `L.effects`)

Defaults: blur 0, brightness 1, contrast 1, saturate 1, hue 0, sepia 0, grayscale 0, invert 0, posterize 0, threshold 0.

| Control | Range / step | Default | Calls |
|---|---|---|---|
| BLUR | 0–20 step 0.5 (label 1 dec) | 0 | oninput → `fx.blur` (L423) |
| BRIGHTNESS | 0–3 step 0.05 (label 2 dec) | 1 (1.00) | oninput → `fx.brightness` (L424) |
| CONTRAST | 0–3 step 0.05 (label 2 dec) | 1 | oninput → `fx.contrast` (L425) |
| SATURATE | 0–3 step 0.05 (label 2 dec) | 1 | oninput → `fx.saturate` (L426) |
| HUE | 0–360 step 1 | 0 | oninput → `fx.hue` (L427) |
| SEPIA | 0–1 step 0.05 (label 2 dec) | 0 | oninput → `fx.sepia` (L428) |
| GRAYSCALE | 0–1 step 0.05 (label 2 dec) | 0 | oninput → `fx.grayscale` (L429) |
| INVERT | 0–1 step 0.05 (label 2 dec) | 0 | oninput → `fx.invert` (L430) |
| POSTERIZE | 0–16 step 1 | 0 | oninput → `fx.posterize` (L431) |
| THRESHOLD | 0–1 step 0.02 (label 2 dec) | 0 | oninput → `fx.threshold` (L432) |

## 5. IMAGE SEQUENCE (ROLL SWAP) section (`details.sec[data-k=roll]`, index.html L53–81)

| Control | Type / options | Default | Calls |
|---|---|---|---|
| hint | static: "Mark image layers IN ROLL SWAP (LAYERS ▸ below the list). The next image takes over on the timer, or when you hit SWITCH NOW." | — | — |
| `tRollOn` | tog, label "ROLL SWAP TO NEXT IMAGE" | **ON** | onclick → `state.roll.on = state.roll.on === false`, status "ROLL SWAP: ON/OFF" (L545) |
| `rollStyle` | select, 2 optgroups. PERMANENT SWITCH (cycles images): vroll V-HOLD ROLL (vertical slide) / hslide HORIZONTAL SLIDE / sync SYNC BAR SWEEP / blocks BLOCK REVEAL / crossfade CROSSFADE / flash FLASH CUT / burst BURST FLASH (next appears in glitch) **selected** / hardcut HARD CUT. GLITCH INTRUSION (image 1 stays main): intrude INTRUDE (image 2 slabs) / ghost GHOST ECHO (image 2 afterimage) / subliminal SUBLIMINAL (1-frame flash) / peek PEEK (image 2 for a moment) / hold HOLD (image 2 for a beat) | `burst` | onchange → `state.roll.style`, `resetTimeline(true)`, status "SWITCH STYLE: …" (L539) |
| `rollEvery` | range 2–20, label "SWAP EVERY ns" + `rollEveryVal` | 5 | oninput → `state.roll.every`, label (L547) |
| `rollDur` | range 0–3000 step 50, label "TRANSITION LENGTH", shows "AUTO" when 0 else Nms (`rollDurVal`) | 0 (AUTO) | oninput → `state.roll.dur`, label (L548) |
| `btnRollNow` | button "▶ SWITCH NOW" in `.seg` | — | `startRollTransition(performance.now())`, status "SWITCH: …" (L549) |
| `btnRollReset` | button "↻ RESET CYCLE" in `.seg` | — | `state.roll.cur = 0`, `resetTimeline(true)`, status "ROLL RESET" (L550) |

## 6. GLITCH section (`details.sec[data-k=glitch]`, index.html L83–125)

Per-layer: edits the **selected layer's** `L.gl` via `GLm()` (L507), which calls `fixLayer(L, state.glitch)` first (fills missing gl from global glitch). `syncGlitchUI()` (L177) pushes selected layer's values into all these controls.

| Control | Type / options | Default | Calls |
|---|---|---|---|
| hint + `glLayerName` | static "These controls edit the selected layer: **<name>** . Each layer keeps its own glitch." — name span updated by syncGlitchUI ("(no layer selected)" when none) | — | — |
| `tLayerGl` | tog, label "GLITCH ON THIS LAYER" | ON | onclick → `g.on = !g.on`, syncGlitchUI (L509) |
| `btnGlCopyAll` | button "COPY THESE TO ALL LAYERS" | — | deep-copy selected `gl` (JSON) to every other layer, delete their `_gs`, status "GLITCH SETTINGS COPIED TO ALL LAYERS" (L529) |
| `ordAfter` | button "OUTPUT" in `.seg`, class `pri` by default | pri | onclick → `g.before = false`, syncGlitchUI (L514) |
| `ordBefore` | button "SOURCE" in `.seg` | — | onclick → `g.before = true`, syncGlitchUI (L515). syncGlitchUI moves `.pri` between the two |
| hint | static: "SOURCE = glitch happens before pixel-stack effects. OUTPUT = glitch happens after pixel-stack effects." | — | — |
| `tGlitch` | tog, label "MASTER GLITCH (all layers)" | ON | onclick → `state.glitch.on = !…`, status "GLITCH: LIVE/OFF" (L500) |
| `gAmt` | range 0–100, label INTENSITY + `gAmtVal` | 50 | oninput → `g.amt`, label (L510) |
| `gSpd` | range 1–100, label SPEED + `gSpdVal` | 50 | oninput → `g.spd`, label (L510) |
| `gFreq` | range 0–100, label BURST FREQ + `gFreqVal` | 40 | oninput → `g.freq`, label (L510) |
| RGB SPLIT | tog data-fx=rgb | ON | toggle `g.fx.rgb`, syncGlitchUI (L513) |
| SLICE TEAR | tog data-fx=slice | ON | toggle `g.fx.slice` |
| ROW SHIFT | tog data-fx=rowshift | ON | toggle `g.fx.rowshift` |
| BLOCK CORRUPT | tog data-fx=block | ON | toggle `g.fx.block` |
| V-HOLD ROLL | tog data-fx=roll | off | toggle `g.fx.roll` |
| STATIC NOISE | tog data-fx=noise | ON | toggle `g.fx.noise` |
| FLICKER | tog data-fx=flick | ON | toggle `g.fx.flick` |
| WOBBLE | tog data-fx=wobble | ON | toggle `g.fx.wobble` |
| MATRIX RAIN | tog data-fx=rain | off | toggle `g.fx.rain` |
| STREAK NOISE | tog data-fx=streak | off | toggle `g.fx.streak` |
| SCAN BARS | tog data-fx=bars | off | toggle `g.fx.bars` |
| ROW SMEAR | tog data-fx=smear | off | toggle `g.fx.smear` |
| `gStreakCol` | select: ANALOG (red / blue / cyan) `analog` / PHOSPHOR (output color) `phos`, label STREAK COLORS | analog | onchange → `g.streakCol` (L523) |
| `btnBreakup` | button "▶ PRESET: SIGNAL BREAKUP", full width | — | sets fx rgb/slice/rowshift/block/noise/flick/wobble/**hold**/streak/bars/smear = 1; amt 70, spd 65, freq 65, on true; syncGlitchUI; status "PRESET: SIGNAL BREAKUP" (L524). Note: `fx.hold` has no UI toggle — only this preset touches it |

### 6a. Advanced pixel stack sub-panel (slabel ":: Advanced pixel stack"; cfg `g.pg` default {on:[], amt:5, seed:42, st:false})

| Control | Type / options | Default | Calls |
|---|---|---|---|
| FREEZE (STATIC) | tog id `tPgStatic` | off | toggle `g.pg.st`, syncGlitchUI (L520) |
| AMOUNT | range 1–10 + `pgAmtVal` | 5 | oninput → `g.pg.amt`, label (L521) |
| SEED | range 0–999 + `pgSeedVal` | 42 | oninput → `g.pg.seed`, label (L522) |
| CRT WARP | tog data-pg=warp | off | add/remove 'warp' in `g.pg.on` (L516) |
| CHROMA SPLIT | tog data-pg=chroma | off | 'chroma' |
| PIXEL SORT | tog data-pg=sort | off | 'sort' |
| ROW JITTER | tog data-pg=jitter | off | 'jitter' |
| DATAMOSH | tog data-pg=mosh | off | 'mosh' |
| PIXEL STRETCH | tog data-pg=stretch | off | 'stretch' |
| GHOST ECHO | tog data-pg=ghost | off | 'ghost' |
| VHS TRACKING | tog data-pg=vhs | off | 'vhs' |
| TAPE DROPOUT | tog data-pg=dropout | off | 'dropout' |
| CONTRAST CRUSH | tog data-pg=crush | off | 'crush' |

Global glitch defaults (store.ts L13): on true, before false, amt 50, spd 50, freq 40, fx {rgb 1, slice 1, rowshift 1, block 1, roll 0, noise 1, flick 1, wobble 1, rain 0, hold 0, streak 0, bars 0, smear 0}, pg {on [], amt 5, seed 42, st false}.

## 7. EXPORT section (`details.sec[data-k=export]`, index.html L127–161)

| Control | Type / options | Default | Calls |
|---|---|---|---|
| `animFmt` | select: WEBM — WebCodecs (fast, small) `webm` **selected** / GIF `gif` / APNG `apng` / PNG SEQUENCE (.zip) `zip`, label FORMAT | webm | onchange → `updAnimUi()` + `resetTimeline(true)` (L616). `updAnimUi` (L609): rowFrames hidden when webm; rowSecs+rowBps shown only for webm; rowGifOpts shown only for gif |
| `gifFrames` (row `rowFrames`) | range 10–120, label FRAMES + `gifFramesVal` | 40 | oninput → label + `resetTimeline(true)` (L620) |
| `vidSecs` (row `rowSecs`) | range 2–60, label LENGTH s + `vidSecsVal` | 6 | oninput → label + resetTimeline (L617) |
| `vidBps` (row `rowBps`) | range 1–20 step 0.5, label BITRATE Mbps + `vidBpsVal` (1 dec) | 4 (4.0) | oninput → label + resetTimeline (L618) |
| `gifW` | range 240–1200 step 20, label WIDTH px + `gifWVal` | 640 | oninput → label + resetTimeline (L619) |
| `syncPrev` | checkbox "PREVIEW = EXPORT" | **checked** | change → `resetTimeline(true)` (L687). Hint: "ON: the preview renders at export size and loops over the export length with the same seeded glitch, so what you watch is what the file contains." |
| `gifColors` (row `rowGifOpts`, gif only) | select: 256 **selected** / 128 / 64 / 32 / 16 / 8, label COLORS | 256 | read live by exportAnim; no dedicated oninput handler |
| `gifLossy` (rowGifOpts, gif only) | range 0–40, label LOSSY + `gifLossyVal`, shows "OFF" when 0 | 0 (OFF) | oninput → label (L621); read live by exportAnim |
| `exSwapAt` | range 5–95, label TRIGGER SWAP AT % + `exSwapAtVal` | 40 | oninput → label + resetTimeline (L622) |
| `exSummary` | div, font-size:12px;opacity:.7 | empty | **nothing writes to it in this codebase** |
| hint | static: "Export always captures the COMBINED view, regardless of the current preview mode." | — | — |
| `btnExport` | button "EXPORT", class `abtn pri big` | — | `exportAnim()` from ui/export-anim.ts (L624). Reads DOM live (`gifW`, `vidBps`, `gifColors`, `gifLossy`), uses state.layers/roll/ui.outName, saves via saveBlob, status "SAVED (WxH, N MB, F frames)" |
| `btnPng2` | button "PNG" in `.seg` | — | `savePng()` (L627) |
| `btnTxt` | button "TXT" in `.seg` | — | find first image layer with mode glyph → `buildAsciiString(img, glyphCfg)` → saveBlob .txt named `state.ui.outName \|\| 'glitch-art'`; else status "NO GLYPH LAYER" (L628) |
| `btnCopy` | button "COPY TEXT", full width | — | same string → clipboard; status "COPIED" / "COPY FAILED" / "NO GLYPH LAYER" (L634) |
| `outName` | text input, placeholder "glitch-art" | empty (state.ui.outName init 'glitch-art') | oninput → `state.ui.outName` (L640). Used as filename prefix for all saves |
| `outDirInfo` | div.hint | empty | **nothing writes to it in this codebase** |

## 8. STATUS BAR (`div.status#status`, index.html L163)

Initial text "READY." — init (L703) sets "> READY — ADD AN IMAGE TO BEGIN". `setStatus(m)` (L34) renders "> " + m. Every handler above reports through it.

## 9. RIGHT PANEL (`div.right`, index.html L166–173)

| Control | Type / options | Default | Calls |
|---|---|---|---|
| `modeLabel` | span in `.right-bar` | "GLYPH MODE" | **static — never updated in this codebase** |
| `dimInfo` | span in `.right-bar` | "—" | set by render/timeline.ts L131 to canvas "WxH" when it changes |
| `outCv` | canvas in `.output-wrap#outputWrap` | — | rendered by tick()/timeline (render/compositor) |
| `thumbStrip` | div, dynamic thumbnails | empty | `renderThumbs()` (L78): per-layer `.thumb(.sel)(.off)` with `<img>` (64×48 jpeg thumb; text layers drawn on #040400 bg) + `<span class="tn">N name</span>` + `<i></i>`; click → `selectLayer(i)`. `updateThumbLive()` (L93): adds `.live` to the currently rolling image layer's thumb |
| `viewSel` | div with 2 buttons: data-v=combined "COMBINED" class `abtn pri` title "All layers, as exported" / data-v=solo "SELECTED LAYER" title "Only the selected layer" | combined (pri) | onclick → `setViewMode(v)` from render/compositor, move `.pri`, status "VIEW: SELECTED LAYER ONLY" / "VIEW: COMBINED OUTPUT" (L598) |

## INIT SEQUENCE (main.ts L672–703)

1. details.sec auto-collapse wiring.
2. canvasAspect handler.
3. `resetTimeline(true)` on input/change of: gifW, gifFrames, vidSecs, animFmt, exSwapAt, syncPrev.
4. `document.fonts.load('20px VT323')` → `resetFontRatio()` (drop cached glyph buffers).
5. `glitchNoise()`, `renderLayerList()`, `renderLayerProps()`, `resetTimeline(true)`, `tick()` (start render loop), status "READY — ADD AN IMAGE TO BEGIN".

## STATE DEFAULTS REFERENCE (store.ts / defaults.ts)

- `state.selected` = −1, `state.layers` = [].
- `state.roll` = {cur 0, on true, style 'burst', every 5, dur 0, …}.
- `state.export` = {fmt webm, frames 40, secs 6, width 640, bps 4, gifColors 256, gifLossy 0, swapAt 40} — **exportAnim reads the DOM, not this object** (kept in sync only via resetTimeline).
- `state.ui` = {color '#39ff14', glow 130, outName 'glitch-art'}.
- `state.canvas` = {aspect 'auto'}.
- newImageLayer: name "IMAGE n", visible true, opacity 1, blend source-over, **inRoll true**, mode glyph (+ cfg defaults in §4c/§4d).
- newTextLayer: name "TEXT n", visible true, opacity 0.85, blend lighter, inRoll false, content 'HELLO', size 64, color #39ff14, x .5, y .5, align center, anim = ANIM_DEFAULT.

## INERT / UNWIRED ELEMENTS (must be ported as-is, no behavior)

- `btnGlitchQ` (top bar "◉ GLITCH") — markup only, no handler.
- `exSummary`, `outDirInfo` — empty divs, never written.
- `modeLabel` — static text, never updated.
- GlyphCfg keys gamma/sat/hue/sharp/post/vig/grain/scanR and fx.hold — config-only, no UI control (fx.hold settable only via SIGNAL BREAKUP preset).
