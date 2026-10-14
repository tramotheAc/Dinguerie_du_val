/* ===========================================================================
   Le moteur de calcul : il prend le parametrage et une saisie, il rend tout
   ce que la synthese affiche. Il ne touche ni a la page ni au stockage, ce
   qui permet de le tester seul (tests/moteur.test.mjs) et de le faire
   tourner dans l'admin sur le jeu d'essai, a chaque frappe.
   =========================================================================== */

import { compiler, evaluer, variablesLues, baremesCites, estNul, vrai, ErreurFormule } from './formules.js';
import { formater, interpoler } from './format.js';

const NUMERIQUES = new Set(['nombre', 'montant']);

/* --------------------------------------------------- catalogue des variables */

/* Toutes les variables qu'une formule peut lire, avec leur origine. C'est ce
   catalogue que l'admin affiche en pastilles cliquables. */
export function catalogue(config) {
  const vars = [];
  for (const s of config.sections) {
    if (s.type === 'dettes') {
      vars.push(
        { id: 'dettes_montant', libelle: 'Dettes en cours : montant total', origine: 'Dettes en cours', format: 'euro' },
        { id: 'dettes_mensualites', libelle: 'Dettes en cours : total des mensualités', origine: 'Dettes en cours', format: 'euro' },
        { id: 'nb_dettes', libelle: 'Dettes en cours : nombre de lignes', origine: 'Dettes en cours', format: 'nombre' },
      );
      continue;
    }
    for (const c of s.champs ?? []) {
      if (!NUMERIQUES.has(c.type)) continue;
      vars.push({ id: c.id, libelle: c.libelle, origine: `Saisie · ${s.titre}`, format: c.type === 'montant' ? 'euro' : 'nombre' });
    }
    if (s.type === 'budget') {
      vars.push({ id: `somme_${s.id}`, libelle: `Somme des lignes « ${s.titre} »`, origine: `Saisie · ${s.titre}`, format: 'euro' });
    }
  }
  for (const p of config.parametres) vars.push({ id: p.id, libelle: p.libelle, origine: 'Paramètre', format: p.format });
  vars.push(
    { id: 'mensualite_saisie', libelle: 'Mensualité simulée sur la synthèse (0 si aucune)', origine: 'Synthèse', format: 'euro' },
    { id: 'nb_leviers_actifs', libelle: 'Nombre de leviers déjà déclenchés plus haut dans la liste', origine: 'Leviers', format: 'nombre', seulementLeviers: true },
  );
  for (const i of config.indicateurs) vars.push({ id: i.id, libelle: i.libelle, origine: `Indicateur · ${i.groupe ?? ''}`, format: i.format, indicateur: true });
  return vars;
}

export function formatsDe(config) {
  const f = {};
  for (const v of catalogue(config)) f[v.id] = v.format;
  return f;
}

/* ------------------------------------------------- ordre de calcul */

/* Tri topologique des indicateurs : chacun est calcule apres ceux qu'il lit.
   L'ordre d'ecriture dans l'admin n'a donc pas d'importance. Un cycle est
   signale sur chacun des indicateurs pris dedans. */
export function ordonner(config) {
  const ids = new Set(config.indicateurs.map((i) => i.id));
  const deps = new Map();
  const erreurs = {};
  for (const i of config.indicateurs) {
    try {
      deps.set(i.id, [...variablesLues(compiler(i.formule))].filter((v) => ids.has(v) && v !== i.id));
      if (variablesLues(compiler(i.formule)).has(i.id)) erreurs[i.id] = 'La formule se lit elle-même';
    } catch (e) {
      deps.set(i.id, []);
      erreurs[i.id] = e.message;
    }
  }
  const ordre = [];
  const etat = new Map();
  const visiter = (id, pile) => {
    if (etat.get(id) === 'fini') return;
    if (etat.get(id) === 'en_cours') {
      const boucle = pile.slice(pile.indexOf(id));
      for (const b of boucle) erreurs[b] ??= `Calcul circulaire : ${[...boucle, id].join(' → ')}`;
      return;
    }
    etat.set(id, 'en_cours');
    for (const d of deps.get(id) ?? []) visiter(d, [...pile, id]);
    etat.set(id, 'fini');
    ordre.push(id);
  };
  for (const i of config.indicateurs) visiter(i.id, []);
  return { ordre, erreurs, deps };
}

/* ------------------------------------------------------------- paliers */

/* Un palier dit dans quelle zone tombe une valeur. sens « bas » : plus c'est
   bas, mieux c'est, et la valeur tombe dans le premier palier dont elle est
   strictement sous le seuil. sens « haut » : premier palier dont elle atteint
   le seuil. Le dernier palier, sans seuil, ramasse le reste. */
export function palier(valeur, paliers, sens = 'bas') {
  if (estNul(valeur) || !paliers?.length) return null;
  for (const p of paliers) {
    if (p.seuil === null || p.seuil === undefined || p.seuil === '') return p;
    if (sens === 'haut' ? valeur >= p.seuil : valeur < p.seuil) return p;
  }
  return paliers[paliers.length - 1];
}

/* -------------------------------------------------------------- calcul */

const nombre = (v) => {
  if (v === '' || v === null || v === undefined) return 0;
  const n = typeof v === 'number' ? v : Number(String(v).replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
};

/**
 * saisie = { valeurs: { id: valeur }, dettes: [{ type, montant, mensualite, echeance }], mensualite_saisie }
 */
export function calculerTout(config, saisie = {}) {
  const valeurs = {};
  const erreurs = {};
  const entree = saisie.valeurs ?? {};
  const baremes = Object.fromEntries((config.baremes ?? []).map((b) => [b.id, b]));

  for (const s of config.sections) {
    if (s.type === 'dettes') {
      const lignes = (saisie.dettes ?? []).filter((d) => d && (d.type || nombre(d.montant) || nombre(d.mensualite)));
      valeurs.dettes_montant = lignes.reduce((t, d) => t + nombre(d.montant), 0);
      valeurs.dettes_mensualites = lignes.reduce((t, d) => t + nombre(d.mensualite), 0);
      valeurs.nb_dettes = lignes.length;
      continue;
    }
    let somme = 0;
    for (const c of s.champs ?? []) {
      if (!NUMERIQUES.has(c.type)) continue;
      valeurs[c.id] = nombre(entree[c.id]);
      somme += valeurs[c.id];
    }
    if (s.type === 'budget') valeurs[`somme_${s.id}`] = somme;
  }
  for (const p of config.parametres) valeurs[p.id] = nombre(p.valeur);
  valeurs.mensualite_saisie = nombre(saisie.mensualite_saisie);

  const ctx = { valeurs, baremes };
  const { ordre, erreurs: erreursOrdre } = ordonner(config);
  Object.assign(erreurs, erreursOrdre);
  const parId = Object.fromEntries(config.indicateurs.map((i) => [i.id, i]));
  for (const id of ordre) valeurs[id] = null;
  for (const id of ordre) {
    if (erreurs[id]) continue;
    try {
      valeurs[id] = normaliser(evaluer(compiler(parId[id].formule), ctx));
    } catch (e) {
      erreurs[id] = e.message;
      valeurs[id] = null;
    }
  }

  const formats = formatsDe(config);
  const essayer = (source, cle) => {
    try { return evaluer(compiler(source), ctx); } catch (e) { erreurs[cle] = e.message; return null; }
  };
  const texte = (modele) => interpoler(modele, valeurs, formats);

  // Jauges et score
  const jauges = (config.jauges ?? []).map((j) => {
    const v = valeurs[j.indicateur];
    return { ...j, valeur: v, palier: palier(v, j.paliers, j.sens) };
  });
  const sc = config.score;
  const score = sc ? {
    ...sc,
    valeur: valeurs[sc.indicateur],
    palier: palier(valeurs[sc.indicateur], sc.paliers, sc.sens ?? 'haut'),
    criteres: sc.criteres.map((c) => ({ ...c, valeur: valeurs[c.indicateur] })),
  } : null;

  // Points d'attention
  const points = (config.points_attention ?? [])
    .map((p, n) => ({ ...p, actif: vrai(essayer(p.condition, `point_${n}`)) }))
    .filter((p) => p.actif)
    .map((p) => ({ ...p, texte: texte(p.libelle) }));

  // Qualification du plan : la premiere regle vraie l'emporte
  let qualification = null;
  for (const [n, q] of (config.plan?.qualifications ?? []).entries()) {
    if (vrai(essayer(q.condition, `qualification_${n}`))) {
      qualification = { ...q, texte: texte(q.libelle), commentaire: texte(q.commentaire ?? '') };
      break;
    }
  }

  // Leviers : evalues dans l'ordre de priorite, chacun voit combien de
  // leviers plus prioritaires sont deja declenches.
  const liste = [...(config.leviers?.liste ?? [])].sort((a, b) => nombre(a.priorite) - nombre(b.priorite));
  const leviers = [];
  let actifs = 0;
  for (const l of liste) {
    valeurs.nb_leviers_actifs = actifs;
    const actif = vrai(essayer(l.condition, `levier_${l.id}`));
    if (actif) actifs++;
    leviers.push({ ...l, actif, texte: texte(l.libelle) });
  }
  valeurs.nb_leviers_actifs = actifs;
  const nb = nombre(config.leviers?.nb_affiches) || 5;

  const repartition = (config.repartition ?? []).map((r) => ({ ...r, valeur: valeurs[r.indicateur] }));

  return {
    valeurs, erreurs, formats, jauges, score, points, qualification,
    leviers, leviersRetenus: leviers.filter((l) => l.actif).slice(0, nb), repartition,
  };
}

function normaliser(v) {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  return v ?? null;
}

/* -------------------------------------------------- controle du parametrage */

/* Passe en revue toutes les formules du parametrage et rend la liste des
   problemes. L'admin la montre en tete, la page de saisie refuse un
   parametrage qui en a (et revient au parametrage publie). */
export function verifier(config) {
  const problemes = [];
  const ids = new Set(catalogue(config).map((v) => v.id));
  const baremes = new Set((config.baremes ?? []).map((b) => b.id));
  const vus = new Map();
  for (const v of catalogue(config)) {
    if (!/^[a-z][a-z0-9_]*$/.test(v.id)) problemes.push({ ou: v.libelle, message: `Identifiant « ${v.id} » invalide : minuscules, chiffres et _ uniquement, sans accent` });
    if (vus.has(v.id) && v.id) problemes.push({ ou: v.libelle, message: `Identifiant « ${v.id} » utilisé deux fois (aussi par « ${vus.get(v.id)} »)` });
    vus.set(v.id, v.libelle);
  }
  const controler = (source, ou, autorises = ids) => {
    try {
      const a = compiler(source);
      for (const v of variablesLues(a)) if (!autorises.has(v)) problemes.push({ ou, message: `Variable inconnue « ${v} »` });
      for (const b of baremesCites(a)) if (!baremes.has(b)) problemes.push({ ou, message: `Barème inconnu « ${b} »` });
    } catch (e) {
      problemes.push({ ou, message: e.message });
    }
  };
  const sansLeviers = new Set([...ids].filter((v) => v !== 'nb_leviers_actifs'));
  for (const i of config.indicateurs) controler(i.formule, `Indicateur « ${i.libelle} »`, sansLeviers);
  const { erreurs } = ordonner(config);
  for (const [id, m] of Object.entries(erreurs)) if (m.startsWith('Calcul circulaire') || m.startsWith('La formule se lit')) problemes.push({ ou: `Indicateur « ${id} »`, message: m });
  (config.points_attention ?? []).forEach((p, n) => controler(p.condition, `Point d'attention n° ${n + 1}`, sansLeviers));
  (config.plan?.qualifications ?? []).forEach((q, n) => controler(q.condition, `Qualification n° ${n + 1}`, sansLeviers));
  (config.leviers?.liste ?? []).forEach((l) => controler(l.condition, `Levier « ${l.libelle} »`));
  for (const s of config.sections) {
    if (s.total && !ids.has(s.total)) problemes.push({ ou: `Section « ${s.titre} »`, message: `Total : variable inconnue « ${s.total} »` });
    for (const l of s.lignes_calculees ?? []) if (!ids.has(l.variable)) problemes.push({ ou: `Section « ${s.titre} »`, message: `Ligne calculée : variable inconnue « ${l.variable} »` });
  }
  for (const ref of [...(config.chiffres_cles ?? []), ...(config.jauges ?? []), ...(config.repartition ?? []), ...(config.score?.criteres ?? []), config.score].filter(Boolean)) {
    if (ref.indicateur && !ids.has(ref.indicateur)) problemes.push({ ou: `Synthèse « ${ref.libelle ?? ref.indicateur} »`, message: `Variable inconnue « ${ref.indicateur} »` });
  }
  return problemes;
}

export { ErreurFormule, formater };
