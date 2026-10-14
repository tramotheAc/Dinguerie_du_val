/* ===========================================================================
   Le calculateur : il assemble le parametrage, le formulaire, le moteur et la
   synthese.

   L'etat de la saisie vit dans la variable « etat » et nulle part ailleurs :
   ni cookie, ni stockage du navigateur, ni envoi reseau. Fermer ou actualiser
   l'onglet efface tout - c'est voulu.
   =========================================================================== */

import { h, icone, vider, confirmer, annoncer } from './dom.js';
import { chargerConfig } from './config.js';
import { calculerTout } from './moteur.js';
import { formater } from './format.js';
import { lirePrerempli } from './url.js';
import { creerSaisie, etatVide } from './saisie.js';
import { rendreSynthese, saisieVide, identite } from './synthese.js';
import { apparaitre, signaler } from './animations.js';

let config;
let etat = etatVide();
let resultat;
let saisieUI;
let vue = 'saisie';
let touchee = false; // l'utilisateur a-t-il saisi quelque chose lui-meme ?

const $ = (id) => document.getElementById(id);

function bandeau(ton, ...contenu) {
  return h('div', { class: `bandeau ${ton}`, role: 'status' }, ...contenu);
}

async function demarrer() {
  let charge;
  try {
    charge = await chargerConfig();
  } catch (e) {
    vider($('bandeaux'), bandeau('rouge', icone('alerte'), h('div', {},
      h('strong', {}, 'Le paramétrage n’a pas pu être chargé. '),
      'Le site doit être servi par un serveur web (GitHub Pages, ou Live Server sur le poste) : ouvert directement comme fichier, le navigateur bloque sa lecture. ',
      h('small', {}, e.message))));
    return;
  }
  config = charge.config;
  document.title = config.meta.titre;
  $('titre-app').textContent = config.meta.titre;
  $('sous-titre-app').textContent = config.meta.sous_titre;
  $('version-referentiel').textContent = `Référentiel ${config.meta.referentiel ?? ''}`;

  const prerempli = lirePrerempli(config);
  Object.assign(etat.valeurs, prerempli.valeurs);

  const messages = [];
  if (charge.source === 'brouillon') {
    messages.push(bandeau('ambre', icone('alerte'), h('div', {},
      h('strong', {}, 'Paramétrage de test actif. '),
      'Ce navigateur utilise le brouillon de l’administration, pas le paramétrage publié. ',
      h('a', { href: 'admin.html' }, 'Ouvrir l’administration'))));
  }
  if (charge.brouillonCasse) {
    messages.push(bandeau('ambre', icone('alerte'), h('div', {},
      h('strong', {}, 'Le brouillon d’administration comporte des erreurs : '),
      `le paramétrage publié est utilisé à la place (${charge.brouillonCasse.length} problème(s)). `,
      h('a', { href: 'admin.html' }, 'Corriger dans l’administration'))));
  }
  if (prerempli.appliques.length) {
    messages.push(bandeau('petrole', icone('lien'), h('div', {},
      h('strong', {}, 'Pré-rempli depuis le lien : '),
      prerempli.appliques.map((c) => `${c.libelle} ${formater(etat.valeurs[c.id], c.type === 'montant' ? 'euro' : 'nombre')}`).join(' · '),
      prerempli.ignores.length ? h('small', {}, ` — ignoré : ${prerempli.ignores.map((i) => `${i.cle} (${i.raison})`).join(', ')}`) : null)));
  } else if (prerempli.ignores.length) {
    messages.push(bandeau('ambre', icone('alerte'), h('div', {},
      h('strong', {}, 'Paramètres du lien ignorés : '), prerempli.ignores.map((i) => `${i.cle} (${i.raison})`).join(', '))));
  }
  vider($('bandeaux'), messages);

  construireSaisie(prerempli);
  brancher();
  recalculer();
}

function construireSaisie(prerempli) {
  saisieUI = creerSaisie({ config, racine: $('formulaire'), etat, prerempli, surChangement: () => { touchee = true; recalculer(); } });
}

const precedent = {};
function majResume() {
  const v = resultat.valeurs;
  const champs = {
    'r-ressources': formater(v.total_ressources, 'euro'),
    'r-charges': formater(v.total_charges_avec_dettes, 'euro'),
    'r-solde': formater(v.solde_apres_dettes, 'euro'),
    'r-score': resultat.score ? `${formater(resultat.score.valeur, 'nombre')} / ${resultat.score.max}` : '—',
  };
  for (const [id, t] of Object.entries(champs)) {
    const el = $(id);
    if (precedent[id] !== undefined && precedent[id] !== t) signaler(el);
    precedent[id] = t;
    el.textContent = t;
  }
  $('r-solde').classList.toggle('negatif', (v.solde_apres_dettes ?? 0) < 0);
  const p = resultat.score?.palier;
  $('r-score').dataset.niveau = p?.niveau ?? '';
}

function recalculer() {
  resultat = calculerTout(config, etat);
  saisieUI.rafraichir(resultat);
  majResume();
}

function dessinerSynthese(animer = true) {
  const id = identite(config, etat);
  $('identite-synthese').textContent = id.length ? id.map((x) => x.valeur).join(' · ') : 'Analyse automatique et aide à la décision.';
  if (saisieVide(etat)) {
    vider($('synthese'), h('div', { class: 'carte vide-synthese' },
      h('p', {}, 'Aucune information n’est encore saisie.'),
      h('button', { type: 'button', class: 'bouton', onclick: () => montrer('saisie') }, 'Commencer la saisie')));
    $('telecharger-pdf').disabled = true;
    return;
  }
  $('telecharger-pdf').disabled = false;
  rendreSynthese($('synthese'), {
    config, resultat, etat, animer,
    surSimulation: (m) => { etat.mensualite_saisie = m; recalculer(); dessinerSynthese(true); },
  });
}

function montrer(nom) {
  if (nom === vue) return;
  vue = nom;
  for (const v of document.querySelectorAll('.vue')) v.classList.toggle('actif', v.id === `vue-${nom}`);
  for (const b of document.querySelectorAll('.nav [data-vue]')) b.setAttribute('aria-current', String(b.dataset.vue === nom));
  $('barre-resume').hidden = nom !== 'saisie';
  if (nom === 'synthese') dessinerSynthese(true);
  apparaitre($(`vue-${nom}`).querySelector('.entete'));
  $('rail').classList.remove('ouvert');
  window.scrollTo({ top: 0, behavior: 'instant' });
  $(`titre-${nom}`).focus({ preventScroll: true });
}

async function nouvelleSituation() {
  const ok = await confirmer({
    titre: 'Commencer une nouvelle situation ?',
    texte: 'Toute la saisie en cours sera effacée, y compris les valeurs reçues par le lien.',
    oui: 'Effacer et recommencer', danger: true,
  });
  if (!ok) return;
  etat = etatVide();
  touchee = false;
  // Le lien a ete consomme : l'oublier evite qu'une actualisation le reapplique.
  history.replaceState(null, '', location.pathname);
  vider($('bandeaux'), [...$('bandeaux').children].filter((b) => !b.classList.contains('petrole')));
  construireSaisie(null);
  recalculer();
  montrer('saisie');
  annoncer('La situation a été réinitialisée.', 'ok');
}

async function telechargerPdf() {
  const bouton = $('telecharger-pdf');
  const libelle = bouton.lastChild.textContent;
  bouton.disabled = true;
  bouton.lastChild.textContent = ' Préparation…';
  const voile = h('div', { class: 'voile-pdf' }, h('div', { class: 'carte' }, h('span', { class: 'roue', 'aria-hidden': 'true' }), 'Fabrication du PDF…'));
  document.body.append(voile);
  try {
    const { exporterPdf } = await import('./pdf.js');
    await exporterPdf({ config, resultat, etat });
    annoncer('PDF téléchargé.', 'ok');
  } catch (e) {
    console.error(e);
    annoncer(`Le PDF n’a pas pu être produit : ${e.message}`, 'alerte');
  } finally {
    voile.remove();
    bouton.disabled = false;
    bouton.lastChild.textContent = libelle;
  }
}

function brancher() {
  for (const b of document.querySelectorAll('[data-vue]')) b.addEventListener('click', () => montrer(b.dataset.vue));
  for (const b of document.querySelectorAll('[data-aller]')) b.addEventListener('click', () => montrer(b.dataset.aller));
  $('nouvelle-situation').addEventListener('click', nouvelleSituation);
  $('telecharger-pdf').addEventListener('click', telechargerPdf);
  $('formulaire').addEventListener('submit', (e) => e.preventDefault());
  const bascule = document.querySelector('.bascule-nav');
  bascule.addEventListener('click', () => {
    const ouvert = $('rail').classList.toggle('ouvert');
    bascule.setAttribute('aria-expanded', String(ouvert));
  });
  for (const t of ['titre-saisie', 'titre-synthese']) $(t).setAttribute('tabindex', '-1');
  // Rien n'est conserve : on previent avant de perdre une saisie par megarde.
  // Un lien ouvert puis referme sans rien taper ne declenche pas l'alerte.
  window.addEventListener('beforeunload', (e) => {
    if (touchee && !saisieVide(etat)) { e.preventDefault(); e.returnValue = ''; }
  });
}

demarrer();
