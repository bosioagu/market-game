/**
 * Armazón del juego: canvas, bucle de tiempo fijo, escenas y distribución de
 * la pantalla (una vista, o dos cuando juegan dos personas).
 */

import { Input } from './engine/input';
import { audio } from './engine/audio';
import { TouchControls } from './ui/touch';
import { loadProgress, saveProgress, type Progress } from './game/progress';
import type { Viewport } from './game/render';
import type { GameMode } from './game/session';

export interface Scene {
  enter?(app: App): void;
  exit?(app: App): void;
  update(dt: number, app: App): void;
  draw(ctx: CanvasRenderingContext2D, w: number, h: number, app: App): void;
}

const MAX_FRAME = 1 / 20;

export class App {
  readonly canvas: HTMLCanvasElement;
  readonly ctx: CanvasRenderingContext2D;
  readonly input = new Input();
  readonly touch: TouchControls;
  progress: Progress;

  width = 0;
  height = 0;
  dpr = 1;
  time = 0;

  private scene: Scene | null = null;
  private pending: Scene | null = null;
  private lastFrame = 0;
  private running = false;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('Este navegador no soporta canvas 2D');
    this.ctx = ctx;
    this.touch = new TouchControls(this.input);
    this.progress = loadProgress();
    audio.muted = this.progress.muted;
  }

  start(scene: Scene): void {
    this.input.attach();
    this.touch.attach(this.canvas);
    this.resize();
    window.addEventListener('resize', () => this.resize());
    window.addEventListener('orientationchange', () => this.resize());

    const unlock = () => {
      audio.unlock();
      audio.setMuted(this.progress.muted);
      if (!this.progress.muted) audio.startMusic();
    };
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });

    this.setScene(scene);
    this.running = true;
    this.lastFrame = performance.now();
    requestAnimationFrame(this.frame);
  }

  setScene(scene: Scene): void {
    this.pending = scene;
  }

  save(): void {
    this.progress.muted = audio.muted;
    saveProgress(this.progress);
  }

  resize(): void {
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.max(320, window.innerWidth);
    const h = Math.max(240, window.innerHeight);
    this.width = w;
    this.height = h;
    this.canvas.width = Math.round(w * this.dpr);
    this.canvas.height = Math.round(h * this.dpr);
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;
    this.ctx.imageSmoothingEnabled = false;
  }

  private frame = (now: number): void => {
    if (!this.running) return;
    requestAnimationFrame(this.frame);

    let dt = (now - this.lastFrame) / 1000;
    this.lastFrame = now;
    if (!Number.isFinite(dt) || dt <= 0) return;
    // Si la pestaña estuvo en segundo plano, no acumulamos un salto enorme.
    dt = Math.min(dt, MAX_FRAME);
    this.time += dt;

    if (this.pending) {
      this.scene?.exit?.(this);
      this.scene = this.pending;
      this.pending = null;
      this.scene.enter?.(this);
    }

    this.input.update();
    this.scene?.update(dt, this);

    const ctx = this.ctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#15111f';
    ctx.fillRect(0, 0, this.width, this.height);
    this.scene?.draw(ctx, this.width, this.height, this);
    this.touch.draw(ctx);

    this.input.endFrame();
  };
}

/** Reparte la pantalla: una vista, o dos siguiendo la orientación del aparato. */
export function layoutViewports(mode: GameMode, w: number, h: number): Viewport[] {
  if (mode === 'solo') return [{ x: 0, y: 0, w, h }];
  if (w >= h) {
    // Apaisado: pantalla partida al medio en vertical, como la dibujó Mía.
    const half = Math.floor(w / 2);
    return [
      { x: 0, y: 0, w: half, h },
      { x: half + 1, y: 0, w: w - half - 1, h },
    ];
  }
  const half = Math.floor(h / 2);
  return [
    { x: 0, y: 0, w, h: half },
    { x: 0, y: half + 1, w, h: h - half - 1 },
  ];
}
