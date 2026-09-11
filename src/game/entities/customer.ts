/**
 * Cliente: entra, busca lo que quiere en las góndolas, hace la fila y paga.
 *
 * Si algo no está o está carísimo se enoja un poco. La paciencia que le quede
 * al cobrarle define la propina y la reputación del local.
 */

import type { CharacterLook, Facing } from '../../art/chars';
import { randomLook } from '../../art/chars';
import type { Rng } from '../../engine/math';
import type { RegisterPoint, Shelf, Vec, World } from '../world';
import { demandFor, product } from '../data/products';

export type CustomerState =
  | 'entrando'
  | 'buscando'
  | 'tomando'
  | 'a-la-caja'
  | 'en-fila'
  | 'pagando'
  | 'saliendo';

export interface CartLine {
  productId: string;
  price: number;
}

const RADIUS = 5;
const SPEED = 46;

export class Customer {
  readonly id: number;
  readonly look: CharacterLook;
  pos: Vec;
  facing: Facing = 'up';
  flipped = false;
  walkPhase = 0;
  moving = false;

  state: CustomerState = 'entrando';
  /** Lista de compras pendiente. */
  wants: string[];
  cart: CartLine[] = [];
  /** Paciencia de 1 a 0. Llega a 0 y se va enojado. */
  patience = 1;
  patienceDrain = 0.02;
  mood: 'feliz' | 'normal' | 'enojado' = 'normal';
  /** Cuánto se quejó: sube si faltó stock o los precios eran abusivos. */
  complaints = 0;

  target: Vec | null = null;
  targetShelf: Shelf | null = null;
  register: RegisterPoint | null = null;
  queueSlot = -1;
  actionTimer = 0;
  /** Producto que levanta en este momento (para dibujarlo en la mano). */
  holding: string | null = null;
  leaving = false;
  /** Se marca cuando ya sumó su resultado a las estadísticas del día. */
  settled = false;

  constructor(id: number, rng: Rng, spawn: Vec, wants: string[]) {
    this.id = id;
    this.look = randomLook(() => rng.next());
    this.pos = { x: spawn.x, y: spawn.y };
    this.wants = wants;
  }

  get frame(): number {
    if (!this.moving) return 0;
    return Math.floor(this.walkPhase / 7) % 4;
  }

  get bob(): number {
    if (!this.moving) return 0;
    return this.frame === 1 || this.frame === 3 ? -1 : 0;
  }

  get total(): number {
    return this.cart.reduce((sum, line) => sum + line.price, 0);
  }

  private moveTowards(world: World, target: Vec, dt: number): boolean {
    const dir = world.steer(this.pos, target);
    const dx = target.x - this.pos.x;
    const dy = target.y - this.pos.y;
    if (Math.hypot(dx, dy) < 3) {
      this.moving = false;
      return true;
    }
    const step = SPEED * dt;
    world.moveBody(this.pos, dir.x * step, dir.y * step, RADIUS);
    this.walkPhase += step;
    this.moving = true;
    if (Math.abs(dir.x) > Math.abs(dir.y)) {
      this.facing = 'side';
      this.flipped = dir.x < 0;
    } else {
      this.facing = dir.y < 0 ? 'up' : 'down';
    }
    return false;
  }

  update(dt: number, world: World, ctx: CustomerContext): void {
    if (this.state !== 'saliendo' && this.state !== 'pagando') {
      this.patience = Math.max(0, this.patience - this.patienceDrain * dt);
      if (this.patience <= 0) {
        this.giveUp(ctx);
        return;
      }
    }
    this.mood = this.patience > 0.6 ? 'feliz' : this.patience > 0.3 ? 'normal' : 'enojado';

    switch (this.state) {
      case 'entrando':
        this.pickNextGoal(world, ctx);
        break;

      case 'buscando': {
        if (!this.targetShelf || this.targetShelf.units <= 0) {
          this.pickNextGoal(world, ctx);
          break;
        }
        if (this.moveTowards(world, this.targetShelf.access, dt)) {
          this.state = 'tomando';
          this.actionTimer = 0.55;
          this.facing = 'up';
        }
        break;
      }

      case 'tomando': {
        this.moving = false;
        this.actionTimer -= dt;
        if (this.actionTimer <= 0) {
          const shelf = this.targetShelf;
          if (shelf && shelf.units > 0 && shelf.productId) {
            const price = ctx.priceOf(shelf.productId);
            shelf.units--;
            shelf.flash = 0.35;
            this.cart.push({ productId: shelf.productId, price });
            this.holding = shelf.productId;
            ctx.onTake(this, shelf.productId);
            this.wants = this.wants.filter((w) => w !== shelf.productId);
          }
          this.targetShelf = null;
          this.pickNextGoal(world, ctx);
        }
        break;
      }

      case 'a-la-caja': {
        const slot = this.queueTarget();
        if (!slot) {
          this.pickNextGoal(world, ctx);
          break;
        }
        if (this.moveTowards(world, slot, dt)) {
          this.state = 'en-fila';
          this.facing = 'up';
        }
        break;
      }

      case 'en-fila': {
        const slot = this.queueTarget();
        if (slot && Math.hypot(slot.x - this.pos.x, slot.y - this.pos.y) > 4) {
          // La fila avanzó: da un paso adelante.
          this.moveTowards(world, slot, dt);
        } else {
          this.moving = false;
          this.facing = 'up';
        }
        break;
      }

      case 'pagando':
        this.moving = false;
        this.facing = 'up';
        break;

      case 'saliendo': {
        const exit = ctx.exitPoint();
        if (this.moveTowards(world, exit, dt)) {
          this.leaving = true;
        }
        break;
      }
    }
  }

  private queueTarget(): Vec | null {
    if (!this.register || this.queueSlot < 0) return null;
    return this.register.queue[Math.min(this.queueSlot, this.register.queue.length - 1)] ?? null;
  }

  /** Decide el próximo objetivo: otra góndola, la caja, o irse. */
  private pickNextGoal(world: World, ctx: CustomerContext): void {
    this.holding = null;

    for (const want of [...this.wants]) {
      const price = ctx.priceOf(want);
      const willing = demandFor(want, price);
      if (willing <= 0.05) {
        // Le parece un afano: lo tacha de la lista y se queja.
        this.wants = this.wants.filter((w) => w !== want);
        this.complaints++;
        this.patience = Math.max(0, this.patience - 0.12);
        ctx.onRefusePrice(this, want);
        continue;
      }
      const options = world.shelvesWith(want).filter((s) => world.reachable(this.pos, s.access));
      if (options.length === 0) {
        this.wants = this.wants.filter((w) => w !== want);
        this.complaints++;
        this.patience = Math.max(0, this.patience - 0.1);
        ctx.onMissingStock(this, want);
        continue;
      }
      if (ctx.rng.next() > willing) {
        // Duda por el precio y compra menos cantidad de la que pensaba.
        this.wants = this.wants.filter((w) => w !== want);
        continue;
      }
      options.sort(
        (a, b) =>
          Math.hypot(a.access.x - this.pos.x, a.access.y - this.pos.y) -
          Math.hypot(b.access.x - this.pos.x, b.access.y - this.pos.y),
      );
      this.targetShelf = options[0];
      this.state = 'buscando';
      return;
    }

    if (this.cart.length > 0) {
      const register = ctx.joinQueue(this);
      if (register) {
        this.register = register;
        this.state = 'a-la-caja';
        this.patienceDrain = 0.028;
        return;
      }
    }
    this.state = 'saliendo';
  }

  private giveUp(ctx: CustomerContext): void {
    if (this.state === 'saliendo') return;
    this.complaints += 2;
    this.mood = 'enojado';
    ctx.onGiveUp(this);
    // Devuelve a la góndola lo que tenía en el carrito.
    this.cart = [];
    this.state = 'saliendo';
  }

  sendHome(): void {
    this.state = 'saliendo';
  }
}

/** Lo que el cliente necesita saber del local para decidir. */
export interface CustomerContext {
  rng: Rng;
  priceOf(productId: string): number;
  joinQueue(customer: Customer): RegisterPoint | null;
  exitPoint(): Vec;
  onTake(customer: Customer, productId: string): void;
  onMissingStock(customer: Customer, productId: string): void;
  onRefusePrice(customer: Customer, productId: string): void;
  onGiveUp(customer: Customer): void;
}

/** Arma una lista de compras con los productos que hoy ofrece el local. */
export function buildShoppingList(rng: Rng, catalogue: readonly string[], maxItems: number): string[] {
  if (catalogue.length === 0) return [];
  const count = Math.min(catalogue.length, rng.int(1, maxItems));
  const pool = [...catalogue];
  const list: string[] = [];
  for (let i = 0; i < count && pool.length > 0; i++) {
    const idx = rng.int(0, pool.length - 1);
    list.push(pool[idx]);
    pool.splice(idx, 1);
  }
  // Los productos baratos se llevan de a más de uno.
  const extra: string[] = [];
  for (const id of list) {
    if (product(id).market < 70 && rng.chance(0.35)) extra.push(id);
  }
  return [...list, ...extra];
}
