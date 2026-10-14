/* ===========================================================================
   Le panneau « Equilibre du mois », colle a droite de la saisie : chaque
   montant tape fait bouger l'anneau. Sur telephone, il se resume en une
   barre collee en haut (reste a vivre, sections faites, bande de couleurs).

   Memes categories et memes couleurs que la repartition de la synthese.
   =========================================================================== */

import { h, icone, svg, vider } from './dom.js?v=743faf48c0';
import { formater } from './format.js?v=743faf48c0';
import { pastilleNiveau } from './graphiques.js?v=743faf48c0';

const R = 64;
const TOUR = 2 * Math.PI * R;
const ECART = 3; // filet entre deux segments, en unites du dessin

export function creerPanneau({ racine, config, surSynthese }) {
  const cats = (config.repartition ?? []).map((r, n) => ({ ...r, couleur: `var(--cat-${(n % 5) + 1})` }));
  const arcs = cats.map((c) => svg('circle', {
    cx: 80, cy: 80, r: R, fill: 'none', stroke: c.couleur, 'stroke-width': 18,
    'stroke-dasharray': `0 ${TOUR}`, class: 'arc', transform: 'rotate(-90 80 80)',
  }, svg('title', {}, c.libelle)));
  const arcReste = svg('circle', { cx: 80, cy: 80, r: R, fill: 'none', 'stroke-width': 18, 'stroke-dasharray': `0 ${TOUR}`, class: 'arc reste', transform: 'rotate(-90 80 80)' });
  const anneau = svg('svg', { viewBox: '0 0 160 160', class: 'anneau-equilibre', 'aria-hidden': 'true' },
    svg('circle', { cx: 80, cy: 80, r: R, fill: 'none', class: 'piste', 'stroke-width': 18 }), arcReste, arcs);

  const libelleCentre = h('span', { class: 'libelle-centre' }, 'Reste à vivre');
  const chiffreCentre = h('strong', { class: 'chiffre-centre' }, '—');
  const surCentre = h('span', { class: 'sur-centre' });
  const parJour = h('p', { class: 'par-jour', hidden: true });
  const legende = h('ul', { class: 'legende-panneau' });
  const tuileEffort = h('div', { class: 'mini-tuile' });
  const tuileScore = h('div', { class: 'mini-tuile' });
  const avance = h('p', { class: 'avance' });

  // Version telephone : une ligne et une bande
  const compactChiffre = h('strong');
  const compactAvance = h('span', { class: 'compact-avance' });
  const compactBande = h('div', { class: 'bande compacte' });

  vider(racine,
    h('div', { class: 'panneau-complet' },
      h('p', { class: 'surtitre' }, 'Équilibre du mois'),
      h('div', { class: 'cadran' }, anneau, h('div', { class: 'centre-anneau' }, libelleCentre, chiffreCentre, surCentre)),
      parJour,
      legende,
      h('div', { class: 'mini-tuiles' }, tuileEffort, tuileScore),
      h('button', { type: 'button', class: 'bouton grand', onclick: surSynthese }, 'Voir la synthèse et le PDF', icone('suite')),
      avance),
    h('div', { class: 'panneau-compact' },
      h('div', { class: 'ligne-compacte' },
        h('span', { class: 'compact-libelle' }, 'Reste à vivre'), compactChiffre, compactAvance,
        h('button', { type: 'button', class: 'bouton bouton-rond', 'aria-label': 'Voir la synthèse et le PDF', onclick: surSynthese }, icone('suite'))),
      compactBande));

  return {
    rafraichir(resultat, { faites, total, vide: rienSaisi }) {
      const v = resultat.valeurs;
      const ressources = Math.max(0, v.total_ressources ?? 0);
      // Sans ressources, un « deficit » ne voudrait rien dire : on attend.
      const vide = rienSaisi || !ressources;
      const valeurs = cats.map((c) => Math.max(0, v[c.indicateur] ?? 0));
      const depenses = valeurs.reduce((t, x) => t + x, 0);
      const echelle = Math.max(ressources, depenses) || 1;
      const reste = v.solde_apres_dettes;
      const negatif = (reste ?? 0) < 0;

      // L'anneau : un arc par categorie, puis le reste en vert pale.
      let debut = 0;
      const poser = (arc, part) => {
        const long = Math.max(0, part * TOUR - (part > 0 ? ECART : 0));
        arc.setAttribute('stroke-dasharray', `${long} ${TOUR}`);
        arc.setAttribute('stroke-dashoffset', String(-debut));
        debut += part * TOUR;
      };
      // Sans ressources, l'anneau reste vide : un seul poste ferait le tour complet.
      cats.forEach((c, i) => poser(arcs[i], vide ? 0 : valeurs[i] / echelle));
      poser(arcReste, !vide && ressources > depenses ? (ressources - depenses) / echelle : 0);

      libelleCentre.textContent = vide ? 'Reste à vivre' : negatif ? 'Déficit' : 'Reste à vivre';
      chiffreCentre.textContent = vide ? '—' : formater(Math.abs(reste ?? 0), 'euro');
      chiffreCentre.classList.toggle('negatif', !vide && negatif);
      surCentre.textContent = vide ? 'en attente des ressources' : `sur ${formater(ressources, 'euro')}`;

      const personnes = v.total_personnes;
      parJour.hidden = vide || negatif || !personnes || !(reste > 0);
      if (!parJour.hidden) vider(parJour, '≈ ', h('strong', {}, formater(reste / personnes / 30, 'euro')), ' par personne et par jour');

      vider(legende, cats.map((c, i) => h('li', { class: valeurs[i] ? '' : 'sans-valeur' },
        h('span', { class: 'pastille-legende', style: { background: c.couleur } }),
        h('span', { class: 'nom' }, c.libelle.replace(/\s*\(.*\)$/, '')),
        h('strong', {}, valeurs[i] ? formater(valeurs[i], 'euro') : '—'))));

      const effort = resultat.jauges.find((j) => j.indicateur === 'taux_effort_logement');
      vider(tuileEffort, h('span', { class: 'etiquette' }, effort?.libelle ?? 'Taux d’effort'),
        h('strong', {}, formater(effort?.valeur, 'pourcent')), effort?.palier ? pastilleNiveau(effort.palier) : null);
      const sc = resultat.score;
      vider(tuileScore, h('span', { class: 'etiquette' }, 'Score'),
        h('strong', {}, rienSaisi || !sc ? '—' : `${formater(sc.valeur, 'nombre')}`, h('small', {}, sc ? ` / ${sc.max}` : '')),
        !rienSaisi && sc?.palier ? pastilleNiveau(sc.palier) : null);

      const restant = total - faites;
      avance.textContent = restant ? `${faites} étape${faites > 1 ? 's' : ''} sur ${total} complétée${faites > 1 ? 's' : ''} · plus que ${restant} !` : `Les ${total} étapes sont complètes.`;

      compactChiffre.textContent = vide ? '—' : `${negatif ? '−' : ''}${formater(Math.abs(reste ?? 0), 'euro')}`;
      compactChiffre.classList.toggle('negatif', !vide && negatif);
      compactAvance.textContent = `· ${faites} / ${total} étapes`;
      vider(compactBande,
        cats.map((c, i) => (valeurs[i] ? h('span', { class: 'segment', style: { flexGrow: String(valeurs[i]), background: c.couleur } }) : null)),
        ressources > depenses ? h('span', { class: 'segment reste', style: { flexGrow: String(ressources - depenses) } }) : null,
        vide ? h('span', { class: 'segment reste', style: { flexGrow: '1' } }) : null);
    },
  };
}
