/* ===========================================================================
   La presentation animee de l'outil, facon motion design : environ une
   minute pour comprendre a quoi sert l'outil, pour qui, ce qu'il fait et
   comment, sans entrer dans les calculs. Pensee pour ouvrir une reunion.

   Elle se lance a chaque ouverture du calculateur (rien n'est retenu d'une
   visite a l'autre) ; « Passer » la ferme, le bouton « Presentation » du
   rail la relance. Espace : pause ; fleches : scene precedente / suivante ;
   Echap : passer.

   Tout est dessine en HTML et SVG et anime par l'API Web Animations : pas
   de fichier video a heberger, net a toutes les tailles, et la pause fige
   tout (animations, compteurs, progression) d'un seul geste.
   =========================================================================== */

import { h, svg, vider } from './dom.js?v=b602aab638';
import { dessinIcone } from './icones.js?v=b602aab638';

const LARGEUR = 1280;
const HAUTEUR = 720;
const DOUX = 'cubic-bezier(.22,.8,.3,1)';
const RESSORT = 'cubic-bezier(.34,1.56,.64,1)';
const reduit = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

const TRACES = {
  lecture: 'M7 4.5v15l12-7.5-12-7.5Z',
  pause: 'M8 5v14M16 5v14',
  precedent: 'M15 18l-6-6 6-6',
  suivant: 'M9 18l6-6-6-6',
  passer: 'M5 5l7 7-7 7M13 5l7 7-7 7',
  ecran: 'M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5',
  ok: 'M20 6 9 17l-5-5',
  fleche: 'M5 12h14M13 6l6 6-6 6',
  cadenas: 'M6 11h12v9H6zM8.5 11V8a3.5 3.5 0 0 1 7 0v3',
  revoir: 'M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5',
  telecharger: 'M12 3v12M7 10l5 5 5-5M5 21h14',
  lien: 'M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1',
  reglage: 'M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6',
};
const trait = (nom, attrs = {}) => svg('svg', {
  viewBox: '0 0 24 24', fill: nom === 'lecture' ? 'currentColor' : 'none', stroke: 'currentColor', 'stroke-width': nom === 'lecture' ? 0 : 2.2,
  'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true', ...attrs,
}, svg('path', { d: TRACES[nom] }));
const illus = (nom) => dessinIcone(nom);

/* ------------------------------------------------------- outils d'animation */

/* Toutes les animations d'une scene passent par ici : en mouvement reduit,
   on garde l'apparition en fondu, sans deplacement. */
function jouer(el, images, { delai = 0, duree = 650, ease = DOUX } = {}) {
  if (!el) return null;
  let imgs = images;
  if (reduit()) imgs = images.map((i) => (i.opacity === undefined ? { opacity: 1 } : { opacity: i.opacity }));
  return el.animate(imgs, { delay: delai, duration: reduit() ? Math.min(duree, 250) : duree, easing: ease, fill: 'both' });
}
const entrer = (el, delai = 0, { dy = 26, dx = 0, duree = 650 } = {}) =>
  jouer(el, [{ opacity: 0, transform: `translate(${dx}px, ${dy}px)` }, { opacity: 1, transform: 'none' }], { delai, duree });
const surgir = (el, delai = 0, duree = 560) =>
  jouer(el, [{ opacity: 0, transform: 'scale(.55)' }, { opacity: 1, transform: 'scale(1)' }], { delai, duree, ease: RESSORT });
const tracer = (el, delai = 0, duree = 900) =>
  jouer(el, [{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], { delai, duree });
const deployer = (el, delai = 0, duree = 800, axe = 'X') =>
  jouer(el, [{ transform: `scale${axe}(0)` }, { transform: `scale${axe}(1)` }], { delai, duree });

/* Un compteur qui suit le temps d'une animation : il se fige avec la pause. */
let compteurs = [];
function compter(el, de, a, { delai = 0, duree = 1200, format = (x) => String(Math.round(x)) } = {}) {
  el.textContent = format(de);
  const horloge = el.animate([{ opacity: 1 }, { opacity: 1 }], { delay: delai, duration: reduit() ? 1 : duree, fill: 'both' });
  const c = { horloge, actif: true };
  compteurs.push(c);
  const tic = () => {
    if (!c.actif) return;
    const t = Math.max(0, Math.min(1, ((horloge.currentTime ?? 0) - delai) / (reduit() ? 1 : duree)));
    const e = 1 - (1 - t) ** 3;
    el.textContent = format(de + (a - de) * e);
    if (horloge.playState === 'finished') { el.textContent = format(a); return; }
    requestAnimationFrame(tic);
  };
  requestAnimationFrame(tic);
}
const euros = (x) => `${Math.round(x).toLocaleString('fr-FR')} €`;

/* Le clic simule : un cercle qui s'elargit et s'efface. */
function clic(parent, x, y, delai) {
  const c = h('span', { class: 'clic-sc', style: { left: `${x}px`, top: `${y}px` } });
  parent.append(c);
  jouer(c, [{ opacity: 0, transform: 'scale(.4)' }, { opacity: 1, transform: 'scale(.6)', offset: 0.3 }, { opacity: 0, transform: 'scale(1.6)' }], { delai, duree: 700 });
}

/* ================================================================== scenes */

const SCENES = [
  { titre: 'La dinguerie de val', duree: 6000, construire: ouverture },
  { titre: 'Pour qui ?', duree: 8500, construire: pourQui },
  { titre: 'Ce qui change', duree: 7500, construire: avantApres },
  { titre: '1 · Saisir', duree: 9000, construire: saisir },
  { titre: '2 · Comprendre', duree: 9500, construire: comprendre },
  { titre: '3 · Proposer', duree: 9500, construire: proposer },
  { titre: 'La synthèse PDF', duree: 7500, construire: synthesePdf },
  { titre: 'Depuis Power BI', duree: 8000, construire: powerBi },
  { titre: 'En confiance', duree: 7000, construire: confiance },
  { titre: 'À vous de jouer', duree: 6000, construire: fin },
];

function mots(texte, delai, pas = 90) {
  return texte.split(' ').map((m, i) => {
    const s = h('span', { class: 'mot' }, m);
    s.dataset.delai = String(delai + i * pas);
    return [s, ' '];
  });
}
const animerMots = (racine) => racine.querySelectorAll('.mot').forEach((m) => entrer(m, Number(m.dataset.delai), { dy: 30, duree: 600 }));

function ouverture() {
  const logo = h('div', { class: 'sc-logo' }, 'DV');
  const titre = h('h3', { class: 'sc-titre' }, mots('La dinguerie de val', 700, 120));
  const sous = h('p', { class: 'sc-texte' }, 'Le diagnostic budgétaire des locataires en difficulté de paiement');
  const puces = ['Saisir', 'Comprendre', 'Proposer'].map((t) => h('span', { class: 'puce-sc' }, t));
  const fleches = [trait('fleche', { class: 'fleche-trio' }), trait('fleche', { class: 'fleche-trio' })];
  const trio = h('div', { class: 'trio' }, puces[0], fleches[0], puces[1], fleches[1], puces[2]);
  const racine = h('div', { class: 'sc sc-ouverture' }, logo, titre, sous, trio);
  return {
    racine,
    animer() {
      surgir(logo, 150, 800);
      jouer(logo, [{ transform: 'rotate(-8deg)' }, { transform: 'rotate(0deg)' }], { delai: 150, duree: 900, ease: RESSORT });
      animerMots(racine);
      entrer(sous, 1500);
      puces.forEach((p, i) => surgir(p, 2400 + i * 450));
      fleches.forEach((f, i) => entrer(f, 2650 + i * 450, { dx: -14, dy: 0, duree: 400 }));
    },
  };
}

function pourQui() {
  const sur = h('p', { class: 'sc-sur' }, 'Le point de départ');
  const titre = h('h3', { class: 'sc-titre' }, 'Un loyer qui ne passe plus.');
  const libelles = ['mai', 'juin', 'juil.', 'août', 'sept.', 'oct.'];
  const cases = libelles.map((m, i) => h('div', { class: 'mois-sc' }, h('b', {}, i < 2 ? trait('ok') : i === 5 ? '?' : '!'), m));
  const compte = h('span', { class: 'compte-impayes' }, '');
  const frise = h('div', { class: 'frise-sc' }, cases, compte);
  const titre2 = h('p', { class: 'sc-texte' }, 'Pour aider le ménage, il faut d’abord ', h('strong', {}, 'comprendre son budget'), ' et proposer une solution ', h('strong', {}, 'qu’il peut tenir'), '.');
  const ligne = svg('path', { d: 'M0 20 H240', stroke: '#8fb2ea', 'stroke-width': 3, 'stroke-dasharray': '1', pathLength: 1, fill: 'none' });
  const pointilles = svg('path', { d: 'M0 20 H240', stroke: 'var(--nuit)', 'stroke-width': 4, 'stroke-dasharray': '6 8', fill: 'none' });
  const menage = h('div', { class: 'personne' }, h('span', { class: 'rond' }, illus('famille')), 'Le ménage');
  const conseiller = h('div', { class: 'personne' }, h('span', { class: 'rond' }, illus('conseiller')), 'Le conseiller');
  const lien = h('div', { class: 'lien-personnes' }, h('span', {}, 'un entretien'), svg('svg', { viewBox: '0 0 240 40' }, ligne, pointilles));
  const duo = h('div', { class: 'duo-personnes' }, menage, lien, conseiller);
  const legende = h('p', { class: 'sc-legende' }, 'Pour les ', h('strong', {}, 'conseillers et chargés d’accompagnement'), ' qui reçoivent les locataires en impayé.');
  const racine = h('div', { class: 'sc' }, sur, titre, frise, titre2, duo, legende);
  return {
    racine,
    animer() {
      entrer(sur, 100); entrer(titre, 250);
      cases.forEach((c, i) => {
        entrer(c, 800 + i * 160, { dy: 18, duree: 450 });
        if (i >= 2 && i < 5) {
          c.classList.add('impaye');
          jouer(c.querySelector('b'), [{ background: 'rgba(255,255,255,.1)', color: '#9fe0bd', transform: 'scale(1)' }, { background: 'var(--rouge)', color: '#fff', transform: 'scale(1.12)', offset: 0.6 }, { background: 'var(--rouge)', color: '#fff', transform: 'scale(1)' }], { delai: 1900 + (i - 2) * 350, duree: 500 });
        }
        if (i === 5) c.classList.add('encours');
      });
      entrer(compte, 2900, { dx: -20, dy: 0 });
      compter(compte, 0, 3, { delai: 2900, duree: 800, format: (x) => `≈ ${Math.round(x)} mois d’impayés` });
      entrer(titre2, 3800);
      surgir(menage, 4700); surgir(conseiller, 5000);
      tracer(ligne, 5200, 700); entrer(lien.querySelector('span'), 5600, { dy: 8 });
      entrer(legende, 6200);
    },
  };
}

function avantApres() {
  const sur = h('p', { class: 'sc-sur' }, 'Ce qui change');
  const titre = h('h3', { class: 'sc-titre' }, 'D’un classeur à une page web.');
  const cellules = Array.from({ length: 36 }, (_, i) => h('span', { class: i === 22 ? 'err' : '' }, i === 22 ? '#DIV/0!' : ''));
  const rature = h('span', { class: 'barre-rature' });
  const avant = h('div', { class: 'carte-sc verre', style: { position: 'relative' } },
    h('h4', {}, 'Avant'), h('div', { class: 'tableur' }, cellules),
    h('p', {}, 'Un classeur Excel, des macros, des calculs à refaire et à vérifier à chaque entretien.'), rature);
  const fleche = trait('fleche', { class: 'fleche-sc', 'stroke-width': 1.6 });
  const nav = h('div', { class: 'navigateur' },
    h('div', { class: 'barre-nav-sc' }, h('i'), h('i'), h('i')),
    h('div', { class: 'corps-nav-sc' }, h('span', { class: 'plein' }), h('span'), h('span', { class: 'vert' }), h('span')));
  const puces = ['Rien à installer', 'Résultat immédiat', 'Synthèse PDF'].map((t) => h('span', { class: 'puce-sc' }, trait('ok'), t));
  const apres = h('div', { class: 'carte-sc verre' }, h('h4', {}, 'Maintenant'), nav, h('div', { class: 'puces-apres' }, puces));
  const racine = h('div', { class: 'sc' }, sur, titre, h('div', { class: 'duo-avant' }, avant, fleche, apres));
  return {
    racine,
    animer() {
      entrer(sur, 100); entrer(titre, 250);
      entrer(avant, 700);
      cellules.forEach((c, i) => jouer(c, [{ opacity: 0 }, { opacity: 1 }], { delai: 900 + i * 28, duree: 200 }));
      jouer(cellules[22], [{ transform: 'scale(1)' }, { transform: 'scale(1.25)' }, { transform: 'scale(1)' }], { delai: 2100, duree: 500 });
      deployer(rature, 3000, 500);
      jouer(avant, [{ opacity: 1, transform: 'scale(1)' }, { opacity: 0.45, transform: 'scale(.94)' }], { delai: 3300, duree: 600 });
      entrer(fleche, 3500, { dx: -30, dy: 0 });
      surgir(apres, 3900, 700);
      puces.forEach((p, i) => entrer(p, 4700 + i * 300, { dy: 14 }));
    },
  };
}

const ETAPES = [
  { icone: 'dossier', titre: 'Dossier', note: 'facultatif', montant: null },
  { icone: 'famille', titre: 'Situation du foyer', note: '3 personnes', montant: 670 },
  { icone: 'alerte', titre: 'Dettes', note: 'loyer et crédits', montant: 5600 },
  { icone: 'portefeuille', titre: 'Ressources', note: 'salaires, aides', montant: 3170 },
  { icone: 'recu', titre: 'Charges', note: 'fixes et courantes', montant: 2329 },
  { icone: 'etincelle', titre: 'Dépenses', note: 'facultatives', montant: 40 },
];

function anneau(rayon, epaisseur, parts) {
  const tour = 2 * Math.PI * rayon;
  const arcs = [];
  let debut = 0;
  const piste = svg('circle', { cx: 125, cy: 125, r: rayon, fill: 'none', stroke: 'rgba(255,255,255,.12)', 'stroke-width': epaisseur });
  for (const p of parts) {
    const long = Math.max(0, p.part * tour - 4);
    arcs.push(svg('circle', {
      cx: 125, cy: 125, r: rayon, fill: 'none', stroke: p.couleur, 'stroke-width': epaisseur,
      'stroke-dasharray': `${long} ${tour}`, 'stroke-dashoffset': String(-debut), 'stroke-linecap': 'butt',
    }));
    debut += p.part * tour;
  }
  return { dessin: svg('svg', { viewBox: '0 0 250 250' }, piste, arcs), arcs, tour };
}

function saisir() {
  const sur = h('p', { class: 'sc-sur' }, '1 · Saisir');
  const titre = h('h3', { class: 'sc-titre' }, 'Six étapes guidées, pendant l’entretien.');
  const cartes = ETAPES.map((e) => {
    const coche = h('span', { class: 'coche-sc' }, trait('ok', { width: 26, height: 26 }));
    const montant = h('span', { class: 'montant-sc' }, e.montant === null ? '' : '—');
    const carte = h('div', { class: 'etape-sc verre' },
      h('span', { class: 'medaillon-sc' }, illus(e.icone), coche),
      h('div', {}, h('small', {}, e.note), h('strong', {}, e.titre)), montant);
    return { carte, coche, montant, e };
  });
  const parts = [
    { part: 0.28, couleur: 'var(--cat-1)' }, { part: 0.19, couleur: 'var(--cat-2)' }, { part: 0.35, couleur: 'var(--cat-3)' },
    { part: 0.013, couleur: 'var(--cat-4)' }, { part: 0.15, couleur: 'rgba(159,224,189,.55)' },
  ];
  const a = anneau(100, 26, parts);
  const reste = h('strong', {}, '—');
  const equilibre = h('div', { class: 'equilibre-sc verre' }, h('h4', {}, 'Équilibre du mois'),
    h('div', { class: 'anneau-sc' }, a.dessin, h('div', { class: 'centre-sc' }, h('span', {}, 'Reste à vivre'), reste)));
  const puces = ['Semaine, mois ou année', 'Additions « 25+12+8 »', 'Données de démo'].map((t) => h('span', { class: 'puce-sc' }, t));
  const racine = h('div', { class: 'sc' }, sur, titre,
    h('div', { class: 'grille-saisir' }, h('div', {}, h('div', { class: 'etapes-sc' }, cartes.map((c) => c.carte)), h('div', { class: 'puces-saisir' }, puces)), equilibre));
  return {
    racine,
    animer() {
      entrer(sur, 100); entrer(titre, 250);
      entrer(equilibre, 600, { dx: 30, dy: 0 });
      cartes.forEach((c, i) => {
        const t = 900 + i * 650;
        entrer(c.carte, t, { dy: 20 });
        surgir(c.coche, t + 450, 420);
        if (c.e.montant !== null) compter(c.montant, 0, c.e.montant, { delai: t + 150, duree: 600, format: euros });
      });
      a.arcs.forEach((arc, i) => jouer(arc, [{ opacity: 0 }, { opacity: 1 }], { delai: 2400 + i * 520, duree: 500 }));
      compter(reste, 0, 201, { delai: 4300, duree: 1300, format: euros });
      puces.forEach((p, i) => surgir(p, 5600 + i * 300));
    },
  };
}

function jaugeSc(libelle, valeur, position, niveau, pastille) {
  const curseur = h('span', { class: 'curseur-sc', style: { left: `${position}%` } });
  const el = h('div', { class: 'jauge-sc' },
    h('div', { class: 'tete-jauge-sc' }, h('span', {}, libelle), h('strong', {}, valeur)),
    h('div', { class: 'zones-sc' }, h('i', { class: 'z-rouge' }), h('i', { class: 'z-ambre' }), h('i', { class: 'z-vert' }), curseur),
    h('div', { class: 'sens-sc' }, h('span', {}, 'fragile'), h('span', { class: `etiquette-sc ${niveau}`, style: { fontSize: '14px', padding: '2px 10px' } }, pastille), h('span', {}, 'solide')));
  return { el, curseur, position };
}

function comprendre() {
  const sur = h('p', { class: 'sc-sur' }, '2 · Comprendre');
  const titre = h('h3', { class: 'sc-titre' }, 'Le budget se lit d’un coup d’œil.');
  const parts = [
    { part: 0.39, couleur: 'var(--cat-1)' }, { part: 0.19, couleur: 'var(--cat-2)' }, { part: 0.35, couleur: 'var(--cat-3)' },
    { part: 0.013, couleur: 'var(--cat-4)' }, { part: 0.06, couleur: 'rgba(159,224,189,.6)' },
  ];
  const a = anneau(100, 30, parts);
  const reste = h('strong', {}, '0 €');
  const donut = h('div', { class: 'anneau-sc', style: { width: '290px', height: '290px' } }, a.dessin, h('div', { class: 'centre-sc' }, h('span', {}, 'Reste à vivre'), reste));
  // Le score : demi-cercle, aiguille de 0 a 30 %
  const fond = svg('path', { d: 'M20 170 A140 140 0 0 1 300 170', fill: 'none', stroke: 'rgba(255,255,255,.14)', 'stroke-width': 26, 'stroke-linecap': 'round' });
  const arc = svg('path', { d: 'M20 170 A140 140 0 0 1 300 170', fill: 'none', stroke: '#d9534f', 'stroke-width': 26, 'stroke-linecap': 'round', pathLength: 1, 'stroke-dasharray': '0.3 1' });
  const chiffre = h('span', {}, '0');
  const score = h('div', { class: 'score-sc' }, svg('svg', { viewBox: '0 0 320 190' }, fond, arc),
    h('div', { class: 'chiffre-score-sc' }, chiffre, h('small', {}, ' %')),
    h('span', { class: 'etiquette-sc rouge' }, 'Situation critique'),
    h('span', { style: { fontSize: '17px', color: '#b9cdea', marginTop: '6px' } }, 'Score de fragilité'));
  const jauges = [
    jaugeSc('Taux d’effort logement', '38,9 %', 30, 'ambre', 'fragile'),
    jaugeSc('Reste à vivre par personne', '106 €', 12, 'rouge', 'très fragile'),
    jaugeSc('Endettement global', '10,1 %', 62, 'ambre', 'à surveiller'),
  ];
  const legende = h('p', { class: 'sc-legende' }, 'Chaque montant saisi ', h('strong', {}, 'met à jour le résultat'), ' : on voit tout de suite où part l’argent.');
  const racine = h('div', { class: 'sc' }, sur, titre,
    h('div', { class: 'grille-comprendre' }, donut, score, h('div', { class: 'jauges-sc' }, jauges.map((j) => j.el))), legende);
  return {
    racine,
    animer() {
      entrer(sur, 100); entrer(titre, 250);
      surgir(donut, 600, 700);
      a.arcs.forEach((arc2, i) => jouer(arc2, [{ opacity: 0, strokeWidth: 0 }, { opacity: 1, strokeWidth: 30 }], { delai: 900 + i * 350, duree: 500 }));
      compter(reste, 0, 201, { delai: 1200, duree: 1500, format: euros });
      entrer(score, 1800);
      jouer(arc, [{ strokeDasharray: '0 1' }, { strokeDasharray: '0.3 1' }], { delai: 2300, duree: 1400 });
      compter(chiffre, 0, 30, { delai: 2300, duree: 1400 });
      jauges.forEach((j, i) => {
        entrer(j.el, 3600 + i * 450, { dx: 30, dy: 0 });
        jouer(j.curseur, [{ left: '100%' }, { left: `${j.position}%` }], { delai: 3900 + i * 450, duree: 1100 });
      });
      entrer(legende, 6200);
    },
  };
}

function proposer() {
  const sur = h('p', { class: 'sc-sur' }, '3 · Proposer');
  const titre = h('h3', { class: 'sc-titre' }, 'Un plan d’apurement ', h('em', {}, 'tenable'), '.');
  const pouce = h('span', { class: 'pouce', style: { left: '80%' } });
  const rempli = h('span', { class: 'rempli', style: { transform: 'scaleX(.8)' } });
  const mensualite = h('span', {}, '40 €');
  const duree = h('span', {}, '140');
  const plan = h('div', { class: 'plan-sc verre' },
    h('div', { class: 'dette-sc' }, 'Dette locative', h('strong', {}, '5 600 €')),
    h('div', { class: 'curseur-plan' }, rempli, pouce),
    h('div', { class: 'formule-plan' }, mensualite, h('small', {}, ' par mois  ×  '), duree, h('small', {}, ' mois')));
  const SC = [
    { titre: '40 €', duree: 140, couleur: '#d9534f' },
    { titre: '90 €', duree: 63, couleur: '#e0a030' },
    { titre: '160 €', duree: 35, couleur: '#5ccf9a' },
  ];
  const max = 150;
  const barres = SC.map((s) => h('span', { class: 'barre-sc', style: { width: `${(s.duree / max) * 100}%`, background: s.couleur } }, `${s.duree} mois`));
  const cible = h('span', { class: 'cible-sc', style: { left: `calc(150px + 16px + (100% - 166px) * ${36 / max})` } }, h('span', {}, 'cible 36 mois'));
  const scenarios = h('div', { class: 'scenarios-sc' }, SC.map((s, i) => h('div', { class: 'scenario-sc' }, h('span', {}, `${s.titre} / mois`), h('div', { class: 'piste-sc' }, barres[i]))), cible);
  const leviers = [['banque', 'Mobiliser le FSL'], ['recu', 'Revoir les charges'], ['conseiller', 'Accompagnement budgétaire']]
    .map(([i, t]) => h('span', { class: 'puce-sc' }, illus(i), t));
  const legende = h('p', { class: 'sc-legende' }, 'Le simulateur compare chaque mensualité à la ', h('strong', {}, 'durée cible'), ' et propose des leviers concrets.');
  const racine = h('div', { class: 'sc' }, sur, titre,
    h('div', { class: 'grille-proposer' }, plan, h('div', {}, scenarios)), h('div', { class: 'leviers-sc' }, leviers), legende);
  return {
    racine,
    animer() {
      entrer(sur, 100); entrer(titre, 250);
      entrer(plan, 700);
      // le curseur glisse : 40 -> 90 -> 160 euros
      const etapes = [[0.12, 40, 140], [0.42, 90, 63], [0.8, 160, 35]];
      jouer(pouce, [{ left: '12%' }, { left: '12%', offset: 0.15 }, { left: '42%', offset: 0.45 }, { left: '42%', offset: 0.6 }, { left: '80%' }], { delai: 1200, duree: 3400 });
      jouer(rempli, [{ transform: 'scaleX(.12)' }, { transform: 'scaleX(.12)', offset: 0.15 }, { transform: 'scaleX(.42)', offset: 0.45 }, { transform: 'scaleX(.42)', offset: 0.6 }, { transform: 'scaleX(.8)' }], { delai: 1200, duree: 3400 });
      compter(mensualite, etapes[0][1], etapes[1][1], { delai: 1700, duree: 1000, format: euros });
      compter(duree, etapes[0][2], etapes[1][2], { delai: 1700, duree: 1000 });
      setTimeoutAnime(racine, 2900, () => {
        compter(mensualite, etapes[1][1], etapes[2][1], { duree: 1300, format: euros });
        compter(duree, etapes[1][2], etapes[2][2], { duree: 1300 });
      });
      barres.forEach((b, i) => deployer(b, 2000 + i * 700, 900));
      entrer(cible, 4200, { dy: -10 });
      leviers.forEach((l, i) => surgir(l, 5600 + i * 350));
      entrer(legende, 6800);
    },
  };
}

/* Un declenchement differe qui respecte la pause : une animation vide sert
   d'horloge. */
function setTimeoutAnime(racine, delai, f) {
  const horloge = racine.animate([{ opacity: 1 }, { opacity: 1 }], { delay: delai, duration: 1, fill: 'none' });
  horloge.onfinish = () => { if (racine.isConnected) f(); };
}

function synthesePdf() {
  const sur = h('p', { class: 'sc-sur' }, 'La synthèse');
  const titre = h('h3', { class: 'sc-titre' }, 'Un document clair, à partager.');
  const points = ['Le bilan en une phrase', 'Le budget et le score expliqués', 'Le plan et les leviers retenus']
    .map((t) => h('li', {}, trait('ok'), t));
  const blocs = [
    h('div', { class: 'bloc-pdf entete-pdf' }),
    h('div', { class: 'bloc-pdf lignes-pdf' }, h('span', { style: { width: '80%' } }), h('span', { style: { width: '60%' } })),
    h('div', { class: 'bloc-pdf barres-pdf' }, ['var(--cat-1)', 'var(--cat-2)', 'var(--cat-3)', 'var(--cat-4)', '#2f9e6e'].map((c, i) => h('i', { style: { background: c, height: `${[90, 55, 75, 20, 35][i]}%` } }))),
    h('div', { class: 'bloc-pdf jauge-pdf' }),
    h('div', { class: 'bloc-pdf lignes-pdf' }, h('span', { style: { width: '90%' } }), h('span', { style: { width: '70%' } }), h('span', { style: { width: '50%' } })),
  ];
  const bouton = h('span', { class: 'bouton-pdf' }, trait('telecharger'), 'Télécharger le PDF');
  const fichier = h('span', { class: 'fichier-sc' }, h('b', {}, 'PDF'), 'diagnostic-budgetaire.pdf');
  const page = h('div', { class: 'page-pdf' }, blocs, bouton, fichier);
  const racine = h('div', { class: 'sc' }, h('div', { class: 'grille-pdf' },
    h('div', {}, sur, titre, h('ul', { class: 'points-pdf' }, points)), page));
  return {
    racine,
    animer() {
      entrer(sur, 100); entrer(titre, 250);
      entrer(page, 500, { dy: 60, duree: 800 });
      blocs.forEach((b, i) => entrer(b, 1000 + i * 320, { dy: 14, duree: 450 }));
      blocs[2].querySelectorAll('i').forEach((b, i) => deployer(b, 1700 + i * 90, 500, 'Y'));
      points.forEach((p, i) => entrer(p, 1400 + i * 500, { dx: -24, dy: 0 }));
      surgir(bouton, 3300);
      clic(page, 300, 375, 4200);
      jouer(bouton, [{ transform: 'scale(1)' }, { transform: 'scale(.93)' }, { transform: 'scale(1)' }], { delai: 4200, duree: 300 });
      jouer(fichier, [{ opacity: 0, transform: 'translateY(40px) scale(.8)' }, { opacity: 1, transform: 'translateY(0) scale(1)' }], { delai: 4700, duree: 700, ease: RESSORT });
    },
  };
}

function powerBi() {
  const sur = h('p', { class: 'sc-sur' }, 'Depuis Power BI');
  const titre = h('h3', { class: 'sc-titre' }, 'Un clic, un diagnostic pré-rempli.');
  const lignes = [['LOC-0017', '540 €', '820 €'], ['LOC-0042', '650 €', '1 200 €'], ['LOC-0108', '710 €', '2 950 €'], ['LOC-0231', '480 €', '310 €']];
  const rangees = lignes.map((l) => h('div', { class: 'rangee-pbi', style: { position: 'relative' } }, l.map((c) => h('span', {}, c)), h('span', { class: 'bouton-pbi' }, 'Diagnostic')));
  const tableau = h('div', { class: 'tableau-pbi verre' }, h('h4', {}, 'Tableau de bord'),
    h('div', { class: 'rangee-pbi tete' }, h('span', {}, 'Locataire'), h('span', {}, 'Loyer'), h('span', {}, 'Dette'), h('span')), rangees);
  const tape = h('span', { class: 'tape' }, '…/dinguerie_du_val/#', h('b', {}, 'adultes=2&loyer=650&dette_locative=1200'));
  const url = h('div', { class: 'url-sc' }, tape);
  const champs = [['Adultes', '2'], ['Loyer', '650 €'], ['Dette locative', '1 200 €']]
    .map(([l, v]) => h('div', { class: 'champ-pbi verre' }, h('small', {}, l, h('i', {}, 'lien')), h('strong', {}, v)));
  const sansNom = h('p', { class: 'sans-nom' }, trait('cadenas'), 'Composition, logement, dette : jamais de nom dans le lien.');
  const legende = h('p', { class: 'sc-legende' }, 'L’administration écrit pour vous la ', h('strong', {}, 'formule DAX'), ' qui fabrique ces liens dans Power BI.');
  const racine = h('div', { class: 'sc' }, sur, titre,
    h('div', { class: 'grille-pbi' }, tableau, h('div', { class: 'droite-pbi' }, url, h('div', { class: 'champs-pbi' }, champs), sansNom)), legende);
  return {
    racine,
    animer() {
      entrer(sur, 100); entrer(titre, 250);
      entrer(tableau, 600);
      rangees.forEach((r, i) => entrer(r, 900 + i * 150, { dy: 10, duree: 400 }));
      setTimeoutAnime(racine, 2000, () => rangees[1].classList.add('choisie'));
      clic(rangees[1], 340, 22, 2000);
      entrer(url, 2500, { dx: 30, dy: 0 });
      jouer(tape, [{ maxWidth: '0px' }, { maxWidth: '800px' }], { delai: 2700, duree: 1700, ease: 'steps(40, end)' });
      champs.forEach((c, i) => {
        surgir(c, 4400 + i * 300);
        jouer(c, [{ boxShadow: '0 0 0 0 rgba(159,224,189,.9)' }, { boxShadow: '0 0 0 14px rgba(159,224,189,0)' }], { delai: 4700 + i * 300, duree: 800 });
      });
      entrer(sansNom, 5600);
      entrer(legende, 6300);
    },
  };
}

function confiance() {
  const sur = h('p', { class: 'sc-sur' }, 'En confiance');
  const titre = h('h3', { class: 'sc-titre' }, 'Rien n’est conservé.');
  const atouts = [
    [trait('cadenas'), 'Aucune donnée stockée', 'Fermer ou actualiser la page efface tout : le ménage repart avec son PDF, rien ne reste.'],
    [illus('envoi'), 'Aucun envoi', 'Tout se calcule dans le navigateur. Aucun serveur ne reçoit la saisie.'],
    [trait('reglage'), 'Paramétrable', 'Barèmes, seuils et formules se règlent dans l’administration, sans développeur.'],
  ].map(([i, t, p]) => h('div', { class: 'atout-sc verre' }, h('span', { class: 'rond' }, i), h('strong', {}, t), h('p', {}, p)));
  const racine = h('div', { class: 'sc' }, sur, titre, h('div', { class: 'trois-sc' }, atouts));
  return {
    racine,
    animer() {
      entrer(sur, 100); entrer(titre, 250);
      atouts.forEach((a, i) => {
        entrer(a, 900 + i * 600, { dy: 40, duree: 700 });
        surgir(a.querySelector('.rond'), 1100 + i * 600);
      });
    },
  };
}

function fin(ctx) {
  const logo = h('div', { class: 'sc-logo' }, 'DV');
  const titre = h('h3', { class: 'sc-titre' }, 'La dinguerie de val');
  const sous = h('p', { class: 'sc-texte' }, 'Saisir · Comprendre · Proposer — un diagnostic partagé, en un entretien.');
  const commencer = h('button', { type: 'button', onclick: () => ctx.fermer() }, 'Commencer un diagnostic', trait('fleche'));
  const revoir = h('button', { type: 'button', class: 'second', onclick: () => ctx.aller(0) }, trait('revoir'), 'Revoir');
  const actions = h('div', { class: 'actions-fin' }, commencer, revoir);
  const racine = h('div', { class: 'sc sc-fin' }, logo, titre, sous, actions);
  return {
    racine,
    animer() {
      surgir(logo, 100, 700);
      entrer(titre, 400); entrer(sous, 800);
      entrer(actions, 1300);
    },
  };
}

/* ============================================================== le lecteur */

/* Le decor : des facettes qui derivent lentement, comme le motif du rail. */
function decor() {
  const facettes = [
    svg('polygon', { points: '1280,0 1280,260 1000,0', fill: '#6f9bde', opacity: 0.14 }),
    svg('polygon', { points: '1280,0 1280,140 1130,0', fill: '#fff', opacity: 0.05 }),
    svg('polygon', { points: '0,720 0,470 300,720', fill: '#4d77bd', opacity: 0.16 }),
    svg('path', { d: 'M40 380 L170 510 L40 640', fill: 'none', stroke: '#6f9bde', 'stroke-width': 40, opacity: 0.1 }),
    svg('path', { d: 'M110 380 L240 510 L110 640', fill: 'none', stroke: '#8fb2ea', 'stroke-width': 40, opacity: 0.07 }),
  ];
  const d = svg('svg', { class: 'pres-decor', viewBox: `0 0 ${LARGEUR} ${HAUTEUR}`, preserveAspectRatio: 'xMidYMid slice', 'aria-hidden': 'true' }, facettes);
  if (!reduit()) {
    facettes.forEach((f, i) => f.animate(
      [{ transform: 'translate(0,0)' }, { transform: `translate(${i % 2 ? -26 : 26}px, ${i % 3 ? 18 : -18}px)` }],
      { duration: 9000 + i * 1300, direction: 'alternate', iterations: Infinity, easing: 'ease-in-out' },
    ));
  }
  return d;
}

let ouverte = null;

export function lancerPresentation() {
  if (ouverte) return ouverte;
  const retourFocus = document.activeElement;
  let index = 0;
  let enPause = false;
  let progression = null;

  const segments = SCENES.map((s, i) => h('button', {
    type: 'button', class: 'pres-segment', 'aria-label': `Scène ${i + 1} : ${s.titre}`, title: s.titre, onclick: () => aller(i),
  }, h('span', {}, h('i'))));
  const passer = h('button', { type: 'button', class: 'pres-passer', onclick: () => fermer() }, 'Passer', trait('passer'));
  const scene = h('div', { class: 'pres-scene' });
  const contenu = h('div', { style: { position: 'absolute', inset: '0' } });
  scene.append(contenu);
  const cadre = h('div', { class: 'pres-cadre' }, scene);
  const titreScene = h('p', { class: 'pres-titre-scene', 'aria-live': 'polite' });
  const bPause = h('button', { type: 'button', class: 'pres-bouton principal', onclick: () => basculer() });
  const commandes = h('div', { class: 'pres-commandes' },
    h('button', { type: 'button', class: 'pres-bouton', 'aria-label': 'Scène précédente', onclick: () => aller(Math.max(0, index - 1)) }, trait('precedent')),
    bPause,
    h('button', { type: 'button', class: 'pres-bouton', 'aria-label': 'Scène suivante', onclick: () => aller(Math.min(SCENES.length - 1, index + 1)) }, trait('suivant')),
    document.fullscreenEnabled ? h('button', { type: 'button', class: 'pres-bouton', 'aria-label': 'Plein écran', title: 'Plein écran', onclick: () => pleinEcran() }, trait('ecran')) : null);
  const racine = h('div', { class: 'presentation', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Présentation de La dinguerie de val' },
    decor(),
    h('div', { class: 'pres-haut' }, h('div', { class: 'pres-segments' }, segments), passer),
    cadre,
    h('div', { class: 'pres-bas' }, titreScene, commandes, h('span', { class: 'pres-titre-scene', 'aria-hidden': 'true', style: { visibility: 'hidden' } }, '')),
    h('p', { class: 'pres-astuce' }, 'Tournez le téléphone pour agrandir la vidéo.'));

  const ajuster = () => {
    const l = cadre.clientWidth - 24;
    const ht = cadre.clientHeight - 8;
    scene.style.transform = `translate(-50%, -50%) scale(${Math.max(0.1, Math.min(l / LARGEUR, ht / HAUTEUR))})`;
  };

  function majPause() {
    vider(bPause, trait(enPause ? 'lecture' : 'pause'));
    bPause.setAttribute('aria-label', enPause ? 'Lecture' : 'Pause');
  }

  function basculer(forcer) {
    enPause = forcer ?? !enPause;
    for (const a of racine.getAnimations({ subtree: true })) {
      if (a.effect?.getComputedTiming?.().iterations === Infinity) continue; // le decor continue
      if (enPause) a.pause(); else if (a.playState === 'paused') a.play();
    }
    majPause();
  }

  function aller(i) {
    index = i;
    compteurs.forEach((c) => { c.actif = false; });
    compteurs = [];
    progression?.cancel();
    for (const a of contenu.getAnimations({ subtree: true })) a.cancel();
    const s = SCENES[i];
    const sc = s.construire({ fermer, aller });
    vider(contenu, sc.racine);
    sc.animer();
    jouer(sc.racine, [{ opacity: 0 }, { opacity: 1 }], { duree: 350 });
    segments.forEach((seg, n) => {
      seg.classList.toggle('vu', n < i);
      seg.setAttribute('aria-current', n === i ? 'step' : 'false');
    });
    titreScene.textContent = `${i + 1} / ${SCENES.length} · ${s.titre}`;
    const barre = segments[i].querySelector('i');
    progression = barre.animate([{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }], { duration: s.duree, fill: 'forwards' });
    progression.onfinish = () => {
      if (!racine.isConnected) return;
      if (i < SCENES.length - 1) aller(i + 1);
    };
    if (enPause) basculer(true);
  }

  function pleinEcran() {
    if (document.fullscreenElement) document.exitFullscreen?.();
    else racine.requestFullscreen?.().catch(() => {});
  }

  function clavier(e) {
    if (e.key === 'Escape') { e.preventDefault(); fermer(); }
    else if (e.key === ' ' && !(e.target instanceof HTMLButtonElement)) { e.preventDefault(); basculer(); }
    else if (e.key === 'ArrowRight') aller(Math.min(SCENES.length - 1, index + 1));
    else if (e.key === 'ArrowLeft') aller(Math.max(0, index - 1));
    else if (e.key === 'Tab') {
      // le focus reste dans la presentation
      const f = [...racine.querySelectorAll('button')].filter((b) => b.offsetParent !== null);
      if (!f.length) return;
      if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
    }
  }

  function fermer() {
    if (!racine.isConnected) return;
    window.removeEventListener('resize', ajuster);
    document.removeEventListener('keydown', clavier, true);
    compteurs.forEach((c) => { c.actif = false; });
    if (document.fullscreenElement) document.exitFullscreen?.();
    const sortie = racine.animate([{ opacity: 1 }, { opacity: 0 }], { duration: reduit() ? 1 : 300, fill: 'forwards' });
    sortie.onfinish = () => racine.remove();
    document.documentElement.style.overflow = '';
    ouverte = null;
    const cible = retourFocus instanceof HTMLElement && retourFocus.isConnected && retourFocus !== document.body ? retourFocus : document.querySelector('main h2');
    cible?.focus?.({ preventScroll: true });
  }

  document.body.append(racine);
  document.documentElement.style.overflow = 'hidden';
  window.addEventListener('resize', ajuster);
  document.addEventListener('keydown', clavier, true);
  ajuster();
  majPause();
  aller(0);
  bPause.focus({ preventScroll: true }); // Espace = pause, sans risquer de tout fermer
  ouverte = { fermer, aller, racine };
  return ouverte;
}

/* Le bouton « Presentation » du rail, sur toutes les pages qui l'ont. */
export function brancherBoutonPresentation() {
  document.getElementById('bouton-presentation')?.addEventListener('click', () => lancerPresentation());
}
