/* ===========================================================================
   Les dessins de la synthese, en SVG et HTML simples.

   Regles tenues (cf. la charte et les bonnes pratiques de dataviz) :
   - une seule teinte par graphique quand il s'agit de grandeurs ; les couleurs
     d'etat (vert, ambre, rouge) sont reservees aux statuts et viennent
     toujours avec un libelle, jamais seules ;
   - chaque barre porte son chiffre : pas besoin de survoler pour lire ;
   - un titre (title) sur chaque marque pour le survol.
   =========================================================================== */

import { h, svg } from './dom.js';
import { formater } from './format.js';
import { grandir, tracer, sansAnimation } from './animations.js';

const COULEUR_NIVEAU = { vert: 'var(--vert)', ambre: 'var(--ambre)', rouge: 'var(--rouge)', neutre: 'var(--encre-tres-doux)' };
const FOND_NIVEAU = { vert: 'var(--vert-fond)', ambre: 'var(--ambre-fond)', rouge: 'var(--rouge-fond)', neutre: 'var(--surface-2)' };

export const couleurNiveau = (n) => COULEUR_NIVEAU[n] ?? COULEUR_NIVEAU.neutre;

export function pastilleNiveau(palier, texte) {
  if (!palier && !texte) return null;
  const n = palier?.niveau ?? 'neutre';
  const classe = n === 'neutre' ? '' : n;
  return h('span', { class: `jeton ${classe}` },
    h('span', { class: 'point', 'aria-hidden': 'true' }), texte ?? palier.libelle);
}

/* Barres horizontales : libelle, piste, chiffre. La part du total s'affiche
   en note quand on la demande. */
export function barres(items, { format = 'euro', total = null, animer = true, couleur = 'var(--petrole)' } = {}) {
  const max = Math.max(1, ...items.map((i) => Math.abs(i.valeur ?? 0)));
  return h('div', { class: 'barres' }, items.map((it, n) => {
    const v = it.valeur ?? 0;
    const largeur = `${Math.max(0, (Math.abs(v) / max) * 100)}%`;
    const part = total ? ` · ${formater(total ? v / total : null, 'pourcent')}` : '';
    const rempli = h('span', { class: 'remplissage', style: { width: largeur, background: it.couleur ?? couleur, transformOrigin: 'left center' } });
    if (animer) grandir(rempli, 80 + n * 60);
    return h('div', { class: 'barre', title: `${it.libelle} : ${formater(v, format)}${part}` },
      h('span', { class: 'libelle' }, it.libelle),
      h('span', { class: 'piste' }, rempli),
      h('span', { class: 'nombre' }, formater(it.valeur, format), total ? h('small', {}, part.replace(' · ', '')) : null));
  }));
}

/* Jauge a zones : la piste est decoupee selon les paliers, un repere marque
   la valeur. Les zones sont pales, le repere est a l'encre : c'est lui
   qu'on lit. */
export function jaugeZones(jauge, { animer = true } = {}) {
  const max = Number(jauge.echelle_max) || Math.max(...jauge.paliers.map((p) => p.seuil ?? 0)) * 1.5 || 1;
  const larg = 300, haut = 30, y = 9, ep = 10;
  const x = (v) => Math.max(0, Math.min(larg, (v / max) * larg));
  // Les seuils ordonnes de gauche a droite, quel que soit le sens
  const bornes = jauge.paliers.filter((p) => p.seuil !== null && p.seuil !== '' && p.seuil !== undefined).map((p) => Number(p.seuil));
  const zones = [];
  if (jauge.sens === 'haut') {
    // paliers du meilleur (seuil haut) au pire : on les remet de gauche a droite
    const tri = [...jauge.paliers].reverse();
    tri.forEach((p, i) => {
      const de = p.seuil === null || p.seuil === undefined || p.seuil === '' ? 0 : Number(p.seuil);
      const a = i + 1 < tri.length ? Number(tri[i + 1].seuil ?? max) : max;
      zones.push({ de, a: Math.max(a, de), p });
    });
  } else {
    let debut = 0;
    for (const p of jauge.paliers) {
      const fin = p.seuil === null || p.seuil === undefined || p.seuil === '' ? max : Number(p.seuil);
      zones.push({ de: debut, a: fin, p });
      debut = fin;
    }
  }
  const v = jauge.valeur;
  const dessin = svg('svg', { viewBox: `0 0 ${larg} ${haut}`, class: 'jauge-zones', role: 'img', 'aria-label': `${jauge.libelle} : ${formater(v, formatJauge(jauge))}` },
    zones.map((z) => svg('rect', {
      x: x(z.de), y, width: Math.max(0, x(z.a) - x(z.de)), height: ep,
      fill: FOND_NIVEAU[z.p.niveau] ?? FOND_NIVEAU.neutre,
    }, svg('title', {}, z.p.libelle))),
    bornes.map((b) => svg('line', { x1: x(b), x2: x(b), y1: y, y2: y + ep, stroke: 'var(--surface)', 'stroke-width': 2 })),
    // La position est en attribut (lu par la capture PDF) ; l'animation passe
    // par la propriete CSS, qui l'emporte le temps qu'elle dure.
    v === null || v === undefined ? null : svg('g', { class: 'repere', transform: `translate(${x(v)} 0)` },
      svg('line', { x1: 0, x2: 0, y1: y - 6, y2: y + ep + 6, stroke: 'var(--encre)', 'stroke-width': 2.5, 'stroke-linecap': 'round' }),
      svg('circle', { cx: 0, cy: y - 6, r: 3.2, fill: 'var(--encre)' })));
  if (animer && v !== null && v !== undefined && !sansAnimation()) {
    const g = dessin.querySelector('.repere');
    g?.animate?.([{ transform: 'translateX(0px)' }, { transform: `translateX(${x(v)}px)` }], { duration: 700, easing: 'cubic-bezier(.22,.8,.3,1)' });
  }
  return dessin;
}

export const formatJauge = (j) => (j.format ?? (j.echelle_max > 5 ? 'euro' : 'pourcent'));

/* Texte des seuils, ecrit a partir des paliers : la legende ne peut plus
   contredire le calcul, comme c'etait le cas dans le classeur. */
export function legendeSeuils(jauge, format) {
  const morceaux = [];
  const ps = jauge.paliers;
  ps.forEach((p, i) => {
    const s = p.seuil;
    if (s === null || s === undefined || s === '') {
      const prec = ps[i - 1]?.seuil;
      morceaux.push(`${jauge.sens === 'haut' ? '< ' : '≥ '}${formater(Number(prec), format)} : ${p.libelle.toLowerCase()}`);
    } else {
      morceaux.push(`${jauge.sens === 'haut' ? '≥ ' : '< '}${formater(Number(s), format)} : ${p.libelle.toLowerCase()}`);
    }
  });
  return morceaux.join(' · ');
}

/* Demi-cercle du score. */
export function demiCercle(valeur, max, palier, { animer = true } = {}) {
  const r = 80, cx = 100, cy = 96, ep = 16;
  const arc = (p) => {
    const a = Math.PI * (1 - p);
    return [cx + r * Math.cos(a), cy - r * Math.sin(a)];
  };
  const p = Math.max(0, Math.min(1, (valeur ?? 0) / (max || 100)));
  const [x0, y0] = arc(0);
  const [x1, y1] = arc(1);
  const [xv, yv] = arc(p);
  const longueur = Math.PI * r * p;
  const valeurArc = svg('path', {
    d: `M ${x0} ${y0} A ${r} ${r} 0 0 1 ${xv} ${yv}`, fill: 'none',
    stroke: couleurNiveau(palier?.niveau), 'stroke-width': ep, 'stroke-linecap': 'round',
    'stroke-dasharray': `${longueur} ${longueur}`,
  });
  if (animer && p > 0) tracer(valeurArc, longueur);
  return svg('svg', { viewBox: '0 0 200 112', class: 'demi-cercle', role: 'img', 'aria-label': `Score ${formater(valeur, 'nombre')} sur ${max}` },
    svg('path', { d: `M ${x0} ${y0} A ${r} ${r} 0 0 1 ${x1} ${y1}`, fill: 'none', stroke: 'var(--surface-3)', 'stroke-width': ep, 'stroke-linecap': 'round' }),
    p > 0 ? valeurArc : null,
    svg('text', { x: 18, y: 110, class: 'graduation', 'text-anchor': 'middle' }, '0'),
    svg('text', { x: 182, y: 110, class: 'graduation', 'text-anchor': 'middle' }, String(max)));
}

/* Barre de progression d'un critere de score : x / max. */
export function critere(c, { animer = true } = {}) {
  const p = Math.max(0, Math.min(1, (c.valeur ?? 0) / (c.max || 1)));
  const rempli = h('span', { class: 'remplissage', style: { width: `${p * 100}%`, transformOrigin: 'left center' } });
  if (animer) grandir(rempli, 200);
  return h('div', { class: 'barre critere', title: `${c.libelle} : ${c.valeur ?? '—'} / ${c.max}` },
    h('span', { class: 'libelle' }, c.libelle),
    h('span', { class: 'piste' }, rempli),
    h('span', { class: 'nombre' }, `${formater(c.valeur, 'nombre')} / ${c.max}`));
}
