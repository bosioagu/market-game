/**
 * Interfaz moderna: la que se usa cuando el local se ve en 3D.
 *
 * La vista de pixel art conserva su HUD de plaquitas y tipografía bitmap, que
 * ahí queda perfecto. Sobre el 3D, en cambio, esa mezcla de épocas era lo que
 * más "viejo" hacía ver al juego, así que este módulo define el otro idioma:
 * vidrio oscuro translúcido, esquinas redondeadas y una tipografía limpia.
 *
 * Todo se dibuja en el mismo canvas 2D que ya existía; no hay DOM ni CSS.
 */

export const T = {
  /** Superficies de vidrio oscuro. */
  surface: 'rgba(17, 19, 28, 0.82)',
  surfaceStrong: 'rgba(13, 15, 22, 0.94)',
  surfaceSoft: 'rgba(30, 33, 45, 0.9)',
  scrim: 'rgba(8, 9, 14, 0.72)',
  border: 'rgba(255, 255, 255, 0.14)',
  borderStrong: 'rgba(255, 255, 255, 0.28)',

  text: '#f4f6fb',
  textDim: 'rgba(244, 246, 251, 0.62)',
  textFaint: 'rgba(244, 246, 251, 0.38)',
  ink: '#12141c',

  good: '#3ddc84',
  warn: '#ffb020',
  bad: '#ff5c5c',
  money: '#ffd45e',

  radius: 14,
  radiusSmall: 9,
  radiusPill: 999,
};

const STACK = '"Nunito", system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", sans-serif';

export type Weight = 600 | 800;

export function font(size: number, weight: Weight = 600): string {
  return `${weight} ${Math.round(size)}px ${STACK}`;
}

/** Pide la tipografía web; si no llega, la pila del sistema se ve bien igual. */
export function preloadFont(): void {
  const fonts = (document as Document & { fonts?: FontFaceSet }).fonts;
  if (!fonts?.load) return;
  void fonts.load(font(16, 600)).catch(() => undefined);
  void fonts.load(font(16, 800)).catch(() => undefined);
}

/** Escala de la interfaz según el tamaño de la mitad de pantalla. */
export function uiScale(w: number, h: number): number {
  return clampNum(Math.min(w / 420, h / 300), 0.72, 1.5);
}

function clampNum(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

/** Camino de rectángulo redondeado, sin depender de `roundRect`. */
export function roundedPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const radio = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radio, y);
  ctx.arcTo(x + w, y, x + w, y + h, radio);
  ctx.arcTo(x + w, y + h, x, y + h, radio);
  ctx.arcTo(x, y + h, x, y, radio);
  ctx.arcTo(x, y, x + w, y, radio);
  ctx.closePath();
}

export interface CardStyle {
  radius?: number;
  fill?: string;
  border?: string;
  /** Sombra suave debajo; la que da sensación de capa flotante. */
  shadow?: boolean;
  /** Línea de luz en el borde superior, como un vidrio biselado. */
  sheen?: boolean;
}

export function card(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  style: CardStyle = {},
): void {
  const r = style.radius ?? T.radius;
  ctx.save();
  if (style.shadow !== false) {
    ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
    ctx.shadowBlur = 18;
    ctx.shadowOffsetY = 6;
  }
  roundedPath(ctx, x, y, w, h, r);
  ctx.fillStyle = style.fill ?? T.surface;
  ctx.fill();
  ctx.restore();

  ctx.save();
  roundedPath(ctx, x + 0.5, y + 0.5, w - 1, h - 1, r);
  ctx.strokeStyle = style.border ?? T.border;
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();

  if (style.sheen) {
    ctx.save();
    roundedPath(ctx, x, y, w, h, r);
    ctx.clip();
    const g = ctx.createLinearGradient(0, y, 0, y + h * 0.5);
    g.addColorStop(0, 'rgba(255,255,255,0.10)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x, y, w, h * 0.5);
    ctx.restore();
  }
}

export interface TextStyle {
  size: number;
  weight?: Weight;
  color?: string;
  align?: CanvasTextAlign;
  baseline?: CanvasTextBaseline;
  /** Espaciado extra entre letras, para etiquetas chiquitas en mayúsculas. */
  tracking?: number;
  alpha?: number;
}

export function text(
  ctx: CanvasRenderingContext2D,
  str: string,
  x: number,
  y: number,
  style: TextStyle,
): number {
  ctx.save();
  ctx.font = font(style.size, style.weight ?? 600);
  ctx.fillStyle = style.color ?? T.text;
  ctx.textBaseline = style.baseline ?? 'top';
  if (style.alpha !== undefined) ctx.globalAlpha *= style.alpha;

  const tracking = style.tracking ?? 0;
  if (tracking === 0) {
    ctx.textAlign = style.align ?? 'left';
    ctx.fillText(str, x, y);
    const w = ctx.measureText(str).width;
    ctx.restore();
    return w;
  }

  // Con tracking hay que ir letra por letra: el canvas no lo soporta.
  const total = measure(ctx, str, style) ;
  let cursor = x;
  if (style.align === 'center') cursor = x - total / 2;
  else if (style.align === 'right') cursor = x - total;
  ctx.textAlign = 'left';
  for (const ch of str) {
    ctx.fillText(ch, cursor, y);
    cursor += ctx.measureText(ch).width + tracking;
  }
  ctx.restore();
  return total;
}

export function measure(ctx: CanvasRenderingContext2D, str: string, style: TextStyle): number {
  ctx.save();
  ctx.font = font(style.size, style.weight ?? 600);
  let w = 0;
  const tracking = style.tracking ?? 0;
  if (tracking === 0) {
    w = ctx.measureText(str).width;
  } else {
    for (const ch of str) w += ctx.measureText(ch).width + tracking;
    w -= tracking;
  }
  ctx.restore();
  return w;
}

/** Etiqueta chiquita en mayúsculas, del tipo "DÍA" o "FAMA". */
export function label(
  ctx: CanvasRenderingContext2D,
  str: string,
  x: number,
  y: number,
  size: number,
  color = T.textDim,
  align: CanvasTextAlign = 'left',
): void {
  text(ctx, str.toUpperCase(), x, y, { size, weight: 800, color, align, tracking: size * 0.09 });
}

/** Cápsula de color con texto adentro: nivel, estado de precio, atajo de tecla. */
export function chip(
  ctx: CanvasRenderingContext2D,
  str: string,
  x: number,
  y: number,
  size: number,
  color: string,
  opts: { align?: 'left' | 'right'; solid?: boolean } = {},
): { w: number; h: number } {
  const padX = size * 0.7;
  const h = size * 1.85;
  const w = measure(ctx, str, { size, weight: 800 }) + padX * 2;
  const px = opts.align === 'right' ? x - w : x;
  ctx.save();
  roundedPath(ctx, px, y, w, h, T.radiusPill);
  if (opts.solid) {
    ctx.fillStyle = color;
    ctx.fill();
  } else {
    ctx.fillStyle = mixAlpha(color, 0.18);
    ctx.fill();
    ctx.strokeStyle = mixAlpha(color, 0.5);
    ctx.lineWidth = 1;
    ctx.stroke();
  }
  ctx.restore();
  text(ctx, str, px + w / 2, y + h / 2, {
    size,
    weight: 800,
    color: opts.solid ? T.ink : color,
    align: 'center',
    baseline: 'middle',
  });
  return { w, h };
}

/** Barra de progreso con puntas redondeadas. */
export function bar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  ratio: number,
  color: string,
  track = 'rgba(255,255,255,0.12)',
): void {
  roundedPath(ctx, x, y, w, h, h / 2);
  ctx.fillStyle = track;
  ctx.fill();
  const filled = Math.max(0, Math.min(1, ratio)) * w;
  if (filled <= 0.5) return;
  ctx.save();
  roundedPath(ctx, x, y, w, h, h / 2);
  ctx.clip();
  roundedPath(ctx, x, y, Math.max(h, filled), h, h / 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.restore();
}

/** Convierte un color sólido en el mismo color con transparencia. */
export function mixAlpha(color: string, alpha: number): string {
  if (color.startsWith('#')) {
    const hex = color.slice(1);
    const full = hex.length === 3 ? hex.split('').map((c) => c + c).join('') : hex;
    const n = parseInt(full, 16);
    return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
  }
  if (color.startsWith('rgb(')) return color.replace('rgb(', 'rgba(').replace(')', `, ${alpha})`);
  return color;
}

export type IconName = 'reloj' | 'moneda' | 'estrella' | 'caja' | 'alerta' | 'carro';

/** Íconos vectoriales simples, para no mezclar pixel art con esta interfaz. */
export function icon(
  ctx: CanvasRenderingContext2D,
  name: IconName,
  cx: number,
  cy: number,
  size: number,
  color: string,
): void {
  const r = size / 2;
  ctx.save();
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(1.4, size * 0.11);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  switch (name) {
    case 'reloj':
      ctx.beginPath();
      ctx.arc(cx, cy, r * 0.88, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx, cy - r * 0.45);
      ctx.lineTo(cx, cy);
      ctx.lineTo(cx + r * 0.4, cy + r * 0.18);
      ctx.stroke();
      break;
    case 'moneda':
      ctx.beginPath();
      ctx.arc(cx, cy, r * 0.9, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalCompositeOperation = 'destination-out';
      ctx.beginPath();
      ctx.arc(cx, cy, r * 0.58, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillRect(cx - size * 0.06, cy - r * 0.95, size * 0.12, size * 0.38);
      ctx.fillRect(cx - size * 0.06, cy + r * 0.57, size * 0.12, size * 0.38);
      break;
    case 'estrella': {
      ctx.beginPath();
      for (let i = 0; i < 10; i++) {
        const ang = (Math.PI / 5) * i - Math.PI / 2;
        const rad = i % 2 === 0 ? r : r * 0.45;
        const px = cx + Math.cos(ang) * rad;
        const py = cy + Math.sin(ang) * rad;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      break;
    }
    case 'caja':
      ctx.beginPath();
      ctx.rect(cx - r * 0.85, cy - r * 0.65, r * 1.7, r * 1.35);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx - r * 0.85, cy - r * 0.2);
      ctx.lineTo(cx + r * 0.85, cy - r * 0.2);
      ctx.moveTo(cx, cy - r * 0.65);
      ctx.lineTo(cx, cy + r * 0.7);
      ctx.stroke();
      break;
    case 'alerta':
      ctx.beginPath();
      ctx.moveTo(cx, cy - r);
      ctx.lineTo(cx + r, cy + r * 0.8);
      ctx.lineTo(cx - r, cy + r * 0.8);
      ctx.closePath();
      ctx.stroke();
      ctx.fillRect(cx - size * 0.055, cy - r * 0.3, size * 0.11, size * 0.42);
      ctx.beginPath();
      ctx.arc(cx, cy + r * 0.48, size * 0.07, 0, Math.PI * 2);
      ctx.fill();
      break;
    case 'carro':
      ctx.beginPath();
      ctx.moveTo(cx - r * 0.9, cy - r * 0.6);
      ctx.lineTo(cx - r * 0.5, cy - r * 0.6);
      ctx.lineTo(cx - r * 0.1, cy + r * 0.35);
      ctx.lineTo(cx + r * 0.8, cy + r * 0.35);
      ctx.lineTo(cx + r * 0.95, cy - r * 0.35);
      ctx.lineTo(cx - r * 0.32, cy - r * 0.35);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx + r * 0.05, cy + r * 0.75, size * 0.1, 0, Math.PI * 2);
      ctx.arc(cx + r * 0.7, cy + r * 0.75, size * 0.1, 0, Math.PI * 2);
      ctx.fill();
      break;
  }
  ctx.restore();
}

/**
 * Contador que se acerca al valor real en vez de saltar.
 * Es el detalle que hace que la plata "suba" al vender.
 */
export class Contador {
  private actual: number;

  constructor(inicial = 0) {
    this.actual = inicial;
  }

  update(objetivo: number, dt: number): number {
    const delta = objetivo - this.actual;
    if (Math.abs(delta) < 0.6) {
      this.actual = objetivo;
      return this.actual;
    }
    this.actual += delta * Math.min(1, dt * 9);
    return this.actual;
  }

  get valor(): number {
    return this.actual;
  }

  set(valor: number): void {
    this.actual = valor;
  }
}

export function moneda(valor: number): string {
  return '$' + Math.round(valor).toLocaleString('es-AR');
}
