# Dino Refugio

Juego web para conocer dinosaurios criándolos. Excavas fósiles en yacimientos
reales, recuperas su ADN, incubas huevos, cuidas a las crías hasta que crecen,
las cruzas para obtener colores y variantes raras, y aprendes datos verificados
de 41 especies del Triásico, el Jurásico y el Cretácico (tres de ellas con su
color real, reconstruido a partir de pigmentos fosilizados).

Funciona en el navegador del móvil y de la computadora. No usa dependencias ni
paso de compilación: HTML, CSS y JavaScript con módulos ES.

Los dinosaurios son modelos 3D que el juego genera en el navegador (WebGL2,
motor propio): escamas con relieve, plumas, membranas translúcidas, sombras y
un visor que se gira con el dedo. Caminan en el parque y, si los tocas, rugen
abriendo la boca. Si el dispositivo no tiene WebGL2, o se apaga
en Más → Ajustes, se usa el dibujo vectorial.

## Cómo jugar

1. **Elige tu primer huevo** (herbívoro, omnívoro o carnívoro).
2. **Cuida a la cría** en el Parque: aliméntala con la comida de su dieta,
   acaríciala y juega con ella. Cuando aparece una burbuja sobre su cabeza,
   atender lo que pide sube el **vínculo**, que mejora sus estadísticas.
3. **Excava** en yacimientos reales (Hell Creek, Formación Morrison, desierto de
   Gobi, Patagonia…). El pico rompe roca rápido pero puede dañar huesos; la
   brocha es lenta pero segura.
4. Con **50 % del genoma** de una especie, **sintetiza un huevo** en el Criadero.
5. **Cruza** un macho y una hembra adultos. El cuadro de Punnett te dice qué
   patrones y variantes (albino, melanístico, leucístico) pueden salir.
6. Gana monedas con los **visitantes**, los **concursos** y el **quiz**, y úsalas
   para construir recintos, comprar comida y enriquecimiento.
7. **Vuelve cada día**: regalo diario con racha de 7 días (y escudos que la
   protegen), 3 misiones de hoy, un envío gratis cada 4 horas, cofres con
   premios sorpresa, accesorios para tus dinosaurios, la taquilla de visitantes
   que hay que cobrar, regalos que dejan tus dinosaurios felices, combos de
   cuidado, un bonus distinto cada día de la semana y un yacimiento con ADN
   doble cada semana. La energía de expedición (⚡) se recarga sola.
8. **Entrena** a tus adultos para los concursos (no se hereda: solo los genes
   pasan a las crías), compra accesorios y saca una **postal** de tus
   dinosaurios para compartirla.
9. Sal de **expedición**: supera obstáculos, enfrenta dinosaurios salvajes por
   turnos o amánsalos con su comida favorita, y retírate a tiempo con el botín.
10. Completa la **Dinopedia**: cada ficha trae significado del nombre,
   pronunciación, periodo, tamaño comparado con una persona, quién lo descubrió,
   datos curiosos y "mito vs. realidad".

## Ejecutar en local

Hace falta Node.js 18 o superior (o cualquier servidor estático).

```bash
npm start            # http://localhost:5173
```

Los módulos ES no funcionan abriendo `index.html` con doble clic (`file://`);
usa el servidor incluido o GitHub Pages.

## Jugar en la web e instalar como app

**1. Publicar la página (una sola vez).** En GitHub: *Settings → Pages →
Build and deployment → Source: Deploy from a branch*. Elige la rama `main`
(o `feature/dino-refugio` mientras el PR no esté mezclado), carpeta `/ (root)`,
y pulsa *Save*. En uno o dos minutos el juego queda en:

https://yazterfranco.github.io/dinosaurs/

**2. Instalar como app.** Abre esa dirección en el celular:

- **Android (Chrome):** aparece *Instalar app*, o usa el menú ⋮ → *Instalar app*.
- **iPhone (Safari):** botón *Compartir* → *Agregar a inicio*.
- **Computadora (Chrome/Edge):** ícono de instalar en la barra de direcciones.

También hay un botón **📲 Instalar como app** en *Más* y en *Ajustes*. La app
instalada abre a pantalla completa y funciona sin internet. En iPhone la app
y Safari guardan partidas separadas: usa el código de guardado de *Ajustes*
para pasarla.

## Pruebas

```bash
npm test             # pruebas unitarias (node:test): genética, cuidado, cría, excavación, datos, modelos 3D
npm install          # instala @playwright/test
npx playwright install chromium
npm run test:e2e     # pruebas E2E en móvil (Pixel 7) y escritorio
```

Para revisar el ritmo del juego después de cambiar números:

```bash
node scripts/simular-economia.mjs 14 20   # 14 días, 20 minutos por día
```

Las pruebas de datos verifican, por ejemplo, que cada especie aparece en un
yacimiento de su mismo periodo y que su comida favorita respeta su dieta.

## Estructura

```
index.html               Interfaz principal
css/styles.css           Estilos (móvil primero)
js/main.js               Arranque, rutas, bucle de juego, HUD
js/data/                 Dinopedia (species.js), mundo y tienda (world.js), quiz, accesorios
js/systems/              Lógica pura y probada: game, genetics, dig, contest, missions,
                         rewards (energía, racha, cofres, regalos), calendar
js/render/dino-svg.js    Ilustración paramétrica de dinosaurios y huevos (respaldo instantáneo)
js/render/art.js         Elige entre 3D y dibujo, y cambia uno por otro sin que se note
js/render3d/             Motor 3D: modelos procedurales (model.js), geometría,
                         texturas, sombreadores WebGL2 (gl.js), accesorios,
                         imágenes en caché y visor giratorio (index.js)
js/ui/views/             Pantallas: parque, criadero, excavar, dinopedia, más, quiz, concursos
docs/GDD.md              Documento de diseño y referencias
dev/gallery.html         Galería de todas las especies (útil al ajustar el dibujo)
dev/gallery3d.html       Galería 3D (?only=, stage=, acc=, viewer=1, size=lg...)
scripts/                 Servidor local, simulación de economía y generador de íconos
sw.js, manifest.webmanifest  App instalable y modo sin conexión
tests/                   Unitarias y E2E
```

## Referencias

- Jugabilidad: *Jurassic World Evolution 2* (expediciones, genoma, comodidad),
  *ARK* (impronta y mutaciones), *Prehistoric Kingdom* (variantes genéticas),
  *Tamagotchi* (cuidado), mina subterránea de *Pokémon* (excavación por capas).
- Retención: rachas y escudos de Duolingo, regalos sin castigo de *Neko Atsume*,
  energía de *Jurassic World Alive*. Sin pagos ni anuncios.
- Diseño: *Alba: A Wildlife Adventure* y las fichas de la *Dino Directory* del
  Natural History Museum de Londres. Paleoarte actualizado (labios en terópodos,
  plumas, color real conocido).
- Dibujo de los dinosaurios: sombreado ilustrativo de *Team Fortress 2*
  (sombras frías, luz de contorno), proceso de paleoarte para videojuegos,
  *Jurassic World Evolution 2* y *Prehistoric Kingdom*. Detalles en
  `docs/GDD.md`, sección 4.
- 3D: piel "carnosa" y membranas a contraluz como en *Jurassic World
  Evolution 3*, dispersión subsuperficial (*GPU Gems*), plumas por capas,
  curva de tono ACES y hallazgos de 2025 (pezuñas y cresta de las "momias" de
  *Edmontosaurus*, moteado de crías de *Diplodocus*). Detalles en
  `docs/GDD.md`, sección 4.1.

Las medidas de los animales son estimaciones promedio de la literatura. Los
colores son imaginados, como en cualquier reconstrucción paleontológica, salvo
en las especies cuyo color real se conoce por sus fósiles.
