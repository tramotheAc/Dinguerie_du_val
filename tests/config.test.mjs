import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rattraper, inventaire } from '../js/config.js';

test('un ancien brouillon recoit les reglages apparus depuis, sans perdre les siens', () => {
  const publie = {
    nouveau: { a: 1 },
    sections: [
      { id: 'logement', titre: 'Logement', avec_precedente: true, champs: [{ id: 'loyer', essentiel: true, court: 'Loyer' }] },
      { id: 'dettes', titre: 'Dettes', avec_precedente: true },
    ],
  };
  const brouillon = {
    sections: [
      { id: 'logement', titre: 'Mon logement', champs: [{ id: 'loyer' }, { id: 'ajoute' }] },
      { id: 'dettes', titre: 'Dettes', avec_precedente: false },
      { id: 'perso' },
    ],
  };
  rattraper(brouillon, publie);
  assert.deepEqual(brouillon.nouveau, { a: 1 });
  assert.equal(brouillon.sections[0].titre, 'Mon logement');
  assert.equal(brouillon.sections[0].avec_precedente, true);
  assert.deepEqual(brouillon.sections[0].champs[0], { id: 'loyer', essentiel: true, court: 'Loyer' });
  assert.equal(brouillon.sections[1].avec_precedente, false, 'un choix du brouillon est respecte');
  assert.equal(brouillon.sections.length, 3, 'une liste du brouillon garde sa composition');
});

test('les jauges et criteres sont apparies par leur indicateur', () => {
  const publie = { jauges: [{ indicateur: 'taux_effort', critere: 'score_effort', en_clair: 'x' }] };
  const brouillon = { jauges: [{ indicateur: 'taux_effort', libelle: 'Effort' }] };
  rattraper(brouillon, publie);
  assert.equal(brouillon.jauges[0].critere, 'score_effort');
  assert.equal(brouillon.jauges[0].libelle, 'Effort');
});

test('un element nouveau du publie est ajoute ; un element supprime expres ne revient pas', () => {
  const ancien = { jauges: [{ indicateur: 'a' }, { indicateur: 'b' }] };
  const publie = { jauges: [{ indicateur: 'a' }, { indicateur: 'b' }, { indicateur: 'c', critere: 'x' }], indicateurs: [{ id: 'n' }] };
  const base = inventaire(ancien);
  const brouillon = { jauges: [{ indicateur: 'a' }] }; // « b » supprimee dans l'admin
  rattraper(brouillon, publie, base);
  assert.deepEqual(brouillon.jauges.map((j) => j.indicateur), ['a', 'c']);
  assert.deepEqual(brouillon.indicateurs, [{ id: 'n' }]);
  // sans base connue, tout ce qui manque revient, a sa place
  const vieux = { jauges: [{ indicateur: 'a' }, { indicateur: 'c' }] };
  rattraper(vieux, publie);
  assert.deepEqual(vieux.jauges.map((j) => j.indicateur), ['a', 'b', 'c']);
});
