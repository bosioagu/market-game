/**
 * Personajes en pixel art (16x20).
 *
 * En vez de guardar 12 sprites a mano por personaje, se arma la grilla desde
 * plantillas: cabeza según la dirección + piernas según el frame de caminata.
 * Los colores son "ranuras" que se reemplazan por personaje, así cada cliente
 * sale distinto sin dibujar nada nuevo.
 */

import type { PixelArt, Palette } from '../engine/pixel';

export type Facing = 'down' | 'up' | 'side';

/** Paleta base. Las letras S/H/C/A/P se sobreescriben por personaje. */
export const CHAR_PALETTE: Palette = {
  K: '#2a2233', // contorno
  S: '#f2c9a0', // piel
  b: '#e8927c', // rubor
  M: '#9c5b4e', // boca
  E: '#2a2233', // ojo
  H: '#6b4226', // pelo
  C: '#e05a5a', // ropa
  A: '#f5f0e6', // delantal / detalle
  P: '#3b4a6b', // pantalón
  B: '#3a3340', // zapatos
};

const HEAD_DOWN = [
  '.....KKKKKK.....',
  '....KHHHHHHK....',
  '...KHHHHHHHHK...',
  '...KHHHHHHHHK...',
  '...KHSSSSSSHK...',
  '...KHSESSESHK...',
  '...KHbSSSSbHK...',
  '...KHSSMMSSHK...',
  '....KSSSSSSK....',
  '.....KSSSSK.....',
];

const HEAD_UP = [
  '.....KKKKKK.....',
  '....KHHHHHHK....',
  '...KHHHHHHHHK...',
  '...KHHHHHHHHK...',
  '...KHHHHHHHHK...',
  '...KHHHHHHHHK...',
  '...KHHHHHHHHK...',
  '...KHHHHHHHHK...',
  '....KHHHHHHK....',
  '.....KSSSSK.....',
];

const HEAD_SIDE = [
  '....KKKKKK......',
  '...KHHHHHHK.....',
  '..KHHHHHHHHK....',
  '..KHHHHHHHHK....',
  '..KHHHSSSSSK....',
  '..KHHSSESSSK....',
  '..KHHSSSSSbK....',
  '..KHHSSSSMMK....',
  '...KHSSSSSK.....',
  '....KSSSSK......',
];

const BODY_DOWN = [
  '..KKKCCCCCCKKK..',
  '..KCCKCCCCKCCK..',
  '..KCCKAAAAKCCK..',
  '..KSSKAAAAKSSK..',
  '..KSSKAAAAKSSK..',
  '...KKKAAAAKKK...',
  '....KAAAAAAK....',
];

const BODY_UP = [
  '..KKKCCCCCCKKK..',
  '..KCCKCCCCKCCK..',
  '..KCCKCCAAKCCK..',
  '..KSSKCCAAKSSK..',
  '..KSSKCCAAKSSK..',
  '...KKKCCCCKKK...',
  '....KCCCCCCK....',
];

const BODY_SIDE = [
  '...KKCCCCCCK....',
  '...KCCCCCCCK....',
  '...KCAAAAAKSK...',
  '...KCAAAAAKSK...',
  '...KCAAAAAAK....',
  '...KAAAAAAK.....',
  '...KAAAAAAK.....',
];

const LEGS: string[][] = [
  // 0: quieto
  [
    '....KPPKKPPK....',
    '....KPPKKPPK....',
    '....KBBKKBBK....',
  ],
  // 1: paso izquierdo
  [
    '....KPPKKPPK....',
    '...KPPK.KPPK....',
    '...KBBK..KBBK...',
  ],
  // 2: quieto (para que el ciclo sea 0-1-0-2)
  [
    '....KPPKKPPK....',
    '....KPPKKPPK....',
    '....KBBKKBBK....',
  ],
  // 3: paso derecho
  [
    '....KPPKKPPK....',
    '....KPPK.KPPK...',
    '...KBBK..KBBK...',
  ],
];

const HEADS: Record<Facing, string[]> = { down: HEAD_DOWN, up: HEAD_UP, side: HEAD_SIDE };
const BODIES: Record<Facing, string[]> = { down: BODY_DOWN, up: BODY_UP, side: BODY_SIDE };

export const CHAR_W = 16;
export const CHAR_H = 20;

/** Arma el arte de un personaje para una dirección y frame de caminata. */
export function characterArt(facing: Facing, frame: number): PixelArt {
  const legs = LEGS[((frame % LEGS.length) + LEGS.length) % LEGS.length];
  return {
    rows: [...HEADS[facing], ...BODIES[facing], ...legs],
    pal: CHAR_PALETTE,
  };
}

/** Look de un personaje: solo colores, ninguna geometría nueva. */
export interface CharacterLook {
  skin: string;
  hair: string;
  cloth: string;
  apron: string;
  pants: string;
  shoes?: string;
}

export function lookToPalette(look: CharacterLook): Palette {
  return {
    S: look.skin,
    H: look.hair,
    C: look.cloth,
    A: look.apron,
    P: look.pants,
    B: look.shoes ?? '#3a3340',
  };
}

export function lookKey(look: CharacterLook): string {
  return [look.skin, look.hair, look.cloth, look.apron, look.pants, look.shoes ?? ''].join('_');
}

/** Los dos personajes jugables. */
export const LOOK_MIA: CharacterLook = {
  skin: '#f6cba6',
  hair: '#4a2f1d',
  cloth: '#ef5f7a',
  apron: '#fff3e2',
  pants: '#3f5aa6',
  shoes: '#3a3340',
};

export const LOOK_KIKI: CharacterLook = {
  skin: '#e8b183',
  hair: '#2f2b3a',
  cloth: '#39b6a8',
  apron: '#fff3e2',
  pants: '#5a4a7a',
  shoes: '#3a3340',
};

const SKINS = ['#f6cba6', '#e8b183', '#d69664', '#b9763f', '#8d5524', '#f9ddc0'];
const HAIRS = ['#2f2b3a', '#4a2f1d', '#8a5a2b', '#c98f3a', '#d9d2c5', '#a33b4f', '#3c6b8f', '#6d4a8f'];
const CLOTHES = ['#e05a5a', '#5a9ae0', '#66b45a', '#e0a83f', '#b463d6', '#e07ab0', '#4fc2c2', '#e8823f'];
const PANTS = ['#3b4a6b', '#5c4a3a', '#4a4a55', '#6b3b52', '#2f5a4a'];

/** Genera un look aleatorio para los clientes. */
export function randomLook(rand: () => number): CharacterLook {
  const pick = <T,>(arr: readonly T[]): T => arr[Math.floor(rand() * arr.length)];
  const cloth = pick(CLOTHES);
  return {
    skin: pick(SKINS),
    hair: pick(HAIRS),
    cloth,
    apron: cloth,
    pants: pick(PANTS),
  };
}
