/* ===========================================================================
   La page de saisie, construite entierement depuis le parametrage : ajouter
   une ligne de depense dans l'admin la fait apparaitre ici, sans code.

   Pour qu'elle se remplisse sans ennui : une icone par section et par ligne,
   des boutons − / + pour les personnes du foyer, une frise qui dessine le
   foyer, et un compteur de lignes renseignees par section.
   =========================================================================== */

import { h, icone, vider } from './dom.js?v=6e18913daa';
import { formater } from './format.js?v=6e18913daa';
import { signaler } from './animations.js?v=6e18913daa';
import { dessinIcone, nomIcone } from './icones.js?v=6e18913daa';

const LIGNES_DETTES_INITIALES = 3;
const FRISE_MAX = 8; // au-dela, la frise ecrit « +n »

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
const renseigne = (v) => v !== '' && v !== undefined && v !== null && v !== 0;

/* Ce qu'une section a de rempli : sert au compteur de la carte et aux etapes. */
export function avancement(section, etat) {
  if (section.type === 'dettes') {
    const n = etat.dettes.filter((d) => d.type || renseigne(d.montant) || renseigne(d.mensualite)).length;
    return { remplis: n, total: null };
  }
  const champs = section.champs ?? [];
  return { remplis: champs.filter((c) => renseigne(etat.valeurs[c.id])).length, total: champs.length };
}

export function creerSaisie({ config, racine, etat, prerempli, surChangement }) {
  const aCalculer = [];   // [{ el, variable, format }]
  const totaux = [];      // [{ el, variable }]
  const compteurs = [];   // [{ el, section }]
  const frises = [];      // [{ el, section }]
  const formats = {};
  for (const i of config.indicateurs) formats[i.id] = i.format;
  const marques = new Set((prerempli?.appliques ?? []).map((c) => c.id));

  const marqueLien = (c) => (marques.has(c.id) ? h('span', { class: 'jeton petrole mini', title: 'Valeur reçue du lien' }, 'lien') : null);

  function champTexte(c, section, id) {
    return h('span', { class: 'saisie-icone' },
      dessinIcone(nomIcone(c, 'document')),
      h('input', {
        id, name: c.id, autocomplete: 'off', type: c.type === 'date' ? 'date' : 'text', value: etat.valeurs[c.id] ?? '',
        placeholder: c.type === 'date' ? null : (section.nominatif ? 'Facultatif' : ''),
        oninput: (e) => { etat.valeurs[c.id] = e.target.value; surChangement(); },
      }));
  }

  function champMontant(c, id) {
    const montant = c.type === 'montant';
    return h('span', { class: `saisie-nombre${montant ? ' euro' : ''}` },
      h('input', {
        id, name: c.id, autocomplete: 'off', type: 'text', inputmode: montant ? 'decimal' : 'numeric',
        value: afficherMontant(etat.valeurs[c.id]), placeholder: '0',
        class: marques.has(c.id) ? 'prerempli' : null, 'aria-describedby': c.aide ? `${id}-aide` : null,
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

  /* Un nombre de personnes se regle au doigt : − et + autour du champ. */
  function compteur(c, id) {
    const champ = h('input', {
      id, name: c.id, autocomplete: 'off', type: 'text', inputmode: 'numeric', value: afficherMontant(etat.valeurs[c.id]),
      placeholder: '0', class: marques.has(c.id) ? 'prerempli' : null,
      oninput: (e) => {
        const n = lireMontant(e.target.value);
        e.target.toggleAttribute('aria-invalid', e.target.value.trim() !== '' && n === '');
        etat.valeurs[c.id] = n === '' ? '' : Math.max(0, Math.round(n));
        e.target.classList.remove('prerempli');
        surChangement();
      },
    });
    const pas = (d) => {
      const n = Math.max(0, (Number(etat.valeurs[c.id]) || 0) + d);
      etat.valeurs[c.id] = n;
      champ.value = String(n);
      champ.classList.remove('prerempli');
      champ.removeAttribute('aria-invalid');
      surChangement();
    };
    return h('span', { class: 'compteur' },
      h('button', { type: 'button', class: 'pas', 'aria-label': `Retirer une personne : ${c.libelle}`, onclick: () => pas(-1) }, icone('moins')),
      champ,
      h('button', { type: 'button', class: 'pas', 'aria-label': `Ajouter une personne : ${c.libelle}`, onclick: () => pas(1) }, icone('plus')));
  }

  function champ(c, section) {
    const id = `champ-${c.id}`;
    if (section.type === 'budget') {
      return h('div', { class: 'champ ligne-budget' },
        h('label', { for: id },
          h('span', { class: 'puce-icone' }, dessinIcone(nomIcone(c))),
          h('span', { class: 'texte-label' }, c.libelle), marqueLien(c)),
        champMontant(c, id),
        c.aide ? h('small', { id: `${id}-aide`, class: 'aide' }, c.aide) : null);
    }
    let saisie;
    if (c.type === 'texte' || c.type === 'date') saisie = champTexte(c, section, id);
    else if (c.type === 'nombre') saisie = compteur(c, id);
    else saisie = h('span', { class: 'saisie-icone' }, dessinIcone(nomIcone(c)), champMontant(c, id));
    return h('div', { class: `champ champ-${c.type}` },
      h('label', { for: id }, h('span', { class: 'texte-label' }, c.libelle), marqueLien(c)),
      saisie,
      c.aide ? h('small', { id: `${id}-aide`, class: 'aide' }, c.aide) : null);
  }

  function ligneCalculee(l) {
    const valeur = h('output', { class: 'valeur-calculee' }, '—');
    aCalculer.push({ el: valeur, variable: l.variable, format: formats[l.variable] ?? 'euro' });
    return h('div', { class: 'champ calcule' },
      h('span', { class: 'etiquette-calcul' }, h('span', { class: 'puce-icone' }, dessinIcone(nomIcone(l, 'calculette'))), h('span', { class: 'texte-label' }, l.libelle)),
      valeur);
  }

  function tableDettes() {
    const corps = h('tbody');
    const total = { montant: h('td', { class: 'num' }), mensualite: h('td', { class: 'num' }) };
    const majTotaux = () => {
      const somme = (k) => etat.dettes.reduce((t, d) => t + (Number(lireMontant(d[k])) || 0), 0);
      total.montant.textContent = formater(somme('montant'), 'euro');
      total.mensualite.textContent = formater(somme('mensualite'), 'euro');
    };
    const dessiner = () => {
      vider(corps, etat.dettes.map((d, n) => {
        const cellule = (k, type, libelle, place) => h('td', { class: type === 'montant' ? 'num' : null, 'data-libelle': libelle },
          h('span', { class: type === 'montant' ? 'saisie-nombre euro' : null },
            h('input', {
              type: 'text', value: type === 'montant' ? afficherMontant(d[k]) : d[k], 'aria-label': `${libelle}, ligne ${n + 1}`,
              inputmode: type === 'montant' ? 'decimal' : null, placeholder: place,
              oninput: (e) => { d[k] = type === 'montant' ? lireMontant(e.target.value) : e.target.value; majTotaux(); surChangement(); },
            })));
        return h('tr', {},
          cellule('type', 'texte', 'Type de dette', 'Ex. découvert'),
          cellule('montant', 'montant', 'Montant', '0'),
          cellule('mensualite', 'montant', 'Mensualité', '0'),
          cellule('echeance', 'texte', 'Échéance', 'mm/aaaa'),
          h('td', { class: 'action' }, h('button', {
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

  /* La frise du foyer : une silhouette par personne. */
  function frise(section) {
    const el = h('div', { class: 'frise', 'aria-hidden': 'true' });
    frises.push({ el, section });
    return el;
  }

  function dessinerFrise(el, section) {
    const morceaux = [];
    let n = 0;
    for (const c of section.champs ?? []) {
      const k = Math.max(0, Math.round(Number(etat.valeurs[c.id]) || 0));
      for (let i = 0; i < k; i++) {
        n++;
        if (n <= FRISE_MAX) morceaux.push(h('span', { class: `silhouette s-${c.id}`, title: c.libelle }, dessinIcone(nomIcone(c))));
      }
    }
    if (n > FRISE_MAX) morceaux.push(h('span', { class: 'silhouette plus' }, `+${n - FRISE_MAX}`));
    if (!n) morceaux.push(h('span', { class: 'frise-vide' }, 'Ajoutez les membres du foyer'));
    const cle = `${n}|${(section.champs ?? []).map((c) => etat.valeurs[c.id]).join(',')}`;
    if (el.dataset.cle === cle) return;
    el.dataset.cle = cle;
    vider(el, morceaux, n ? h('span', { class: 'frise-total' }, `${n} personne${n > 1 ? 's' : ''}`) : null);
  }

  function carte(section) {
    const ton = section.colonne === 'budget' ? (section.id === 'ressources' ? 'entree' : 'sortie') : 'dossier';
    let total = null;
    if (section.type === 'budget') {
      total = h('span', { class: 'total-section', 'aria-live': 'polite' }, '—');
      totaux.push({ el: total, variable: section.total || `somme_${section.id}` });
    }
    const pastille = h('span', { class: 'compte-section' });
    compteurs.push({ el: pastille, section });
    const toutNombre = section.type === 'champs' && (section.champs ?? []).length && section.champs.every((c) => c.type === 'nombre');
    let corps;
    if (section.type === 'dettes') corps = tableDettes();
    else {
      corps = h('div', { class: section.type === 'budget' ? 'lignes-budget' : 'grille-champs' },
        section.type === 'budget' ? (section.lignes_calculees ?? []).map(ligneCalculee) : null,
        (section.champs ?? []).map((c) => champ(c, section)),
        section.type !== 'budget' ? (section.lignes_calculees ?? []).map(ligneCalculee) : null);
    }
    return h('section', { class: `carte section-saisie section-${section.type} ton-${ton}`, id: `section-${section.id}`, 'aria-labelledby': `titre-${section.id}` },
      h('header', {},
        h('span', { class: 'medaillon' }, dessinIcone(nomIcone(section, 'dossier'))),
        h('div', { class: 'titres' },
          h('h3', { id: `titre-${section.id}` }, section.titre),
          section.description ? h('p', {}, section.description) : null,
          pastille),
        total),
      toutNombre ? frise(section) : null,
      h('div', { class: 'corps' }, corps));
  }

  const dossier = config.sections.filter((s) => s.colonne !== 'budget');
  const budget = config.sections.filter((s) => s.colonne === 'budget');
  vider(racine,
    h('div', { class: 'colonne-saisie' }, h('h3', { class: 'titre-colonne' }, h('span', { class: 'numero' }, '1'), 'Le dossier'), dossier.map(carte)),
    h('div', { class: 'colonne-saisie' }, h('h3', { class: 'titre-colonne' }, h('span', { class: 'numero' }, '2'), 'Le budget du mois'), budget.map(carte)));

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
      for (const { el, section } of compteurs) {
        const { remplis, total } = avancement(section, etat);
        el.textContent = total === null
          ? (remplis ? `${remplis} dette${remplis > 1 ? 's' : ''} renseignée${remplis > 1 ? 's' : ''}` : 'Aucune dette renseignée')
          : `${remplis} / ${total} renseigné${remplis > 1 ? 's' : ''}`;
        el.classList.toggle('complet', total !== null && remplis === total);
      }
      for (const { el, section } of frises) dessinerFrise(el, section);
    },
  };
}
