/* ===========================================================================
   L'administration du parametrage.

   On travaille sur une copie du parametrage publie. Chaque modification est
   gardee aussitot dans ce navigateur (brouillon), recalculee sur un jeu
   d'essai, et le calculateur du meme navigateur l'utilise pour qu'on puisse
   la tester en situation. Publier = telecharger parametres.json et le
   deposer dans le depot, a la place de config/parametres.json.
   =========================================================================== */

import { h, icone, vider, confirmer, annoncer, telechargerTexte, copier } from './dom.js?v=281db63c74';
import { chargerPublie, lireBrouillon, ecrireBrouillon, effacerBrouillon, cloner, rattraper } from './config.js?v=281db63c74';
import { calculerTout, catalogue, verifier, ordonner } from './moteur.js?v=281db63c74';
import { compiler, evaluer, variablesLues, FONCTIONS, chercherBareme } from './formules.js?v=281db63c74';
import { formater, interpoler, FORMATS } from './format.js?v=281db63c74';
import { champsAutorises, construireLien, genererDax } from './url.js?v=281db63c74';
import { jaugeZones, legendeSeuils, pastilleNiveau } from './graphiques.js?v=281db63c74';
import { identifiant, identifiantLibre, usages, renommer, renommerBareme, baremeUtilisePar } from './admin-outils.js?v=281db63c74';
import { apparaitre, cascade } from './animations.js?v=281db63c74';
import { ICONES, dessinIcone, nomIcone } from './icones.js?v=281db63c74';
import { versionPerimee } from './version.js?v=281db63c74';

const PANNEAUX = [
  { id: 'accueil', titre: 'Vue d’ensemble', groupe: 'Paramétrage' },
  { id: 'general', titre: 'Général', groupe: 'Paramétrage' },
  { id: 'parametres', titre: 'Paramètres', groupe: 'Paramétrage' },
  { id: 'formulaire', titre: 'Formulaire de saisie', groupe: 'Paramétrage' },
  { id: 'indicateurs', titre: 'Formules de calcul', groupe: 'Calculs' },
  { id: 'baremes', titre: 'Barèmes', groupe: 'Calculs' },
  { id: 'synthese', titre: 'Synthèse : jauges et score', groupe: 'Calculs' },
  { id: 'alertes', titre: 'Points d’attention', groupe: 'Décision' },
  { id: 'plan', titre: 'Plan d’apurement', groupe: 'Décision' },
  { id: 'leviers', titre: 'Leviers d’action', groupe: 'Décision' },
  { id: 'essai', titre: 'Jeu d’essai', groupe: 'Outils' },
  { id: 'liens', titre: 'Liens et Power BI', groupe: 'Outils' },
];

const NIVEAUX = { vert: 'Vert', ambre: 'Ambre', rouge: 'Rouge', neutre: 'Neutre' };
const TYPES_CHAMP = { montant: 'Montant (€)', nombre: 'Nombre entier', texte: 'Texte', date: 'Date' };

let publie;
let config;
let resultat;
let problemes = [];
let panneau = 'accueil';
let vivants = [];          // rafraichissements a lancer apres chaque recalcul
let dernierChamp = null;   // le dernier champ de formule touche, pour l'aide-memoire

const $ = (id) => document.getElementById(id);

/* ------------------------------------------------------------- cycle de vie */

async function demarrer() {
  try {
    publie = await chargerPublie();
  } catch (e) {
    vider($('panneau'), h('div', { class: 'bandeau rouge' }, icone('alerte'),
      h('div', {}, h('strong', {}, 'Paramétrage introuvable. '), 'La page doit être servie par un serveur web (GitHub Pages ou Live Server). ', h('small', {}, e.message))));
    return;
  }
  completer(publie);
  const brouillon = lireBrouillon();
  config = brouillon ? rattraper(brouillon, publie) : cloner(publie);
  completer(config);
  dessinerNav();
  brancherRail();
  const demande = location.hash.replace('#', '');
  if (PANNEAUX.some((p) => p.id === demande)) panneau = demande;
  recalculer();
  ouvrir(panneau, false);
}

/* Un parametrage importe d'une version anterieure peut manquer de blocs. */
function completer(c) {
  c.meta ??= {};
  c.parametres ??= [];
  c.indicateurs ??= [];
  c.baremes ??= [];
  c.chiffres_cles ??= [];
  c.jauges ??= [];
  c.repartition ??= [];
  c.points_attention ??= [];
  c.plan ??= { qualifications: [] };
  c.leviers ??= { nb_affiches: 5, liste: [] };
  c.jeu_essai ??= { libelle: 'Jeu d’essai', valeurs: {}, dettes: [] };
  c.liens ??= { table: 'Clients', mode: 'colonne', colonnes: {} };
}

let minuterie;
/* Toute modification passe par ici : enregistrement du brouillon, recalcul,
   rafraichissement des apercus. `redessiner` reconstruit le panneau quand la
   structure a change (ligne ajoutee, supprimee, deplacee). */
function modifie(redessiner = false) {
  clearTimeout(minuterie);
  if (redessiner) {
    sauver();
    recalculer();
    ouvrir(panneau, false);
    return;
  }
  minuterie = setTimeout(() => { sauver(); recalculer(); }, 160);
}

function sauver() {
  if (JSON.stringify(config) === JSON.stringify(publie)) effacerBrouillon();
  else if (!ecrireBrouillon(config)) annoncer('Le navigateur refuse l’enregistrement local : téléchargez le fichier pour ne rien perdre.', 'alerte');
}

function recalculer() {
  problemes = verifier(config);
  try { resultat = calculerTout(config, config.jeu_essai); } catch (e) { resultat = null; console.error(e); }
  for (const f of vivants) f();
  dessinerBarre();
}

/* ------------------------------------------------------------- navigation */

function dessinerNav() {
  const groupes = [...new Set(PANNEAUX.map((p) => p.groupe))];
  vider($('nav-admin'), groupes.map((g) => [
    h('li', { class: 'nav-groupe' }, g),
    PANNEAUX.filter((p) => p.groupe === g).map((p) => h('li', {},
      h('button', { type: 'button', 'data-panneau': p.id, 'aria-current': String(p.id === panneau), onclick: () => ouvrir(p.id) }, p.titre))),
  ]));
}

function brancherRail() {
  const bascule = document.querySelector('.bascule-nav');
  bascule.addEventListener('click', () => {
    const o = $('rail').classList.toggle('ouvert');
    bascule.setAttribute('aria-expanded', String(o));
  });
  $('titre-app').textContent = config.meta.titre ?? 'La dinguerie de val';
}

function ouvrir(id, animer = true) {
  panneau = id;
  history.replaceState(null, '', `#${id}`);
  for (const b of document.querySelectorAll('[data-panneau]')) b.setAttribute('aria-current', String(b.dataset.panneau === id));
  $('rail').classList.remove('ouvert');
  vivants = [];
  const def = PANNEAUX.find((p) => p.id === id);
  const defilement = window.scrollY;
  vider($('panneau'), RENDUS[id]());
  document.title = `${def.titre} – Administration`;
  if (animer) {
    window.scrollTo({ top: 0, behavior: 'instant' });
    apparaitre($('panneau').firstElementChild);
    cascade($('panneau').querySelectorAll('.carte'), 30);
  } else window.scrollTo({ top: defilement, behavior: 'instant' });
  for (const f of vivants) f();
}

function dessinerBarre() {
  const brouillon = JSON.stringify(config) !== JSON.stringify(publie);
  const perime = versionPerimee()
    ? h('div', { class: 'bandeau rouge perime', role: 'alert' }, icone('alerte'), h('div', {}, h('strong', {}, 'Une version plus récente du site existe. '), 'Actualisez sans le cache : Ctrl + F5.'))
    : null;
  const fichier = h('input', { type: 'file', accept: '.json,application/json', hidden: true, onchange: importer });
  vider($('barre-admin'),
    perime,
    h('div', { class: 'etat' },
      brouillon
        ? h('span', { class: 'jeton ambre' }, h('span', { class: 'point' }), 'Brouillon non publié')
        : h('span', { class: 'jeton vert' }, h('span', { class: 'point' }), 'Identique au paramétrage publié'),
      problemes.length
        ? h('button', { type: 'button', class: 'jeton rouge cliquable', onclick: () => ouvrir('accueil') }, `${problemes.length} problème(s) à corriger`)
        : h('span', { class: 'jeton petrole' }, icone('ok'), 'Toutes les formules sont valides'),
      brouillon ? h('small', { class: 'note-etat' }, 'Enregistré sur ce navigateur ; le calculateur de ce navigateur l’utilise déjà.') : null),
    h('div', { class: 'actions' },
      h('a', { class: 'bouton second', href: 'index.html', target: '_blank', rel: 'noopener' }, icone('oeil'), 'Essayer dans le calculateur'),
      h('button', { type: 'button', class: 'bouton second', onclick: () => fichier.click() }, icone('importer'), 'Importer'),
      fichier,
      brouillon ? h('button', { type: 'button', class: 'bouton second', onclick: revenirAuPublie }, icone('nouveau'), 'Revenir au publié') : null,
      h('button', { type: 'button', class: 'bouton', onclick: exporter }, icone('telecharger'), 'Télécharger parametres.json')));
}

async function revenirAuPublie() {
  if (!await confirmer({ titre: 'Abandonner le brouillon ?', texte: 'Toutes les modifications non publiées seront perdues et le paramétrage publié sera rechargé.', oui: 'Abandonner les modifications', danger: true })) return;
  config = cloner(publie);
  completer(config);
  effacerBrouillon();
  modifie(true);
  annoncer('Paramétrage publié rechargé.', 'ok');
}

function exporter() {
  if (problemes.length) annoncer(`Attention : ${problemes.length} problème(s) restent à corriger. Le calculateur refusera ce fichier.`, 'alerte');
  telechargerTexte('parametres.json', `${JSON.stringify(config, null, 2)}\n`);
}

async function importer(e) {
  const f = e.target.files?.[0];
  e.target.value = '';
  if (!f) return;
  try {
    const c = JSON.parse(await f.text());
    if (!Array.isArray(c.sections) || !Array.isArray(c.indicateurs)) throw new Error('ce fichier ne ressemble pas à un paramétrage (sections et indicateurs absents)');
    completer(c);
    const p = verifier(c);
    if (!await confirmer({ titre: `Importer « ${f.name} » ?`, texte: `Le brouillon actuel sera remplacé.${p.length ? ` Le fichier comporte ${p.length} problème(s) à corriger.` : ' Le fichier est valide.'}`, oui: 'Importer' })) return;
    config = c;
    modifie(true);
    annoncer('Paramétrage importé dans le brouillon.', 'ok');
  } catch (err) {
    annoncer(`Import impossible : ${err.message}`, 'alerte');
  }
}

/* --------------------------------------------------------- petits composants */

function entete(titre, texte, ...actions) {
  return h('div', { class: 'entete' },
    h('div', {}, h('h2', {}, titre), texte ? h('p', {}, texte) : null),
    actions.length ? h('div', { class: 'actions-entete' }, actions) : null);
}

function carte(titre, sousTitre, corps, ...actions) {
  return h('section', { class: 'carte' },
    h('header', {}, h('div', {}, h('h3', {}, titre), sousTitre ? h('p', {}, sousTitre) : null), actions.length ? h('div', { class: 'actions-carte' }, actions) : null),
    h('div', { class: 'corps' }, corps));
}

let compteur = 0;
const nouvelId = () => `a${++compteur}`;

function etiquette(libelle, champ, aide) {
  const id = champ.id || (champ.id = nouvelId());
  return h('div', { class: 'champ' }, h('label', { for: id }, libelle), champ, aide ? h('small', { class: 'aide' }, aide) : null);
}

function texte(objet, cle, attrs = {}) {
  return h('input', { type: 'text', value: objet[cle] ?? '', ...attrs, oninput: (e) => { objet[cle] = e.target.value; modifie(); } });
}

function zoneTexte(objet, cle, attrs = {}) {
  return h('textarea', { rows: 2, ...attrs, value: objet[cle] ?? '', oninput: (e) => { objet[cle] = e.target.value; modifie(); } });
}

/* Un nombre affiche dans son unite : 0,35 s'edite « 35 % », 600 « 600 € ». */
const facteur = (format) => (format === 'pourcent' ? 100 : 1);
const suffixe = (format) => ({ pourcent: '%', euro: '€', mois: 'mois' }[format] ?? '');

function nombre(objet, cle, format, attrs = {}) {
  const v = objet[cle];
  const affiche = v === null || v === undefined || v === '' ? '' : String(Math.round(v * facteur(format) * 1e6) / 1e6).replace('.', ',');
  const champ = h('input', {
    type: 'text', inputmode: 'decimal', value: affiche, ...attrs,
    oninput: (e) => {
      const t = e.target.value.replace(/\s/g, '').replace(',', '.');
      if (t === '' && attrs.vide) { objet[cle] = null; e.target.removeAttribute('aria-invalid'); modifie(); return; }
      const n = Number(t);
      e.target.toggleAttribute('aria-invalid', t === '' || !Number.isFinite(n));
      if (t !== '' && Number.isFinite(n)) { objet[cle] = n / facteur(format); modifie(); }
    },
  });
  const s = suffixe(format);
  return s ? h('span', { class: 'saisie-unite', 'data-unite': s }, champ) : champ;
}

function choix(objet, cle, options, surChange) {
  return h('select', {
    value: objet[cle] ?? '',
    onchange: (e) => { objet[cle] = e.target.value; modifie(); surChange?.(); },
  }, Object.entries(options).map(([v, l]) => h('option', { value: v }, l)));
}

function caseACocher(objet, cle, libelle, attrs = {}) {
  const id = nouvelId();
  return h('label', { class: 'case', for: id },
    h('input', { id, type: 'checkbox', checked: !!objet[cle], ...attrs, onchange: (e) => { objet[cle] = e.target.checked; modifie(); } }),
    h('span', {}, libelle));
}

function optionsVariables(vide = false) {
  const o = vide ? { '': '— aucune —' } : {};
  for (const v of catalogue(config)) if (!v.seulementLeviers) o[v.id] = `${v.libelle} (${v.id})`;
  return o;
}

/* Boutons de rangement d'une liste : monter, descendre, supprimer. */
function rangement(liste, index, { supprimer = true, avant } = {}) {
  return h('div', { class: 'rangement' },
    h('button', { type: 'button', class: 'bouton-icone', title: 'Monter', 'aria-label': 'Monter', disabled: index === 0, onclick: () => { [liste[index - 1], liste[index]] = [liste[index], liste[index - 1]]; modifie(true); } }, icone('haut')),
    h('button', { type: 'button', class: 'bouton-icone', title: 'Descendre', 'aria-label': 'Descendre', disabled: index === liste.length - 1, onclick: () => { [liste[index + 1], liste[index]] = [liste[index], liste[index + 1]]; modifie(true); } }, icone('bas')),
    supprimer ? h('button', {
      type: 'button', class: 'bouton-icone supprimer', title: 'Supprimer', 'aria-label': 'Supprimer',
      onclick: async () => {
        if (avant && !(await avant())) return;
        liste.splice(index, 1);
        modifie(true);
      },
    }, icone('croix')) : null);
}

/* ------------------------------------------------------- champ de formule */

/* L'editeur de formule : saisie en chasse fixe, controle a chaque frappe,
   resultat sur le jeu d'essai, variables lues en pastilles. */
function champFormule(objet, cle, { mode = 'valeur', format = 'nombre', indicateur = null, leviers = false } = {}) {
  const zone = h('textarea', {
    class: 'formule tech', rows: Math.min(6, Math.max(1, Math.ceil(String(objet[cle] ?? '').length / 80))), spellcheck: 'false',
    value: objet[cle] ?? '', 'aria-label': 'Formule',
    oninput: (e) => { objet[cle] = e.target.value; ajuster(e.target); verifierIci(); modifie(); },
    onfocus: (e) => { dernierChamp = { el: e.target, objet, cle }; },
  });
  const etat = h('div', { class: 'etat-formule', 'aria-live': 'polite' });
  const lues = h('div', { class: 'variables-lues' });
  const verifierIci = () => {
    const ids = new Set(catalogue(config).filter((v) => leviers || !v.seulementLeviers).map((v) => v.id));
    try {
      const a = compiler(objet[cle]);
      const inconnues = [...variablesLues(a)].filter((v) => !ids.has(v));
      if (inconnues.length) throw new Error(`Variable inconnue : ${inconnues.join(', ')}`);
      let valeur;
      if (indicateur) {
        const err = resultat?.erreurs[indicateur];
        if (err) throw new Error(err);
        valeur = resultat?.valeurs[indicateur];
      } else valeur = resultat ? evaluer(a, { valeurs: resultat.valeurs, baremes: Object.fromEntries(config.baremes.map((b) => [b.id, b])) }) : null;
      zone.removeAttribute('aria-invalid');
      if (mode === 'condition') {
        const vrai = !!valeur && valeur !== 0;
        vider(etat, h('span', { class: `jeton ${vrai ? 'vert' : ''}` }, icone(vrai ? 'ok' : 'moins'), vrai ? 'Vrai sur le jeu d’essai' : 'Faux sur le jeu d’essai'));
      } else {
        vider(etat, h('span', { class: 'jeton petrole' }, icone('ok'), 'Valide'), h('span', { class: 'resultat-essai' }, '= ', h('strong', {}, formater(valeur, format)), ' sur le jeu d’essai'));
      }
      vider(lues, [...variablesLues(a)].map((v) => h('button', {
        type: 'button', class: 'pastille-variable', title: `${libelleDe(v)} — valeur d’essai : ${formater(resultat?.valeurs[v], formatDe(v))}`,
        onclick: () => { const i = config.indicateurs.find((x) => x.id === v); if (i) allerA(`ind-${v}`); },
      }, v)));
    } catch (e) {
      zone.setAttribute('aria-invalid', 'true');
      vider(etat, h('span', { class: 'jeton rouge' }, icone('alerte'), e.message));
      vider(lues);
    }
  };
  vivants.push(verifierIci);
  return h('div', { class: 'editeur-formule' }, zone, h('div', { class: 'pied-formule' }, etat, lues));
}

function ajuster(t) {
  t.style.height = 'auto';
  t.style.height = `${t.scrollHeight + 2}px`;
}

const libelleDe = (id) => catalogue(config).find((v) => v.id === id)?.libelle ?? id;
const formatDe = (id) => catalogue(config).find((v) => v.id === id)?.format ?? 'nombre';

function allerA(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  el.classList.add('surligne');
  setTimeout(() => el.classList.remove('surligne'), 1400);
}

function inserer(texteAInserer) {
  const c = dernierChamp;
  if (!c || !document.body.contains(c.el)) { copier(texteAInserer); return; }
  const { el } = c;
  const debut = el.selectionStart ?? el.value.length;
  const fin = el.selectionEnd ?? el.value.length;
  el.focus();
  el.setRangeText(texteAInserer, debut, fin, 'end');
  el.dispatchEvent(new Event('input'));
}

/* L'aide-memoire : fonctions et variables, cliquables pour inserer. */
function aideMemoire({ leviers = false } = {}) {
  const recherche = h('input', { type: 'search', placeholder: 'Chercher une variable…', 'aria-label': 'Chercher une variable' });
  const liste = h('div', { class: 'liste-variables' });
  const dessiner = () => {
    const q = recherche.value.trim().toLowerCase();
    const vars = catalogue(config).filter((v) => (leviers || !v.seulementLeviers) && (!q || `${v.id} ${v.libelle} ${v.origine}`.toLowerCase().includes(q)));
    const groupes = new Map();
    for (const v of vars) {
      const g = v.origine.split(' · ')[0];
      if (!groupes.has(g)) groupes.set(g, []);
      groupes.get(g).push(v);
    }
    vider(liste, [...groupes].map(([g, vs]) => h('div', { class: 'groupe-variables' },
      h('h4', {}, g),
      vs.map((v) => h('button', { type: 'button', class: 'variable', title: `Insérer « ${v.id} »`, onclick: () => inserer(v.id) },
        h('code', { class: 'tech' }, v.id),
        h('span', { class: 'libelle' }, v.libelle),
        h('span', { class: 'valeur' }, formater(resultat?.valeurs[v.id], v.format)))))));
  };
  recherche.addEventListener('input', dessiner);
  vivants.push(dessiner);
  return h('aside', { class: 'aide-memoire carte' },
    h('header', {}, h('div', {}, h('h3', {}, 'Aide-mémoire'), h('p', {}, 'Cliquez pour insérer dans la dernière formule touchée.'))),
    h('div', { class: 'corps' },
      h('details', { class: 'syntaxe' },
        h('summary', {}, 'Syntaxe et fonctions'),
        h('ul', {},
          h('li', {}, 'Opérateurs : ', h('code', {}, '+ - * / ^'), ', comparaisons ', h('code', {}, '= <> < <= > >=')),
          h('li', {}, 'Séparateur d’arguments : ', h('code', {}, ';'), ' — décimales : ', h('code', {}, '0,5'), ' — pourcentages : ', h('code', {}, '35%')),
          h('li', {}, 'Textes entre guillemets : ', h('code', {}, '"mini"'), ' — ', h('code', {}, 'VRAI'), ', ', h('code', {}, 'FAUX')),
          h('li', {}, 'Une division par zéro donne « non calculable » (—), qui rend fausse toute comparaison.')),
        h('div', { class: 'fonctions' }, Object.entries(FONCTIONS).map(([nom, f]) =>
          h('button', { type: 'button', class: 'fonction', title: f.aide, onclick: () => inserer(`${nom}(`) }, h('code', { class: 'tech' }, nom), h('span', {}, f.aide))))),
      recherche, liste));
}

/* ================================================================ panneaux */

const RENDUS = {};

/* -------------------------------------------------------------- accueil */
RENDUS.accueil = () => {
  const brouillon = JSON.stringify(config) !== JSON.stringify(publie);
  return h('div', { class: 'pile' },
    entete('Vue d’ensemble', 'Tout ce que le calculateur affiche se règle ici : barèmes, seuils, formules, formulaire, liens pré-remplis.'),
    problemes.length ? carte(`${problemes.length} problème(s) à corriger`, 'Tant qu’il en reste, le calculateur ignore le brouillon et utilise le paramétrage publié.',
      h('ul', { class: 'problemes' }, problemes.map((p) => h('li', {}, h('strong', {}, p.ou), ' — ', p.message))))
      : null,
    h('div', { class: 'duo' },
      carte('Comment ça marche', null, h('ol', { class: 'etapes' },
        h('li', {}, h('strong', {}, 'Modifier. '), 'Chaque changement est vérifié et recalculé aussitôt sur le jeu d’essai. Il est gardé dans ce navigateur (brouillon) : rien n’est perdu en fermant la page.'),
        h('li', {}, h('strong', {}, 'Essayer. '), 'Le calculateur ouvert dans ce même navigateur utilise le brouillon, signalé par un bandeau. Les autres postes ne voient rien.'),
        h('li', {}, h('strong', {}, 'Publier. '), 'Télécharger ', h('code', {}, 'parametres.json'), ' puis le déposer dans le dépôt GitHub à la place de ', h('code', {}, 'config/parametres.json'), '. GitHub Pages met le site à jour en une à deux minutes.'),
        h('li', {}, h('strong', {}, 'Nettoyer. '), 'Une fois publié, « Revenir au publié » efface le brouillon de ce navigateur.'))),
      carte('État du paramétrage', null, h('dl', { class: 'paire' },
        h('dt', {}, 'Référentiel'), h('dd', {}, config.meta.referentiel ?? '—'),
        h('dt', {}, 'Brouillon'), h('dd', {}, brouillon ? 'Oui, modifications non publiées' : 'Non'),
        h('dt', {}, 'Formules'), h('dd', {}, `${config.indicateurs.length} indicateurs, ${config.leviers.liste.length} leviers, ${config.points_attention.length} points d’attention`),
        h('dt', {}, 'Barèmes'), h('dd', {}, config.baremes.map((b) => b.libelle).join(' · ')),
        h('dt', {}, 'Champs du lien'), h('dd', {}, champsAutorises(config).map((c) => c.id).join(', ') || 'aucun')))),
    carte('Écarts avec le classeur Excel V1.0', 'Corrections apportées lors de la transcription. Toutes restent réglables ici.', h('ul', { class: 'ecarts' },
      h('li', {}, h('strong', {}, 'Position dans la fourchette. '), 'Le « coefficient score » du classeur renvoyait un texte et n’entrait pas dans le calcul. Il est devenu un pourcentage (barème « Score de fragilité ») : 0 % = mini, 100 % = maxi. Pour retrouver le comportement du classeur, mettre tous les coefficients à 100 %.'),
      h('li', {}, h('strong', {}, 'Correction selon le reste à vivre. '), 'Elle ne pouvait que baisser la mensualité (le classeur prenait le minimum avec le maxi). Elle joue désormais dans les deux sens.'),
      h('li', {}, h('strong', {}, 'Commentaire du plan de plus de 36 mois. '), 'Le classeur affichait le commentaire du plan « fragile » par le score. Chaque qualification porte maintenant son propre commentaire.'),
      h('li', {}, h('strong', {}, 'FSL. '), 'La formule (plafond selon le nombre de personnes) et le texte du référentiel (QF ≤ 800 €) divergeaient : la formule est gardée, la variante au QF est indiquée dans la description du levier. Priorité FSL = 4, Renégocier = 5, comme dans le classement affiché par le classeur.'),
      h('li', {}, h('strong', {}, 'Score « remboursement des dettes ». '), 'Il lisait le taux d’endettement des seuls crédits. Il lit maintenant l’endettement global (crédits + dettes en cours), avec les mêmes seuils. Le levier « surendettement » aussi.'),
      h('li', {}, h('strong', {}, 'Répartition des dépenses. '), 'Les libellés « charges logement » et « charges fixes » étaient intervertis ; le remboursement des dettes est ajouté.'),
      h('li', {}, h('strong', {}, 'Seuils affichés. '), 'Ils sont désormais écrits à partir des paliers : la légende ne peut plus contredire le statut.'),
      h('li', {}, h('strong', {}, 'Mois d’impayés. '), 'Calculés sur le loyer résiduel (loyer + charges − APL), ce que le locataire doit réellement payer.'),
      h('li', {}, h('strong', {}, 'Ajouts. '), 'Mensualité plafonnée au montant de la dette ; qualification « Pas de dette locative » ; point d’attention « budget déficitaire » ; simulation d’une autre mensualité sur la synthèse.'))));
};

/* -------------------------------------------------------------- general */
RENDUS.general = () => h('div', { class: 'pile' },
  entete('Général', 'Ce qui s’affiche dans le rail, le titre des pages et le pied du PDF.'),
  carte('Identité', null, h('div', { class: 'grille-champs' },
    etiquette('Titre', texte(config.meta, 'titre')),
    etiquette('Sous-titre', texte(config.meta, 'sous_titre')),
    etiquette('Version du référentiel', texte(config.meta, 'referentiel'), 'Imprimée en pied de chaque page du PDF.'),
    etiquette('Adresse publique du calculateur', texte(config.meta, 'url_publique', { class: 'tech' }), 'Sert à fabriquer les liens pré-remplis et la formule Power BI.'))),
  carte('Leviers', null, h('div', { class: 'grille-champs' },
    etiquette('Nombre de leviers affichés', nombre(config.leviers, 'nb_affiches', 'nombre')))));

/* -------------------------------------------------------------- parametres */
RENDUS.parametres = () => {
  const lignes = config.parametres.map((p, n) => h('tr', { id: `par-${p.id}` },
    h('td', {}, texte(p, 'libelle', { 'aria-label': 'Libellé' })),
    h('td', {}, champIdentifiant(p, 'variable')),
    h('td', {}, choix(p, 'format', FORMATS, () => modifie(true))),
    h('td', { class: 'num' }, nombre(p, 'valeur', p.format, { 'aria-label': 'Valeur' })),
    h('td', {}, rangement(config.parametres, n, { avant: () => avantSuppression(p.id, p.libelle) }))));
  return h('div', { class: 'pile' },
    entete('Paramètres', 'Des valeurs nommées, lisibles dans toutes les formules : un seuil se change ici une fois, partout où il sert.',
      h('button', { type: 'button', class: 'bouton', onclick: () => ajouterParametre() }, icone('plus'), 'Ajouter un paramètre')),
    carte('Valeurs', null, h('div', { class: 'cadre-table' }, h('table', { class: 'table-edition' },
      h('thead', {}, h('tr', {}, h('th', {}, 'Libellé'), h('th', {}, 'Identifiant'), h('th', {}, 'Unité'), h('th', { class: 'num' }, 'Valeur'), h('th', {}, ''))),
      h('tbody', {}, lignes)))));
};

function ajouterParametre() {
  const pris = new Set(catalogue(config).map((v) => v.id));
  config.parametres.push({ id: identifiantLibre('nouveau_parametre', pris), libelle: 'Nouveau paramètre', valeur: 0, format: 'nombre' });
  modifie(true);
}

async function avantSuppression(id, libelle) {
  const u = usages(config, id);
  return confirmer({
    titre: `Supprimer « ${libelle} » ?`,
    texte: u.length ? `Attention, elle est utilisée par : ${u.join(' ; ')}. Ces formules deviendront invalides.` : 'Elle n’est utilisée nulle part.',
    oui: 'Supprimer', danger: true,
  });
}

/* Un identifiant se renomme partout ou il est lu. */
function champIdentifiant(objet, nature, { cle = 'id', prefixe = '' } = {}) {
  return h('input', {
    type: 'text', class: 'tech identifiant', value: objet[cle], 'aria-label': 'Identifiant', spellcheck: 'false',
    onchange: async (e) => {
      const ancien = objet[cle];
      const nouveau = identifiant(e.target.value);
      e.target.value = nouveau;
      if (nouveau === ancien) return;
      const pris = new Set(catalogue(config).map((v) => v.id));
      if (nature === 'section') { for (const s of config.sections) pris.add(s.id); }
      if (pris.has(prefixe + nouveau) && prefixe + nouveau !== prefixe + ancien) {
        annoncer(`L’identifiant « ${nouveau} » est déjà pris.`, 'alerte');
        e.target.value = ancien;
        return;
      }
      objet[cle] = nouveau;
      renommer(config, prefixe + ancien, prefixe + nouveau);
      annoncer(`« ${prefixe + ancien} » renommé en « ${prefixe + nouveau} » dans toutes les formules.`, 'ok');
      modifie(true);
    },
  });
}

/* -------------------------------------------------------------- formulaire */
RENDUS.formulaire = () => h('div', { class: 'pile' },
  entete('Formulaire de saisie', 'Les sections et les lignes de la page de saisie. Chaque ligne numérique devient une variable utilisable dans les formules ; une section budgétaire fournit en plus la somme de ses lignes.',
    h('button', { type: 'button', class: 'bouton', onclick: ajouterSectionBudget }, icone('plus'), 'Ajouter une section budgétaire')),
  config.sections.map((s, n) => carteSection(s, n)));

function carteSection(s, n) {
  const nominatif = !!s.nominatif;
  const budget = s.type === 'budget';
  const entetes = h('tr', {}, h('th', {}, 'Icône'), h('th', {}, 'Libellé'), h('th', {}, 'Identifiant'), h('th', {}, 'Type'), h('th', {}, 'Lien'),
    budget ? h('th', { title: 'Affichée d’office ; sinon la ligne s’ajoute d’un clic' }, 'D’office') : null, h('th', {}, 'Aide'), h('th', {}, ''));
  const lignes = (s.champs ?? []).map((c, i) => {
    const numerique = c.type === 'montant' || c.type === 'nombre';
    return h('tr', { id: `champ-admin-${c.id}` },
      h('td', {}, choixIcone(c)),
      h('td', {}, texte(c, 'libelle', { 'aria-label': 'Libellé' })),
      h('td', {}, numerique ? champIdentifiant(c, 'champ') : h('input', { type: 'text', class: 'tech identifiant', value: c.id, disabled: true, 'aria-label': 'Identifiant' })),
      h('td', {}, choix(c, 'type', nominatif ? { texte: 'Texte', date: 'Date' } : TYPES_CHAMP, () => { if (!['montant', 'nombre'].includes(c.type)) c.url = false; modifie(true); })),
      h('td', { class: 'centre' }, nominatif || !numerique
        ? h('span', { class: 'jeton', title: nominatif ? 'Section nominative : jamais dans un lien' : 'Seuls les nombres passent dans un lien' }, 'non')
        : caseACocher(c, 'url', h('span', { class: 'visuellement-cache' }, `Accepter ${c.libelle} dans le lien`))),
      budget ? h('td', { class: 'centre' }, caseACocher(c, 'essentiel', h('span', { class: 'visuellement-cache' }, `Afficher ${c.libelle} d’office`))) : null,
      h('td', {}, texte(c, 'aide', { 'aria-label': 'Aide', placeholder: '—' })),
      h('td', {}, rangement(s.champs, i, { avant: () => avantSuppression(c.id, c.libelle) })));
  });
  const corps = [];
  if (s.type === 'dettes') {
    corps.push(h('p', { class: 'note' }, 'Tableau libre (type, montant, mensualité, échéance). Variables fournies : ',
      h('code', {}, 'dettes_montant'), ', ', h('code', {}, 'dettes_mensualites'), ', ', h('code', {}, 'nb_dettes'), '.'));
  } else {
    corps.push(h('div', { class: 'cadre-table' }, h('table', { class: 'table-edition' }, h('thead', {}, entetes), h('tbody', {}, lignes))));
    corps.push(h('button', { type: 'button', class: 'bouton-discret ajout', onclick: () => ajouterChamp(s) }, icone('plus'), 'Ajouter une ligne'));
  }
  if (s.type !== 'dettes') {
    const calculees = s.lignes_calculees ?? [];
    corps.push(h('div', { class: 'sous-partie' },
      h('h4', {}, 'Lignes calculées affichées dans la section'),
      calculees.map((l, i) => h('div', { class: 'ligne-edition' },
        etiquette('Libellé', texte(l, 'libelle')),
        etiquette('Variable affichée', choix(l, 'variable', optionsVariables())),
        rangement(calculees, i))),
      h('button', { type: 'button', class: 'bouton-discret', onclick: () => { (s.lignes_calculees ??= []).push({ libelle: 'Nouvelle ligne', variable: config.indicateurs[0]?.id ?? '' }); modifie(true); } }, icone('plus'), 'Ajouter une ligne calculée')));
  }
  return carte(s.titre,
    s.type === 'budget' ? `Section budgétaire · somme : ${'somme_' + s.id} = ${formater(resultat?.valeurs[`somme_${s.id}`], 'euro')} sur le jeu d’essai` : (nominatif ? 'Section nominative : imprimée sur le PDF, jamais acceptée dans un lien, jamais utilisée dans un calcul' : null),
    h('div', { class: 'pile serree' },
      h('div', { class: 'grille-champs' },
        etiquette('Titre de la section', texte(s, 'titre')),
        etiquette('Nom court (barre des étapes)', texte(s, 'court', { placeholder: s.titre })),
        etiquette('Icône de la section', choixIcone(s, 'dossier')),
        etiquette('Description', texte(s, 'description', { placeholder: '—' })),
        s.type === 'budget' ? etiquette('Total affiché en tête', choix(s, 'total', optionsVariables(true))) : null,
        n > 0 ? caseACocher(s, 'avec_precedente', `Sur la même ligne que « ${config.sections[n - 1].court || config.sections[n - 1].titre} »`) : null),
      corps),
    rangement(config.sections, n, {
      supprimer: s.type === 'budget',
      avant: () => confirmer({ titre: `Supprimer la section « ${s.titre} » ?`, texte: `Ses lignes et la variable somme_${s.id} disparaîtront. ${usages(config, `somme_${s.id}`).join(' ; ')}`, oui: 'Supprimer', danger: true }),
    }));
}

/* Le choix d'une icone d'illustration, avec son apercu. « Automatique »
   reprend l'icone prevue pour cet identifiant. */
function choixIcone(objet, repli = 'piece') {
  const apercu = h('span', { class: 'apercu-icone' }, dessinIcone(nomIcone(objet, repli)));
  return h('span', { class: 'choix-icone' }, apercu,
    h('select', {
      value: objet.icone ?? '', 'aria-label': 'Icône',
      onchange: (e) => {
        objet.icone = e.target.value; // vide = icone par defaut
        vider(apercu, dessinIcone(nomIcone(objet, repli)));
        modifie();
      },
    }, h('option', { value: '' }, 'Automatique'), Object.keys(ICONES).map((n) => h('option', { value: n }, n.replace(/_/g, ' ')))));
}

function ajouterChamp(s) {
  const pris = new Set(catalogue(config).map((v) => v.id));
  for (const sec of config.sections) for (const c of sec.champs ?? []) pris.add(c.id);
  s.champs ??= [];
  const nominatif = !!s.nominatif;
  s.champs.push({ id: identifiantLibre(nominatif ? 'info' : 'nouvelle_ligne', pris), libelle: 'Nouvelle ligne', type: nominatif ? 'texte' : 'montant' });
  modifie(true);
}

function ajouterSectionBudget() {
  const pris = new Set(config.sections.map((s) => s.id));
  config.sections.push({ id: identifiantLibre('nouvelle_section', pris), titre: 'Nouvelle section', type: 'budget', colonne: 'budget', champs: [] });
  modifie(true);
}

/* -------------------------------------------------------------- indicateurs */
let filtreIndicateurs = '';
RENDUS.indicateurs = () => {
  const { deps } = ordonner(config);
  const utilisePar = new Map();
  for (const [id, ds] of deps) for (const d of ds) { if (!utilisePar.has(d)) utilisePar.set(d, []); utilisePar.get(d).push(id); }
  const groupes = new Map();
  for (const i of config.indicateurs) {
    const g = i.groupe || 'Autres';
    if (!groupes.has(g)) groupes.set(g, []);
    groupes.get(g).push(i);
  }
  const listeGroupes = [...new Set(config.indicateurs.map((i) => i.groupe).filter(Boolean))];
  const recherche = h('input', {
    type: 'search', placeholder: 'Filtrer les formules (nom, variable, texte)…', value: filtreIndicateurs, 'aria-label': 'Filtrer les formules',
    oninput: (e) => {
      filtreIndicateurs = e.target.value.toLowerCase();
      for (const el of document.querySelectorAll('.carte-indicateur')) el.hidden = !!filtreIndicateurs && !el.dataset.cherche.includes(filtreIndicateurs);
    },
  });
  const cartes = [...groupes].map(([g, liste]) => h('div', { class: 'groupe-indicateurs' },
    h('h3', { class: 'titre-groupe' }, g),
    liste.map((i) => {
      const index = config.indicateurs.indexOf(i);
      const lit = (utilisePar.get(i.id) ?? []).map((id) => config.indicateurs.find((x) => x.id === id)?.libelle ?? id);
      const autres = usages(config, i.id).filter((u) => !u.startsWith('Indicateur'));
      const cherche = `${i.id} ${i.libelle} ${i.formule} ${i.groupe}`.toLowerCase();
      return h('article', { class: 'carte carte-indicateur', id: `ind-${i.id}`, 'data-cherche': cherche, hidden: !!filtreIndicateurs && !cherche.includes(filtreIndicateurs) },
        h('div', { class: 'tete-indicateur' },
          h('input', { type: 'text', class: 'libelle-indicateur', value: i.libelle, 'aria-label': 'Libellé', oninput: (e) => { i.libelle = e.target.value; modifie(); } }),
          champIdentifiant(i, 'indicateur'),
          choix(i, 'format', FORMATS, () => modifie(true)),
          h('input', { type: 'text', class: 'groupe', value: i.groupe ?? '', list: 'liste-groupes', 'aria-label': 'Groupe', title: 'Groupe', onchange: (e) => { i.groupe = e.target.value; modifie(true); } }),
          h('button', {
            type: 'button', class: 'bouton-icone supprimer', title: 'Supprimer la formule', 'aria-label': 'Supprimer la formule',
            onclick: async () => { if (await avantSuppression(i.id, i.libelle)) { config.indicateurs.splice(index, 1); modifie(true); } },
          }, icone('croix'))),
        champFormule(i, 'formule', { format: i.format, indicateur: i.id }),
        h('div', { class: 'liens-indicateur' },
          lit.length || autres.length ? h('span', {}, 'Utilisé par : ', [...lit, ...autres].join(' · ')) : h('span', { class: 'discret' }, 'Utilisé nulle part pour l’instant'),
          h('details', { class: 'note-indicateur' }, h('summary', {}, i.aide ? 'Note explicative' : 'Ajouter une note'), zoneTexte(i, 'aide', { placeholder: 'Ce que mesure cet indicateur, comment le lire…', 'aria-label': 'Note explicative' }))));
    })));
  return h('div', { class: 'pile' },
    entete('Formules de calcul', 'Chaque indicateur est une formule lisible, écrite comme dans Excel mais avec des noms. L’ordre n’a pas d’importance : chaque formule est calculée après celles qu’elle lit.',
      h('button', { type: 'button', class: 'bouton', onclick: ajouterIndicateur }, icone('plus'), 'Ajouter une formule')),
    h('datalist', { id: 'liste-groupes' }, listeGroupes.map((g) => h('option', { value: g }))),
    h('div', { class: 'disposition-aide' },
      h('div', { class: 'pile' }, h('div', { class: 'filtres-page' }, recherche), cartes),
      aideMemoire()));
};

function ajouterIndicateur() {
  const pris = new Set(catalogue(config).map((v) => v.id));
  const id = identifiantLibre('nouvel_indicateur', pris);
  config.indicateurs.push({ id, groupe: 'Autres', libelle: 'Nouvel indicateur', format: 'euro', formule: 'total_ressources - total_charges' });
  filtreIndicateurs = '';
  modifie(true);
  setTimeout(() => { allerA(`ind-${id}`); document.querySelector(`#ind-${id} .libelle-indicateur`)?.select(); }, 50);
}

/* -------------------------------------------------------------- baremes */
RENDUS.baremes = () => h('div', { class: 'pile' },
  entete('Barèmes', 'Des tables de correspondance, lues par la fonction BAREME("identifiant"; valeur; "colonne") : la ligne retenue est la dernière dont la première colonne est inférieure ou égale à la valeur.',
    h('button', { type: 'button', class: 'bouton', onclick: ajouterBareme }, icone('plus'), 'Ajouter un barème')),
  config.baremes.map((b, n) => carteBareme(b, n)));

function carteBareme(b, n) {
  const cle = b.colonnes[0]?.id;
  const essai = { valeur: b.lignes[1]?.[cle] ?? 0 };
  const sortie = h('span', { class: 'resultat-test' });
  const tester = () => {
    try {
      const ligne = b.colonnes.slice(1).map((c) => `${c.libelle} : ${formater(chercherBareme(b, essai.valeur, c.id), c.format)}`).join(' · ');
      vider(sortie, `→ ${ligne}`);
    } catch (e) { vider(sortie, h('span', { class: 'jeton rouge' }, e.message)); }
  };
  vivants.push(tester);
  const utilise = baremeUtilisePar(config, b.id);
  const table = h('table', { class: 'table-edition table-bareme' },
    h('thead', {}, h('tr', {},
      b.colonnes.map((c, i) => h('th', {},
        h('input', { type: 'text', value: c.libelle, 'aria-label': 'Titre de colonne', oninput: (e) => { c.libelle = e.target.value; modifie(); } }),
        h('div', { class: 'meta-colonne' },
          h('code', { class: 'tech', title: 'Identifiant de colonne, à citer dans BAREME' }, c.id),
          choix(c, 'format', FORMATS, () => modifie(true)),
          i > 0 ? h('button', {
            type: 'button', class: 'bouton-icone', title: 'Supprimer la colonne', 'aria-label': `Supprimer la colonne ${c.libelle}`,
            onclick: async () => {
              if (!await confirmer({ titre: `Supprimer la colonne « ${c.libelle} » ?`, oui: 'Supprimer', danger: true })) return;
              b.colonnes.splice(i, 1);
              for (const l of b.lignes) delete l[c.id];
              modifie(true);
            },
          }, icone('croix')) : null))),
      h('th', {}, ''))),
    h('tbody', {}, b.lignes.map((l, i) => h('tr', {},
      b.colonnes.map((c) => h('td', { class: c.format === 'texte' ? '' : 'num' },
        c.format === 'texte' ? zoneTexte(l, c.id, { rows: 1, 'aria-label': c.libelle }) : nombre(l, c.id, c.format, { 'aria-label': c.libelle }))),
      h('td', {}, rangement(b.lignes, i))))));
  return carte(b.libelle, b.description,
    h('div', { class: 'pile serree' },
      h('div', { class: 'grille-champs' },
        etiquette('Nom du barème', texte(b, 'libelle')),
        etiquette('Identifiant (à citer dans BAREME)', h('input', {
          type: 'text', class: 'tech', value: b.id, spellcheck: 'false',
          onchange: (e) => {
            const nouveau = identifiant(e.target.value);
            if (config.baremes.some((x) => x !== b && x.id === nouveau)) { annoncer('Identifiant déjà pris.', 'alerte'); e.target.value = b.id; return; }
            renommerBareme(config, b.id, nouveau);
            b.id = nouveau;
            modifie(true);
          },
        })),
        etiquette('Description', texte(b, 'description', { placeholder: '—' }))),
      h('div', { class: 'cadre-table' }, table),
      h('div', { class: 'actions-ligne' },
        h('button', { type: 'button', class: 'bouton-discret', onclick: () => { b.lignes.push(Object.fromEntries(b.colonnes.map((c) => [c.id, c.format === 'texte' ? '' : 0]))); modifie(true); } }, icone('plus'), 'Ajouter une ligne'),
        h('button', {
          type: 'button', class: 'bouton-discret',
          onclick: () => {
            const pris = new Set(b.colonnes.map((c) => c.id));
            const id = identifiantLibre('colonne', pris);
            b.colonnes.push({ id, libelle: 'Nouvelle colonne', format: 'nombre' });
            for (const l of b.lignes) l[id] = 0;
            modifie(true);
          },
        }, icone('plus'), 'Ajouter une colonne'),
        h('button', { type: 'button', class: 'bouton-discret', onclick: () => { b.lignes.sort((x, y) => (x[cle] ?? 0) - (y[cle] ?? 0)); modifie(true); } }, 'Trier par la première colonne')),
      h('div', { class: 'testeur' },
        h('label', {}, `Tester avec ${b.colonnes[0]?.libelle ?? 'une valeur'} = `),
        nombre(essai, 'valeur', b.colonnes[0]?.format, { 'aria-label': 'Valeur de test', oninput: undefined }),
        sortie),
      h('p', { class: 'note' }, utilise.length ? `Utilisé par : ${utilise.join(' · ')}` : 'Utilisé par aucune formule.', ' Exemple : ',
        h('code', { class: 'tech' }, `BAREME("${b.id}"; valeur; "${b.colonnes[1]?.id ?? 'colonne'}")`))),
    rangement(config.baremes, n, { avant: () => confirmer({ titre: `Supprimer le barème « ${b.libelle} » ?`, texte: utilise.length ? `Il est utilisé par : ${utilise.join(' ; ')}.` : '', oui: 'Supprimer', danger: true }) }));
}

function ajouterBareme() {
  const pris = new Set(config.baremes.map((b) => b.id));
  config.baremes.push({
    id: identifiantLibre('nouveau_bareme', pris), libelle: 'Nouveau barème', description: '',
    colonnes: [{ id: 'seuil', libelle: 'Seuil', format: 'euro' }, { id: 'valeur', libelle: 'Valeur', format: 'euro' }],
    lignes: [{ seuil: 0, valeur: 0 }],
  });
  modifie(true);
}

/* -------------------------------------------------------------- synthese */
function editeurPaliers(objet, format) {
  return h('div', { class: 'paliers' },
    h('table', { class: 'table-edition' },
      h('thead', {}, h('tr', {}, h('th', {}, objet.sens === 'haut' ? 'À partir de' : 'En dessous de'), h('th', {}, 'Libellé'), h('th', {}, 'Couleur'), h('th', {}, ''))),
      h('tbody', {}, objet.paliers.map((p, i) => h('tr', {},
        h('td', { class: 'num' }, i === objet.paliers.length - 1
          ? h('span', { class: 'discret' }, 'tout le reste')
          : nombre(p, 'seuil', format, { 'aria-label': 'Seuil' })),
        h('td', {}, texte(p, 'libelle', { 'aria-label': 'Libellé' })),
        h('td', {}, choix(p, 'niveau', NIVEAUX)),
        h('td', {}, rangement(objet.paliers, i, { supprimer: objet.paliers.length > 1 })))))),
    h('button', {
      type: 'button', class: 'bouton-discret',
      onclick: () => {
        const dernier = objet.paliers[objet.paliers.length - 1];
        objet.paliers.splice(objet.paliers.length - 1, 0, { seuil: dernier?.seuil ?? 0, libelle: 'Nouveau palier', niveau: 'ambre' });
        modifie(true);
      },
    }, icone('plus'), 'Ajouter un palier'),
    h('p', { class: 'note' }, objet.sens === 'haut'
      ? 'Les paliers se lisent de haut en bas : le premier dont la valeur atteint le seuil l’emporte. Rangez-les du seuil le plus haut au plus bas.'
      : 'Les paliers se lisent de haut en bas : le premier dont la valeur est strictement sous le seuil l’emporte. Rangez-les du seuil le plus bas au plus haut.'));
}

function normaliserPaliers(objet) {
  const dernier = objet.paliers[objet.paliers.length - 1];
  for (const p of objet.paliers) if (p !== dernier && (p.seuil === null || p.seuil === undefined)) p.seuil = 0;
  if (dernier) dernier.seuil = null;
}

RENDUS.synthese = () => {
  for (const j of config.jauges) normaliserPaliers(j);
  normaliserPaliers(config.score);
  const fmt = (id) => formatDe(id);
  const cartesJauges = config.jauges.map((j, n) => {
    const apercu = h('div', { class: 'apercu-jauge' });
    vivants.push(() => {
      const r = resultat?.jauges[n];
      const format = fmt(j.indicateur);
      vider(apercu,
        h('div', { class: 'jauge-tete' }, h('span', { class: 'etiquette' }, `Aperçu sur le jeu d’essai : ${formater(r?.valeur, format)}`), pastilleNiveau(r?.palier)),
        jaugeZones({ ...j, valeur: r?.valeur, format }, { animer: false }),
        h('p', { class: 'seuils' }, legendeSeuils(j, format)));
    });
    return carte(j.libelle, null, h('div', { class: 'pile serree' },
      h('div', { class: 'grille-champs' },
        etiquette('Libellé', texte(j, 'libelle')),
        etiquette('Indicateur', choix(j, 'indicateur', optionsVariables(), () => modifie(true))),
        etiquette('Sens de lecture', choix(j, 'sens', { bas: 'Plus c’est bas, mieux c’est', haut: 'Plus c’est haut, mieux c’est' }, () => modifie(true))),
        etiquette('Bout de l’échelle dessinée', nombre(j, 'echelle_max', fmt(j.indicateur))),
        etiquette('Critère du score qu’elle explique', choix(j, 'critere', { '': '— aucun (indicateur secondaire) —', ...Object.fromEntries((config.score?.criteres ?? []).map((c) => [c.indicateur, c.libelle])) }, () => modifie(true)))),
      etiquette('En clair (phrase sous la jauge, {variables} permises)', texte(j, 'en_clair', { placeholder: 'Ex. Le logement absorbe {taux_effort_logement} des ressources.' })),
      editeurPaliers(j, fmt(j.indicateur)), apercu),
    rangement(config.jauges, n));
  });
  const sc = config.score;
  return h('div', { class: 'pile' },
    entete('Synthèse : jauges et score', 'Ce que la page de synthèse affiche, et les paliers qui donnent les couleurs et les statuts.'),
    carte('Chiffres du bilan', 'Les chiffres du bandeau de bilan, en tête de synthèse', h('div', { class: 'pile serree' },
      config.chiffres_cles.map((c, i) => h('div', { class: 'ligne-edition' },
        etiquette('Libellé', texte(c, 'libelle')),
        etiquette('Indicateur', choix(c, 'indicateur', optionsVariables(true))),
        etiquette('Ou texte composé', texte(c, 'texte', { placeholder: 'Ex. {mensualite_retenue} × {duree_plan}' })),
        etiquette('Note', texte(c, 'note', { placeholder: '—' })),
        etiquette('Affiché si', texte(c, 'si', { class: 'tech', placeholder: 'toujours' })),
        caseACocher(c, 'signe', 'Rouge si négatif'),
        rangement(config.chiffres_cles, i))),
      h('button', { type: 'button', class: 'bouton-discret', onclick: () => { config.chiffres_cles.push({ indicateur: 'total_ressources', libelle: 'Nouveau chiffre' }); modifie(true); } }, icone('plus'), 'Ajouter un chiffre clé'))),
    h('h3', { class: 'titre-groupe' }, 'Jauges des indicateurs clés'),
    h('div', { class: 'duo' }, cartesJauges),
    h('button', { type: 'button', class: 'bouton-discret', onclick: () => { config.jauges.push({ indicateur: 'taux_effort_logement', libelle: 'Nouvelle jauge', sens: 'bas', echelle_max: 1, paliers: [{ seuil: 0.3, libelle: 'Favorable', niveau: 'vert' }, { seuil: null, libelle: 'Critique', niveau: 'rouge' }] }); modifie(true); } }, icone('plus'), 'Ajouter une jauge'),
    carte('Score de fragilité', 'Le total et ses critères. La formule de chaque critère se règle dans « Formules de calcul » (groupe Score).', h('div', { class: 'pile serree' },
      h('div', { class: 'grille-champs' },
        etiquette('Indicateur du score total', choix(sc, 'indicateur', optionsVariables())),
        etiquette('Maximum', nombre(sc, 'max', 'nombre'))),
      h('h4', {}, 'Critères affichés'),
      sc.criteres.map((c, i) => h('div', { class: 'ligne-edition' },
        etiquette('Libellé', texte(c, 'libelle')),
        etiquette('Indicateur', choix(c, 'indicateur', optionsVariables())),
        etiquette('Points maximum', nombre(c, 'max', 'nombre')),
        rangement(sc.criteres, i))),
      h('button', { type: 'button', class: 'bouton-discret', onclick: () => { sc.criteres.push({ indicateur: config.indicateurs[0]?.id, libelle: 'Nouveau critère', max: 10 }); modifie(true); } }, icone('plus'), 'Ajouter un critère'),
      h('h4', {}, 'Paliers du score'),
      editeurPaliers(sc, 'nombre'))),
    carte('Répartition des dépenses', 'Les barres du graphique de répartition', h('div', { class: 'pile serree' },
      config.repartition.map((r, i) => h('div', { class: 'ligne-edition' },
        etiquette('Libellé', texte(r, 'libelle')),
        etiquette('Indicateur', choix(r, 'indicateur', optionsVariables())),
        rangement(config.repartition, i))),
      h('button', { type: 'button', class: 'bouton-discret', onclick: () => { config.repartition.push({ indicateur: 'total_facultatives', libelle: 'Nouvelle catégorie' }); modifie(true); } }, icone('plus'), 'Ajouter une catégorie'))));
};

/* -------------------------------------------------------------- alertes */
function apercuTexte(objet, cle) {
  const el = h('p', { class: 'apercu-texte' });
  vivants.push(() => { el.textContent = resultat ? `Aperçu : ${interpoler(objet[cle], resultat.valeurs, resultat.formats)}` : ''; });
  return el;
}

RENDUS.alertes = () => h('div', { class: 'pile' },
  entete('Points d’attention', 'Une condition, un message. Le message peut citer une valeur entre accolades : {taux_effort_logement} s’affiche « 38,9 % ».',
    h('button', { type: 'button', class: 'bouton', onclick: () => { config.points_attention.push({ condition: 'solde_budgetaire < 0', libelle: 'Nouveau point d’attention' }); modifie(true); } }, icone('plus'), 'Ajouter un point')),
  h('div', { class: 'disposition-aide' },
    h('div', { class: 'pile' }, config.points_attention.map((p, n) => carte(`Point n° ${n + 1}`, null, h('div', { class: 'pile serree' },
      etiquette('Message', texte(p, 'libelle')), apercuTexte(p, 'libelle'),
      h('div', { class: 'champ' }, h('span', { class: 'etiquette-champ' }, 'Se déclenche si'), champFormule(p, 'condition', { mode: 'condition' }))),
    rangement(config.points_attention, n)))),
    aideMemoire()));

/* -------------------------------------------------------------- plan */
RENDUS.plan = () => {
  const qs = config.plan.qualifications;
  return h('div', { class: 'pile' },
    entete('Plan d’apurement', 'Le calcul de la mensualité et de la durée se règle dans « Formules de calcul » (groupe Plan d’apurement) et dans les barèmes. Ici : la qualification du plan, lue de haut en bas — la première condition vraie l’emporte.',
      h('button', { type: 'button', class: 'bouton', onclick: () => { qs.splice(Math.max(0, qs.length - 1), 0, { condition: 'score_budgetaire >= 50', libelle: 'Nouvelle qualification', niveau: 'ambre', commentaire: '' }); modifie(true); } }, icone('plus'), 'Ajouter une qualification')),
    h('div', { class: 'disposition-aide' },
      h('div', { class: 'pile' }, qs.map((q, n) => {
        const retenue = h('span', {});
        vivants.push(() => { vider(retenue, resultat?.qualification?.condition === q.condition && resultat?.qualification?.libelle === q.libelle ? h('span', { class: 'jeton petrole' }, icone('ok'), 'Retenue sur le jeu d’essai') : null); });
        return carte(`${n + 1}. ${q.libelle}`, null, h('div', { class: 'pile serree' },
          h('div', { class: 'grille-champs' },
            etiquette('Libellé', texte(q, 'libelle')),
            etiquette('Couleur', choix(q, 'niveau', NIVEAUX))),
          h('div', { class: 'champ' }, h('span', { class: 'etiquette-champ' }, 'Si'), champFormule(q, 'condition', { mode: 'condition' })),
          etiquette('Commentaire', zoneTexte(q, 'commentaire', { rows: 3 })), apercuTexte(q, 'commentaire'), retenue),
        rangement(qs, n));
      })),
      aideMemoire()));
};

/* -------------------------------------------------------------- leviers */
RENDUS.leviers = () => {
  const liste = config.leviers.liste;
  return h('div', { class: 'pile' },
    entete('Leviers d’action', `Chaque levier déclenché s’affiche, par priorité croissante ; seuls les ${config.leviers.nb_affiches} premiers sont montrés. La variable nb_leviers_actifs compte les leviers plus prioritaires déjà déclenchés.`,
      h('button', { type: 'button', class: 'bouton', onclick: () => { const pris = new Set(liste.map((l) => l.id)); liste.push({ id: identifiantLibre('levier', pris), libelle: 'Nouveau levier', famille: 'Budget', priorite: liste.length + 1, condition: 'FAUX', description: '' }); modifie(true); } }, icone('plus'), 'Ajouter un levier')),
    h('div', { class: 'disposition-aide' },
      h('div', { class: 'pile' }, liste.map((l, n) => {
        const etat = h('span', {});
        vivants.push(() => {
          const r = resultat?.leviers.find((x) => x.id === l.id);
          const rang = resultat?.leviersRetenus.findIndex((x) => x.id === l.id);
          vider(etat, r?.actif ? h('span', { class: 'jeton vert' }, icone('ok'), rang >= 0 ? `Affiché en position ${rang + 1} sur le jeu d’essai` : 'Déclenché mais hors des leviers affichés') : h('span', { class: 'jeton' }, 'Non déclenché sur le jeu d’essai'));
        });
        return carte(l.libelle, null, h('div', { class: 'pile serree' },
          h('div', { class: 'grille-champs' },
            etiquette('Libellé', texte(l, 'libelle')),
            etiquette('Famille', texte(l, 'famille')),
            etiquette('Priorité (1 = la plus haute)', nombre(l, 'priorite', 'nombre'))),
          h('div', { class: 'champ' }, h('span', { class: 'etiquette-champ' }, 'Se déclenche si'), champFormule(l, 'condition', { mode: 'condition', leviers: true })),
          etiquette('Description affichée', zoneTexte(l, 'description')), etat),
        rangement(liste, n));
      })),
      aideMemoire({ leviers: true })));
};

/* -------------------------------------------------------------- jeu d'essai */
RENDUS.essai = () => {
  const je = config.jeu_essai;
  je.valeurs ??= {};
  je.dettes ??= [];
  if (!je.dettes.length) je.dettes.push({ type: '', montant: 0, mensualite: 0 });
  const synthese = h('div', { class: 'resume-essai' });
  vivants.push(() => {
    if (!resultat) return;
    const v = resultat.valeurs;
    vider(synthese,
      h('dl', { class: 'paire' },
        h('dt', {}, 'Ressources'), h('dd', {}, formater(v.total_ressources, 'euro')),
        h('dt', {}, 'Charges'), h('dd', {}, formater(v.total_charges, 'euro')),
        h('dt', {}, 'Solde après dettes'), h('dd', {}, formater(v.solde_apres_dettes, 'euro')),
        h('dt', {}, 'Score'), h('dd', {}, formater(resultat.score?.valeur, 'nombre'), ' ', pastilleNiveau(resultat.score?.palier)),
        h('dt', {}, 'Mensualité'), h('dd', {}, formater(v.mensualite_retenue, 'euro'), ' · ', formater(v.duree_plan, 'mois')),
        h('dt', {}, 'Qualification'), h('dd', {}, resultat.qualification ? pastilleNiveau({ niveau: resultat.qualification.niveau }, resultat.qualification.texte) : '—'),
        h('dt', {}, 'Leviers'), h('dd', {}, resultat.leviersRetenus.map((l) => l.texte).join(' · ') || 'aucun'),
        h('dt', {}, 'Points d’attention'), h('dd', {}, resultat.points.length ? resultat.points.map((p) => p.texte).join(' · ') : 'aucun')));
  });
  return h('div', { class: 'pile' },
    entete('Jeu d’essai', 'Un ménage fictif sur lequel toutes les formules sont testées en direct dans l’administration. Il n’apparaît jamais dans le calculateur.'),
    h('div', { class: 'disposition-aide' },
      h('div', { class: 'pile' },
        carte('Ménage d’essai', null, h('div', { class: 'pile serree' },
          etiquette('Nom du jeu d’essai', texte(je, 'libelle')),
          config.sections.filter((s) => !s.nominatif && s.champs).map((s) => h('fieldset', { class: 'groupe-essai' },
            h('legend', {}, s.titre),
            h('div', { class: 'grille-champs' }, s.champs.filter((c) => c.type === 'montant' || c.type === 'nombre').map((c) =>
              etiquette(c.libelle, nombre(je.valeurs, c.id, c.type === 'montant' ? 'euro' : 'nombre', { vide: true, placeholder: '0' })))))),
          h('fieldset', { class: 'groupe-essai' }, h('legend', {}, 'Dettes en cours'),
            h('div', { class: 'grille-champs' },
              etiquette('Montant total', nombre(je.dettes[0], 'montant', 'euro')),
              etiquette('Mensualités totales', nombre(je.dettes[0], 'mensualite', 'euro')))),
          h('fieldset', { class: 'groupe-essai' }, h('legend', {}, 'Synthèse'),
            h('div', { class: 'grille-champs' }, etiquette('Mensualité simulée (0 = aucune)', nombre(je, 'mensualite_saisie', 'euro')))),
          h('button', {
            type: 'button', class: 'bouton-discret',
            onclick: async () => { if (await confirmer({ titre: 'Revenir au jeu d’essai publié ?', oui: 'Revenir' })) { config.jeu_essai = cloner(publie.jeu_essai ?? { valeurs: {} }); modifie(true); } },
          }, icone('nouveau'), 'Revenir au jeu d’essai publié')))),
      carte('Résultat', 'Recalculé à chaque frappe', synthese)));
};

/* -------------------------------------------------------------- liens */
RENDUS.liens = () => {
  const champs = champsAutorises(config);
  const tous = config.sections.filter((s) => !s.nominatif && s.champs).flatMap((s) => s.champs.filter((c) => c.type === 'montant' || c.type === 'nombre').map((c) => ({ ...c, section: s.titre, ref: c })));
  config.liens.colonnes ??= {};
  const essai = {};
  for (const c of champs) essai[c.id] = config.jeu_essai.valeurs?.[c.id] ?? '';
  const sortieLien = h('div', { class: 'lien-genere' });
  const sortieDax = h('pre', { class: 'bloc-code dax' });
  const base = () => config.meta.url_publique || new URL('.', location.href).href;
  const majLien = () => {
    const url = construireLien(base(), Object.fromEntries(Object.entries(essai).filter(([, v]) => v !== '' && v !== null)));
    vider(sortieLien,
      h('code', { class: 'tech' }, url),
      h('div', { class: 'actions-ligne' },
        h('button', { type: 'button', class: 'bouton-discret', onclick: () => copier(url) }, icone('copier'), 'Copier'),
        h('a', { class: 'bouton-discret', href: url.replace(base(), new URL('index.html', location.href).href.replace(/index\.html$/, '')), target: '_blank', rel: 'noopener' }, icone('oeil'), 'Ouvrir ici')));
    sortieDax.textContent = genererDax({ base: base(), table: config.liens.table, colonnes: Object.fromEntries(champs.map((c) => [c.id, config.liens.colonnes[c.id]])), mode: config.liens.mode });
  };
  vivants.push(majLien);
  const surSaisie = () => { majLien(); modifie(); };
  return h('div', { class: 'pile' },
    entete('Liens et Power BI', 'Un lien peut pré-remplir les champs autorisés. Il ne porte que des nombres : jamais de nom, d’adresse ni de référence. Les valeurs vont après le « # » et ne sont donc jamais envoyées au serveur.'),
    carte('Champs acceptés dans un lien', 'Cochez les champs qu’un lien peut pré-remplir. Les sections nominatives et les champs texte sont exclus d’office.',
      h('div', { class: 'cadre-table' }, h('table', { class: 'table-edition' },
        h('thead', {}, h('tr', {}, h('th', {}, 'Accepté'), h('th', {}, 'Paramètre'), h('th', {}, 'Champ'), h('th', {}, 'Section'))),
        h('tbody', {}, tous.map((c) => h('tr', {},
          h('td', { class: 'centre' }, h('input', { type: 'checkbox', checked: !!c.ref.url, 'aria-label': `Accepter ${c.libelle}`, onchange: (e) => { c.ref.url = e.target.checked; modifie(true); } })),
          h('td', {}, h('code', { class: 'tech' }, c.id)), h('td', {}, c.libelle), h('td', {}, c.section))))))),
    h('div', { class: 'duo' },
      carte('Fabriquer un lien de test', null, h('div', { class: 'pile serree' },
        etiquette('Adresse du calculateur', texte(config.meta, 'url_publique', { class: 'tech', oninput: undefined, onchange: () => majLien() })),
        h('div', { class: 'grille-champs' }, champs.map((c) => etiquette(`${c.libelle} (${c.id})`,
          h('input', { type: 'text', inputmode: 'decimal', value: essai[c.id] ?? '', oninput: (e) => { essai[c.id] = e.target.value.replace(',', '.'); majLien(); } })))),
        sortieLien)),
      carte('Formule DAX pour Power BI', 'Chaque ligne du tableau Power BI porte son lien.', h('div', { class: 'pile serree' },
        h('div', { class: 'grille-champs' },
          etiquette('Table Power BI', h('input', { type: 'text', value: config.liens.table ?? '', oninput: (e) => { config.liens.table = e.target.value; surSaisie(); } })),
          etiquette('Type', h('select', { value: config.liens.mode ?? 'colonne', onchange: (e) => { config.liens.mode = e.target.value; surSaisie(); } },
            h('option', { value: 'colonne' }, 'Colonne calculée'), h('option', { value: 'mesure' }, 'Mesure')))),
        h('table', { class: 'table-edition' },
          h('thead', {}, h('tr', {}, h('th', {}, 'Paramètre'), h('th', {}, 'Colonne Power BI correspondante'))),
          h('tbody', {}, champs.map((c) => h('tr', {},
            h('td', {}, h('code', { class: 'tech' }, c.id)),
            h('td', {}, h('input', { type: 'text', value: config.liens.colonnes[c.id] ?? '', placeholder: 'ex. NbAdultes', 'aria-label': `Colonne Power BI pour ${c.id}`, oninput: (e) => { config.liens.colonnes[c.id] = e.target.value; surSaisie(); } })))))),
        sortieDax,
        h('button', { type: 'button', class: 'bouton-discret', onclick: () => copier(sortieDax.textContent) }, icone('copier'), 'Copier la formule'),
        h('ol', { class: 'etapes petites' },
          h('li', {}, 'Coller la formule dans une nouvelle colonne (ou mesure) de la table.'),
          h('li', {}, 'Dans « Outils de colonne », régler la catégorie de données sur « URL web ».'),
          h('li', {}, 'Dans un tableau, activer « Valeurs d’URL » ou utiliser un bouton dont l’action « URL web » lit cette colonne.'),
          h('li', {}, 'Un paramètre vide est simplement omis du lien.'))))));
};

window.dinguerieDemarree = true;
demarrer();
