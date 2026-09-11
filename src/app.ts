/**
 * Armazón del juego: canvas, bucle de tiempo fijo, escenas y distribución de
 * la pantalla (una vista, o dos cuando juegan dos personas).
 */

import { Input } from './engine/input';
import { audio } from './engine/audio';
import { TouchControls } from './ui/touch';
import { Renderer3D } from './game3d/scene3d';
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
  /** Canvas 2D: carteles, HUD y menús. Va encima del 3D. */
  readonly canvas: HTMLCanvasElement;
  readonly ctx: CanvasRenderingContext2D;
  /** Canvas WebGL con el local en 3D. Null si el navegador no lo soporta. */
  readonly render3d: Renderer3D | null;
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

  constructor(canvas: HTMLCanvasElement, canvas3d: HTMLCanvasElement | null) {
    this.canvas = canvas;
    // Con alpha, el canvas 2D deja ver el 3D que tiene detrás.
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) throw new Error('Este navegador no soporta canvas 2D');
    this.ctx = ctx;
    this.touch = new TouchControls(this.input);
    this.progress = loadProgress();
    audio.muted = this.progress.muted;

    let render3d: Renderer3D | null = null;
    if (canvas3d) {
      try {
        render3d = new Renderer3D(canvas3d);
      } catch {
        // Sin WebGL el juego sigue andando entero en la vista de pixel art.
        render3d = null;
        this.progress.vista = 'pixel';
      }
    }
    this.render3d = render3d;
  }

  /** Vista efectiva: si no hay WebGL, siempre pixel art. */
  get vista(): 'tres-d' | 'pixel' {
    return this.render3d ? this.progress.vista : 'pixel';
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
    this.render3d?.resize(w, h, this.dpr);
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

    this.render3d?.clear();

    const ctx = this.ctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;
    // Se limpia en vez de pintar: las escenas que necesitan fondo lo pintan
    // ellas, y la del local deja ver el 3D que hay debajo.
    ctx.clearRect(0, 0, this.width, this.height);
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
