/** Cierre del día: cuentas claras y qué hacer después. */

import type { App, Scene } from '../app';
import { drawText } from '../engine/font';
import { audio } from '../engine/audio';
import { drawPanel, drawButton, UI, uiScaleFor } from '../ui/panel';
import { MenuCursor } from '../ui/cursor';
import { careerLevel } from '../game/progress';
import { nextLevelEarnings, store, STORES, type StoreId } from '../game/data/stores';
import type { GameMode, StoreSim } from '../game/session';
import { drawCierre2, drawVersus2 } from '../ui2/pantallas2';
import { MenuScene } from './menu';
import { PlayScene } from './play';

export interface ResultsArgs {
  mode: GameMode;
  sims: StoreSim[];
  rent: number;
  storeId: StoreId;
}

const OPTIONS = ['OTRO DÍA', 'OTRA TIENDA', 'MENÚ'];

export class ResultsScene implements Scene {
  private readonly args: ResultsArgs;
  private cursor = new MenuCursor();
  private t = 0;
  private levelUp = false;
  private unlocked: string[] = [];

  constructor(args: ResultsArgs) {
    this.args = args;
  }

  enter(app: App): void {
    this.cursor.reset(0);
    if (this.args.mode === 'versus') return;

    const level = careerLevel(app.progress);
    const before = levelBefore(app.progress.totalEarned, this.args.sims[0]);
    this.levelUp = level > before;
    if (this.levelUp) {
      audio.sfx('levelup');
      this.unlocked = STORES.filter((s) => s.unlockLevel > before && s.unlockLevel <= level).map((s) => s.name);
    }
  }

  update(dt: number, app: App): void {
    this.t += dt;
    const pad = app.input.menuPad();
    this.cursor.update(dt, pad, OPTIONS.length);
    if (!pad.actionPressed) return;
    audio.sfx('select');
    switch (this.cursor.index) {
      case 0:
        app.setScene(new PlayScene(this.args.mode, this.args.storeId));
        break;
      case 1:
        app.setScene(new MenuScene('tienda'));
        break;
      default:
        app.setScene(new MenuScene('modo'));
        break;
    }
  }

  draw(ctx: CanvasRenderingContext2D, w: number, h: number, app: App): void {
    if (app.vista === 'tres-d') {
      this.drawModerno(ctx, w, h, app);
      return;
    }
    const s = uiScaleFor(w, h);
    ctx.fillStyle = '#1a1426';
    ctx.fillRect(0, 0, w, h);

    const pw = Math.min(w - 12 * s, 320 * s);
    const ph = Math.min(h - 12 * s, 200 * s);
    const x = Math.round((w - pw) / 2);
    const y = Math.round((h - ph) / 2);
    drawPanel(ctx, x, y, pw, ph, s);

    if (this.args.mode === 'versus') this.drawVersus(ctx, x, y, pw, s);
    else this.drawCareer(ctx, x, y, pw, s, app);

    OPTIONS.forEach((label, i) => {
      const bw = Math.floor((pw - 16 * s) / OPTIONS.length);
      drawButton(ctx, label, x + 8 * s + i * bw, y + ph - 18 * s, bw - 4 * s, 12 * s, s, {
        selected: i === this.cursor.index,
      });
    });
  }

  /** Mismo contenido, con la interfaz moderna que acompaña a la vista 3D. */
  private drawModerno(ctx: CanvasRenderingContext2D, w: number, h: number, app: App): void {
    const opciones = ['Otro día', 'Otra tienda', 'Menú'];
    if (this.args.mode === 'versus') {
      drawVersus2(ctx, w, h, { sims: this.args.sims, opciones, elegida: this.cursor.index });
      return;
    }
    drawCierre2(ctx, w, h, {
      sim: this.args.sims[0],
      storeId: this.args.storeId,
      alquiler: this.args.rent,
      progress: app.progress,
      subioNivel: this.levelUp,
      desbloqueadas: this.unlocked,
      opciones,
      elegida: this.cursor.index,
    });
  }

  private drawCareer(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    pw: number,
    s: number,
    app: App,
  ): void {
    const sim = this.args.sims[0];
    const def = store(this.args.storeId);
    const income = sim.stats.revenue + sim.stats.tips;
    const profit = income - sim.stats.spent - this.args.rent;

    drawText(ctx, `${def.name.toUpperCase()} - CIERRE DEL DÍA`, x + pw / 2, y + 6 * s, {
      color: UI.gold,
      align: 'center',
      scale: s + 1,
    });

    const rows: [string, string, string][] = [
      ['VENTAS', `+$${sim.stats.revenue}`, UI.good],
      ['PROPINAS', `+$${sim.stats.tips}`, UI.good],
      ['COMPRAS Y MEJORAS', `-$${sim.stats.spent}`, UI.bad],
      ['ALQUILER', `-$${this.args.rent}`, UI.bad],
      ['GANANCIA DEL DÍA', `${profit >= 0 ? '+' : '-'}$${Math.abs(profit)}`, profit >= 0 ? UI.good : UI.bad],
      ['CLIENTES ATENDIDOS', String(sim.stats.served), UI.text],
      ['SE FUERON SIN COMPRAR', String(sim.stats.lost), sim.stats.lost > 0 ? UI.warn : UI.text],
      ['FALTÓ STOCK', String(sim.stats.missingStock), sim.stats.missingStock > 0 ? UI.warn : UI.text],
      ['LES PARECIÓ CARO', String(sim.stats.tooExpensive), sim.stats.tooExpensive > 0 ? UI.warn : UI.text],
      ['MERCADERÍA EN EL LOCAL', `$${Math.round(sim.stockValue())}`, UI.dim],
    ];

    rows.forEach(([label, value, color], i) => {
      const ry = y + 22 * s + i * 11 * s;
      drawText(ctx, label, x + 10 * s, ry, { color: UI.dim, scale: s });
      drawText(ctx, value, x + pw - 10 * s, ry, { color, align: 'right', scale: s });
    });

    const level = careerLevel(app.progress);
    const footY = y + 22 * s + rows.length * 11 * s + 6 * s;
    drawText(
      ctx,
      `CAJA: $${Math.round(app.progress.money)}   NIVEL ${level}   FALTAN $${Math.max(0, nextLevelEarnings(level) - app.progress.totalEarned)}`,
      x + pw / 2,
      footY,
      { color: UI.text, align: 'center', scale: s },
    );

    if (this.levelUp) {
      const blink = Math.sin(this.t * 6) > -0.2;
      drawText(ctx, blink ? '¡SUBISTE DE NIVEL!' : '', x + pw / 2, footY + 11 * s, {
        color: UI.gold,
        align: 'center',
        scale: s + 1,
      });
      if (this.unlocked.length > 0) {
        drawText(ctx, `SE ABRIÓ: ${this.unlocked.join(', ').toUpperCase()}`, x + pw / 2, footY + 24 * s, {
          color: UI.good,
          align: 'center',
          scale: s,
        });
      }
    } else if (profit < 0) {
      drawText(ctx, 'PERDISTE PLATA HOY: MIRÁ LOS PRECIOS Y EL STOCK', x + pw / 2, footY + 11 * s, {
        color: UI.warn,
        align: 'center',
        scale: s,
      });
    }
  }

  private drawVersus(ctx: CanvasRenderingContext2D, x: number, y: number, pw: number, s: number): void {
    const [a, b] = this.args.sims;
    drawText(ctx, 'RESULTADO DE LA COMPETENCIA', x + pw / 2, y + 6 * s, {
      color: UI.gold,
      align: 'center',
      scale: s + 1,
    });

    const names = ['MÍA', 'KIKI'];
    const colors = ['#ff8fae', '#7fe3d8'];
    const half = Math.floor(pw / 2);
    [a, b].forEach((sim, i) => {
      const cx = x + half / 2 + i * half;
      drawText(ctx, names[i], cx, y + 22 * s, { color: colors[i], align: 'center', scale: s + 1 });
      const rows: [string, string][] = [
        ['CAJA', `$${Math.round(sim.money)}`],
        ['VENTAS', `$${sim.stats.revenue}`],
        ['PROPINAS', `$${sim.stats.tips}`],
        ['CLIENTES', String(sim.stats.served)],
        ['PERDIDOS', String(sim.stats.lost)],
        ['MERCADERÍA', `$${Math.round(sim.stockValue())}`],
      ];
      rows.forEach(([label, value], r) => {
        const ry = y + 38 * s + r * 11 * s;
        drawText(ctx, label, cx - half / 2 + 10 * s, ry, { color: UI.dim, scale: s });
        drawText(ctx, value, cx + half / 2 - 10 * s, ry, { color: UI.text, align: 'right', scale: s });
      });
    });

    const winner = a.money === b.money ? null : a.money > b.money ? 0 : 1;
    const text = winner === null ? '¡EMPATE!' : `¡GANÓ ${names[winner]}!`;
    drawText(ctx, text, x + pw / 2, y + 38 * s + 7 * 11 * s, {
      color: winner === null ? UI.text : colors[winner],
      align: 'center',
      scale: s + 2,
    });
  }
}

/** Nivel que tenía el jugador antes de sumar lo de hoy. */
function levelBefore(totalEarned: number, sim: StoreSim): number {
  const before = totalEarned - (sim.stats.revenue + sim.stats.tips);
  let level = 1;
  let need = 3000;
  while (before >= need && level < 60) {
    level++;
    need += Math.round(2500 * Math.pow(1.18, level - 1));
  }
  return level;
}
