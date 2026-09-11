/**
 * La computadora del local: comprar al mayorista, poner precios y comprar mejoras.
 *
 * Se maneja con el mismo pad que el personaje, así que funciona igual con
 * teclado, joystick o los controles táctiles del celular.
 */

import { drawText, textWidth } from '../engine/font';
import type { PadState } from '../engine/input';
import { audio } from '../engine/audio';
import { clamp } from '../engine/math';
import { boxCost, product } from '../game/data/products';
import type { StoreSim } from '../game/session';
import { itemSpriteScaled } from '../game/render';
import { perksFor, upgradeCost, UPGRADES, upgradeLevel, type Progress } from '../game/progress';
import { drawPanel, drawButton, UI, uiScaleFor } from './panel';
import type { Viewport } from '../game/render';

type Tab = 'mayorista' | 'precios' | 'mejoras';
const TABS: Tab[] = ['mayorista', 'precios', 'mejoras'];
const TAB_LABEL: Record<Tab, string> = {
  mayorista: 'MAYORISTA',
  precios: 'PRECIOS',
  mejoras: 'MEJORAS',
};

const REPEAT_FIRST = 0.32;
const REPEAT_NEXT = 0.07;

export class ManagerUi {
  open = false;
  private tab: Tab = 'mayorista';
  private row = 0;
  private boxQty = 1;
  private repeatTimer = 0;
  private lastDir = 0;
  private vRepeat = 0;
  private lastVDir = 0;
  private message = '';
  private messageTime = 0;

  reset(): void {
    this.tab = 'mayorista';
    this.row = 0;
    this.boxQty = 1;
    this.message = '';
    this.messageTime = 0;
  }

  private note(text: string): void {
    this.message = text;
    this.messageTime = 2;
  }

  private rowCount(sim: StoreSim): number {
    return this.tab === 'mejoras' ? UPGRADES.length : sim.catalogue.length;
  }

  /** Devuelve true si hay que cerrar la pantalla. */
  update(dt: number, pad: PadState, sim: StoreSim, progress: Progress): boolean {
    if (this.messageTime > 0) {
      this.messageTime -= dt;
      if (this.messageTime <= 0) this.message = '';
    }

    if (pad.dropPressed) {
      audio.sfx('back');
      return true;
    }

    // Arriba / abajo: cambiar de fila, con repetición al mantener.
    const vDir = Math.abs(pad.ay) > 0.5 ? Math.sign(pad.ay) : 0;
    if (vDir !== this.lastVDir) {
      this.lastVDir = vDir;
      this.vRepeat = REPEAT_FIRST;
      if (vDir !== 0) this.moveRow(vDir, sim);
    } else if (vDir !== 0) {
      this.vRepeat -= dt;
      if (this.vRepeat <= 0) {
        this.vRepeat = REPEAT_NEXT;
        this.moveRow(vDir, sim);
      }
    }

    const hDir = Math.abs(pad.ax) > 0.5 ? Math.sign(pad.ax) : 0;
    if (hDir !== this.lastDir) {
      this.lastDir = hDir;
      this.repeatTimer = REPEAT_FIRST;
      if (hDir !== 0) this.adjust(hDir, sim, progress);
    } else if (hDir !== 0) {
      this.repeatTimer -= dt;
      if (this.repeatTimer <= 0) {
        this.repeatTimer = REPEAT_NEXT;
        this.adjust(hDir, sim, progress);
      }
    }

    if (pad.actionPressed) this.confirm(sim, progress);
    return false;
  }

  /** Cambiar de pestaña se hace con las filas extremas del listado. */
  cycleTab(dir: number): void {
    const i = TABS.indexOf(this.tab);
    this.tab = TABS[(i + dir + TABS.length) % TABS.length];
    this.row = 0;
    audio.sfx('menu');
  }

  private moveRow(dir: number, sim: StoreSim): void {
    const count = this.rowCount(sim);
    const next = this.row + dir;
    if (next < 0) {
      this.cycleTab(-1);
      return;
    }
    if (next >= count) {
      this.cycleTab(1);
      return;
    }
    this.row = next;
    audio.sfx('menu');
  }

  private adjust(dir: number, sim: StoreSim, progress: Progress): void {
    if (this.tab === 'mayorista') {
      this.boxQty = clamp(this.boxQty + dir, 1, 9);
      audio.sfx('menu');
      return;
    }
    if (this.tab === 'precios') {
      const id = sim.catalogue[this.row];
      if (!id) return;
      const step = product(id).market >= 150 ? 10 : 5;
      sim.setPrice(id, sim.priceOf(id) + dir * step);
      progress.prices[sim.def.id] = { ...sim.prices };
      audio.sfx('menu');
    }
  }

  private confirm(sim: StoreSim, progress: Progress): void {
    if (this.tab === 'mayorista') {
      const id = sim.catalogue[this.row];
      if (!id) return;
      const total = boxCost(id) * this.boxQty;
      if (sim.money < total) {
        audio.sfx('error');
        this.note('No te alcanza la plata');
        return;
      }
      if (sim.world.boxes.filter((b) => b.carriedBy === null).length + this.boxQty > 14) {
        audio.sfx('error');
        this.note('El depósito está lleno');
        return;
      }
      sim.buyBoxes(id, this.boxQty);
      this.note(`Llegaron ${this.boxQty} caja(s) al depósito`);
      return;
    }

    if (this.tab === 'precios') {
      const id = sim.catalogue[this.row];
      if (!id) return;
      sim.setPrice(id, product(id).market);
      progress.prices[sim.def.id] = { ...sim.prices };
      audio.sfx('select');
      this.note('Precio de mercado');
      return;
    }

    const def = UPGRADES[this.row];
    if (!def) return;
    const cost = upgradeCost(progress, def);
    if (cost === null) {
      audio.sfx('error');
      this.note('Ya está al máximo');
      return;
    }
    if (sim.money < cost) {
      audio.sfx('error');
      this.note('No te alcanza la plata');
      return;
    }
    sim.money -= cost;
    sim.stats.spent += cost;
    progress.upgrades[def.id] = upgradeLevel(progress, def.id) + 1;
    this.applyPerks(sim, progress);
    audio.sfx('levelup');
    this.note(`${def.name} mejorada`);
  }

  private applyPerks(sim: StoreSim, progress: Progress): void {
    const perks = perksFor(progress);
    for (const shelf of sim.world.shelves) shelf.capacity = perks.shelfCapacity;
    for (const p of sim.players) p.speedBonus = perks.moveSpeedBonus;
  }

  draw(ctx: CanvasRenderingContext2D, vp: Viewport, sim: StoreSim, progress: Progress): void {
    const s = uiScaleFor(vp.w, vp.h);
    const pad = 8 * s;
    const rowH = 20 * s;
    const count = this.rowCount(sim);
    const chrome = 34 * s + 32 * s; // encabezado + pestañas + dos renglones de pie
    const w = vp.w - pad * 2;
    // El panel se ajusta al contenido en vez de ocupar toda la pantalla vacía.
    const h = Math.min(vp.h - pad * 2, chrome + count * rowH + 6 * s);
    const x = vp.x + pad;
    const y = vp.y + Math.round((vp.h - h) / 2);

    ctx.save();
    ctx.fillStyle = 'rgba(14, 11, 20, 0.78)';
    ctx.fillRect(vp.x, vp.y, vp.w, vp.h);
    drawPanel(ctx, x, y, w, h, s);

    // Encabezado
    drawText(ctx, 'COMPUTADORA DEL LOCAL', x + 4 * s, y + 4 * s, { color: UI.text, scale: s });
    drawText(ctx, `$${Math.round(sim.money)}`, x + w - 4 * s, y + 4 * s, {
      color: UI.gold,
      align: 'right',
      scale: s,
    });

    // Pestañas
    const tabY = y + 16 * s;
    const tabW = Math.floor((w - 8 * s) / TABS.length);
    TABS.forEach((tab, i) => {
      drawButton(ctx, TAB_LABEL[tab], x + 4 * s + i * tabW, tabY, tabW - 3 * s, 12 * s, s, {
        selected: tab === this.tab,
      });
    });

    const listY = tabY + 18 * s;
    const listH = h - (listY - y) - 16 * s;
    const visible = Math.max(1, Math.floor(listH / rowH));
    const first = clamp(this.row - Math.floor(visible / 2), 0, Math.max(0, count - visible));

    for (let i = 0; i < visible && first + i < count; i++) {
      const index = first + i;
      const ry = listY + i * rowH;
      const selected = index === this.row;
      if (selected) {
        ctx.fillStyle = 'rgba(255, 176, 63, 0.22)';
        ctx.fillRect(x + 3 * s, ry - 2 * s, w - 6 * s, rowH - 2 * s);
      }
      if (this.tab === 'mejoras') this.drawUpgradeRow(ctx, index, x, ry, w, s, sim, progress, selected);
      else this.drawProductRow(ctx, index, x, ry, w, s, sim, selected);
    }

    const footY = y + h - 10 * s;
    const hint =
      this.tab === 'mayorista'
        ? `← → CANTIDAD   BOTÓN: COMPRAR ${this.boxQty} CAJA(S)`
        : this.tab === 'precios'
          ? '← → PRECIO   BOTÓN: VOLVER AL DE MERCADO'
          : 'BOTÓN: COMPRAR MEJORA';
    drawText(ctx, this.message || hint, x + 4 * s, footY - 9 * s, {
      color: this.message ? UI.gold : UI.dim,
      scale: s,
    });
    drawText(ctx, 'SALIR: Q / SHIFT', x + w - 4 * s, footY - 9 * s, {
      color: UI.dim,
      align: 'right',
      scale: s,
    });
    drawText(ctx, '↑↓ MOVER · EXTREMOS = PESTAÑA', x + 4 * s, footY, { color: UI.dim, scale: s });
    if (count > visible) {
      drawText(ctx, `${this.row + 1}/${count}`, x + w - 4 * s, footY, {
        color: UI.dim,
        align: 'right',
        scale: s,
      });
    }
    ctx.restore();
  }

  private drawProductRow(
    ctx: CanvasRenderingContext2D,
    index: number,
    x: number,
    y: number,
    w: number,
    s: number,
    sim: StoreSim,
    selected: boolean,
  ): void {
    const id = sim.catalogue[index];
    if (!id) return;
    const def = product(id);
    const icon = itemSpriteScaled(id, s);
    ctx.drawImage(icon.canvas, x + 5 * s, y);
    const textX = x + 5 * s + icon.w + 3 * s;
    drawText(ctx, def.name.toUpperCase(), textX, y + s, {
      color: selected ? UI.gold : UI.text,
      scale: s,
    });

    const right = x + w - 5 * s;
    if (this.tab === 'mayorista') {
      const inStore =
        sim.world.shelves.reduce((n, sh) => n + (sh.productId === id ? sh.units : 0), 0) +
        sim.world.boxes.reduce((n, b) => n + (b.productId === id ? b.units : 0), 0);
      drawText(ctx, `CAJA x${def.perBox}  $${boxCost(id)}`, textX, y + 10 * s, { color: UI.dim, scale: s });
      drawText(ctx, `TENÉS ${inStore}`, right, y + s, { color: UI.dim, align: 'right', scale: s });
      const total = boxCost(id) * this.boxQty;
      drawText(ctx, `x${this.boxQty} = $${total}`, right, y + 10 * s, {
        color: sim.money >= total ? UI.good : UI.bad,
        align: 'right',
        scale: s,
      });
    } else {
      const verdict = sim.priceVerdict(id);
      drawText(ctx, `COSTO $${def.cost}   MERCADO $${def.market}`, textX, y + 8 * s, {
        color: UI.dim,
        scale: s,
      });
      const priceText = `< $${sim.priceOf(id)} >`;
      drawText(ctx, priceText, right, y + s, { color: UI.text, align: 'right', scale: s });
      drawText(ctx, verdict.text, right, y + 10 * s, { color: verdict.color, align: 'right', scale: s });
    }
  }

  private drawUpgradeRow(
    ctx: CanvasRenderingContext2D,
    index: number,
    x: number,
    y: number,
    w: number,
    s: number,
    sim: StoreSim,
    progress: Progress,
    selected: boolean,
  ): void {
    const def = UPGRADES[index];
    const level = upgradeLevel(progress, def.id);
    const cost = upgradeCost(progress, def);
    drawText(ctx, def.name.toUpperCase(), x + 5 * s, y + s, {
      color: selected ? UI.gold : UI.text,
      scale: s,
    });
    drawText(ctx, def.description.toUpperCase(), x + 5 * s, y + 10 * s, { color: UI.dim, scale: s });
    const right = x + w - 5 * s;
    const stars = '★'.repeat(level);
    drawText(ctx, `${stars}  NIVEL ${level}/${def.maxLevel}`, right, y + s, {
      color: level > 0 ? UI.gold : UI.dim,
      align: 'right',
      scale: s,
    });
    drawText(ctx, cost === null ? 'MÁXIMO' : `$${cost}`, right, y + 10 * s, {
      color: cost === null ? UI.dim : sim.money >= cost ? UI.good : UI.bad,
      align: 'right',
      scale: s,
    });
  }
}

export function measureLabel(text: string, scale: number): number {
  return textWidth(text, scale);
}
