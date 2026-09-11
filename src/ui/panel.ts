/** Cajas, botones y barras con estética de pixel art para toda la interfaz. */

import { drawText, textWidth } from '../engine/font';

export const UI = {
  ink: '#221c2a',
  panel: '#2f2740',
  panelLight: '#3d3352',
  border: '#f5ecdd',
  text: '#f5ecdd',
  dim: '#a89fba',
  good: '#8ce89a',
  warn: '#ffd36a',
  bad: '#ff7a7a',
  gold: '#ffd36a',
  highlight: '#ffb03f',
};

export function drawPanel(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  scale = 1,
  fill = UI.panel,
  border = UI.border,
): void {
  const b = scale;
  ctx.fillStyle = 'rgba(12, 9, 18, 0.45)';
  ctx.fillRect(x + b * 3, y + b * 3, w, h);
  ctx.fillStyle = border;
  ctx.fillRect(x - b, y - b, w + b * 2, h + b * 2);
  ctx.fillStyle = fill;
  ctx.fillRect(x, y, w, h);
}

export function drawBar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  ratio: number,
  color: string,
  back = '#1b1626',
): void {
  ctx.fillStyle = back;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = color;
  const filled = Math.max(0, Math.min(1, ratio));
  ctx.fillRect(x, y, Math.round(w * filled), h);
}

export interface ButtonStyle {
  selected?: boolean;
  disabled?: boolean;
  color?: string;
}

export function drawButton(
  ctx: CanvasRenderingContext2D,
  label: string,
  x: number,
  y: number,
  w: number,
  h: number,
  scale: number,
  style: ButtonStyle = {},
): void {
  const fill = style.disabled ? '#3a3448' : style.selected ? (style.color ?? UI.highlight) : UI.panelLight;
  const text = style.disabled ? '#6f6885' : style.selected ? '#2a1f12' : UI.text;
  ctx.fillStyle = style.selected ? UI.border : '#1b1626';
  ctx.fillRect(x - scale, y - scale, w + scale * 2, h + scale * 2);
  ctx.fillStyle = fill;
  ctx.fillRect(x, y, w, h);
  // El texto se achica hasta entrar: así una etiqueta larga no se sale del botón.
  let textScale = scale;
  while (textScale > 1 && textWidth(label, textScale) > w - 4 * scale) textScale--;
  drawText(ctx, label, Math.round(x + w / 2), Math.round(y + (h - 8 * textScale) / 2), {
    color: text,
    align: 'center',
    scale: textScale,
  });
}

/** Chip redondeado para atajos de teclado (WASD, flechas, etc.). */
export function drawKeyCap(
  ctx: CanvasRenderingContext2D,
  label: string,
  x: number,
  y: number,
  scale: number,
): number {
  const w = textWidth(label, scale) + 6 * scale;
  const h = 8 * scale + 4 * scale;
  ctx.fillStyle = UI.border;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = '#4a4360';
  ctx.fillRect(x + scale, y + scale, w - scale * 2, h - scale * 2);
  drawText(ctx, label, Math.round(x + w / 2), Math.round(y + 2 * scale), {
    color: UI.text,
    align: 'center',
    scale,
  });
  return w;
}

export function uiScaleFor(w: number, h: number): number {
  // Redondear en vez de truncar evita textos de 5 px en pantallas de celular.
  return Math.max(1, Math.min(4, Math.round(Math.min(w / 250, h / 190))));
}
