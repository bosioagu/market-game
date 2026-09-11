/** Un día de trabajo en la tienda. */

import { layoutViewports, type App, type Scene } from '../app';
import { drawText, textWidth, wrapText } from '../engine/font';
import { audio } from '../engine/audio';
import { clamp } from '../engine/math';
import { drawPanel, drawButton, UI, uiScaleFor } from '../ui/panel';
import { MenuCursor } from '../ui/cursor';
import { ManagerUi } from '../ui/manager';
import { drawStore, type Viewport } from '../game/render';
import { drawHud } from '../game/hud';
import { DAY_SECONDS, StoreSim, type GameMode, type InteractTarget } from '../game/session';
import { store, type StoreId } from '../game/data/stores';
import { product } from '../game/data/products';
import type { Progress } from '../game/progress';
import { ResultsScene } from './results';
import { MenuScene } from './menu';

const VERSUS_BUDGET = 5000;
const GRACE_SECONDS = 8;
const CLOSING_SECONDS = 12;

const PAUSE_OPTIONS = ['SEGUIR JUGANDO', 'SILENCIAR', 'SALIR AL MENÚ'];

export class PlayScene implements Scene {
  private readonly mode: GameMode;
  private readonly storeId: StoreId;
  private sims: StoreSim[] = [];
  private managers = [new ManagerUi(), new ManagerUi()];
  private elapsed = 0;
  private closing = -1;
  private paused = false;
  private pauseCursor = new MenuCursor();

  constructor(mode: GameMode, storeId: StoreId) {
    this.mode = mode;
    this.storeId = storeId;
  }

  enter(app: App): void {
    const def = store(this.storeId);
    const seed = Date.now() >>> 0;

    if (this.mode === 'versus') {
      const budget: Progress = { ...app.progress, money: VERSUS_BUDGET };
      this.sims = [
        new StoreSim(def, budget, [0], seed),
        new StoreSim(def, budget, [1], seed ^ 0x9e3779b9),
      ];
      for (const sim of this.sims) this.seedStock(sim, 4);
    } else {
      const padIndices = this.mode === 'coop' ? [0, 1] : [0];
      this.sims = [new StoreSim(def, app.progress, padIndices, seed)];
      if (app.progress.day === 1) this.seedStock(this.sims[0], 3);
    }
  }

  /** Regalo de arranque para que el primer día no empiece con el local vacío. */
  private seedStock(sim: StoreSim, count: number): void {
    for (let i = 0; i < count && i < sim.catalogue.length; i++) {
      sim.world.addBox(sim.catalogue[i]);
    }
  }

  update(dt: number, app: App): void {
    if (app.input.keyPressed('Escape') || app.input.keyPressed('KeyP')) {
      this.paused = !this.paused;
      this.pauseCursor.reset(0);
      audio.sfx(this.paused ? 'back' : 'select');
    }

    if (this.paused) {
      this.updatePause(dt, app);
      return;
    }

    const open = this.closing < 0;
    if (open) {
      this.elapsed += dt;
      if (this.elapsed >= DAY_SECONDS) {
        this.closing = 0;
        for (const sim of this.sims) sim.closeShop();
        audio.sfx('levelup');
      }
    } else {
      this.closing += dt;
    }

    for (const sim of this.sims) {
      // La computadora bloquea al jugador que la está usando, no al otro.
      const user = sim.computerUser;
      if (user !== null && !this.managers[user].open) {
        this.managers[user].open = true;
        this.managers[user].reset();
      }
      let uiOpen = false;
      if (user !== null && this.managers[user].open) {
        uiOpen = true;
        const close = this.managers[user].update(dt, app.input.pad(user), sim, app.progress);
        if (close) {
          this.managers[user].open = false;
          sim.computerUser = null;
          uiOpen = false;
        }
      }

      const pads = [app.input.pad(0), app.input.pad(1)];
      sim.update(dt, pads, uiOpen);
      if (open && this.elapsed > GRACE_SECONDS) sim.spawnTick(dt);
    }

    const everyoneGone = this.sims.every((s) => s.customers.length === 0);
    if (this.closing >= 0 && (everyoneGone || this.closing > CLOSING_SECONDS)) {
      this.finishDay(app);
    }
  }

  private updatePause(dt: number, app: App): void {
    const pad = app.input.menuPad();
    this.pauseCursor.update(dt, pad, PAUSE_OPTIONS.length);
    if (!pad.actionPressed) return;
    switch (this.pauseCursor.index) {
      case 0:
        this.paused = false;
        audio.sfx('select');
        break;
      case 1:
        audio.setMuted(!audio.muted);
        app.progress.muted = audio.muted;
        if (!audio.muted) audio.startMusic();
        app.save();
        break;
      case 2:
        audio.sfx('back');
        app.setScene(new MenuScene('modo'));
        break;
    }
  }

  private finishDay(app: App): void {
    const def = store(this.storeId);
    if (this.mode === 'versus') {
      app.setScene(new ResultsScene({ mode: this.mode, sims: this.sims, rent: 0, storeId: this.storeId }));
      return;
    }

    const sim = this.sims[0];
    const rent = def.rent;
    sim.money -= rent;
    app.progress.money = Math.max(0, Math.round(sim.money));
    app.progress.totalEarned += sim.stats.revenue + sim.stats.tips;
    app.progress.day += 1;
    app.progress.prices[this.storeId] = { ...sim.prices };
    app.save();
    app.setScene(new ResultsScene({ mode: this.mode, sims: this.sims, rent, storeId: this.storeId }));
  }

  draw(ctx: CanvasRenderingContext2D, w: number, h: number, app: App): void {
    const viewports = layoutViewports(this.mode, w, h);
    app.touch.setZones(viewports.map((rect, i) => ({ pad: i, rect })));

    viewports.forEach((vp, i) => {
      const sim = this.mode === 'versus' ? this.sims[i] : this.sims[0];
      const player = sim.players.find((p) => p.index === i) ?? sim.players[0];
      const targets = new Map<number, InteractTarget | null>();
      for (const p of sim.players) targets.set(p.index, sim.findTarget(p));

      drawStore(ctx, sim, vp, player.pos, targets, i);
      drawHud(ctx, vp, sim, app.progress, {
        elapsed: this.elapsed,
        day: app.progress.day,
        label: this.mode === 'solo' ? undefined : player.name,
      });
      this.drawPlayerStrip(ctx, vp, sim, i);

      if (sim.computerUser === i && this.managers[i].open) {
        this.managers[i].draw(ctx, vp, sim, app.progress);
      }
    });

    if (viewports.length === 2) {
      // Línea divisoria entre las dos mitades.
      ctx.fillStyle = '#0e0b14';
      if (w >= h) ctx.fillRect(Math.floor(w / 2) - 1, 0, 3, h);
      else ctx.fillRect(0, Math.floor(h / 2) - 1, w, 3);
    }

    if (this.closing >= 0) this.drawClosing(ctx, w, h);
    else if (this.elapsed < GRACE_SECONDS) this.drawOpening(ctx, w, h);

    const managerOpen = this.managers.some((m) => m.open);
    const tutorial = managerOpen ? null : this.tutorialHint(app.progress);
    if (tutorial) this.drawBanner(ctx, w, h, tutorial);

    if (this.paused) this.drawPause(ctx, w, h);
  }

  /** Qué lleva el jugador en las manos, debajo del marcador de la derecha. */
  private drawPlayerStrip(ctx: CanvasRenderingContext2D, vp: Viewport, sim: StoreSim, padIndex: number): void {
    const player = sim.players.find((p) => p.index === padIndex);
    if (!player?.carrying) return;
    const s = Math.max(1, Math.min(3, Math.round(Math.min(vp.w / 230, vp.h / 180))));
    const text = `LLEVÁS ${player.carrying.units} x ${product(player.carrying.productId).name.toUpperCase()}`;
    drawText(ctx, text, vp.x + vp.w - 4 * s, vp.y + 42 * s, {
      color: UI.gold,
      align: 'right',
      scale: s,
      outline: '#1b1626',
    });
  }

  private tutorialHint(progress: Progress): string | null {
    if (this.mode === 'versus' || progress.day !== 1) return null;
    const sim = this.sims[0];
    const hasBoxes = sim.world.boxes.length > 0;
    const carrying = sim.players.some((p) => p.carrying !== null);
    const stocked = sim.world.shelves.some((s) => s.units > 0);
    if (!stocked && !carrying && !hasBoxes) return 'ANDÁ A LA COMPUTADORA Y COMPRÁ CAJAS AL MAYORISTA';
    if (!carrying && !stocked) return 'LEVANTÁ UNA CAJA DEL DEPÓSITO CON EL BOTÓN DE ACCIÓN';
    if (!stocked) return 'LLEVALA A UNA GÓNDOLA Y MANTENÉ EL BOTÓN PARA REPONER';
    if (sim.stats.served === 0) return 'ESPERÁ A LOS CLIENTES Y COBRALES EN LA CAJA';
    return null;
  }

  private drawBanner(ctx: CanvasRenderingContext2D, w: number, h: number, text: string): void {
    // Achicamos el texto hasta que entre a lo ancho, y si aún así no entra lo
    // partimos en dos renglones: en celular vertical no hay lugar para todo.
    const max = w - 16;
    let s = uiScaleFor(w, h);
    while (s > 1 && textWidth(text, s) > max) s--;
    const lines = textWidth(text, s) > max ? wrapText(text, max, s) : [text];
    const lineH = 10 * s;
    const boxH = 6 * s + lines.length * lineH;
    const y = h - boxH - 4 * s;
    ctx.fillStyle = 'rgba(20, 16, 28, 0.85)';
    ctx.fillRect(0, y, w, boxH);
    ctx.fillStyle = UI.gold;
    ctx.fillRect(0, y, w, s);
    lines.forEach((line, i) => {
      drawText(ctx, line, w / 2, y + 3 * s + i * lineH, { color: UI.text, align: 'center', scale: s });
    });
  }

  private drawOpening(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    const s = uiScaleFor(w, h);
    const left = Math.ceil(GRACE_SECONDS - this.elapsed);
    drawText(ctx, `ABRE EN ${left}`, w / 2, Math.round(h * 0.32), {
      color: UI.gold,
      align: 'center',
      scale: s + 2,
      outline: '#2a1f12',
    });
    drawText(ctx, 'APROVECHÁ PARA REPONER', w / 2, Math.round(h * 0.32) + 14 * (s + 2), {
      color: UI.text,
      align: 'center',
      scale: s,
      outline: '#2a1f12',
    });
  }

  private drawClosing(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    const s = uiScaleFor(w, h);
    ctx.fillStyle = `rgba(10, 8, 16, ${clamp(this.closing / CLOSING_SECONDS, 0, 0.5)})`;
    ctx.fillRect(0, 0, w, h);
    drawText(ctx, 'CERRAMOS', w / 2, Math.round(h * 0.42), {
      color: UI.gold,
      align: 'center',
      scale: s + 2,
      outline: '#2a1f12',
    });
    drawText(ctx, 'ÚLTIMOS CLIENTES...', w / 2, Math.round(h * 0.42) + 14 * (s + 2), {
      color: UI.text,
      align: 'center',
      scale: s,
      outline: '#2a1f12',
    });
  }

  private drawPause(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    const s = uiScaleFor(w, h);
    ctx.fillStyle = 'rgba(10, 8, 16, 0.72)';
    ctx.fillRect(0, 0, w, h);
    const pw = 150 * s;
    const ph = 26 * s + PAUSE_OPTIONS.length * 16 * s;
    const x = Math.round((w - pw) / 2);
    const y = Math.round((h - ph) / 2);
    drawPanel(ctx, x, y, pw, ph, s);
    drawText(ctx, 'PAUSA', x + pw / 2, y + 5 * s, { color: UI.gold, align: 'center', scale: s + 1 });
    PAUSE_OPTIONS.forEach((label, i) => {
      const text = i === 1 ? (audio.muted ? 'SONIDO: NO' : 'SONIDO: SÍ') : label;
      drawButton(ctx, text, x + 8 * s, y + 20 * s + i * 16 * s, pw - 16 * s, 12 * s, s, {
        selected: i === this.pauseCursor.index,
      });
    });
  }
}
