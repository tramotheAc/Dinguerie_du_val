/* ===========================================================================
   Tampon de version : ajoute « ?v=<empreinte> » a chaque feuille de style,
   script et module du site.

   POURQUOI. GitHub Pages autorise le navigateur a garder chaque fichier dix
   minutes sans redemander. Apres une mise a jour, une page neuve pouvait donc
   tourner avec d'anciens scripts : boutons sans effet, icones absentes. Avec
   une adresse qui change des que le contenu change, le navigateur ne peut
   plus confondre les versions.

   L'empreinte se calcule sur le contenu des fichiers (tampons retires) : elle
   ne bouge que si quelque chose a vraiment change.

       node outils/version.mjs              pose les tampons
       node outils/version.mjs --verifier   echoue si un tampon est perime

   A lancer avant chaque commit ; le test tests/version.test.mjs le rappelle.
   =========================================================================== */

import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..');
const PAGES = ['index.html', 'admin.html'];
const DOSSIERS = ['css', 'js', 'vendor'];

const lister = (d) => readdirSync(join(RACINE, d)).flatMap((f) => {
  const p = join(d, f);
  return statSync(join(RACINE, p)).isDirectory() ? lister(p) : [p];
});

const TAMPON = /\?v=[0-9a-f]{10}/g;
const sansTampon = (s) => s.replace(TAMPON, '').replace(/export const VERSION = '[0-9a-f]*';/, "export const VERSION = '';")
  .replace(/<meta name="version" content="[0-9a-f]*">/, '<meta name="version" content="">');

export function empreinte() {
  const h = createHash('sha1');
  for (const f of [...PAGES, ...DOSSIERS.flatMap(lister)].sort()) {
    h.update(f);
    h.update(sansTampon(readFileSync(join(RACINE, f), 'utf8')));
  }
  return h.digest('hex').slice(0, 10);
}

function tamponner(texte, v) {
  return texte
    // pages : feuilles, scripts, modules
    .replace(/((?:href|src)="(?:css|js|vendor)\/[^"?]+)(?:\?v=[0-9a-f]{10})?"/g, `$1?v=${v}"`)
    .replace(/<meta name="version" content="[0-9a-f]*">/, `<meta name="version" content="${v}">`)
    // modules : imports statiques et dynamiques, scripts charges a la demande
    .replace(/(from '\.\/[^'?]+\.js)(?:\?v=[0-9a-f]{10})?'/g, `$1?v=${v}'`)
    .replace(/(import\('\.\/[^'?]+\.js)(?:\?v=[0-9a-f]{10})?'\)/g, `$1?v=${v}')`)
    .replace(/(charger\('vendor\/[^'?]+\.js)(?:\?v=[0-9a-f]{10})?'\)/g, `$1?v=${v}')`)
    .replace(/export const VERSION = '[0-9a-f]*';/, `export const VERSION = '${v}';`);
}

export function poser({ ecrire = true } = {}) {
  const v = empreinte();
  const perimes = [];
  for (const f of [...PAGES, ...lister('js')]) {
    const avant = readFileSync(join(RACINE, f), 'utf8');
    const apres = tamponner(avant, v);
    if (apres !== avant) {
      perimes.push(f);
      if (ecrire) writeFileSync(join(RACINE, f), apres);
    }
  }
  return { v, perimes };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const verifier = process.argv.includes('--verifier');
  const { v, perimes } = poser({ ecrire: !verifier });
  if (verifier && perimes.length) {
    console.error(`Tampons périmés (${perimes.join(', ')}) : lancer « node outils/version.mjs ».`);
    process.exit(1);
  }
  console.log(verifier ? `Tampons à jour (${v}).` : `Version ${v} posée${perimes.length ? ` dans ${perimes.join(', ')}` : ' (rien à changer)'}.`);
}
