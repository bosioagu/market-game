/**
 * Entrada unificada: teclado, joystick (Gamepad API) y controles táctiles.
 *
 * El juego siempre lee "pads" numerados: el pad 0 es el jugador 1 (WASD) y el
 * pad 1 es el jugador 2 (flechas). Cada pad puede ser alimentado por cualquiera
 * de las tres fuentes, así que la lógica del juego no sabe ni le importa si la
 * persona está usando teclado, joystick o la pantalla del celular.
 *
 * Cuando se juega solo no hay segundo jugador que pueda quedarse sin teclas, así
 * que `unirTeclados` hace que el pad 0 acepte los dos juegos a la vez: WASD y
 * las flechas mueven al mismo personaje.
 */

import { clamp } from './math';

export interface PadState {
  /** Eje horizontal, -1..1 */
  ax: number;
  /** Eje vertical, -1..1 (positivo = abajo) */
  ay: number;
  /** Botón de acción mantenido. */
  action: boolean;
  /** Botón de acción recién presionado en este frame. */
  actionPressed: boolean;
  /** Botón secundario (soltar / cancelar) recién presionado. */
  dropPressed: boolean;
  /** El pad registró actividad alguna vez (sirve para detectar mandos conectados). */
  active: boolean;
}

interface VirtualPad {
  ax: number;
  ay: number;
  action: boolean;
  actionEdge: boolean;
  dropEdge: boolean;
}

const P1_KEYS = {
  up: ['KeyW'],
  down: ['KeyS'],
  left: ['KeyA'],
  right: ['KeyD'],
  action: ['Space', 'KeyE', 'KeyF'],
  drop: ['KeyQ', 'ShiftLeft'],
};

const P2_KEYS = {
  up: ['ArrowUp'],
  down: ['ArrowDown'],
  left: ['ArrowLeft'],
  right: ['ArrowRight'],
  action: ['Enter', 'NumpadEnter', 'Numpad0', 'ControlRight'],
  drop: ['ShiftRight', 'NumpadDecimal', 'Slash'],
};

const KEY_MAPS = [P1_KEYS, P2_KEYS];

/** Teclas que el navegador no debe usar para scrollear mientras se juega. */
const SWALLOW = new Set([
  'Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
  'Enter', 'NumpadEnter', 'Numpad0', 'Slash', 'Tab',
]);

export class Input {
  private held = new Set<string>();
  private downEdge = new Set<string>();
  private upEdge = new Set<string>();
  private virtual: VirtualPad[] = [newVirtual(), newVirtual()];
  /**
   * En un jugador, el pad 0 responde a los dos teclados (WASD y flechas).
   * En dos jugadores queda en false para que cada uno tenga el suyo.
   */
  unirTeclados = false;
  private prevGamepadButtons: boolean[][] = [[], []];
  private prevGamepadDrop: boolean[] = [false, false];
  private pads: PadState[] = [newPad(), newPad()];
  /** Última fuente usada: sirve para mostrar los controles correctos en pantalla. */
  lastSource: 'keyboard' | 'touch' | 'gamepad' = 'keyboard';
  private anyKeyFlag = false;

  attach(target: EventTarget = window): void {
    target.addEventListener('keydown', this.onKeyDown as EventListener);
    target.addEventListener('keyup', this.onKeyUp as EventListener);
    window.addEventListener('blur', this.onBlur);
  }

  detach(target: EventTarget = window): void {
    target.removeEventListener('keydown', this.onKeyDown as EventListener);
    target.removeEventListener('keyup', this.onKeyUp as EventListener);
    window.removeEventListener('blur', this.onBlur);
  }

  private onKeyDown = (ev: KeyboardEvent): void => {
    if (ev.repeat) {
      if (SWALLOW.has(ev.code)) ev.preventDefault();
      return;
    }
    this.held.add(ev.code);
    this.downEdge.add(ev.code);
    this.anyKeyFlag = true;
    this.lastSource = 'keyboard';
    if (SWALLOW.has(ev.code)) ev.preventDefault();
  };

  private onKeyUp = (ev: KeyboardEvent): void => {
    this.held.delete(ev.code);
    this.upEdge.add(ev.code);
  };

  private onBlur = (): void => {
    this.held.clear();
    for (const v of this.virtual) {
      v.ax = 0;
      v.ay = 0;
      v.action = false;
    }
  };

  /** Alimentado por los controles táctiles. */
  setVirtualAxes(pad: number, ax: number, ay: number): void {
    const v = this.virtual[pad];
    if (!v) return;
    v.ax = clamp(ax, -1, 1);
    v.ay = clamp(ay, -1, 1);
    if (ax !== 0 || ay !== 0) this.lastSource = 'touch';
  }

  setVirtualAction(pad: number, down: boolean): void {
    const v = this.virtual[pad];
    if (!v) return;
    if (down && !v.action) v.actionEdge = true;
    v.action = down;
    if (down) this.lastSource = 'touch';
  }

  pressVirtualDrop(pad: number): void {
    const v = this.virtual[pad];
    if (!v) return;
    v.dropEdge = true;
    this.lastSource = 'touch';
  }

  keyDown(code: string): boolean {
    return this.held.has(code);
  }

  keyPressed(code: string): boolean {
    return this.downEdge.has(code);
  }

  /** ¿Se apretó cualquier tecla/botón este frame? Útil en pantallas de título. */
  anyPressed(): boolean {
    if (this.anyKeyFlag) return true;
    return this.pads.some((p) => p.actionPressed);
  }

  pad(index: number): PadState {
    return this.pads[index] ?? newPad();
  }

  /** Suma de los pads: permite navegar menús con cualquiera de los dos controles. */
  menuPad(): PadState {
    const a = this.pads[0];
    const b = this.pads[1];
    return {
      ax: Math.abs(a.ax) > Math.abs(b.ax) ? a.ax : b.ax,
      ay: Math.abs(a.ay) > Math.abs(b.ay) ? a.ay : b.ay,
      action: a.action || b.action,
      actionPressed: a.actionPressed || b.actionPressed,
      dropPressed: a.dropPressed || b.dropPressed,
      active: a.active || b.active,
    };
  }

  /** Se llama una vez por frame, antes de la lógica del juego. */
  update(): void {
    this.pollGamepads();
    for (let i = 0; i < this.pads.length; i++) {
      this.pads[i] = this.buildPad(i);
    }
  }

  /** Se llama al final del frame para limpiar los flancos. */
  endFrame(): void {
    this.downEdge.clear();
    this.upEdge.clear();
    this.anyKeyFlag = false;
    for (const v of this.virtual) {
      v.actionEdge = false;
      v.dropEdge = false;
    }
    for (const p of this.pads) {
      p.actionPressed = false;
      p.dropPressed = false;
    }
  }

  private gamepadAxes: { ax: number; ay: number; action: boolean; actionEdge: boolean; dropEdge: boolean }[] = [
    { ax: 0, ay: 0, action: false, actionEdge: false, dropEdge: false },
    { ax: 0, ay: 0, action: false, actionEdge: false, dropEdge: false },
  ];

  private pollGamepads(): void {
    const nav = navigator as Navigator & { getGamepads?: () => (Gamepad | null)[] };
    if (typeof nav.getGamepads !== 'function') return;
    const list = nav.getGamepads();
    for (let i = 0; i < 2; i++) {
      const gp = list[i];
      const slot = this.gamepadAxes[i];
      if (!gp) {
        slot.ax = 0;
        slot.ay = 0;
        slot.action = false;
        continue;
      }
      const dead = 0.28;
      let ax = gp.axes[0] ?? 0;
      let ay = gp.axes[1] ?? 0;
      if (Math.abs(ax) < dead) ax = 0;
      if (Math.abs(ay) < dead) ay = 0;
      // Cruceta digital (botones 12..15 en el mapeo estándar).
      if (gp.buttons[12]?.pressed) ay = -1;
      if (gp.buttons[13]?.pressed) ay = 1;
      if (gp.buttons[14]?.pressed) ax = -1;
      if (gp.buttons[15]?.pressed) ax = 1;
      slot.ax = clamp(ax, -1, 1);
      slot.ay = clamp(ay, -1, 1);

      const actionNow = !!(gp.buttons[0]?.pressed || gp.buttons[2]?.pressed);
      const dropNow = !!(gp.buttons[1]?.pressed || gp.buttons[3]?.pressed);
      const prev = this.prevGamepadButtons[i];
      if (actionNow && !prev[0]) slot.actionEdge = true;
      if (dropNow && !this.prevGamepadDrop[i]) slot.dropEdge = true;
      prev[0] = actionNow;
      this.prevGamepadDrop[i] = dropNow;
      slot.action = actionNow;
      if (actionNow || ax !== 0 || ay !== 0) this.lastSource = 'gamepad';
    }
  }

  private buildPad(index: number): PadState {
    const maps = this.unirTeclados && index === 0 ? KEY_MAPS : [KEY_MAPS[index]];
    const prev = this.pads[index];
    let ax = 0;
    let ay = 0;
    let action = false;
    let actionPressed = false;
    let dropPressed = false;

    // Se cuenta como activa una tecla que sigue apretada O que se apretó en
    // este frame: si no, un toque de menos de 16 ms se perdería entre frames.
    const dir = (codes: readonly string[]): boolean =>
      anyHeld(this.held, codes) || anyHeld(this.downEdge, codes);

    for (const map of maps) {
      if (!map) continue;
      if (dir(map.left)) ax -= 1;
      if (dir(map.right)) ax += 1;
      if (dir(map.up)) ay -= 1;
      if (dir(map.down)) ay += 1;
      action = action || anyHeld(this.held, map.action);
      actionPressed = actionPressed || anyHeld(this.downEdge, map.action);
      dropPressed = dropPressed || anyHeld(this.downEdge, map.drop);
    }

    const v = this.virtual[index];
    if (v) {
      if (v.ax !== 0) ax = v.ax;
      if (v.ay !== 0) ay = v.ay;
      action = action || v.action;
      actionPressed = actionPressed || v.actionEdge;
      dropPressed = dropPressed || v.dropEdge;
    }

    const g = this.gamepadAxes[index];
    if (g) {
      if (g.ax !== 0) ax = g.ax;
      if (g.ay !== 0) ay = g.ay;
      action = action || g.action;
      actionPressed = actionPressed || g.actionEdge;
      dropPressed = dropPressed || g.dropEdge;
      g.actionEdge = false;
      g.dropEdge = false;
    }

    // Normaliza para que la diagonal no sea más rápida.
    const len = Math.hypot(ax, ay);
    if (len > 1) {
      ax /= len;
      ay /= len;
    }

    return {
      ax,
      ay,
      action,
      actionPressed,
      dropPressed,
      active: prev.active || ax !== 0 || ay !== 0 || action,
    };
  }
}

function anyHeld(set: Set<string>, codes: readonly string[]): boolean {
  for (const c of codes) if (set.has(c)) return true;
  return false;
}

function newPad(): PadState {
  return { ax: 0, ay: 0, action: false, actionPressed: false, dropPressed: false, active: false };
}

function newVirtual(): VirtualPad {
  return { ax: 0, ay: 0, action: false, actionEdge: false, dropEdge: false };
}
