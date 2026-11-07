// Mundo del juego: comida, biomas, enriquecimiento, sitios de excavación,
// tienda, niveles y fósiles sueltos.

export const FOODS = {
  helechos: {
    nombre: 'Helechos', icono: '🌿', categoria: 'planta', precio: 4, saciedad: 28,
    dato: 'Los helechos ya existían mucho antes que los dinosaurios y fueron un alimento básico.',
  },
  cicadas: {
    nombre: 'Cícadas', icono: '🌴', categoria: 'planta', precio: 6, saciedad: 34,
    dato: 'Las cícadas parecen palmeras, pero son parientes de los pinos. Aún existen hoy.',
  },
  coniferas: {
    nombre: 'Ramas de conífera', icono: '🌲', categoria: 'planta', precio: 6, saciedad: 34,
    dato: 'Araucarias y otras coníferas eran comunes. Los saurópodos podían alcanzarlas.',
  },
  colas_caballo: {
    nombre: 'Colas de caballo', icono: '🎋', categoria: 'planta', precio: 5, saciedad: 30,
    dato: 'Las colas de caballo (Equisetum) son nutritivas y crecen en lugares húmedos.',
  },
  ginkgo: {
    nombre: 'Hojas de ginkgo', icono: '🍂', categoria: 'planta', precio: 7, saciedad: 34,
    dato: 'El ginkgo es un "fósil viviente": casi no ha cambiado en más de 200 millones de años.',
  },
  plantas_flor: {
    nombre: 'Plantas con flor', icono: '🌸', categoria: 'planta', precio: 8, saciedad: 36,
    dato: 'Las plantas con flor aparecieron en el Cretácico. ¡Los dinosaurios del Jurásico nunca vieron una flor!',
    soloCretacico: true,
  },
  frutos: {
    nombre: 'Frutos y semillas', icono: '🫐', categoria: 'fruto', precio: 6, saciedad: 26,
    dato: 'Algunos dinosaurios omnívoros comían semillas; se han hallado piedras para moler (gastrolitos).',
  },
  insectos: {
    nombre: 'Insectos', icono: '🐞', categoria: 'insecto', precio: 4, saciedad: 22,
    dato: 'Libélulas, escarabajos y cucarachas ya volaban y corrían entre los dinosaurios.',
  },
  carne_pequena: {
    nombre: 'Presa pequeña', icono: '🍗', categoria: 'carne', precio: 8, saciedad: 34,
    dato: 'Los depredadores pequeños cazaban lagartijas, mamíferos diminutos y crías.',
  },
  carne_roja: {
    nombre: 'Carne', icono: '🥩', categoria: 'carne', precio: 12, saciedad: 45,
    dato: 'Los grandes terópodos necesitaban mucha carne; algunos también eran carroñeros.',
  },
  pescado: {
    nombre: 'Pescado', icono: '🐟', categoria: 'pescado', precio: 9, saciedad: 38,
    dato: 'Los espinosáuridos y los pterosaurios eran expertos pescadores.',
  },
};

export const MEDICINE = { id: 'medicina', nombre: 'Medicina', icono: '💊', precio: 40 };

export const BIOMES = {
  bosque: {
    nombre: 'Bosque de coníferas', icono: '🌲',
    cielo: ['#cfe6d4', '#f4ecd6'], suelo: ['#5d8a4e', '#3f6b3a'], lejos: '#89b08a', cerca: '#2f5733',
    dato: 'Los bosques del Mesozoico estaban hechos de coníferas, helechos y cícadas.',
  },
  llanura: {
    nombre: 'Llanura aluvial', icono: '🌾',
    cielo: ['#d8e8f0', '#f6efd9'], suelo: ['#b9a85e', '#8e8a45'], lejos: '#b7c49a', cerca: '#6f7d3c',
    dato: 'Ríos que se desbordaban dejaban llanuras fértiles. ¡Pero sin pasto: casi no existía!',
  },
  pantano: {
    nombre: 'Pantano', icono: '🪷',
    cielo: ['#d5e3d2', '#eef0dd'], suelo: ['#5f7a52', '#3d5a45'], lejos: '#7ea08b', cerca: '#355544',
    agua: '#6f9fa0',
    dato: 'Muchos fósiles se forman en pantanos: el barro cubre los huesos rápido.',
  },
  desierto: {
    nombre: 'Desierto con dunas', icono: '🏜️',
    cielo: ['#f3dfc1', '#fbf0dc'], suelo: ['#e0a96b', '#c4844a'], lejos: '#e8c08e', cerca: '#b2703f',
    dato: 'En el Gobi, tormentas de arena sepultaron dinosaurios enteros, a veces en sus nidos.',
  },
  costa: {
    nombre: 'Costa y laguna', icono: '🌊',
    cielo: ['#cde6f2', '#f6f2e0'], suelo: ['#e8d6a8', '#d1b980'], lejos: '#8cc3d2', cerca: '#4d8fa6',
    agua: '#5a9fbf',
    dato: 'Los mares del Cretácico eran más altos: gran parte de los continentes estaba bajo el agua.',
  },
};

// Recintos que se pueden construir. `capacidad` = máximo de dinosaurios.
export const ENCLOSURE_COST = { bosque: 500, llanura: 600, pantano: 800, desierto: 700, costa: 900 };
export const ENCLOSURE_LEVEL = { bosque: 2, llanura: 2, pantano: 3, desierto: 2, costa: 4 };
export const ENCLOSURE_CAPACITY = 6;

// Objetos de enriquecimiento: suben el ánimo de quienes viven en el recinto.
export const ENRICHMENT = {
  tronco: { nombre: 'Tronco para rascarse', icono: '🪵', precio: 120, bonus: 4, dato: 'Muchos animales se rascan para quitarse parásitos y piel vieja.' },
  charca: { nombre: 'Charca de barro', icono: '💧', precio: 180, bonus: 5, dato: 'Revolcarse en barro ayuda a refrescarse y protege la piel.' },
  rocas: { nombre: 'Rocas de sol', icono: '🪨', precio: 150, bonus: 4, dato: 'Tomar sol ayuda a regular la temperatura corporal.' },
  arbusto: { nombre: 'Arbustos para explorar', icono: '🌳', precio: 140, bonus: 4, dato: 'Buscar comida entre la vegetación mantiene la mente activa.' },
  nido: { nombre: 'Zona de nidos', icono: '🪺', precio: 220, bonus: 6, dato: 'Muchos dinosaurios anidaban en colonias, como Maiasaura.' },
  arena: { nombre: 'Baño de arena', icono: '⏳', precio: 160, bonus: 4, dato: 'Las aves actuales se bañan en arena para limpiar sus plumas.' },
};
export const MAX_ENRICHMENT = 4;

// Sitios de excavación: formaciones reales con las especies que allí se hallaron.
export const SITES = [
  {
    id: 'hell_creek', nombre: 'Hell Creek', lugar: 'Montana, EE.UU.', continente: 'Norteamérica',
    periodo: 'cretacico', ma: '68–66 Ma', nivel: 1, costo: 40, roca: '#b8956a',
    especies: ['tyrannosaurus', 'triceratops', 'ankylosaurus', 'pachycephalosaurus', 'edmontosaurus'],
    dato: 'Guarda los últimos dinosaurios no avianos antes del impacto del asteroide.',
  },
  {
    id: 'morrison', nombre: 'Formación Morrison', lugar: 'Colorado, Utah y Wyoming, EE.UU.', continente: 'Norteamérica',
    periodo: 'jurasico', ma: '156–147 Ma', nivel: 1, costo: 40, roca: '#b77a5c',
    especies: ['stegosaurus', 'brachiosaurus', 'diplodocus', 'allosaurus'],
    dato: 'Aquí ocurrió la "Guerra de los Huesos" entre Marsh y Cope en el siglo XIX.',
  },
  {
    id: 'djadochta', nombre: 'Llameantes Acantilados (Djadochta)', lugar: 'Desierto de Gobi, Mongolia', continente: 'Asia',
    periodo: 'cretacico', ma: '75–71 Ma', nivel: 2, costo: 60, roca: '#d9884f',
    especies: ['velociraptor', 'protoceratops', 'oviraptor'],
    dato: 'Roy Chapman Andrews encontró aquí los primeros nidos de dinosaurio reconocidos, en 1923.',
  },
  {
    id: 'ghost_ranch', nombre: 'Ghost Ranch (Formación Chinle)', lugar: 'Nuevo México, EE.UU.', continente: 'Norteamérica',
    periodo: 'triasico', ma: '~212 Ma', nivel: 2, costo: 50, roca: '#c46a4f',
    especies: ['coelophysis'],
    dato: 'Una cantera con cientos de Coelophysis, quizá muertos juntos por una sequía o inundación.',
  },
  {
    id: 'two_medicine', nombre: 'Egg Mountain (Formación Two Medicine)', lugar: 'Montana, EE.UU.', continente: 'Norteamérica',
    periodo: 'cretacico', ma: '~77 Ma', nivel: 3, costo: 70, roca: '#a88a6a',
    especies: ['maiasaura'],
    dato: 'Aquí se descubrió en 1978 una colonia de nidos que demostró que algunos dinosaurios cuidaban a sus crías.',
  },
  {
    id: 'dinosaur_park', nombre: 'Parque Provincial Dinosaur', lugar: 'Alberta, Canadá', continente: 'Norteamérica',
    periodo: 'cretacico', ma: '76–74 Ma', nivel: 3, costo: 70, roca: '#a99272',
    especies: ['parasaurolophus', 'styracosaurus'],
    dato: 'Es Patrimonio de la Humanidad y uno de los lugares más ricos en dinosaurios del mundo.',
  },
  {
    id: 'ischigualasto', nombre: 'Ischigualasto (Valle de la Luna)', lugar: 'San Juan, Argentina', continente: 'Sudamérica',
    periodo: 'triasico', ma: '231–228 Ma', nivel: 3, costo: 70, roca: '#9a8a7a',
    especies: ['eoraptor', 'herrerasaurus'],
    dato: 'Aquí están algunos de los dinosaurios más antiguos del planeta.',
  },
  {
    id: 'kayenta', nombre: 'Formación Kayenta', lugar: 'Arizona, EE.UU.', continente: 'Norteamérica',
    periodo: 'jurasico', ma: '~193–183 Ma', nivel: 4, costo: 80, roca: '#b45f43',
    especies: ['dilophosaurus'],
    dato: 'Dilophosaurus se descubrió en tierras de la Nación Navajo en la década de 1940.',
  },
  {
    id: 'nemegt', nombre: 'Formación Nemegt', lugar: 'Desierto de Gobi, Mongolia', continente: 'Asia',
    periodo: 'cretacico', ma: '~70 Ma', nivel: 4, costo: 90, roca: '#d6a46e',
    especies: ['gallimimus', 'therizinosaurus'],
    dato: 'Hace 70 millones de años era un sistema de ríos con bosques, no un desierto.',
  },
  {
    id: 'europa', nombre: 'Weald y Bernissart', lugar: 'Inglaterra y Bélgica', continente: 'Europa',
    periodo: 'cretacico', ma: '130–122 Ma', nivel: 5, costo: 90, roca: '#8c8072',
    especies: ['iguanodon', 'baryonyx'],
    dato: 'Inglaterra es la cuna de la paleontología de dinosaurios: aquí se nombró el primero.',
  },
  {
    id: 'solnhofen', nombre: 'Caliza de Solnhofen', lugar: 'Baviera, Alemania', continente: 'Europa',
    periodo: 'jurasico', ma: '~150 Ma', nivel: 5, costo: 100, roca: '#e2d6b5',
    especies: ['archaeopteryx', 'compsognathus'],
    dato: 'Su caliza es tan fina que conserva plumas; antes se usaba para imprimir litografías.',
  },
  {
    id: 'trossingen', nombre: 'Trossingen', lugar: 'Baden-Wurtemberg, Alemania', continente: 'Europa',
    periodo: 'triasico', ma: '214–204 Ma', nivel: 6, costo: 90, roca: '#a3765a',
    especies: ['plateosaurus'],
    dato: 'Muchos Plateosaurus quedaron atrapados en barro, como en arenas movedizas.',
  },
  {
    id: 'cloverly', nombre: 'Formación Cloverly', lugar: 'Montana y Wyoming, EE.UU.', continente: 'Norteamérica',
    periodo: 'cretacico', ma: '115–108 Ma', nivel: 6, costo: 110, roca: '#9c7d6a',
    especies: ['deinonychus'],
    dato: 'John Ostrom halló aquí a Deinonychus en 1964 y cambió cómo vemos a los dinosaurios.',
  },
  {
    id: 'liaoning', nombre: 'Biota de Jehol', lugar: 'Liaoning, China', continente: 'Asia',
    periodo: 'cretacico', ma: '125–120 Ma', nivel: 7, costo: 120, roca: '#8f8a7f',
    especies: ['microraptor', 'sinosauropteryx', 'psittacosaurus'],
    dato: 'Las cenizas volcánicas conservaron plumas, pelo y hasta colores.',
  },
  {
    id: 'clearwater', nombre: 'Mina Millennium (Formación Clearwater)', lugar: 'Alberta, Canadá', continente: 'Norteamérica',
    periodo: 'cretacico', ma: '~112 Ma', nivel: 7, costo: 130, roca: '#5d5650',
    especies: ['borealopelta'],
    dato: 'Hace 112 millones de años era un mar: el Borealopelta flotó hasta allí y se hundió boca arriba.',
  },
  {
    id: 'tendaguru', nombre: 'Tendaguru', lugar: 'Lindi, Tanzania', continente: 'África',
    periodo: 'jurasico', ma: '155–150 Ma', nivel: 7, costo: 120, roca: '#c09060',
    especies: ['kentrosaurus'],
    dato: 'De aquí salió el gran Giraffatitan que se exhibe en Berlín.',
  },
  {
    id: 'sichuan', nombre: 'Cuenca de Sichuan', lugar: 'Sichuan, China', continente: 'Asia',
    periodo: 'jurasico', ma: '160–145 Ma', nivel: 8, costo: 140, roca: '#a35d4a',
    especies: ['mamenchisaurus'],
    dato: 'Zigong, en Sichuan, tiene un museo construido sobre un yacimiento de dinosaurios.',
  },
  {
    id: 'niobrara', nombre: 'Creta de Niobrara', lugar: 'Kansas, EE.UU.', continente: 'Norteamérica',
    periodo: 'cretacico', ma: '87–82 Ma', nivel: 8, costo: 140, roca: '#dcd3b8',
    especies: ['pteranodon'],
    dato: 'Kansas estuvo bajo un mar interior lleno de reptiles marinos y peces gigantes.',
  },
  {
    id: 'patagonia', nombre: 'Patagonia', lugar: 'Neuquén y Chubut, Argentina', continente: 'Sudamérica',
    periodo: 'cretacico', ma: '130–69 Ma', nivel: 9, costo: 180, roca: '#b07a54',
    especies: ['argentinosaurus', 'giganotosaurus', 'carnotaurus', 'amargasaurus'],
    dato: 'Neuquén es tierra de gigantes: aquí vivieron algunos de los dinosaurios más grandes.',
  },
  {
    id: 'javelina', nombre: 'Big Bend (Formación Javelina)', lugar: 'Texas, EE.UU.', continente: 'Norteamérica',
    periodo: 'cretacico', ma: '68–66 Ma', nivel: 10, costo: 190, roca: '#c9a27a',
    especies: ['quetzalcoatlus'],
    dato: 'Hoy es un parque nacional en la frontera con México; entonces era una llanura con ríos.',
  },
  {
    id: 'kem_kem', nombre: 'Kem Kem y Bahariya', lugar: 'Marruecos y Egipto', continente: 'África',
    periodo: 'cretacico', ma: '100–93 Ma', nivel: 10, costo: 200, roca: '#d39a5e',
    especies: ['spinosaurus'],
    dato: 'Era un gran sistema de ríos repleto de peces enormes y depredadores.',
  },
  {
    id: 'maastricht', nombre: 'Canteras de Maastricht', lugar: 'Limburgo, Países Bajos', continente: 'Europa',
    periodo: 'cretacico', ma: '~68–66 Ma', nivel: 11, costo: 200, roca: '#e6dcc0',
    especies: ['mosasaurus'],
    dato: 'Da nombre a la última edad del Cretácico: el Maastrichtiense.',
  },
];
export const SITES_BY_ID = Object.fromEntries(SITES.map((s) => [s.id, s]));

// Hallazgos que no son huesos de dinosaurio: se venden o se exhiben.
export const CURIOS = [
  { id: 'amonita', nombre: 'Amonita', icono: '🐚', valor: 25, dato: 'Pariente de los pulpos con concha en espiral. Se extinguió junto a los dinosaurios.' },
  { id: 'ambar', nombre: 'Ámbar', icono: '🟠', valor: 40, dato: 'Resina de árbol fosilizada. A veces atrapa insectos… ¡y hasta plumas!' },
  { id: 'hoja', nombre: 'Hoja fósil', icono: '🍃', valor: 15, dato: 'Las plantas fósiles nos dicen cómo era el clima de cada época.' },
  { id: 'coprolito', nombre: 'Coprolito', icono: '💩', valor: 30, dato: '¡Popó fosilizada! Revela qué comían los animales.' },
  { id: 'diente_tiburon', nombre: 'Diente de tiburón', icono: '🦷', valor: 20, dato: 'Los tiburones cambian de dientes toda la vida, por eso hay tantos fósiles.' },
  { id: 'gastrolito', nombre: 'Gastrolito', icono: '🪨', valor: 18, dato: 'Piedras que algunos dinosaurios tragaban para ayudar a moler comida.' },
];

export const BONE_TYPES = [
  { id: 'craneo', nombre: 'Cráneo', w: 3, h: 2, adn: 18 },
  { id: 'femur', nombre: 'Fémur', w: 3, h: 1, adn: 12 },
  { id: 'vertebra', nombre: 'Vértebra', w: 2, h: 2, adn: 10 },
  { id: 'costilla', nombre: 'Costilla', w: 1, h: 3, adn: 8 },
  { id: 'garra', nombre: 'Garra', w: 1, h: 2, adn: 9 },
  { id: 'diente', nombre: 'Diente', w: 1, h: 1, adn: 6 },
];

// Tienda de mejoras.
export const UPGRADES = {
  incubadora: { nombre: 'Ranura de incubadora', icono: '🥚', precios: [500, 1200, 2500], max: 5, base: 2 },
  rapida: { nombre: 'Lámparas de calor', icono: '💡', precios: [800, 2000], max: 2, base: 0, dato: 'Cada nivel acelera la incubación un 25 %.' },
  energia: { nombre: 'Herramientas de excavación', icono: '⛏️', precios: [400, 1000, 2200], max: 3, base: 0, dato: '+6 golpes por excavación en cada nivel.' },
  mochila: { nombre: 'Mochila de expedición', icono: '🎒', precios: [600, 1500, 3000], max: 3, base: 0, dato: '+1 de energía máxima en cada nivel.' },
};

export const XP_LEVELS = [0, 60, 160, 320, 540, 820, 1180, 1620, 2150, 2780, 3500, 4350, 5300, 6400, 7700];
export const MAX_LEVEL = XP_LEVELS.length;

export function levelFromXp(xp) {
  let lvl = 1;
  for (let i = 0; i < XP_LEVELS.length; i += 1) if (xp >= XP_LEVELS[i]) lvl = i + 1;
  return lvl;
}
