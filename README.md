# Dino Refugio

Juego web para conocer dinosaurios criándolos. Excavas fósiles en yacimientos
reales, recuperas su ADN, incubas huevos, cuidas a las crías hasta que crecen,
las cruzas para obtener colores y variantes raras, y aprendes datos verificados
de 35 especies del Triásico, el Jurásico y el Cretácico.

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
7. Completa la **Dinopedia**: cada ficha trae significado del nombre,
   pronunciación, periodo, tamaño comparado con una persona, quién lo descubrió,
   datos curiosos y "mito vs. realidad".

## Ejecutar en local

Hace falta Node.js 18 o superior (o cualquier servidor estático).

```bash
npm start            # http://localhost:5173
```

Los módulos ES no funcionan abriendo `index.html` con doble clic (`file://`);
usa el servidor incluido o GitHub Pages.

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

Las pruebas de datos verifican, por ejemplo, que cada especie aparece en un
yacimiento de su mismo periodo y que su comida favorita respeta su dieta.

## Estructura

```
index.html               Interfaz principal
css/styles.css           Estilos (móvil primero)
js/main.js               Arranque, rutas, bucle de juego, HUD
js/data/                 Dinopedia (species.js), mundo y tienda (world.js), quiz
js/systems/              Lógica pura y probada: game, genetics, dig, contest, missions
js/render/dino-svg.js    Ilustración paramétrica de dinosaurios y huevos
js/ui/views/             Pantallas: parque, criadero, excavar, dinopedia, más, quiz, concursos
docs/GDD.md              Documento de diseño y referencias
dev/gallery.html         Galería de todas las especies (útil al ajustar el dibujo)
tests/                   Unitarias y E2E
```

## Referencias

- Jugabilidad: *Jurassic World Evolution 2* (expediciones, genoma, comodidad),
  *ARK* (impronta y mutaciones), *Prehistoric Kingdom* (variantes genéticas),
  *Tamagotchi* (cuidado), mina subterránea de *Pokémon* (excavación por capas).
- Diseño: *Alba: A Wildlife Adventure* y las fichas de la *Dino Directory* del
  Natural History Museum de Londres.

Las medidas de los animales son estimaciones promedio de la literatura y los
colores son imaginados, como en cualquier reconstrucción paleontológica.
