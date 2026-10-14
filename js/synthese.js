/* ===========================================================================
   La synthese. Le meme rendu sert a l'ecran et au PDF (mode « pdf ») : ce qui
   s'imprime est exactement ce qu'on a lu.

   Chaque bloc porte data-bloc-pdf : l'export le capture d'un tenant et ne
   le coupe jamais entre deux pages.
   =========================================================================== */

import { h, icone, vider } from './dom.js?v=b0bda1646f';
import { formater, echapper } from './format.js?v=b0bda1646f';
import { compter, cascade } from './animations.js?v=b0bda1646f';
import { barres, jaugeZones, legendeSeuils, demiCercle, critere, pastilleNiveau, couleurNiveau, zonesScore, bande, friseDuree } from './graphiques.js?v=b0bda1646f';
import { dessinIcone } from './icones.js?v=b0bda1646f';

const NIVEAU_CLASSE = { vert: 'vert', ambre: 'ambre', rouge: 'rouge', neutre: '' };

/* Un bloc de synthese : medaillon illustre, titre, sous-titre, contenu. */
function bloc({ titre, sous, icone: ic, ton = 'dossier', classe = '' }, ...contenu) {
  return h('section', { class: `carte bloc-synthese ton-${ton} ${classe}`, 'data-bloc-pdf': '' },
    h('header', {},
      ic ? h('span', { class: `medaillon m-${ton}` }, dessinIcone(ic)) : null,
      h('div', { class: 'titres' }, h('h3', {}, titre), sous ? h('p', {}, sous) : null)),
    h('div', { class: 'corps' }, ...contenu));
}

/* Icone et teinte de chaque chiffre cle, a defaut de reglage dans le parametrage. */
const CHIFFRE_DEFAUT = {
  total_ressources: { icone: 'portefeuille', ton: 'entree' },
  total_charges: { icone: 'recu', ton: 'sortie' },
  solde_budgetaire: { icone: 'calculette', ton: 'solde' },
  quotient_familial: { icone: 'famille', ton: 'dossier' },
};
const FAMILLE_DEFAUT = { accompagnement: { icone: 'coeur', ton: 'dossier' }, logement: { icone: 'maison', ton: 'sortie' }, budget: { icone: 'portefeuille', ton: 'entree' } };

const memoire = new Map(); // derniere valeur affichee par chiffre cle, pour compter depuis elle

function chiffre(el, cle, valeur, format, animer) {
  const de = memoire.get(cle) ?? 0;
  memoire.set(cle, valeur);
  if (!animer || valeur === null || valeur === undefined) { el.textContent = formater(valeur, format); return; }
  compter(el, de, valeur, (v) => { el.textContent = formater(['nombre', 'score'].includes(format) && v !== valeur ? Math.round(v) : v, format); });
}

export function saisieVide(etat) {
  return !Object.entries(etat.valeurs).some(([, v]) => v !== '' && v !== 0 && v !== null && v !== undefined)
    && !etat.dettes.some((d) => d.type || d.montant || d.mensualite);
}

/* Les champs du dossier renseignes. « court » ne garde que ce qui designe le
   dossier (nom, reference, date, conseiller) : ni adresse ni coordonnees. */
const COORDONNEES = new Set(['adresse', 'telephone', 'email']);
export function identite(config, etat, { court = false } = {}) {
  const sec = config.sections.find((s) => s.nominatif);
  if (!sec) return [];
  return (sec.champs ?? [])
    .filter((c) => !court || !COORDONNEES.has(c.id))
    .map((c) => ({ libelle: c.libelle, valeur: c.type === 'date' && etat.valeurs[c.id] ? new Date(etat.valeurs[c.id]).toLocaleDateString('fr-FR') : etat.valeurs[c.id] }))
    .filter((x) => x.valeur);
}

export function rendreSynthese(racine, { config, resultat, etat, mode = 'ecran', animer = true, surSimulation }) {
  const pdf = mode === 'pdf';
  const v = resultat.valeurs;
  const f = resultat.formats;
  const blocs = [];

  // ---------------------------------------------------------------- en-tete PDF
  if (pdf) {
    const id = identite(config, etat);
    blocs.push(h('section', { class: 'entete-pdf', 'data-bloc-pdf': '' },
      h('div', { class: 'titre-pdf' },
        h('div', {}, h('p', { class: 'surtitre' }, config.meta.sous_titre), h('h2', {}, 'Synthèse du diagnostic budgétaire')),
        h('p', { class: 'date-pdf' }, `Édité le ${new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}`)),
      id.length ? h('dl', { class: 'paire identite' }, id.map((x) => [h('dt', {}, x.libelle), h('dd', {}, x.valeur)])) : h('p', { class: 'note' }, 'Dossier non nominatif.')));
  }

  // ---------------------------------------------------------------- bilan
  blocs.push(bilan(config, resultat, etat, animer));

  // ---------------------------------------------------------------- chiffres cles
  const tuiles = h('div', { class: 'tuiles tuiles-cles' }, (config.chiffres_cles ?? []).map((c) => {
    const val = v[c.indicateur];
    const def = CHIFFRE_DEFAUT[c.indicateur] ?? { icone: 'piece', ton: 'dossier' };
    const negatif = c.signe && typeof val === 'number' && val < 0;
    const ton = c.ton ?? (def.ton === 'solde' ? (negatif ? 'alerte' : 'entree') : def.ton);
    const el = h('span', { class: 'valeur' });
    chiffre(el, `cc-${c.indicateur}`, val, f[c.indicateur], animer);
    return h('div', { class: `tuile cle ton-${ton}${negatif ? ' negatif' : ''}` },
      h('div', { class: 'tete-tuile' }, h('span', { class: 'etiquette' }, c.libelle), h('span', { class: `medaillon petit m-${ton}` }, dessinIcone(c.icone ?? def.icone))),
      el,
      c.signe && typeof val === 'number' ? h('span', { class: 'note' }, val < 0 ? 'Budget déficitaire' : 'Budget à l’équilibre ou excédentaire') : (c.note ? h('span', { class: 'note' }, c.note) : null));
  }));
  blocs.push(bloc({ titre: 'Chiffres clés', sous: 'Montants mensuels', icone: 'calculette' }, tuiles));

  // ---------------------------------------------------------------- indicateurs
  const jauges = h('div', { class: 'grille-jauges' }, resultat.jauges.map((j) => {
    const format = f[j.indicateur] ?? 'pourcent';
    const el = h('span', { class: 'valeur' });
    chiffre(el, `j-${j.indicateur}`, j.valeur, format, animer);
    return h('div', { class: `jauge-carte niveau-${j.palier?.niveau ?? 'neutre'}` },
      h('div', { class: 'jauge-tete' }, h('span', { class: 'etiquette' }, j.libelle), pastilleNiveau(j.palier)),
      el,
      jaugeZones({ ...j, format }, { animer }),
      h('p', { class: 'seuils' }, legendeSeuils(j, format)));
  }));
  blocs.push(bloc({ titre: 'Indicateurs clés', sous: 'La position de chaque indicateur par rapport à ses seuils', icone: 'recherche' }, jauges));

  // ---------------------------------------------------------------- repartition / ressources
  const categories = resultat.repartition.map((r, n) => ({ libelle: r.libelle, valeur: r.valeur, couleur: `var(--cat-${(n % 5) + 1})` }));
  const totalDep = categories.reduce((t, r) => t + Math.max(0, r.valeur ?? 0), 0);
  const ressources = v.total_ressources ?? 0;
  const solde = v.solde_apres_dettes;
  const negatif = (solde ?? 0) < 0;
  blocs.push(h('div', { class: 'duo', 'data-bloc-pdf': '' },
    bloc({ titre: 'Répartition des dépenses', sous: `Total : ${formater(totalDep, 'euro')} par mois, dettes comprises`, icone: 'piece', ton: 'sortie' },
      totalDep > 0 ? [
        bande(categories, { total: totalDep, animer }),
        barres(categories, { total: totalDep, animer }),
      ] : h('p', { class: 'vide' }, 'Aucune dépense saisie.')),
    bloc({ titre: 'Ressources et charges', sous: 'Ce qui entre, ce qui sort, ce qui reste', icone: 'portefeuille', ton: 'entree' },
      h('div', { class: 'equation', 'aria-label': 'Ressources moins charges égale solde' },
        h('div', { class: 'terme entree' }, h('span', {}, 'Ressources'), h('strong', {}, formater(ressources, 'euro'))),
        h('span', { class: 'operateur', 'aria-hidden': 'true' }, '−'),
        h('div', { class: 'terme sortie' }, h('span', {}, 'Charges et dettes'), h('strong', {}, formater(v.total_charges_avec_dettes, 'euro'))),
        h('span', { class: 'operateur', 'aria-hidden': 'true' }, '='),
        h('div', { class: `terme ${negatif ? 'alerte' : 'reste'}` }, h('span', {}, 'Solde'), h('strong', {}, formater(solde, 'euro')))),
      barres([
        { libelle: 'Ressources', valeur: ressources, couleur: 'var(--vert)' },
        { libelle: 'Charges, dettes comprises', valeur: v.total_charges_avec_dettes, couleur: 'var(--taupe)' },
        { libelle: 'Solde après dettes', valeur: solde, couleur: negatif ? 'var(--rouge)' : 'var(--petrole)' },
      ], { animer }),
      h('p', { class: `note-graphique ${negatif ? 'alerte' : ''}` }, negatif
        ? `Les charges dépassent les ressources de ${formater(-solde, 'euro')} par mois.`
        : `Il reste ${formater(solde, 'euro')} par mois une fois toutes les charges et dettes payées, soit ${formater(v.rav_uc, 'euro')} par unité de consommation.`))));

  // ---------------------------------------------------------------- score / points
  const sc = resultat.score;
  const nombreScore = h('span', { class: 'score-chiffre' });
  chiffre(nombreScore, 'score', sc?.valeur, 'nombre', animer);
  blocs.push(h('div', { class: 'duo', 'data-bloc-pdf': '' },
    bloc({ titre: 'Score de fragilité budgétaire', sous: 'Plus le score est haut, plus la situation est solide', icone: 'bouclier' },
      sc ? h('div', { class: 'score' },
        h('div', { class: 'score-cadran' },
          demiCercle(sc.valeur, sc.max, sc.palier, { animer, zones: zonesScore(sc) }),
          h('div', { class: 'score-centre' }, nombreScore, h('span', { class: 'sur' }, `/ ${sc.max}`)),
          pastilleNiveau(sc.palier)),
        h('div', { class: 'barres criteres' }, sc.criteres.map((c) => critere(c, { animer })))) : null),
    bloc({ titre: 'Points d’attention', sous: resultat.points.length ? `${resultat.points.length} point(s) relevé(s)` : 'Rien à signaler', icone: 'alerte', ton: resultat.points.length ? 'vigilance' : 'entree' },
      resultat.points.length
        ? h('ul', { class: 'points' }, resultat.points.map((p) => h('li', {}, h('span', { class: 'puce-alerte' }, icone('alerte')), h('span', {}, p.texte))))
        : h('p', { class: 'rien-a-signaler' }, icone('ok'), 'Aucun point d’attention relevé.'))));

  // ---------------------------------------------------------------- plan d'apurement
  const q = resultat.qualification;
  const simule = (etat.mensualite_saisie ?? 0) > 0;
  const mensualite = h('span', { class: 'valeur' });
  chiffre(mensualite, 'mensualite', v.mensualite_retenue, 'euro', animer);
  const duree = h('span', { class: 'valeur' });
  chiffre(duree, 'duree', v.duree_plan, 'nombre', animer);
  const plan = h('div', { class: 'plan' },
    h('div', { class: 'plan-chiffres' },
      h('div', { class: 'tuile ton-dossier' }, h('span', { class: 'etiquette' }, 'Capacité d’apurement estimée'),
        h('span', { class: 'valeur fourchette' }, `${formater(v.apurement_mini, 'euro')} – ${formater(v.apurement_maxi, 'euro')}`),
        h('span', { class: 'note' }, 'Fourchette selon le solde après dettes')),
      h('div', { class: 'tuile vedette' }, h('span', { class: 'etiquette' }, simule ? 'Mensualité simulée' : 'Mensualité proposée'),
        h('span', { class: 'ligne-valeur' }, mensualite, h('span', { class: 'unite' }, '/ mois')),
        h('span', { class: 'note' }, simule ? `Conseillée : ${formater(v.mensualite_conseillee, 'euro')}` : `Soit ${formater(v.effort_apurement, 'pourcent')} du solde après dettes`)),
      h('div', { class: 'tuile ton-sortie' }, h('span', { class: 'etiquette' }, 'Durée estimée du plan'),
        h('span', { class: 'ligne-valeur' }, duree, h('span', { class: 'unite' }, 'mois')),
        h('span', { class: 'note' }, `Dette locative : ${formater(v.dette_locative, 'euro')}`))),
    (v.duree_plan ?? 0) > 0 ? friseDuree(v.duree_plan, v.duree_max_plan, { animer }) : null,
    q ? h('div', { class: `qualification niveau-${q.niveau ?? 'neutre'}` },
      h('span', { class: 'barre-niveau', style: { background: couleurNiveau(q.niveau) }, 'aria-hidden': 'true' }),
      h('div', {}, pastilleNiveau({ niveau: q.niveau }, q.texte), h('p', {}, q.commentaire))) : null,
    !pdf && surSimulation ? simulation(etat, v, surSimulation) : null,
    pdf && simule ? h('p', { class: 'note' }, `Mensualité simulée par le conseiller ; la mensualité conseillée par le barème était de ${formater(v.mensualite_conseillee, 'euro')}.`) : null);
  blocs.push(bloc({ titre: 'Proposition de plan d’apurement', sous: 'Aide à la décision', icone: 'calendrier' }, plan));

  // ---------------------------------------------------------------- leviers
  const lv = resultat.leviersRetenus;
  blocs.push(bloc({ titre: 'Leviers d’action', sous: lv.length ? 'Par ordre de priorité' : null, icone: 'etincelle' },
    lv.length ? h('ol', { class: 'leviers' }, lv.map((l, n) => {
      const fam = FAMILLE_DEFAUT[String(l.famille ?? '').toLowerCase()] ?? { icone: 'etincelle', ton: 'dossier' };
      return h('li', { class: `levier ton-${fam.ton}${n === 0 ? ' premier' : ''}` },
        h('span', { class: 'rang', 'aria-hidden': 'true' }, String(n + 1)),
        h('span', { class: `medaillon petit m-${fam.ton}` }, dessinIcone(fam.icone)),
        h('div', { class: 'levier-corps' },
          h('div', { class: 'levier-tete' }, h('strong', {}, l.texte), l.famille ? h('span', { class: 'jeton' }, l.famille) : null),
          l.description ? h('p', {}, l.description) : null));
    }))
      : h('p', { class: 'rien-a-signaler' }, icone('ok'), 'Aucun levier particulier n’est déclenché.')));

  // ---------------------------------------------------------------- detail
  if (pdf) blocs.push(...detailSaisie(config, etat));
  else blocs.push(detailCalculs(config, resultat));

  vider(racine, blocs);
  if (animer) cascade(racine.children);
}

/* Le bandeau de bilan : la situation en une phrase, sur fond de la charte. */
function bilan(config, resultat, etat, animer) {
  const v = resultat.valeurs;
  const q = resultat.qualification;
  const sc = resultat.score;
  const negatif = (v.solde_apres_dettes ?? 0) < 0;
  const faits = [
    { libelle: 'Solde après dettes', valeur: formater(v.solde_apres_dettes, 'euro'), alerte: negatif },
    { libelle: 'Reste à vivre par UC', valeur: formater(v.rav_uc, 'euro') },
    (v.dette_locative ?? 0) <= 0 ? { libelle: 'Dette locative', valeur: 'Aucune' }
      : (v.mensualite_retenue ?? 0) > 0
        ? { libelle: 'Plan proposé', valeur: `${formater(v.mensualite_retenue, 'euro')} × ${formater(v.duree_plan, 'nombre')} mois` }
        : { libelle: 'Plan proposé', valeur: 'Non envisageable', alerte: true },
  ];
  const chiffreScore = h('span', { class: 'score-chiffre' });
  chiffre(chiffreScore, 'bilan-score', sc?.valeur, 'nombre', animer);
  return h('section', { class: 'bilan', 'data-bloc-pdf': '' },
    h('div', { class: 'bilan-texte' },
      h('p', { class: 'surtitre' }, 'Bilan de la situation'),
      h('h3', {}, q?.texte ?? 'Situation budgétaire'),
      q?.commentaire ? h('p', { class: 'commentaire' }, q.commentaire) : null,
      h('dl', { class: 'bilan-faits' }, faits.map((x) => h('div', { class: x.alerte ? 'alerte' : '' }, h('dt', {}, x.libelle), h('dd', {}, x.valeur))))),
    sc ? h('div', { class: 'bilan-score' },
      demiCercle(sc.valeur, sc.max, sc.palier, { animer, clair: true }),
      h('div', { class: 'score-centre' }, chiffreScore, h('span', { class: 'sur' }, `/ ${sc.max}`)),
      h('span', { class: 'legende-score' }, 'Score de fragilité'),
      pastilleNiveau(sc.palier)) : null);
}

function simulation(etat, v, surSimulation) {
  const champ = h('input', {
    id: 'simulation-mensualite', type: 'text', inputmode: 'decimal', placeholder: formater(v.mensualite_conseillee, 'euro').replace(' €', ''),
    value: etat.mensualite_saisie > 0 ? String(etat.mensualite_saisie).replace('.', ',') : '',
  });
  const appliquer = () => {
    const n = Number(String(champ.value).replace(/[\s€]/g, '').replace(',', '.'));
    surSimulation(Number.isFinite(n) && n > 0 ? n : 0);
  };
  champ.addEventListener('change', appliquer);
  champ.addEventListener('keydown', (e) => { if (e.key === 'Enter') appliquer(); });
  return h('div', { class: 'simulation' },
    h('label', { for: 'simulation-mensualite' }, 'Simuler une autre mensualité'),
    h('span', { class: 'saisie-nombre euro' }, champ),
    h('button', { type: 'button', class: 'bouton second', onclick: appliquer }, 'Recalculer'),
    etat.mensualite_saisie > 0 ? h('button', { type: 'button', class: 'bouton-discret', onclick: () => surSimulation(0) }, 'Revenir à la mensualité conseillée') : null);
}

function detailCalculs(config, resultat) {
  const groupes = new Map();
  for (const i of config.indicateurs) {
    if (!groupes.has(i.groupe ?? 'Autres')) groupes.set(i.groupe ?? 'Autres', []);
    groupes.get(i.groupe ?? 'Autres').push(i);
  }
  return h('details', { class: 'carte detail-calculs' },
    h('summary', {}, h('span', {}, 'Détail des calculs'), h('small', {}, 'Tous les indicateurs, leur formule et leur valeur')),
    h('div', { class: 'cadre-table' }, h('table', {},
      h('thead', {}, h('tr', {}, h('th', {}, 'Indicateur'), h('th', { class: 'num' }, 'Valeur'), h('th', {}, 'Formule'))),
      h('tbody', {}, [...groupes].map(([g, liste]) => [
        h('tr', { class: 'groupe' }, h('td', { colspan: 3 }, g)),
        liste.map((i) => h('tr', {},
          h('td', {}, i.libelle),
          h('td', { class: 'num' }, resultat.erreurs[i.id] ? h('span', { class: 'jeton rouge', title: resultat.erreurs[i.id] }, 'erreur') : formater(resultat.valeurs[i.id], i.format)),
          h('td', {}, h('code', { class: 'tech' }, i.formule)))),
      ])))));
}

function detailSaisie(config, etat) {
  const lignes = [];
  for (const s of config.sections) {
    if (s.nominatif) continue;
    if (s.type === 'dettes') {
      const d = etat.dettes.filter((x) => x.type || x.montant || x.mensualite);
      if (d.length) lignes.push({ titre: s.titre, items: d.map((x) => [x.type || 'Dette', `${formater(Number(x.montant) || 0, 'euro')} · ${formater(Number(x.mensualite) || 0, 'euro')} / mois${x.echeance ? ` · échéance ${x.echeance}` : ''}`]) });
      continue;
    }
    const items = (s.champs ?? []).filter((c) => etat.valeurs[c.id] !== '' && etat.valeurs[c.id] !== undefined && etat.valeurs[c.id] !== 0)
      .map((c) => [c.libelle, c.type === 'montant' ? formater(Number(etat.valeurs[c.id]), 'euro') : String(etat.valeurs[c.id])]);
    if (items.length) lignes.push({ titre: s.titre, items });
  }
  if (!lignes.length) return [];
  // Deux colonnes de sections, chacune capturee d'un tenant
  return [h('section', { class: 'carte bloc-synthese detail-saisie', 'data-bloc-pdf': '' },
    h('header', {}, h('span', { class: 'medaillon m-dossier' }, dessinIcone('document')), h('div', { class: 'titres' }, h('h3', {}, 'Détail de la saisie'), h('p', {}, 'Lignes renseignées, montants mensuels'))),
    h('div', { class: 'corps colonnes-detail' }, lignes.map((l) => h('div', { class: 'groupe-detail' },
      h('h4', {}, l.titre),
      h('dl', { class: 'paire' }, l.items.map(([a, b]) => [h('dt', {}, a), h('dd', {}, b)]))))))];
}

export { echapper };
