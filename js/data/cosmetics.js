// Accesorios cosméticos. Se dibujan en las coordenadas locales de la cabeza
// (ojo en ex, ey; parte superior en top). Dan un pequeño bonus en el
// concurso de belleza y se consiguen en cofres.

const INK = '#2d2a24';

export const ACCESSORIES = {
  mono: {
    nombre: 'Moño', icono: '🎀', rareza: 'comun', bonus: 4,
    svg: (ex, ey, top) => `<g transform="translate(${ex - 6} ${top + 3})"><path d="M0,0 l-6,-5 v10 z M0,0 l6,-5 v10 z" fill="#e8708f" stroke="${INK}" stroke-width="1.2" stroke-linejoin="round"/><circle r="2" fill="#c94b6d" stroke="${INK}" stroke-width="1"/></g>`,
  },
  flor: {
    nombre: 'Flor de magnolia', icono: '🌸', rareza: 'comun', bonus: 4,
    svg: (ex, ey, top) => `<g transform="translate(${ex - 9} ${top + 4})">${[0, 72, 144, 216, 288].map((a) => `<ellipse rx="2.6" ry="4.4" transform="rotate(${a}) translate(0 -3.6)" fill="#fbe3ef" stroke="${INK}" stroke-width=".9"/>`).join('')}<circle r="1.8" fill="#f2c14e"/></g>`,
  },
  bufanda: {
    nombre: 'Bufanda de rayas', icono: '🧣', rareza: 'comun', bonus: 4,
    svg: () => `<g transform="translate(-6 2)"><path d="M-8,0 q6,6 14,4 l1,5 q-9,3 -16,-3 z" fill="#d9534a" stroke="${INK}" stroke-width="1.2"/><path d="M-6,2 l2,4 M-1,4 l1,4" stroke="#fff" stroke-width="1.6"/><path d="M-6,4 l-3,9 l4,-1 l2,-6" fill="#d9534a" stroke="${INK}" stroke-width="1.1"/></g>`,
  },
  gafas: {
    nombre: 'Gafas de sol', icono: '😎', rareza: 'rara', bonus: 8,
    svg: (ex, ey) => `<g><path d="M${ex - 5},${ey - 1} h10 M${ex - 7},${ey - 2} l-4,-1" stroke="${INK}" stroke-width="1.4" fill="none"/><rect x="${ex - 4}" y="${ey - 3}" width="8" height="5.5" rx="2.2" fill="#22303a" stroke="${INK}" stroke-width="1"/><path d="M${ex - 2.5},${ey - 1.8} l2,0" stroke="#9fd3e3" stroke-width="1"/></g>`,
  },
  gorro_fiesta: {
    nombre: 'Gorro de fiesta', icono: '🎉', rareza: 'rara', bonus: 8,
    svg: (ex, ey, top) => `<g transform="translate(${ex - 3} ${top + 2}) rotate(-12)"><path d="M-6,0 L0,-17 L6,0 Z" fill="#5ea8c0" stroke="${INK}" stroke-width="1.3" stroke-linejoin="round"/><path d="M-4,-5 l7,-2 M-2,-10 l4,-1" stroke="#f2c14e" stroke-width="1.6"/><circle cy="-17.5" r="2.2" fill="#e8708f" stroke="${INK}" stroke-width="1"/></g>`,
  },
  sombrero: {
    nombre: 'Sombrero de explorador', icono: '🤠', rareza: 'rara', bonus: 8,
    svg: (ex, ey, top) => `<g transform="translate(${ex - 3} ${top + 3}) rotate(-6)"><ellipse rx="12" ry="2.8" fill="#c9a66b" stroke="${INK}" stroke-width="1.3"/><path d="M-7,-1 C-7,-11 7,-11 7,-1 Z" fill="#d8b97f" stroke="${INK}" stroke-width="1.3"/><path d="M-7,-2.5 h14" stroke="#7a5a3c" stroke-width="2"/></g>`,
  },
  casco_minero: {
    nombre: 'Casco de minero', icono: '⛑️', rareza: 'epica', bonus: 12,
    svg: (ex, ey, top) => `<g transform="translate(${ex - 3} ${top + 3}) rotate(-8)"><path d="M-9,0 C-9,-12 9,-12 9,0 Z" fill="#f2c14e" stroke="${INK}" stroke-width="1.3"/><rect x="-11" y="-1" width="22" height="3" rx="1.5" fill="#e0a52b" stroke="${INK}" stroke-width="1.1"/><circle cx="6" cy="-6" r="2.8" fill="#fff8d0" stroke="${INK}" stroke-width="1"/><path d="M9,-6 l9,-3 v7 z" fill="#fff6b0" opacity=".55"/></g>`,
  },
  corona: {
    nombre: 'Corona', icono: '👑', rareza: 'epica', bonus: 12,
    svg: (ex, ey, top) => `<g transform="translate(${ex - 3} ${top + 2}) rotate(-8)"><path d="M-7,0 L-8,-9 L-3.5,-4.5 L0,-11 L3.5,-4.5 L8,-9 L7,0 Z" fill="#f2c14e" stroke="${INK}" stroke-width="1.3" stroke-linejoin="round"/><circle cy="-3" r="1.4" fill="#d9534a"/><circle cx="-4.5" cy="-2" r="1" fill="#5ea8c0"/><circle cx="4.5" cy="-2" r="1" fill="#5ea8c0"/></g>`,
  },
  corona_ambar: {
    nombre: 'Corona de ámbar', icono: '🟠', rareza: 'legendaria', bonus: 20,
    svg: (ex, ey, top) => `<g transform="translate(${ex - 3} ${top + 2}) rotate(-8)"><path d="M-8,0 L-9,-10 L-4,-5 L0,-13 L4,-5 L9,-10 L8,0 Z" fill="#c98a2b" stroke="${INK}" stroke-width="1.3" stroke-linejoin="round"/><ellipse cy="-5.5" rx="3.2" ry="4" fill="#f6b13c" stroke="${INK}" stroke-width="1"/><path d="M-1,-6 l2,1 M0,-7 v3" stroke="${INK}" stroke-width=".7"/><ellipse cx="-1.2" cy="-7.2" rx=".8" ry="1.3" fill="#fff" opacity=".7"/></g>`,
  },
};

export const ACCESSORY_IDS = Object.keys(ACCESSORIES);
export const ACCESSORY_BY_RARITY = ACCESSORY_IDS.reduce((acc, id) => {
  (acc[ACCESSORIES[id].rareza] ||= []).push(id);
  return acc;
}, {});
