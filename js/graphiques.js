/* ===========================================================================
   Les dessins de la synthese, en SVG et HTML simples.

   Regles tenues (cf. la charte et les bonnes pratiques de dataviz) :
   - une seule teinte par graphique quand il s'agit de grandeurs ; les couleurs
     d'etat (vert, ambre, rouge) sont reservees aux statuts et viennent
     toujours avec un libelle, jamais seules ;
   - chaque barre porte son chiffre : pas besoin de survoler pour lire ;
   - un titre (title) sur chaque marque pour le survol.
   =========================================================================== */

import { h, svg } from './dom.js?v=b0bda1646f';
import { formater } from './format.js?v=b0bda1646f';
import { grandir, tracer, sansAnimation } from './animations.js?v=b0bda1646f';

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

/* Demi-cercle du score. Sous l'arc de valeur, la piste est decoupee en
   zones pales selon les paliers : on voit d'un coup d'oeil ou tombe le score.
   Variante « clair » pour un fond sombre (le bandeau de bilan). */
export function demiCercle(valeur, max, palier, { animer = true, zones = [], clair = false } = {}) {
  const r = 80, cx = 100, cy = 96, ep = clair ? 12 : 16;
  const point = (p) => {
    const a = Math.PI * (1 - p);
    return [cx + r * Math.cos(a), cy - r * Math.sin(a)];
  };
  const arc = (p0, p1) => {
    const [x0, y0] = point(p0);
    const [x1, y1] = point(p1);
    return `M ${x0} ${y0} A ${r} ${r} 0 0 1 ${x1} ${y1}`;
  };
  const m = max || 100;
  const p = Math.max(0, Math.min(1, (valeur ?? 0) / m));
  const longueur = Math.PI * r * p;
  const valeurArc = svg('path', {
    d: arc(0, p), fill: 'none',
    stroke: clair ? '#fff' : couleurNiveau(palier?.niveau), 'stroke-width': ep, 'stroke-linecap': 'round',
    'stroke-dasharray': `${longueur} ${longueur}`,
  });
  if (animer && p > 0) tracer(valeurArc, longueur);
  const piste = clair || !zones.length
    ? [svg('path', { d: arc(0, 1), fill: 'none', stroke: clair ? 'rgb(255 255 255 / 22%)' : 'var(--surface-3)', 'stroke-width': ep, 'stroke-linecap': 'round' })]
    : zones.map((z) => svg('path', {
      d: arc(Math.max(0, z.de / m), Math.min(1, z.a / m)), fill: 'none',
      stroke: FOND_NIVEAU[z.niveau] ?? FOND_NIVEAU.neutre, 'stroke-width': ep,
    }, svg('title', {}, z.libelle)));
  // Une encoche blanche separe les zones : le trait de valeur passe dessus.
  const encoches = clair ? [] : zones.slice(1).map((z) => {
    const [x0, y0] = point(z.de / m);
    const [xi, yi] = [cx + (x0 - cx) * 0.88, cy + (y0 - cy) * 0.88];
    const [xe, ye] = [cx + (x0 - cx) * 1.12, cy + (y0 - cy) * 1.12];
    return svg('line', { x1: xi, y1: yi, x2: xe, y2: ye, stroke: 'var(--surface)', 'stroke-width': 2.5 });
  });
  return svg('svg', { viewBox: '0 0 200 112', class: `demi-cercle${clair ? ' clair' : ''}`, role: 'img', 'aria-label': `Score ${formater(valeur, 'nombre')} sur ${m}` },
    piste, encoches,
    p > 0 ? valeurArc : null,
    svg('text', { x: 18, y: 110, class: 'graduation', 'text-anchor': 'middle' }, '0'),
    svg('text', { x: 182, y: 110, class: 'graduation', 'text-anchor': 'middle' }, String(m)));
}

/* Zones du score, de gauche a droite, a partir des paliers (sens « haut »). */
export function zonesScore(score) {
  const tri = [...(score?.paliers ?? [])].reverse();
  return tri.map((pl, i) => ({
    de: pl.seuil === null || pl.seuil === undefined || pl.seuil === '' ? 0 : Number(pl.seuil),
    a: i + 1 < tri.length ? Number(tri[i + 1].seuil) : (score.max || 100),
    niveau: pl.niveau, libelle: pl.libelle,
  }));
}

/* Bande empilee : la repartition d'un total en segments separes d'un filet,
   chaque segment de la couleur de sa categorie. */
export function bande(items, { total, animer = true, reste = null } = {}) {
  const somme = total ?? items.reduce((t, i) => t + Math.max(0, i.valeur ?? 0), 0);
  const el = h('div', { class: 'bande', role: 'img', 'aria-label': items.map((i) => `${i.libelle} ${formater(i.valeur, 'euro')}`).join(', ') },
    items.filter((i) => (i.valeur ?? 0) > 0).map((i) => h('span', {
      class: 'segment', title: `${i.libelle} : ${formater(i.valeur, 'euro')} (${formater(somme ? i.valeur / somme : null, 'pourcent')})`,
      style: { flexGrow: String(i.valeur), background: i.couleur },
    })),
    reste && reste.valeur > 0 ? h('span', { class: 'segment reste', title: `${reste.libelle} : ${formater(reste.valeur, 'euro')}`, style: { flexGrow: String(reste.valeur) } }) : null);
  if (animer) grandir(el, 60);
  return el;
}

/* Frise de duree : la duree du plan face a la duree cible. */
export function friseDuree(duree, cible, { animer = true } = {}) {
  const max = Math.max(duree || 0, cible || 0) * 1.12 || 1;
  const dans = !cible || duree <= cible;
  const rempli = h('span', { class: `remplissage ${dans ? 'dans' : 'hors'}`, style: { width: `${Math.min(100, ((duree || 0) / max) * 100)}%`, transformOrigin: 'left center' } });
  if (animer) grandir(rempli, 150);
  return h('div', { class: 'frise-duree' },
    h('div', { class: 'piste-duree' }, rempli,
      cible ? h('span', { class: 'cible', style: { left: `${(cible / max) * 100}%` } }, h('span', { class: 'etiquette-cible' }, `cible ${cible} mois`)) : null),
    h('p', { class: 'note-duree' }, !duree ? 'Aucun plan à prévoir.'
      : dans ? `${duree} mois : dans la durée cible.` : `${duree} mois : ${duree - cible} mois au-delà de la durée cible.`));
}

/* Barre de progression d'un critere de score : x / max. */
export function critere(c, { animer = true } = {}) {
  const p = Math.max(0, Math.min(1, (c.valeur ?? 0) / (c.max || 1)));
  // La couleur dit la part des points obtenus ; le chiffre « x / max » la dit aussi.
  const niveau = p >= 0.66 ? 'vert' : p >= 0.33 ? 'ambre' : 'rouge';
  const rempli = h('span', { class: `remplissage niveau-${niveau}`, style: { width: `${p * 100}%`, transformOrigin: 'left center' } });
  if (animer) grandir(rempli, 200);
  return h('div', { class: 'barre critere', title: `${c.libelle} : ${c.valeur ?? '—'} / ${c.max}` },
    h('span', { class: 'libelle' }, c.libelle),
    h('span', { class: 'piste' }, rempli),
    h('span', { class: 'nombre' }, `${formater(c.valeur, 'nombre')} / ${c.max}`));
}
