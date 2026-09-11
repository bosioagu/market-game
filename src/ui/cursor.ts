/** Cursor de menú: mueve la selección con repetición al mantener la dirección. */

import type { PadState } from '../engine/input';
import { audio } from '../engine/audio';

const FIRST = 0.34;
const NEXT = 0.11;

export class MenuCursor {
  index = 0;
  private timer = 0;
  private lastDir = 0;

  reset(index = 0): void {
    this.index = index;
    this.timer = 0;
    this.lastDir = 0;
  }

  update(dt: number, pad: PadState, count: number, axis: 'y' | 'x' = 'y'): boolean {
    if (count <= 0) return false;
    const value = axis === 'y' ? pad.ay : pad.ax;
    const dir = Math.abs(value) > 0.5 ? Math.sign(value) : 0;
    let moved = false;
    if (dir !== this.lastDir) {
      this.lastDir = dir;
      this.timer = FIRST;
      if (dir !== 0) moved = true;
    } else if (dir !== 0) {
      this.timer -= dt;
      if (this.timer <= 0) {
        this.timer = NEXT;
        moved = true;
      }
    }
    if (moved) {
      this.index = (this.index + dir + count) % count;
      audio.sfx('menu');
    }
    return moved;
  }
}
