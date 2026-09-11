/**
 * Fábrica de sprites de pixel art.
 *
 * Todo el arte del juego se describe en texto: cada sprite es una lista de filas
 * y cada caracter apunta a un color de la paleta. `.` y ` ` son transparentes.
 * Eso mantiene el arte editable, versionable en git y sin assets binarios.
 */

export type Palette = Record<string, string>;

export interface PixelArt {
  /** Filas de píxeles; todas deben medir lo mismo. */
  rows: readonly string[];
  /** Caracter -> color CSS. */
  pal: Palette;
}

export interface BakedSprite {
  canvas: HTMLCanvasElement;
  w: number;
  h: number;
}

const cache = new Map<string, BakedSprite>();

function createCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function context(c: HTMLCanvasElement): CanvasRenderingContext2D {
  const ctx = c.getContext('2d');
  if (!ctx) throw new Error('No se pudo crear el contexto 2D');
  ctx.imageSmoothingEnabled = false;
  return ctx;
}

/** Convierte el arte en un canvas listo para dibujar. El resultado se cachea. */
export function bake(art: PixelArt, overrides?: Palette, cacheKey?: string): BakedSprite {
  const key = cacheKey ?? keyFor(art, overrides);
  const hit = cache.get(key);
  if (hit) return hit;

  const h = art.rows.length;
  const w = h > 0 ? art.rows[0].length : 0;
  const canvas = createCanvas(Math.max(1, w), Math.max(1, h));
  const ctx = context(canvas);
  const pal: Palette = overrides ? { ...art.pal, ...overrides } : art.pal;

  for (let y = 0; y < h; y++) {
    const row = art.rows[y];
    let x = 0;
    while (x < row.length) {
      const ch = row[x];
      const color = pal[ch];
      if (!color || ch === '.' || ch === ' ') {
        x++;
        continue;
      }
      // Agrupa píxeles contiguos del mismo color en un solo fillRect.
      let run = 1;
      while (x + run < row.length && row[x + run] === ch) run++;
      ctx.fillStyle = color;
      ctx.fillRect(x, y, run, 1);
      x += run;
    }
  }

  const sprite: BakedSprite = { canvas, w: canvas.width, h: canvas.height };
  cache.set(key, sprite);
  return sprite;
}

let autoKey = 0;
const artKeys = new WeakMap<object, string>();

function keyFor(art: PixelArt, overrides?: Palette): string {
  let base = artKeys.get(art);
  if (!base) {
    base = 'art' + autoKey++;
    artKeys.set(art, base);
  }
  if (!overrides) return base;
  const parts: string[] = [];
  for (const k of Object.keys(overrides).sort()) parts.push(k + overrides[k]);
  return base + '|' + parts.join(',');
}

/** Espeja el sprite horizontalmente (para reusar sprites mirando a la izquierda). */
export function flipX(sprite: BakedSprite, cacheKey: string): BakedSprite {
  const hit = cache.get(cacheKey);
  if (hit) return hit;
  const canvas = createCanvas(sprite.w, sprite.h);
  const ctx = context(canvas);
  ctx.translate(sprite.w, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(sprite.canvas, 0, 0);
  const out: BakedSprite = { canvas, w: sprite.w, h: sprite.h };
  cache.set(cacheKey, out);
  return out;
}

/** Silueta sólida del sprite, para destellos y efectos de "golpe". */
export function silhouette(sprite: BakedSprite, color: string, cacheKey: string): BakedSprite {
  const hit = cache.get(cacheKey);
  if (hit) return hit;
  const canvas = createCanvas(sprite.w, sprite.h);
  const ctx = context(canvas);
  ctx.drawImage(sprite.canvas, 0, 0);
  ctx.globalCompositeOperation = 'source-in';
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, sprite.w, sprite.h);
  const out: BakedSprite = { canvas, w: sprite.w, h: sprite.h };
  cache.set(cacheKey, out);
  return out;
}

/** Repite un patrón para rellenar un área (pisos, paredes). */
export function tilePattern(art: PixelArt, w: number, h: number, cacheKey: string): BakedSprite {
  const hit = cache.get(cacheKey);
  if (hit) return hit;
  const tile = bake(art);
  const canvas = createCanvas(w, h);
  const ctx = context(canvas);
  for (let y = 0; y < h; y += tile.h) {
    for (let x = 0; x < w; x += tile.w) {
      ctx.drawImage(tile.canvas, x, y);
    }
  }
  const out: BakedSprite = { canvas, w, h };
  cache.set(cacheKey, out);
  return out;
}

/** Escala el arte en enteros, útil para íconos grandes de UI sin perder nitidez. */
export function bakeScaled(art: PixelArt, scale: number, overrides?: Palette, cacheKey?: string): BakedSprite {
  const key = (cacheKey ?? keyFor(art, overrides)) + '@' + scale;
  const hit = cache.get(key);
  if (hit) return hit;
  const src = bake(art, overrides);
  const canvas = createCanvas(src.w * scale, src.h * scale);
  const ctx = context(canvas);
  ctx.drawImage(src.canvas, 0, 0, canvas.width, canvas.height);
  const out: BakedSprite = { canvas, w: canvas.width, h: canvas.height };
  cache.set(key, out);
  return out;
}

export function clearSpriteCache(): void {
  cache.clear();
}
