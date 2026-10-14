import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { calculerTout, verifier, palier } from '../js/moteur.js';

const config = JSON.parse(readFileSync(new URL('../config/parametres.json', import.meta.url), 'utf8'));
const essai = config.jeu_essai;
const proche = (a, b, eps = 0.01) => assert.ok(Math.abs(a - b) < eps, `${a} ≠ ${b}`);

test('le parametrage publie est valide', () => {
  assert.deepEqual(verifier(config), []);
});

test('l’exemple du classeur Excel donne les memes indicateurs', () => {
  const { valeurs: v, erreurs } = calculerTout(config, essai);
  assert.deepEqual(erreurs, {});
  assert.equal(v.total_ressources, 3170);   // J16
  assert.equal(v.total_charges, 2969);      // J55
  assert.equal(v.solde_budgetaire, 201);    // E86
  proche(v.quotient_familial, 1056.67);     // E87
  proche(v.taux_effort_logement, 0.3890);   // K82
  proche(v.taux_endettement, 0.1009);       // K85
  proche(v.nb_uc, 1.9);                     // K88
  proche(v.rav_uc, 105.79);                 // K89
  assert.equal(v.score_budgetaire, 30);     // U95
  assert.equal(v.apurement_mini, 50);       // B103
  assert.equal(v.apurement_maxi, 100);      // C103
});

test('mensualite : position selon le score, correction, plafond', () => {
  const r = calculerTout(config, essai);
  // score 30 -> coefficient 0 -> mini 50, correction RAV -10 -> 40
  assert.equal(r.valeurs.mensualite_conseillee, 40);
  assert.equal(r.valeurs.duree_plan, 140);
  assert.equal(r.qualification.libelle, "Plan d'apurement fragile (durée)");
});

test('avec tous les coefficients a 100 %, on retrouve la mensualite du classeur', () => {
  const c = structuredClone(config);
  for (const l of c.baremes.find((b) => b.id === 'coefficient_score').lignes) l.coefficient = 1;
  const r = calculerTout(c, essai);
  assert.equal(r.valeurs.mensualite_conseillee, 90); // L104
  assert.equal(r.valeurs.duree_plan, 63);            // L106
});

test('leviers et points d’attention du classeur', () => {
  const r = calculerTout(config, essai);
  assert.deepEqual(r.leviersRetenus.map((l) => l.id), ['fsl', 'renegocier', 'reduire', 'suivi']);
  assert.equal(r.points.length, 4);
  assert.match(r.points[0].texte, /5,71 mois/);
});

test('une mensualite simulee remplace la conseillee et recalcule la duree', () => {
  const r = calculerTout(config, { ...essai, mensualite_saisie: 200 });
  assert.equal(r.valeurs.mensualite_retenue, 200);
  assert.equal(r.valeurs.duree_plan, 28);
});

test('une saisie vide ne plante pas', () => {
  const r = calculerTout(config, { valeurs: {}, dettes: [] });
  assert.deepEqual(r.erreurs, {});
  assert.equal(r.valeurs.taux_effort_logement, null);
  assert.equal(r.qualification.libelle, 'Pas de dette locative');
});

test('paliers : sens bas (strict) et sens haut', () => {
  const ps = [{ seuil: 0.25, libelle: 'a' }, { seuil: 0.35, libelle: 'b' }, { seuil: null, libelle: 'c' }];
  assert.equal(palier(0.25, ps, 'bas').libelle, 'b');
  assert.equal(palier(0.9, ps, 'bas').libelle, 'c');
  const ph = [{ seuil: 900, libelle: 'a' }, { seuil: 300, libelle: 'b' }, { seuil: null, libelle: 'c' }];
  assert.equal(palier(900, ph, 'haut').libelle, 'a');
  assert.equal(palier(-5, ph, 'haut').libelle, 'c');
});

test('un calcul circulaire est detecte', () => {
  const c = structuredClone(config);
  c.indicateurs.push({ id: 'x', libelle: 'x', formule: 'y + 1' }, { id: 'y', libelle: 'y', formule: 'x + 1' });
  assert.ok(verifier(c).some((p) => /circulaire/.test(p.message)));
});

test('les profils de démo ne citent que des champs du formulaire et se calculent sans erreur', () => {
  const demo = JSON.parse(readFileSync(new URL('../config/demo.json', import.meta.url), 'utf8'));
  const champs = new Set(config.sections.flatMap((s) => (s.champs ?? []).map((c) => c.id)));
  for (const p of demo.profils) {
    for (const k of Object.keys(p.valeurs)) assert.ok(champs.has(k), `${p.id} : champ inconnu « ${k} »`);
    assert.deepEqual(calculerTout(config, p).erreurs, {}, p.id);
  }
});
