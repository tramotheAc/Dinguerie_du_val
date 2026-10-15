/* Mise en forme des valeurs : une seule fonction pour l'ecran, le PDF et les
   libelles a trous (« Taux d'effort élevé ({taux_effort_logement}) »). */

const nf = (min, max) => new Intl.NumberFormat('fr-FR', { minimumFractionDigits: min, maximumFractionDigits: max });
const ENTIER = nf(0, 0);
const DEUX = nf(0, 2);
const UN = nf(0, 1);

export const FORMATS = {
  euro: 'Montant (€)',
  pourcent: 'Pourcentage',
  nombre: 'Nombre entier',
  decimal: 'Nombre décimal',
  mois: 'Durée en mois',
  score: 'Score sur 100',
  booleen: 'Oui / Non',
  texte: 'Texte',
};

// Le signe moins typographique se lit mieux qu'un tiret court a cote d'un chiffre.
const signe = (s) => s.replace(/^-/, '−');

export function formater(v, format = 'nombre') {
  if (v === null || v === undefined || (typeof v === 'number' && !Number.isFinite(v))) return '—';
  if (typeof v === 'boolean') return v ? 'Oui' : 'Non';
  if (typeof v === 'number' && Math.abs(v) < 1e-9) v = 0; // pas de « −0 % »
  if (typeof v === 'string') return v;
  switch (format) {
    // Au-dela de 100 €, les centimes n'apportent rien a la lecture d'un budget.
    case 'euro': return signe(`${(Math.abs(v) >= 100 || Number.isInteger(Math.round(v * 100) / 100) ? ENTIER : DEUX).format(v)} €`);
    case 'pourcent': return signe(`${UN.format(v * 100)} %`);
    case 'mois': return signe(`${UN.format(v)} mois`);
    case 'score': return `${ENTIER.format(v)}\u00a0%`;
    case 'decimal': return signe(DEUX.format(v));
    case 'booleen': return v ? 'Oui' : 'Non';
    case 'nombre': return signe(DEUX.format(v));
    default: return signe(DEUX.format(v));
  }
}

/* Remplace chaque {variable} d'un texte par sa valeur mise en forme. Un nom
   inconnu reste tel quel, entre accolades : l'erreur se voit au lieu de
   disparaitre. */
export function interpoler(modele, valeurs, formats) {
  return String(modele ?? '').replace(/\{([a-z0-9_]+)\}/gi, (tout, id) => {
    const k = id.toLowerCase();
    return k in valeurs ? formater(valeurs[k], formats[k]) : tout;
  });
}

export function echapper(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
