/* ===========================================================================
   La page de saisie, construite entierement depuis le parametrage : ajouter
   une ligne de depense dans l'admin la fait apparaitre ici, sans code.
   =========================================================================== */

import { h, icone, vider } from './dom.js';
import { formater } from './format.js';
import { signaler } from './animations.js';

const LIGNES_DETTES_INITIALES = 3;

export function etatVide() {
  return {
    valeurs: {},
    dettes: Array.from({ length: LIGNES_DETTES_INITIALES }, () => ({ type: '', montant: '', mensualite: '', echeance: '' })),
    mensualite_saisie: 0,
  };
}

/* Montant tape a la francaise : « 1 250,50 » ou « 1250.5 ». */
export function lireMontant(s) {
  const t = String(s ?? '').replace(/[\s €]/g, '').replace(',', '.');
  if (t === '') return '';
  const n = Number(t);
  return Number.isFinite(n) ? n : '';
}

const afficherMontant = (v) => (v === '' || v === undefined || v === null ? '' : String(v).replace('.', ','));

export function creerSaisie({ config, racine, etat, prerempli, surChangement }) {
  const aCalculer = [];   // [{ el, variable, format }]
  const totaux = [];      // [{ el, variable }]
  const formats = {};
  for (const i of config.indicateurs) formats[i.id] = i.format;
  const marques = new Set((prerempli?.appliques ?? []).map((c) => c.id));

  function champ(c, section) {
    const id = `champ-${c.id}`;
    const v = etat.valeurs[c.id];
    const commun = {
      id, name: c.id, autocomplete: 'off',
      class: marques.has(c.id) ? 'prerempli' : null,
    };
    let saisie;
    if (c.type === 'texte' || c.type === 'date') {
      saisie = h('input', { ...commun, type: c.type === 'date' ? 'date' : 'text', value: v ?? '',
        oninput: (e) => { etat.valeurs[c.id] = e.target.value; surChangement(); } });
    } else {
      const montant = c.type === 'montant';
      saisie = h('span', { class: `saisie-nombre${montant ? ' euro' : ''}` },
        h('input', {
          ...commun, type: 'text', inputmode: montant ? 'decimal' : 'numeric', value: afficherMontant(v),
          placeholder: '0', 'aria-describedby': c.aide ? `${id}-aide` : null,
          oninput: (e) => {
            const brut = e.target.value;
            const n = lireMontant(brut);
            e.target.toggleAttribute('aria-invalid', brut.trim() !== '' && n === '');
            etat.valeurs[c.id] = c.type === 'nombre' && n !== '' ? Math.max(0, Math.round(n)) : n;
            e.target.classList.remove('prerempli');
            surChangement();
          },
          onblur: (e) => { if (!e.target.hasAttribute('aria-invalid')) e.target.value = afficherMontant(etat.valeurs[c.id]); },
        }));
    }
    return h('div', { class: `champ${section.type === 'budget' ? ' ligne-budget' : ''}` },
      h('label', { for: id }, c.libelle, marques.has(c.id) ? h('span', { class: 'jeton petrole mini', title: 'Valeur reçue du lien' }, 'lien') : null),
      saisie,
      c.aide ? h('small', { id: `${id}-aide`, class: 'aide' }, c.aide) : null);
  }

  function ligneCalculee(l) {
    const valeur = h('output', { class: 'valeur-calculee' }, '—');
    aCalculer.push({ el: valeur, variable: l.variable, format: formats[l.variable] ?? 'euro' });
    return h('div', { class: 'champ calcule' }, h('span', { class: 'etiquette-calcul' }, l.libelle), valeur);
  }

  function tableDettes(section) {
    const corps = h('tbody');
    const total = { montant: h('td', { class: 'num' }), mensualite: h('td', { class: 'num' }) };
    const majTotaux = () => {
      const somme = (k) => etat.dettes.reduce((t, d) => t + (Number(lireMontant(d[k])) || 0), 0);
      total.montant.textContent = formater(somme('montant'), 'euro');
      total.mensualite.textContent = formater(somme('mensualite'), 'euro');
    };
    const dessiner = () => {
      vider(corps, etat.dettes.map((d, n) => {
        const cellule = (k, type, libelle) => h('td', { class: type === 'montant' ? 'num' : null },
          h('input', {
            type: 'text', value: type === 'montant' ? afficherMontant(d[k]) : d[k], 'aria-label': `${libelle}, ligne ${n + 1}`,
            inputmode: type === 'montant' ? 'decimal' : null, placeholder: type === 'montant' ? '0' : '',
            oninput: (e) => { d[k] = type === 'montant' ? lireMontant(e.target.value) : e.target.value; majTotaux(); surChangement(); },
          }));
        return h('tr', {},
          cellule('type', 'texte', 'Type de dette'),
          cellule('montant', 'montant', 'Montant'),
          cellule('mensualite', 'montant', 'Mensualité'),
          cellule('echeance', 'texte', 'Échéance'),
          h('td', {}, h('button', {
            type: 'button', class: 'bouton-icone', 'aria-label': `Retirer la ligne ${n + 1}`, title: 'Retirer la ligne',
            onclick: () => { etat.dettes.splice(n, 1); dessiner(); surChangement(); },
          }, icone('croix'))));
      }));
      majTotaux();
    };
    dessiner();
    return h('div', { class: 'table-dettes' },
      h('table', {},
        h('thead', {}, h('tr', {}, h('th', {}, 'Type de dette'), h('th', { class: 'num' }, 'Montant'), h('th', { class: 'num' }, 'Mensualité'), h('th', {}, 'Échéance'), h('th', {}, h('span', { class: 'visuellement-cache' }, 'Actions')))),
        corps,
        h('tfoot', {}, h('tr', {}, h('th', {}, 'Total'), total.montant, total.mensualite, h('td'), h('td')))),
      h('button', {
        type: 'button', class: 'bouton-discret ajout',
        onclick: () => { etat.dettes.push({ type: '', montant: '', mensualite: '', echeance: '' }); dessiner(); corps.lastElementChild?.querySelector('input')?.focus(); },
      }, icone('plus'), 'Ajouter une dette'));
  }

  function carte(section) {
    let total = null;
    if (section.type === 'budget') {
      total = h('span', { class: 'total-section', 'aria-live': 'polite' }, '—');
      totaux.push({ el: total, variable: section.total || `somme_${section.id}` });
    }
    let corps;
    if (section.type === 'dettes') corps = tableDettes(section);
    else {
      corps = h('div', { class: section.type === 'budget' ? 'lignes-budget' : 'grille-champs' },
        section.type === 'budget' ? (section.lignes_calculees ?? []).map(ligneCalculee) : null,
        (section.champs ?? []).map((c) => champ(c, section)),
        section.type !== 'budget' ? (section.lignes_calculees ?? []).map(ligneCalculee) : null);
    }
    return h('section', { class: `carte section-saisie section-${section.type}`, 'aria-labelledby': `titre-${section.id}` },
      h('header', {},
        h('div', {}, h('h3', { id: `titre-${section.id}` }, section.titre), section.description ? h('p', {}, section.description) : null),
        total),
      h('div', { class: 'corps' }, corps));
  }

  const dossier = config.sections.filter((s) => s.colonne !== 'budget');
  const budget = config.sections.filter((s) => s.colonne === 'budget');
  vider(racine,
    h('div', { class: 'colonne-saisie' }, h('h3', { class: 'titre-colonne' }, h('span', { class: 'numero' }, '1'), 'Dossier'), dossier.map(carte)),
    h('div', { class: 'colonne-saisie' }, h('h3', { class: 'titre-colonne' }, h('span', { class: 'numero' }, '2'), 'Budget mensuel'), budget.map(carte)));

  const precedents = new Map();
  return {
    rafraichir(resultat) {
      for (const { el, variable, format } of aCalculer) el.textContent = formater(resultat.valeurs[variable], format);
      for (const { el, variable } of totaux) {
        const t = formater(resultat.valeurs[variable], 'euro');
        if (precedents.has(el) && precedents.get(el) !== t) signaler(el);
        precedents.set(el, t);
        el.textContent = t;
      }
    },
  };
}
