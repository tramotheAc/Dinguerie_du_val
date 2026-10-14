/* ===========================================================================
   Le parametrage.

   La reference est config/parametres.json, publie avec le site. L'admin
   travaille sur un brouillon garde dans le navigateur (localStorage) : le
   calculateur de ce meme navigateur l'utilise pour qu'on puisse essayer un
   changement avant de le publier. Publier, c'est remplacer
   config/parametres.json dans le depot par le fichier telecharge.

   Ce brouillon ne contient que des bareme et des formules - jamais une
   donnee de menage. La saisie, elle, ne quitte pas la memoire de la page.
   =========================================================================== */

import { verifier } from './moteur.js?v=743faf48c0';

const CLE = 'dinguerie.parametrage.brouillon';

export async function chargerPublie() {
  const r = await fetch('config/parametres.json', { cache: 'no-cache' });
  if (!r.ok) throw new Error(`Paramétrage introuvable (${r.status})`);
  return r.json();
}

export function lireBrouillon() {
  try {
    const s = localStorage.getItem(CLE);
    return s ? JSON.parse(s) : null;
  } catch {
    return null;
  }
}

export function ecrireBrouillon(config) {
  try {
    localStorage.setItem(CLE, JSON.stringify(config));
    return true;
  } catch {
    return false;
  }
}

export function effacerBrouillon() {
  try { localStorage.removeItem(CLE); } catch { /* stockage indisponible : rien a effacer */ }
}

/* Un brouillon fait avant une evolution du parametrage publie n'a pas les
   reglages apparus depuis (sections cote a cote, postes d'office, noms
   courts...). On lui ajoute ce qui lui manque, sans toucher a ce qu'il
   contient : objets apparies par cle, ou par « id » dans les listes. */
const objet = (x) => x && typeof x === 'object' && !Array.isArray(x);
export function rattraper(brouillon, publie) {
  if (Array.isArray(brouillon) && Array.isArray(publie)) {
    const parId = new Map(publie.filter((p) => objet(p) && p.id !== undefined).map((p) => [p.id, p]));
    for (const b of brouillon) if (objet(b) && parId.has(b.id)) rattraper(b, parId.get(b.id));
  } else if (objet(brouillon) && objet(publie)) {
    for (const [cle, valeur] of Object.entries(publie)) {
      if (!(cle in brouillon)) brouillon[cle] = JSON.parse(JSON.stringify(valeur));
      else rattraper(brouillon[cle], valeur);
    }
  }
  return brouillon;
}

/* Le parametrage a utiliser par le calculateur : le brouillon s'il existe et
   se tient, sinon le publie. Un brouillon casse ne doit jamais rendre le
   calculateur inutilisable. */
export async function chargerConfig() {
  const publie = await chargerPublie();
  const lu = lireBrouillon();
  const brouillon = lu && rattraper(lu, publie);
  if (brouillon) {
    const problemes = verifier(brouillon);
    if (!problemes.length) return { config: brouillon, source: 'brouillon', publie };
    return { config: publie, source: 'publie', publie, brouillonCasse: problemes };
  }
  return { config: publie, source: 'publie', publie };
}

export const cloner = (o) => JSON.parse(JSON.stringify(o));
