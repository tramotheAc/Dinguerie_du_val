import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculer, analyser, variablesLues, chercherBareme } from '../js/formules.js';

const ctx = (valeurs = {}, baremes = {}) => ({ valeurs, baremes });

test('arithmetique, priorites et pourcentages', () => {
  assert.equal(calculer('1 + 2 * 3', ctx()), 7);
  assert.equal(calculer('(1 + 2) * 3', ctx()), 9);
  assert.equal(calculer('2 ^ 3 ^ 2', ctx()), 512);
  assert.equal(calculer('-2 + 5', ctx()), 3);
  assert.equal(calculer('35%', ctx()), 0.35);
  assert.equal(calculer('0,5 + 0.25', ctx()), 0.75);
});

test('fonctions a la francaise et alias anglais', () => {
  assert.equal(calculer('SI(a > 1; "grand"; "petit")', ctx({ a: 2 })), 'grand');
  assert.equal(calculer('IF(a > 1; 1; 0)', ctx({ a: 0 })), 0);
  assert.equal(calculer('ET(VRAI; a = 1)', ctx({ a: 1 })), true);
  assert.equal(calculer('a > 1 OU a < 0', ctx({ a: -1 })), true);
  assert.equal(calculer('NON(a)', ctx({ a: 0 })), true);
  assert.equal(calculer('MIN(3; 1; 2) + MAX(1; 4)', ctx()), 5);
  assert.equal(calculer('ARRONDI.SUP(5600 / 90; 0)', ctx()), 63);
  assert.equal(calculer('ARRONDI(2,345; 2)', ctx()), 2.35);
  assert.equal(calculer('ARRONDI.INF(2,99)', ctx()), 2);
});

test('une division par zero est « non calculable » et se propage', () => {
  assert.equal(calculer('1 / 0', ctx()), null);
  assert.equal(calculer('1 / 0 + 2', ctx()), null);
  assert.equal(calculer('1 / 0 > 3', ctx()), false);
  assert.equal(calculer('SIERREUR(1 / 0; 7)', ctx()), 7);
  assert.equal(calculer('ESTVIDE(a / b)', ctx({ a: 1, b: 0 })), true);
});

test('les erreurs de saisie sont dites en francais', () => {
  assert.throws(() => analyser('MIN(a, b)'), /point-virgule/);
  assert.throws(() => analyser('SI(a > 1; 2'), /« \) » manquant/);
  assert.throws(() => analyser('FOO(1)'), /Fonction inconnue/);
  assert.throws(() => analyser('a b'), /inattendu/);
  assert.throws(() => calculer('inconnue + 1', ctx()), /Variable inconnue/);
  assert.throws(() => analyser('SI(1)'), /SI attend 2 à 3/);
});

test('variables lues, insensibles a la casse', () => {
  assert.deepEqual([...variablesLues(analyser('Loyer + charges * SI(apl > 0; 1; 0)'))].sort(), ['apl', 'charges', 'loyer']);
});

test('bareme : derniere ligne inferieure ou egale, premiere ligne en dessous', () => {
  const b = { libelle: 'b', colonnes: [{ id: 'seuil' }, { id: 'v' }], lignes: [{ seuil: 100, v: 2 }, { seuil: 0, v: 1 }, { seuil: 300, v: 3 }] };
  assert.equal(chercherBareme(b, 150, 'v'), 2);
  assert.equal(chercherBareme(b, 300, 'v'), 3);
  assert.equal(chercherBareme(b, -5, 'v'), 1);
  assert.equal(calculer('BAREME("b"; 999; "v")', ctx({}, { b })), 3);
  assert.throws(() => calculer('BAREME("b"; 1; "x")', ctx({}, { b })), /Colonne/);
});
