/** Pantallas superpuestas de la vista 3D: pausa, avisos y cierre del día. */

import type { StoreSim } from '../game/session';
import { careerLevel, type Progress } from '../game/progress';
import { nextLevelEarnings, store, type StoreId } from '../game/data/stores';
import { bar, card, chip, label, measure, mixAlpha, moneda, T, text, uiScale } from './theme';

export function drawBanner2(ctx: CanvasRenderingContext2D, w: number, h: number, texto: string): void {
  const s = uiScale(w, h);
  const ancho = Math.min(w - 24 * s, measure(ctx, texto, { size: 13 * s, weight: 800 }) + 44 * s);
  const alto = 34 * s;
  const x = (w - ancho) / 2;
  const y = h - alto - 18 * s;
  card(ctx, x, y, ancho, alto, { radius: T.radiusPill, fill: T.surfaceStrong, border: mixAlpha(T.money, 0.5) });
  text(ctx, texto, w / 2, y + alto / 2, {
    size: 13 * s,
    weight: 800,
    color: T.money,
    align: 'center',
    baseline: 'middle',
  });
}

/** Aviso grande y centrado: "abre en 5", "cerramos". */
export function drawAviso2(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  titulo: string,
  sub: string,
  oscurecer = 0,
): void {
  const s = uiScale(w, h);
  if (oscurecer > 0) {
    ctx.fillStyle = `rgba(8, 9, 14, ${oscurecer})`;
    ctx.fillRect(0, 0, w, h);
  }
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.65)';
  ctx.shadowBlur = 16 * s;
  text(ctx, titulo, w / 2, h * 0.3, { size: 44 * s, weight: 800, color: T.text, align: 'center' });
  text(ctx, sub, w / 2, h * 0.3 + 50 * s, { size: 14 * s, weight: 800, color: T.textDim, align: 'center' });
  ctx.restore();
}

export function drawPausa2(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  opciones: string[],
  elegida: number,
  accent: string,
): void {
  const s = uiScale(w, h);
  ctx.fillStyle = T.scrim;
  ctx.fillRect(0, 0, w, h);

  const ancho = Math.min(w - 40 * s, 320 * s);
  const botonH = 46 * s;
  const alto = 76 * s + opciones.length * (botonH + 10 * s);
  const x = (w - ancho) / 2;
  const y = (h - alto) / 2;
  card(ctx, x, y, ancho, alto, { radius: 20 * s, fill: T.surfaceStrong, sheen: true });

  label(ctx, 'Pausa', x + ancho / 2, y + 24 * s, 12 * s, T.textDim, 'center');

  opciones.forEach((texto, i) => {
    const by = y + 56 * s + i * (botonH + 10 * s);
    const activa = i === elegida;
    card(ctx, x + 18 * s, by, ancho - 36 * s, botonH, {
      radius: 12 * s,
      fill: activa ? accent : 'rgba(255,255,255,0.07)',
      border: activa ? 'rgba(255,255,255,0.4)' : T.border,
      shadow: false,
    });
    text(ctx, texto, x + ancho / 2, by + botonH / 2, {
      size: 15 * s,
      weight: 800,
      color: activa ? T.ink : T.text,
      align: 'center',
      baseline: 'middle',
    });
  });
}

export interface CierreInfo {
  sim: StoreSim;
  storeId: StoreId;
  alquiler: number;
  progress: Progress;
  subioNivel: boolean;
  desbloqueadas: string[];
  opciones: string[];
  elegida: number;
}

/** Resumen del día, con la ganancia como dato principal. */
export function drawCierre2(ctx: CanvasRenderingContext2D, w: number, h: number, info: CierreInfo): void {
  const s = uiScale(w, h);
  const { sim, progress } = info;
  const def = store(info.storeId);
  const ingreso = sim.stats.revenue + sim.stats.tips;
  const ganancia = ingreso - sim.stats.spent - info.alquiler;

  const fondo = ctx.createLinearGradient(0, 0, 0, h);
  fondo.addColorStop(0, '#171a26');
  fondo.addColorStop(1, '#0d0f16');
  ctx.fillStyle = fondo;
  ctx.fillRect(0, 0, w, h);

  const ancho = Math.min(w - 32 * s, 460 * s);
  const alto = Math.min(h - 28 * s, 470 * s);
  const x = (w - ancho) / 2;
  const y = (h - alto) / 2;
  card(ctx, x, y, ancho, alto, { radius: 22 * s, fill: T.surface, sheen: true });

  label(ctx, `${def.name} · Día ${progress.day - 1}`, x + 24 * s, y + 22 * s, 11 * s);
  text(ctx, 'Cierre del día', x + 24 * s, y + 38 * s, { size: 24 * s, weight: 800, color: T.text });

  // La ganancia, que es el dato que importa, con el tamaño que le corresponde.
  const colorGanancia = ganancia >= 0 ? T.good : T.bad;
  text(ctx, `${ganancia >= 0 ? '+' : '−'}${moneda(Math.abs(ganancia))}`, x + ancho - 24 * s, y + 30 * s, {
    size: 30 * s,
    weight: 800,
    color: colorGanancia,
    align: 'right',
  });
  label(ctx, 'Ganancia', x + ancho - 24 * s, y + 20 * s, 10 * s, T.textDim, 'right');

  const filas: [string, string, string][] = [
    ['Ventas', `+${moneda(sim.stats.revenue)}`, T.good],
    ['Propinas', `+${moneda(sim.stats.tips)}`, T.good],
    ['Compras y mejoras', `−${moneda(sim.stats.spent)}`, T.bad],
    ['Alquiler', `−${moneda(info.alquiler)}`, T.bad],
    ['Clientes atendidos', String(sim.stats.served), T.text],
    ['Se fueron sin comprar', String(sim.stats.lost), sim.stats.lost > 0 ? T.warn : T.textDim],
    ['Faltó stock', String(sim.stats.missingStock), sim.stats.missingStock > 0 ? T.warn : T.textDim],
    ['Les pareció caro', String(sim.stats.tooExpensive), sim.stats.tooExpensive > 0 ? T.warn : T.textDim],
    ['Mercadería en el local', moneda(sim.stockValue()), T.textDim],
  ];

  const filaH = 24 * s;
  const listaY = y + 82 * s;
  filas.forEach(([etiqueta, valor, color], i) => {
    const fy = listaY + i * filaH;
    if (i % 2 === 0) {
      card(ctx, x + 16 * s, fy - 2 * s, ancho - 32 * s, filaH - 2 * s, {
        radius: 8 * s,
        fill: 'rgba(255,255,255,0.035)',
        border: 'rgba(0,0,0,0)',
        shadow: false,
      });
    }
    text(ctx, etiqueta, x + 26 * s, fy + 3 * s, { size: 12 * s, color: T.textDim });
    text(ctx, valor, x + ancho - 26 * s, fy + 3 * s, { size: 12 * s, weight: 800, color, align: 'right' });
  });

  // Avance hacia el próximo nivel.
  const nivel = careerLevel(progress);
  const meta = nextLevelEarnings(nivel);
  const previo = nivel <= 1 ? 0 : nextLevelEarnings(nivel - 1);
  const avance = meta > previo ? (progress.totalEarned - previo) / (meta - previo) : 0;
  const barraY = listaY + filas.length * filaH + 14 * s;
  label(ctx, `Nivel ${nivel}`, x + 26 * s, barraY, 10 * s);
  text(ctx, `Faltan ${moneda(Math.max(0, meta - progress.totalEarned))}`, x + ancho - 26 * s, barraY, {
    size: 10 * s,
    weight: 800,
    color: T.textDim,
    align: 'right',
  });
  bar(ctx, x + 26 * s, barraY + 16 * s, ancho - 52 * s, 7 * s, avance, sim.def.accent);

  if (info.subioNivel) {
    chip(ctx, info.desbloqueadas.length > 0 ? `¡Se abrió ${info.desbloqueadas.join(', ')}!` : '¡Subiste de nivel!',
      x + ancho / 2 - 70 * s, barraY + 30 * s, 12 * s, T.money, { solid: true });
  } else if (ganancia < 0) {
    text(ctx, 'Perdiste plata: mirá los precios y el stock', x + ancho / 2, barraY + 32 * s, {
      size: 11 * s,
      weight: 800,
      color: T.warn,
      align: 'center',
    });
  }

  // Botones.
  const botonH = 40 * s;
  const by = y + alto - botonH - 18 * s;
  const anchoBoton = (ancho - 36 * s - (info.opciones.length - 1) * 10 * s) / info.opciones.length;
  info.opciones.forEach((texto, i) => {
    const bx = x + 18 * s + i * (anchoBoton + 10 * s);
    const activa = i === info.elegida;
    card(ctx, bx, by, anchoBoton, botonH, {
      radius: 12 * s,
      fill: activa ? sim.def.accent : 'rgba(255,255,255,0.07)',
      border: activa ? 'rgba(255,255,255,0.4)' : T.border,
      shadow: false,
    });
    text(ctx, texto, bx + anchoBoton / 2, by + botonH / 2, {
      size: 13 * s,
      weight: 800,
      color: activa ? T.ink : T.text,
      align: 'center',
      baseline: 'middle',
    });
  });
}

export interface VersusInfo {
  sims: StoreSim[];
  opciones: string[];
  elegida: number;
}

const NOMBRES = ['Mía', 'Kiki'];
const COLORES = ['#ff8fae', '#7fe3d8'];

/** Resultado de la competencia: dos columnas y quién ganó. */
export function drawVersus2(ctx: CanvasRenderingContext2D, w: number, h: number, info: VersusInfo): void {
  const s = uiScale(w, h);
  const fondo = ctx.createLinearGradient(0, 0, 0, h);
  fondo.addColorStop(0, '#171a26');
  fondo.addColorStop(1, '#0d0f16');
  ctx.fillStyle = fondo;
  ctx.fillRect(0, 0, w, h);

  const ancho = Math.min(w - 32 * s, 460 * s);
  const alto = Math.min(h - 28 * s, 400 * s);
  const x = (w - ancho) / 2;
  const y = (h - alto) / 2;
  card(ctx, x, y, ancho, alto, { radius: 22 * s, fill: T.surface, sheen: true });

  label(ctx, 'Competencia', x + ancho / 2, y + 22 * s, 11 * s, T.textDim, 'center');

  const [a, b] = info.sims;
  const ganador = a.money === b.money ? null : a.money > b.money ? 0 : 1;
  const mitad = (ancho - 48 * s) / 2;

  info.sims.forEach((sim, i) => {
    const cx = x + 24 * s + i * (mitad + 12 * s);
    const gana = ganador === i;
    card(ctx, cx, y + 44 * s, mitad, alto - 118 * s, {
      radius: 16 * s,
      fill: gana ? mixAlpha(COLORES[i], 0.16) : 'rgba(255,255,255,0.04)',
      border: gana ? mixAlpha(COLORES[i], 0.6) : T.border,
      shadow: false,
    });
    text(ctx, NOMBRES[i], cx + mitad / 2, y + 60 * s, {
      size: 18 * s,
      weight: 800,
      color: COLORES[i],
      align: 'center',
    });
    text(ctx, moneda(sim.money), cx + mitad / 2, y + 84 * s, {
      size: 24 * s,
      weight: 800,
      color: T.money,
      align: 'center',
    });
    const filas: [string, string][] = [
      ['Ventas', moneda(sim.stats.revenue)],
      ['Propinas', moneda(sim.stats.tips)],
      ['Clientes', String(sim.stats.served)],
      ['Perdidos', String(sim.stats.lost)],
      ['Mercadería', moneda(sim.stockValue())],
    ];
    filas.forEach(([etiqueta, valor], f) => {
      const fy = y + 120 * s + f * 22 * s;
      text(ctx, etiqueta, cx + 14 * s, fy, { size: 11 * s, color: T.textDim });
      text(ctx, valor, cx + mitad - 14 * s, fy, { size: 11 * s, weight: 800, color: T.text, align: 'right' });
    });
  });

  text(ctx, ganador === null ? '¡Empate!' : `¡Ganó ${NOMBRES[ganador]}!`, x + ancho / 2, y + alto - 74 * s, {
    size: 20 * s,
    weight: 800,
    color: ganador === null ? T.text : COLORES[ganador],
    align: 'center',
  });

  const botonH = 40 * s;
  const by = y + alto - botonH - 18 * s;
  const anchoBoton = (ancho - 36 * s - (info.opciones.length - 1) * 10 * s) / info.opciones.length;
  info.opciones.forEach((texto, i) => {
    const bx = x + 18 * s + i * (anchoBoton + 10 * s);
    const activa = i === info.elegida;
    card(ctx, bx, by, anchoBoton, botonH, {
      radius: 12 * s,
      fill: activa ? '#ffb020' : 'rgba(255,255,255,0.07)',
      border: activa ? 'rgba(255,255,255,0.4)' : T.border,
      shadow: false,
    });
    text(ctx, texto, bx + anchoBoton / 2, by + botonH / 2, {
      size: 13 * s,
      weight: 800,
      color: activa ? T.ink : T.text,
      align: 'center',
      baseline: 'middle',
    });
  });
}
