/**
 * Controles táctiles para el celular.
 *
 * Cada jugador tiene su mitad de pantalla: el palanca aparece donde apoya el
 * dedo (izquierda) y el botón de acción está fijo (derecha). Aparecen solos
 * cuando detectamos una pantalla táctil y desaparecen si se usa el teclado.
 */

import { drawText } from '../engine/font';
import type { Input } from '../engine/input';
import type { Viewport } from '../game/render';

interface Zone {
  pad: number;
  rect: Viewport;
}

interface Stick {
  pointerId: number;
  originX: number;
  originY: number;
  x: number;
  y: number;
  pad: number;
}

const STICK_RADIUS = 46;
const BUTTON_RADIUS = 38;

export class TouchControls {
  enabled = false;
  private zones: Zone[] = [];
  private sticks = new Map<number, Stick>();
  private buttons = new Map<number, { pad: number; kind: 'action' | 'drop' }>();
  private input: Input;

  constructor(input: Input) {
    this.input = input;
  }

  attach(canvas: HTMLCanvasElement): void {
    canvas.addEventListener('pointerdown', this.onDown);
    canvas.addEventListener('pointermove', this.onMove);
    canvas.addEventListener('pointerup', this.onUp);
    canvas.addEventListener('pointercancel', this.onUp);
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  setZones(zones: Zone[]): void {
    this.zones = zones;
  }

  /** Se prende solo con el primer toque; en PC nunca aparece. */
  private ensureEnabled(): void {
    if (!this.enabled) this.enabled = true;
  }

  private zoneAt(x: number, y: number): Zone | null {
    for (const z of this.zones) {
      if (x >= z.rect.x && x <= z.rect.x + z.rect.w && y >= z.rect.y && y <= z.rect.y + z.rect.h) return z;
    }
    return this.zones[0] ?? null;
  }

  private actionCenter(zone: Zone): { x: number; y: number } {
    return {
      x: zone.rect.x + zone.rect.w - BUTTON_RADIUS - 24,
      y: zone.rect.y + zone.rect.h - BUTTON_RADIUS - 24,
    };
  }

  private dropCenter(zone: Zone): { x: number; y: number } {
    const a = this.actionCenter(zone);
    return { x: a.x - BUTTON_RADIUS - 30, y: a.y + 14 };
  }

  private onDown = (ev: PointerEvent): void => {
    const zone = this.zoneAt(ev.clientX, ev.clientY);
    if (!zone) return;
    this.ensureEnabled();
    (ev.target as HTMLElement).setPointerCapture?.(ev.pointerId);

    const action = this.actionCenter(zone);
    if (Math.hypot(ev.clientX - action.x, ev.clientY - action.y) <= BUTTON_RADIUS + 12) {
      this.buttons.set(ev.pointerId, { pad: zone.pad, kind: 'action' });
      this.input.setVirtualAction(zone.pad, true);
      return;
    }
    const drop = this.dropCenter(zone);
    if (Math.hypot(ev.clientX - drop.x, ev.clientY - drop.y) <= BUTTON_RADIUS - 6) {
      this.buttons.set(ev.pointerId, { pad: zone.pad, kind: 'drop' });
      this.input.pressVirtualDrop(zone.pad);
      return;
    }

    this.sticks.set(ev.pointerId, {
      pointerId: ev.pointerId,
      originX: ev.clientX,
      originY: ev.clientY,
      x: ev.clientX,
      y: ev.clientY,
      pad: zone.pad,
    });
  };

  private onMove = (ev: PointerEvent): void => {
    const stick = this.sticks.get(ev.pointerId);
    if (!stick) return;
    stick.x = ev.clientX;
    stick.y = ev.clientY;
    const dx = stick.x - stick.originX;
    const dy = stick.y - stick.originY;
    const len = Math.hypot(dx, dy);
    const dead = 8;
    if (len < dead) {
      this.input.setVirtualAxes(stick.pad, 0, 0);
      return;
    }
    const clamped = Math.min(1, (len - dead) / (STICK_RADIUS - dead));
    this.input.setVirtualAxes(stick.pad, (dx / len) * clamped, (dy / len) * clamped);
  };

  private onUp = (ev: PointerEvent): void => {
    const stick = this.sticks.get(ev.pointerId);
    if (stick) {
      this.input.setVirtualAxes(stick.pad, 0, 0);
      this.sticks.delete(ev.pointerId);
    }
    const button = this.buttons.get(ev.pointerId);
    if (button) {
      if (button.kind === 'action') this.input.setVirtualAction(button.pad, false);
      this.buttons.delete(ev.pointerId);
    }
  };

  draw(ctx: CanvasRenderingContext2D): void {
    if (!this.enabled) return;
    for (const zone of this.zones) {
      const action = this.actionCenter(zone);
      const held = [...this.buttons.values()].some((b) => b.pad === zone.pad && b.kind === 'action');
      circle(ctx, action.x, action.y, BUTTON_RADIUS, held ? 'rgba(255,176,63,0.55)' : 'rgba(245,236,221,0.22)');
      drawText(ctx, 'OK', action.x, action.y - 8, { color: '#fdf6ea', align: 'center', scale: 2 });

      const drop = this.dropCenter(zone);
      circle(ctx, drop.x, drop.y, BUTTON_RADIUS - 8, 'rgba(245,236,221,0.16)');
      drawText(ctx, 'SOLTAR', drop.x, drop.y - 4, { color: '#fdf6ea', align: 'center', scale: 1 });
    }

    for (const stick of this.sticks.values()) {
      circle(ctx, stick.originX, stick.originY, STICK_RADIUS, 'rgba(245,236,221,0.14)');
      const dx = stick.x - stick.originX;
      const dy = stick.y - stick.originY;
      const len = Math.hypot(dx, dy) || 1;
      const capped = Math.min(len, STICK_RADIUS);
      circle(
        ctx,
        stick.originX + (dx / len) * capped,
        stick.originY + (dy / len) * capped,
        18,
        'rgba(255,176,63,0.6)',
      );
    }
  }
}

function circle(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string): void {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
}
