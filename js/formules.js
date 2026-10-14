/* ===========================================================================
   Le moteur de formules.

   Une formule s'ecrit comme dans Excel en francais, mais avec des noms de
   variables au lieu d'adresses de cellules :

       SI(total_ressources > 0; depenses_logement / total_ressources; 0)

   - separateur d'arguments : le point-virgule « ; » (comme Excel en francais)
   - decimales : virgule ou point (0,5 ou 0.5), pourcentages : 35 %
   - operateurs : + - * / ^, comparaisons = <> < <= > >=, ET / OU / NON
   - textes entre guillemets droits : "Oui"

   Aucune formule n'est executee par eval : elle est lue, verifiee, puis
   calculee par l'interpreteur ci-dessous. Une formule saisie dans l'admin ne
   peut donc rien faire d'autre que calculer.

   Une valeur « non calculable » (division par zero, variable vide) vaut null.
   Elle se propage dans les calculs, rend fausse toute comparaison, et
   s'affiche « — ». SIERREUR(x; y) la remplace par y.
   =========================================================================== */

export class ErreurFormule extends Error {
  constructor(message, position) {
    super(message);
    this.position = position;
  }
}

/* ------------------------------------------------------------------ lexique */

const LETTRE = /[A-Za-z_À-ſ]/;
const MOT = /[A-Za-z0-9_.À-ſ]/;

function lire(source) {
  const jetons = [];
  let i = 0;
  const s = String(source ?? '');
  while (i < s.length) {
    const c = s[i];
    if (/\s/.test(c)) { i++; continue; }
    const debut = i;
    if (/[0-9]/.test(c) || (c === '.' && /[0-9]/.test(s[i + 1] ?? ''))) {
      let n = '';
      while (i < s.length && /[0-9]/.test(s[i])) n += s[i++];
      if ((s[i] === ',' || s[i] === '.') && /[0-9]/.test(s[i + 1] ?? '')) {
        n += '.'; i++;
        while (i < s.length && /[0-9]/.test(s[i])) n += s[i++];
      }
      let v = Number(n);
      let j = i;
      while (s[j] === ' ') j++;
      if (s[j] === '%') { v = v / 100; i = j + 1; }
      jetons.push({ t: 'nombre', v, p: debut });
      continue;
    }
    if (c === '"') {
      let t = '';
      i++;
      while (i < s.length && s[i] !== '"') t += s[i++];
      if (s[i] !== '"') throw new ErreurFormule('Guillemet fermant manquant', debut);
      i++;
      jetons.push({ t: 'texte', v: t, p: debut });
      continue;
    }
    if (LETTRE.test(c)) {
      let m = '';
      while (i < s.length && MOT.test(s[i])) m += s[i++];
      jetons.push({ t: 'mot', v: m, p: debut });
      continue;
    }
    const deux = s.slice(i, i + 2);
    if (['<=', '>=', '<>', '!=', '==', '&&', '||'].includes(deux)) {
      const norme = { '!=': '<>', '==': '=', '&&': 'ET', '||': 'OU' }[deux] ?? deux;
      jetons.push({ t: 'op', v: norme, p: debut });
      i += 2;
      continue;
    }
    if ('+-*/^<>=()'.includes(c)) { jetons.push({ t: 'op', v: c, p: debut }); i++; continue; }
    if (c === ';') { jetons.push({ t: 'sep', v: ';', p: debut }); i++; continue; }
    if (c === ',') {
      throw new ErreurFormule('Séparez les arguments par un point-virgule « ; » (la virgule sert aux décimales)', debut);
    }
    throw new ErreurFormule(`Caractère inattendu « ${c} »`, debut);
  }
  jetons.push({ t: 'fin', p: s.length });
  return jetons;
}

/* ---------------------------------------------------------------- syntaxe */

/* Priorites, de la plus faible a la plus forte :
   OU < ET < NON < comparaison < + - < * / < ^ < signe */
export function analyser(source) {
  const j = lire(source);
  let k = 0;
  const voir = () => j[k];
  const prendre = () => j[k++];
  const estOp = (v) => voir().t === 'op' && voir().v === v;
  const estMot = (v) => voir().t === 'mot' && voir().v.toUpperCase() === v && j[k + 1]?.v !== '(';

  function attendre(v) {
    if (!estOp(v)) {
      const ici = voir();
      throw new ErreurFormule(ici.t === 'fin' ? `« ${v} » manquant en fin de formule` : `« ${v} » attendu`, ici.p);
    }
    return prendre();
  }

  function ou() {
    let g = et();
    while (estMot('OU') || estOp('OU')) { prendre(); g = { n: 'appel', f: 'OU', a: [g, et()] }; }
    return g;
  }
  function et() {
    let g = non();
    while (estMot('ET') || estOp('ET')) { prendre(); g = { n: 'appel', f: 'ET', a: [g, non()] }; }
    return g;
  }
  function non() {
    if (estMot('NON')) { prendre(); return { n: 'appel', f: 'NON', a: [non()] }; }
    return comparaison();
  }
  function comparaison() {
    let g = somme();
    while (voir().t === 'op' && ['=', '<>', '<', '<=', '>', '>='].includes(voir().v)) {
      const o = prendre().v;
      g = { n: 'bin', o, g, d: somme() };
    }
    return g;
  }
  function somme() {
    let g = produit();
    while (estOp('+') || estOp('-')) { const o = prendre().v; g = { n: 'bin', o, g, d: produit() }; }
    return g;
  }
  function produit() {
    let g = puissance();
    while (estOp('*') || estOp('/')) { const o = prendre().v; g = { n: 'bin', o, g, d: puissance() }; }
    return g;
  }
  function puissance() {
    const g = signe();
    if (estOp('^')) { prendre(); return { n: 'bin', o: '^', g, d: puissance() }; }
    return g;
  }
  function signe() {
    if (estOp('-')) { prendre(); return { n: 'moins', a: signe() }; }
    if (estOp('+')) { prendre(); return signe(); }
    return atome();
  }
  function atome() {
    const t = voir();
    if (t.t === 'nombre' || t.t === 'texte') { prendre(); return { n: 'val', v: t.v }; }
    if (estOp('(')) { prendre(); const e = ou(); attendre(')'); return e; }
    if (t.t === 'mot') {
      prendre();
      const haut = t.v.toUpperCase();
      if (estOp('(')) {
        prendre();
        const f = ALIAS[haut] ?? haut;
        if (!FONCTIONS[f]) throw new ErreurFormule(`Fonction inconnue « ${t.v} »`, t.p);
        const a = [];
        if (!estOp(')')) {
          a.push(ou());
          while (voir().t === 'sep') { prendre(); a.push(ou()); }
        }
        attendre(')');
        const { min, max } = FONCTIONS[f];
        if (a.length < min || (max !== undefined && a.length > max)) {
          const attendu = max === undefined ? `au moins ${min}` : min === max ? `${min}` : `${min} à ${max}`;
          throw new ErreurFormule(`${f} attend ${attendu} argument(s), ${a.length} donné(s)`, t.p);
        }
        return { n: 'appel', f, a, p: t.p };
      }
      if (haut === 'VRAI' || haut === 'TRUE') return { n: 'val', v: true };
      if (haut === 'FAUX' || haut === 'FALSE') return { n: 'val', v: false };
      if (haut === 'VIDE') return { n: 'val', v: null };
      return { n: 'var', v: t.v.toLowerCase(), p: t.p };
    }
    if (t.t === 'fin') throw new ErreurFormule('La formule est incomplète', t.p);
    throw new ErreurFormule(`« ${t.v} » inattendu`, t.p);
  }

  if (voir().t === 'fin') throw new ErreurFormule('La formule est vide', 0);
  const arbre = ou();
  if (voir().t !== 'fin') throw new ErreurFormule(`« ${voir().v} » inattendu : opérateur ou « ; » manquant ?`, voir().p);
  return arbre;
}

/* ---------------------------------------------------------------- calcul */

const estNul = (v) => v === null || v === undefined || (typeof v === 'number' && !Number.isFinite(v));
const num = (v) => (typeof v === 'boolean' ? (v ? 1 : 0) : v);

function arrondir(x, n, mode) {
  if (estNul(x)) return null;
  const f = 10 ** (Math.trunc(num(n ?? 0)) || 0);
  const y = num(x) * f;
  // Le petit epsilon corrige les flottants : 0,1 + 0,2 doit s'arrondir comme 0,3.
  const e = 1e-9 * Math.sign(y);
  const r = mode === 'sup' ? Math.sign(y) * Math.ceil(Math.abs(y) - 1e-9)
    : mode === 'inf' ? Math.sign(y) * Math.floor(Math.abs(y) + 1e-9)
      : Math.round(y + e);
  return r / f;
}

/* Recherche dans un bareme : la derniere ligne dont la premiere colonne est
   inferieure ou egale a la valeur (la RECHERCHEV approchee d'Excel). Une
   valeur sous la premiere ligne prend la premiere ligne. */
export function chercherBareme(bareme, valeur, colonne) {
  if (!bareme) throw new ErreurFormule('Barème introuvable');
  if (estNul(valeur)) return null;
  const cle = bareme.colonnes[0]?.id;
  const col = bareme.colonnes.find((c) => c.id === colonne || c.libelle === colonne);
  if (!col) throw new ErreurFormule(`Colonne « ${colonne} » introuvable dans le barème « ${bareme.libelle} »`);
  const lignes = [...bareme.lignes].sort((a, b) => num(a[cle]) - num(b[cle]));
  if (!lignes.length) return null;
  let retenue = lignes[0];
  for (const l of lignes) if (num(l[cle]) <= num(valeur)) retenue = l;
  return retenue[col.id] ?? null;
}

export const FONCTIONS = {
  SI: { min: 2, max: 3, aide: 'SI(condition; si_vrai; si_faux)', paresseux: true },
  ET: { min: 1, aide: 'ET(condition1; condition2; …) — vrai si toutes le sont' },
  OU: { min: 1, aide: 'OU(condition1; condition2; …) — vrai si l’une l’est' },
  NON: { min: 1, max: 1, aide: 'NON(condition)' },
  MIN: { min: 1, aide: 'MIN(a; b; …)' },
  MAX: { min: 1, aide: 'MAX(a; b; …)' },
  SOMME: { min: 1, aide: 'SOMME(a; b; …)' },
  ABS: { min: 1, max: 1, aide: 'ABS(x)' },
  ARRONDI: { min: 1, max: 2, aide: 'ARRONDI(x; décimales)' },
  'ARRONDI.SUP': { min: 1, max: 2, aide: 'ARRONDI.SUP(x; décimales) — arrondi au-dessus' },
  'ARRONDI.INF': { min: 1, max: 2, aide: 'ARRONDI.INF(x; décimales) — arrondi au-dessous' },
  SIERREUR: { min: 2, max: 2, aide: 'SIERREUR(x; valeur_si_non_calculable)', paresseux: true },
  ESTVIDE: { min: 1, max: 1, aide: 'ESTVIDE(x) — vrai si x n’est pas calculable ou vide' },
  BAREME: { min: 3, max: 3, aide: 'BAREME("barème"; valeur; "colonne") — recherche approchée' },
};

const ALIAS = {
  IF: 'SI', AND: 'ET', OR: 'OU', NOT: 'NON', SUM: 'SOMME', ROUND: 'ARRONDI',
  ROUNDUP: 'ARRONDI.SUP', ROUNDDOWN: 'ARRONDI.INF', IFERROR: 'SIERREUR',
  ISBLANK: 'ESTVIDE', LOOKUP: 'BAREME', 'RECHERCHE': 'BAREME',
};

function comparer(o, a, b) {
  if (estNul(a) || estNul(b)) return false;
  if (typeof a === 'string' || typeof b === 'string') {
    a = String(a).toLowerCase(); b = String(b).toLowerCase();
  } else { a = num(a); b = num(b); }
  switch (o) {
    case '=': return a === b;
    case '<>': return a !== b;
    case '<': return a < b;
    case '<=': return a <= b;
    case '>': return a > b;
    case '>=': return a >= b;
  }
  return false;
}

function arith(o, a, b) {
  if (estNul(a) || estNul(b)) return null;
  if (typeof a === 'string' || typeof b === 'string') {
    throw new ErreurFormule(`Calcul impossible sur un texte (« ${typeof a === 'string' ? a : b} »)`);
  }
  a = num(a); b = num(b);
  let r;
  switch (o) {
    case '+': r = a + b; break;
    case '-': r = a - b; break;
    case '*': r = a * b; break;
    case '/': r = b === 0 ? null : a / b; break;
    case '^': r = a ** b; break;
  }
  return estNul(r) ? null : r;
}

const vrai = (v) => !estNul(v) && v !== false && v !== 0 && v !== '';

export function evaluer(arbre, ctx) {
  switch (arbre.n) {
    case 'val': return arbre.v;
    case 'var': {
      if (!(arbre.v in ctx.valeurs)) throw new ErreurFormule(`Variable inconnue « ${arbre.v} »`, arbre.p);
      return ctx.valeurs[arbre.v];
    }
    case 'moins': { const v = evaluer(arbre.a, ctx); return estNul(v) ? null : -num(v); }
    case 'bin': {
      const g = evaluer(arbre.g, ctx);
      const d = evaluer(arbre.d, ctx);
      if (['=', '<>', '<', '<=', '>', '>='].includes(arbre.o)) return comparer(arbre.o, g, d);
      return arith(arbre.o, g, d);
    }
    case 'appel': return appeler(arbre, ctx);
  }
  throw new ErreurFormule('Formule illisible');
}

function appeler({ f, a }, ctx) {
  if (f === 'SI') {
    return vrai(evaluer(a[0], ctx)) ? evaluer(a[1], ctx) : (a[2] ? evaluer(a[2], ctx) : false);
  }
  if (f === 'SIERREUR') {
    let v;
    try { v = evaluer(a[0], ctx); } catch (e) { if (e.message.startsWith('Variable inconnue')) throw e; v = null; }
    return estNul(v) ? evaluer(a[1], ctx) : v;
  }
  const v = a.map((x) => evaluer(x, ctx));
  const nombres = () => v.filter((x) => !estNul(x)).map(num);
  switch (f) {
    case 'ET': return v.every(vrai);
    case 'OU': return v.some(vrai);
    case 'NON': return !vrai(v[0]);
    case 'MIN': { const n = nombres(); return n.length ? Math.min(...n) : null; }
    case 'MAX': { const n = nombres(); return n.length ? Math.max(...n) : null; }
    case 'SOMME': return nombres().reduce((s, x) => s + x, 0);
    case 'ABS': return estNul(v[0]) ? null : Math.abs(num(v[0]));
    case 'ARRONDI': return arrondir(v[0], v[1], 'proche');
    case 'ARRONDI.SUP': return arrondir(v[0], v[1], 'sup');
    case 'ARRONDI.INF': return arrondir(v[0], v[1], 'inf');
    case 'ESTVIDE': return estNul(v[0]) || v[0] === '';
    case 'BAREME': {
      const b = ctx.baremes?.[String(v[0])];
      if (!b) throw new ErreurFormule(`Barème « ${v[0]} » introuvable`);
      return chercherBareme(b, v[1], String(v[2]));
    }
  }
  throw new ErreurFormule(`Fonction inconnue « ${f} »`);
}

/* Les variables qu'une formule lit : sert a ordonner les calculs et a
   montrer, dans l'admin, ce qui depend de quoi. */
export function variablesLues(arbre, acc = new Set()) {
  if (!arbre) return acc;
  if (arbre.n === 'var') acc.add(arbre.v);
  if (arbre.g) variablesLues(arbre.g, acc);
  if (arbre.d) variablesLues(arbre.d, acc);
  if (arbre.n === 'moins') variablesLues(arbre.a, acc);
  if (arbre.n === 'appel') arbre.a.forEach((x) => variablesLues(x, acc));
  return acc;
}

/* Les baremes cites par une formule, pour verifier qu'ils existent. */
export function baremesCites(arbre, acc = new Set()) {
  if (!arbre) return acc;
  if (arbre.n === 'appel') {
    if (arbre.f === 'BAREME' && arbre.a[0]?.n === 'val') acc.add(String(arbre.a[0].v));
    arbre.a.forEach((x) => baremesCites(x, acc));
  }
  if (arbre.g) baremesCites(arbre.g, acc);
  if (arbre.d) baremesCites(arbre.d, acc);
  if (arbre.n === 'moins') baremesCites(arbre.a, acc);
  return acc;
}

const cache = new Map();
/* Lit une formule une fois, la garde en memoire. */
export function compiler(source) {
  const cle = String(source ?? '');
  if (!cache.has(cle)) {
    try { cache.set(cle, { arbre: analyser(cle) }); } catch (e) { cache.set(cle, { erreur: e }); }
    if (cache.size > 2000) cache.delete(cache.keys().next().value);
  }
  const r = cache.get(cle);
  if (r.erreur) throw r.erreur;
  return r.arbre;
}

export function calculer(source, ctx) {
  return evaluer(compiler(source), ctx);
}

export { estNul, vrai };
