/**
 * El local en 3D.
 *
 * Se arma a partir del mismo plano de tiles que usa la simulación, así que la
 * vista 3D y la de pixel art muestran exactamente el mismo local: cambia cómo
 * se dibuja, no lo que pasa. Nada de esto decide reglas de juego.
 */

import {
  AmbientLight,
  BoxGeometry,
  DirectionalLight,
  DoubleSide,
  Group,
  HemisphereLight,
  InstancedMesh,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  Object3D,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
  Vector3,
  WebGLRenderer,
} from 'three';
import { TILE } from '../art/tiles';
import { clamp } from '../engine/math';
import type { World } from '../game/world';
import type { StoreSim } from '../game/session';
import type { Customer } from '../game/entities/customer';
import type { Player } from '../game/entities/player';
import type { Viewport } from '../game/render';
import { ceilingTexture, floorTexture, productTexture, signTexture, wallTexture } from './textures';
import {
  PRODUCT_D,
  PRODUCT_H,
  PRODUCT_W,
  PX,
  SLOTS_PER_SHELF,
  UNITS_PER_TILE,
  makeBin,
  makeCardboardBox,
  makeCharacter,
  makeDesk,
  makeGondola,
  makePallet,
  groundShadow,
  makeRegister,
  slotPosition,
  type Character3D,
} from './models';

const WALL_H = 3.3;
/** Altura y distancia de la cámara respecto del personaje. */
const CAM_HEIGHT = 6;
const CAM_BACK = 7.4;
/** Cuánto se mira "hacia adelante": deja al personaje en el tercio de abajo. */
const CAM_LOOK_AHEAD = 2.6;

/** Dueño del contexto WebGL. Uno solo para toda la aplicación. */
export class Renderer3D {
  readonly canvas: HTMLCanvasElement;
  readonly gl: WebGLRenderer;
  private height = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.gl = new WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.gl.setClearColor('#15111f', 1);
    this.gl.setScissorTest(true);
  }

  resize(w: number, h: number, dpr: number): void {
    this.height = h;
    this.gl.setPixelRatio(dpr);
    this.gl.setSize(w, h, false);
  }

  clear(): void {
    this.gl.setScissorTest(false);
    this.gl.clear(true, true, true);
    this.gl.setScissorTest(true);
  }

  /** Dibuja una escena en una mitad de la pantalla. */
  renderViewport(scene: Scene, camera: PerspectiveCamera, vp: Viewport): void {
    // WebGL cuenta la Y desde abajo; los viewports del juego, desde arriba.
    const y = this.height - (vp.y + vp.h);
    this.gl.setViewport(vp.x, y, vp.w, vp.h);
    this.gl.setScissor(vp.x, y, vp.w, vp.h);
    camera.aspect = vp.w / Math.max(1, vp.h);
    camera.updateProjectionMatrix();
    this.gl.render(scene, camera);
  }
}

interface ShelfView {
  group: Group;
  /** Una sola malla instanciada por góndola: 24 envases con un solo draw call. */
  instances: InstancedMesh<BoxGeometry, MeshLambertMaterial> | null;
  productId: string | null;
  units: number;
}

const _v = new Vector3();
const _obj = new Object3D();

export class StoreScene3D {
  readonly scene = new Scene();
  private readonly sim: StoreSim;
  private readonly world: World;
  private shelves: ShelfView[] = [];
  private customers = new Map<number, { char: Character3D; lastX: number; lastY: number; heading: number }>();
  private players = new Map<number, { char: Character3D; lastX: number; lastY: number; heading: number; carried: Mesh | null }>();
  private floorBoxes = new Map<number, Mesh>();
  private cameras: PerspectiveCamera[] = [];
  private productGeometry = new BoxGeometry(PRODUCT_W, PRODUCT_H, PRODUCT_D);
  private anchoU = 0;
  private largoU = 0;

  constructor(sim: StoreSim) {
    this.sim = sim;
    this.world = sim.world;
    this.buildStatic();
  }

  // --- Construcción ---

  private buildStatic(): void {
    const w = this.world;
    const def = w.def;
    const anchoU = w.cols * UNITS_PER_TILE;
    const largoU = w.rows * UNITS_PER_TILE;
    this.anchoU = anchoU;
    this.largoU = largoU;

    // Explanada alrededor del local: sin esto, al asomarse la cámara por el
    // borde se veía el vacío negro detrás de las paredes.
    const afuera = new Mesh(
      new PlaneGeometry(anchoU + 80, largoU + 80),
      new MeshLambertMaterial({ color: '#3a3547' }),
    );
    afuera.rotation.x = -Math.PI / 2;
    afuera.position.set(anchoU / 2, -0.05, largoU / 2);
    this.scene.add(afuera);

    // Luz pareja de supermercado, pero con algo de contraste para que los
    // envases no queden lavados.
    this.scene.add(new HemisphereLight('#ffffff', '#8f887c', 1.5));
    this.scene.add(new AmbientLight('#ffffff', 0.22));
    const sol = new DirectionalLight('#fff6e8', 0.85);
    sol.position.set(anchoU * 0.3, 18, largoU * 0.8);
    this.scene.add(sol);

    // Piso.
    const piso = new Mesh(
      new PlaneGeometry(anchoU, largoU),
      new MeshLambertMaterial({ map: floorTexture(def.floorPal[1] ?? '#eee6d6', def.floorPal.D ?? '#ccc4b4', [w.cols, w.rows]) }),
    );
    piso.rotation.x = -Math.PI / 2;
    piso.position.set(anchoU / 2, 0, largoU / 2);
    this.scene.add(piso);

    // Cielorraso y luminarias: planos mirando hacia abajo, así la cámara
    // (que está más arriba) los atraviesa sin verlos.
    const cielo = new Mesh(
      new PlaneGeometry(anchoU, largoU),
      new MeshLambertMaterial({ map: ceilingTexture([w.cols, w.rows]) }),
    );
    cielo.rotation.x = Math.PI / 2;
    cielo.position.set(anchoU / 2, WALL_H, largoU / 2);
    this.scene.add(cielo);

    // Luminarias del techo, también mirando hacia abajo.
    for (let z = 5; z < largoU - 3; z += 7) {
      for (let x = 5; x < anchoU - 3; x += 8) {
        const panel = new Mesh(new PlaneGeometry(3.4, 0.7), new MeshBasicMaterial({ color: '#fffdf5' }));
        panel.rotation.x = Math.PI / 2;
        panel.position.set(x, WALL_H - 0.04, z);
        this.scene.add(panel);
      }
    }

    this.buildWalls(anchoU, largoU, def.wallPal[1] ?? '#f4f6f8', def.accent);
    this.buildFurniture();
    this.buildDecorShelves(anchoU, largoU);
    this.buildSign(anchoU, def);
  }

  private buildWalls(anchoU: number, largoU: number, color: string, trim: string): void {
    const texH = wallTexture(color, trim, [Math.round(anchoU / 3), 1]);
    const texV = wallTexture(color, trim, [Math.round(largoU / 3), 1]);

    // Cada pared es un plano que mira hacia adentro: vista desde afuera
    // desaparece, y por eso la pared de adelante nunca tapa el local.
    const norte = new Mesh(new PlaneGeometry(anchoU, WALL_H), new MeshLambertMaterial({ map: texH }));
    norte.position.set(anchoU / 2, WALL_H / 2, 0);
    this.scene.add(norte);

    const oeste = new Mesh(new PlaneGeometry(largoU, WALL_H), new MeshLambertMaterial({ map: texV }));
    oeste.rotation.y = Math.PI / 2;
    oeste.position.set(0, WALL_H / 2, largoU / 2);
    this.scene.add(oeste);

    const este = new Mesh(new PlaneGeometry(largoU, WALL_H), new MeshLambertMaterial({ map: texV }));
    este.rotation.y = -Math.PI / 2;
    este.position.set(anchoU, WALL_H / 2, largoU / 2);
    this.scene.add(este);

    // Pared sur con el hueco de la entrada.
    const puerta = this.world.entrance;
    const desdeX = puerta.length ? Math.min(...puerta.map((p) => p.x)) * PX - UNITS_PER_TILE / 2 : anchoU / 2;
    const hastaX = puerta.length ? Math.max(...puerta.map((p) => p.x)) * PX + UNITS_PER_TILE / 2 : anchoU / 2;

    for (const [x0, x1] of [[0, desdeX], [hastaX, anchoU]] as const) {
      const ancho = x1 - x0;
      if (ancho <= 0.01) continue;
      const muro = new Mesh(
        new PlaneGeometry(ancho, WALL_H),
        new MeshLambertMaterial({ map: wallTexture(color, trim, [Math.max(1, Math.round(ancho / 3)), 1]) }),
      );
      muro.rotation.y = Math.PI;
      muro.position.set(x0 + ancho / 2, WALL_H / 2, largoU);
      this.scene.add(muro);
    }

    // Marco de la puerta, para que la entrada se lea.
    const marco = new Mesh(new BoxGeometry(hastaX - desdeX + 0.3, 0.35, 0.3), new MeshLambertMaterial({ color: trim }));
    marco.position.set((desdeX + hastaX) / 2, WALL_H - 0.4, largoU - 0.1);
    this.scene.add(marco);
    const felpudo = new Mesh(new PlaneGeometry(hastaX - desdeX, 1.6), new MeshLambertMaterial({ color: trim }));
    felpudo.rotation.x = -Math.PI / 2;
    felpudo.position.set((desdeX + hastaX) / 2, 0.02, largoU - 1.1);
    this.scene.add(felpudo);
  }

  private buildFurniture(): void {
    const def = this.world.def;
    const cuerpo = def.shelfPal[1] ?? '#dde2e8';
    const detalle = def.shelfPal[2] ?? '#4a86c8';
    const estante = def.shelfPal[3] ?? '#e8e2d2';

    for (const shelf of this.world.shelves) {
      const g = makeGondola(cuerpo, estante, detalle);
      const p = this.toScene(shelf.x, shelf.y);
      g.position.set(p.x, 0, p.z);
      this.scene.add(g);
      this.shelves.push({ group: g, instances: null, productId: null, units: 0 });
    }

    for (const reg of this.world.registers) {
      const g = makeRegister(cuerpo, estante);
      const p = this.toScene(reg.x, reg.y);
      g.position.set(p.x, 0, p.z);
      this.scene.add(g);
    }

    if (this.world.computer) {
      const g = makeDesk();
      const p = this.toScene(this.world.computer.x, this.world.computer.y);
      g.position.set(p.x, 0, p.z);
      this.scene.add(g);
    }

    if (this.world.bin) {
      const g = makeBin();
      const p = this.toScene(this.world.bin.x, this.world.bin.y);
      g.position.set(p.x, 0, p.z);
      this.scene.add(g);
    }

    // Un pallet por bloque de depósito, no uno por tile.
    const vistos = new Set<string>();
    for (const spot of this.world.storage) {
      const tx = Math.floor(spot.x / TILE);
      const ty = Math.floor(spot.y / TILE);
      const key = `${Math.floor(tx / 2)},${Math.floor(ty / 2)}`;
      if (vistos.has(key)) continue;
      vistos.add(key);
      const g = makePallet();
      const p = this.toScene(spot.x, spot.y);
      g.position.set(p.x, 0, p.z);
      this.scene.add(g);
    }

    // Plantas en los rincones de la zona de clientes.
    for (const tx of [1, this.world.cols - 2]) {
      const ty = this.world.rows - 3;
      if (!this.world.walkable(tx, ty)) continue;
      const maceta = new Mesh(new BoxGeometry(0.5, 0.45, 0.5), new MeshLambertMaterial({ color: '#c9713f' }));
      const hojas = new Mesh(new BoxGeometry(0.8, 0.9, 0.8), new MeshLambertMaterial({ color: '#4faa5a' }));
      maceta.position.set(0, 0.22, 0);
      hojas.position.set(0, 0.9, 0);
      const g = new Group();
      g.add(maceta, hojas);
      g.position.set((tx + 0.5) * UNITS_PER_TILE, 0, (ty + 0.5) * UNITS_PER_TILE);
      this.scene.add(g);
    }
  }

  private buildSign(anchoU: number, def: World['def']): void {
    // Con transparencia: si no, las esquinas redondeadas del cartel se
    // dibujarían como un recuadro negro.
    const cartel = new Mesh(
      new PlaneGeometry(6, 1.5),
      new MeshBasicMaterial({
        map: signTexture(def.name, def.accent),
        side: DoubleSide,
        transparent: true,
        alphaTest: 0.5,
      }),
    );
    cartel.position.set(anchoU / 2, WALL_H - 0.85, 0.06);
    this.scene.add(cartel);
  }

  /**
   * Estanterías decorativas pegadas a las paredes.
   *
   * Van dentro de la franja de tiles de pared, que nadie puede pisar, así que
   * llenan el local como en un supermercado de verdad sin tocar las colisiones
   * ni la simulación. Están siempre llenas: son escenografía, no stock.
   */
  private buildDecorShelves(anchoU: number, largoU: number): void {
    const def = this.world.def;
    const cuerpo = def.shelfPal[1] ?? '#dde2e8';
    const detalle = def.shelfPal[2] ?? '#4a86c8';
    const estante = def.shelfPal[3] ?? '#e8e2d2';
    const catalogo = def.products;
    let n = 0;

    const poner = (x: number, z: number, rotacion: number): void => {
      const g = makeGondola(cuerpo, estante, detalle);
      g.position.set(x, 0, z);
      g.rotation.y = rotacion;
      const id = catalogo[n % catalogo.length];
      n++;
      const malla = new InstancedMesh<BoxGeometry, MeshLambertMaterial>(
        this.productGeometry,
        new MeshLambertMaterial({ map: productTexture(id) }),
        SLOTS_PER_SHELF,
      );
      for (let i = 0; i < SLOTS_PER_SHELF; i++) {
        const pos = slotPosition(i);
        _obj.position.set(pos.x, pos.y, pos.z);
        _obj.rotation.set(0, pos.z > 0 ? 0 : Math.PI, 0);
        _obj.updateMatrix();
        malla.setMatrixAt(i, _obj.matrix);
      }
      malla.instanceMatrix.needsUpdate = true;
      g.add(malla);
      this.scene.add(g);
    };

    // Pared del fondo, dejando libre el centro para que se lea el cartel.
    for (let x = 3; x < anchoU - 2; x += UNITS_PER_TILE) {
      if (Math.abs(x - anchoU / 2) < 3.5) continue;
      poner(x, 1, 0);
    }
    // Paredes laterales, sólo en la mitad de arriba: abajo están la caja,
    // el depósito y la puerta, y taparlos confundiría.
    for (let z = 3; z < largoU * 0.6; z += UNITS_PER_TILE) {
      poner(1, z, Math.PI / 2);
      poner(anchoU - 1, z, Math.PI / 2);
    }
  }

  private toScene(x: number, y: number): { x: number; z: number } {
    return { x: x * PX, z: y * PX };
  }

  // --- Actualización por frame ---

  update(dt: number): void {
    this.syncShelves();
    this.syncCharacters(dt);
    this.syncBoxes();
  }

  private syncShelves(): void {
    this.world.shelves.forEach((shelf, i) => {
      const view = this.shelves[i];
      if (!view) return;
      const visibles = Math.min(shelf.units, SLOTS_PER_SHELF);

      if (view.productId !== shelf.productId) {
        if (view.instances) {
          view.group.remove(view.instances);
          view.instances.material.dispose();
          view.instances.dispose();
          view.instances = null;
        }
        view.productId = shelf.productId;
        if (shelf.productId) {
          const malla = new InstancedMesh<BoxGeometry, MeshLambertMaterial>(
            this.productGeometry,
            new MeshLambertMaterial({ map: productTexture(shelf.productId) }),
            SLOTS_PER_SHELF,
          );
          // Las posiciones son fijas; después sólo cambia cuántas se dibujan.
          for (let s = 0; s < SLOTS_PER_SHELF; s++) {
            const pos = slotPosition(s);
            _obj.position.set(pos.x, pos.y, pos.z);
            _obj.rotation.set(0, pos.z > 0 ? 0 : Math.PI, 0);
            _obj.updateMatrix();
            malla.setMatrixAt(s, _obj.matrix);
          }
          malla.instanceMatrix.needsUpdate = true;
          view.group.add(malla);
          view.instances = malla;
        }
      }

      if (view.instances && view.units !== visibles) {
        view.instances.count = visibles;
        view.units = visibles;
      }
    });
  }

  private syncCharacters(dt: number): void {
    // Jugadores.
    for (const player of this.sim.players) {
      let entrada = this.players.get(player.index);
      if (!entrada) {
        const char = makeCharacter(player.look);
        this.scene.add(char.root);
        entrada = { char, lastX: player.pos.x, lastY: player.pos.y, heading: Math.PI, carried: null };
        this.players.set(player.index, entrada);
      }
      this.moveCharacter(entrada, player.pos.x, player.pos.y, player.moving, dt);
      this.syncCarried(entrada, player);
    }

    // Clientes: se crean y se borran a medida que entran y salen.
    const vivos = new Set<number>();
    for (const c of this.sim.customers) {
      vivos.add(c.id);
      let entrada = this.customers.get(c.id);
      if (!entrada) {
        const char = makeCharacter(c.look);
        this.scene.add(char.root);
        entrada = { char, lastX: c.pos.x, lastY: c.pos.y, heading: Math.PI };
        this.customers.set(c.id, entrada);
      }
      this.moveCharacter(entrada, c.pos.x, c.pos.y, c.moving, dt);
      this.syncBasket(entrada, c);
    }
    for (const [id, entrada] of this.customers) {
      if (vivos.has(id)) continue;
      this.scene.remove(entrada.char.root);
      this.customers.delete(id);
    }
  }

  private moveCharacter(
    entrada: { char: Character3D; lastX: number; lastY: number; heading: number },
    x: number,
    y: number,
    moving: boolean,
    dt: number,
  ): void {
    const p = this.toScene(x, y);
    entrada.char.root.position.set(p.x, 0, p.z);
    const dx = x - entrada.lastX;
    const dy = y - entrada.lastY;
    if (Math.hypot(dx, dy) > 0.05) {
      entrada.heading = Math.atan2(dx, dy);
    }
    entrada.lastX = x;
    entrada.lastY = y;
    entrada.char.update(dt, moving, entrada.heading);
  }

  private syncCarried(entrada: { char: Character3D; carried: Mesh | null }, player: Player): void {
    const llevando = player.carrying?.productId ?? null;
    const actual = entrada.carried?.userData.productId ?? null;
    if (llevando === actual) return;
    if (entrada.carried) {
      entrada.char.hands.remove(entrada.carried);
      entrada.carried = null;
    }
    if (llevando) {
      const caja = makeCardboardBox(llevando);
      caja.userData.productId = llevando;
      caja.position.set(0, 0.1, 0.1);
      entrada.char.hands.add(caja);
      entrada.carried = caja;
    }
  }

  /** El cliente lleva en la mano lo último que sacó de la góndola. */
  private syncBasket(entrada: { char: Character3D }, customer: Customer): void {
    const ultimo = customer.cart.length > 0 ? customer.cart[customer.cart.length - 1].productId : null;
    const actual = (entrada.char.hands.children[0] as Mesh | undefined)?.userData.productId ?? null;
    if (ultimo === actual) return;
    entrada.char.hands.clear();
    if (ultimo) {
      const m = new Mesh(this.productGeometry, new MeshLambertMaterial({ map: productTexture(ultimo) }));
      m.userData.productId = ultimo;
      m.position.set(0.18, -0.1, 0);
      entrada.char.hands.add(m);
    }
  }

  private syncBoxes(): void {
    const vivas = new Set<number>();
    for (const caja of this.world.boxes) {
      if (caja.carriedBy !== null) continue;
      vivas.add(caja.id);
      let malla = this.floorBoxes.get(caja.id);
      if (!malla) {
        malla = makeCardboardBox(caja.productId);
        const sombra = groundShadow(0.45);
        sombra.position.y = -0.38;
        malla.add(sombra);
        this.scene.add(malla);
        this.floorBoxes.set(caja.id, malla);
      }
      const p = this.toScene(caja.x, caja.y);
      malla.position.set(p.x, 0.4, p.z);
    }
    for (const [id, malla] of this.floorBoxes) {
      if (vivas.has(id)) continue;
      this.scene.remove(malla);
      this.floorBoxes.delete(id);
    }
  }

  // --- Cámara y proyección ---

  /** Cámara que sigue al jugador desde atrás y arriba. */
  cameraFor(index: number, focus: { x: number; y: number }, vp: Viewport): PerspectiveCamera {
    let cam = this.cameras[index];
    if (!cam) {
      cam = new PerspectiveCamera(50, 1, 0.5, 200);
      this.cameras[index] = cam;
    }
    const p = this.toScene(focus.x, focus.y);
    // En pantalla partida la vista es más angosta: alejamos para compensar.
    const aspecto = vp.w / Math.max(1, vp.h);
    const alejar = clamp(1.35 - aspecto * 0.22, 1, 1.5);

    // La cámara no pasa de los bordes del local: si el jugador camina contra
    // una pared, se corre él en la pantalla y no la vista hacia afuera.
    const distancia = Math.hypot(CAM_HEIGHT, CAM_BACK) * alejar;
    const medioAlto = distancia * Math.tan(((cam.fov * Math.PI) / 180) / 2);
    const medioAncho = medioAlto * aspecto;
    const margenX = Math.min(medioAncho * 0.72, this.anchoU / 2);
    const margenZ = Math.min(medioAlto * 0.72, this.largoU / 2);
    const fx = clamp(p.x, margenX, this.anchoU - margenX);
    const fz = clamp(p.z, margenZ, this.largoU - margenZ);

    cam.position.set(fx, CAM_HEIGHT * alejar, fz + CAM_BACK * alejar);
    cam.lookAt(fx, 1.2, fz - CAM_LOOK_AHEAD);
    cam.updateMatrixWorld();
    return cam;
  }

  /**
   * Pasa un punto del mundo 2D a coordenadas de pantalla, para poder dibujar
   * encima los carteles, los precios y las barras de paciencia con el canvas 2D.
   */
  project(cam: PerspectiveCamera, x: number, y: number, altura: number, vp: Viewport): { x: number; y: number; visible: boolean } {
    const p = this.toScene(x, y);
    _v.set(p.x, altura, p.z).project(cam);
    return {
      x: vp.x + ((_v.x + 1) / 2) * vp.w,
      y: vp.y + ((1 - _v.y) / 2) * vp.h,
      visible: _v.z < 1,
    };
  }

  /**
   * Suelta lo que es propio de este local. Las geometrías y los materiales
   * básicos se comparten entre locales, así que no se descartan acá.
   */
  dispose(): void {
    for (const view of this.shelves) {
      if (!view.instances) continue;
      view.instances.material.dispose();
      view.instances.dispose();
    }
    this.shelves = [];
    this.customers.clear();
    this.players.clear();
    this.floorBoxes.clear();
    this.scene.clear();
    this.productGeometry.dispose();
  }
}
