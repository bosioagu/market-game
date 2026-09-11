/**
 * Prueba de humo: abre el juego en Chromium, lo juega un rato y saca capturas.
 *   npm run build && npx vite preview --port 4180 &
 *   SHOTS=./capturas URL=http://localhost:4180 node tools/smoke.mjs
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const OUT = process.env.SHOTS ?? 'capturas';
const URL = process.env.URL ?? 'http://localhost:4180';
mkdirSync(OUT, { recursive: true });

const errors = [];
const browser = await chromium.launch({
  executablePath: process.env.CHROME || '/opt/pw-browsers/chromium',
  // Sin GPU real, Chromium necesita que le habilitemos el WebGL por software.
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
// La tipografía web puede no estar disponible sin red: el juego usa la del
// sistema y sigue andando, así que eso no cuenta como error.
const ruido = (t) => t.includes('404') || t.includes('ERR_CONNECTION') || t.includes('fonts.googleapis');
page.on('console', (m) => { if (m.type() === 'error' && !ruido(m.text())) errors.push(m.text()); });
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));

const shot = (name) => page.screenshot({ path: `${OUT}/${name}.png` });
const hold = async (key, ms) => { await page.keyboard.down(key); await page.waitForTimeout(ms); await page.keyboard.up(key); };
const state = () => page.evaluate(() => {
  const scene = window.juego?.scene ?? window.juego?.['scene'];
  const sim = scene?.sims?.[0];
  if (!sim) return null;
  return {
    plata: Math.round(sim.money),
    clientes: sim.customers.length,
    cajas: sim.world.boxes.length,
    enGondola: sim.world.shelves.reduce((n, s) => n + s.units, 0),
    atendidos: sim.stats.served,
    ventas: sim.stats.revenue,
    perdidos: sim.stats.lost,
  };
});

await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForTimeout(600);
await shot('1-titulo');

await page.keyboard.press('Space'); await page.waitForTimeout(350); await shot('2-modos');
await page.keyboard.press('Space'); await page.waitForTimeout(350); await shot('3-tiendas');
await page.keyboard.press('Space'); await page.waitForTimeout(900); await shot('4-local');

// Ir al depósito (derecha) y levantar una caja.
await hold('KeyD', 4200);
await page.waitForTimeout(200);
await shot('5-deposito');
await page.keyboard.press('Space');
await page.waitForTimeout(300);

// Llevarla a una góndola y reponer manteniendo el botón.
await hold('KeyW', 900);
await hold('KeyA', 1200);
await page.waitForTimeout(200);
await shot('6-frente-a-gondola');
await hold('Space', 2600);
await page.waitForTimeout(200);
await shot('7-repuesta');

// Volver a la computadora y comprar stock.
await hold('KeyS', 1400);
await hold('KeyD', 1600);
await page.waitForTimeout(200);
await page.keyboard.press('Space');
await page.waitForTimeout(400);
await shot('8-mayorista');
await page.keyboard.press('KeyD'); await page.keyboard.press('KeyD');
await page.waitForTimeout(150);
await page.keyboard.press('Space');
await page.waitForTimeout(350);
await shot('9-compra');
await page.keyboard.press('KeyW'); // baja a la pestaña anterior -> precios
await page.waitForTimeout(250);
await shot('10-precios');
await page.keyboard.press('KeyQ');
await page.waitForTimeout(300);

// Llenar las góndolas usando la API del juego: así la prueba verifica la
// simulación (clientes, fila, cobro) y no mi puntería con el teclado.
await page.evaluate(() => {
  const sim = window.juego.scene.sims[0];
  const ids = sim.catalogue;
  for (const id of ids) sim.buyBoxes(id, 1);
  sim.world.shelves.forEach((sh, i) => {
    sh.productId = ids[i % ids.length];
    sh.units = sh.capacity;
  });
});

// Esperar por estado, no por reloj: con WebGL por software el tiempo de
// juego avanza bastante más despacio que el del reloj de pared.
const esperar = (fn, ms = 90000) => page.waitForFunction(fn, null, { timeout: ms });

await esperar(() => window.juego.scene.sims[0].customers.length > 0).catch(() => {});
await shot('11-con-clientes');
const mitad = await state();
console.log('mitad del día:', JSON.stringify(mitad));
if (!(mitad.clientes > 0)) errors.push('no entró ningún cliente');

// Poner al jugador detrás de la caja y cobrar en cuanto haya alguien esperando.
await page.evaluate(() => {
  const sim = window.juego.scene.sims[0];
  const reg = sim.world.registers[0];
  sim.players[0].carrying = null;
  sim.players[0].pos.x = reg.staff.x;
  sim.players[0].pos.y = reg.staff.y;
});
await esperar(() => window.juego.scene.sims[0].customers.some((c) => c.state === 'pagando')).catch(() => {});
await page.keyboard.down('Space');
await esperar(() => window.juego.scene.sims[0].stats.served > 0, 60000).catch(() => {});
await page.keyboard.up('Space');
await page.waitForTimeout(400);
await shot('12-cobrando');
const fin = await state();
console.log('después de cobrar:', JSON.stringify(fin));

if (!(fin.atendidos > 0)) errors.push('no se pudo cobrar a ningún cliente');
if (!(fin.ventas > 0)) errors.push('las ventas quedaron en cero');

// Adelantar el reloj para ver el cierre del día y el resumen.
await page.evaluate(() => { window.juego.scene.elapsed = 164; });
await page.waitForFunction(() => !!window.juego.scene.args, null, { timeout: 60000 }).catch(() => {});
await page.waitForTimeout(600);
await shot('13-cierre-del-dia');
const enResultados = await page.evaluate(() => !!window.juego.scene.args);
console.log('llegó a la pantalla de cierre:', enResultados);

const vista3d = await page.evaluate(() => ({ webgl: !!window.juego.render3d, vista: window.juego.progress.vista }));
console.log('render 3D disponible:', JSON.stringify(vista3d));
if (!vista3d.webgl) errors.push('no se pudo crear el contexto WebGL');
if (!enResultados) errors.push('el día no terminó en la pantalla de resultados');

// --- Pantalla dividida: cooperativo y competencia, en PC y en celular ---
async function dosJugadores(width, height, nombre, modo, vista = 'tres-d') {
  const p2 = await browser.newPage({ viewport: { width, height } });
  p2.on('pageerror', (e) => errors.push(`${nombre}: ${e.message}`));
  await p2.goto(URL, { waitUntil: 'networkidle' });

  // Se navega el menú por estado, no por tiempos: con WebGL por software los
  // frames tardan y las esperas fijas se desincronizan.
  await p2.waitForFunction(() => window.juego?.scene?.step === 'titulo');
  await p2.evaluate((v) => { window.juego.progress.vista = v; }, vista);
  await p2.keyboard.press('Space');
  await p2.waitForFunction(() => window.juego?.scene?.step === 'modo');
  await p2.evaluate((m) => { window.juego.scene.cursor.index = m; }, modo);
  await p2.keyboard.press('Space');
  await p2.waitForFunction(() => window.juego?.scene?.step === 'tienda');
  await p2.keyboard.press('Space');
  await p2.waitForFunction(() => Array.isArray(window.juego?.scene?.sims));

  const vistas = await p2.evaluate(() => {
    const sims = window.juego.scene.sims;
    for (const sim of sims) {
      const ids = sim.catalogue;
      sim.world.shelves.forEach((sh, i) => { sh.productId = ids[i % ids.length]; sh.units = sh.capacity; });
    }
    return sims.length;
  });
  const esperadas = modo === 2 ? 2 : 1;
  if (vistas !== esperadas) errors.push(`${nombre}: esperaba ${esperadas} local(es) y hubo ${vistas}`);

  // Adelantar el reloj del local y esperar a que entre gente, por estado.
  await p2.evaluate(() => { window.juego.scene.elapsed = 30; });
  await p2
    .waitForFunction(() => window.juego.scene.sims.some((s) => s.customers.length > 0), null, { timeout: 90000 })
    .catch(() => {});
  await p2.waitForTimeout(1500);
  await p2.screenshot({ path: `${OUT}/${nombre}.png` });
  const info = await p2.evaluate(() => window.juego.scene.sims.map((s) => s.customers.length));
  console.log(`${nombre}: ${vistas} local(es), clientes por local ${JSON.stringify(info)}`);
  if (info.every((n) => n === 0)) errors.push(`${nombre}: no entró ningún cliente`);
  await p2.close();
}

await dosJugadores(1280, 720, '14-coop-pc', 1);
await dosJugadores(1280, 720, '15-versus-pc', 2);
await dosJugadores(844, 390, '16-coop-celular-apaisado', 1);
await dosJugadores(390, 844, '17-coop-celular-vertical', 1);
await dosJugadores(1280, 720, '18-coop-pixel-art', 1, 'pixel');

console.log(errors.length ? 'ERRORES:\n' + errors.join('\n') : 'sin errores de consola');
await browser.close();
if (errors.length) process.exit(1);
