/**
 * Progreso de la partida: plata, nivel, tiendas desbloqueadas, precios y mejoras.
 * Se guarda en el navegador, así que el juego sigue donde quedó sin cuentas ni servidores.
 */

import { levelForEarnings, STORES, type StoreId } from './data/stores';
import { suggestedPrice } from './data/products';
import { store } from './data/stores';

export interface UpgradeDef {
  id: string;
  name: string;
  description: string;
  maxLevel: number;
  /** Costo del siguiente nivel. */
  cost(level: number): number;
}

export const UPGRADES: UpgradeDef[] = [
  {
    id: 'gondolas',
    name: 'Góndolas más altas',
    description: 'Cada góndola guarda 4 unidades más.',
    maxLevel: 3,
    cost: (lvl) => 1500 * Math.pow(2, lvl),
  },
  {
    id: 'lector',
    name: 'Lector rápido',
    description: 'Cobrás más rápido en la caja.',
    maxLevel: 3,
    cost: (lvl) => 1200 * Math.pow(2, lvl),
  },
  {
    id: 'cartel',
    name: 'Cartel luminoso',
    description: 'Viene 15% más de gente por día.',
    maxLevel: 3,
    cost: (lvl) => 2000 * Math.pow(2, lvl),
  },
  {
    id: 'zapatillas',
    name: 'Zapatillas nuevas',
    description: 'Caminás 15% más rápido.',
    maxLevel: 3,
    cost: (lvl) => 1000 * Math.pow(2, lvl),
  },
];

export interface Progress {
  version: number;
  money: number;
  totalEarned: number;
  day: number;
  currentStore: StoreId;
  prices: Partial<Record<StoreId, Record<string, number>>>;
  upgrades: Record<string, number>;
  /** Tiendas que el jugador ya visitó al menos una vez. */
  seenStores: StoreId[];
  muted: boolean;
  /** Cómo se dibuja el local: en 3D o en pixel art. */
  vista: 'tres-d' | 'pixel';
}

const KEY = 'mia-kiki-market/progreso';
const VERSION = 1;

export function defaultProgress(): Progress {
  const prices: Progress['prices'] = {};
  for (const s of STORES) {
    prices[s.id] = defaultPricesFor(s.id);
  }
  return {
    version: VERSION,
    money: 2500,
    totalEarned: 0,
    day: 1,
    currentStore: 'pizzeria',
    prices,
    upgrades: {},
    seenStores: ['pizzeria'],
    muted: false,
    vista: 'tres-d',
  };
}

export function defaultPricesFor(id: StoreId): Record<string, number> {
  const out: Record<string, number> = {};
  for (const p of store(id).products) out[p] = suggestedPrice(p);
  return out;
}

export function loadProgress(): Progress {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultProgress();
    const parsed = JSON.parse(raw) as Partial<Progress>;
    if (parsed.version !== VERSION) return defaultProgress();
    const base = defaultProgress();
    const merged: Progress = { ...base, ...parsed, prices: { ...base.prices } };
    // Completa precios de productos nuevos sin pisar los que el jugador ya eligió.
    for (const s of STORES) {
      const saved = parsed.prices?.[s.id] ?? {};
      merged.prices[s.id] = { ...defaultPricesFor(s.id), ...saved };
    }
    merged.upgrades = { ...(parsed.upgrades ?? {}) };
    merged.seenStores = parsed.seenStores?.length ? parsed.seenStores : base.seenStores;
    return merged;
  } catch {
    return defaultProgress();
  }
}

export function saveProgress(p: Progress): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    // Modo incógnito o almacenamiento lleno: se juega igual, no se guarda.
  }
}

export function resetProgress(): Progress {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* sin persistencia */
  }
  return defaultProgress();
}

export function careerLevel(p: Progress): number {
  return levelForEarnings(p.totalEarned);
}

export function upgradeLevel(p: Progress, id: string): number {
  return p.upgrades[id] ?? 0;
}

export function upgradeCost(p: Progress, def: UpgradeDef): number | null {
  const level = upgradeLevel(p, def.id);
  if (level >= def.maxLevel) return null;
  return def.cost(level);
}

/** Multiplicadores derivados de las mejoras compradas. */
export interface Perks {
  shelfCapacity: number;
  scanSpeed: number;
  trafficMultiplier: number;
  moveSpeedBonus: number;
}

export function perksFor(p: Progress): Perks {
  return {
    shelfCapacity: 12 + upgradeLevel(p, 'gondolas') * 4,
    scanSpeed: 1 + upgradeLevel(p, 'lector') * 0.45,
    trafficMultiplier: 1 + upgradeLevel(p, 'cartel') * 0.15,
    moveSpeedBonus: upgradeLevel(p, 'zapatillas') * 0.15,
  };
}
