/**
 * Texturas generadas por código para el local en 3D.
 *
 * No hay archivos de imagen: el piso, las paredes y las etiquetas de los
 * productos se dibujan en un canvas y se suben a la GPU. Las etiquetas reusan
 * los mismos íconos de pixel art del resto del juego, así el envase de la
 * góndola y el ícono del menú son el mismo dibujo.
 */

import { CanvasTexture, LinearFilter, NearestFilter, RepeatWrapping, SRGBColorSpace, type Texture } from 'three';
import { product } from '../game/data/products';
import { font, roundedPath } from '../ui2/theme';

const cache = new Map<string, Texture>();

function canvas(size: number, height = size): CanvasRenderingContext2D {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = height;
  const ctx = c.getContext('2d');
  if (!ctx) throw new Error('sin contexto 2D');
  ctx.imageSmoothingEnabled = false;
  return ctx;
}

function finish(ctx: CanvasRenderingContext2D, key: string, repeat?: [number, number], smooth = false): Texture {
  const tex = new CanvasTexture(ctx.canvas);
  tex.colorSpace = SRGBColorSpace;
  tex.magFilter = smooth ? LinearFilter : NearestFilter;
  tex.minFilter = LinearFilter;
  tex.generateMipmaps = true;
  if (repeat) {
    tex.wrapS = RepeatWrapping;
    tex.wrapT = RepeatWrapping;
    tex.repeat.set(repeat[0], repeat[1]);
  }
  cache.set(key, tex);
  return tex;
}

/** Piso de baldosas grandes y brillantes, como el de un supermercado. */
export function floorTexture(base: string, grout: string, repeat: [number, number]): Texture {
  const key = `piso|${base}|${grout}|${repeat.join('x')}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const ctx = canvas(128);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 128, 128);
  // Veteado suave para que no se vea como un color plano.
  for (let i = 0; i < 240; i++) {
    const x = Math.random() * 128;
    const y = Math.random() * 128;
    ctx.fillStyle = `rgba(255,255,255,${0.02 + Math.random() * 0.05})`;
    ctx.fillRect(x, y, 1 + Math.random() * 6, 1);
  }
  ctx.fillStyle = grout;
  ctx.fillRect(0, 0, 128, 3);
  ctx.fillRect(0, 0, 3, 128);
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.fillRect(3, 3, 125, 1);
  ctx.fillRect(3, 3, 1, 125);
  return finish(ctx, key, repeat, true);
}

/** Pared pintada con zócalo. */
export function wallTexture(base: string, trim: string, repeat: [number, number]): Texture {
  const key = `pared|${base}|${trim}|${repeat.join('x')}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const ctx = canvas(64, 128);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 64, 128);
  ctx.fillStyle = 'rgba(0,0,0,0.06)';
  ctx.fillRect(0, 112, 64, 16);
  ctx.fillStyle = trim;
  ctx.fillRect(0, 108, 64, 5);
  return finish(ctx, key, repeat, true);
}

/** Cielorraso de placas con junta. */
export function ceilingTexture(repeat: [number, number]): Texture {
  const key = `cielo|${repeat.join('x')}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const ctx = canvas(64);
  ctx.fillStyle = '#f2f3f5';
  ctx.fillRect(0, 0, 64, 64);
  ctx.fillStyle = '#d9dce0';
  ctx.fillRect(0, 0, 64, 2);
  ctx.fillRect(0, 0, 2, 64);
  return finish(ctx, key, repeat, true);
}

/**
 * Envase de un producto: color de marca, el ícono grande y el nombre.
 * Es lo que llena las góndolas, así que es la textura que más se ve.
 */
export function productTexture(id: string): Texture {
  const key = `envase|${id}`;
  const hit = cache.get(key);
  if (hit) return hit;
  return finish(drawPackage(id), key, undefined, true);
}

/**
 * El mismo envase, pero como canvas: la interfaz moderna lo usa de miniatura,
 * así la lista del mayorista muestra el producto tal como se ve en la góndola.
 */
export function packageCanvas(id: string): HTMLCanvasElement {
  let c = packageCache.get(id);
  if (!c) {
    c = drawPackage(id).canvas;
    packageCache.set(id, c);
  }
  return c;
}

const packageCache = new Map<string, HTMLCanvasElement>();

/**
 * Envase de un producto.
 *
 * Es la textura que más se ve: hay cientos en las góndolas. Se dibuja como un
 * paquete de verdad —color de marca, etiqueta blanca con el nombre, categoría
 * en chico y código de barras— con la misma tipografía que el resto de la
 * interfaz de la vista 3D.
 */
function drawPackage(id: string): CanvasRenderingContext2D {
  const def = product(id);
  const size = 128;
  const ctx = canvas(size);
  const marca = def.colors[1] ?? '#d8d2c4';
  const acento = def.colors.T ?? def.colors.W ?? '#ffffff';

  ctx.fillStyle = marca;
  ctx.fillRect(0, 0, size, size);

  // Franja de color en diagonal: le da identidad a cada marca.
  ctx.save();
  ctx.globalAlpha = 0.35;
  ctx.fillStyle = acento;
  ctx.beginPath();
  ctx.moveTo(0, size);
  ctx.lineTo(size, size * 0.52);
  ctx.lineTo(size, size);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // Etiqueta blanca con el nombre.
  const etiquetaY = 20;
  const etiquetaH = 62;
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.25)';
  ctx.shadowBlur = 6;
  ctx.shadowOffsetY = 2;
  roundedPath(ctx, 10, etiquetaY, size - 20, etiquetaH, 9);
  ctx.fillStyle = '#fbfcfe';
  ctx.fill();
  ctx.restore();

  ctx.fillStyle = acento;
  ctx.fillRect(10, etiquetaY, size - 20, 5);

  const lineas = ajustarNombre(ctx, def.name.toUpperCase(), size - 28);
  ctx.fillStyle = '#1b1e28';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const tam = lineas.tam;
  lineas.lineas.forEach((linea, i) => {
    ctx.font = font(tam, 800);
    ctx.fillText(linea, size / 2, etiquetaY + 34 + (i - (lineas.lineas.length - 1) / 2) * (tam + 3));
  });

  // Categoría, en chiquito, como el "tipo de producto" de un envase real.
  ctx.font = font(9, 800);
  ctx.fillStyle = 'rgba(27, 30, 40, 0.55)';
  ctx.fillText(def.category.toUpperCase(), size / 2, etiquetaY + etiquetaH - 11);

  // Código de barras.
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  roundedPath(ctx, size * 0.22, size - 30, size * 0.56, 20, 4);
  ctx.fill();
  ctx.fillStyle = '#1b1e28';
  let bx = size * 0.25;
  while (bx < size * 0.74) {
    const ancho = 1 + Math.round(Math.random() * 2);
    ctx.fillRect(bx, size - 27, ancho, 14);
    bx += ancho + 1 + Math.round(Math.random());
  }

  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  return ctx;
}

/** Elige tamaño y corte del nombre para que entre en la etiqueta. */
function ajustarNombre(
  ctx: CanvasRenderingContext2D,
  nombre: string,
  ancho: number,
): { lineas: string[]; tam: number } {
  for (let tam = 20; tam >= 11; tam -= 1) {
    ctx.font = font(tam, 800);
    if (ctx.measureText(nombre).width <= ancho) return { lineas: [nombre], tam };
  }
  // No entra en un renglón: lo partimos en dos por la palabra más conveniente.
  const palabras = nombre.split(' ');
  if (palabras.length > 1) {
    for (let tam = 16; tam >= 9; tam -= 1) {
      ctx.font = font(tam, 800);
      const corte = Math.ceil(palabras.length / 2);
      const a = palabras.slice(0, corte).join(' ');
      const b = palabras.slice(corte).join(' ');
      if (Math.max(ctx.measureText(a).width, ctx.measureText(b).width) <= ancho) {
        return { lineas: [a, b], tam };
      }
    }
  }
  return { lineas: [nombre], tam: 9 };
}

/** Caja de cartón del depósito, con el nombre estampado como un envío real. */
export function boxTexture(id: string): Texture {
  const key = `carton|${id}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const def = product(id);
  const size = 128;
  const ctx = canvas(size);

  ctx.fillStyle = '#c08a52';
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = 'rgba(0,0,0,0.07)';
  for (let y = 0; y < size; y += 7) ctx.fillRect(0, y, size, 2);
  ctx.strokeStyle = 'rgba(122, 78, 40, 0.9)';
  ctx.lineWidth = 5;
  ctx.strokeRect(3, 3, size - 6, size - 6);
  // Cinta de embalar por el medio.
  ctx.fillStyle = 'rgba(214, 180, 130, 0.85)';
  ctx.fillRect(0, size / 2 - 9, size, 18);

  ctx.fillStyle = def.colors[1] ?? '#8a5a2f';
  roundedPath(ctx, 22, 22, size - 44, 30, 6);
  ctx.fill();

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const lineas = ajustarNombre(ctx, def.name.toUpperCase(), size - 56);
  ctx.fillStyle = '#fdfdfd';
  lineas.lineas.forEach((linea, i) => {
    ctx.font = font(Math.min(lineas.tam, 15), 800);
    ctx.fillText(linea, size / 2, 37 + (i - (lineas.lineas.length - 1) / 2) * 15);
  });

  ctx.font = font(11, 800);
  ctx.fillStyle = 'rgba(74, 47, 24, 0.9)';
  ctx.fillText(`${def.perBox} unidades`, size / 2, size - 26);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  return finish(ctx, key);
}

/** Cartel del local, colgado sobre la pared del fondo. */
export function signTexture(nombre: string, color: string): Texture {
  const key = `cartel|${nombre}|${color}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const ctx = canvas(256, 64);
  roundedPath(ctx, 2, 2, 252, 60, 14);
  ctx.fillStyle = color;
  ctx.fill();
  roundedPath(ctx, 6, 6, 244, 24, 10);
  ctx.fillStyle = 'rgba(255,255,255,0.16)';
  ctx.fill();

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  let tam = 34;
  while (tam > 14) {
    ctx.font = font(tam, 800);
    if (ctx.measureText(nombre).width <= 228) break;
    tam -= 1;
  }
  ctx.fillStyle = '#ffffff';
  ctx.shadowColor = 'rgba(0,0,0,0.35)';
  ctx.shadowBlur = 4;
  ctx.shadowOffsetY = 2;
  ctx.fillText(nombre, 128, 34);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  return finish(ctx, key, undefined, true);
}

export function disposeTextures(): void {
  for (const tex of cache.values()) tex.dispose();
  cache.clear();
}
