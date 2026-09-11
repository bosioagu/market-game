/**
 * Geometría del local en 3D, armada por código con cajas y cilindros.
 *
 * No hay modelos importados: cada mueble y cada personaje se construye con
 * primitivas. Los personajes reusan la misma paleta (piel, pelo, ropa) que el
 * modo pixel art, así que un cliente se ve igual de una vista que de la otra.
 */

import {
  BoxGeometry,
  CircleGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  type Object3D,
} from 'three';
import { TILE } from '../art/tiles';
import type { CharacterLook } from '../art/chars';
import { boxTexture, productTexture } from './textures';

/** Un tile del plano mide dos unidades de escena. */
export const UNITS_PER_TILE = 2;
/** Conversión de píxeles del mundo 2D a unidades de escena. */
export const PX = UNITS_PER_TILE / TILE;

export const GONDOLA_H = 2.1;
export const PRODUCT_W = 0.34;
export const PRODUCT_H = 0.46;
export const PRODUCT_D = 0.28;
/** Huecos de producto por góndola: 3 estantes x 4 de frente x 2 caras. */
export const SLOTS_PER_SHELF = 24;

const materialCache = new Map<string, MeshLambertMaterial>();

function mat(color: string, extra?: { emissive?: string; transparent?: boolean; opacity?: number }): MeshLambertMaterial {
  const key = `${color}|${extra?.emissive ?? ''}|${extra?.opacity ?? 1}`;
  const hit = materialCache.get(key);
  if (hit) return hit;
  const m = new MeshLambertMaterial({ color });
  if (extra?.emissive) m.emissive.set(extra.emissive);
  if (extra?.transparent) {
    m.transparent = true;
    m.opacity = extra.opacity ?? 1;
  }
  materialCache.set(key, m);
  return m;
}

const geometryCache = new Map<string, BoxGeometry>();

/** Las cajas se repiten muchísimo, así que se comparte la geometría. */
function boxGeometry(w: number, h: number, d: number): BoxGeometry {
  const key = `${w}|${h}|${d}`;
  let g = geometryCache.get(key);
  if (!g) {
    g = new BoxGeometry(w, h, d);
    geometryCache.set(key, g);
  }
  return g;
}

function box(w: number, h: number, d: number, color: string, x = 0, y = 0, z = 0): Mesh {
  const m = new Mesh(boxGeometry(w, h, d), mat(color));
  m.position.set(x, y, z);
  return m;
}

/** Góndola de doble cara: los productos se apoyan de los dos lados. */
export function makeGondola(cuerpo: string, estante: string, detalle: string): Group {
  const g = new Group();
  g.add(box(UNITS_PER_TILE, 0.14, 1.36, detalle, 0, 0.07, 0));
  g.add(box(UNITS_PER_TILE, GONDOLA_H, 0.08, cuerpo, 0, GONDOLA_H / 2, 0));
  for (const lado of [-1, 1]) {
    g.add(box(0.07, GONDOLA_H, 1.36, cuerpo, lado * (UNITS_PER_TILE / 2 - 0.035), GONDOLA_H / 2, 0));
  }
  for (const y of SHELF_LEVELS) {
    g.add(box(UNITS_PER_TILE - 0.14, 0.05, 1.3, estante, 0, y, 0));
  }
  // Remate fino arriba: si fuera una tapa maciza, la góndola parecería una mesa.
  g.add(box(UNITS_PER_TILE, 0.05, 0.12, cuerpo, 0, GONDOLA_H, 0));
  return g;
}

/** Alturas de los tres estantes; los productos se apoyan justo encima. */
export const SHELF_LEVELS = [0.5, 1.1, 1.7];

/** Posición local de cada hueco de producto dentro de una góndola. */
export function slotPosition(slot: number): { x: number; y: number; z: number } {
  // Se alternan las dos caras y se sube de estante: la góndola se llena de
  // abajo hacia arriba y pareja de los dos lados, como la repondría una persona.
  const cara = slot % 2 === 0 ? 1 : -1;
  const i = Math.floor(slot / 2);
  const nivel = Math.floor(i / 4) % SHELF_LEVELS.length;
  const columna = i % 4;
  return {
    x: -0.72 + columna * 0.48,  // cuatro envases a lo ancho del tile
    y: SHELF_LEVELS[nivel] + PRODUCT_H / 2 + 0.03,
    z: cara * 0.38,
  };
}

/** Mostrador con caja registradora. */
export function makeRegister(cuerpo: string, tapa: string): Group {
  const g = new Group();
  g.add(box(UNITS_PER_TILE, 1.0, 1.3, cuerpo, 0, 0.5, 0));
  g.add(box(UNITS_PER_TILE + 0.06, 0.08, 1.36, tapa, 0, 1.03, 0));
  // Cinta de la caja, hacia el lado del cliente.
  g.add(box(UNITS_PER_TILE - 0.3, 0.04, 0.5, '#2f2836', 0, 1.09, 0.35));
  // Registradora.
  const reg = new Group();
  reg.add(box(0.5, 0.32, 0.4, '#e8eaec', 0, 0.16, 0));
  reg.add(box(0.44, 0.26, 0.06, '#2b3a4a', 0, 0.34, -0.14));
  reg.rotation.x = -0.35;
  reg.position.set(-0.5, 1.07, -0.25);
  g.add(reg);
  return g;
}

/** Escritorio con la computadora del local. */
export function makeDesk(): Group {
  const g = new Group();
  g.add(box(1.5, 0.08, 1.0, '#8a6b4a', 0, 0.78, 0));
  for (const [x, z] of [[-0.65, -0.4], [0.65, -0.4], [-0.65, 0.4], [0.65, 0.4]] as const) {
    g.add(box(0.08, 0.78, 0.08, '#6b4f36', x, 0.39, z));
  }
  g.add(box(0.12, 0.26, 0.3, '#3a3f47', 0, 0.95, -0.1));
  const pantalla = box(0.9, 0.58, 0.05, '#2b3a4a', 0, 1.38, -0.1);
  g.add(pantalla);
  const brillo = new Mesh(new BoxGeometry(0.8, 0.48, 0.02), mat('#8fe3ff', { emissive: '#3f9ac8' }));
  brillo.position.set(0, 1.38, -0.06);
  g.add(brillo);
  g.add(box(0.7, 0.04, 0.26, '#d8dce0', 0, 0.84, 0.28));
  return g;
}

export function makeBin(): Group {
  const g = new Group();
  const cuerpo = new Mesh(new CylinderGeometry(0.38, 0.32, 0.9, 12), mat('#6f7680'));
  cuerpo.position.y = 0.45;
  g.add(cuerpo);
  const tapa = new Mesh(new CylinderGeometry(0.42, 0.42, 0.08, 12), mat('#4f555e'));
  tapa.position.y = 0.94;
  g.add(tapa);
  return g;
}

export function makePallet(): Group {
  const g = new Group();
  g.add(box(1.8, 0.06, 1.8, '#a8865a', 0, 0.03, 0));
  for (const z of [-0.6, 0, 0.6]) g.add(box(1.8, 0.12, 0.18, '#8a6b42', 0, 0.12, z));
  return g;
}

/** Caja de cartón del depósito, con el producto estampado. */
export function makeCardboardBox(productId: string): Mesh {
  return new Mesh(boxGeometry(0.8, 0.6, 0.8), new MeshLambertMaterial({ map: boxTexture(productId) }));
}

/** Envase suelto de un producto, el que se ve en la góndola y en la mano. */
export function makeProductMesh(productId: string): Mesh {
  return new Mesh(
    boxGeometry(PRODUCT_W, PRODUCT_H, PRODUCT_D),
    new MeshLambertMaterial({ map: productTexture(productId) }),
  );
}

export interface Character3D {
  root: Group;
  /** Actualiza la caminata y hacia dónde mira. */
  update(dt: number, moving: boolean, heading: number): void;
  /** Objeto donde se cuelga lo que lleva en las manos. */
  hands: Object3D;
}

/**
 * Persona de bloques: cabeza, torso, brazos y piernas.
 * Los brazos y las piernas cuelgan de un pivote en el hombro y la cadera, así
 * la caminata es una rotación y no hay que deformar nada.
 */
export function makeCharacter(look: CharacterLook): Character3D {
  const root = new Group();
  const cuerpo = new Group();
  root.add(cuerpo);
  // Sombra falsa: una mancha en el piso alcanza para que el personaje no
  // parezca flotando, y cuesta mucho menos que calcular sombras de verdad.
  root.add(groundShadow(0.38));

  const piel = look.skin;
  const pelo = look.hair;
  const ropa = look.cloth;
  const delantal = look.apron;
  const pantalon = look.pants;
  const zapatos = look.shoes ?? '#3a3340';

  // Torso y delantal.
  cuerpo.add(box(0.52, 0.62, 0.3, ropa, 0, 1.04, 0));
  cuerpo.add(box(0.38, 0.46, 0.04, delantal, 0, 0.99, 0.16));

  // Cabeza y pelo.
  cuerpo.add(box(0.42, 0.4, 0.4, piel, 0, 1.56, 0));
  cuerpo.add(box(0.46, 0.14, 0.44, pelo, 0, 1.73, 0));
  cuerpo.add(box(0.46, 0.28, 0.08, pelo, 0, 1.6, -0.19));
  // Ojos, para que se note hacia dónde mira.
  for (const x of [-0.1, 0.1]) cuerpo.add(box(0.06, 0.07, 0.03, '#2a2233', x, 1.57, 0.2));

  const brazos: Group[] = [];
  for (const lado of [-1, 1]) {
    const hombro = new Group();
    hombro.position.set(lado * 0.33, 1.3, 0);
    hombro.add(box(0.14, 0.42, 0.16, ropa, 0, -0.21, 0));
    hombro.add(box(0.13, 0.14, 0.15, piel, 0, -0.48, 0));
    cuerpo.add(hombro);
    brazos.push(hombro);
  }

  const piernas: Group[] = [];
  for (const lado of [-1, 1]) {
    const cadera = new Group();
    cadera.position.set(lado * 0.14, 0.73, 0);
    cadera.add(box(0.18, 0.62, 0.2, pantalon, 0, -0.31, 0));
    cadera.add(box(0.2, 0.1, 0.28, zapatos, 0, -0.66, 0.04));
    cuerpo.add(cadera);
    piernas.push(cadera);
  }

  const hands = new Group();
  hands.position.set(0, 1.05, 0.42);
  cuerpo.add(hands);

  let fase = 0;
  let mirada = 0;

  return {
    root,
    hands,
    update(dt: number, moving: boolean, heading: number): void {
      if (moving) fase += dt * 9;
      else fase += (0 - (fase % (Math.PI * 2))) * Math.min(1, dt * 8);

      const swing = moving ? Math.sin(fase) * 0.7 : Math.sin(fase) * 0.02;
      piernas[0].rotation.x = swing;
      piernas[1].rotation.x = -swing;
      brazos[0].rotation.x = -swing * 0.8;
      brazos[1].rotation.x = swing * 0.8;
      // Rebote al caminar.
      cuerpo.position.y = moving ? Math.abs(Math.sin(fase)) * 0.05 : 0;

      // Giro suave hacia donde camina, por el camino más corto.
      let delta = heading - mirada;
      while (delta > Math.PI) delta -= Math.PI * 2;
      while (delta < -Math.PI) delta += Math.PI * 2;
      mirada += delta * Math.min(1, dt * 12);
      root.rotation.y = mirada;
    },
  };
}

/** Mancha oscura en el piso, para apoyar personajes y cajas. */
export function groundShadow(radio: number): Mesh {
  const m = new Mesh(
    new CircleGeometry(radio, 14),
    new MeshBasicMaterial({ color: '#000000', transparent: true, opacity: 0.22, depthWrite: false }),
  );
  m.rotation.x = -Math.PI / 2;
  m.position.y = 0.02;
  return m;
}

/** Convierte una posición del mundo 2D (píxeles) a coordenadas de escena. */
export function toScene(x: number, y: number): { x: number; z: number } {
  return { x: x * PX, z: y * PX };
}
