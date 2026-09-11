/** Pantalla de título, elección de modo y elección de tienda. */

import type { App, Scene } from '../app';
import { drawText } from '../engine/font';
import { audio } from '../engine/audio';
import { bakeScaled } from '../engine/pixel';
import { characterArt, LOOK_KIKI, LOOK_MIA, lookToPalette } from '../art/chars';
import { drawPanel, drawButton, UI, uiScaleFor } from '../ui/panel';
import { MenuCursor } from '../ui/cursor';
import { careerLevel, resetProgress, type Progress } from '../game/progress';
import { nextLevelEarnings, STORES, type StoreDef } from '../game/data/stores';
import { itemSpriteScaled } from '../game/render';
import type { GameMode } from '../game/session';
import { PlayScene } from './play';

type Step = 'titulo' | 'modo' | 'tienda';

const MODES: { id: GameMode; name: string; detail: string }[] = [
  { id: 'solo', name: 'UN JUGADOR', detail: 'WASD O FLECHAS. SUBÍ DE NIVEL Y ABRÍ TIENDAS NUEVAS' },
  { id: 'coop', name: 'DOS EN EQUIPO', detail: 'MISMA TIENDA, PANTALLA DIVIDIDA. UNO REPONE, OTRO COBRA' },
  { id: 'versus', name: 'DOS COMPITIENDO', detail: 'UNA TIENDA CADA UNO. GANA QUIEN HAGA MÁS PLATA' },
];

export class MenuScene implements Scene {
  private step: Step = 'titulo';
  private mode: GameMode = 'solo';
  private cursor = new MenuCursor();
  private t = 0;
  private confirmReset = false;

  constructor(step: Step = 'titulo') {
    this.step = step;
  }

  enter(app: App): void {
    this.cursor.reset(0);
    app.input.unirTeclados = true;
  }

  update(dt: number, app: App): void {
    this.t += dt;
    const pad = app.input.menuPad();

    if (app.input.keyPressed('KeyM')) {
      audio.setMuted(!audio.muted);
      app.progress.muted = audio.muted;
      if (!audio.muted) audio.startMusic();
      app.save();
    }

    if (this.step === 'titulo') {
      if (pad.actionPressed || app.input.keyPressed('Space') || app.input.keyPressed('Enter')) {
        audio.sfx('select');
        this.step = 'modo';
        this.cursor.reset(0);
      }
      return;
    }

    if (this.step === 'modo') {
      this.cursor.update(dt, pad, MODES.length);
      if (app.input.keyPressed('KeyR')) {
        this.confirmReset = !this.confirmReset;
        audio.sfx('menu');
      }
      if (this.confirmReset && app.input.keyPressed('KeyY')) {
        app.progress = resetProgress();
        this.confirmReset = false;
        audio.sfx('levelup');
      }
      if (pad.actionPressed) {
        this.mode = MODES[this.cursor.index].id;
        audio.sfx('select');
        this.step = 'tienda';
        this.cursor.reset(0);
      }
      if (pad.dropPressed) {
        audio.sfx('back');
        this.step = 'titulo';
      }
      return;
    }

    const options = this.storeOptions(app.progress);
    this.cursor.update(dt, pad, options.length);
    if (pad.dropPressed) {
      audio.sfx('back');
      this.step = 'modo';
      this.cursor.reset(0);
      return;
    }
    if (pad.actionPressed) {
      const choice = options[this.cursor.index];
      if (!choice.unlocked) {
        audio.sfx('error');
        return;
      }
      audio.sfx('select');
      app.progress.currentStore = choice.def.id;
      if (!app.progress.seenStores.includes(choice.def.id)) app.progress.seenStores.push(choice.def.id);
      app.save();
      app.setScene(new PlayScene(this.mode, choice.def.id));
    }
  }

  private storeOptions(progress: Progress): { def: StoreDef; unlocked: boolean }[] {
    const level = careerLevel(progress);
    return STORES.map((def) => ({ def, unlocked: def.unlockLevel <= level }));
  }

  draw(ctx: CanvasRenderingContext2D, w: number, h: number, app: App): void {
    const s = uiScaleFor(w, h);
    drawBackdrop(ctx, w, h, this.t);

    if (this.step === 'titulo') this.drawTitle(ctx, w, h, s, app);
    else if (this.step === 'modo') this.drawModes(ctx, w, h, s);
    else this.drawStores(ctx, w, h, s, app);
  }

  private drawTitle(ctx: CanvasRenderingContext2D, w: number, h: number, s: number, app: App): void {
    const cx = Math.round(w / 2);
    const titleScale = s + 2;
    const bob = Math.round(Math.sin(this.t * 2) * 2);

    drawText(ctx, 'MÍA & KIKI', cx, Math.round(h * 0.18) + bob, {
      color: '#ffd36a',
      align: 'center',
      scale: titleScale,
      outline: '#2a1f12',
      shadow: '#8a5a1f',
    });
    drawText(ctx, 'MARKET', cx, Math.round(h * 0.18) + bob + 12 * titleScale, {
      color: '#ff8fae',
      align: 'center',
      scale: titleScale,
      outline: '#3a1a24',
      shadow: '#8a2f45',
    });
    drawText(ctx, 'COMPRÁ, PONÉ PRECIOS, REPONÉ Y COBRÁ', cx, Math.round(h * 0.18) + 26 * titleScale, {
      color: UI.text,
      align: 'center',
      scale: s,
    });

    // Los dos personajes saludando.
    const charScale = Math.max(2, s + 1);
    const frame = Math.floor(this.t * 4) % 4;
    const mia = bakeScaled(characterArt('down', frame), charScale, lookToPalette(LOOK_MIA), 'menu|mia|' + frame);
    const kiki = bakeScaled(characterArt('down', (frame + 2) % 4), charScale, lookToPalette(LOOK_KIKI), 'menu|kiki|' + frame);
    const cy = Math.round(h * 0.58);
    ctx.drawImage(mia.canvas, cx - mia.w - 12 * s, cy);
    ctx.drawImage(kiki.canvas, cx + 12 * s, cy);
    drawText(ctx, 'MÍA', cx - mia.w / 2 - 12 * s, cy + mia.h + 4 * s, { color: '#ff8fae', align: 'center', scale: s });
    drawText(ctx, 'KIKI', cx + kiki.w / 2 + 12 * s, cy + kiki.h + 4 * s, { color: '#7fe3d8', align: 'center', scale: s });

    const blink = Math.sin(this.t * 5) > -0.3;
    if (blink) {
      drawText(ctx, 'APRETÁ ESPACIO O TOCÁ LA PANTALLA', cx, Math.round(h * 0.86), {
        color: UI.gold,
        align: 'center',
        scale: s,
      });
    }
    drawText(ctx, 'WASD O FLECHAS PARA MOVERSE - ESPACIO PARA LA ACCIÓN', cx, Math.round(h * 0.905), {
      color: UI.dim,
      align: 'center',
      scale: s,
    });
    drawText(ctx, `NIVEL ${careerLevel(app.progress)}   $${Math.round(app.progress.money)}   DÍA ${app.progress.day}`, cx, Math.round(h * 0.95), {
      color: UI.dim,
      align: 'center',
      scale: s,
    });
  }

  private drawModes(ctx: CanvasRenderingContext2D, w: number, h: number, s: number): void {
    const panelW = Math.min(w - 20 * s, 300 * s);
    const rowH = 26 * s;
    const panelH = rowH * MODES.length + 40 * s;
    const x = Math.round((w - panelW) / 2);
    const y = Math.round((h - panelH) / 2);
    drawPanel(ctx, x, y, panelW, panelH, s);
    drawText(ctx, '¿CÓMO QUIEREN JUGAR?', x + panelW / 2, y + 6 * s, {
      color: UI.gold,
      align: 'center',
      scale: s,
    });

    MODES.forEach((mode, i) => {
      const ry = y + 20 * s + i * rowH;
      const selected = i === this.cursor.index;
      drawButton(ctx, mode.name, x + 6 * s, ry, panelW - 12 * s, 12 * s, s, { selected });
      drawText(ctx, mode.detail, x + panelW / 2, ry + 14 * s, {
        color: selected ? UI.text : UI.dim,
        align: 'center',
        scale: s,
      });
    });

    const footer = this.confirmReset
      ? 'BORRAR TODO EL PROGRESO: APRETÁ Y PARA CONFIRMAR, R PARA CANCELAR'
      : 'M SILENCIA   R BORRA EL PROGRESO';
    drawText(ctx, footer, x + panelW / 2, y + panelH - 12 * s, {
      color: this.confirmReset ? UI.bad : UI.dim,
      align: 'center',
      scale: s,
    });
  }

  private drawStores(ctx: CanvasRenderingContext2D, w: number, h: number, s: number, app: App): void {
    const options = this.storeOptions(app.progress);
    const level = careerLevel(app.progress);
    const panelW = Math.min(w - 16 * s, 330 * s);
    const rowH = 22 * s;
    const panelH = rowH * options.length + 44 * s;
    const x = Math.round((w - panelW) / 2);
    const y = Math.round((h - panelH) / 2);
    drawPanel(ctx, x, y, panelW, panelH, s);

    drawText(ctx, '¿QUÉ TIENDA ABRIMOS?', x + panelW / 2, y + 5 * s, {
      color: UI.gold,
      align: 'center',
      scale: s,
    });
    drawText(
      ctx,
      `NIVEL ${level}   FALTAN $${Math.max(0, nextLevelEarnings(level) - app.progress.totalEarned)} PARA EL SIGUIENTE`,
      x + panelW / 2,
      y + 14 * s,
      { color: UI.dim, align: 'center', scale: s },
    );

    options.forEach((opt, i) => {
      const ry = y + 26 * s + i * rowH;
      const selected = i === this.cursor.index;
      if (selected) {
        ctx.fillStyle = 'rgba(255,176,63,0.2)';
        ctx.fillRect(x + 4 * s, ry - 2 * s, panelW - 8 * s, rowH - 2 * s);
      }
      const icon = itemSpriteScaled(opt.def.products[0], s);
      ctx.drawImage(icon.canvas, x + 7 * s, ry);
      const color = !opt.unlocked ? UI.dim : selected ? UI.gold : UI.text;
      drawText(ctx, opt.def.name.toUpperCase(), x + 10 * s + icon.w, ry + s, { color, scale: s });
      drawText(
        ctx,
        opt.unlocked ? opt.def.tagline.toUpperCase() : `SE ABRE EN NIVEL ${opt.def.unlockLevel}`,
        x + 10 * s + icon.w,
        ry + 9 * s,
        { color: opt.unlocked ? UI.dim : UI.bad, scale: s },
      );
      drawText(ctx, `ALQUILER $${opt.def.rent}`, x + panelW - 6 * s, ry + s, {
        color: UI.dim,
        align: 'right',
        scale: s,
      });
    });

    drawText(ctx, 'BOTÓN: EMPEZAR   Q/SHIFT: VOLVER', x + panelW / 2, y + panelH - 12 * s, {
      color: UI.dim,
      align: 'center',
      scale: s,
    });
  }
}

/** Fondo: degradé con productos flotando, para que el menú no sea una pared lisa. */
function drawBackdrop(ctx: CanvasRenderingContext2D, w: number, h: number, t: number): void {
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, '#2b2140');
  grad.addColorStop(1, '#151020');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  const icons = ['pizza_muzza', 'pote_frutilla', 'medialuna', 'leche', 'osito', 'remera', 'gaseosa', 'pelota'];
  ctx.save();
  ctx.globalAlpha = 0.12;
  for (let i = 0; i < icons.length; i++) {
    const sprite = itemSpriteScaled(icons[i], 3);
    const x = ((i * 137 + t * 14) % (w + 80)) - 40;
    const y = (i * 97) % Math.max(1, h - 40);
    ctx.drawImage(sprite.canvas, Math.round(x), Math.round(y + Math.sin(t + i) * 8));
  }
  ctx.restore();
}
