/* ===========================================================================
   Animations d'interface - reprises de l'esprit du SIG (Oukilest) : courtes,
   sobres, et coupees net si le poste demande moins d'animations
   (prefers-reduced-motion). Ecrites avec l'API Web Animations du navigateur :
   aucune bibliotheque a charger.
   =========================================================================== */

export const DUREE = { vite: 180, base: 280, lent: 420 };
const COURBE = 'cubic-bezier(.22,.8,.3,1)';

let coupe = false;
/* Le PDF se capture sur des valeurs finales : on coupe tout le temps de l'export. */
export function couperAnimations(oui) { coupe = oui; }

export const sansAnimation = () => coupe || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/* Une animation ne laisse aucun style derriere elle : sinon chaque element
   anime garde un contexte d'empilement et peut passer devant un menu voisin. */
function jouer(el, images, options) {
  if (sansAnimation() || !el.animate) return null;
  const a = el.animate(images, { duration: DUREE.base, easing: COURBE, ...options });
  a.addEventListener('finish', () => a.cancel());
  return a;
}

/* Apparition d'un panneau : fondu et leger glissement. */
export function apparaitre(el, depuis = 'bas') {
  const dep = { bas: 'translateY(10px)', droite: 'translateX(18px)', zoom: 'scale(.97)' }[depuis];
  return jouer(el, [{ opacity: 0, transform: dep }, { opacity: 1, transform: 'none' }], { fill: 'backwards' });
}

/* Cascade : les blocs d'une page arrivent l'un apres l'autre. */
export function cascade(els, pas = 45) {
  // Au-dela d'une dizaine de blocs, les suivants sont hors ecran : inutile
  // de les faire attendre.
  [...els].slice(0, 12).forEach((el, i) => jouer(el,
    [{ opacity: 0, transform: 'translateY(10px)' }, { opacity: 1, transform: 'none' }],
    { delay: i * pas, fill: 'backwards' }));
}

/* Comptage anime d'un chiffre cle, de l'ancienne valeur a la nouvelle. */
const enCours = new WeakMap();
export function compter(el, de, vers, ecrire) {
  cancelAnimationFrame(enCours.get(el));
  if (sansAnimation() || de === vers || !Number.isFinite(de) || !Number.isFinite(vers)) { ecrire(vers); return; }
  const debut = performance.now();
  const duree = DUREE.lent + 260;
  const pas = (t) => {
    const p = Math.min(1, (t - debut) / duree);
    const e = p === 1 ? 1 : 1 - 2 ** (-10 * p); // outExpo, comme dans le SIG
    ecrire(p === 1 ? vers : de + (vers - de) * e);
    if (p < 1) enCours.set(el, requestAnimationFrame(pas));
  };
  enCours.set(el, requestAnimationFrame(pas));
}

/* Trace d'un arc ou d'une barre SVG : le trait se dessine depuis zero. */
export function tracer(chemin, longueur) {
  if (sansAnimation()) return;
  jouer(chemin, [{ strokeDashoffset: longueur }, { strokeDashoffset: 0 }], { duration: DUREE.lent + 300 });
}

/* Croissance d'une barre horizontale depuis la gauche. */
export function grandir(el, delai = 0) {
  jouer(el, [{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }], { duration: DUREE.lent + 120, delay: delai, fill: 'backwards' });
}

/* Petit sursaut d'un element qui vient de changer (un total, un statut). */
export function signaler(el) {
  jouer(el, [{ transform: 'scale(1)' }, { transform: 'scale(1.06)' }, { transform: 'scale(1)' }], { duration: DUREE.base });
}
