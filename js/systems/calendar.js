// Fechas del mundo real: día de juego, semana y bonus del día.
// Todo usa la hora local del dispositivo.

const DAY_MS = 24 * 60 * 60 * 1000;

export function dayKey(now = Date.now()) {
  const d = new Date(now);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Días completos entre dos claves YYYY-MM-DD (b - a). */
export function daysBetween(a, b) {
  const pa = a.split('-').map(Number);
  const pb = b.split('-').map(Number);
  const ta = Date.UTC(pa[0], pa[1] - 1, pa[2]);
  const tb = Date.UTC(pb[0], pb[1] - 1, pb[2]);
  return Math.round((tb - ta) / DAY_MS);
}

export function msToMidnight(now = Date.now()) {
  const d = new Date(now);
  const next = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
  return next.getTime() - now;
}

/** Número de semana (lunes a domingo) desde una fecha fija. */
export function weekIndex(now = Date.now()) {
  const d = new Date(now);
  const monday = new Date(d.getFullYear(), d.getMonth(), d.getDate() - ((d.getDay() + 6) % 7));
  const base = Date.UTC(2024, 0, 1); // lunes
  return Math.floor((Date.UTC(monday.getFullYear(), monday.getMonth(), monday.getDate()) - base) / (7 * DAY_MS));
}

export function msToWeekEnd(now = Date.now()) {
  const d = new Date(now);
  const daysLeft = 7 - ((d.getDay() + 6) % 7);
  const end = new Date(d.getFullYear(), d.getMonth(), d.getDate() + daysLeft);
  return end.getTime() - now;
}

// Un bonus distinto cada día de la semana (0 = domingo).
export const DAY_BONUSES = [
  { id: 'visitantes', icono: '🎪', titulo: 'Domingo de feria', desc: 'Los visitantes pagan 50 % más.' },
  { id: 'excavacion', icono: '⛏️', titulo: 'Lunes de campo', desc: '+8 golpes en cada excavación.' },
  { id: 'quiz', icono: '🎓', titulo: 'Martes de ciencia', desc: 'El quiz paga el doble de monedas.' },
  { id: 'mercado', icono: '🛒', titulo: 'Miércoles de mercado', desc: 'La comida cuesta 30 % menos.' },
  { id: 'regalos', icono: '🎁', titulo: 'Jueves de regalos', desc: 'Tus dinosaurios dejan regalos el doble de seguido.' },
  { id: 'crecimiento', icono: '🌱', titulo: 'Viernes de estirón', desc: 'Las crías crecen 50 % más rápido.' },
  { id: 'concursos', icono: '🏆', titulo: 'Sábado de campeones', desc: 'Los premios de los concursos se duplican.' },
];

export function dayBonus(now = Date.now()) {
  return DAY_BONUSES[new Date(now).getDay()];
}

export function hasBonus(id, now = Date.now()) {
  return dayBonus(now).id === id;
}
