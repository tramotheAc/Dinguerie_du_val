/* Outils de l'admin qui ne touchent pas a la page : fabriquer un identifiant,
   trouver ou une variable est utilisee, la renommer partout. Testes dans
   tests/admin-outils.test.mjs. */

export function identifiant(libelle) {
  let s = String(libelle ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  if (!s) s = 'variable';
  if (/^[0-9]/.test(s)) s = `v_${s}`;
  return s.slice(0, 40);
}

export function identifiantLibre(base, pris) {
  let id = base;
  let n = 2;
  while (pris.has(id)) id = `${base}_${n++}`;
  return id;
}

const BORD = '[A-Za-z0-9_.\\u00C0-\\u017F]';
const motif = (id) => new RegExp(`(?<!${BORD})${id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?!${BORD})`, 'gi');

/* Remplace un nom de variable dans une formule, hors des textes entre
   guillemets (« "mini" » est une colonne de bareme, pas une variable). */
export function remplacerDansFormule(formule, ancien, nouveau) {
  return String(formule ?? '').split(/("[^"]*")/).map((morceau) =>
    (morceau.startsWith('"') ? morceau : morceau.replace(motif(ancien), nouveau))).join('');
}

export function citeDansFormule(formule, id) {
  return String(formule ?? '').split(/("[^"]*")/).some((m) => !m.startsWith('"') && motif(id).test(m));
}

const remplacerAccolades = (texte, ancien, nouveau) =>
  String(texte ?? '').replace(new RegExp(`\\{${ancien}\\}`, 'gi'), `{${nouveau}}`);

/* Tous les endroits du parametrage qui lisent une variable. */
export function usages(config, id) {
  const u = [];
  for (const i of config.indicateurs) if (i.id !== id && citeDansFormule(i.formule, id)) u.push(`Indicateur « ${i.libelle} »`);
  (config.points_attention ?? []).forEach((p, n) => {
    if (citeDansFormule(p.condition, id) || p.libelle?.includes(`{${id}}`)) u.push(`Point d'attention n° ${n + 1}`);
  });
  (config.plan?.qualifications ?? []).forEach((q) => {
    if (citeDansFormule(q.condition, id) || q.commentaire?.includes(`{${id}}`) || q.libelle?.includes(`{${id}}`)) u.push(`Qualification « ${q.libelle} »`);
  });
  for (const l of config.leviers?.liste ?? []) if (citeDansFormule(l.condition, id)) u.push(`Levier « ${l.libelle} »`);
  for (const c of config.chiffres_cles ?? []) if (c.indicateur === id) u.push(`Chiffre clé « ${c.libelle} »`);
  for (const j of config.jauges ?? []) if (j.indicateur === id) u.push(`Jauge « ${j.libelle} »`);
  for (const r of config.repartition ?? []) if (r.indicateur === id) u.push(`Répartition « ${r.libelle} »`);
  if (config.score?.indicateur === id) u.push('Score (total)');
  for (const c of config.score?.criteres ?? []) if (c.indicateur === id) u.push(`Critère de score « ${c.libelle} »`);
  for (const s of config.sections) {
    if (s.total === id) u.push(`Total de la section « ${s.titre} »`);
    for (const l of s.lignes_calculees ?? []) if (l.variable === id) u.push(`Ligne calculée « ${l.libelle} »`);
  }
  return u;
}

/* Renomme une variable partout ou elle est lue. */
export function renommer(config, ancien, nouveau) {
  if (!ancien || ancien === nouveau) return;
  const f = (s) => remplacerDansFormule(s, ancien, nouveau);
  const t = (s) => remplacerAccolades(s, ancien, nouveau);
  const ref = (o, k) => { if (o && o[k] === ancien) o[k] = nouveau; };
  for (const i of config.indicateurs) { i.formule = f(i.formule); i.aide = i.aide && t(i.aide); }
  for (const p of config.points_attention ?? []) { p.condition = f(p.condition); p.libelle = t(p.libelle); }
  for (const q of config.plan?.qualifications ?? []) { q.condition = f(q.condition); q.libelle = t(q.libelle); q.commentaire = t(q.commentaire); }
  for (const l of config.leviers?.liste ?? []) { l.condition = f(l.condition); l.description = t(l.description); }
  for (const c of config.chiffres_cles ?? []) ref(c, 'indicateur');
  for (const j of config.jauges ?? []) ref(j, 'indicateur');
  for (const r of config.repartition ?? []) ref(r, 'indicateur');
  ref(config.score, 'indicateur');
  for (const c of config.score?.criteres ?? []) ref(c, 'indicateur');
  for (const s of config.sections) {
    ref(s, 'total');
    for (const l of s.lignes_calculees ?? []) ref(l, 'variable');
  }
  const essai = config.jeu_essai?.valeurs;
  if (essai && ancien in essai) { essai[nouveau] = essai[ancien]; delete essai[ancien]; }
  const cols = config.liens?.colonnes;
  if (cols && ancien in cols) { cols[nouveau] = cols[ancien]; delete cols[ancien]; }
}

/* Renomme un bareme : seules les formules BAREME("…") le citent. */
export function renommerBareme(config, ancien, nouveau) {
  const r = (s) => String(s ?? '').split(`"${ancien}"`).join(`"${nouveau}"`);
  for (const i of config.indicateurs) i.formule = r(i.formule);
  for (const p of config.points_attention ?? []) p.condition = r(p.condition);
  for (const q of config.plan?.qualifications ?? []) q.condition = r(q.condition);
  for (const l of config.leviers?.liste ?? []) l.condition = r(l.condition);
}

export function baremeUtilisePar(config, id) {
  const cite = (s) => String(s ?? '').includes(`"${id}"`);
  return [
    ...config.indicateurs.filter((i) => cite(i.formule)).map((i) => `Indicateur « ${i.libelle} »`),
    ...(config.leviers?.liste ?? []).filter((l) => cite(l.condition)).map((l) => `Levier « ${l.libelle} »`),
    ...(config.points_attention ?? []).filter((p) => cite(p.condition)).map((_, n) => `Point d'attention n° ${n + 1}`),
    ...(config.plan?.qualifications ?? []).filter((q) => cite(q.condition)).map((q) => `Qualification « ${q.libelle} »`),
  ];
}
