/**
 * Las seis tiendas.
 *
 * Comparten dos plantas (una chica y una grande) y se distinguen por el mueble
 * de exhibición, la paleta y el catálogo. Una sola planta bien resuelta se ve
 * mejor que seis a medio hacer, y agregar tiendas nuevas cuesta diez líneas.
 *
 * Leyenda del plano:
 *   #  pared          .  piso           S  góndola / exhibidor
 *   =  mostrador      R  caja           C  computadora (mayorista y precios)
 *   B  tacho          D  depósito       E  entrada
 */

import type { Palette } from '../../engine/pixel';
import type { StationArtName } from '../../art/stations';

export type StoreId = 'pizzeria' | 'heladeria' | 'panaderia' | 'super' | 'ropa' | 'jugueteria';

/** Planta chica: 20x14 tiles. */
const SMALL = [
  '####################',
  '#WWW####WWW####WWW##',
  '#..................#',
  '#..SSS......SSS....#',
  '#..................#',
  '#..SSS......SSS....#',
  '#..................#',
  '#..................#',
  '#..................#',
  '#...............DDD#',
  '#==R===R........DDD#',
  '#...............DDD#',
  '#.............B...C#',
  '########EE##########',
];

/** Planta grande: 24x16 tiles. */
const LARGE = [
  '########################',
  '#WWW###WWW###WWW###WWW##',
  '#......................#',
  '#...SSS.......SSS......#',
  '#......................#',
  '#...SSS.......SSS......#',
  '#......................#',
  '#...SSS.......SSS......#',
  '#......................#',
  '#......................#',
  '#......................#',
  '#...................DDD#',
  '#==R====R...........DDD#',
  '#...................DDD#',
  '#.................B...C#',
  '##########EE############',
];

export interface StoreDef {
  id: StoreId;
  name: string;
  tagline: string;
  layout: readonly string[];
  /** Mueble que se usa como góndola/exhibidor. */
  shelfArt: StationArtName;
  shelfPal: Palette;
  floorPal: Palette;
  wallPal: Palette;
  /** Color de marca, para carteles y la interfaz. */
  accent: string;
  /** Alquiler y gastos fijos que se pagan al cerrar el día. */
  rent: number;
  /** Nivel de carrera necesario para desbloquearla. */
  unlockLevel: number;
  /** Cuántos clientes por minuto llegan con la tienda llena y precios normales. */
  baseTraffic: number;
  products: readonly string[];
}

export const STORES: StoreDef[] = [
  {
    id: 'pizzeria',
    name: 'Pizzería',
    tagline: 'La primera tienda. Pizza, pan de ajo y bebida fría.',
    layout: SMALL,
    shelfArt: 'shelf',
    shelfPal: { 1: '#e8d9c0', 2: '#c8452f', 3: '#e0a83f', D: '#9a8a72' },
    floorPal: { 1: '#f2e2cf', D: '#d9c3a6' },
    wallPal: { 1: '#f7ede0', K: '#4a3a33' },
    accent: '#e0533f',
    rent: 600,
    unlockLevel: 1,
    baseTraffic: 16,
    products: ['pizza_muzza', 'pizza_pepperoni', 'pizza_verdura', 'pan_ajo', 'gaseosa', 'agua'],
  },
  {
    id: 'heladeria',
    name: 'Heladería',
    tagline: 'Potes, cucuruchos y la caja familiar del domingo.',
    layout: SMALL,
    shelfArt: 'freezer',
    shelfPal: { 1: '#f7b9cf', 2: '#8fd8e8', 3: '#f2e07a', D: '#9aa8b5' },
    floorPal: { 1: '#e8f4fa', D: '#c3dbe8' },
    wallPal: { 1: '#fdf2f7', K: '#3a4a55' },
    accent: '#f2789d',
    rent: 900,
    unlockLevel: 3,
    baseTraffic: 18,
    products: ['pote_choco', 'pote_frutilla', 'pote_limon', 'cucurucho', 'caja_familiar', 'agua'],
  },
  {
    id: 'panaderia',
    name: 'Panadería',
    tagline: 'Pan, facturas y tortas. El olor arrastra clientes.',
    layout: SMALL,
    shelfArt: 'shelf',
    shelfPal: { 1: '#e8cfa8', 2: '#b5713f', 3: '#e0a83f', D: '#a8895f' },
    floorPal: { 1: '#f4e6cf', D: '#d9bd93' },
    wallPal: { 1: '#fbf0dd', K: '#4f3a28' },
    accent: '#d98f3f',
    rent: 1200,
    unlockLevel: 5,
    baseTraffic: 20,
    products: ['pan', 'medialuna', 'factura', 'torta_choco', 'torta_frutilla', 'leche'],
  },
  {
    id: 'super',
    name: 'Supermercado',
    tagline: 'El local grande: más góndolas, más gente, más quilombo.',
    layout: LARGE,
    shelfArt: 'shelf',
    shelfPal: { 1: '#dde2e8', 2: '#4a86c8', 3: '#e8e2d2', D: '#9aa0a8' },
    floorPal: { 1: '#eef0f2', D: '#ccd2d8' },
    wallPal: { 1: '#f4f6f8', K: '#3a434f' },
    accent: '#3f86c8',
    rent: 2200,
    unlockLevel: 8,
    baseTraffic: 26,
    products: ['leche', 'yogur', 'manzana', 'fideos', 'arroz', 'galletitas', 'gaseosa', 'agua', 'jugo', 'pan'],
  },
  {
    id: 'ropa',
    name: 'Tienda de ropa',
    tagline: 'Pocas ventas, pero cada una vale el triple.',
    layout: LARGE,
    shelfArt: 'rack',
    shelfPal: { 1: '#e05a7a', 2: '#4a6bb5', 3: '#9a63d6', D: '#9a8f9a' },
    floorPal: { 1: '#f4eef4', D: '#dcd0dc' },
    wallPal: { 1: '#faf4fa', K: '#443344' },
    accent: '#b45ad0',
    rent: 3200,
    unlockLevel: 12,
    baseTraffic: 14,
    products: ['remera', 'campera', 'pantalon', 'vestido', 'cartera'],
  },
  {
    id: 'jugueteria',
    name: 'Juguetería',
    tagline: 'La última. Clientes exigentes y precios altos.',
    layout: LARGE,
    shelfArt: 'toybox',
    shelfPal: { 1: '#f2e07a', 2: '#e2453f', 3: '#48a85a', D: '#a89a72' },
    floorPal: { 1: '#fff4e0', D: '#e8d2a8' },
    wallPal: { 1: '#fffaf0', K: '#4a3f28' },
    accent: '#48a85a',
    rent: 4200,
    unlockLevel: 16,
    baseTraffic: 16,
    products: ['osito', 'pelota', 'robot', 'autito', 'juego_mesa', 'rompecabezas'],
  },
];

const BY_ID = new Map<StoreId, StoreDef>(STORES.map((s) => [s.id, s]));

export function store(id: StoreId): StoreDef {
  const found = BY_ID.get(id);
  if (!found) throw new Error(`Tienda desconocida: ${id}`);
  return found;
}

export function storesUpTo(level: number): StoreDef[] {
  return STORES.filter((s) => s.unlockLevel <= level);
}

/** Cuánta plata total hace falta para llegar a cada nivel de carrera. */
export function levelForEarnings(totalEarned: number): number {
  let level = 1;
  let need = 3000;
  while (totalEarned >= need && level < 60) {
    level++;
    need += Math.round(2500 * Math.pow(1.18, level - 1));
  }
  return level;
}

export function earningsForLevel(level: number): number {
  let need = 3000;
  let total = 0;
  for (let l = 1; l < level; l++) {
    total = need;
    need += Math.round(2500 * Math.pow(1.18, l));
  }
  return level <= 1 ? 0 : total;
}

export function nextLevelEarnings(level: number): number {
  let need = 3000;
  for (let l = 1; l < level; l++) need += Math.round(2500 * Math.pow(1.18, l));
  return need;
}
