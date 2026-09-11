/**
 * Personaje jugable: movimiento, animación y qué lleva en las manos.
 * Las reglas (qué pasa al apretar el botón) viven en `session.ts`.
 */

import type { Facing } from '../../art/chars';
import type { CharacterLook } from '../../art/chars';
import type { Box, Vec, World } from '../world';

const BASE_SPEED = 62;
const CARRY_SPEED = 50;
const RADIUS = 5;

export type PlayerBusy = null | {
  kind: 'restock' | 'scan';
  progress: number;
  duration: number;
};

export class Player {
  readonly index: number;
  readonly name: string;
  readonly look: CharacterLook;
  pos: Vec;
  facing: Facing = 'down';
  flipped = false;
  /** Distancia recorrida, para el ciclo de caminata. */
  walkPhase = 0;
  moving = false;
  carrying: Box | null = null;
  busy: PlayerBusy = null;
  /** Texto flotante corto ("¡No hay stock!"). */
  toast = '';
  toastTime = 0;
  speedBonus = 0;

  constructor(index: number, name: string, look: CharacterLook, spawn: Vec) {
    this.index = index;
    this.name = name;
    this.look = look;
    this.pos = { x: spawn.x, y: spawn.y };
  }

  get speed(): number {
    const base = this.carrying ? CARRY_SPEED : BASE_SPEED;
    return base * (1 + this.speedBonus);
  }

  say(text: string, seconds = 1.6): void {
    this.toast = text;
    this.toastTime = seconds;
  }

  update(dt: number, world: World, ax: number, ay: number, canMove: boolean): void {
    if (this.toastTime > 0) {
      this.toastTime -= dt;
      if (this.toastTime <= 0) this.toast = '';
    }

    const blocked = !canMove || this.busy !== null;
    const mx = blocked ? 0 : ax;
    const my = blocked ? 0 : ay;
    this.moving = mx !== 0 || my !== 0;

    if (this.moving) {
      const step = this.speed * dt;
      world.moveBody(this.pos, mx * step, my * step, RADIUS);
      this.walkPhase += step;
      if (Math.abs(mx) > Math.abs(my)) {
        this.facing = 'side';
        this.flipped = mx < 0;
      } else {
        this.facing = my < 0 ? 'up' : 'down';
      }
    } else {
      this.walkPhase = 0;
    }

    if (this.carrying) {
      this.carrying.x = this.pos.x;
      this.carrying.y = this.pos.y - 14;
    }
  }

  /** Frame del ciclo de caminata: 0 quieto, 0-3 caminando. */
  get frame(): number {
    if (!this.moving) return 0;
    return Math.floor(this.walkPhase / 7) % 4;
  }

  /** Pequeño rebote al caminar, para que no se vea rígido. */
  get bob(): number {
    if (!this.moving) return 0;
    return this.frame === 1 || this.frame === 3 ? -1 : 0;
  }

  startBusy(kind: 'restock' | 'scan', duration: number): void {
    this.busy = { kind, progress: 0, duration };
  }

  cancelBusy(): void {
    this.busy = null;
  }

  /** Avanza la acción en curso; devuelve true cuando se completa. */
  tickBusy(dt: number): boolean {
    if (!this.busy) return false;
    this.busy.progress += dt;
    if (this.busy.progress >= this.busy.duration) {
      this.busy = null;
      return true;
    }
    return false;
  }
}
