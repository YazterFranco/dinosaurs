# Dino Refugio

Juego web para conocer dinosaurios criándolos. Excavas fósiles en yacimientos
reales, recuperas su ADN, incubas huevos, cuidas a las crías hasta que crecen,
las cruzas para obtener colores y variantes raras, y aprendes datos verificados
de 41 especies del Triásico, el Jurásico y el Cretácico (tres de ellas con su
color real, reconstruido a partir de pigmentos fosilizados).

Funciona en el navegador del móvil y de la computadora. No usa dependencias ni
paso de compilación: HTML, CSS y JavaScript con módulos ES.

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
9. Completa la **Dinopedia**: cada ficha trae significado del nombre,
   pronunciación, periodo, tamaño comparado con una persona, quién lo descubrió,
   datos curiosos y "mito vs. realidad".

## Ejecutar en local

Hace falta Node.js 18 o superior (o cualquier servidor estático).

```bash
npm start            # http://localhost:5173
```

Los módulos ES no funcionan abriendo `index.html` con doble clic (`file://`);
usa el servidor incluido o GitHub Pages.

## Instalar en el celular

Al abrirlo desde GitHub Pages (https), el navegador ofrece **Agregar a la
pantalla de inicio**. Queda como una app y funciona sin conexión.

## Publicar en GitHub Pages

En el repositorio: **Settings → Pages → Deploy from a branch → `main` / root**.
El juego queda en `https://<usuario>.github.io/dinosaurs/`.

## Pruebas

```bash
npm test             # pruebas unitarias (node:test): genética, cuidado, cría, excavación, datos
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
js/render/dino-svg.js    Ilustración paramétrica de dinosaurios y huevos
js/ui/views/             Pantallas: parque, criadero, excavar, dinopedia, más, quiz, concursos
docs/GDD.md              Documento de diseño y referencias
dev/gallery.html         Galería de todas las especies (útil al ajustar el dibujo)
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

Las medidas de los animales son estimaciones promedio de la literatura. Los
colores son imaginados, como en cualquier reconstrucción paleontológica, salvo
en las especies cuyo color real se conoce por sus fósiles.
