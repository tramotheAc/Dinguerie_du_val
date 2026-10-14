import { test } from 'node:test';
import assert from 'node:assert/strict';
import { poser } from '../outils/version.mjs';

test('chaque fichier porte le tampon de version a jour (sinon : node outils/version.mjs)', () => {
  const { perimes } = poser({ ecrire: false });
  assert.deepEqual(perimes, []);
});
