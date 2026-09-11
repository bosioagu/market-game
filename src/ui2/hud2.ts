/**
 * HUD moderno para la vista 3D: día y hora, plata, nivel, fama y qué reponer.
 * Sigue la estructura que usan los simuladores de tienda de celular, que es la
 * que pidió la familia: reloj arriba a la izquierda, plata arriba a la derecha.
 */

import { clockFor, DAY_SECONDS, type StoreSim } from '../game/session';
import { careerLevel, type Progress } from '../game/progress';
import { product } from '../game/data/products';
import { packageCanvas } from '../game3d/textures';
import type { Viewport } from '../game/render';
import { bar, card, chip, Contador, icon, label, measure, mixAlpha, moneda, T, text, uiScale } from './theme';

export interface HudInfo {
  elapsed: number;
  day: number;
  /** Nombre del jugador, sólo en pantalla dividida. */
  nombre?: string;
  color?: string;
}

/** Un contador de plata por jugador, para que el número suba en vez de saltar. */
const contadores = new Map<number, Contador>();

export function drawHud2(
  ctx: CanvasRenderingContext2D,
  vp: Viewport,
  sim: StoreSim,
  progress: Progress,
  info: HudInfo,
  padIndex: number,
  dt: number,
): void {
  const s = uiScale(vp.w, vp.h);
  const pad = 14 * s;

  relojYDia(ctx, vp, sim, info, s, pad);
  plataYNivel(ctx, vp, sim, progress, s, pad, padIndex, dt);
  if (info.nombre) nombreJugador(ctx, vp, info, s, pad);
  reponer(ctx, vp, sim, s, pad);
  llevando(ctx, vp, sim, padIndex, s, pad);
}

function relojYDia(
  ctx: CanvasRenderingContext2D,
  vp: Viewport,
  sim: StoreSim,
  info: HudInfo,
  s: number,
  pad: number,
): void {
  const w = 124 * s;
  const h = 54 * s;
  const x = vp.x + pad;
  const y = vp.y + pad;
  card(ctx, x, y, w, h, { radius: T.radius * s, sheen: true });

  icon(ctx, 'reloj', x + 20 * s, y + 22 * s, 20 * s, T.textDim);
  label(ctx, `Día ${info.day}`, x + 36 * s, y + 11 * s, 10 * s);
  text(ctx, clockFor(info.elapsed), x + 36 * s, y + 22 * s, {
    size: 20 * s,
    weight: 800,
    color: T.text,
  });

  const progreso = Math.min(1, info.elapsed / DAY_SECONDS);
  bar(ctx, x + 14 * s, y + h - 13 * s, w - 28 * s, 5 * s, progreso, sim.def.accent);
}

function plataYNivel(
  ctx: CanvasRenderingContext2D,
  vp: Viewport,
  sim: StoreSim,
  progress: Progress,
  s: number,
  pad: number,
  padIndex: number,
  dt: number,
): void {
  let contador = contadores.get(padIndex);
  if (!contador) {
    contador = new Contador(sim.money);
    contadores.set(padIndex, contador);
  }
  const mostrado = contador.update(sim.money, dt);
  const plata = moneda(mostrado);
  const nivel = `${sim.def.name} · Nv. ${careerLevel(progress)}`;

  const anchoPlata = measure(ctx, plata, { size: 24 * s, weight: 800 }) + 30 * s;
  const anchoNivel = measure(ctx, nivel, { size: 12 * s, weight: 800 }) + 22 * s;
  const w = Math.max(anchoPlata, anchoNivel, 140 * s);
  const h = 78 * s;
  const x = vp.x + vp.w - pad - w;
  const y = vp.y + pad;
  card(ctx, x, y, w, h, { radius: T.radius * s, sheen: true });

  const derecha = x + w - 14 * s;
  text(ctx, plata, derecha, y + 12 * s, { size: 24 * s, weight: 800, color: T.money, align: 'right' });
  icon(ctx, 'moneda', x + 20 * s, y + 24 * s, 18 * s, T.money);

  chip(ctx, nivel, derecha, y + 42 * s, 11 * s, sim.def.accent, { align: 'right' });

  // Fama: la barra que define cuánta gente viene mañana.
  const famaColor = sim.reputation > 0.6 ? T.good : sim.reputation > 0.3 ? T.warn : T.bad;
  icon(ctx, 'estrella', x + 20 * s, y + h - 14 * s, 13 * s, famaColor);
  bar(ctx, x + 30 * s, y + h - 17 * s, w - 44 * s, 6 * s, sim.reputation, famaColor);
}

function nombreJugador(
  ctx: CanvasRenderingContext2D,
  vp: Viewport,
  info: HudInfo,
  s: number,
  pad: number,
): void {
  const nombre = info.nombre ?? '';
  const tam = 12 * s;
  // La cápsula se centra de verdad: su ancho depende del nombre.
  const ancho = measure(ctx, nombre, { size: tam, weight: 800 }) + tam * 1.4;
  chip(ctx, nombre, vp.x + (vp.w - ancho) / 2, vp.y + pad, tam, info.color ?? T.text, { solid: true });
}

/** Tarjeta con lo que se está por acabar. Es lo que más se mira del HUD. */
function reponer(
  ctx: CanvasRenderingContext2D,
  vp: Viewport,
  sim: StoreSim,
  s: number,
  pad: number,
): void {
  const enGondola = new Map<string, number>();
  for (const id of sim.catalogue) enGondola.set(id, 0);
  for (const sh of sim.world.shelves) {
    if (sh.productId) enGondola.set(sh.productId, (enGondola.get(sh.productId) ?? 0) + sh.units);
  }
  const enCajas = new Map<string, number>();
  for (const b of sim.world.boxes) enCajas.set(b.productId, (enCajas.get(b.productId) ?? 0) + b.units);

  const bajos = [...enGondola.entries()]
    .filter(([id, n]) => n <= 2 && (n > 0 || (enCajas.get(id) ?? 0) > 0 || sim.world.shelves.some((sh) => sh.productId === id)))
    .sort((a, b) => a[1] - b[1])
    .slice(0, 3);
  if (bajos.length === 0) return;

  const filaH = 30 * s;
  const w = 186 * s;
  const h = 26 * s + bajos.length * filaH;
  const x = vp.x + pad;
  const y = vp.y + vp.h - pad - h;
  card(ctx, x, y, w, h, { radius: T.radius * s });

  icon(ctx, 'alerta', x + 18 * s, y + 15 * s, 13 * s, T.warn);
  label(ctx, 'Reponer', x + 30 * s, y + 10 * s, 10 * s, T.warn);

  bajos.forEach(([id, n], i) => {
    const fy = y + 26 * s + i * filaH;
    const thumb = packageCanvas(id);
    const lado = 22 * s;
    ctx.save();
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(thumb, x + 12 * s, fy + 2 * s, lado, lado);
    ctx.restore();

    const color = n === 0 ? T.bad : T.warn;
    text(ctx, product(id).name, x + 40 * s, fy + 7 * s, { size: 12 * s, color: T.text });
    const enCaja = enCajas.get(id) ?? 0;
    const texto = enCaja > 0 ? `${n} · ${enCaja} en caja` : String(n);
    text(ctx, texto, x + w - 12 * s, fy + 7 * s, { size: 11 * s, weight: 800, color, align: 'right' });
  });
}

/** Lo que el jugador lleva en las manos. */
function llevando(
  ctx: CanvasRenderingContext2D,
  vp: Viewport,
  sim: StoreSim,
  padIndex: number,
  s: number,
  pad: number,
): void {
  const jugador = sim.players.find((p) => p.index === padIndex);
  const caja = jugador?.carrying;
  if (!caja) return;

  const nombre = product(caja.productId).name;
  const w = Math.max(150 * s, measure(ctx, nombre, { size: 12 * s }) + 60 * s);
  const h = 44 * s;
  const x = vp.x + vp.w - pad - w;
  const y = vp.y + vp.h - pad - h;
  card(ctx, x, y, w, h, { radius: T.radius * s, fill: mixAlpha(sim.def.accent, 0.22), border: mixAlpha(sim.def.accent, 0.5) });

  const lado = 26 * s;
  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(packageCanvas(caja.productId), x + 10 * s, y + 9 * s, lado, lado);
  ctx.restore();

  label(ctx, 'Llevás', x + 44 * s, y + 9 * s, 9 * s);
  text(ctx, `${caja.units} × ${nombre}`, x + 44 * s, y + 21 * s, { size: 12 * s, weight: 800, color: T.text });
}

/** Los contadores viven entre partidas; al arrancar un día hay que reiniciarlos. */
export function resetHud2(): void {
  contadores.clear();
}
