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

import { verifier } from './moteur.js?v=b602aab638';

const CLE = 'dinguerie.parametrage.brouillon';
// Les elements du publie que le brouillon connaissait : ce qui manque au
// brouillon et y figurait a ete supprime expres ; le reste est nouveau.
const CLE_BASE = 'dinguerie.parametrage.base';

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

export function lireBase() {
  try {
    const s = localStorage.getItem(CLE_BASE);
    return s ? JSON.parse(s) : null;
  } catch {
    return null;
  }
}

export function ecrireBrouillon(config, publie) {
  try {
    localStorage.setItem(CLE, JSON.stringify(config));
    if (publie) localStorage.setItem(CLE_BASE, JSON.stringify(inventaire(publie)));
    return true;
  } catch {
    return false;
  }
}

export function effacerBrouillon() {
  try { localStorage.removeItem(CLE); localStorage.removeItem(CLE_BASE); } catch { /* stockage indisponible : rien a effacer */ }
}

/* Un brouillon fait avant une evolution du parametrage publie n'a pas les
   reglages apparus depuis (sections cote a cote, jauges des criteres, noms
   courts...). On lui ajoute ce qui lui manque, sans toucher a ce qu'il
   contient : objets apparies par cle, ou dans les listes par leur
   identifiant (« id », sinon « indicateur » ou « variable »).

   Un element de liste absent du brouillon n'est ajoute que s'il est nouveau
   dans le publie (absent de la « base » connue du brouillon) : une jauge
   supprimee dans l'admin ne revient pas. Sans base (brouillon ancien),
   tout ce qui manque est ajoute. */
const objet = (x) => x && typeof x === 'object' && !Array.isArray(x);
const cleDe = (x) => x.id ?? x.indicateur ?? x.variable;
const copie = (x) => JSON.parse(JSON.stringify(x));

/* Les identifiants des listes du publie, par chemin (« .jauges »,
   « .sections[logement].champs »...). */
export function inventaire(publie, chemin = '', acc = {}) {
  if (Array.isArray(publie)) {
    const cles = publie.filter(objet).map(cleDe).filter((k) => k !== undefined);
    if (cles.length) acc[chemin] = cles;
    for (const p of publie) if (objet(p) && cleDe(p) !== undefined) inventaire(p, `${chemin}[${cleDe(p)}]`, acc);
  } else if (objet(publie)) {
    for (const [cle, valeur] of Object.entries(publie)) inventaire(valeur, `${chemin}.${cle}`, acc);
  }
  return acc;
}

export function rattraper(brouillon, publie, base = null, chemin = '') {
  if (Array.isArray(brouillon) && Array.isArray(publie)) {
    const connus = base?.[chemin] ? new Set(base[chemin]) : null;
    const indexDe = (k) => brouillon.findIndex((b) => objet(b) && cleDe(b) === k);
    publie.forEach((p, n) => {
      const k = objet(p) ? cleDe(p) : undefined;
      if (k === undefined) return;
      const i = indexDe(k);
      if (i >= 0) { rattraper(brouillon[i], p, base, `${chemin}[${k}]`); return; }
      if (connus?.has(k)) return; // supprime expres dans le brouillon
      // nouveau : place apres son voisin du publie, s'il est dans le brouillon
      let apres = -1;
      for (let m = n - 1; m >= 0 && apres < 0; m -= 1) if (objet(publie[m])) apres = indexDe(cleDe(publie[m]));
      brouillon.splice(apres + 1, 0, copie(p));
    });
  } else if (objet(brouillon) && objet(publie)) {
    for (const [cle, valeur] of Object.entries(publie)) {
      if (!(cle in brouillon)) brouillon[cle] = copie(valeur);
      else rattraper(brouillon[cle], valeur, base, `${chemin}.${cle}`);
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
  const brouillon = lu && rattraper(lu, publie, lireBase());
  if (brouillon) {
    ecrireBrouillon(brouillon, publie); // rattrape : il connait desormais ce publie
    const problemes = verifier(brouillon);
    if (!problemes.length) return { config: brouillon, source: 'brouillon', publie };
    return { config: publie, source: 'publie', publie, brouillonCasse: problemes };
  }
  return { config: publie, source: 'publie', publie };
}

export const cloner = (o) => JSON.parse(JSON.stringify(o));
