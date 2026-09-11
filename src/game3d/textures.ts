/**
 * Texturas generadas por código para el local en 3D.
 *
 * No hay archivos de imagen: el piso, las paredes y las etiquetas de los
 * productos se dibujan en un canvas y se suben a la GPU. Las etiquetas reusan
 * los mismos íconos de pixel art del resto del juego, así el envase de la
 * góndola y el ícono del menú son el mismo dibujo.
 */

import { CanvasTexture, LinearFilter, NearestFilter, RepeatWrapping, SRGBColorSpace, type Texture } from 'three';
import { bake } from '../engine/pixel';
import { drawText, textWidth } from '../engine/font';
import { SHAPES } from '../art/items';
import { product } from '../game/data/products';

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

  const def = product(id);
  const size = 128;
  const ctx = canvas(size);
  const fondo = def.colors[1] ?? '#d8d2c4';
  const acento = def.colors.T ?? def.colors.W ?? '#ffffff';

  ctx.fillStyle = fondo;
  ctx.fillRect(0, 0, size, size);
  // Franja diagonal de marca.
  ctx.save();
  ctx.globalAlpha = 0.18;
  ctx.fillStyle = acento;
  ctx.beginPath();
  ctx.moveTo(0, size);
  ctx.lineTo(size, size * 0.35);
  ctx.lineTo(size, size);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // Ícono de pixel art, el mismo del menú y del HUD.
  const icono = bake(SHAPES[def.shape], def.colors, `item|${def.id}`);
  const escala = 7;
  ctx.drawImage(
    icono.canvas,
    Math.round((size - icono.w * escala) / 2),
    Math.round(size * 0.3),
    icono.w * escala,
    icono.h * escala,
  );

  // Nombre arriba, sobre una banda clara.
  const nombre = def.name.toUpperCase();
  let escalaTexto = 3;
  while (escalaTexto > 1 && textWidth(nombre, escalaTexto) > size - 12) escalaTexto--;
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  ctx.fillRect(6, 8, size - 12, 12 * escalaTexto);
  drawText(ctx, nombre, size / 2, 8 + 2 * escalaTexto, {
    color: '#2f2836',
    align: 'center',
    scale: escalaTexto,
  });

  // Código de barras abajo: detalle chico que vende la ilusión de envase.
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.fillRect(size * 0.28, size - 26, size * 0.44, 18);
  ctx.fillStyle = '#2f2836';
  for (let x = 0; x < size * 0.4; x += 3) {
    const ancho = 1 + Math.round(Math.random() * 1.5);
    ctx.fillRect(size * 0.3 + x, size - 24, ancho, 14);
  }

  return finish(ctx, key);
}

/** Cartón corrugado con el ícono del producto estampado. */
export function boxTexture(id: string): Texture {
  const key = `carton|${id}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const def = product(id);
  const size = 128;
  const ctx = canvas(size);
  ctx.fillStyle = '#c08a52';
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = 'rgba(0,0,0,0.08)';
  for (let y = 0; y < size; y += 6) ctx.fillRect(0, y, size, 2);
  ctx.strokeStyle = '#8a5a2f';
  ctx.lineWidth = 5;
  ctx.strokeRect(3, 3, size - 6, size - 6);

  const icono = bake(SHAPES[def.shape], def.colors, `item|${def.id}`);
  const escala = 6;
  ctx.drawImage(
    icono.canvas,
    Math.round((size - icono.w * escala) / 2),
    24,
    icono.w * escala,
    icono.h * escala,
  );
  const nombre = def.name.toUpperCase();
  let escalaTexto = 2;
  while (escalaTexto > 1 && textWidth(nombre, escalaTexto) > size - 16) escalaTexto--;
  drawText(ctx, nombre, size / 2, size - 26, {
    color: '#4a2f18',
    align: 'center',
    scale: escalaTexto,
  });
  return finish(ctx, key);
}

/** Cartel del local colgado sobre las cajas. */
export function signTexture(nombre: string, color: string): Texture {
  const key = `cartel|${nombre}|${color}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const ctx = canvas(256, 64);
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, 256, 64);
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.fillRect(0, 0, 256, 6);
  const texto = nombre.toUpperCase();
  let escala = 5;
  while (escala > 1 && textWidth(texto, escala) > 236) escala--;
  drawText(ctx, texto, 128, (64 - 8 * escala) / 2, {
    color: '#ffffff',
    align: 'center',
    scale: escala,
    shadow: 'rgba(0,0,0,0.35)',
  });
  return finish(ctx, key);
}

export function disposeTextures(): void {
  for (const tex of cache.values()) tex.dispose();
  cache.clear();
}
