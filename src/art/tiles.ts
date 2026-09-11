/** Tiles del local (16x16) y decoración. */

import type { PixelArt, Palette } from '../engine/pixel';

export const TILE = 16;

const TILE_PAL: Palette = {
  K: '#2f2836',
  D: '#c9bfae',
  1: '#eee6d6',
  2: '#d8cbb6',
  3: '#c25a5a',
  W: '#ffffff',
  G: '#9fd8f0',
};

function t(rows: string[]): PixelArt {
  return { rows, pal: TILE_PAL };
}

export const FLOOR = t([
  'DDDDDDDDDDDDDDDD',
  'D11111111111111D',
  'D11111111111111D',
  'D11111111111111D',
  'D11111111111111D',
  'D11111111111111D',
  'D11111111111111D',
  'D11111111111111D',
  'D11111111111111D',
  'D11111111111111D',
  'D11111111111111D',
  'D11111111111111D',
  'D11111111111111D',
  'D11111111111111D',
  'D11111111111111D',
  'D11111111111111D',
]);

export const WALL = t([
  'KKKKKKKKKKKKKKKK',
  'K1111111K111111K',
  'K1111111K111111K',
  'K1111111K111111K',
  'K1111111K111111K',
  'K1111111K111111K',
  'K1111111K111111K',
  'K1111111K111111K',
  'KKKKKKKKKKKKKKKK',
  '111K1111111K1111',
  '111K1111111K1111',
  '111K1111111K1111',
  '111K1111111K1111',
  '111K1111111K1111',
  '111K1111111K1111',
  '111K1111111K1111',
]);

/** Mostrador de atención: pensado para repetirse en horizontal. */
export const COUNTER = t([
  'KKKKKKKKKKKKKKKK',
  'WWWWWWWWWWWWWWWW',
  'WWWWWWWWWWWWWWWW',
  'KKKKKKKKKKKKKKKK',
  '1111111111111111',
  '1111111111111111',
  '1KKKKKK11KKKKKK1',
  '1K2222K11K2222K1',
  '1K2222K11K2222K1',
  '1KKKKKK11KKKKKK1',
  '1111111111111111',
  '1111111111111111',
  'KKKKKKKKKKKKKKKK',
  'DDDDDDDDDDDDDDDD',
  'DDDDDDDDDDDDDDDD',
  'KKKKKKKKKKKKKKKK',
]);

/** Felpudo de entrada. */
export const MAT = t([
  '................',
  '.KKKKKKKKKKKKKK.',
  '.K333333333333K.',
  '.K333333333333K.',
  '.K333333333333K.',
  '.K333333333333K.',
  '.K333333333333K.',
  '.K333333333333K.',
  '.K333333333333K.',
  '.K333333333333K.',
  '.K333333333333K.',
  '.K333333333333K.',
  '.K333333333333K.',
  '.K333333333333K.',
  '.KKKKKKKKKKKKKK.',
  '................',
]);

export const WINDOW = t([
  'KKKKKKKKKKKKKKKK',
  'K11111111111111K',
  'K1KKKKKKKKKKKK1K',
  'K1KGGGGGGGGGGK1K',
  'K1KGGGGGGGGGGK1K',
  'K1KGGGGWWGGGGK1K',
  'K1KGGGWWWGGGGK1K',
  'K1KGGGGGGGGGGK1K',
  'K1KKKKKKKKKKKK1K',
  'K1KGGGGGGGGGGK1K',
  'K1KGGGGGGGGGGK1K',
  'K1KGGGGGGGGGGK1K',
  'K1KGGGGGGGGGGK1K',
  'K1KKKKKKKKKKKK1K',
  'K11111111111111K',
  'KKKKKKKKKKKKKKKK',
]);

export const PLANT: PixelArt = {
  rows: [
    '................',
    '......KK........',
    '...KK.KK.KK.....',
    '..K22K22K22K....',
    '..K2222222K.....',
    '...K22222K......',
    '..K2222222K.....',
    '...K22222K......',
    '.....K2K........',
    '.....K2K........',
    '...KKKKKKKK.....',
    '...K111111K.....',
    '...K111111K.....',
    '...K1WWWW1K.....',
    '...K111111K.....',
    '...K111111K.....',
    '....KKKKKK......',
    '....KDDDDK......',
    '....KKKKKK......',
    '................',
  ],
  pal: {
    K: '#2f2836',
    1: '#c9713f',
    2: '#4faa5a',
    D: '#8a4a28',
    W: '#e08a52',
  },
};
