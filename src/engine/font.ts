/**
 * Tipografía bitmap 5x8 dibujada a mano.
 *
 * Un juego de gestión es 50% texto (precios, stock, menús), así que usar una
 * fuente del sistema rompería el look. Esta se dibuja pixel a pixel, tiene
 * acentos y eñe, y se colorea on-demand cacheando un atlas por color.
 */

type Glyph = readonly string[];

const G: Record<string, Glyph> = {
  ' ': ['.....', '.....', '.....', '.....', '.....', '.....', '.....', '.....'],
  A: ['.....', '.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  B: ['.....', '####.', '#...#', '#...#', '####.', '#...#', '#...#', '####.'],
  C: ['.....', '.####', '#....', '#....', '#....', '#....', '#....', '.####'],
  D: ['.....', '####.', '#...#', '#...#', '#...#', '#...#', '#...#', '####.'],
  E: ['.....', '#####', '#....', '#....', '####.', '#....', '#....', '#####'],
  F: ['.....', '#####', '#....', '#....', '####.', '#....', '#....', '#....'],
  G: ['.....', '.###.', '#...#', '#....', '#..##', '#...#', '#...#', '.###.'],
  H: ['.....', '#...#', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  I: ['.....', '#####', '..#..', '..#..', '..#..', '..#..', '..#..', '#####'],
  J: ['.....', '..###', '...#.', '...#.', '...#.', '...#.', '#..#.', '.##..'],
  K: ['.....', '#...#', '#..#.', '#.#..', '##...', '#.#..', '#..#.', '#...#'],
  L: ['.....', '#....', '#....', '#....', '#....', '#....', '#....', '#####'],
  M: ['.....', '#...#', '##.##', '#.#.#', '#...#', '#...#', '#...#', '#...#'],
  N: ['.....', '#...#', '##..#', '#.#.#', '#..##', '#...#', '#...#', '#...#'],
  O: ['.....', '.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  P: ['.....', '####.', '#...#', '#...#', '####.', '#....', '#....', '#....'],
  Q: ['.....', '.###.', '#...#', '#...#', '#...#', '#.#.#', '#..#.', '.##.#'],
  R: ['.....', '####.', '#...#', '#...#', '####.', '#.#..', '#..#.', '#...#'],
  S: ['.....', '.####', '#....', '#....', '.###.', '....#', '....#', '####.'],
  T: ['.....', '#####', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..'],
  U: ['.....', '#...#', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  V: ['.....', '#...#', '#...#', '#...#', '#...#', '#...#', '.#.#.', '..#..'],
  W: ['.....', '#...#', '#...#', '#...#', '#...#', '#.#.#', '##.##', '#...#'],
  X: ['.....', '#...#', '#...#', '.#.#.', '..#..', '.#.#.', '#...#', '#...#'],
  Y: ['.....', '#...#', '#...#', '.#.#.', '..#..', '..#..', '..#..', '..#..'],
  Z: ['.....', '#####', '....#', '...#.', '..#..', '.#...', '#....', '#####'],
  '0': ['.....', '.###.', '#...#', '#..##', '#.#.#', '##..#', '#...#', '.###.'],
  '1': ['.....', '..#..', '.##..', '..#..', '..#..', '..#..', '..#..', '.###.'],
  '2': ['.....', '.###.', '#...#', '....#', '...#.', '..#..', '.#...', '#####'],
  '3': ['.....', '####.', '....#', '....#', '.###.', '....#', '....#', '####.'],
  '4': ['.....', '...#.', '..##.', '.#.#.', '#..#.', '#####', '...#.', '...#.'],
  '5': ['.....', '#####', '#....', '####.', '....#', '....#', '#...#', '.###.'],
  '6': ['.....', '.###.', '#...#', '#....', '####.', '#...#', '#...#', '.###.'],
  '7': ['.....', '#####', '....#', '...#.', '..#..', '.#...', '.#...', '.#...'],
  '8': ['.....', '.###.', '#...#', '#...#', '.###.', '#...#', '#...#', '.###.'],
  '9': ['.....', '.###.', '#...#', '#...#', '.####', '....#', '#...#', '.###.'],
  '.': ['.....', '.....', '.....', '.....', '.....', '.....', '.##..', '.##..'],
  ',': ['.....', '.....', '.....', '.....', '.....', '.##..', '.##..', '.#...'],
  ':': ['.....', '.....', '.##..', '.##..', '.....', '.##..', '.##..', '.....'],
  ';': ['.....', '.....', '.##..', '.##..', '.....', '.##..', '.#...', '#....'],
  '!': ['.....', '..#..', '..#..', '..#..', '..#..', '..#..', '.....', '..#..'],
  '?': ['.....', '.###.', '#...#', '....#', '...#.', '..#..', '.....', '..#..'],
  "'": ['.....', '..#..', '..#..', '.....', '.....', '.....', '.....', '.....'],
  '"': ['.....', '.#.#.', '.#.#.', '.....', '.....', '.....', '.....', '.....'],
  '-': ['.....', '.....', '.....', '.....', '#####', '.....', '.....', '.....'],
  '+': ['.....', '.....', '..#..', '..#..', '#####', '..#..', '..#..', '.....'],
  '/': ['.....', '....#', '...#.', '...#.', '..#..', '.#...', '.#...', '#....'],
  '=': ['.....', '.....', '.....', '#####', '.....', '#####', '.....', '.....'],
  $: ['.....', '..#..', '.####', '#.#..', '.###.', '..#.#', '####.', '..#..'],
  '%': ['.....', '##..#', '##.#.', '...#.', '..#..', '.#...', '#.##.', '#..##'],
  '(': ['.....', '..##.', '.#...', '.#...', '.#...', '.#...', '.#...', '..##.'],
  ')': ['.....', '.##..', '...#.', '...#.', '...#.', '...#.', '...#.', '.##..'],
  '<': ['.....', '...#.', '..#..', '.#...', '#....', '.#...', '..#..', '...#.'],
  '>': ['.....', '.#...', '..#..', '...#.', '....#', '...#.', '..#..', '.#...'],
  '*': ['.....', '.....', '#.#.#', '.###.', '#####', '.###.', '#.#.#', '.....'],
  '#': ['.....', '.#.#.', '#####', '.#.#.', '.#.#.', '#####', '.#.#.', '.....'],
  '@': ['.....', '.###.', '#...#', '#.###', '#.#.#', '#.###', '#....', '.###.'],
  '&': ['.....', '.##..', '#..#.', '#.#..', '.#...', '#.#.#', '#..#.', '.##.#'],
  _: ['.....', '.....', '.....', '.....', '.....', '.....', '.....', '#####'],
  '|': ['.....', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..'],
  Á: ['...#.', '.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  É: ['...#.', '#####', '#....', '#....', '####.', '#....', '#....', '#####'],
  Í: ['...#.', '#####', '..#..', '..#..', '..#..', '..#..', '..#..', '#####'],
  Ó: ['...#.', '.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  Ú: ['...#.', '#...#', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  Ñ: ['.###.', '#...#', '##..#', '#.#.#', '#..##', '#...#', '#...#', '#...#'],
  Ü: ['.#.#.', '#...#', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  '¿': ['.....', '..#..', '.....', '..#..', '.#...', '#....', '#...#', '.###.'],
  '¡': ['.....', '..#..', '.....', '..#..', '..#..', '..#..', '..#..', '..#..'],
  '←': ['.....', '..#..', '.#...', '#####', '.#...', '..#..', '.....', '.....'],
  '→': ['.....', '..#..', '...#.', '#####', '...#.', '..#..', '.....', '.....'],
  '↑': ['.....', '..#..', '.###.', '#.#.#', '..#..', '..#..', '..#..', '.....'],
  '↓': ['.....', '..#..', '..#..', '..#..', '#.#.#', '.###.', '..#..', '.....'],
  '♥': ['.....', '.#.#.', '#####', '#####', '#####', '.###.', '..#..', '.....'],
  '★': ['.....', '..#..', '..#..', '#####', '.###.', '.#.#.', '#...#', '.....'],
};

export const GLYPH_W = 5;
export const GLYPH_H = 8;
/** Espacio entre caracteres, en píxeles del mundo. */
export const LETTER_SPACING = 1;

const ACCENT_FOLD: Record<string, string> = {
  á: 'Á', é: 'É', í: 'Í', ó: 'Ó', ú: 'Ú', ñ: 'Ñ', ü: 'Ü',
  à: 'Á', è: 'É', ì: 'Í', ò: 'Ó', ù: 'Ú',
};

function normalizeChar(ch: string): string {
  const folded = ACCENT_FOLD[ch];
  if (folded) return folded;
  const upper = ch.toUpperCase();
  return G[upper] ? upper : G[ch] ? ch : '?';
}

const atlases = new Map<string, HTMLCanvasElement>();
const ORDER: string[] = Object.keys(G);
const INDEX = new Map<string, number>(ORDER.map((ch, i) => [ch, i]));

function buildAtlas(color: string): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = ORDER.length * GLYPH_W;
  canvas.height = GLYPH_H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('sin contexto 2D');
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = color;
  ORDER.forEach((ch, i) => {
    const glyph = G[ch];
    const ox = i * GLYPH_W;
    for (let y = 0; y < GLYPH_H; y++) {
      const row = glyph[y];
      for (let x = 0; x < GLYPH_W; x++) {
        if (row[x] === '#') ctx.fillRect(ox + x, y, 1, 1);
      }
    }
  });
  return canvas;
}

function atlas(color: string): HTMLCanvasElement {
  let a = atlases.get(color);
  if (!a) {
    a = buildAtlas(color);
    atlases.set(color, a);
  }
  return a;
}

export interface TextOptions {
  color?: string;
  scale?: number;
  /** 'left' | 'center' | 'right' respecto de x. */
  align?: 'left' | 'center' | 'right';
  /** Sombra dura 1px abajo-derecha, típica del pixel art. */
  shadow?: string;
  /** Contorno de 1px alrededor; mejora la lectura sobre el fondo del local. */
  outline?: string;
  alpha?: number;
}

export function textWidth(text: string, scale = 1): number {
  if (text.length === 0) return 0;
  return (text.length * (GLYPH_W + LETTER_SPACING) - LETTER_SPACING) * scale;
}

export function textHeight(scale = 1): number {
  return GLYPH_H * scale;
}

export function drawText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  opts: TextOptions = {},
): number {
  const scale = opts.scale ?? 1;
  const color = opts.color ?? '#ffffff';
  const width = textWidth(text, scale);
  let startX = x;
  if (opts.align === 'center') startX = Math.round(x - width / 2);
  else if (opts.align === 'right') startX = Math.round(x - width);
  startX = Math.round(startX);
  const startY = Math.round(y);

  const prevAlpha = ctx.globalAlpha;
  if (opts.alpha !== undefined) ctx.globalAlpha = prevAlpha * opts.alpha;

  if (opts.outline) {
    const o = scale;
    for (const [dx, dy] of [[-o, 0], [o, 0], [0, -o], [0, o]] as const) {
      blit(ctx, text, startX + dx, startY + dy, opts.outline, scale);
    }
  }
  if (opts.shadow) {
    blit(ctx, text, startX + scale, startY + scale, opts.shadow, scale);
  }
  blit(ctx, text, startX, startY, color, scale);

  ctx.globalAlpha = prevAlpha;
  return width;
}

function blit(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  color: string,
  scale: number,
): void {
  const sheet = atlas(color);
  const step = (GLYPH_W + LETTER_SPACING) * scale;
  for (let i = 0; i < text.length; i++) {
    const ch = normalizeChar(text[i]);
    if (ch === ' ') continue;
    const idx = INDEX.get(ch);
    if (idx === undefined) continue;
    ctx.drawImage(
      sheet,
      idx * GLYPH_W, 0, GLYPH_W, GLYPH_H,
      x + i * step, y, GLYPH_W * scale, GLYPH_H * scale,
    );
  }
}

/** Parte un texto en líneas que entren en `maxWidth` píxeles. */
export function wrapText(text: string, maxWidth: number, scale = 1): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (textWidth(candidate, scale) <= maxWidth || current === '') {
      current = candidate;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}
