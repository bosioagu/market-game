/**
 * Carteles del mundo dibujados sobre la escena 3D.
 *
 * Se proyecta la posición del mundo a la pantalla y se dibuja con el canvas 2D
 * que va encima. Usa la interfaz moderna (`src/ui2`), no la tipografía de
 * píxeles: sobre un local en 3D, esa mezcla era justamente lo que se veía viejo.
 */

import type { PerspectiveCamera } from 'three';
import { clamp } from '../engine/math';
import { product } from '../game/data/products';
import type { InteractTarget, StoreSim } from '../game/session';
import type { Viewport } from '../game/render';
import { bar, card, chip, measure, mixAlpha, T, text, uiScale } from '../ui2/theme';
import { packageCanvas } from './textures';
import { GONDOLA_H } from './models';
import type { StoreScene3D } from './scene3d';

export interface OverlayOptions {
  /** Cómo se llama el botón de acción en este momento: "ESPACIO", "OK"... */
  tecla: string;
}

export function drawWorldLabels(
  ctx: CanvasRenderingContext2D,
  escena: StoreScene3D,
  cam: PerspectiveCamera,
  sim: StoreSim,
  vp: Viewport,
  focusIndex: number,
  targets: Map<number, InteractTarget | null>,
  opts: OverlayOptions,
): void {
  const s = uiScale(vp.w, vp.h);

  ctx.save();
  ctx.beginPath();
  ctx.rect(vp.x, vp.y, vp.w, vp.h);
  ctx.clip();

  const apuntadas = new Set<number>();
  for (const t of targets.values()) {
    if (t?.kind === 'shelf' && t.shelf) apuntadas.add(t.shelf.index);
  }

  for (const shelf of sim.world.shelves) {
    const apuntada = apuntadas.has(shelf.index);
    if (apuntada) {
      const p = escena.project(cam, shelf.x, shelf.y, GONDOLA_H + 0.7, vp);
      if (p.visible) fichaGondola(ctx, shelf, p.x, p.y, s);
      continue;
    }
    // Una góndola llena ya se ve llena: el número sólo cuando escasea.
    if (shelf.units > 0 && shelf.units <= 4) {
      const p = escena.project(cam, shelf.x, shelf.y, GONDOLA_H + 0.45, vp);
      if (p.visible) {
        chip(ctx, String(shelf.units), p.x - 12 * s, p.y, 11 * s, shelf.units <= 2 ? T.bad : T.warn, {
          solid: true,
        });
      }
    }
  }

  for (const c of sim.customers) {
    const cabeza = escena.project(cam, c.pos.x, c.pos.y, 2.0, vp);
    if (!cabeza.visible) continue;

    const color = c.mood === 'feliz' ? T.good : c.mood === 'normal' ? T.warn : T.bad;
    bar(ctx, cabeza.x - 17 * s, cabeza.y, 34 * s, 5 * s, c.patience, color, 'rgba(0,0,0,0.45)');

    if (c.state === 'pagando') {
      chip(ctx, `$${c.total}`, cabeza.x - measure(ctx, `$${c.total}`, { size: 12 * s, weight: 800 }) / 2 - 8 * s, cabeza.y - 26 * s, 12 * s, T.good, { solid: true });
      continue;
    }
    const quiere = c.wants[0];
    if (!quiere || c.state === 'saliendo') continue;
    globoProducto(ctx, quiere, cabeza.x, cabeza.y - 12 * s, s);
  }

  const jugador = sim.players.find((p) => p.index === focusIndex);
  if (jugador) {
    if (jugador.toast) {
      const p = escena.project(cam, jugador.pos.x, jugador.pos.y, 2.4, vp);
      if (p.visible) pildora(ctx, jugador.toast, null, p.x, p.y, s, T.surfaceStrong);
    } else {
      const target = targets.get(focusIndex);
      if (target) {
        const p = escena.project(cam, target.x, target.y, 2.1, vp);
        if (p.visible) pildora(ctx, target.hint, opts.tecla, p.x, p.y, s, T.surfaceStrong);
      }
    }
    if (jugador.busy) {
      const p = escena.project(cam, jugador.pos.x, jugador.pos.y, 2.1, vp);
      if (p.visible) {
        bar(ctx, p.x - 26 * s, p.y, 52 * s, 7 * s, jugador.busy.progress / jugador.busy.duration, T.good, 'rgba(0,0,0,0.5)');
      }
    }
  }

  for (const f of sim.floaters) {
    const p = escena.project(cam, f.x, f.y, 1.7 + (1.3 - f.life) * 0.9, vp);
    if (!p.visible) continue;
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.6)';
    ctx.shadowBlur = 6 * s;
    text(ctx, f.text, p.x, p.y, {
      size: 15 * s,
      weight: 800,
      color: f.color,
      align: 'center',
      alpha: clamp(f.life, 0, 1),
    });
    ctx.restore();
  }

  ctx.restore();
}

/** Tarjeta de la góndola que el jugador tiene enfrente. */
function fichaGondola(
  ctx: CanvasRenderingContext2D,
  shelf: { productId: string | null; units: number; capacity: number },
  cx: number,
  cy: number,
  s: number,
): void {
  const nombre = shelf.productId ? product(shelf.productId).name : 'Góndola vacía';
  const w = Math.max(150 * s, measure(ctx, nombre, { size: 12 * s, weight: 800 }) + 96 * s);
  const h = 40 * s;
  const x = cx - w / 2;
  const y = cy - h;
  card(ctx, x, y, w, h, { radius: T.radiusSmall * s, fill: T.surfaceStrong });

  if (shelf.productId) {
    const lado = 24 * s;
    ctx.save();
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(packageCanvas(shelf.productId), x + 8 * s, y + 8 * s, lado, lado);
    ctx.restore();
  }
  const tx = shelf.productId ? x + 38 * s : x + 12 * s;
  text(ctx, nombre, tx, y + 8 * s, { size: 12 * s, weight: 800, color: T.text });
  const ratio = shelf.capacity > 0 ? shelf.units / shelf.capacity : 0;
  const color = shelf.units === 0 ? T.bad : ratio < 0.3 ? T.warn : T.good;
  text(ctx, `${shelf.units} / ${shelf.capacity}`, tx, y + 23 * s, { size: 11 * s, color });
  bar(ctx, x + w - 46 * s, y + 25 * s, 38 * s, 5 * s, ratio, color, 'rgba(0,0,0,0.4)');
}

/** Globo con el producto que el cliente está buscando. */
function globoProducto(ctx: CanvasRenderingContext2D, id: string, cx: number, cy: number, s: number): void {
  const lado = 26 * s;
  const w = lado + 14 * s;
  const h = lado + 12 * s;
  const x = cx - w / 2;
  const y = cy - h;
  card(ctx, x, y, w, h, { radius: T.radiusSmall * s, fill: T.surfaceStrong });
  // Puntita del globo, para que se lea de quién es.
  ctx.beginPath();
  ctx.moveTo(cx - 5 * s, y + h - 1);
  ctx.lineTo(cx + 5 * s, y + h - 1);
  ctx.lineTo(cx, y + h + 6 * s);
  ctx.closePath();
  ctx.fillStyle = T.surfaceStrong;
  ctx.fill();

  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(packageCanvas(id), x + 7 * s, y + 6 * s, lado, lado);
  ctx.restore();
}

/** Cartel de acción: qué se puede hacer acá y con qué botón. */
function pildora(
  ctx: CanvasRenderingContext2D,
  texto: string,
  tecla: string | null,
  cx: number,
  cy: number,
  s: number,
  fondo: string,
): void {
  const tamTexto = 12 * s;
  const anchoTexto = measure(ctx, texto, { size: tamTexto, weight: 800 });
  const anchoTecla = tecla ? measure(ctx, tecla, { size: 10 * s, weight: 800 }) + 14 * s : 0;
  const w = anchoTexto + anchoTecla + (tecla ? 30 * s : 24 * s);
  const h = 28 * s;
  const x = cx - w / 2;
  const y = cy - h;
  card(ctx, x, y, w, h, { radius: T.radiusPill, fill: fondo });

  let cursor = x + 12 * s;
  if (tecla) {
    const chipW = anchoTecla;
    card(ctx, cursor, y + 6 * s, chipW, h - 12 * s, {
      radius: T.radiusSmall * s,
      fill: mixAlpha(T.text, 0.14),
      border: mixAlpha(T.text, 0.3),
      shadow: false,
    });
    text(ctx, tecla, cursor + chipW / 2, y + h / 2, {
      size: 10 * s,
      weight: 800,
      color: T.text,
      align: 'center',
      baseline: 'middle',
    });
    cursor += chipW + 8 * s;
  }
  text(ctx, texto, cursor, y + h / 2, { size: tamTexto, weight: 800, color: T.text, baseline: 'middle' });
}
