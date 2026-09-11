/**
 * Muebles y máquinas del local (16x22). El sprite se apoya con su base en el
 * borde inferior del tile, así que sobresale hacia arriba y da sensación de alto.
 *
 * La mayoría comparte el mismo mueble de abajo (`CABINET`) y sólo cambia la
 * parte de arriba: menos arte que mantener y un look consistente entre tiendas.
 */

import type { PixelArt, Palette } from '../engine/pixel';

export const STATION_W = 16;
export const STATION_H = 22;

export const STATION_PAL: Palette = {
  K: '#2f2836',
  1: '#d9d2c6', // cuerpo
  2: '#b8452f', // detalle
  3: '#e0a83f', // acento / contenido
  W: '#fdfaf2', // superficie
  D: '#8c8477', // sombra
  G: '#9fd8f0', // vidrio
  F: '#3a3340', // fuego (apagado por defecto)
};

/** Mueble inferior común (12 filas). */
const CABINET = [
  '..KKKKKKKKKKKK..',
  '..K1111111111K..',
  '..K1KKKKKKKK1K..',
  '..K1K222222K1K..',
  '..K1K2KKKK2K1K..',
  '..K1K222222K1K..',
  '..K1KKKKKKKK1K..',
  '..K1111111111K..',
  '..K1111111111K..',
  '..KKKKKKKKKKKK..',
  '..KDDDDDDDDDDK..',
  '..KKKKKKKKKKKK..',
];

function station(top: string[]): PixelArt {
  return { rows: [...top, ...CABINET], pal: STATION_PAL };
}

function full(rows: string[]): PixelArt {
  return { rows, pal: STATION_PAL };
}

/** Mesa de trabajo (amasar, armar pedidos). */
export const ST_TABLE = station([
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '..KKKKKKKKKKKK..',
  '..KWWWWWWWWWWK..',
  '..KWW1WWW1WWWK..',
  '..KWWWWWWWWWWK..',
]);

/** Olla (salsa, mezcla). */
export const ST_POT = station([
  '................',
  '................',
  '....KKKKKKKK....',
  '...KGGGGGGGGK...',
  '...KG333333GK...',
  '...KG333333GK...',
  '...KGGGGGGGGK...',
  '....KGGGGGGK....',
  '..KKKKKKKKKKKK..',
  '..KWWWWWWWWWWK..',
]);

/** Cajón de ingredientes (se recolorea según el ingrediente). */
export const ST_CRATE = station([
  '................',
  '................',
  '...KKKKKKKKKK...',
  '...K33333333K...',
  '...K3K3333K3K...',
  '...K33333333K...',
  '...K3K3333K3K...',
  '...KKKKKKKKKK...',
  '..KKKKKKKKKKKK..',
  '..KWWWWWWWWWWK..',
]);

/** Freezer con tres potes de helado. */
export const ST_FREEZER = station([
  '................',
  '................',
  '................',
  '...KKKKKKKKKK...',
  '...KWWKWWKWWK...',
  '...K11K22K33K...',
  '...K11K22K33K...',
  '...KKKKKKKKKK...',
  '..KKKKKKKKKKKK..',
  '..KWWWWWWWWWWK..',
]);

/** Dispenser de granas / salsas. */
export const ST_TOPPING = station([
  '................',
  '................',
  '....KKKKKKKK....',
  '....K333333K....',
  '....K3WWWW3K....',
  '....K333333K....',
  '....KKKKKKKK....',
  '.....K3333K.....',
  '.....KKKKKK.....',
  '..KWWWWWWWWWWK..',
]);

/** Batidora / mezcladora. */
export const ST_MIXER = station([
  '................',
  '................',
  '.....KKKKKK.....',
  '.....KWWWWK.....',
  '.....KWWWWK.....',
  '....KKKKKKKK....',
  '....K222222K....',
  '....K2WWWW2K....',
  '....KKKKKKKK....',
  '..KKKKKKKKKKKK..',
]);

/** Mesa de envoltorio / bolsas. */
export const ST_WRAP = station([
  '................',
  '................',
  '................',
  '.....KKKK.......',
  '....K3333K......',
  '....K3333K......',
  '....KKKKKK......',
  '..KKKKKKKKKKKK..',
  '..KWWWWWWWWWWK..',
  '..KWWWWWWWWWWK..',
]);

/** Horno: la ventana usa el color F, que cambia según esté frío, cocinando o listo. */
export const ST_OVEN = full([
  '..KKKKKKKKKKKK..',
  '..K1111111111K..',
  '..K1KKKKKKKK1K..',
  '..K1K222222K1K..',
  '..K1K2FFFF2K1K..',
  '..K1K2FFFF2K1K..',
  '..K1K222222K1K..',
  '..K1KKKKKKKK1K..',
  '..K11WW11WW11K..',
  '..K1111111111K..',
  '..KKKKKKKKKKKK..',
  '..K1111111111K..',
  '..K1KKKKKKKK1K..',
  '..K1KGGGGGGK1K..',
  '..K1KG3333GK1K..',
  '..K1KG3333GK1K..',
  '..K1KGGGGGGK1K..',
  '..K1KKKKKKKK1K..',
  '..K1111111111K..',
  '..KKKKKKKKKKKK..',
  '..KDDDDDDDDDDK..',
  '..KKKKKKKKKKKK..',
]);

/** Góndola de supermercado. */
export const ST_SHELF = full([
  '..KKKKKKKKKKKK..',
  '..K1111111111K..',
  '..K1KKKKKKKK1K..',
  '..K1K333333K1K..',
  '..K1KKKKKKKK1K..',
  '..K1111111111K..',
  '..K1KKKKKKKK1K..',
  '..K1K222222K1K..',
  '..K1KKKKKKKK1K..',
  '..K1111111111K..',
  '..K1KKKKKKKK1K..',
  '..K1K333333K1K..',
  '..K1KKKKKKKK1K..',
  '..K1111111111K..',
  '..K1KKKKKKKK1K..',
  '..K1K222222K1K..',
  '..K1KKKKKKKK1K..',
  '..K1111111111K..',
  '..K1111111111K..',
  '..KKKKKKKKKKKK..',
  '..KDDDDDDDDDDK..',
  '..KKKKKKKKKKKK..',
]);

/** Perchero de ropa. */
export const ST_RACK = full([
  '................',
  '..KKKKKKKKKKKK..',
  '..KWWWWWWWWWWK..',
  '..KKKKKKKKKKKK..',
  '...K...K...K....',
  '..KKK.KKK.KKK...',
  '..K1K.K2K.K3K...',
  '..K1K.K2K.K3K...',
  '..K1K.K2K.K3K...',
  '..K1K.K2K.K3K...',
  '..KKK.KKK.KKK...',
  '................',
  '................',
  '.......KK.......',
  '.......KK.......',
  '.......KK.......',
  '.......KK.......',
  '.......KK.......',
  '.....KKKKKK.....',
  '....KKKKKKKK....',
  '....KDDDDDDK....',
  '....KKKKKKKK....',
]);

/** Estante de juguetes. */
export const ST_TOYBOX = station([
  '................',
  '................',
  '....KK....KK....',
  '...K22K..K33K...',
  '...K2222233K....',
  '...KKKKKKKKKK...',
  '...K11111111K...',
  '...K1K1111K1K...',
  '..KKKKKKKKKKKK..',
  '..KWWWWWWWWWWK..',
]);

/** Caja registradora: acá se entregan los pedidos. */
export const ST_REGISTER = full([
  '................',
  '................',
  '.....KKKKKK.....',
  '.....K2222K.....',
  '.....K2WW2K.....',
  '.....K2222K.....',
  '....KKKKKKKK....',
  '....K111111K....',
  '....K1W1W11K....',
  '....KKKKKKKK....',
  '..KKKKKKKKKKKK..',
  '..KWWWWWWWWWWK..',
  '..KKKKKKKKKKKK..',
  '..K1111111111K..',
  '..K1KKKKKKKK1K..',
  '..K1K333333K1K..',
  '..K1KKKKKKKK1K..',
  '..K1111111111K..',
  '..K1111111111K..',
  '..KKKKKKKKKKKK..',
  '..KDDDDDDDDDDK..',
  '..KKKKKKKKKKKK..',
]);

/** Tacho de basura. */
export const ST_BIN = full([
  '................',
  '................',
  '................',
  '................',
  '...KKKKKKKKKK...',
  '...K11111111K...',
  '...KKKKKKKKKK...',
  '....KKKKKKKK....',
  '....K222222K....',
  '....K2K22K2K....',
  '....K222222K....',
  '....K2K22K2K....',
  '....K222222K....',
  '....K2K22K2K....',
  '....K222222K....',
  '....K2K22K2K....',
  '....K222222K....',
  '....KKKKKKKK....',
  '....KDDDDDDK....',
  '....KKKKKKKK....',
  '................',
  '................',
]);

export const STATION_ART = {
  table: ST_TABLE,
  pot: ST_POT,
  crate: ST_CRATE,
  freezer: ST_FREEZER,
  topping: ST_TOPPING,
  mixer: ST_MIXER,
  wrap: ST_WRAP,
  oven: ST_OVEN,
  shelf: ST_SHELF,
  rack: ST_RACK,
  toybox: ST_TOYBOX,
  register: ST_REGISTER,
  bin: ST_BIN,
} as const;

export type StationArtName = keyof typeof STATION_ART;
