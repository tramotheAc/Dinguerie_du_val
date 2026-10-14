import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { lirePrerempli, construireLien, genererDax, lireNombre } from '../js/url.js';
import { renommer, usages, identifiant, remplacerDansFormule } from '../js/admin-outils.js';
import { verifier } from '../js/moteur.js';

const config = JSON.parse(readFileSync(new URL('../config/parametres.json', import.meta.url), 'utf8'));
const loc = (hash, search = '') => ({ hash, search });

test('un lien pre-remplit les champs autorises et rien d’autre', () => {
  const r = lirePrerempli(config, loc('#adultes=2&loyer=650,50&nom=Dupont&salaire_1=1500&dette_locative=abc'));
  assert.deepEqual(r.valeurs, { adultes: 2, loyer: 650.5 });
  assert.deepEqual(r.ignores.map((i) => i.cle).sort(), ['dette_locative', 'nom', 'salaire_1']);
});

test('separateurs « / » et forme ?cle=valeur, nombres a la Power BI', () => {
  assert.deepEqual(lirePrerempli(config, loc('#/loyer=650/charges=80')).valeurs, { loyer: 650, charges: 80 });
  assert.deepEqual(lirePrerempli(config, loc('', '?apl=120')).valeurs, { apl: 120 });
  assert.equal(lireNombre('650,'), 650);
  assert.equal(lireNombre('1 250,5'), 1250.5);
});

test('un champ nominatif coche « lien » par erreur reste refuse', () => {
  const c = structuredClone(config);
  c.sections.find((s) => s.nominatif).champs[0].url = true;
  assert.deepEqual(lirePrerempli(c, loc('#nom=Dupont')).valeurs, {});
});

test('lien et DAX', () => {
  assert.equal(construireLien('https://x/app/#vieux', { loyer: 650, apl: '' }), 'https://x/app/#loyer=650');
  const dax = genererDax({ base: 'https://x/', table: "Table d'O", colonnes: { loyer: 'Loyer' } });
  assert.match(dax, /'Table d''O'\[Loyer\]/);
  assert.match(dax, /"&loyer=" & FORMAT/);
  assert.match(genererDax({ base: 'https://x/', table: 'T', colonnes: { loyer: 'Loyer' }, mode: 'mesure' }), /SELECTEDVALUE/);
});

test('renommer une variable met a jour formules, references et textes', () => {
  const c = structuredClone(config);
  const avant = usages(c, 'seuil_solde_faible').length;
  renommer(c, 'seuil_solde_faible', 'seuil_bas');
  c.parametres.find((p) => p.id === 'seuil_solde_faible').id = 'seuil_bas';
  assert.equal(usages(c, 'seuil_bas').length, avant);
  assert.deepEqual(verifier(c), []);
  assert.match(c.points_attention.map((p) => p.libelle).join(' '), /\{seuil_bas\}/);
});

test('le renommage epargne les textes entre guillemets et les noms plus longs', () => {
  assert.equal(remplacerDansFormule('BAREME("mini"; mini; "mini") + mini_x', 'mini', 'bas'), 'BAREME("mini"; bas; "mini") + mini_x');
  assert.equal(identifiant('Électricité / gaz'), 'electricite_gaz');
  assert.equal(identifiant('3 mois'), 'v_3_mois');
});
