// Quiz de paleontología: premia monedas, XP y ADN.
import { buildQuiz } from '../../data/quiz.js';
import { SPECIES_BY_ID } from '../../data/species.js';
import { knownSpecies, addMoney, addXp, addDna } from '../../systems/game.js';
import { esc } from '../dom.js';

const N = 5;
let q = null;

export function render(el, params, app) {
  if (!q) intro(el, app);
  else if (q.i >= q.items.length) summary(el, app);
  else question(el, app);
}

function intro(el, app) {
  el.innerHTML = `<div class="quiz"><a href="#/mas" class="small">← Volver</a>
    <div class="view-head"><div><h1>Quiz</h1><p class="muted">${N} preguntas sobre las especies que ya descubriste y sobre el mundo de los dinosaurios. Cada acierto da 15 monedas y un poco de ADN.</p></div></div>
    <button class="btn btn-block" type="button" data-start>Empezar</button></div>`;
  el.querySelector('[data-start]').addEventListener('click', () => {
    q = { items: buildQuiz(knownSpecies(app.state), N), i: 0, ok: 0, res: [], answered: null };
    app.sfx.tap();
    render(el, [], app);
  });
}

function question(el, app) {
  const item = q.items[q.i];
  const a = q.answered;
  el.innerHTML = `<div class="quiz">
    <div class="dots" aria-label="Progreso">${q.items.map((_, i) => `<i class="${i < q.res.length ? (q.res[i] ? 'on' : 'bad') : ''}"></i>`).join('')}</div>
    <p class="quiz-q">${esc(item.q)}</p>
    <div class="quiz-opts">${item.opciones.map((o, i) => {
      let cls = '';
      if (a !== null && i === item.ok) cls = ' right';
      else if (a === i) cls = ' wrong';
      return `<button class="quiz-opt${cls}" type="button" data-opt="${i}" ${a !== null ? 'disabled' : ''}>${esc(o)}</button>`;
    }).join('')}</div>
    ${a !== null ? `<div class="quiz-explain">${a === item.ok ? '✅ ¡Correcto!' : '❌ Casi.'} ${esc(item.explica)}</div>
      <button class="btn btn-block" type="button" data-next style="margin-top:12px">${q.i + 1 < q.items.length ? 'Siguiente pregunta' : 'Ver resultado'}</button>` : ''}
  </div>`;
  el.querySelectorAll('[data-opt]').forEach((b) => b.addEventListener('click', () => {
    q.answered = +b.dataset.opt;
    const right = q.answered === item.ok;
    q.res.push(right);
    if (right) q.ok += 1;
    (right ? app.sfx.ok : app.sfx.no)();
    render(el, [], app);
  }));
  const next = el.querySelector('[data-next]');
  if (next) {
    next.focus();
    next.addEventListener('click', () => { q.i += 1; q.answered = null; render(el, [], app); });
  }
}

function summary(el, app) {
  const perfect = q.ok === q.items.length;
  const coins = q.ok * 15 + (perfect ? 50 : 0);
  let dnaMsg = '';
  if (!q.paid) {
    q.paid = true;
    const known = knownSpecies(app.state);
    app.do((s) => {
      addMoney(s, coins);
      addXp(s, 10 + q.ok * 4);
      s.contadores.quizzes += 1;
      if (perfect) s.contadores.quizPerfecto += 1;
      if (known.length && q.ok) {
        const id = known[Math.floor(Math.random() * known.length)];
        addDna(s, id, q.ok * 1.5);
        q.dna = { id, pct: q.ok * 1.5 };
      }
      return null;
    }, { render: false, sound: false });
    app.sfx.coin();
  }
  if (q.dna) dnaMsg = ` y ${q.dna.pct} % de ADN de ${SPECIES_BY_ID[q.dna.id].corto || SPECIES_BY_ID[q.dna.id].nombre}`;
  el.innerHTML = `<div class="quiz">
    <div class="view-head"><div><h1>${perfect ? '¡Perfecto!' : `${q.ok} de ${q.items.length}`}</h1><p class="muted">Ganaste ${coins} monedas${dnaMsg}.</p></div></div>
    <div class="dots">${q.res.map((r) => `<i class="${r ? 'on' : 'bad'}"></i>`).join('')}</div>
    <div style="display:flex;gap:8px;margin-top:16px;flex-wrap:wrap">
      <button class="btn" type="button" data-again>Otro quiz</button>
      <a class="btn btn-ghost" href="#/dinopedia">Repasar en la Dinopedia</a>
    </div></div>`;
  el.querySelector('[data-again]').addEventListener('click', () => { q = null; render(el, [], app); });
}

export function leave() {
  if (q && q.i >= q.items.length) q = null;
}
