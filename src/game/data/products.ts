/**
 * Catálogo de productos.
 *
 * Cada producto tiene costo mayorista, precio de referencia del mercado y
 * cuántas unidades trae una caja. Esos tres números son toda la economía:
 * el jugador decide el precio de venta y el público decide si le parece caro.
 */

import type { Palette } from '../../engine/pixel';
import type { ShapeName } from '../../art/items';

export type Category = 'pizza' | 'bebida' | 'helado' | 'panaderia' | 'almacen' | 'ropa' | 'juguete';

export interface ProductDef {
  id: string;
  name: string;
  shape: ShapeName;
  colors: Palette;
  category: Category;
  /** Lo que cuesta cada unidad al mayorista. */
  cost: number;
  /** Precio "normal" de mercado. Cobrar bastante más espanta clientes. */
  market: number;
  /** Unidades que trae una caja. */
  perBox: number;
}

const K = '#3a2b33';

function p(
  id: string,
  name: string,
  shape: ShapeName,
  category: Category,
  cost: number,
  market: number,
  perBox: number,
  colors: Palette,
): ProductDef {
  return { id, name, shape, category, cost, market, perBox, colors: { K, ...colors } };
}

export const PRODUCTS: ProductDef[] = [
  // --- Pizzería ---
  p('pizza_muzza', 'Muzzarella', 'pizza', 'pizza', 60, 105, 6, { 1: '#d99a4e', 2: '#a83224', T: '#f3cf6a' }),
  p('pizza_pepperoni', 'Pepperoni', 'pizza', 'pizza', 75, 130, 6, { 1: '#d99a4e', 2: '#a83224', T: '#a8281f' }),
  p('pizza_verdura', 'Verdura', 'pizza', 'pizza', 70, 120, 6, { 1: '#d99a4e', 2: '#a83224', T: '#3f8a3a' }),
  p('pan_ajo', 'Pan de ajo', 'bread', 'panaderia', 25, 45, 10, { 1: '#cf9046', D: '#8f5a24' }),

  // --- Heladería ---
  p('pote_choco', 'Pote chocolate', 'icecream', 'helado', 55, 95, 8, { 1: '#8a5430', 3: '#d9a05a', D: '#a8763c', T: '#8a5430' }),
  p('pote_frutilla', 'Pote frutilla', 'icecream', 'helado', 55, 95, 8, { 1: '#f291b0', 3: '#d9a05a', D: '#a8763c', T: '#f291b0' }),
  p('pote_limon', 'Pote limón', 'icecream', 'helado', 50, 90, 8, { 1: '#f2e07a', 3: '#d9a05a', D: '#a8763c', T: '#f2e07a' }),
  p('cucurucho', 'Cucurucho', 'cone', 'helado', 30, 55, 12, { 3: '#d9a05a', D: '#a8763c' }),
  p('caja_familiar', 'Caja familiar', 'box', 'helado', 120, 205, 4, { 1: '#8fd0e8', W: '#ffffff' }),

  // --- Panadería ---
  p('pan', 'Pan casero', 'bread', 'panaderia', 30, 55, 10, { 1: '#cf9046', D: '#8f5a24' }),
  p('medialuna', 'Medialunas', 'croissant', 'panaderia', 20, 40, 12, { 1: '#e0a64f' }),
  p('torta_choco', 'Torta chocolate', 'cake', 'panaderia', 150, 265, 2, { 1: '#cf9046', T: '#6b3f22' }),
  p('torta_frutilla', 'Torta frutilla', 'cake', 'panaderia', 150, 265, 2, { 1: '#cf9046', T: '#f2789d' }),
  p('factura', 'Facturas', 'croissant', 'panaderia', 22, 42, 12, { 1: '#d98f3f' }),

  // --- Almacén / supermercado ---
  p('leche', 'Leche', 'milk', 'almacen', 35, 62, 8, { 1: '#4f86d6', W: '#f4f9ff' }),
  p('yogur', 'Yogur', 'milk', 'almacen', 30, 55, 8, { 1: '#e070a0', W: '#fff0f6' }),
  p('manzana', 'Manzanas', 'fruit', 'almacen', 25, 48, 10, { 1: '#e2453f', W: '#ff8a80', D: '#4f7a35' }),
  p('fideos', 'Fideos', 'box', 'almacen', 28, 52, 10, { 1: '#e0a83f', W: '#fff3d0' }),
  p('arroz', 'Arroz', 'box', 'almacen', 30, 55, 10, { 1: '#d8cbb0', W: '#ffffff' }),
  p('galletitas', 'Galletitas', 'box', 'almacen', 32, 58, 10, { 1: '#8a5430', W: '#ffd9a0' }),
  p('gaseosa', 'Gaseosa', 'bottle', 'bebida', 30, 55, 12, { 1: '#48a85a', W: '#d8f5dd' }),
  p('agua', 'Agua', 'bottle', 'bebida', 20, 38, 12, { 1: '#5fb9e8', W: '#e6f7ff' }),
  p('jugo', 'Jugo', 'bottle', 'bebida', 26, 48, 12, { 1: '#e88a3f', W: '#ffe3c0' }),

  // --- Ropa ---
  p('remera', 'Remera', 'shirt', 'ropa', 110, 195, 4, { 1: '#e05a7a' }),
  p('campera', 'Campera', 'shirt', 'ropa', 210, 370, 3, { 1: '#3f6b9a' }),
  p('pantalon', 'Pantalón', 'pants', 'ropa', 160, 280, 4, { 1: '#4a6bb5' }),
  p('vestido', 'Vestido', 'dress', 'ropa', 180, 320, 4, { 1: '#9a63d6' }),
  p('cartera', 'Cartera', 'bag', 'ropa', 140, 250, 4, { 1: '#b5714a', W: '#f0d9c0' }),

  // --- Juguetería ---
  p('osito', 'Osito', 'teddy', 'juguete', 95, 170, 5, { 1: '#c98a4b', D: '#6b4426' }),
  p('pelota', 'Pelota', 'ball', 'juguete', 55, 100, 8, { 1: '#e2453f', W: '#fff6e8' }),
  p('robot', 'Robot', 'robot', 'juguete', 150, 265, 4, { 1: '#8aa0b5', W: '#5fd0ff' }),
  p('autito', 'Autito', 'car', 'juguete', 70, 125, 6, { 1: '#e0a83f', W: '#bfe8ff' }),
  p('juego_mesa', 'Juego de mesa', 'box', 'juguete', 120, 210, 4, { 1: '#9a63d6', W: '#f0e3ff' }),
  p('rompecabezas', 'Rompecabezas', 'box', 'juguete', 80, 145, 6, { 1: '#48a85a', W: '#ddf5e0' }),
];

const BY_ID = new Map<string, ProductDef>(PRODUCTS.map((x) => [x.id, x]));

export function product(id: string): ProductDef {
  const found = BY_ID.get(id);
  if (!found) throw new Error(`Producto desconocido: ${id}`);
  return found;
}

export function hasProduct(id: string): boolean {
  return BY_ID.has(id);
}

/** Lo que cuesta una caja entera en el mayorista. */
export function boxCost(id: string): number {
  const d = product(id);
  return d.cost * d.perBox;
}

/**
 * Qué tan dispuesta está la gente a pagar un precio.
 * 1 = lo compra sin dudar; 0 = le parece un robo y lo deja en la góndola.
 */
export function demandFor(id: string, price: number): number {
  const { market } = product(id);
  if (price <= market * 0.85) return 1;
  if (price <= market) return 0.95;
  const over = (price - market) / market;
  // Hasta +35% todavía compran bastante; de ahí en más se desploma.
  if (over <= 0.35) return 0.95 - over * 1.3;
  return Math.max(0, 0.5 - (over - 0.35) * 1.6);
}

/** Precio sugerido al desbloquear un producto: margen sano y número redondo. */
export function suggestedPrice(id: string): number {
  return Math.round((product(id).market * 0.98) / 5) * 5;
}
