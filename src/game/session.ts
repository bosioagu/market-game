/**
 * Simulación de un local durante un día: clientes, caja, reposición y plata.
 *
 * Una partida tiene uno o dos `StoreSim`: uno solo en individual y cooperativo,
 * y dos (uno por jugador) en modo competencia.
 */

import { Rng, clamp } from '../engine/math';
import { audio } from '../engine/audio';
import type { PadState } from '../engine/input';
import { LOOK_KIKI, LOOK_MIA } from '../art/chars';
import { TILE } from '../art/tiles';
import { Box, RegisterPoint, Shelf, Vec, World } from './world';
import { Player } from './entities/player';
import { buildShoppingList, Customer, type CustomerContext } from './entities/customer';
import { boxCost, demandFor, product, type ProductDef } from './data/products';
import type { StoreDef } from './data/stores';
import { perksFor, type Perks, type Progress } from './progress';

export type GameMode = 'solo' | 'coop' | 'versus';

export const DAY_SECONDS = 165;
const OPEN_HOUR = 8;
const CLOSE_HOUR = 20;
const MAX_CUSTOMERS = 12;
const RESTOCK_PER_UNIT = 0.16;

export interface DayStats {
  revenue: number;
  tips: number;
  spent: number;
  unitsSold: number;
  served: number;
  lost: number;
  complaints: number;
  missingStock: number;
  tooExpensive: number;
}

function emptyStats(): DayStats {
  return {
    revenue: 0,
    tips: 0,
    spent: 0,
    unitsSold: 0,
    served: 0,
    lost: 0,
    complaints: 0,
    missingStock: 0,
    tooExpensive: 0,
  };
}

export type TargetKind = 'box' | 'shelf' | 'register' | 'computer' | 'bin';

export interface InteractTarget {
  kind: TargetKind;
  label: string;
  hint: string;
  x: number;
  y: number;
  box?: Box;
  shelf?: Shelf;
  register?: RegisterPoint;
}

export interface FloatingText {
  text: string;
  x: number;
  y: number;
  life: number;
  color: string;
}

export class StoreSim {
  readonly def: StoreDef;
  readonly world: World;
  readonly players: Player[] = [];
  readonly rng: Rng;
  readonly prices: Record<string, number>;
  readonly perks: Perks;

  customers: Customer[] = [];
  money: number;
  reputation = 0.7;
  stats: DayStats = emptyStats();
  floaters: FloatingText[] = [];

  /** Fila y estado de cobro de cada caja. */
  lines: Customer[][] = [];
  scanned: number[] = [];
  /** Índice del jugador que está usando la computadora, o null. */
  computerUser: number | null = null;

  private spawnAccumulator = 0;
  private nextCustomerId = 1;
  private scanHold = 0;

  constructor(def: StoreDef, progress: Progress, playerIndices: number[], seed: number) {
    this.def = def;
    this.world = new World(def);
    this.rng = new Rng(seed);
    this.prices = { ...(progress.prices[def.id] ?? {}) };
    this.perks = perksFor(progress);
    this.money = progress.money;

    for (const shelf of this.world.shelves) shelf.capacity = this.perks.shelfCapacity;
    this.lines = this.world.registers.map(() => []);
    this.scanned = this.world.registers.map(() => 0);

    const looks = [LOOK_MIA, LOOK_KIKI];
    const names = ['MÍA', 'KIKI'];
    playerIndices.forEach((padIndex, i) => {
      const spawn = this.world.playerSpawns[i] ?? this.world.playerSpawns[0];
      const player = new Player(padIndex, names[padIndex] ?? `P${padIndex + 1}`, looks[padIndex] ?? LOOK_MIA, spawn);
      player.speedBonus = this.perks.moveSpeedBonus;
      this.players.push(player);
    });
  }

  priceOf(id: string): number {
    return this.prices[id] ?? product(id).market;
  }

  setPrice(id: string, value: number): void {
    this.prices[id] = clamp(Math.round(value), 1, 99999);
  }

  get catalogue(): readonly string[] {
    return this.def.products;
  }

  // --- Compras al mayorista ---

  canBuy(productId: string, boxes = 1): boolean {
    return this.money >= boxCost(productId) * boxes;
  }

  buyBoxes(productId: string, boxes = 1): boolean {
    const total = boxCost(productId) * boxes;
    if (this.money < total) return false;
    this.money -= total;
    this.stats.spent += total;
    for (let i = 0; i < boxes; i++) this.world.addBox(productId);
    audio.sfx('coin');
    return true;
  }

  // --- Bucle principal ---

  update(dt: number, pads: (PadState | null)[], uiOpen: boolean): void {
    this.world.update(dt);
    this.updateFloaters(dt);

    for (const player of this.players) {
      const pad = pads[player.index];
      const busyInUi = this.computerUser === player.index && uiOpen;
      player.update(dt, this.world, pad?.ax ?? 0, pad?.ay ?? 0, !busyInUi);
      if (pad && !busyInUi) this.handleInput(player, pad, dt);
      if (busyInUi) player.cancelBusy();
    }

    this.updateCustomers(dt);
    this.updateRegisters(dt);
  }

  /** Se llama sólo mientras el local está abierto. */
  spawnTick(dt: number): void {
    const variety = this.varietyFactor();
    const rate =
      this.def.baseTraffic *
      this.perks.trafficMultiplier *
      (0.45 + this.reputation * 0.75) *
      variety;
    if (rate <= 0) return;
    this.spawnAccumulator += (rate / 60) * dt;
    while (this.spawnAccumulator >= 1) {
      this.spawnAccumulator -= 1;
      this.spawnCustomer();
    }
  }

  /** Con poca variedad en góndola viene menos gente: no hay nada que comprar. */
  private varietyFactor(): number {
    const available = this.world.availableProducts().length;
    if (available === 0) return 0;
    return clamp(0.3 + (available / this.def.products.length) * 0.9, 0.3, 1.2);
  }

  private spawnCustomer(): void {
    if (this.customers.length >= MAX_CUSTOMERS) return;
    const door = this.world.entrance[this.rng.int(0, Math.max(0, this.world.entrance.length - 1))];
    if (!door) return;
    const available = this.world.availableProducts();
    const wants = buildShoppingList(this.rng, available.length > 0 ? available : this.def.products, 3);
    if (wants.length === 0) return;
    const customer = new Customer(this.nextCustomerId++, this.rng, { x: door.x, y: door.y - 2 }, wants);
    customer.patienceDrain = 0.016 + this.rng.next() * 0.008;
    this.customers.push(customer);
    audio.sfx('customer');
  }

  private customerContext(): CustomerContext {
    return {
      rng: this.rng,
      priceOf: (id) => this.priceOf(id),
      joinQueue: (c) => this.joinQueue(c),
      exitPoint: () => {
        const door = this.world.entrance[0];
        return door ? { x: door.x, y: door.y + TILE } : { x: 0, y: this.world.heightPx };
      },
      onTake: (c, id) => {
        this.float(`+1 ${product(id).name}`, c.pos.x, c.pos.y - 22, '#ffe9a8');
      },
      onMissingStock: (c, id) => {
        this.stats.missingStock++;
        this.float(`¡Falta ${product(id).name}!`, c.pos.x, c.pos.y - 22, '#ff9a9a');
      },
      onRefusePrice: (c, id) => {
        this.stats.tooExpensive++;
        this.float(`¡${product(id).name} carísimo!`, c.pos.x, c.pos.y - 22, '#ff9a9a');
      },
      onGiveUp: (c) => {
        this.stats.lost++;
        this.stats.complaints += c.complaints;
        this.reputation = clamp(this.reputation - 0.035, 0.05, 1);
        this.leaveQueue(c);
        audio.sfx('angry');
        this.float('¡Me voy!', c.pos.x, c.pos.y - 22, '#ff6a6a');
      },
    };
  }

  private updateCustomers(dt: number): void {
    const ctx = this.customerContext();
    for (const c of this.customers) c.update(dt, this.world, ctx);
    this.separateCustomers();
    const gone = this.customers.filter((c) => c.leaving);
    if (gone.length > 0) {
      for (const c of gone) this.leaveQueue(c);
      this.customers = this.customers.filter((c) => !c.leaving);
    }
  }

  /**
   * Empuja suavemente a los clientes que se superponen.
   * Sin esto la fila de la caja se ve como un montón de gente encimada.
   * El que está pagando no se mueve, para no sacarlo del mostrador.
   */
  private separateCustomers(): void {
    const minDist = 10;
    for (let i = 0; i < this.customers.length; i++) {
      const a = this.customers[i];
      for (let j = i + 1; j < this.customers.length; j++) {
        const b = this.customers[j];
        let dx = b.pos.x - a.pos.x;
        let dy = b.pos.y - a.pos.y;
        let d = Math.hypot(dx, dy);
        if (d >= minDist) continue;
        if (d < 0.01) {
          dx = this.rng.range(-1, 1);
          dy = this.rng.range(-1, 1);
          d = Math.hypot(dx, dy) || 1;
        }
        const push = (minDist - d) / 2;
        const nx = (dx / d) * push;
        const ny = (dy / d) * push;
        if (a.state !== 'pagando') this.world.moveBody(a.pos, -nx, -ny, 5);
        if (b.state !== 'pagando') this.world.moveBody(b.pos, nx, ny, 5);
      }
    }
  }

  private joinQueue(customer: Customer): RegisterPoint | null {
    const registers = this.world.registers;
    if (registers.length === 0) return null;
    let bestIndex = 0;
    for (let i = 1; i < registers.length; i++) {
      if (this.lines[i].length < this.lines[bestIndex].length) bestIndex = i;
    }
    if (this.lines[bestIndex].length >= registers[bestIndex].queue.length) return null;
    customer.queueSlot = this.lines[bestIndex].length;
    this.lines[bestIndex].push(customer);
    return registers[bestIndex];
  }

  private leaveQueue(customer: Customer): void {
    for (let i = 0; i < this.lines.length; i++) {
      const idx = this.lines[i].indexOf(customer);
      if (idx === -1) continue;
      this.lines[i].splice(idx, 1);
      if (idx === 0) this.scanned[i] = 0;
      this.lines[i].forEach((c, slot) => (c.queueSlot = slot));
    }
    customer.register = null;
    customer.queueSlot = -1;
  }

  private updateRegisters(dt: number): void {
    this.scanHold = Math.max(0, this.scanHold - dt);
    for (let i = 0; i < this.lines.length; i++) {
      const front = this.lines[i][0];
      if (!front) {
        this.scanned[i] = 0;
        continue;
      }
      if (front.state === 'en-fila') {
        const slot = this.world.registers[i].queue[0];
        if (Math.hypot(front.pos.x - slot.x, front.pos.y - slot.y) < 5) {
          front.state = 'pagando';
        }
      }
    }
  }

  /** Cliente listo para que le cobren en esa caja. */
  customerAtRegister(index: number): Customer | null {
    const front = this.lines[index]?.[0];
    return front && front.state === 'pagando' ? front : null;
  }

  scannedAt(index: number): number {
    return this.scanned[index] ?? 0;
  }

  // --- Interacción del jugador ---

  findTarget(player: Player): InteractTarget | null {
    const candidates: { target: InteractTarget; score: number }[] = [];
    const push = (t: InteractTarget, dist: number) => {
      const dx = t.x - player.pos.x;
      const dy = t.y - player.pos.y;
      const facingBonus = this.facingAlignment(player, dx, dy) * 8;
      candidates.push({ target: t, score: dist - facingBonus });
    };

    if (!player.carrying) {
      for (const box of this.world.boxes) {
        if (box.carriedBy !== null) continue;
        const d = Math.hypot(box.x - player.pos.x, box.y - player.pos.y);
        if (d < 20) {
          push(
            {
              kind: 'box',
              label: product(box.productId).name,
              hint: `Levantar (${box.units})`,
              x: box.x,
              y: box.y,
              box,
            },
            d,
          );
        }
      }
    }

    for (const shelf of this.world.shelves) {
      const d = Math.hypot(shelf.x - player.pos.x, shelf.y - player.pos.y);
      if (d >= 22) continue;
      const label = shelf.productId ? product(shelf.productId).name : 'Góndola vacía';
      // Sin una caja en la mano no hay nada que hacer acá: mejor decirlo.
      const hint = player.carrying ? 'Reponer' : 'Traé una caja';
      push({ kind: 'shelf', label, hint, x: shelf.x, y: shelf.y, shelf }, d);
    }

    for (const reg of this.world.registers) {
      const d = Math.hypot(reg.x - player.pos.x, reg.y - player.pos.y);
      if (d >= 24 || player.pos.y > reg.y) continue;
      const waiting = this.customerAtRegister(reg.index);
      push(
        {
          kind: 'register',
          label: 'Caja',
          hint: waiting ? 'Cobrar' : 'Sin clientes',
          x: reg.x,
          y: reg.y,
          register: reg,
        },
        d,
      );
    }

    if (this.world.computer) {
      const d = Math.hypot(this.world.computer.x - player.pos.x, this.world.computer.y - player.pos.y);
      if (d < 24) {
        push(
          { kind: 'computer', label: 'Computadora', hint: 'Comprar y precios', x: this.world.computer.x, y: this.world.computer.y },
          d,
        );
      }
    }

    if (this.world.bin && player.carrying) {
      const d = Math.hypot(this.world.bin.x - player.pos.x, this.world.bin.y - player.pos.y);
      if (d < 24) {
        push({ kind: 'bin', label: 'Tacho', hint: 'Tirar caja', x: this.world.bin.x, y: this.world.bin.y }, d);
      }
    }

    if (candidates.length === 0) return null;
    candidates.sort((a, b) => a.score - b.score);
    return candidates[0].target;
  }

  private facingAlignment(player: Player, dx: number, dy: number): number {
    const len = Math.hypot(dx, dy) || 1;
    const nx = dx / len;
    const ny = dy / len;
    switch (player.facing) {
      case 'up':
        return -ny;
      case 'down':
        return ny;
      case 'side':
        return player.flipped ? -nx : nx;
    }
  }

  private handleInput(player: Player, pad: PadState, dt: number): void {
    const target = this.findTarget(player);

    if (pad.dropPressed && player.carrying) {
      this.dropBox(player);
      return;
    }

    // Reponer es "mantener apretado": va pasando unidades de a una.
    if (player.busy?.kind === 'restock') {
      if (!pad.action || !target || target.kind !== 'shelf' || !player.carrying) {
        player.cancelBusy();
      } else if (player.tickBusy(dt)) {
        this.transferUnit(player, target.shelf!);
        if (player.carrying) player.startBusy('restock', RESTOCK_PER_UNIT);
      }
      return;
    }

    if (!target) return;

    if (pad.actionPressed) {
      this.activate(player, target);
      return;
    }

    // Mantener apretado en la caja escanea en cadena, sin machacar el botón.
    if (pad.action && target.kind === 'register') {
      this.scanHold -= dt;
      if (this.scanHold <= 0) {
        this.scanHold = 0.28 / this.perks.scanSpeed;
        this.activate(player, target);
      }
      return;
    }

    if (pad.action && target.kind === 'shelf' && player.carrying) {
      this.activate(player, target);
    }
  }

  private activate(player: Player, target: InteractTarget): void {
    switch (target.kind) {
      case 'box':
        this.pickUpBox(player, target.box!);
        break;
      case 'shelf':
        this.beginRestock(player, target.shelf!);
        break;
      case 'register':
        this.serveRegister(player, target.register!);
        break;
      case 'computer':
        this.computerUser = player.index;
        audio.sfx('select');
        break;
      case 'bin':
        if (player.carrying) {
          this.world.removeBox(player.carrying);
          player.carrying = null;
          audio.sfx('drop');
          player.say('Caja al tacho');
        }
        break;
    }
  }

  private pickUpBox(player: Player, box: Box): void {
    if (player.carrying) return;
    box.carriedBy = player.index;
    player.carrying = box;
    audio.sfx('pickup');
  }

  private dropBox(player: Player): void {
    const box = player.carrying;
    if (!box) return;
    box.carriedBy = null;
    box.x = player.pos.x;
    box.y = player.pos.y + 4;
    player.carrying = null;
    audio.sfx('drop');
  }

  private beginRestock(player: Player, shelf: Shelf): void {
    const box = player.carrying;
    if (!box) {
      player.say(shelf.productId ? `${shelf.units} en góndola` : 'Góndola vacía');
      return;
    }
    if (shelf.productId && shelf.productId !== box.productId && shelf.units > 0) {
      player.say('Esa góndola tiene otra cosa');
      audio.sfx('error');
      return;
    }
    if (shelf.units >= shelf.capacity) {
      player.say('Góndola llena');
      audio.sfx('error');
      return;
    }
    player.startBusy('restock', RESTOCK_PER_UNIT);
  }

  private transferUnit(player: Player, shelf: Shelf): void {
    const box = player.carrying;
    if (!box) return;
    if (shelf.units >= shelf.capacity) {
      player.say('Góndola llena');
      player.cancelBusy();
      return;
    }
    if (shelf.units === 0) shelf.productId = box.productId;
    if (shelf.productId !== box.productId) {
      player.cancelBusy();
      return;
    }
    shelf.units++;
    box.units--;
    audio.sfx('work');
    if (box.units <= 0) {
      this.world.removeBox(box);
      player.carrying = null;
      player.cancelBusy();
      audio.sfx('drop');
    }
  }

  private serveRegister(player: Player, reg: RegisterPoint): void {
    const customer = this.customerAtRegister(reg.index);
    if (!customer) {
      player.say('No hay nadie');
      return;
    }
    const scanned = this.scanned[reg.index];
    if (scanned < customer.cart.length) {
      this.scanned[reg.index] = scanned + 1;
      audio.sfx('pickup');
      return;
    }
    this.completeSale(reg, customer);
  }

  private completeSale(reg: RegisterPoint, customer: Customer): void {
    const total = customer.total;
    const tip = Math.round(total * 0.12 * customer.patience);
    this.money += total + tip;
    this.stats.revenue += total;
    this.stats.tips += tip;
    this.stats.unitsSold += customer.cart.length;
    this.stats.served++;
    this.stats.complaints += customer.complaints;
    this.reputation = clamp(
      this.reputation + (customer.complaints === 0 ? 0.02 : 0.004) * customer.patience,
      0.05,
      1,
    );
    this.scanned[reg.index] = 0;
    customer.settled = true;
    customer.sendHome();
    this.leaveQueue(customer);
    audio.sfx('serve');
    audio.sfx('coin');
    this.float(`+$${total + tip}`, reg.x, reg.y - 18, '#9af2a0');
  }

  // --- Textos flotantes ---

  float(text: string, x: number, y: number, color: string): void {
    this.floaters.push({ text, x, y, life: 1.3, color });
    if (this.floaters.length > 24) this.floaters.shift();
  }

  private updateFloaters(dt: number): void {
    for (const f of this.floaters) {
      f.life -= dt;
      f.y -= 12 * dt;
    }
    this.floaters = this.floaters.filter((f) => f.life > 0);
  }

  /** Manda a todos a la salida cuando cierra el local. */
  closeShop(): void {
    for (const c of this.customers) {
      if (c.state !== 'pagando') {
        if (c.cart.length > 0 && c.state !== 'saliendo') this.stats.lost++;
        c.sendHome();
        this.leaveQueue(c);
      }
    }
  }

  /** Cuánto stock quedó sin vender, valuado a precio de costo. */
  stockValue(): number {
    let total = 0;
    for (const s of this.world.shelves) {
      if (s.productId) total += s.units * product(s.productId).cost;
    }
    for (const b of this.world.boxes) total += b.units * product(b.productId).cost;
    return total;
  }

  productsSortedForUi(): ProductDef[] {
    return this.def.products.map((id) => product(id));
  }

  /**
   * Semáforo de precio.
   *
   * Se mide contra el precio de mercado, no contra la demanda: "barato" tiene
   * que significar que estás dejando plata sobre la mesa, no que vendés bien.
   */
  priceVerdict(id: string): { text: string; color: string } {
    const price = this.priceOf(id);
    const def = product(id);
    if (price < def.cost) return { text: 'PERDÉS PLATA', color: '#ff5c5c' };
    const ratio = price / def.market;
    if (ratio <= 0.85) return { text: 'BARATO', color: '#63b3ff' };
    if (ratio <= 1.08) return { text: 'BIEN', color: '#3ddc84' };
    if (demandFor(id, price) >= 0.3) return { text: 'CARO', color: '#ffb020' };
    return { text: 'CARÍSIMO', color: '#ff5c5c' };
  }
}

/** Hora del día en formato 08:00 a partir del tiempo transcurrido. */
export function clockFor(elapsed: number): string {
  const t = clamp(elapsed / DAY_SECONDS, 0, 1);
  const hours = OPEN_HOUR + t * (CLOSE_HOUR - OPEN_HOUR);
  const h = Math.floor(hours);
  const m = Math.floor((hours - h) * 60);
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

export function shelfLabel(shelf: Shelf): string {
  if (!shelf.productId || shelf.units === 0) return 'VACÍA';
  return `${shelf.units}`;
}

export function vecDistance(a: Vec, b: Vec): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}
