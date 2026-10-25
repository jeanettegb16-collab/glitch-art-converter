import type { GlyphCfg, PixelCfg, Effects, GlitchCfg, LightCfg, TextAnim, MasterGlitchState } from './types';

// ═════════════════════════════════════════════════════════════════════
// NUMERIC CONSTANTS
// ═════════════════════════════════════════════════════════════════════
export const REF_HEIGHT = 720;
export const MIN_EXPORT_FPS = 8;
export const MAX_EXPORT_FPS = 30;
export const EXPORT_FRAME_PADDING_MS = 20;
export const EXPORT_SEED = 0x5EED1E55;
export const EXPORT_MEM_BUDGET = 700e6;
export const WEBM_QUEUE_MAX = 6;
export const ROLL_SEED = (EXPORT_SEED ^ 0x9E3779B9) | 0;
export const TL_MAX_DT = 50;
export const GLITCH_MAX_CATCHUP = 8;
export const TR_NOISE_STEP = 55;
export const DEFAULT_GLOW = 10;
export const MIN_BLOCK_SIZE = 2;
export const MAX_BLOCK_SIZE = 64;
export const MIN_COLS = 20;
export const MAX_COLS = 400;
export const MIN_EXPORT_WIDTH = 240;
export const MAX_EXPORT_WIDTH = 1200;
export const MAX_LIGHT_IMG_DIM = 1280;

export const GBG = '#040400';
export const SCRAMBLE = '▓▒░#@$%&*+=?<>/\\|01{}[]~^';

export const MONO = "'VT323','Courier New',monospace";

// ═════════════════════════════════════════════════════════════════════
// CHARACTER SETS
// ═════════════════════════════════════════════════════════════════════
export const CHARSETS = [
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

export const CHARSET_NAMES = [
  'DENSE BLOCKS  ░▒▓█','FINE DETAIL  16-level classic','ULTRA FINE  22-level','MINIMAL  . : | #',
  'NUMBERS  0123456789','HEX  0-9 A-F','SYMBOLS  + * % $ # @','KATAKANA  ｦｧｨｩｪ…',
  'MATRIX  ﾊﾋｼ0ｸZ…','BOX DRAWING  ─│┼╔╗','HATCHING  ░▒▓ : / \\ |','BRAILLE  ⠁⠃⠇⠿⣿',
  'UNICODE BLOCKS  ▁▂▃▄▅▆▇█','DOTS  · • ● ◉ ◎','MIXED DENSE  all printable','BINARY  0 1',
  'RUNES  ᚠᚢᚦᚨᚱ','MATH  ∑∫∂√∞≈','CIRCUIT  ╌┼╬▚▞▓',
];

export const COLOR_SET: [string, string, string?][] = [
  ['#39ff14','GREEN'],['#ffb000','AMBER'],['#e8e8d8','WHITE','#aaa'],['#00cfff','BLUE'],
  ['#00ffee','CYAN'],['#cc44ff','VIOLET'],['#ff3b3b','RED'],['#ff7a1a','ORANGE'],
  ['#ffe600','YELLOW'],['#b6ff00','LIME'],['#7dffb2','MINT'],['#ff6ad5','PINK'],
  ['#ff00aa','MAGENTA'],['#3d5cff','COBALT'],['#b8f0ff','ICE'],
];

export const colorBtns = (cur: string, extra = ''): string =>
  COLOR_SET.map(([c, n, sw]) =>
    `<button class="cbtn${cur === c ? ' active' : ''}" data-c="${c}" data-color="${c}" ${extra} style="color:${sw || c}">■ ${n}</button>`
  ).join('');

// ═════════════════════════════════════════════════════════════════════
// PALETTES
// ═════════════════════════════════════════════════════════════════════
export const PALETTES: Record<string, string[]> = {
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

// ═════════════════════════════════════════════════════════════════════
// LIGHT PRESETS
// ═════════════════════════════════════════════════════════════════════
export const LIGHT_PRESETS: Record<string, Omit<LightCfg, 'on'>> = {
  stencil:  { black:40, soft:4, tones:3, ceil:56, shade:30, detail:45, grain:0, clean:35 },
  textured: { black:34, soft:10, tones:5, ceil:72, shade:70, detail:85, grain:18, clean:20 },
  deep:     { black:55, soft:2, tones:2, ceil:82, shade:10, detail:25, grain:0, clean:45 },
};

// ═════════════════════════════════════════════════════════════════════
// TEXT ANIMATION DEFAULTS
// ═════════════════════════════════════════════════════════════════════
export const ANIM_DEFAULT: TextAnim = {
  kind: 'fade', dur: 1400, delay: 200, ease: 'out', loop: false,
  hold: 2500, outKind: 'reverse', outDur: 900, gap: 500, loops: 0,
  unit: 'char', order: 'forward', soft: 0.35, seed: 7, cursor: 'off',
};

// ═════════════════════════════════════════════════════════════════════
// ROLL TRANSITION STYLE SETS
// ═════════════════════════════════════════════════════════════════════
export const TEMP_STYLES = new Set(['peek', 'subliminal', 'hold']);
export const PASSIVE_STYLES = new Set(['intrude', 'ghost']);
