/* ===========================================================================
   La synthese. Cinq blocs, chacun repond a une question :
     1. ou en est le menage ?    le bilan : un verdict, quatre chiffres, le score, la premiere piste
     2. ou part l'argent ?       une cascade des ressources au reste reel
     3. pourquoi ce score ?      les points gagnes et perdus, critere par critere
     4. quel plan est realiste ? un curseur et des scenarios compares
     5. que faire ?              les points d'attention et les leviers a retenir

   Le meme rendu sert a l'ecran et au PDF (mode « pdf ») : ce qui s'imprime
   est ce qu'on a lu. Chaque bloc porte data-bloc-pdf : l'export le capture
   d'un tenant et ne le coupe jamais entre deux pages.
   =========================================================================== */

import { h, icone, vider } from './dom.js?v=743faf48c0';
import { formater, interpoler, echapper } from './format.js?v=743faf48c0';
import { compter, cascade } from './animations.js?v=743faf48c0';
import { calculer } from './formules.js?v=743faf48c0';
import { demiCercle, pastilleNiveau, couleurNiveau, cascadeBudget, barreSur100, jaugeNommee, barrePoints, scenarios } from './graphiques.js?v=743faf48c0';
import { dessinIcone } from './icones.js?v=743faf48c0';

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

/* Un bloc de synthese : medaillon illustre, numero et question, titre. */
function bloc({ id, numero, titre, question, icone: ic, ton = 'dossier', classe = '' }, ...contenu) {
  return h('section', { class: `carte bloc-synthese ton-${ton} ${classe}`, id, 'data-bloc-pdf': '' },
    h('header', {},
      ic ? h('span', { class: `medaillon m-${ton}` }, dessinIcone(ic)) : null,
      h('div', { class: 'titres' },
        numero ? h('p', { class: 'numero-bloc' }, `${numero} · ${question}`) : null,
        h('h3', {}, titre))),
    h('div', { class: 'corps' }, ...contenu));
}

const fmt = (v, f = 'euro') => formater(v, f);
const ans = (mois) => {
  if (!mois || mois < 24) return '';
  const a = mois / 12;
  return ` (${Math.abs(a - Math.round(a)) < 0.15 ? 'près de' : 'environ'} ${Math.round(a)} ans)`;
};
const dureePour = (dette, m) => (m > 0 ? Math.ceil(dette / m - 1e-9) : null);

/* ------------------------------------------------------------- 1. bilan */

/* Le verdict en une phrase : ce qui ne va pas, ou ce qui va. La partie qui
   compte est mise en valeur. */
function verdict(v) {
  const solde = v.solde_apres_dettes ?? 0;
  const dette = v.dette_locative ?? 0;
  const m = v.mensualite_retenue ?? 0;
  const d = v.duree_plan ?? 0;
  const cible = v.duree_max_plan;
  const em = (t) => h('em', {}, t);
  const fort = (t) => h('strong', {}, t);
  if (!(v.total_ressources > 0)) {
    return { titre: ['Les ressources du ménage ', em('restent à saisir'), '.'], explication: ['Le bilan se construit dès que les ressources et les dépenses sont renseignées.'] };
  }
  if (solde < 0) {
    return {
      titre: ['Le budget ', em('ne tient pas'), ' : il manque ', em(fmt(-solde)), ' chaque mois.'],
      explication: ['Les charges et les remboursements dépassent les ressources de ', fort(`${fmt(-solde)} par mois`), '. Avant tout plan d’apurement, le budget doit être rééquilibré.'],
    };
  }
  if (dette > 0 && m <= 0) {
    return {
      titre: ['Le budget tient à peine : ', em('aucun plan d’apurement n’est envisageable'), ' en l’état.'],
      explication: ['Il reste ', fort(`${fmt(solde)} par mois`), ' une fois tout payé, trop peu pour rembourser les ', fort(fmt(dette)), ' de dette locative.'],
    };
  }
  if (dette > 0 && cible && d > cible) {
    return {
      titre: ['Le budget tient, mais la dette locative est ', em('trop lourde pour être remboursée seule'), '.'],
      explication: ['Il reste ', fort(`${fmt(solde)} par mois`), ' une fois tout payé. À ', fmt(m), ' par mois, les ', fort(fmt(dette)), ' de dette prendraient ', fort(`${d} mois`), `${ans(d)}, au-delà des ${cible} mois visés. Une aide extérieure est nécessaire.`],
    };
  }
  if (dette > 0) {
    return {
      titre: ['Le budget tient et la dette peut être ', em(`apurée en ${d} mois`), '.'],
      explication: ['Il reste ', fort(`${fmt(solde)} par mois`), ' une fois tout payé. Un plan de ', fort(`${fmt(m)} par mois`), ' rembourserait les ', fort(fmt(dette)), ' de dette en ', fort(`${d} mois`), '.'],
    };
  }
  return {
    titre: ['Pas de dette locative : le budget ', em(`laisse ${fmt(solde)} par mois`), '.'],
    explication: ['Une fois toutes les charges et dettes payées, il reste ', fort(`${fmt(solde)} par mois`), ` au ménage, soit ${fmt(v.rav_uc)} par unité de consommation.`],
  };
}

function conditionVraie(source, valeurs) {
  if (!source) return true;
  try { return Boolean(calculer(source, { valeurs, baremes: {} })); } catch { return true; }
}

function bilan(config, resultat, etat, animer) {
  const v = resultat.valeurs;
  const sc = resultat.score;
  const { titre, explication } = verdict(v);
  const qui = identite(config, etat, { court: true }).map((x) => x.valeur);
  const planImpossible = (v.dette_locative ?? 0) > 0 && (v.mensualite_retenue ?? 0) <= 0;
  const faits = (config.chiffres_cles ?? []).filter((c) => conditionVraie(c.si, v)).map((c) => {
    // Plan impossible : la tuile le dit au lieu d'afficher « 0 € × 0 mois »
    const impossible = c.texte && planImpossible && /mensualite/.test(c.texte);
    const valeur = impossible ? 'Non envisageable'
      : c.texte ? interpoler(c.texte, v, resultat.formats) : fmt(v[c.indicateur], resultat.formats[c.indicateur] ?? 'euro');
    const negatif = impossible || (c.signe && typeof v[c.indicateur] === 'number' && v[c.indicateur] < 0);
    // La note dit aussi le statut de l'indicateur, quand une jauge le suit.
    const jauge = resultat.jauges.find((j) => j.indicateur === c.indicateur);
    const note = [jauge?.palier?.libelle?.toLowerCase(), c.note ? interpoler(c.note, v, resultat.formats) : null].filter(Boolean).join(' · ');
    return h('div', { class: `fait${negatif ? ' alerte' : ''}` }, h('dt', {}, c.libelle), h('dd', {}, valeur), note ? h('span', { class: 'note-fait' }, note) : null);
  });
  const ecartes = etat.ui?.leviersEcartes ?? new Set();
  const piste = resultat.leviersRetenus.find((l) => !ecartes.has(l.id));
  const chiffreScore = h('span', { class: 'score-chiffre' });
  chiffre(chiffreScore, 'bilan-score', sc?.valeur, 'nombre', animer);
  return h('section', { class: 'bilan', id: 's-bilan', 'data-bloc-pdf': '' },
    h('div', { class: 'bilan-texte' },
      h('p', { class: 'surtitre' }, ['Bilan', ...qui].join(' · ')),
      h('h3', {}, titre),
      h('p', { class: 'commentaire' }, explication),
      h('dl', { class: 'bilan-faits' }, faits)),
    h('div', { class: 'bilan-droite' },
      sc ? h('div', { class: 'bilan-score' },
        demiCercle(sc.valeur, sc.max, sc.palier, { animer, clair: true }),
        h('div', { class: 'score-centre' }, chiffreScore, h('span', { class: 'sur' }, `/ ${sc.max}`)),
        h('span', { class: 'legende-score' }, 'Score de fragilité'),
        pastilleNiveau(sc.palier)) : null,
      piste ? h('div', { class: 'premiere-piste' },
        h('p', { class: 'surtitre' }, 'Première piste'),
        h('strong', {}, h('span', { class: 'rang-piste' }, '1'), piste.texte),
        piste.description ? h('p', {}, piste.description) : null) : null));
}

/* ---------------------------------------------------------- 2. le budget */

function budget(config, resultat, animer) {
  const v = resultat.valeurs;
  const ressources = Math.max(0, v.total_ressources ?? 0);
  const cats = (config.repartition ?? []).map((r, n) => ({
    libelle: r.libelle.replace(/\s*\(.*\)$/, ''), detail: (r.libelle.match(/\((.*)\)/) ?? [])[1],
    valeur: Math.max(0, v[r.indicateur] ?? 0), couleur: `var(--cat-${(n % 5) + 1})`,
  }));
  const solde = v.solde_apres_dettes ?? 0;
  const plan = (v.dette_locative ?? 0) > 0 ? (v.mensualite_retenue ?? 0) : 0;
  const reste = solde - plan;
  if (!ressources) {
    return bloc({ id: 's-budget', numero: '2', question: 'Où part l’argent ?', titre: 'Le budget du mois', icone: 'piece', ton: 'sortie' },
      h('p', { class: 'vide-bloc' }, 'Saisissez les ressources du ménage pour voir où part l’argent.'));
  }
  const etapes = cats.filter((c) => c.valeur > 0);
  const titreCascade = plan > 0
    ? `De ${fmt(ressources)} qui rentrent à ${fmt(Math.abs(reste))} qui ${reste < 0 ? 'manquent' : 'restent vraiment'}`
    : `De ${fmt(ressources)} qui rentrent à ${fmt(Math.abs(solde))} qui ${solde < 0 ? 'manquent' : 'restent'}`;
  const phrase = solde < 0
    ? `Chaque mois, il manque ${fmt(-solde)} pour couvrir les dépenses et les remboursements.`
    : plan > 0
      ? `Après le loyer, les factures et les courses, il vous reste ${fmt(solde)}. Si on met ${fmt(plan)} sur la dette, il vous reste ${fmt(reste)} pour les imprévus.`
      : `Après le loyer, les factures et les courses, il vous reste ${fmt(solde)} par mois.`;

  // Sur 100 euros : les categories, puis ce qui reste
  const sur100 = [...cats, ...(solde > 0 ? [{ libelle: 'Ce qui reste', valeur: solde, couleur: 'var(--petrole)', reste: true }] : [])];
  const echelle = Math.max(ressources, cats.reduce((t, c) => t + c.valeur, 0));
  const plusGros = [...cats].sort((a, b) => b.valeur - a.valeur)[0];
  const effort = config.jauges?.find((j) => j.indicateur === 'taux_effort_logement');
  const i = effort?.paliers?.findIndex((p) => p.niveau !== 'vert') ?? -1;
  const repere = effort && i > 0 && effort.paliers[i - 1].seuil !== null
    ? `Au-delà de ${Math.round(Number(effort.paliers[i - 1].seuil) * 100)} € de logement sur 100 €, la situation est jugée « ${effort.paliers[i].libelle.toLowerCase()} ».`
    : null;
  return h('div', { class: 'duo-budget', id: 's-budget', 'data-bloc-pdf': '' },
    bloc({ numero: '2', question: 'Où part l’argent ?', titre: titreCascade, icone: 'piece', ton: 'sortie' },
      h('p', { class: 'sous-bloc' }, `Montants mensuels${plan > 0 ? ' · la barre hachurée est le plan d’apurement proposé' : ''}`),
      cascadeBudget({ ressources, etapes, solde, plan, animer }),
      h('p', { class: 'a-dire' }, h('span', {}, h('strong', {}, 'À dire au ménage : '), `« ${phrase} »`))),
    bloc({ titre: `Sur 100 € qui rentrent, ${(plusGros?.libelle ?? 'les dépenses').toLowerCase()} en prend ${Math.round((plusGros?.valeur ?? 0) / ressources * 100)}`, icone: 'portefeuille', ton: 'entree' },
      h('p', { class: 'sous-bloc' }, 'Une échelle que tout le monde comprend'),
      barreSur100(sur100, echelle),
      h('ul', { class: 'legende-100' }, sur100.map((c) => h('li', { class: c.reste ? 'reste' : '' },
        h('span', { class: 'pastille-legende', style: { background: c.couleur } }),
        h('span', { class: 'nom' }, h('strong', {}, c.libelle), c.detail ? h('small', {}, c.detail) : null),
        h('span', { class: 'valeurs' }, h('strong', {}, `${Math.round(c.valeur / echelle * 100)} €`), h('small', {}, `${fmt(c.valeur)} / mois`))))),
      repere ? h('p', { class: 'repere' }, h('span', { class: 'jeton ambre' }, 'Repère'), h('span', {}, repere)) : null));
}

/* ----------------------------------------------------- 3. le score explique */

function score(config, resultat, animer) {
  const sc = resultat.score;
  if (!sc) return [];
  const v = resultat.valeurs;
  const total = sc.criteres.reduce((t, c) => t + (c.valeur ?? 0), 0);
  const nombre = h('span', { class: 'score-grand' });
  chiffre(nombre, 'score-grand', sc.valeur, 'nombre', animer);
  const tete = h('section', { class: 'carte bloc-synthese score-tete', id: 's-score', 'data-bloc-pdf': '' },
    h('div', { class: 'corps grille-score' },
      h('div', { class: 'score-resume' },
        h('p', { class: 'numero-bloc' }, '3 · Pourquoi ce score ?'),
        h('p', { class: 'ligne-score' }, nombre, h('span', { class: 'sur' }, `/ ${sc.max}`)),
        pastilleNiveau(sc.palier),
        h('p', { class: 'note' }, 'Plus le score est haut, plus la situation est solide.')),
      h('div', { class: 'score-detail' },
        h('p', { class: 'titre-points' }, h('strong', {}, 'D’où viennent les points ?'), ` · ${total} gagnés sur ${sc.max} possibles`),
        barrePoints(sc.criteres, sc.max),
        h('div', { class: 'graduation-points' }, [0, 25, 50, 75, 100].map((x) => h('span', { style: { left: `${x}%` } }, String(Math.round(sc.max * x / 100))))),
        h('ul', { class: 'legende-points' }, sc.criteres.map((c, n) => h('li', {},
          h('span', { class: 'pastille-legende', style: { background: `var(--cat-${(n % 5) + 1})` } }),
          c.libelle, ' ', h('strong', { class: (c.valeur ?? 0) === 0 ? 'zero' : '' }, `${c.valeur ?? 0} / ${c.max}`)))))));

  // Une carte par critere, avec la jauge qui le suit (reglage « critere » de la jauge)
  const cartes = sc.criteres.map((c) => {
    const j = resultat.jauges.find((x) => x.critere === c.indicateur);
    const ratio = (c.valeur ?? 0) / (c.max || 1);
    const niveauPts = ratio >= 0.66 ? 'vert' : ratio >= 0.33 ? 'ambre' : 'rouge';
    const format = j ? resultat.formats[j.indicateur] ?? 'pourcent' : null;
    return h('div', { class: `carte-critere niveau-${j?.palier?.niveau ?? niveauPts}` },
      h('div', { class: 'tete-critere' },
        h('span', { class: 'nom-critere' }, j?.libelle ?? c.libelle),
        h('span', { class: `points-critere niveau-${niveauPts}` }, h('strong', {}, String(c.valeur ?? 0)), ` / ${c.max} pts`)),
      j ? [
        h('div', { class: 'valeur-critere' }, h('strong', {}, fmt(j.valeur, format)), pastilleNiveau(j.palier)),
        jaugeNommee(j, format),
        j.en_clair ? h('p', { class: 'en-clair' }, h('strong', {}, 'En clair : '), interpoler(j.en_clair, v, resultat.formats)) : null,
      ] : h('p', { class: 'en-clair' }, c.libelle));
  });
  const autres = resultat.jauges.filter((j) => !j.critere);
  return [tete,
    h('div', { class: 'grille-criteres', 'data-bloc-pdf': '' }, cartes),
    autres.length ? h('div', { class: 'autres-indicateurs', 'data-bloc-pdf': '' },
      h('span', { class: 'titre-autres' }, 'Autres indicateurs'),
      autres.map((j) => h('span', { class: 'indicateur-ligne', title: j.en_clair ? interpoler(j.en_clair, v, resultat.formats) : null },
        pastilleNiveau(j.palier), h('strong', {}, `${j.libelle} : ${fmt(j.valeur, resultat.formats[j.indicateur] ?? 'pourcent')}`)))) : null];
}

/* ------------------------------------------------------------- 4. le plan */

function plan(resultat, etat, { pdf, surSimulation }) {
  const v = resultat.valeurs;
  const dette = v.dette_locative ?? 0;
  const q = resultat.qualification;
  const qualif = q ? h('div', { class: `qualification niveau-${q.niveau ?? 'neutre'}` },
    h('span', { class: 'barre-niveau', style: { background: couleurNiveau(q.niveau) }, 'aria-hidden': 'true' }),
    h('div', {}, pastilleNiveau({ niveau: q.niveau }, q.texte), h('p', {}, q.commentaire))) : null;
  if (dette <= 0) {
    return bloc({ id: 's-plan', numero: '4', question: 'Quel plan est réaliste ?', titre: 'Pas de dette locative à apurer', icone: 'calendrier' }, qualif);
  }
  const solde = v.solde_apres_dettes ?? 0;
  const conseillee = v.mensualite_conseillee ?? 0;
  const retenue = v.mensualite_retenue ?? 0;
  const mini = v.apurement_mini ?? 0;
  const maxi = v.apurement_maxi ?? 0;
  const cible = v.duree_max_plan;
  const pourCible = cible ? Math.ceil(dette / cible) : 0;
  const borne = Math.max(50, Math.ceil(Math.max(maxi * 2, pourCible * 1.15, retenue * 1.3, 0) / 50) * 50);
  const simule = (etat.mensualite_saisie ?? 0) > 0;

  // Le curseur recalcule la duree et le reste en direct ; relache, il
  // recalcule toute la synthese (qualification comprise).
  const valeur = h('span', { class: 'valeur-simulee' });
  const duree = h('strong');
  const dureeNote = h('small');
  const reste = h('strong');
  const maj = (m) => {
    const d = dureePour(dette, m);
    valeur.textContent = fmt(m);
    duree.textContent = d ? `${d} mois` : '—';
    const an = d && d >= 12 ? `${Math.floor(d / 12)} an${d >= 24 ? 's' : ''}${d % 12 ? ` et ${d % 12} mois` : ''} · ` : '';
    dureeNote.textContent = d ? `${an}cible ${cible ?? '—'} mois` : 'aucun remboursement';
    reste.textContent = fmt(solde - m);
    reste.classList.toggle('negatif', solde - m < 0);
  };
  maj(retenue);
  const pct = (x) => Math.max(0, Math.min(100, (x / borne) * 100));
  const curseur = pdf ? null : h('input', {
    type: 'range', min: 0, max: borne, step: 5, value: String(retenue), 'aria-label': 'Mensualité simulée',
    oninput: (e) => maj(Number(e.target.value)),
    onchange: (e) => { const m = Number(e.target.value); surSimulation?.(m === conseillee ? 0 : m); },
  });
  const simulateur = h('div', { class: 'simulateur' },
    h('div', { class: 'tete-simulateur' },
      h('div', {}, h('p', { class: 'etiquette' }, simule ? 'Mensualité simulée' : 'Mensualité proposée'), h('p', { class: 'ligne-valeur' }, valeur, h('span', { class: 'unite' }, '/ mois'))),
      h('div', { class: 'dette-rappel' }, h('span', {}, 'Dette locative'), h('strong', {}, fmt(dette)))),
    pdf ? null : h('div', { class: 'piste-curseur' },
      maxi > 0 ? h('span', { class: 'zone-capacite', style: { left: `${pct(mini)}%`, width: `${pct(maxi) - pct(mini)}%` } },
        h('span', {}, `Capacité estimée ${fmt(mini)} – ${fmt(maxi)}`)) : null,
      curseur,
      h('div', { class: 'graduations-curseur' }, [0, 0.25, 0.5, 0.75, 1].map((x) => h('span', { style: { left: `${x * 100}%` } }, fmt(borne * x))))),
    h('div', { class: 'tuiles-plan' },
      h('div', { class: 'tuile' }, h('span', { class: 'etiquette' }, 'Durée du plan'), duree, dureeNote),
      h('div', { class: 'tuile' }, h('span', { class: 'etiquette' }, 'Reste au ménage'), reste, h('small', {}, 'par mois, une fois la mensualité payée'))),
    conseillee > 0 && conseillee < mini ? h('p', { class: 'avertissement' }, icone('alerte'),
      h('span', {}, `La mensualité proposée par le barème (${fmt(conseillee)}) est en dessous de la capacité estimée (${fmt(mini)} – ${fmt(maxi)}) : la correction selon le reste à vivre l’a abaissée.`)) : null,
    simule && !pdf ? h('button', { type: 'button', class: 'bouton-discret', onclick: () => surSimulation?.(0) }, 'Revenir à la mensualité proposée') : null,
    simule && pdf ? h('p', { class: 'note' }, `Mensualité simulée par le conseiller ; le barème proposait ${fmt(conseillee)}.`) : null);

  const liste = [];
  if (conseillee > 0) liste.push({ titre: `${fmt(conseillee)} / mois`, sous: 'proposition du barème', duree: dureePour(dette, conseillee), couleur: 'var(--cat-4)', m: conseillee });
  if (maxi > conseillee) liste.push({ titre: `${fmt(maxi)} / mois`, sous: 'haut de la capacité', duree: dureePour(dette, maxi), couleur: 'var(--cat-1)', m: maxi });
  if (pourCible > 0 && cible && !liste.some((s) => s.m === pourCible)) liste.push({ titre: `${fmt(pourCible)} / mois`, sous: `pour tenir ${cible} mois`, duree: dureePour(dette, pourCible), couleur: 'var(--cat-3)', m: pourCible });
  if (simule && !liste.some((s) => s.m === retenue)) liste.push({ titre: `${fmt(retenue)} / mois`, sous: 'mensualité simulée', duree: dureePour(dette, retenue), couleur: 'var(--accent)', m: retenue });
  for (const s of liste) s.actif = s.m === retenue;
  const resteCible = solde - pourCible;
  return bloc({ id: 's-plan', numero: '4', question: 'Quel plan est réaliste ?', titre: 'Quelle mensualité est tenable, et en combien de temps ?', icone: 'calendrier' },
    h('div', { class: 'grille-plan' },
      simulateur,
      h('div', { class: 'comparaison' },
        h('p', { class: 'etiquette' }, 'Scénarios comparés · durée en mois'),
        liste.length ? scenarios(liste, cible) : h('p', { class: 'note' }, 'Aucun scénario de remboursement possible en l’état.'),
        pourCible > 0 && cible ? h('p', { class: 'note' }, `À ${fmt(pourCible)} par mois, il resterait ${fmt(resteCible)} au ménage${resteCible < 0 ? ' : ce plan n’est pas tenable sans aide' : ''}.`) : null)),
    qualif);
}

/* ------------------------------------------------- 5. ce qu'on peut faire */

const FAMILLE = { accompagnement: { icone: 'coeur', ton: 'dossier' }, logement: { icone: 'maison', ton: 'sortie' }, budget: { icone: 'portefeuille', ton: 'entree' } };

function actions(resultat, etat, { pdf }) {
  const ecartes = etat.ui?.leviersEcartes ?? new Set();
  const leviers = pdf ? resultat.leviersRetenus.filter((l) => !ecartes.has(l.id)) : resultat.leviersRetenus;
  return h('div', { class: 'duo-actions', id: 's-leviers', 'data-bloc-pdf': '' },
    bloc({ numero: '5', question: 'Que peut-on faire ?', titre: 'Ce qui alerte', icone: 'alerte', ton: resultat.points.length ? 'vigilance' : 'entree' },
      resultat.points.length
        ? h('ul', { class: 'points' }, resultat.points.map((p) => h('li', {}, h('span', { class: 'puce-alerte' }, icone('alerte')), h('span', {}, p.texte))))
        : h('p', { class: 'rien-a-signaler' }, icone('ok'), 'Aucun point d’attention relevé.')),
    bloc({ titre: pdf ? 'Leviers retenus' : 'Ce qu’on peut actionner', icone: 'etincelle' },
      leviers.length ? h('ol', { class: 'leviers' }, leviers.map((l, n) => {
        const fam = FAMILLE[String(l.famille ?? '').toLowerCase()] ?? { icone: 'etincelle', ton: 'dossier' };
        const libelle = h('span', {}, ecartes.has(l.id) ? 'Retenir' : 'Retenu');
        const carte = h('li', { class: `levier${ecartes.has(l.id) ? ' ecarte' : ''}${n === 0 ? ' premier' : ''}` },
          h('span', { class: 'rang', 'aria-hidden': 'true' }, String(n + 1)),
          h('span', { class: `medaillon petit m-${fam.ton}` }, dessinIcone(fam.icone)),
          h('div', { class: 'levier-corps' },
            h('div', { class: 'levier-tete' }, h('strong', {}, l.texte), l.famille ? h('span', { class: 'jeton' }, l.famille) : null),
            l.description ? h('p', {}, l.description) : null),
          pdf ? null : h('label', { class: 'retenir' },
            h('input', {
              type: 'checkbox', checked: !ecartes.has(l.id), 'aria-label': `Retenir le levier ${l.texte}`,
              onchange: (e) => {
                if (!etat.ui) return;
                etat.ui.leviersEcartes ??= new Set();
                if (e.target.checked) etat.ui.leviersEcartes.delete(l.id); else etat.ui.leviersEcartes.add(l.id);
                carte.classList.toggle('ecarte', !e.target.checked);
                libelle.textContent = e.target.checked ? 'Retenu' : 'Retenir';
              },
            }), libelle));
        return carte;
      })) : h('p', { class: 'rien-a-signaler' }, icone('ok'), pdf ? 'Aucun levier retenu.' : 'Aucun levier particulier n’est déclenché.'),
      !pdf && leviers.length ? h('p', { class: 'note' }, 'Seuls les leviers retenus figurent dans le PDF.') : null));
}

/* ---------------------------------------------------------------- rendu */

export function rendreSynthese(racine, { config, resultat, etat, mode = 'ecran', animer = true, surSimulation }) {
  const pdf = mode === 'pdf';
  const blocs = [];
  if (pdf) {
    const id = identite(config, etat);
    blocs.push(h('section', { class: 'entete-pdf', 'data-bloc-pdf': '' },
      h('div', { class: 'titre-pdf' },
        h('div', {}, h('p', { class: 'surtitre' }, config.meta.sous_titre), h('h2', {}, 'Synthèse du diagnostic budgétaire')),
        h('p', { class: 'date-pdf' }, `Édité le ${new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}`)),
      id.length ? h('dl', { class: 'paire identite' }, id.map((x) => [h('dt', {}, x.libelle), h('dd', {}, x.valeur)])) : h('p', { class: 'note' }, 'Dossier non nominatif.')));
  }
  blocs.push(bilan(config, resultat, etat, animer));
  blocs.push(budget(config, resultat, animer));
  blocs.push(...score(config, resultat, animer));
  blocs.push(plan(resultat, etat, { pdf, surSimulation }));
  blocs.push(actions(resultat, etat, { pdf }));
  if (pdf) blocs.push(...detailSaisie(config, etat));
  else blocs.push(detailCalculs(config, resultat));
  vider(racine, blocs.filter(Boolean));
  if (animer) cascade(racine.children);
}

function detailCalculs(config, resultat) {
  const groupes = new Map();
  for (const i of config.indicateurs) {
    if (!groupes.has(i.groupe ?? 'Autres')) groupes.set(i.groupe ?? 'Autres', []);
    groupes.get(i.groupe ?? 'Autres').push(i);
  }
  return h('details', { class: 'carte detail-calculs', id: 's-detail' },
    h('summary', {}, h('span', {}, 'Détail des calculs'), h('small', {}, 'Replié, pour qui veut vérifier : chaque indicateur, sa formule et sa valeur')),
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
  return [h('section', { class: 'carte bloc-synthese detail-saisie', 'data-bloc-pdf': '' },
    h('header', {}, h('span', { class: 'medaillon m-dossier' }, dessinIcone('document')), h('div', { class: 'titres' }, h('h3', {}, 'Détail de la saisie'), h('p', {}, 'Lignes renseignées, montants mensuels'))),
    h('div', { class: 'corps colonnes-detail' }, lignes.map((l) => h('div', { class: 'groupe-detail' },
      h('h4', {}, l.titre),
      h('dl', { class: 'paire' }, l.items.map(([a, b]) => [h('dt', {}, a), h('dd', {}, b)]))))))];
}

export { echapper };
