// Genera los íconos de la app (PWA) a partir del dibujo del juego.
// Uso: node scripts/generar-iconos.mjs   (requiere el paquete "sharp")
import { writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { SPECIES_BY_ID } from '../js/data/species.js';
import { dinoSVG } from '../js/render/dino-svg.js';

const require = createRequire(import.meta.url);
const sharp = require(process.env.SHARP_PATH || 'sharp');

const sp = SPECIES_BY_ID.parasaurolophus;
const genes = {
  seed: 7, sexo: 'M', hue1: 145, hue2: 45, sat: 48, luz: 44,
  patron: ['rayas', 'liso'], variante: ['N', 'N'], stats: { ...sp.stats }, mutaciones: 0, generacion: 1,
};

function icon(size, padding) {
  const inner = size - padding * 2;
  const art = dinoSVG(sp, genes, { stage: 'cria', mood: 'radiante', noShadow: true })
    .replace('<svg class="dino-svg"', `<svg x="${padding}" y="${padding + inner * 0.06}" width="${inner}" height="${inner * 0.8}" class="dino-svg"`);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <defs><linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff3d6"/><stop offset="1" stop-color="#f4bf5e"/></linearGradient></defs>
    <rect width="${size}" height="${size}" fill="url(#bg)"/>
    <circle cx="${size * 0.76}" cy="${size * 0.24}" r="${size * 0.11}" fill="#fff" opacity=".85"/>
    <path d="M0,${size * 0.7} C${size * 0.3},${size * 0.6} ${size * 0.7},${size * 0.66} ${size},${size * 0.62} L${size},${size} L0,${size} Z" fill="#2e6a4e"/>
    ${art}
  </svg>`;
}

const outputs = [
  ['icons/icon-192.png', 192, 10],
  ['icons/icon-512.png', 512, 28],
  ['icons/icon-maskable-512.png', 512, 90],
  ['icons/apple-touch-icon.png', 180, 12],
];
for (const [file, size, pad] of outputs) {
  await sharp(Buffer.from(icon(size, pad))).png().toFile(file);
  console.log('✓', file);
}
await writeFile('icons/icon.svg', icon(512, 28));
console.log('✓ icons/icon.svg');
