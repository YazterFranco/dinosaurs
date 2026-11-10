# Dino Refugio — Documento de diseño (GDD)

> Un refugio científico donde excavas fósiles reales, recuperas su ADN, incubas
> huevos, crías dinosaurios y aprendes cómo vivieron de verdad.

## 1. Visión

**Pitch:** "Tamagotchi + museo de historia natural + Jurassic World Evolution, en
el bolsillo". Cada mecánica enseña algo verdadero sobre los dinosaurios: dónde se
encontraron, qué comían, cómo vivían en grupo, cuánto medían y en qué época
existieron.

**Público:** todas las edades (niños de 6+ con ayuda, adolescentes y adultos).
Sin muerte, sin violencia gráfica, sin compras.

**Plataforma:** web (móvil primero, también escritorio). HTML + CSS + JavaScript
sin dependencias, publicable en GitHub Pages. Partida guardada en el navegador.

**Pilares**

1. **Ciencia real.** Cada dato del juego sale de la Dinopedia; los sitios de
   excavación son formaciones geológicas reales.
2. **Cuidado con cariño.** Los dinosaurios tienen necesidades, personalidad
   visible y un vínculo contigo que crece si los cuidas de crías.
3. **Crianza con sentido.** La genética es simple de entender (cuadros de Punnett)
   pero profunda: colores, patrones, variantes raras y estadísticas heredables.
4. **Siempre hay algo que hacer.** Ciclos cortos (alimentar, acariciar), medios
   (incubar, crecer) y largos (completar la colección, ganar concursos).

## 2. Bucles de juego

```
                ┌──────────────┐
      monedas → │  EXCAVACIÓN  │ → fragmentos de ADN
                └──────┬───────┘
                       ▼
                ┌──────────────┐  ADN ≥ 50 %
                │   GENOMA     │ ───────────────┐
                └──────────────┘                ▼
                                       ┌──────────────┐
           ┌────────────────────────── │  INCUBADORA  │
           ▼                           └──────────────┘
   ┌──────────────┐  cuidar   ┌──────────────┐  cruzar  ┌──────────────┐
   │     CRÍA     │ ────────► │ JUVENIL→ADULTO│ ───────► │    NIDO      │
   └──────────────┘  vínculo  └──────┬───────┘          └──────────────┘
                                     │ atractivo
                                     ▼
                            ┌──────────────────┐
                            │ VISITANTES = $$$  │ → tienda, recintos, expediciones
                            └──────────────────┘
```

- **Corto (segundos):** alimentar, acariciar, jugar, curar, atender peticiones
  de las crías.
- **Medio (minutos):** excavar un sitio, incubar un huevo, ver crecer a una cría,
  responder un quiz.
- **Largo (días):** completar los 41 registros de la Dinopedia, criar variantes
  raras (albino, melanístico, leucístico), ganar los cuatro concursos, subir al
  nivel máximo del refugio.

## 3. Sistemas

### 3.1 Excavación (inspirado en las expediciones de *Jurassic World Evolution*
y la mina subterránea de *Pokémon Diamante/Perla*)

- Cada **sitio** es una formación real (Hell Creek, Morrison, Djadochta,
  Ischigualasto, Solnhofen, Yixian/Jiufotang, Kem Kem, etc.) con su edad, país y
  la lista de especies que realmente se hallaron allí.
- Cuadrícula de 8 × 6 con capas de roca de dureza 1–3. Herramientas:
  - **Pico:** rompe 2 capas en cruz. Si golpea hueso expuesto, lo daña.
  - **Brocha:** quita 1 capa de una casilla y nunca daña.
- Energía limitada por expedición (golpes). Los huesos ocupan varias casillas; al
  descubrir todas, el hueso se recoge y aporta % de ADN según su **calidad**.
- Los sitios se desbloquean por nivel del refugio.

### 3.2 Genoma y huevos

- Cada especie tiene un % de genoma (0–100).
- Con **50 %** se puede sintetizar un huevo. A más genoma: mayor **viabilidad**
  (probabilidad de eclosión) y mejores estadísticas mínimas.
- Al 100 % se desbloquea la ficha completa de la Dinopedia.

### 3.3 Incubadora

- Ranuras limitadas (2, ampliables a 5). Tiempo según tamaño de la especie.
- De vez en cuando el huevo pide **girarlo**: hacerlo sube la viabilidad.
- Dato educativo: se muestra que muchos dinosaurios tardaban meses en eclosionar
  (estudios de líneas de crecimiento en dientes embrionarios).

### 3.4 Cuidado y necesidades (Tamagotchi + bienestar de *JWE* / *Prehistoric Kingdom*)

| Necesidad | Baja con… | Sube con… |
|---|---|---|
| Hambre | el tiempo | comida de su dieta (la favorita da extra) |
| Ánimo | soledad, bioma equivocado, hambre | caricias, juego, grupo ideal, enriquecimiento |
| Energía | jugar, concursos | descansar |
| Salud | hambre o ánimo muy bajos, enfermedades | medicina |

- **Dieta real:** un herbívoro rechaza la carne y el juego explica por qué.
- **Comodidad del recinto:** bioma preferido, tamaño de grupo ideal (solitario,
  pareja, manada) y objetos de enriquecimiento.
- **Sin muerte:** con salud 0 el dinosaurio va a la clínica y hay que pagar el
  tratamiento.

### 3.5 Crecimiento y vínculo (inspirado en la *impronta* de *ARK*)

- Etapas: **cría → juvenil → adulto**. El crecimiento se pausa si tiene hambre.
- Las crías hacen **peticiones** (comer, caricia, juego). Atenderlas sube el
  **vínculo** (0–100 %), que da hasta **+20 %** a sus estadísticas para siempre.

### 3.6 Genética y cría

- **Sexo:** macho / hembra. Se cruzan adultos de la misma especie con buen ánimo.
- **Color:** dos tonos heredados por mezcla con pequeña variación.
- **Patrón:** locus con alelos dominantes/recesivos
  (`rayas > manchas > bandas > liso`).
- **Variantes raras:** locus recesivo (`N` normal; `a` albino; `m` melanístico;
  `l` leucístico). Solo se expresa en homocigosis (`aa`, `mm`, `ll`). Idea tomada
  del sistema procedural de *Prehistoric Kingdom*.
- **Estadísticas** (Tamaño, Fuerza, Velocidad, Vitalidad, Intelecto): cada una se
  hereda de un progenitor (55 % del mejor) y hay probabilidad de **mutación**
  (+3 a +8) como en *ARK*.
- La pantalla de cría muestra el **cuadro de Punnett** con las probabilidades de
  cada patrón y variante antes de cruzar.

### 3.7 Visitantes y economía

- Cada dinosaurio tiene **atractivo** = fama de la especie × etapa × ánimo ×
  bonus de rareza. Los visitantes pagan cada minuto según el atractivo total.
- Gastos: comida, medicina, expediciones, recintos, mejoras.
- Progreso fuera de línea limitado a 2 horas, con las necesidades congeladas a un
  mínimo para que nadie "sufra" mientras no juegas.

### 3.8 Concursos

Cuatro pruebas que dan sentido a criar mejores ejemplares:

| Concurso | Estadísticas clave |
|---|---|
| Carrera | Velocidad, Energía |
| Fuerza | Fuerza, Tamaño |
| Belleza | Rareza, Patrón, Ánimo |
| Ingenio | Intelecto, Vínculo |

### 3.9 Dinopedia y quiz

- Ficha por especie: nombre y significado, pronunciación, periodo y millones de
  años, dieta, grupo, longitud, peso, dónde y quién la descubrió, tres datos
  curiosos, **mito vs. realidad** y comparación de tamaño con una persona.
- Línea de tiempo del Mesozoico (Triásico, Jurásico, Cretácico).
- Pterosaurios y reptiles marinos aparecen marcados como **"no es dinosaurio"**.
- **Quiz** generado desde la Dinopedia + preguntas generales (extinción, aves
  como dinosaurios vivos). Premia monedas, XP y ADN.

### 3.10 Misiones y logros

- Cadena de tutorial que guía los primeros 15 minutos.
- Logros de colección, crianza, concursos y conocimiento.
- Nivel del refugio por XP: desbloquea sitios, recintos y ranuras.

## 3.11 Ganas de volver (retención sana)

El objetivo es que el jugador **quiera** volver, no que **tenga** que volver.
Nada se pierde por no jugar y no hay compras con dinero real.

| Sistema | Cómo funciona | Referencia |
|---|---|---|
| Racha diaria | Calendario de 7 días con premios crecientes (día 7: cofre de oro). Bonus de monedas por rachas largas. | Duolingo, calendarios de login |
| Escudos de racha | Cada 7 días ganas un escudo (máx. 2) que protege la racha si faltas un día. | "Forgiving streaks" y *streak freeze* |
| Misiones de hoy | 3 misiones aleatorias por día (alimentar, excavar, quiz…) + cofre de plata al completarlas. | Juegos de colección diarios |
| Envío de suministros | Cofre gratis cada 4 horas; cada tercer envío es de plata. | Cofres con temporizador |
| Cofres | Premios variables: monedas, comida, ADN (a veces una especie nueva), energía, accesorios y huevos dorados con genes raros. | Recompensa variable |
| Energía de expedición | 5 cargas (+1 por mejora de mochila). Cada excavación usa 1 y se recarga 1 cada 10 min. Se llena al subir de nivel. | *Jurassic World Alive*, juegos de energía |
| Taquilla | Los visitantes pagan en la taquilla (tope de ~2 h de ingresos) y hay que cobrarla. | Juegos *idle* |
| Regalos | Los dinosaurios contentos dejan plumas, semillas, huesitos, ámbar o estrellas, también mientras no juegas. | *Neko Atsume* |
| Visitante especial | Una fotógrafa aparece de vez en cuando en el parque; tocarla da monedas. | "Golden cookie" de juegos *idle* |
| Combos | Cuidados acertados seguidos (petición o comida favorita) suman monedas extra. | Juegos de acción casual |
| Bonus del día | Uno distinto por día de la semana (feria, campo, ciencia, mercado, regalos, estirón, campeones). | Eventos rotativos |
| Yacimiento de la semana | Un yacimiento desbloqueado da ADN ×2 durante la semana. | Eventos semanales |
| Subida de nivel | Celebración, cofre (oro cada 5 niveles), energía llena y lista de lo desbloqueado. | — |
| Accesorios | 9 accesorios (común a legendario) que se ven en el dinosaurio y suman en el concurso de belleza. | Cosméticos coleccionables |
| Caras y emociones | Los dinosaurios cambian de expresión según hambre, cansancio, tristeza o felicidad. | Tamagotchi |

**Límites éticos:** sin anuncios, sin pagos, sin castigos por ausencia (las
necesidades no bajan de 35 fuera de línea y nadie muere), los temporizadores
nunca hacen perder lo ganado y la racha perdida se reinicia con un mensaje
amable. Esto sigue las recomendaciones de investigaciones sobre patrones
oscuros en juegos infantiles (presión de tiempo, muros de pago y recompensas
parecidas al azar con dinero real).

## 3.12 Balance (probado con simulación)

`scripts/simular-economia.mjs` juega sesiones diarias con un bot (cuida,
excava con la energía disponible, sintetiza, incuba, reclama recompensas) e
imprime una tabla por día. La primera versión revelaba que en 20 minutos se
llegaba al nivel 9 y en 4 días se tenían las 41 especies: cada subida de nivel
rellenaba la energía y eso permitía excavar más, y los visitantes pagaban
demasiado. Tras el ajuste (curva de XP más larga, menos XP por acciones
repetitivas, +1 de energía al subir de nivel, ADN por hueso moderado, taquilla
con tope según el nivel y recintos que suben de precio), un jugador muy
eficiente de 20 min/día llega al nivel 3 el primer día, ~9 a la semana y
completa la colección en unas dos semanas; un jugador casual tarda varias más.
Para el juego avanzado hay en qué gastar: entrenamiento y accesorios.

## 3.13 Más profundidad

- **Entrenamiento:** +2 a una estadística por monedas y energía del dinosaurio.
  No cambia los genes, así que no se hereda (como en la biología real).
- **Accesorios en la tienda** a precio fijo, además de los cofres.
- **Postal para compartir:** imagen PNG del dinosaurio con su nombre, especie y
  época, para descargar o compartir desde el celular.
- **Hora real en el parque:** amanecer, día, atardecer y noche con luna,
  estrellas y luciérnagas; nubes y libélulas de día.
- **Instalable y sin conexión (PWA):** manifiesto, íconos y service worker.
- **Familia:** la ficha muestra padres y número de crías.

## 4. Dirección visual

- **Concepto:** estación de campo en un bosque de helechos. Nada de "papel
  crema + terracota" genérico: la paleta sale de la flora y los materiales del
  Mesozoico.
- **Referencias:** *Alba: A Wildlife Adventure* (colores planos, degradados
  suaves, formas simples y legibles) y las etiquetas de espécimen de museo
  (las fichas de la Dinopedia tienen el agujero de la etiqueta y una franja con
  el color del periodo).
- **Paleta:** gris salvia `#e4eae2` (fondo), verde helecho `#2e6a4e` y
  `#1d4a36` (estructura), lima de cícada `#b9d46a` (acento), ámbar de resina
  `#efa531` (monedas y premios), agua `#5ea8c0`. Periodos: Triásico `#c9783f`,
  Jurásico `#4f8a5b`, Cretácico `#3f6f8f`.
- **Elemento protagonista:** el diorama del recinto, con paisaje por bioma y
  dinosaurios que pasean, duermen y piden cosas. Todo lo demás es sobrio.
- **Dinosaurios:** modelos 3D generados en el navegador (sección 4.1). Debajo
  queda una ilustración vectorial paramétrica por plan corporal (bípedo,
  cuadrúpedo, semibípedo, volador, nadador), en estilo paleoarte, que aparece
  al instante y sirve de respaldo:
  - **Anatomía:** la cola, el cuerpo y el cuello siguen una "columna" que se
    ensancha y se afina como un esqueleto, con un solo contorno. Patas con
    muslo musculoso, espinilla, metatarso y dedos con garras de queratina;
    pies columnares con uñas en los cuadrúpedos. Placas de Stegosaurus en dos
    filas alternas, osteodermos en bandas, volante con epoccipitales, alas de
    pterosaurio con propatagio y actinofibrillas, plumas pennáceas en brazos y
    cola de los maniraptores, sin dientes a la vista (labios).
  - **Luz (como en el arte de videojuegos):** rampa de luz inspirada en el
    sombreado ilustrativo de *Team Fortress 2* (Valve): las sombras se enfrían
    en vez de ennegrecerse, la transición entre luz y sombra gana saturación
    cálida, luz de contorno en los bordes que miran arriba y luz rebotada del
    suelo en el vientre. Contrasombreado (lomo oscuro, vientre claro).
  - **Materiales:** escamas finas o plumas como textura, membranas (velas,
    placas, golas, alas) translúcidas con brillo cálido a contraluz, ojos con
    anillo, iris con volumen y brillo húmedo (el foco de la mirada).
  - **Oclusión ambiental:** sombra de contacto bajo cada pie y sombra de la
    cabeza sobre el cuello.
  - **Nivel de detalle (LOD):** las miniaturas omiten la textura fina; en el
    parque, con muchos animales a la vez, solo respiran y parpadean; el retrato
    grande también mueve la cabeza. La respiración anima el SVG entero en la
    GPU, sin repintar.
  - Velas, placas, golas, cuernos, crestas, armadura y plumas se dibujan por
    especie; colores y patrones salen de los genes. Las crías tienen cabeza y
    ojos más grandes. Sin pasto, cactus ni palmeras en los paisajes: no
    existían (o casi) en la época.
- **Tipografía:** *Lilita One* para títulos (rótulo de juego) y *Atkinson
  Hyperlegible* para el texto (diseñada para lectura fácil).
- **Movimiento:** respiración, cabeceo (a ritmo distinto en cada animal),
  parpadeo y aleteo. Todo se desactiva con `prefers-reduced-motion`.

### 4.1 Dinosaurios en 3D

Cada dinosaurio es un modelo tridimensional que se genera al vuelo con los
datos de su especie y sus genes. No hay archivos de modelos ni librerías: el
juego sigue sin dependencias ni paso de compilación, con un motor WebGL2 propio
en `js/render3d/`.

- **Modelado procedural:** el tronco, la cola y el cuello se levantan desde el
  perfil lateral del dibujo (secciones verticales unidas con un máximo suave y
  ancho de superelipse), así el 3D y el dibujo coinciden siempre. La cabeza
  sale del mismo contorno con el ancho propio de su tipo (pico de pato, hocico
  de terópodo, pico de loro...). Las patas son tubos cuyo muslo nace dentro del
  cuerpo. Golas, velas, placas, cuernos, crestas, armadura, alas con membrana y
  plumas se modelan por especie; las crías tienen cabeza y ojos más grandes.
- **Materiales:**
  - Escamas con relieve: mapa de alturas procedural tipo Voronoi, a la escala
    real del animal, con *bump mapping* sin tangentes (Mikkelsen, 2010).
  - Piel "carnosa": dispersión subsuperficial aproximada con luz envolvente
    (*GPU Gems*, cap. 16), como la que *Jurassic World Evolution 3* añadió a
    sus dinosaurios.
  - Membranas que dejan pasar el sol (alas de pterosaurio, velas, golas), como
    en *JWE3*.
  - Plumas y picnofibras por capas (*shell texturing*, Lengyel et al., 2001):
    diez capas de hebras peinadas hacia atrás.
  - Ojos con iris, brillo húmedo y párpados que parpadean; brillo iridiscente
    en *Microraptor*.
- **Segunda pasada (más realismo y vida):**
  - Piel en capas: escamas finas (más pequeñas en los gigantes), escamas
    grandes sueltas y una red de arrugas de piel curtida; encima, el relieve
    anatómico de cada animal (pliegues del cuello, la axila, la ingle y el
    vientre) guardado en su propia textura. Entre escama y escama la piel se
    oscurece.
  - Colores naturales: los genes dan el tono, pero la piel se apaga hacia
    tierras y olivas; lomo oscuro de borde irregular, manchas difusas y pies
    polvorientos. Las crestas, golas y velas conservan el color vivo.
  - Anatomía: lomo más estrecho que el vientre, caderas y hombros marcados,
    mandíbula con su propio alto, cráneo en "A" visto de frente, patas con
    codo, rodilla y tobillo (o de columna en saurópodos y acorazados) y ojos
    pequeños en los gigantes.
  - Esqueleto sencillo: cada pata gira en cadera, rodilla y tobillo para
    caminar (en el visor y, como tira de 8 cuadros, en el parque), y la
    mandíbula se abre con lengua y, en los cazadores, dientes que con la boca
    cerrada quedan tapados por los labios.
  - En el visor: tocar al animal (o el botón) lo hace rugir, con una voz
    sintetizada según su tamaño; otro botón lo pone a caminar.
- **Luz de estudio:** luz principal cálida, luz de contorno fría (heredera del
  sombreado de *Team Fortress 2*), cielo y suelo, sombras con mapa de sombras y
  filtrado PCF, sombra de contacto y curva de tono ACES (la del cine), para que
  los colores no se quemen. La textura que rodea el cuerpo usa el método de
  Tarini (2012) para que no aparezca una costura.
- **Cómo se muestra:**
  - En el parque, las listas y las tarjetas cada animal es una imagen 3D que se
    renderiza una sola vez, en ratos libres, y se guarda en memoria y en
    IndexedDB (con límite y borrado de versiones viejas). Al volver a abrir el
    juego aparecen al instante, y el parque va a 60 cuadros por segundo aunque
    haya muchos animales.
  - En la ficha, la eclosión, la Dinopedia y la bienvenida hay un visor que se
    gira con el dedo, el ratón o las flechas del teclado. El animal respira,
    mira alrededor y parpadea.
  - Calidad adaptable: si los cuadros tardan, el visor baja la resolución y
    después deja de animarse en reposo. Sin tarjeta gráfica (WebGL por
    software) arranca quieto. Con `prefers-reduced-motion` no se mueve.
  - Si el navegador no tiene WebGL2, o el jugador lo apaga en Más → Ajustes,
    se ve el dibujo vectorial, que también aparece mientras se prepara el 3D.
- **Anatomía al día (2025):**
  - *Edmontosaurus*: las "momias" de Wyoming (Sereno et al., *Science*, 2025)
    mostraron una cresta carnosa continua en el cuello y el lomo que, pasada la
    cadera, se vuelve una fila de púas (una por vértebra), y pezuñas en forma
    de cuña en las patas traseras. El modelo tiene las tres cosas.
  - *Diplodocus*: melanosomas fosilizados en la piel de crías (Gallagher et
    al., *Royal Society Open Science*, 2025) revelaron un moteado como el de
    los cocodrilos. Su patrón base ahora es moteado, con manchitas redondas.
- **Herramienta:** `dev/gallery3d.html` muestra las 41 especies en 3D, con
  parámetros para etapa, ánimo, accesorio, silueta, sueño y visor.

## 5. Referencias

**Jugabilidad**

- *Jurassic World Evolution 2* (Frontier): expediciones, extracción de genoma,
  incubación, comodidad por recinto, apuestas por atractivo.
- *ARK: Survival Evolved*: impronta de crías, herencia de estadísticas y
  mutaciones.
- *Prehistoric Kingdom*: variantes albino/melanístico/leucístico procedurales,
  necesidades basadas en investigación.
- *Jurassic World Alive*: colección por ADN y rareza, energía para expediciones.
- *Neko Atsume*: regalos que se acumulan mientras no juegas, sin castigos.
- Duolingo: rachas, escudos de racha e hitos celebrados.
- *Tamagotchi* / *Neko Atsume*: cuidado diario y sesiones cortas.
- *Pokémon* (mina subterránea): minijuego de excavación por capas.

**Ciencia y diseño**

- Cullen et al. (2023), *Science*: los terópodos como el T. rex tenían labios
  que cubrían sus dientes. Por eso los dibujos no muestran dientes.
- Color real por melanosomas y pigmentos: Sinosauropteryx (lomo rojizo,
  antifaz y cola anillada), Psittacosaurus (contrasombreado) y Borealopelta
  (marrón rojizo contrasombreado).

- Jason L. Mitchell y otros (Valve, 2007), *Illustrative Rendering in Team
  Fortress 2*: sombras frías, saturación en la transición, luz de contorno.
- Michael Kelley, *Paleoart Process for Video Games* (Game Developer):
  contrasombreado, labios, decisiones justificadas por evidencia.
- *Jurassic World Evolution 2* (Frontier): variantes de color inspiradas en
  animales actuales (aves rapaces para los dromeosáuridos).
- *Prehistoric Kingdom* (Blue Meridian): diseños que buscan exactitud
  científica y variación individual de tono y saturación.
- Natural History Museum (Londres), *Dino Directory* y la reconstrucción de
  Psittacosaurus a partir de sus melanosomas.
- *Alba: A Wildlife Adventure* (ustwo games), dirección de arte.

**3D**

- Sereno et al. (2025), *Science*: "Duck-billed dinosaur fleshy midline and
  hooves reveal terrestrial clay-template 'mummification'" (*Edmontosaurus*).
- Gallagher et al. (2025), *Royal Society Open Science*: "Fossilized
  melanosomes reveal colour patterning of a sauropod dinosaur" (*Diplodocus*).
- Frontier, *Jurassic World Evolution 3*, "Behind the scenes: bringing
  dinosaurs to life": dispersión subsuperficial y transmisión, membranas
  translúcidas, crías que no son adultos encogidos.
- Simon Green (2004), *GPU Gems*, cap. 16: "Real-Time Approximations to
  Subsurface Scattering".
- Lengyel, Praun, Finkelstein y Hoppe (2001): "Real-Time Fur over Arbitrary
  Surfaces" (capas para pelo y plumas).
- Morten Mikkelsen (2010): "Bump Mapping Unparametrized Surfaces on the GPU".
- Marco Tarini (2012): "Cylindrical and Toroidal Parameterizations Without
  Vertex Seams".
- Krzysztof Narkowicz (2016): "ACES Filmic Tone Mapping Curve".
