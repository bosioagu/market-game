/**
 * Carteles del mundo dibujados sobre la escena 3D.
 *
 * Los números de stock, lo que quiere cada cliente, la paciencia y el cartel de
 * "qué puedo hacer acá" se dibujan con el canvas 2D encima del 3D: se proyecta
 * la posición del mundo a la pantalla y se usa la misma tipografía de píxeles
 * que el resto del juego, así las dos vistas dan la misma información.
 */

import type { PerspectiveCamera } from 'three';
import { drawText, textWidth } from '../engine/font';
import { clamp } from '../engine/math';
import { product } from '../game/data/products';
import type { InteractTarget, StoreSim } from '../game/session';
import type { Viewport } from '../game/render';
import { itemSpriteScaled } from '../game/render';
import { GONDOLA_H } from './models';
import type { StoreScene3D } from './scene3d';

export function drawWorldLabels(
  ctx: CanvasRenderingContext2D,
  escena: StoreScene3D,
  cam: PerspectiveCamera,
  sim: StoreSim,
  vp: Viewport,
  focusIndex: number,
  targets: Map<number, InteractTarget | null>,
): void {
  const s = Math.max(1, Math.min(3, Math.round(Math.min(vp.w / 230, vp.h / 180))));

  ctx.save();
  ctx.beginPath();
  ctx.rect(vp.x, vp.y, vp.w, vp.h);
  ctx.clip();

  const apuntadas = new Set<number>();
  for (const t of targets.values()) {
    if (t?.kind === 'shelf' && t.shelf) apuntadas.add(t.shelf.index);
  }

  // Stock de cada góndola.
  for (const shelf of sim.world.shelves) {
    const p = escena.project(cam, shelf.x, shelf.y, GONDOLA_H + 0.45, vp);
    if (!p.visible) continue;
    // El número sólo cuando hace falta: una góndola llena ya se ve llena, y
    // doce carteles a la vez tapan el local.
    if (shelf.units > 0 && (shelf.units <= 4 || apuntadas.has(shelf.index))) {
      etiqueta(ctx, String(shelf.units), p.x, p.y, Math.max(1, s - 1), shelf.units <= 2 ? '#ffb86a' : '#fff6e8');
    } else if (shelf.units === 0 && apuntadas.has(shelf.index)) {
      etiqueta(ctx, 'VACÍA', p.x, p.y, s, '#ff9a9a');
    }
    if (apuntadas.has(shelf.index) && shelf.productId) {
      const q = escena.project(cam, shelf.x, shelf.y, GONDOLA_H + 1.0, vp);
      etiqueta(
        ctx,
        `${product(shelf.productId).name.toUpperCase()} ${shelf.units}/${shelf.capacity}`,
        q.x,
        q.y,
        s,
        '#fdf6ea',
      );
    }
  }

  // Clientes: qué buscan, cuánta paciencia les queda y cuánto tienen que pagar.
  for (const c of sim.customers) {
    const cabeza = escena.project(cam, c.pos.x, c.pos.y, 1.95, vp);
    if (!cabeza.visible) continue;
    const color = c.mood === 'feliz' ? '#8ce89a' : c.mood === 'normal' ? '#ffd36a' : '#ff7a7a';
    barra(ctx, cabeza.x, cabeza.y, s, c.patience, color);

    if (c.state === 'pagando') {
      etiqueta(ctx, `$${c.total}`, cabeza.x, cabeza.y - 12 * s, s, '#8ce89a');
      continue;
    }
    const quiere = c.wants[0];
    if (!quiere || c.state === 'saliendo') continue;
    const icono = itemSpriteScaled(quiere, s);
    const bx = Math.round(cabeza.x - icono.w / 2 - 2 * s);
    const by = Math.round(cabeza.y - icono.h - 9 * s);
    ctx.fillStyle = 'rgba(253, 246, 234, 0.95)';
    ctx.fillRect(bx, by, icono.w + 4 * s, icono.h + 4 * s);
    ctx.fillStyle = '#2f2836';
    ctx.fillRect(bx, by, icono.w + 4 * s, s);
    ctx.fillRect(bx, by + icono.h + 3 * s, icono.w + 4 * s, s);
    ctx.drawImage(icono.canvas, bx + 2 * s, by + 2 * s);
  }

  // Qué puede hacer el jugador de esta mitad.
  const jugador = sim.players.find((p) => p.index === focusIndex);
  if (jugador) {
    if (jugador.toast) {
      const p = escena.project(cam, jugador.pos.x, jugador.pos.y, 2.2, vp);
      etiqueta(ctx, jugador.toast, p.x, p.y, s, '#fdf6ea');
    } else {
      const target = targets.get(focusIndex);
      if (target) {
        const p = escena.project(cam, target.x, target.y, 2.0, vp);
        if (p.visible) etiqueta(ctx, target.hint, p.x, p.y, s, '#ffe9a8');
      }
    }
    if (jugador.busy) {
      const p = escena.project(cam, jugador.pos.x, jugador.pos.y, 2.0, vp);
      barra(ctx, p.x, p.y, s, jugador.busy.progress / jugador.busy.duration, '#8ce89a');
    }
  }

  // Plata que entra, avisos de falta de stock.
  for (const f of sim.floaters) {
    const p = escena.project(cam, f.x, f.y, 1.6 + (1.3 - f.life) * 0.8, vp);
    if (!p.visible) continue;
    drawText(ctx, f.text, Math.round(p.x), Math.round(p.y), {
      color: f.color,
      align: 'center',
      scale: s,
      outline: '#221c2a',
      alpha: clamp(f.life, 0, 1),
    });
  }

  ctx.restore();
}

function etiqueta(
  ctx: CanvasRenderingContext2D,
  texto: string,
  x: number,
  y: number,
  s: number,
  color: string,
): void {
  const w = textWidth(texto, s) + 5 * s;
  const h = 11 * s;
  const px = Math.round(x - w / 2);
  const py = Math.round(y - h);
  ctx.fillStyle = 'rgba(26, 22, 34, 0.8)';
  ctx.fillRect(px, py, w, h);
  drawText(ctx, texto, Math.round(x), py + 2 * s, { color, align: 'center', scale: s });
}

function barra(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  s: number,
  ratio: number,
  color: string,
): void {
  const w = 16 * s;
  const h = 3 * s;
  const px = Math.round(x - w / 2);
  const py = Math.round(y);
  ctx.fillStyle = '#221c2a';
  ctx.fillRect(px - s, py - s, w + 2 * s, h + 2 * s);
  ctx.fillStyle = '#4a4453';
  ctx.fillRect(px, py, w, h);
  ctx.fillStyle = color;
  ctx.fillRect(px, py, Math.round(w * clamp(ratio, 0, 1)), h);
}
