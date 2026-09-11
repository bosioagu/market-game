/** Marcadores en pantalla: día, reloj, plata, nivel y avisos de stock. */

import { drawText, textWidth } from '../engine/font';
import { drawBar, UI } from '../ui/panel';
import { clamp } from '../engine/math';
import { careerLevel, type Progress } from './progress';
import { clockFor, DAY_SECONDS, type StoreSim } from './session';
import type { Viewport } from './render';
import { itemSpriteScaled } from './render';
import { product } from './data/products';

export interface HudInfo {
  elapsed: number;
  day: number;
  label?: string;
}

/** Alto que ocupa la franja inferior, para que nada se dibuje encima. */
export const HUD_BOTTOM = 26;

export function drawHud(
  ctx: CanvasRenderingContext2D,
  vp: Viewport,
  sim: StoreSim,
  progress: Progress,
  info: HudInfo,
): void {
  // Redondeamos (no truncamos) para que en celular el texto no quede a escala 1.
  const s = Math.max(1, Math.min(3, Math.round(Math.min(vp.w / 230, vp.h / 180))));
  const pad = 4 * s;

  // --- Izquierda: día, hora y avance de la jornada ---
  const dayText = `DÍA ${info.day}`;
  const clock = clockFor(info.elapsed);
  const leftW = Math.max(textWidth(dayText, s), textWidth(clock, s)) + 10 * s;
  const leftH = 24 * s;
  plaque(ctx, vp.x + pad, vp.y + pad, leftW, leftH);
  drawText(ctx, dayText, vp.x + pad + 5 * s, vp.y + pad + 3 * s, { color: UI.text, scale: s });
  drawText(ctx, clock, vp.x + pad + 5 * s, vp.y + pad + 12 * s, { color: UI.gold, scale: s });
  drawBar(
    ctx,
    vp.x + pad + 5 * s,
    vp.y + pad + leftH - 6 * s,
    leftW - 10 * s,
    2 * s,
    clamp(info.elapsed / DAY_SECONDS, 0, 1),
    sim.def.accent,
  );

  // --- Derecha: plata, tienda/nivel y fama ---
  const money = `$${Math.round(sim.money)}`;
  const storeLine = `${sim.def.name.toUpperCase()} NV.${careerLevel(progress)}`;
  const rightW = Math.max(textWidth(money, s), textWidth(storeLine, s), 60 * s) + 10 * s;
  const rightH = 32 * s;
  const rx = vp.x + vp.w - pad - rightW;
  plaque(ctx, rx, vp.y + pad, rightW, rightH);
  drawText(ctx, money, rx + rightW - 5 * s, vp.y + pad + 3 * s, {
    color: UI.gold,
    align: 'right',
    scale: s,
  });
  drawText(ctx, storeLine, rx + rightW - 5 * s, vp.y + pad + 12 * s, {
    color: UI.text,
    align: 'right',
    scale: s,
  });
  const famaW = textWidth('FAMA', s);
  drawText(ctx, 'FAMA', rx + 5 * s, vp.y + pad + 22 * s, { color: UI.dim, scale: s });
  drawBar(
    ctx,
    rx + 8 * s + famaW,
    vp.y + pad + 23 * s,
    rightW - famaW - 13 * s,
    4 * s,
    sim.reputation,
    sim.reputation > 0.6 ? UI.good : sim.reputation > 0.3 ? UI.warn : UI.bad,
  );

  if (info.label) {
    drawText(ctx, info.label, vp.x + vp.w / 2, vp.y + pad + 2 * s, {
      color: UI.text,
      align: 'center',
      scale: s,
      outline: '#1b1626',
    });
  }

  drawStockAlerts(ctx, vp, sim, s);
}

/** Avisa qué productos se están por acabar: es la información que más se mira. */
function drawStockAlerts(ctx: CanvasRenderingContext2D, vp: Viewport, sim: StoreSim, s: number): void {
  const counts = new Map<string, number>();
  for (const id of sim.catalogue) counts.set(id, 0);
  for (const shelf of sim.world.shelves) {
    if (shelf.productId) counts.set(shelf.productId, (counts.get(shelf.productId) ?? 0) + shelf.units);
  }
  // Sólo avisamos de lo que se puede resolver: o está en góndola y se acaba,
  // o hay cajas en el depósito esperando. Lo que ni siquiera se compró todavía
  // se ve en la pantalla del mayorista, no acá.
  const inBoxes = new Map<string, number>();
  for (const b of sim.world.boxes) inBoxes.set(b.productId, (inBoxes.get(b.productId) ?? 0) + b.units);

  const low = [...counts.entries()]
    .filter(([id, n]) => n <= 2 && (n > 0 || (inBoxes.get(id) ?? 0) > 0 || sim.world.shelves.some((sh) => sh.productId === id)))
    .sort((a, b) => a[1] - b[1])
    .slice(0, 4);
  if (low.length === 0) return;

  const rowH = 12 * s;
  const nameW = Math.max(
    ...low.map(([id]) => textWidth(product(id).name.toUpperCase(), s)),
    textWidth('REPONER', s),
  );
  const icon0 = itemSpriteScaled(low[0][0], s);
  const boxW = nameW + icon0.w + 34 * s;
  const boxH = rowH * low.length + 12 * s;
  const x = vp.x + 4 * s;
  const y = vp.y + vp.h - boxH - HUD_BOTTOM * s;
  plaque(ctx, x, y, boxW, boxH);
  drawText(ctx, 'REPONER', x + 5 * s, y + 3 * s, { color: UI.bad, scale: s });
  low.forEach(([id, n], i) => {
    const ry = y + 12 * s + i * rowH;
    const icon = itemSpriteScaled(id, s);
    ctx.drawImage(icon.canvas, x + 5 * s, ry);
    drawText(ctx, product(id).name.toUpperCase(), x + 8 * s + icon.w, ry + 2 * s, {
      color: n === 0 ? UI.bad : UI.warn,
      scale: s,
    });
    // El punto avisa que ya hay cajas compradas esperando en el depósito.
    const waiting = (inBoxes.get(id) ?? 0) > 0;
    drawText(ctx, waiting ? `${n} •` : String(n), x + boxW - 5 * s, ry + 2 * s, {
      color: n === 0 ? UI.bad : UI.warn,
      align: 'right',
      scale: s,
    });
  });
}

function plaque(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
  ctx.fillStyle = 'rgba(20, 16, 28, 0.78)';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = 'rgba(245, 236, 221, 0.25)';
  ctx.fillRect(x, y, w, 1);
  ctx.fillRect(x, y + h - 1, w, 1);
}
