import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rattraper } from '../js/config.js';

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
