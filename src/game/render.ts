/**
 * Dibujado del local.
 *
 * El piso y las paredes no cambian nunca, así que se hornean una sola vez en un
 * canvas aparte y después cada frame es un solo `drawImage`. Lo que sí se mueve
 * se ordena por su "y" para que un personaje delante de una góndola la tape.
 */

import { bake, bakeScaled, flipX, type BakedSprite, type Palette } from '../engine/pixel';
import { drawText, textWidth } from '../engine/font';
import { characterArt, lookKey, lookToPalette, type CharacterLook, type Facing } from '../art/chars';
import { SHAPES } from '../art/items';
import { COUNTER, FLOOR, MAT, PLANT, TILE, WALL, WINDOW } from '../art/tiles';
import { STATION_ART } from '../art/stations';
import { clamp } from '../engine/math';
import { product } from './data/products';
import { Tile, type World } from './world';
import type { Player } from './entities/player';
import type { Customer } from './entities/customer';
import type { InteractTarget, StoreSim } from './session';

export interface Viewport {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface View {
  scale: number;
  camX: number;
  camY: number;
}

const staticLayers = new Map<string, HTMLCanvasElement>();

/** Elige cuánto acercar: si el local entra entero lo muestra completo. */
export function computeView(vp: Viewport, world: World, focus: { x: number; y: number }): View {
  const fit = Math.min(vp.w / world.widthPx, vp.h / world.heightPx);
  let scale: number;
  if (fit >= 3) {
    scale = Math.min(6, Math.floor(fit));
  } else {
    scale = Math.max(2, Math.min(5, Math.floor(Math.min(vp.w / 208, vp.h / 144))));
  }
  const viewW = vp.w / scale;
  const viewH = vp.h / scale;
  let camX = focus.x - viewW / 2;
  let camY = focus.y - viewH / 2;
  camX = viewW >= world.widthPx ? (world.widthPx - viewW) / 2 : clamp(camX, 0, world.widthPx - viewW);
  camY = viewH >= world.heightPx ? (world.heightPx - viewH) / 2 : clamp(camY, 0, world.heightPx - viewH);
  return { scale, camX, camY };
}

function characterSprite(look: CharacterLook, facing: Facing, frame: number, flipped: boolean): BakedSprite {
  const key = `char|${lookKey(look)}|${facing}|${frame}`;
  const sprite = bake(characterArt(facing, frame), lookToPalette(look), key);
  if (!flipped || facing !== 'side') return sprite;
  return flipX(sprite, key + '|flip');
}

function itemSprite(productId: string): BakedSprite {
  const def = product(productId);
  return bake(SHAPES[def.shape], def.colors, `item|${def.id}`);
}

export function itemSpriteScaled(productId: string, scale: number): BakedSprite {
  const def = product(productId);
  return bakeScaled(SHAPES[def.shape], scale, def.colors, `item|${def.id}`);
}

/** Caja de cartón con el producto dibujado en el frente. */
function bakeBoxWithProduct(productId: string): BakedSprite {
  const key = `boxfull|${productId}`;
  const frame = bake(
    {
      rows: [
        '..############..',
        '.#WWWWWWWWWWWW#.',
        '#WW##########WW#',
        '#W#..........#W#',
        '#W#..........#W#',
        '#W#..........#W#',
        '#W#..........#W#',
        '#W#..........#W#',
        '#W#..........#W#',
        '#W#..........#W#',
        '#W#..........#W#',
        '#WW##########WW#',
        '.#WWWWWWWWWWWW#.',
        '..############..',
      ],
      pal: { '#': '#6b4a2f', W: '#c98a4b' },
    },
    undefined,
    'box|frame',
  );
  const cached = cachedCanvas(key);
  if (cached) return cached;
  const canvas = document.createElement('canvas');
  canvas.width = frame.w;
  canvas.height = frame.h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('sin contexto 2D');
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(frame.canvas, 0, 0);
  const icon = itemSprite(productId);
  ctx.drawImage(icon.canvas, Math.round((frame.w - icon.w) / 2), 3);
  const sprite: BakedSprite = { canvas, w: frame.w, h: frame.h };
  storeCanvas(key, sprite);
  return sprite;
}

const extraCache = new Map<string, BakedSprite>();
function cachedCanvas(key: string): BakedSprite | undefined {
  return extraCache.get(key);
}
function storeCanvas(key: string, sprite: BakedSprite): void {
  extraCache.set(key, sprite);
}

/** Hornea piso, paredes y mostrador en un solo canvas por tienda. */
function staticLayer(world: World): HTMLCanvasElement {
  const key = world.def.id;
  const hit = staticLayers.get(key);
  if (hit) return hit;

  const canvas = document.createElement('canvas');
  canvas.width = world.widthPx;
  canvas.height = world.heightPx;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('sin contexto 2D');
  ctx.imageSmoothingEnabled = false;

  const floor = bake(FLOOR, world.def.floorPal, `floor|${key}`);
  const wall = bake(WALL, world.def.wallPal, `wall|${key}`);
  const windowSprite = bake(WINDOW, world.def.wallPal, `window|${key}`);
  const counter = bake(COUNTER, world.def.shelfPal, `counter|${key}`);
  const mat = bake(MAT, { 3: world.def.accent }, `mat|${key}`);

  for (let ty = 0; ty < world.rows; ty++) {
    for (let tx = 0; tx < world.cols; tx++) {
      const t = world.tileAt(tx, ty);
      const px = tx * TILE;
      const py = ty * TILE;
      if (t === Tile.Wall) {
        ctx.drawImage(wall.canvas, px, py);
        continue;
      }
      if (t === Tile.Window) {
        ctx.drawImage(windowSprite.canvas, px, py);
        continue;
      }
      ctx.drawImage(floor.canvas, px, py);
      if (t === Tile.Entrance) ctx.drawImage(mat.canvas, px, py);
      if (t === Tile.Storage) drawPallet(ctx, px, py);
      if (t === Tile.Counter) ctx.drawImage(counter.canvas, px, py);
    }
  }

  staticLayers.set(key, canvas);
  return canvas;
}

function drawPallet(ctx: CanvasRenderingContext2D, px: number, py: number): void {
  const pallet = bake(
    {
      rows: [
        '................',
        '................',
        '.##############.',
        '.#............#.',
        '.##############.',
        '.#............#.',
        '.##############.',
        '.#............#.',
        '.##############.',
        '.#............#.',
        '.##############.',
        '.#............#.',
        '.##############.',
        '................',
        '................',
        '................',
      ],
      pal: { '#': '#a8865a' },
    },
    undefined,
    'pallet',
  );
  ctx.drawImage(pallet.canvas, px, py);
}

interface Drawable {
  y: number;
  draw(ctx: CanvasRenderingContext2D): void;
}

export function drawStore(
  ctx: CanvasRenderingContext2D,
  sim: StoreSim,
  vp: Viewport,
  focus: { x: number; y: number },
  targets: Map<number, InteractTarget | null>,
  /** Jugador dueño de esta mitad: sólo se le muestra a él su cartel de ayuda. */
  focusIndex: number,
): View {
  const world = sim.world;
  const view = computeView(vp, world, focus);
  const offsetX = Math.round(vp.x - view.camX * view.scale);
  const offsetY = Math.round(vp.y - view.camY * view.scale);

  ctx.save();
  ctx.beginPath();
  ctx.rect(vp.x, vp.y, vp.w, vp.h);
  ctx.clip();
  ctx.fillStyle = '#1a1622';
  ctx.fillRect(vp.x, vp.y, vp.w, vp.h);
  ctx.setTransform(view.scale, 0, 0, view.scale, offsetX, offsetY);
  ctx.imageSmoothingEnabled = false;

  ctx.drawImage(staticLayer(world), 0, 0);

  const drawables: Drawable[] = [];

  // Sólo la góndola que el jugador tiene enfrente muestra su cartel: si no,
  // los textos de todas las góndolas se pisan y no se lee ninguno.
  const aimed = new Set<number>();
  for (const target of targets.values()) {
    if (target?.kind === 'shelf' && target.shelf) aimed.add(target.shelf.index);
  }

  for (const shelf of world.shelves) {
    drawables.push({
      y: shelf.y,
      draw: (c) => drawShelf(c, sim, shelf, aimed.has(shelf.index)),
    });
  }

  for (const reg of world.registers) {
    drawables.push({
      y: reg.y,
      draw: (c) => {
        const sprite = bake(STATION_ART.register, world.def.shelfPal, `st|register|${world.def.id}`);
        c.drawImage(sprite.canvas, reg.x - sprite.w / 2, reg.y + TILE / 2 - sprite.h);
      },
    });
  }

  if (world.computer) {
    const pos = world.computer;
    drawables.push({
      y: pos.y,
      draw: (c) => {
        const sprite = bake(STATION_ART.mixer, { 1: '#cfd6dd', 2: '#3f6b9a', W: '#9fe8ff' }, 'st|computer');
        c.drawImage(sprite.canvas, pos.x - sprite.w / 2, pos.y + TILE / 2 - sprite.h);
      },
    });
  }

  if (world.bin) {
    const pos = world.bin;
    drawables.push({
      y: pos.y,
      draw: (c) => {
        const sprite = bake(STATION_ART.bin, { 1: '#8a8f9a', 2: '#5f6570' }, 'st|bin');
        c.drawImage(sprite.canvas, pos.x - sprite.w / 2, pos.y + TILE / 2 - sprite.h);
      },
    });
  }

  // Plantas decorativas en las esquinas libres de la zona de clientes.
  for (const spot of decorSpots(world)) {
    drawables.push({
      y: spot.y,
      draw: (c) => {
        const sprite = bake(PLANT, undefined, 'plant');
        c.drawImage(sprite.canvas, spot.x - sprite.w / 2, spot.y + TILE / 2 - sprite.h);
      },
    });
  }

  for (const box of world.boxes) {
    if (box.carriedBy !== null) continue;
    drawables.push({
      y: box.y,
      draw: (c) => {
        const sprite = bakeBoxWithProduct(box.productId);
        c.drawImage(sprite.canvas, Math.round(box.x - sprite.w / 2), Math.round(box.y - sprite.h + 6));
      },
    });
  }

  for (const customer of sim.customers) {
    drawables.push({ y: customer.pos.y, draw: (c) => drawCustomer(c, customer) });
  }

  for (const player of sim.players) {
    const hint = player.index === focusIndex ? (targets.get(player.index) ?? null) : null;
    drawables.push({ y: player.pos.y, draw: (c) => drawPlayer(c, player, hint) });
  }

  drawables.sort((a, b) => a.y - b.y);
  for (const d of drawables) d.draw(ctx);

  for (const f of sim.floaters) {
    drawText(ctx, f.text, Math.round(f.x), Math.round(f.y), {
      color: f.color,
      align: 'center',
      outline: '#221c2a',
      alpha: clamp(f.life, 0, 1),
    });
  }

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.restore();
  return view;
}

function decorSpots(world: World): { x: number; y: number }[] {
  const key = world.def.id;
  const cached = decorCache.get(key);
  if (cached) return cached;
  const spots: { x: number; y: number }[] = [];
  const bottom = world.rows - 2;
  for (const tx of [1, world.cols - 2]) {
    if (world.walkable(tx, bottom)) {
      spots.push({ x: tx * TILE + TILE / 2, y: bottom * TILE + TILE / 2 });
    }
  }
  decorCache.set(key, spots);
  return spots;
}
const decorCache = new Map<string, { x: number; y: number }[]>();

function drawShelf(
  ctx: CanvasRenderingContext2D,
  sim: StoreSim,
  shelf: { x: number; y: number; productId: string | null; units: number; capacity: number; flash: number },
  aimed: boolean,
): void {
  const def = sim.world.def;
  const art = STATION_ART[def.shelfArt];
  const sprite = bake(art, def.shelfPal, `st|${def.shelfArt}|${def.id}`);
  const x = Math.round(shelf.x - sprite.w / 2);
  const y = Math.round(shelf.y + TILE / 2 - sprite.h);
  ctx.drawImage(sprite.canvas, x, y);

  if (shelf.productId && shelf.units > 0) {
    const icon = itemSprite(shelf.productId);
    const ratio = shelf.units / shelf.capacity;
    // Cuanta más mercadería, más arriba se apila en el mueble.
    const rows = ratio > 0.66 ? 3 : ratio > 0.33 ? 2 : 1;
    for (let i = 0; i < rows; i++) {
      ctx.drawImage(icon.canvas, Math.round(shelf.x - icon.w / 2), y + 4 + i * 7);
    }
    // Número chiquito: entra en el ancho del mueble y no choca con el de al lado.
    const low = shelf.units <= 2;
    drawText(ctx, String(shelf.units), Math.round(shelf.x), y - 9, {
      color: low ? '#ffb86a' : '#fff6e8',
      align: 'center',
      outline: '#221c2a',
    });
  } else if (aimed) {
    drawText(ctx, 'VACÍA', Math.round(shelf.x), y - 9, {
      color: '#ff9a9a',
      align: 'center',
      outline: '#221c2a',
    });
  }

  if (aimed && shelf.productId) {
    drawBubbleText(ctx, `${product(shelf.productId).name.toUpperCase()} ${shelf.units}/${shelf.capacity}`, shelf.x, y - 20);
  }

  if (shelf.flash > 0) {
    ctx.save();
    ctx.globalAlpha = shelf.flash;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x, y, sprite.w, sprite.h);
    ctx.restore();
  }
}

function drawPlayer(ctx: CanvasRenderingContext2D, player: Player, target: InteractTarget | null): void {
  const sprite = characterSprite(player.look, player.facing, player.frame, player.flipped);
  const x = Math.round(player.pos.x - sprite.w / 2);
  const y = Math.round(player.pos.y - sprite.h + 6 + player.bob);
  drawShadow(ctx, player.pos.x, player.pos.y);
  ctx.drawImage(sprite.canvas, x, y);

  if (player.carrying) {
    const sprite2 = bakeBoxWithProduct(player.carrying.productId);
    ctx.drawImage(sprite2.canvas, Math.round(player.pos.x - sprite2.w / 2), y - 10);
  }

  if (player.busy) {
    drawProgressBar(ctx, player.pos.x, y - 6, player.busy.progress / player.busy.duration, '#9af2a0');
  }

  if (player.toast) {
    drawBubbleText(ctx, player.toast, player.pos.x, y - 14);
  } else if (target) {
    drawBubbleText(ctx, target.hint, target.x, Math.round(target.y - 22), '#ffe9a8');
  }
}

function drawCustomer(ctx: CanvasRenderingContext2D, customer: Customer): void {
  const sprite = characterSprite(customer.look, customer.facing, customer.frame, customer.flipped);
  const x = Math.round(customer.pos.x - sprite.w / 2);
  const y = Math.round(customer.pos.y - sprite.h + 6 + customer.bob);
  drawShadow(ctx, customer.pos.x, customer.pos.y);
  ctx.drawImage(sprite.canvas, x, y);

  if (customer.cart.length > 0) {
    const icon = itemSprite(customer.cart[customer.cart.length - 1].productId);
    ctx.drawImage(icon.canvas, x + sprite.w - 4, y + 10);
  }

  // Globo con lo que está buscando.
  const want = customer.wants[0];
  if (want && customer.state !== 'pagando' && customer.state !== 'saliendo') {
    const icon = itemSprite(want);
    const bx = Math.round(customer.pos.x - 8);
    const by = y - 18;
    ctx.fillStyle = '#fdf6ea';
    ctx.fillRect(bx, by, 16, 16);
    ctx.fillStyle = '#221c2a';
    ctx.fillRect(bx, by - 1, 16, 1);
    ctx.fillRect(bx, by + 16, 16, 1);
    ctx.fillRect(bx - 1, by, 1, 16);
    ctx.fillRect(bx + 16, by, 1, 16);
    ctx.drawImage(icon.canvas, bx + 2, by + 2);
  }

  if (customer.state === 'pagando') {
    drawBubbleText(ctx, `$${customer.total}`, customer.pos.x, y - 16, '#9af2a0');
  }

  const barColor = customer.mood === 'feliz' ? '#9af2a0' : customer.mood === 'normal' ? '#ffd36a' : '#ff6a6a';
  drawProgressBar(ctx, customer.pos.x, y - 4, customer.patience, barColor);
}

function drawShadow(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  ctx.save();
  ctx.globalAlpha = 0.18;
  ctx.fillStyle = '#000000';
  ctx.fillRect(Math.round(x - 5), Math.round(y + 2), 10, 3);
  ctx.restore();
}

function drawProgressBar(ctx: CanvasRenderingContext2D, cx: number, y: number, ratio: number, color: string): void {
  const w = 14;
  const x = Math.round(cx - w / 2);
  ctx.fillStyle = '#221c2a';
  ctx.fillRect(x - 1, y - 1, w + 2, 4);
  ctx.fillStyle = '#4a4453';
  ctx.fillRect(x, y, w, 2);
  ctx.fillStyle = color;
  ctx.fillRect(x, y, Math.max(0, Math.round(w * clamp(ratio, 0, 1))), 2);
}

function drawBubbleText(ctx: CanvasRenderingContext2D, text: string, cx: number, y: number, color = '#fdf6ea'): void {
  const w = textWidth(text) + 4;
  const x = Math.round(cx - w / 2);
  ctx.fillStyle = 'rgba(26, 22, 34, 0.82)';
  ctx.fillRect(x, y - 2, w, 11);
  drawText(ctx, text, Math.round(cx), y, { color, align: 'center' });
}

export function recolorPalette(base: Palette, overrides: Palette): Palette {
  return { ...base, ...overrides };
}
