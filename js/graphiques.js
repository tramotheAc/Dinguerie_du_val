/* ===========================================================================
   Les dessins de la synthese, en SVG et HTML simples.

   Regles tenues (cf. la charte et les bonnes pratiques de dataviz) :
   - une seule teinte par graphique quand il s'agit de grandeurs ; les couleurs
     d'etat (vert, ambre, rouge) sont reservees aux statuts et viennent
     toujours avec un libelle, jamais seules ;
   - chaque barre porte son chiffre : pas besoin de survoler pour lire ;
   - un titre (title) sur chaque marque pour le survol.
   =========================================================================== */

import { h, svg } from './dom.js?v=54740b0b30';
import { formater } from './format.js?v=54740b0b30';
import { grandir, tracer, sansAnimation } from './animations.js?v=54740b0b30';

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

/* ------------------------------------------------------------- cascade */
/* Ou part l'argent : des ressources, on retranche chaque categorie jusqu'au
   solde, puis le plan d'apurement jusqu'au reste reel. Chaque barre porte
   son montant et sa part des ressources. */
export function cascadeBudget({ ressources, etapes, solde, plan, animer = true }) {
  const colonnes = [
    { libelle: 'Ressources', de: 0, a: ressources, couleur: 'var(--vert)', fort: true, montant: ressources },
  ];
  let niveau = ressources;
  for (const e of etapes) {
    colonnes.push({ libelle: e.libelle, de: niveau, a: niveau - e.valeur, couleur: e.couleur, montant: -e.valeur });
    niveau -= e.valeur;
  }
  colonnes.push({ libelle: 'Solde', de: 0, a: solde, couleur: solde < 0 ? 'var(--rouge)' : 'var(--petrole)', fort: true, montant: solde });
  if (plan > 0) {
    colonnes.push({ libelle: 'Plan d’apurement', de: solde, a: solde - plan, motif: true, montant: -plan });
    colonnes.push({ libelle: 'Reste réel', de: 0, a: solde - plan, couleur: solde - plan < 0 ? 'var(--rouge)' : 'var(--petrole)', fort: true, montant: solde - plan });
  }
  const L = 92, H = 230, haut = 40, bas = 44;
  const max = Math.max(ressources, 1, ...colonnes.map((c) => Math.max(c.de, c.a)));
  const min = Math.min(0, ...colonnes.map((c) => Math.min(c.de, c.a)));
  const y = (v) => haut + ((max - v) / (max - min || 1)) * H;
  const largeur = colonnes.length * L;
  const motif = svg('pattern', { id: 'hachure-plan', width: 6, height: 6, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' },
    svg('rect', { width: 6, height: 6, fill: 'var(--rouge-fond)' }),
    svg('line', { x1: 0, y1: 0, x2: 0, y2: 6, stroke: 'var(--rouge)', 'stroke-width': 3 }));
  const dessin = svg('svg', { viewBox: `0 0 ${largeur} ${haut + H + bas}`, class: 'cascade', role: 'img', 'aria-label': colonnes.map((c) => `${c.libelle} ${formater(c.montant, 'euro')}`).join(', ') },
    svg('defs', {}, motif),
    svg('line', { x1: 0, x2: largeur, y1: y(0), y2: y(0), class: 'axe' }),
    colonnes.map((c, i) => {
      const x = i * L + 12;
      const y1 = y(Math.max(c.de, c.a));
      const y2 = y(Math.min(c.de, c.a));
      const hauteur = Math.max(2, y2 - y1);
      const part = ressources ? Math.abs(c.montant) / ressources : null;
      const texte = `${c.montant < 0 && !c.fort ? '− ' : ''}${formater(c.fort ? c.montant : Math.abs(c.montant), 'euro')}`;
      const mots = c.libelle.split(' ');
      const lignes = mots.length > 1 && c.libelle.length > 12 ? [mots.slice(0, Math.ceil(mots.length / 2)).join(' '), mots.slice(Math.ceil(mots.length / 2)).join(' ')] : [c.libelle];
      const barre = svg('rect', { x, y: y1, width: L - 24, height: hauteur, rx: 5, fill: c.motif ? 'url(#hachure-plan)' : c.couleur, class: 'barre-cascade' }, svg('title', {}, `${c.libelle} : ${texte}`));
      if (animer && !sansAnimation()) barre.animate?.([{ transform: 'scaleY(0)' }, { transform: 'scaleY(1)' }], { duration: 500, delay: i * 70, easing: 'cubic-bezier(.22,.8,.3,1)', fill: 'backwards' });
      return svg('g', {},
        i > 0 ? svg('line', { x1: x - 24, x2: x, y1: y(c.de), y2: y(c.de), class: 'liaison' }) : null,
        barre,
        svg('text', { x: x + (L - 24) / 2, y: y1 - (c.fort ? 8 : 20), class: `montant-cascade${c.fort ? ' fort' : ''}`, 'text-anchor': 'middle' }, texte),
        !c.fort && part !== null ? svg('text', { x: x + (L - 24) / 2, y: y1 - 7, class: 'part-cascade', 'text-anchor': 'middle' }, formater(part, 'pourcent')) : null,
        svg('text', { x: x + (L - 24) / 2, y: haut + H + 18, class: `libelle-cascade${c.fort ? ' fort' : ''}`, 'text-anchor': 'middle' },
          lignes.map((t, k) => svg('tspan', { x: x + (L - 24) / 2, dy: k ? 13 : 0 }, t))));
    }));
  return dessin;
}

/* ------------------------------------------------------- sur 100 euros */
export function barreSur100(items, total) {
  const parts = items.map((i) => ({ ...i, part: total ? Math.max(0, i.valeur) / total * 100 : 0 }));
  return h('div', { class: 'barre-100' }, parts.filter((p) => p.part > 0).map((p) => h('span', {
    class: 'segment-100', style: { flexGrow: String(p.part), background: p.couleur }, title: `${p.libelle} : ${Math.round(p.part)} € sur 100 €`,
  }, p.part >= 7 ? h('span', { class: 'chiffre-segment' }, String(Math.round(p.part))) : null)));
}

/* ------------------------------------------------- jauge a zones nommees */
/* Les zones portent leur nom ; la zone ou tombe la valeur est accentuee, un
   repere etiquete marque la valeur. */
export function jaugeNommee(jauge, format) {
  const max = Number(jauge.echelle_max) || 1;
  const zones = [];
  if (jauge.sens === 'haut') {
    const tri = [...jauge.paliers].reverse();
    tri.forEach((p, i) => {
      const de = p.seuil === null || p.seuil === undefined || p.seuil === '' ? 0 : Number(p.seuil);
      zones.push({ de, a: i + 1 < tri.length ? Number(tri[i + 1].seuil) : max, p });
    });
  } else {
    let de = 0;
    for (const p of jauge.paliers) {
      const a = p.seuil === null || p.seuil === undefined || p.seuil === '' ? max : Number(p.seuil);
      zones.push({ de, a: Math.max(a, de), p });
      de = a;
    }
  }
  const v = jauge.valeur;
  const pos = (x) => Math.max(0, Math.min(100, (x / max) * 100));
  const actif = jauge.palier;
  // « Situation favorable » -> « Favorable » : dans la jauge, le mot suffit.
  const court = (t) => String(t).replace(/^situation\s+/i, '').replace(/^./, (x) => x.toUpperCase());
  // Les largeurs sont en pourcentage de l'echelle : une zone etroite tait son
  // nom (il reste en infobulle) plutot que de l'afficher coupe.
  let derniere = -100;
  const graduations = zones.slice(0, -1).map((z) => pos(z.a)).filter((x) => {
    if (x - derniere < 9 || x > 96) return false;
    derniere = x;
    return true;
  });
  return h('div', { class: 'jauge-nommee' },
    h('div', { class: 'zones' }, zones.map((z) => {
      const largeur = pos(z.a) - pos(z.de);
      return h('span', {
        class: `zone niveau-${z.p.niveau ?? 'neutre'}${actif && z.p.libelle === actif.libelle && z.p.seuil === actif.seuil ? ' active' : ''}`,
        style: { width: `${largeur}%` }, title: z.p.libelle,
      }, largeur >= 17 ? h('span', { class: 'nom-zone' }, court(z.p.libelle)) : null);
    })),
    v === null || v === undefined ? null : h('span', { class: 'repere-valeur', style: { left: `${pos(v)}%` } },
      h('span', { class: 'etiquette-valeur' }, formater(v, format))),
    h('div', { class: 'graduations' }, graduations.map((x) => h('span', { style: { left: `${x}%` } }, formater(x / 100 * max, format)))));
}

/* ------------------------------------------------ points du score */
export function barrePoints(criteres, max) {
  const total = criteres.reduce((t, c) => t + (c.valeur ?? 0), 0);
  const perdus = Math.max(0, max - total);
  return h('div', { class: 'barre-points' },
    criteres.map((c, i) => ((c.valeur ?? 0) > 0 ? h('span', {
      class: 'segment-points', style: { flexGrow: String(c.valeur), background: `var(--cat-${(i % 5) + 1})` }, title: `${c.libelle} : ${c.valeur} / ${c.max}`,
    }, h('span', { class: 'chiffre-segment' }, String(c.valeur))) : null)),
    perdus > 0 ? h('span', { class: 'segment-points perdus', style: { flexGrow: String(perdus) } }, `${perdus} points perdus`) : null);
}

/* ------------------------------------------- scenarios de plan compares */
export function scenarios(liste, cible) {
  const max = Math.max(cible || 0, ...liste.map((s) => s.duree || 0)) * 1.08 || 1;
  return h('div', { class: 'scenarios' },
    cible ? h('div', { class: 'ligne-cible-titre' }, h('span', { style: { left: `${(cible / max) * 100}%` } }, `cible ${cible} mois`)) : null,
    liste.map((s) => h('div', { class: `scenario${s.actif ? ' actif' : ''}` },
      h('div', { class: 'scenario-libelle' }, h('strong', {}, s.titre), h('small', {}, s.sous)),
      h('div', { class: 'scenario-piste' },
        h('span', { class: `scenario-barre${s.motif ? ' motif' : ''}`, style: { width: `${Math.min(100, ((s.duree || 0) / max) * 100)}%`, background: s.motif ? null : s.couleur } }),
        cible ? h('span', { class: 'scenario-cible', style: { left: `${(cible / max) * 100}%` } }) : null),
      h('strong', { class: 'scenario-duree' }, s.duree ? String(s.duree) : '—'))));
}
