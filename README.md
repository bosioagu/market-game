# Mía & Kiki Market

Juego de tienda para PC y celular. Comprás mercadería al mayorista, le ponés
precio, reponés las góndolas y cobrás en la caja. Se juega solo o de a dos en
**pantalla dividida**, y se puede ver de dos maneras: **local en 3D** (la que
viene puesta) o **pixel art** en vista cenital.

> La idea original es de Mía: *"un juego donde tenés que rellenar una tienda de
> algo, y cuando subís de nivel vas a otra tienda, y la pantalla se divide para
> que podamos jugar los dos: uno con WASD y otro con las flechas."*

## Cómo se juega

El día dura poco más de dos minutos y medio y va de las 08:00 a las 20:00.

1. **Comprá.** Andá a la computadora del local y pedí cajas al mayorista. Cada
   caja trae varias unidades y se paga por adelantado.
2. **Poné precios.** En la pestaña *Precios* fijás cuánto cobrás por cada
   producto. El juego te muestra el costo y el precio de mercado: si te pasás
   mucho, la gente lo deja en la góndola y se va enojada; si cobrás menos que el
   costo, perdés plata en cada venta.
3. **Reponé.** Levantá una caja del depósito, llevala a una góndola y mantené el
   botón de acción. Una góndola vacía no vende nada, y si hay poca variedad
   entra menos gente al local.
4. **Cobrá.** Los clientes agarran lo que quieren y hacen la fila en la caja.
   Parate detrás y apretá el botón: una vez por producto para pasarlo y una más
   para cobrar. Cuanta más paciencia les quede, más propina dejan.
5. **Cerrá el día.** Se paga el alquiler y se hace la cuenta. Con lo que ganás
   subís de nivel y se abren tiendas nuevas.

Lo que más rinde es no quedarte sin stock: cada cliente que se va sin comprar te
baja la fama, y con menos fama viene menos gente al día siguiente.

### Las seis tiendas

| Nivel | Tienda | Detalle |
|-------|--------|---------|
| 1  | Pizzería | La primera. Pocos productos, alquiler barato. |
| 3  | Heladería | Más rotación y clientes más apurados. |
| 5  | Panadería | Las tortas dejan mucho margen pero vienen de a dos por caja. |
| 8  | Supermercado | Local grande, diez productos, mucha gente. |
| 12 | Tienda de ropa | Pocas ventas, cada una vale el triple. |
| 16 | Juguetería | La última: precios altos y clientes exigentes. |

### Modos

- **Un jugador** — tu carrera: la plata, el nivel y las tiendas desbloqueadas se
  guardan en el navegador.
- **Dos en equipo (co-op)** — la misma tienda en pantalla dividida. Lo más
  cómodo es que uno se quede en la caja y el otro reponga.
- **Dos compitiendo (versus)** — una tienda para cada uno, la misma plata
  inicial, y gana quien cierre el día con más caja. No toca la partida guardada.

## Controles

**Jugando solo** los dos teclados manejan al mismo personaje: `W` `A` `S` `D` o
las flechas, indistintamente, y `Espacio` o `Enter` para la acción.

**De a dos** cada uno tiene el suyo:

| | Jugador 1 | Jugador 2 |
|---|---|---|
| Moverse | `W` `A` `S` `D` | flechas |
| Acción (levantar, reponer, cobrar) | `Espacio`, `E` o `F` | `Enter` o `Ctrl` derecho |
| Soltar la caja / salir de un menú | `Q` o `Shift` izquierdo | `Shift` derecho o `/` |

- **Pausa:** `Esc` o `P`. **Silenciar:** `M` en el menú.
- **Cambiar de vista (3D / pixel art):** `V` mientras jugás, o desde la pausa.
- **Joystick:** si conectás uno o dos mandos, andan solos (stick o cruceta,
  botón A para acción y B para soltar).
- **Celular:** aparecen un joystick virtual y los botones al tocar la pantalla.
  Cada jugador maneja su mitad. La palanca aparece donde apoyás el dedo.

## Correrlo

```bash
npm install
npm run dev        # servidor de desarrollo (http://localhost:5173)
npm run build      # chequeo de tipos + build de producción en dist/
npm run preview    # servir el build
npm run typecheck  # sólo chequeo de tipos
```

El build entero pesa unos 30 KB comprimidos y no pide nada a la red mientras se
juega: todo el arte, la tipografía y la música se generan por código.

### Prueba automática

`npm run smoke` abre el juego en Chromium, lo juega solo (compra, repone, cobra,
prueba las dos pantallas divididas en PC y en celular) y saca capturas. Falla si
hay errores de consola o si el circuito de venta se rompe.

```bash
npm run build
npx vite preview --port 4180 &
SHOTS=./capturas URL=http://localhost:4180 npm run smoke
```

### Celular como app nativa

El juego ya funciona desde el navegador del celular y se puede "agregar a la
pantalla de inicio". Para generar una app nativa con Capacitor:

```bash
npm run build
npx cap add android      # o: npx cap add ios
npm run mobile:android   # build + sync + abre Android Studio
```

Hace falta Android Studio (o Xcode para iOS) instalado en la máquina.

## Cómo está armado el código

Sin motor de juego ni assets binarios: todo es TypeScript y un `<canvas>`.

```
src/
  engine/      motor: bucle, entrada, audio, sprites, tipografía, matemática
    pixel.ts     convierte arte escrito como texto en sprites
    font.ts      tipografía bitmap 5x8 dibujada a mano, con acentos y eñe
    audio.ts     efectos y música chiptune sintetizados con WebAudio
    input.ts     teclado, joystick y táctil unificados en "pads"
  art/         el arte 2D, escrito como filas de texto
    chars.ts     personajes (una plantilla + colores por personaje)
    items.ts     íconos de productos de 12x12
    stations.ts  muebles del local de 16x22
    tiles.ts     piso, paredes, mostrador, decoración
  game/
    data/        catálogo de productos y definición de las tiendas
    world.ts     grilla del local, colisiones y navegación de clientes
    session.ts   la simulación: clientes, caja, stock, plata
    render.ts    vista de pixel art, con cámara y orden por profundidad
    hud.ts       marcadores en pantalla
    progress.ts  partida guardada y mejoras
  game3d/      vista 3D (three.js)
    textures.ts  piso, paredes y envases generados en un canvas
    models.ts    góndolas, cajas, personajes: todo con primitivas
    scene3d.ts   arma el local desde el mismo plano de tiles y lo dibuja
    overlay3d.ts carteles del mundo proyectados sobre la escena
  ui/          computadora del local, paneles, controles táctiles
  scenes/      título, menú, día de trabajo y cierre
```

Tres decisiones que explican casi todo lo demás:

- **El arte se escribe como texto.** Cada sprite es una lista de filas donde cada
  letra es un color de la paleta (`src/art/`). Se puede editar en cualquier
  editor, se ve en el diff de git, y sirve para recolorear: una misma pizza se
  usa cruda, cocida o quemada, y un mismo personaje sale distinto en cada
  cliente cambiando cinco colores.
- **Los clientes navegan con un campo de distancias.** Por cada destino se
  calcula un BFS sobre los tiles caminables y se cachea (`World.flowField`). En
  locales de 24x16 tiles es instantáneo y permite muchos clientes a la vez.
- **La simulación no sabe nada de cómo se dibuja.** Todo pasa en la grilla de
  tiles de `world.ts`; la vista de pixel art y la de 3D son dos lectores de ese
  mismo estado. Por eso se puede cambiar de una a otra en mitad de un día sin
  que se mueva un solo cliente, y por eso agregar una tienda no toca el 3D.

### Agregar cosas

- **Un producto nuevo:** una línea en `src/game/data/products.ts` (forma, colores,
  costo, precio de mercado y unidades por caja) y agregarlo al catálogo de la
  tienda en `src/game/data/stores.ts`.
- **Una tienda nueva:** una entrada en `STORES` con su plano, su mueble de
  exhibición, su paleta y su lista de productos. Los planos son dibujos en texto
  arriba del mismo archivo.
- **Un dibujo nuevo:** una entrada en `src/art/items.ts` con 12 filas de 12
  caracteres.

### Sobre la vista 3D

El local, los muebles, los envases y los personajes se generan con código: cajas
y cilindros de three.js, y texturas dibujadas en un canvas que reusan los mismos
íconos de pixel art. No hay modelos ni imágenes importadas, así que el juego
sigue siendo un solo archivo y arranca al instante.

Eso también marca el límite: los personajes son estilizados, de bloques. Para
personajes realistas como los de un simulador comercial harían falta modelos 3D
con esqueleto y animaciones, que son archivos de arte comprados aparte.

Las góndolas pegadas a las paredes son decorado: ocupan la franja de tiles de
pared, por donde nadie camina, así que llenan el local sin cambiar en nada la
simulación.

## Qué falta / ideas para seguir

- Empleados que repongan o cobren solos, a cambio de sueldo.
- Clientes que roban si no mirás la caja.
- Ofertas y días especiales (fin de semana, lluvia).
- Decorar el local con muebles comprados.
- Cámara en primera persona, además de la de tercera.
