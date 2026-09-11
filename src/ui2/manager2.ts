/**
 * La computadora del local, con la interfaz moderna.
 *
 * Es sólo el dibujado: la lógica (mover, comprar, cambiar precios) sigue en
 * `src/ui/manager.ts`, que es la misma para las dos vistas. Así no hay dos
 * versiones de las reglas que puedan quedar desincronizadas.
 */

import { boxCost, product } from '../game/data/products';
import type { StoreSim } from '../game/session';
import { upgradeCost, UPGRADES, upgradeLevel, type Progress } from '../game/progress';
import { packageCanvas } from '../game3d/textures';
import type { Viewport } from '../game/render';
import type { ManagerUi } from '../ui/manager';
import { card, chip, label, measure, mixAlpha, moneda, roundedPath, T, text, uiScale } from './theme';

export function drawManager2(
  ctx: CanvasRenderingContext2D,
  vp: Viewport,
  ui: ManagerUi,
  sim: StoreSim,
  progress: Progress,
): void {
  const s = uiScale(vp.w, vp.h);
  const filaH = 52 * s;
  const cantidadFilas = ui.filas(sim);
  const cabecera = 96 * s;
  const pie = 40 * s;

  const w = Math.min(vp.w - 28 * s, 470 * s);
  const alto = Math.min(vp.h - 24 * s, cabecera + cantidadFilas * filaH + pie + 10 * s);
  const x = vp.x + (vp.w - w) / 2;
  const y = vp.y + (vp.h - alto) / 2;

  ctx.save();
  ctx.fillStyle = T.scrim;
  ctx.fillRect(vp.x, vp.y, vp.w, vp.h);

  card(ctx, x, y, w, alto, { radius: 20 * s, fill: T.surfaceStrong, sheen: true });

  // Encabezado.
  label(ctx, 'Computadora del local', x + 20 * s, y + 18 * s, 10 * s);
  text(ctx, moneda(sim.money), x + w - 20 * s, y + 14 * s, {
    size: 20 * s,
    weight: 800,
    color: T.money,
    align: 'right',
  });

  segmentos(ctx, ui, sim, x + 16 * s, y + 44 * s, w - 32 * s, 34 * s, s);

  // Lista.
  const listaY = y + cabecera;
  const listaH = alto - cabecera - pie;
  const visibles = Math.max(1, Math.floor(listaH / filaH));
  const primera = Math.max(0, Math.min(ui.fila - Math.floor(visibles / 2), Math.max(0, cantidadFilas - visibles)));

  ctx.save();
  roundedPath(ctx, x + 10 * s, listaY, w - 20 * s, listaH, 12 * s);
  ctx.clip();
  for (let i = 0; i < visibles && primera + i < cantidadFilas; i++) {
    const indice = primera + i;
    const fy = listaY + i * filaH;
    const elegida = indice === ui.fila;
    if (elegida) {
      card(ctx, x + 12 * s, fy + 2 * s, w - 24 * s, filaH - 6 * s, {
        radius: 12 * s,
        fill: mixAlpha(sim.def.accent, 0.16),
        border: mixAlpha(sim.def.accent, 0.55),
        shadow: false,
      });
    }
    if (ui.pestania === 'mejoras') filaMejora(ctx, indice, x, fy, w, s, sim, progress);
    else filaProducto(ctx, ui, indice, x, fy, w, s, sim, elegida);
  }
  ctx.restore();

  // Pie: qué hace cada botón.
  const pieY = y + alto - 28 * s;
  const ayuda =
    ui.pestania === 'mayorista'
      ? `← →  cantidad     Botón: comprar ${ui.cantidad} caja${ui.cantidad > 1 ? 's' : ''}`
      : ui.pestania === 'precios'
        ? '← →  precio     Botón: volver al de mercado'
        : 'Botón: comprar mejora';
  text(ctx, ui.mensaje || ayuda, x + 20 * s, pieY, {
    size: 11 * s,
    weight: 800,
    color: ui.mensaje ? T.money : T.textDim,
  });
  text(ctx, '↑↓ mover · Q sale', x + w - 20 * s, pieY, {
    size: 11 * s,
    color: T.textFaint,
    align: 'right',
  });
  ctx.restore();
}

/** Control de pestañas tipo segmentado. */
function segmentos(
  ctx: CanvasRenderingContext2D,
  ui: ManagerUi,
  sim: StoreSim,
  x: number,
  y: number,
  w: number,
  h: number,
  s: number,
): void {
  card(ctx, x, y, w, h, { radius: h / 2, fill: 'rgba(255,255,255,0.06)', border: T.border, shadow: false });
  const tabs = ui.pestanias;
  const ancho = w / tabs.length;
  tabs.forEach((tab, i) => {
    const activa = tab === ui.pestania;
    const sx = x + i * ancho;
    if (activa) {
      card(ctx, sx + 3 * s, y + 3 * s, ancho - 6 * s, h - 6 * s, {
        radius: (h - 6 * s) / 2,
        fill: sim.def.accent,
        border: 'rgba(255,255,255,0.35)',
        shadow: false,
      });
    }
    text(ctx, ui.etiquetaPestania(tab), sx + ancho / 2, y + h / 2, {
      size: 12 * s,
      weight: 800,
      color: activa ? T.ink : T.textDim,
      align: 'center',
      baseline: 'middle',
    });
  });
}

function filaProducto(
  ctx: CanvasRenderingContext2D,
  ui: ManagerUi,
  indice: number,
  x: number,
  y: number,
  w: number,
  s: number,
  sim: StoreSim,
  elegida: boolean,
): void {
  const id = sim.catalogue[indice];
  if (!id) return;
  const def = product(id);

  const lado = 34 * s;
  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(packageCanvas(id), x + 22 * s, y + 8 * s, lado, lado);
  ctx.restore();

  const tx = x + 22 * s + lado + 12 * s;
  text(ctx, def.name, tx, y + 10 * s, { size: 14 * s, weight: 800, color: T.text });
  const derecha = x + w - 22 * s;

  if (ui.pestania === 'mayorista') {
    text(ctx, `Caja de ${def.perBox} · ${moneda(boxCost(id))}`, tx, y + 28 * s, {
      size: 11 * s,
      color: T.textDim,
    });
    const enLocal =
      sim.world.shelves.reduce((n, sh) => n + (sh.productId === id ? sh.units : 0), 0) +
      sim.world.boxes.reduce((n, b) => n + (b.productId === id ? b.units : 0), 0);
    text(ctx, `Tenés ${enLocal}`, derecha, y + 10 * s, { size: 11 * s, color: T.textDim, align: 'right' });
    const total = boxCost(id) * ui.cantidad;
    text(ctx, `×${ui.cantidad} = ${moneda(total)}`, derecha, y + 26 * s, {
      size: 13 * s,
      weight: 800,
      color: sim.money >= total ? T.good : T.bad,
      align: 'right',
    });
    return;
  }

  text(ctx, `Costo ${moneda(def.cost)} · Mercado ${moneda(def.market)}`, tx, y + 28 * s, {
    size: 11 * s,
    color: T.textDim,
  });

  const veredicto = sim.priceVerdict(id);
  const precio = moneda(sim.priceOf(id));
  const anchoPrecio = measure(ctx, precio, { size: 17 * s, weight: 800 });

  // Las flechitas sólo en la fila elegida: son las que se pueden mover ahora.
  if (elegida) {
    text(ctx, '‹', derecha - anchoPrecio - 22 * s, y + 12 * s, { size: 17 * s, weight: 800, color: T.textDim });
    text(ctx, '›', derecha + 6 * s, y + 12 * s, { size: 17 * s, weight: 800, color: T.textDim, align: 'right' });
  }
  text(ctx, precio, derecha - 12 * s, y + 8 * s, { size: 17 * s, weight: 800, color: T.text, align: 'right' });
  chip(ctx, veredicto.text, derecha, y + 30 * s, 10 * s, veredicto.color, { align: 'right' });
}

function filaMejora(
  ctx: CanvasRenderingContext2D,
  indice: number,
  x: number,
  y: number,
  w: number,
  s: number,
  sim: StoreSim,
  progress: Progress,
): void {
  const def = UPGRADES[indice];
  if (!def) return;
  const nivel = upgradeLevel(progress, def.id);
  const costo = upgradeCost(progress, def);

  text(ctx, def.name, x + 22 * s, y + 10 * s, { size: 14 * s, weight: 800, color: T.text });
  text(ctx, def.description, x + 22 * s, y + 28 * s, { size: 11 * s, color: T.textDim });

  const derecha = x + w - 22 * s;
  // Progreso de la mejora como puntos, más limpio que estrellas de texto.
  const punto = 8 * s;
  for (let i = 0; i < def.maxLevel; i++) {
    const px = derecha - (def.maxLevel - i) * (punto + 4 * s);
    ctx.beginPath();
    ctx.arc(px + punto / 2, y + 15 * s, punto / 2, 0, Math.PI * 2);
    ctx.fillStyle = i < nivel ? sim.def.accent : 'rgba(255,255,255,0.18)';
    ctx.fill();
  }
  text(ctx, costo === null ? 'Al máximo' : moneda(costo), derecha, y + 27 * s, {
    size: 13 * s,
    weight: 800,
    color: costo === null ? T.textDim : sim.money >= costo ? T.good : T.bad,
    align: 'right',
  });
}
