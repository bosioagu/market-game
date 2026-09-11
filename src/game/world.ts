/**
 * El local: grilla de tiles, colisiones, góndolas, cajas y navegación.
 *
 * La navegación de los clientes usa un campo de distancias (BFS) por destino.
 * Con locales de 24x16 tiles calcularlo es instantáneo y se cachea, así que
 * podemos tener muchos clientes caminando sin que baje el framerate.
 */

import { TILE } from '../art/tiles';
import type { StoreDef } from './data/stores';
import { product } from './data/products';

export const enum Tile {
  Floor = 0,
  Wall = 1,
  Window = 2,
  Shelf = 3,
  Counter = 4,
  Register = 5,
  Computer = 6,
  Bin = 7,
  Storage = 8,
  Entrance = 9,
}

const CHAR_TO_TILE: Record<string, Tile> = {
  '#': Tile.Wall,
  W: Tile.Window,
  '.': Tile.Floor,
  S: Tile.Shelf,
  '=': Tile.Counter,
  R: Tile.Register,
  C: Tile.Computer,
  B: Tile.Bin,
  D: Tile.Storage,
  E: Tile.Entrance,
};

/** Tiles que bloquean el paso. */
export function isSolidTile(t: Tile): boolean {
  return (
    t === Tile.Wall ||
    t === Tile.Window ||
    t === Tile.Shelf ||
    t === Tile.Counter ||
    t === Tile.Register ||
    t === Tile.Computer ||
    t === Tile.Bin
  );
}

export interface Vec {
  x: number;
  y: number;
}

export interface Shelf {
  index: number;
  tx: number;
  ty: number;
  /** Centro del mueble, en píxeles. */
  x: number;
  y: number;
  productId: string | null;
  units: number;
  capacity: number;
  /** Tile desde el que se atiende (el de abajo, o el primero libre). */
  access: Vec;
  /** Se ilumina un instante cuando alguien saca un producto. */
  flash: number;
}

export interface Box {
  id: number;
  productId: string;
  units: number;
  x: number;
  y: number;
  /** Índice del jugador que la lleva, o null si está en el piso. */
  carriedBy: number | null;
}

export interface RegisterPoint {
  index: number;
  tx: number;
  ty: number;
  x: number;
  y: number;
  /** Dónde se para quien cobra (del lado de adentro). */
  staff: Vec;
  /** Lugares de la fila, en orden. */
  queue: Vec[];
}

export class World {
  readonly def: StoreDef;
  readonly cols: number;
  readonly rows: number;
  readonly widthPx: number;
  readonly heightPx: number;
  readonly tiles: Uint8Array;

  shelves: Shelf[] = [];
  registers: RegisterPoint[] = [];
  boxes: Box[] = [];
  computer: Vec | null = null;
  computerAccess: Vec | null = null;
  bin: Vec | null = null;
  binAccess: Vec | null = null;
  storage: Vec[] = [];
  entrance: Vec[] = [];
  playerSpawns: Vec[] = [];

  private nextBoxId = 1;
  private fields = new Map<string, Int16Array>();

  constructor(def: StoreDef) {
    this.def = def;
    this.rows = def.layout.length;
    this.cols = def.layout[0].length;
    this.widthPx = this.cols * TILE;
    this.heightPx = this.rows * TILE;
    this.tiles = new Uint8Array(this.cols * this.rows);

    for (let ty = 0; ty < this.rows; ty++) {
      const row = def.layout[ty];
      for (let tx = 0; tx < this.cols; tx++) {
        const t = CHAR_TO_TILE[row[tx]] ?? Tile.Floor;
        this.tiles[ty * this.cols + tx] = t;
        this.registerSpecial(t, tx, ty);
      }
    }

    this.registers.sort((a, b) => a.x - b.x);
    this.registers.forEach((r, i) => (r.index = i));
    this.shelves.forEach((s, i) => (s.index = i));
    this.buildQueues();
    this.buildPlayerSpawns();
  }

  private registerSpecial(t: Tile, tx: number, ty: number): void {
    const cx = tx * TILE + TILE / 2;
    const cy = ty * TILE + TILE / 2;
    switch (t) {
      case Tile.Shelf:
        this.shelves.push({
          index: 0,
          tx,
          ty,
          x: cx,
          y: cy,
          productId: null,
          units: 0,
          capacity: 12,
          access: { x: cx, y: cy + TILE },
          flash: 0,
        });
        break;
      case Tile.Register:
        // La fila se arma después, cuando ya está cargado todo el plano.
        this.registers.push({
          index: 0,
          tx,
          ty,
          x: cx,
          y: cy,
          staff: { x: cx, y: cy - TILE },
          queue: [],
        });
        break;
      case Tile.Computer:
        this.computer = { x: cx, y: cy };
        this.computerAccess = { x: cx + TILE, y: cy };
        break;
      case Tile.Bin:
        this.bin = { x: cx, y: cy };
        this.binAccess = { x: cx + TILE, y: cy };
        break;
      case Tile.Storage:
        this.storage.push({ x: cx, y: cy });
        break;
      case Tile.Entrance:
        this.entrance.push({ x: cx, y: cy });
        break;
      default:
        break;
    }
  }

  /**
   * Arma la fila de cada caja "serpenteando" por los tiles libres.
   * Antes la fila bajaba en línea recta y podía terminar contra una pared,
   * dejando clientes esperando en un lugar al que no podían llegar.
   */
  private buildQueues(): void {
    const used = new Set<string>();
    for (const reg of this.registers) {
      used.add(`${reg.tx},${reg.ty - 1}`); // donde se para quien cobra
      used.add(`${reg.tx},${reg.ty}`);
    }
    // Abajo primero (el cliente encara el mostrador), después hacia los costados.
    const dirs: readonly (readonly [number, number])[] = [
      [0, 1],
      [-1, 0],
      [1, 0],
      [0, -1],
    ];
    for (const reg of this.registers) {
      const queue: Vec[] = [];
      let cx = reg.tx;
      let cy = reg.ty;
      for (let i = 0; i < 6; i++) {
        let next: { x: number; y: number } | null = null;
        for (const [ox, oy] of dirs) {
          const nx = cx + ox;
          const ny = cy + oy;
          const key = `${nx},${ny}`;
          if (used.has(key) || !this.walkable(nx, ny)) continue;
          next = { x: nx, y: ny };
          break;
        }
        if (!next) break;
        used.add(`${next.x},${next.y}`);
        queue.push(tileCenter(next.x, next.y));
        cx = next.x;
        cy = next.y;
      }
      reg.queue = queue;
    }
  }

  private buildPlayerSpawns(): void {
    // Los jugadores arrancan junto a las cajas, mirando la tienda.
    for (const r of this.registers) {
      this.playerSpawns.push({ x: r.staff.x, y: r.staff.y });
    }
    while (this.playerSpawns.length < 2) {
      const first = this.playerSpawns[0];
      this.playerSpawns.push(first ? { x: first.x + TILE, y: first.y } : { x: TILE * 2, y: TILE * 2 });
    }
  }

  tileAt(tx: number, ty: number): Tile {
    if (tx < 0 || ty < 0 || tx >= this.cols || ty >= this.rows) return Tile.Wall;
    return this.tiles[ty * this.cols + tx] as Tile;
  }

  tileAtPx(x: number, y: number): Tile {
    return this.tileAt(Math.floor(x / TILE), Math.floor(y / TILE));
  }

  solidAt(tx: number, ty: number): boolean {
    return isSolidTile(this.tileAt(tx, ty));
  }

  walkable(tx: number, ty: number): boolean {
    return !this.solidAt(tx, ty);
  }

  /**
   * Mueve un cuerpo circular resolviendo cada eje por separado.
   * Es lo más simple que evita quedarse trabado en las esquinas.
   */
  moveBody(pos: Vec, dx: number, dy: number, radius: number): void {
    if (dx !== 0) {
      const nx = pos.x + dx;
      if (!this.circleHits(nx, pos.y, radius)) pos.x = nx;
      else pos.x = this.slideAxis(pos.x, nx, pos.y, radius, true);
    }
    if (dy !== 0) {
      const ny = pos.y + dy;
      if (!this.circleHits(pos.x, ny, radius)) pos.y = ny;
      else pos.y = this.slideAxis(pos.y, ny, pos.x, radius, false);
    }
  }

  private slideAxis(from: number, to: number, other: number, radius: number, horizontal: boolean): number {
    // Se acerca lo máximo posible a la pared sin atravesarla.
    const dir = Math.sign(to - from);
    let best = from;
    for (let step = 1; step <= Math.abs(to - from); step++) {
      const candidate = from + dir * step;
      const hit = horizontal
        ? this.circleHits(candidate, other, radius)
        : this.circleHits(other, candidate, radius);
      if (hit) break;
      best = candidate;
    }
    return best;
  }

  private circleHits(x: number, y: number, radius: number): boolean {
    const minTx = Math.floor((x - radius) / TILE);
    const maxTx = Math.floor((x + radius) / TILE);
    const minTy = Math.floor((y - radius) / TILE);
    const maxTy = Math.floor((y + radius) / TILE);
    for (let ty = minTy; ty <= maxTy; ty++) {
      for (let tx = minTx; tx <= maxTx; tx++) {
        if (this.solidAt(tx, ty)) return true;
      }
    }
    return false;
  }

  // --- Navegación ---

  /** Campo de distancias hasta un tile; se cachea porque los destinos se repiten. */
  flowField(tx: number, ty: number): Int16Array {
    const key = `${tx},${ty}`;
    const cached = this.fields.get(key);
    if (cached) return cached;

    const field = new Int16Array(this.cols * this.rows).fill(-1);
    if (this.walkable(tx, ty)) {
      const queue = new Int32Array(this.cols * this.rows);
      let head = 0;
      let tail = 0;
      const start = ty * this.cols + tx;
      field[start] = 0;
      queue[tail++] = start;
      while (head < tail) {
        const cur = queue[head++];
        const cx = cur % this.cols;
        const cy = (cur - cx) / this.cols;
        const next = field[cur] + 1;
        for (const [ox, oy] of NEIGHBOURS) {
          const nx = cx + ox;
          const ny = cy + oy;
          if (nx < 0 || ny < 0 || nx >= this.cols || ny >= this.rows) continue;
          const idx = ny * this.cols + nx;
          if (field[idx] !== -1 || !this.walkable(nx, ny)) continue;
          field[idx] = next;
          queue[tail++] = idx;
        }
      }
    }
    this.fields.set(key, field);
    return field;
  }

  /** Dirección normalizada hacia el destino, siguiendo el campo de distancias. */
  steer(from: Vec, target: Vec): Vec {
    const ttx = Math.floor(target.x / TILE);
    const tty = Math.floor(target.y / TILE);
    const field = this.flowField(ttx, tty);
    const cx = Math.floor(from.x / TILE);
    const cy = Math.floor(from.y / TILE);
    const here = field[cy * this.cols + cx] ?? -1;

    if (here <= 0) {
      // Ya estamos en el tile destino (o fuera del mapa): vamos derecho al punto.
      return normalize(target.x - from.x, target.y - from.y);
    }

    let bestCost = here;
    let bestTx = cx;
    let bestTy = cy;
    for (const [ox, oy] of NEIGHBOURS) {
      const nx = cx + ox;
      const ny = cy + oy;
      if (nx < 0 || ny < 0 || nx >= this.cols || ny >= this.rows) continue;
      const cost = field[ny * this.cols + nx];
      if (cost === -1) continue;
      if (cost < bestCost) {
        bestCost = cost;
        bestTx = nx;
        bestTy = ny;
      }
    }
    if (bestTx === cx && bestTy === cy) {
      return normalize(target.x - from.x, target.y - from.y);
    }
    const goalX = bestTx * TILE + TILE / 2;
    const goalY = bestTy * TILE + TILE / 2;
    return normalize(goalX - from.x, goalY - from.y);
  }

  /** ¿Existe un camino caminable entre dos puntos? */
  reachable(from: Vec, to: Vec): boolean {
    const field = this.flowField(Math.floor(to.x / TILE), Math.floor(to.y / TILE));
    const idx = Math.floor(from.y / TILE) * this.cols + Math.floor(from.x / TILE);
    return field[idx] !== undefined && field[idx] !== -1;
  }

  // --- Stock ---

  addBox(productId: string, at?: Vec): Box {
    const spot = at ?? this.freeStorageSpot();
    const box: Box = {
      id: this.nextBoxId++,
      productId,
      units: product(productId).perBox,
      x: spot.x,
      y: spot.y,
      carriedBy: null,
    };
    this.boxes.push(box);
    return box;
  }

  removeBox(box: Box): void {
    const i = this.boxes.indexOf(box);
    if (i >= 0) this.boxes.splice(i, 1);
  }

  /** Busca un lugar libre en el depósito; si está lleno, apila con un pequeño offset. */
  private freeStorageSpot(): Vec {
    if (this.storage.length === 0) return { x: TILE * 2, y: TILE * 2 };
    for (const spot of this.storage) {
      const taken = this.boxes.some(
        (b) => b.carriedBy === null && Math.abs(b.x - spot.x) < 6 && Math.abs(b.y - spot.y) < 6,
      );
      if (!taken) return { x: spot.x, y: spot.y };
    }
    const spot = this.storage[this.boxes.length % this.storage.length];
    const jitter = ((this.boxes.length * 5) % 9) - 4;
    return { x: spot.x + jitter, y: spot.y + jitter };
  }

  /** Góndolas que tienen un producto disponible. */
  shelvesWith(productId: string): Shelf[] {
    return this.shelves.filter((s) => s.productId === productId && s.units > 0);
  }

  /** Productos que hoy se pueden comprar en el local. */
  availableProducts(): string[] {
    const set = new Set<string>();
    for (const s of this.shelves) {
      if (s.productId && s.units > 0) set.add(s.productId);
    }
    return [...set];
  }

  totalUnits(): number {
    let n = 0;
    for (const s of this.shelves) n += s.units;
    for (const b of this.boxes) n += b.units;
    return n;
  }

  update(dt: number): void {
    for (const s of this.shelves) {
      if (s.flash > 0) s.flash = Math.max(0, s.flash - dt);
    }
  }
}

const NEIGHBOURS: readonly (readonly [number, number])[] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

function normalize(x: number, y: number): Vec {
  const len = Math.hypot(x, y);
  if (len < 0.0001) return { x: 0, y: 0 };
  return { x: x / len, y: y / len };
}

export function tileCenter(tx: number, ty: number): Vec {
  return { x: tx * TILE + TILE / 2, y: ty * TILE + TILE / 2 };
}
