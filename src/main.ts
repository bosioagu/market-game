/** Punto de entrada: crea el canvas y arranca en la pantalla de título. */

import { App } from './app';
import { MenuScene } from './scenes/menu';

function boot(): void {
  const canvas = document.getElementById('juego');
  if (!(canvas instanceof HTMLCanvasElement)) {
    throw new Error('Falta el <canvas id="juego"> en la página');
  }
  const app = new App(canvas);
  app.start(new MenuScene('titulo'));
  // Enganche para depurar y para la prueba automática de `tools/smoke.mjs`.
  (window as unknown as Record<string, unknown>).juego = app;

  const loading = document.getElementById('cargando');
  loading?.remove();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot, { once: true });
} else {
  boot();
}
