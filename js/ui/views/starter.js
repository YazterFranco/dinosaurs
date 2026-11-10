// Pantalla de bienvenida: elegir el primer huevo.
import { SPECIES_BY_ID, DIETS, SPECIES } from '../../data/species.js';
import { STARTERS, chooseStarter } from '../../systems/game.js';
import { eggSVG } from '../../render/dino-svg.js';
import { dinoArt } from '../../render/art.js';
import { esc } from '../dom.js';

const BLURB = {
  protoceratops: 'Herbívoro del tamaño de una oveja. Vive en manada en el desierto de Gobi.',
  oviraptor: 'Omnívoro emplumado que cuidaba sus nidos como un ave.',
  compsognathus: 'Carnívoro diminuto y veloz de las islas del Jurásico.',
};

export function render(el, params, app) {
  const hero = SPECIES_BY_ID.parasaurolophus;
  el.innerHTML = `<section class="starter">
    <h1>Dino Refugio</h1>
    ${dinoArt(hero, null, { anim: true, stage: 'adulto', title: 'Un Parasaurolophus te da la bienvenida', className: 'starter-hero', viewer: true, maxWidth: 520 })}
    <p class="lead">Bienvenido a tu estación de campo. Aquí excavarás fósiles reales, recuperarás su ADN y criarás a ${SPECIES.length} especies prehistóricas mientras aprendes cómo vivieron. Para empezar, elige tu primer huevo.</p>
    <div class="starter-eggs">
      ${STARTERS.map((id) => {
        const sp = SPECIES_BY_ID[id];
        const d = DIETS[sp.dieta];
        return `<button class="starter-egg" type="button" data-id="${id}">
          ${eggSVG(sp, null, { wobble: true })}
          <b>${esc(sp.nombre)}</b>
          <span class="tag">${d.icono} ${d.nombre}</span>
          <span class="small muted">${esc(BLURB[id])}</span>
        </button>`;
      }).join('')}
    </div>
  </section>`;
  el.querySelectorAll('.starter-egg').forEach((b) => b.addEventListener('click', () => {
    app.sfx.hatch();
    app.do((s) => chooseStarter(s, b.dataset.id), { toast: false, render: false });
    app.save();
    app.go('criadero');
  }));
}
