/* ===========================================================================
   La page de saisie, construite entierement depuis le parametrage : ajouter
   une ligne de depense dans l'admin la fait apparaitre ici, sans code.

   Six etapes qui se deplient sur place (dossier, situation,
   dettes, ressources, charges, depenses). Une etape regroupe une ou deux
   sections du parametrage (« sur la meme ligne que la precedente »), ses
   sous-parties, cote a cote. Fermee, elle resume chaque sous-partie
   (« Foyer 2 adultes · 1 enfant », « 410 € ») ; « Etape terminee » ouvre
   la suivante.

   Pour alleger les listes de budget, seuls les postes « affiches d'office »
   (reglage de l'admin) et les postes renseignes sont visibles ; les autres
   s'ajoutent d'un clic. Un champ vide affiche « — » : on distingue « pas
   encore saisi » de « 0 € declare ».

   Confort : frequence (semaine, mois, trimestre, an) convertie en mensuel,
   additions dans un champ (« 25+12+8 »), Entree pour passer au suivant.
   =========================================================================== */

import { h, icone, vider, svg } from './dom.js?v=743faf48c0';
import { formater } from './format.js?v=743faf48c0';
import { signaler, apparaitre } from './animations.js?v=743faf48c0';
import { dessinIcone, nomIcone } from './icones.js?v=743faf48c0';
import { jaugeZones, pastilleNiveau } from './graphiques.js?v=743faf48c0';

const FREQUENCES = [
  { id: 'sem', libelle: 'Sem.', titre: 'par semaine', vers: (x) => (x * 52) / 12 },
  { id: 'mois', libelle: 'Mois', titre: 'par mois', vers: (x) => x },
  { id: 'trim', libelle: 'Trim.', titre: 'par trimestre', vers: (x) => x / 3 },
  { id: 'an', libelle: 'An', titre: 'par an', vers: (x) => x / 12 },
];
const SILHOUETTES_MAX = 10;
const MOIS_COURTS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

export function etatVide() {
  return {
    valeurs: {},
    dettes: [],
    mensualite_saisie: 0,
    // L'etat de l'interface : il ne sert qu'a l'affichage, jamais au calcul.
    ui: { terminees: new Set(), ajoutees: new Set(), frequences: {}, bruts: {} },
  };
}

/* Montant tape a la francaise : « 1 250,50 » ou « 1250.5 ». */
export function lireMontant(s) {
  const t = String(s ?? '').replace(/[\s €]/g, '').replace(',', '.');
  if (t === '') return '';
  const n = Number(t);
  return Number.isFinite(n) ? n : '';
}

/* Une petite addition tapee dans un champ : « 25+12+8 », « 1 200 - 150 ».
   Rien d'autre n'est accepte (pas de multiplication, pas de formule). */
export function lireExpression(s) {
  const t = String(s ?? '').replace(/[\s €]/g, '').replace(/,/g, '.');
  if (t === '') return '';
  if (!/^[+-]?\d+(\.\d+)?([+-]\d+(\.\d+)?)*$/.test(t)) return null;
  const n = (t.match(/[+-]?\d+(\.\d+)?/g) ?? []).reduce((s2, x) => s2 + Number(x), 0);
  return Math.round(n * 100) / 100;
}

const afficherMontant = (v) => (v === '' || v === undefined || v === null ? '' : String(v).replace('.', ','));
const renseigne = (v) => v !== '' && v !== undefined && v !== null && v !== 0;
const nombreOuVide = (v) => (v === '' || v === undefined || v === null ? null : Number(v));
const pluriel = (n, un, plusieurs) => `${formater(n, 'nombre')} ${n > 1 ? plusieurs : un}`;

/* L'ordre du parcours : celui du parametrage. */
export function sectionsParcours(config) {
  return [...config.sections];
}

/* Les etapes : une section marquee « avec_precedente » rejoint l'etape de
   la precedente (deux sous-parties au plus), par proximite de theme. */
export function rangees(config) {
  const lignes = [];
  for (const s of config.sections) {
    const derniere = lignes[lignes.length - 1];
    if (s.avec_precedente && derniere && derniere.length < 2) derniere.push(s);
    else lignes.push([s]);
  }
  return lignes;
}

/* Ce qu'une section a de rempli. */
export function avancement(section, etat) {
  if (section.type === 'dettes') {
    const n = etat.dettes.filter((d) => d.type || renseigne(d.montant) || renseigne(d.mensualite)).length;
    return { remplis: n, total: null };
  }
  const champs = section.champs ?? [];
  return { remplis: champs.filter((c) => renseigne(etat.valeurs[c.id])).length, total: champs.length };
}

/* Une section est faite si on l'a dite terminee, ou si elle a au moins une valeur. */
export function estFaite(section, etat) {
  return etat.ui.terminees.has(section.id) || avancement(section, etat).remplis > 0;
}

export function progression(config, etat) {
  const etapes = rangees(config).map((r) => r.filter((s) => !s.nominatif)).filter((r) => r.length);
  const faites = etapes.filter((r) => r.every((s) => estFaite(s, etat))).length;
  return { faites, total: etapes.length, complet: faites === etapes.length && etapes.length > 0 };
}

export function creerSaisie({ config, racine, etat, prerempli, surChangement, surOuverture }) {
  const ui = etat.ui;
  const formats = Object.fromEntries(config.indicateurs.map((i) => [i.id, i.format]));
  const marques = new Set((prerempli?.appliques ?? []).map((c) => c.id));
  const volets = new Map();      // id -> { section, ton, detail, montantDetail, marque }
  const aRafraichir = [];        // fonctions (resultat) => void
  let dernierResultat = null;

  const marqueLien = (c) => (marques.has(c.id) ? h('span', { class: 'jeton petrole mini', title: 'Valeur reçue du lien' }, 'lien') : null);

  /* ----------------------------------------------------------- champs montant */

  function champMontant(c, { surEntree } = {}) {
    const id = `champ-${c.id}`;
    const freq = () => ui.frequences[c.id] ?? 'mois';
    const bulle = h('span', { class: 'bulle-calcul', role: 'status', hidden: true });
    const conversion = h('small', { class: 'conversion', hidden: true });
    const valeurAffichee = () => (freq() === 'mois' ? afficherMontant(etat.valeurs[c.id]) : afficherMontant(ui.bruts[c.id]));
    const champ = h('input', {
      id, name: c.id, autocomplete: 'off', type: 'text', inputmode: 'decimal', value: valeurAffichee(), placeholder: '—',
      class: marques.has(c.id) ? 'prerempli' : null, 'aria-describedby': c.aide ? `${id}-aide` : null,
    });
    const appliquer = (brut) => {
      const n = lireExpression(brut);
      champ.toggleAttribute('aria-invalid', n === null);
      if (n === null) return false;
      const f = FREQUENCES.find((x) => x.id === freq());
      ui.bruts[c.id] = n;
      etat.valeurs[c.id] = n === '' ? '' : Math.round(f.vers(n) * 100) / 100;
      majConversion();
      surChangement();
      return true;
    };
    const majConversion = () => {
      const f = freq();
      const brut = ui.bruts[c.id];
      conversion.hidden = f === 'mois' || brut === '' || brut === undefined;
      conversion.textContent = conversion.hidden ? '' : `= ${formater(etat.valeurs[c.id], 'euro')} / mois`;
    };
    champ.addEventListener('input', () => {
      champ.classList.remove('prerempli');
      const t = champ.value;
      if (/\d\s*[+-]\s*\d/.test(t.replace(/^\s*-/, ''))) {
        const n = lireExpression(t);
        bulle.hidden = false;
        vider(bulle, n === null ? 'Calcul illisible' : [h('strong', {}, `= ${formater(n, 'euro')}`), ' · ', h('kbd', {}, 'Entrée'), ' pour valider']);
        if (n !== null) appliquer(t);
        return;
      }
      bulle.hidden = true;
      appliquer(t);
    });
    const valider = () => {
      bulle.hidden = true;
      if (!champ.hasAttribute('aria-invalid')) champ.value = valeurAffichee();
    };
    champ.addEventListener('blur', valider);
    champ.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      valider();
      surEntree?.(champ);
    });
    majConversion();

    const frequences = h('span', { class: 'frequences', role: 'group', 'aria-label': `Fréquence : ${c.libelle}` },
      FREQUENCES.map((f) => h('button', {
        type: 'button', title: `Montant ${f.titre}`, 'aria-pressed': String(freq() === f.id),
        onclick: (e) => {
          ui.frequences[c.id] = f.id;
          for (const b of e.currentTarget.parentElement.children) b.setAttribute('aria-pressed', String(b === e.currentTarget));
          ligneParent(champ)?.classList.toggle('freq-active', f.id !== 'mois');
          // Le montant tape reste, il change seulement d'unite.
          appliquer(champ.value);
          champ.focus();
        },
      }, f.libelle)));

    return {
      champ, frequences, conversion, bulle,
      bloc: h('span', { class: 'saisie-montant' }, h('span', { class: 'saisie-nombre euro' }, champ), bulle),
      vider() { champ.value = ''; ui.bruts[c.id] = ''; etat.valeurs[c.id] = ''; majConversion(); },
    };
  }

  const ligneParent = (el) => el.closest('.ligne');

  /* Entree passe au champ suivant de la section, puis au bouton « terminee ». */
  function suivant(champ) {
    const volet = champ.closest('.volet');
    const champs = [...volet.querySelectorAll('.volet-corps input:not([type="checkbox"])')].filter((x) => x.offsetParent !== null);
    const i = champs.indexOf(champ);
    (champs[i + 1] ?? volet.querySelector('.terminer'))?.focus();
  }

  /* ----------------------------------------------------- sections a champs */

  function compteur(c) {
    const id = `champ-${c.id}`;
    const champ = h('input', {
      id, name: c.id, autocomplete: 'off', type: 'text', inputmode: 'numeric', value: afficherMontant(etat.valeurs[c.id]), placeholder: '0',
      class: marques.has(c.id) ? 'prerempli' : null,
      oninput: (e) => {
        const n = lireMontant(e.target.value);
        e.target.toggleAttribute('aria-invalid', e.target.value.trim() !== '' && n === '');
        etat.valeurs[c.id] = n === '' ? '' : Math.max(0, Math.round(n));
        e.target.classList.remove('prerempli');
        surChangement();
      },
      onkeydown: (e) => { if (e.key === 'Enter') { e.preventDefault(); suivant(e.target); } },
    });
    const pas = (d) => {
      const n = Math.max(0, (Number(etat.valeurs[c.id]) || 0) + d);
      etat.valeurs[c.id] = n;
      champ.value = String(n);
      champ.classList.remove('prerempli');
      champ.removeAttribute('aria-invalid');
      surChangement();
    };
    return h('div', { class: 'boite-compteur' },
      h('label', { for: id }, h('span', { class: 'texte-label' }, c.libelle), marqueLien(c)),
      h('span', { class: 'compteur' },
        h('button', { type: 'button', class: 'pas moins', 'aria-label': `Retirer une personne : ${c.libelle}`, onclick: () => pas(-1) }, icone('moins')),
        champ,
        h('button', { type: 'button', class: 'pas plus', 'aria-label': `Ajouter une personne : ${c.libelle}`, onclick: () => pas(1) }, icone('plus'))));
  }

  function champSimple(c, section) {
    const id = `champ-${c.id}`;
    let saisie;
    if (c.type === 'texte' || c.type === 'date') {
      const champ = h('input', {
        id, name: c.id, autocomplete: 'off', type: c.type === 'date' ? 'date' : 'text', value: etat.valeurs[c.id] ?? '',
        placeholder: c.type === 'date' ? null : (section.nominatif ? 'Facultatif' : ''),
        oninput: (e) => { etat.valeurs[c.id] = e.target.value; surChangement(); },
        onkeydown: (e) => { if (e.key === 'Enter') { e.preventDefault(); suivant(e.target); } },
      });
      saisie = h('span', { class: 'saisie-icone' }, dessinIcone(nomIcone(c, 'document')), champ);
      if (c.type === 'date') {
        saisie = h('span', { class: 'saisie-date' }, saisie, h('button', {
          type: 'button', class: 'bouton-discret', onclick: () => {
            champ.value = new Date().toISOString().slice(0, 10);
            etat.valeurs[c.id] = champ.value;
            surChangement();
          },
        }, 'Aujourd’hui'));
      }
    } else {
      const m = champMontant(c, { surEntree: suivant });
      saisie = h('span', { class: 'saisie-icone' }, dessinIcone(nomIcone(c)), m.bloc);
    }
    return h('div', { class: `champ champ-${c.type}` },
      h('label', { for: id }, h('span', { class: 'texte-label' }, c.libelle), marqueLien(c)),
      saisie,
      c.aide ? h('small', { id: `${id}-aide`, class: 'aide' }, c.aide) : null);
  }

  /* Le foyer se dessine : une silhouette pleine par personne, une en
     pointilles pour inviter a completer. */
  function silhouette(classe, taille) {
    const s = taille;
    return svg('svg', { viewBox: '0 0 40 56', width: 40 * s, height: 56 * s, class: `silhouette ${classe}`, 'aria-hidden': 'true' },
      svg('circle', { cx: 20, cy: 12, r: 10 }),
      svg('path', { d: 'M4 54v-14a16 16 0 0 1 32 0v14Z' }));
  }

  function visuelFoyer(section) {
    const scene = h('div', { class: 'scene-foyer', 'aria-hidden': 'true' });
    const total = h('p', { class: 'total-foyer' });
    aRafraichir.push(() => {
      const morceaux = [];
      let n = 0;
      (section.champs ?? []).forEach((c, i) => {
        const k = Math.max(0, Math.round(Number(etat.valeurs[c.id]) || 0));
        for (let j = 0; j < k && n < SILHOUETTES_MAX; j++, n++) morceaux.push(silhouette(`membre m${Math.min(i, 2)}`, i === 0 ? 1 : i === 1 ? 0.72 : 0.86));
      });
      const reel = (section.champs ?? []).reduce((t, c) => t + Math.max(0, Math.round(Number(etat.valeurs[c.id]) || 0)), 0);
      morceaux.push(silhouette('fantome', 0.86));
      const cle = (section.champs ?? []).map((c) => etat.valeurs[c.id]).join(',');
      if (scene.dataset.cle !== cle) { scene.dataset.cle = cle; vider(scene, morceaux); }
      total.textContent = reel ? `${pluriel(reel, 'personne', 'personnes')} dans le foyer${reel > SILHOUETTES_MAX ? ` (${SILHOUETTES_MAX} dessinées)` : ''}` : 'Ajoutez les membres du foyer avec les boutons +';
    });
    return h('div', { class: 'visuel-foyer' }, scene, total);
  }

  /* Le loyer residuel s'ecrit comme une equation, et le taux d'effort se
     situe aussitot sur sa jauge. */
  function visuelLogement() {
    const ids = new Set(config.indicateurs.map((i) => i.id));
    if (!ids.has('loyer_residuel')) return null;
    const brut = h('strong'); const aide = h('strong'); const reste = h('strong');
    const jauge = config.jauges?.find((j) => j.indicateur === 'taux_effort_logement');
    const zoneJauge = h('div', { class: 'jauge-logement' });
    aRafraichir.push((r) => {
      const v = r.valeurs;
      brut.textContent = formater((v.loyer ?? 0) + (v.charges ?? 0), 'euro');
      aide.textContent = formater(v.apl ?? 0, 'euro');
      reste.textContent = formater(v.loyer_residuel, 'euro');
      if (jauge) {
        const j = r.jauges.find((x) => x.indicateur === jauge.indicateur);
        vider(zoneJauge,
          h('div', { class: 'tete-jauge-logement' }, h('span', {}, jauge.libelle),
            j?.valeur === null || j?.valeur === undefined ? h('span', { class: 'discret' }, 'renseignez les ressources') : h('span', { class: 'valeur-jauge' }, formater(j.valeur, formats[jauge.indicateur] ?? 'pourcent'), ' ', pastilleNiveau(j.palier))),
          jaugeZones({ ...jauge, valeur: j?.valeur, format: formats[jauge.indicateur] ?? 'pourcent' }, { animer: false }));
      }
    });
    return h('div', { class: 'visuel-logement' },
      h('div', { class: 'equation-loyer' },
        h('div', { class: 'terme' }, h('span', {}, 'Loyer + charges'), brut),
        h('span', { class: 'operateur', 'aria-hidden': 'true' }, '−'),
        h('div', { class: 'terme aide' }, h('span', {}, 'APL'), aide),
        h('span', { class: 'operateur', 'aria-hidden': 'true' }, '='),
        h('div', { class: 'terme resultat' }, h('span', {}, 'Reste à payer'), reste)),
      jauge ? zoneJauge : null);
  }

  /* Les mois d'impayes deviennent une frise, du plus ancien au mois en cours. */
  function visuelDette() {
    const ids = new Set(config.indicateurs.map((i) => i.id));
    if (!ids.has('mois_impayes')) return null;
    const frise = h('div', { class: 'frise-mois', role: 'img' });
    const equivalent = h('strong');
    const alerte = h('p', { class: 'alerte-dette', hidden: true });
    aRafraichir.push((r) => {
      const m = r.valeurs.mois_impayes;
      const n = m && m > 0 ? Math.min(12, Math.ceil(m - 1e-9)) : 0;
      const cases = Math.max(6, n + 1);
      const auj = new Date();
      vider(frise, Array.from({ length: cases }, (_, i) => {
        const recul = cases - 1 - i;
        const d = new Date(auj.getFullYear(), auj.getMonth() - recul, 1);
        const etatCase = recul === 0 ? 'encours' : recul <= n ? 'impaye' : 'paye';
        return h('div', { class: `case-mois ${etatCase}` },
          h('span', { class: 'marque' }, etatCase === 'encours' ? '?' : etatCase === 'impaye' ? '!' : icone('ok')),
          h('span', { class: 'mois' }, MOIS_COURTS[d.getMonth()]));
      }));
      frise.setAttribute('aria-label', n ? `${n} mois d'impayés jusqu'au mois dernier` : 'Aucun mois d’impayé');
      equivalent.textContent = m ? `≈ ${formater(m, 'decimal')} mois de loyer` : '—';
      const seuil = r.valeurs.seuil_dette_mois;
      alerte.hidden = !(m && seuil && m > seuil);
      vider(alerte, icone('alerte'), `Plus de ${formater(seuil, 'nombre')} mois d’impayés : piste FSL à étudier.`);
    });
    return { frise, equivalent: h('div', { class: 'carte-equivalent' }, h('span', {}, 'Soit environ'), equivalent), alerte };
  }

  /* -------------------------------------------------- sections budgetaires */

  function sectionBudget(section) {
    const lignes = h('div', { class: 'lignes-budget' });
    const puces = h('div', { class: 'ajouts' });
    const essentiel = (c) => c.essentiel || renseigne(etat.valeurs[c.id]) || ui.ajoutees.has(c.id) || marques.has(c.id);
    const montants = new Map();

    const ligne = (c) => {
      const m = champMontant(c, { surEntree: suivant });
      montants.set(c.id, m);
      const el = h('div', { class: `ligne${(ui.frequences[c.id] ?? 'mois') !== 'mois' ? ' freq-active' : ''}`, 'data-champ': c.id },
        h('label', { for: `champ-${c.id}` },
          h('span', { class: 'puce-icone' }, dessinIcone(nomIcone(c))),
          h('span', { class: 'texte-label' }, c.libelle), marqueLien(c)),
        m.bloc,
        h('button', {
          type: 'button', class: 'bouton-icone retirer', title: 'Retirer ce poste', 'aria-label': `Retirer ${c.libelle}`,
          onclick: () => {
            m.vider();
            ui.ajoutees.delete(c.id);
            if (!c.essentiel) el.hidden = true;
            dessinerPuces();
            surChangement();
            el.querySelector('input').focus();
          },
        }, icone('croix')),
        h('div', { class: 'sous-ligne' }, m.frequences, m.conversion),
        c.aide ? h('small', { id: `champ-${c.id}-aide`, class: 'aide' }, c.aide) : null);
      el.hidden = !essentiel(c);
      return el;
    };

    const dessinerPuces = () => {
      const caches = (section.champs ?? []).filter((c) => lignes.querySelector(`[data-champ="${c.id}"]`)?.hidden);
      vider(puces, caches.length ? [
        h('p', { class: 'titre-ajouts' }, 'Ajouter un poste'),
        h('div', { class: 'puces' }, caches.map((c) => h('button', {
          type: 'button', class: 'puce-ajout',
          onclick: () => {
            ui.ajoutees.add(c.id);
            const el = lignes.querySelector(`[data-champ="${c.id}"]`);
            el.hidden = false;
            apparaitre(el);
            dessinerPuces();
            el.querySelector('input').focus();
          },
        }, icone('plus'), c.libelle))),
      ] : null);
    };

    vider(lignes,
      (section.lignes_calculees ?? []).map((l) => {
        const valeur = h('output', { class: 'valeur-calculee' }, '—');
        aRafraichir.push((r) => { valeur.textContent = formater(r.valeurs[l.variable], formats[l.variable] ?? 'euro'); });
        return h('div', { class: 'ligne calculee' },
          h('span', { class: 'etiquette-calcul' }, h('span', { class: 'puce-icone' }, dessinIcone(nomIcone(l, 'calculette'))), h('span', { class: 'texte-label' }, l.libelle)),
          valeur);
      }),
      (section.champs ?? []).map(ligne));
    dessinerPuces();
    aRafraichir.push(() => {
      for (const [id, m] of montants) ligneParent(m.champ)?.classList.toggle('rempli', renseigne(etat.valeurs[id]));
    });
    return h('div', { class: 'corps-budget' }, lignes, puces);
  }

  /* --------------------------------------------------------- dettes en cours */

  function sectionDettes(section) {
    const zone = h('div', { class: 'zone-dettes' });
    const dessiner = () => {
      const lignes = etat.dettes;
      if (!lignes.length) {
        vider(zone, h('div', { class: 'question-dettes' },
          h('span', { class: 'medaillon m-sortie' }, dessinIcone('carte_bancaire')),
          h('p', { class: 'question' }, 'Le ménage a-t-il d’autres dettes ?'),
          h('p', { class: 'note' }, section.description ?? 'Dettes familiales, découverts, plans de remboursement…'),
          h('div', { class: 'actions-ligne' },
            h('button', { type: 'button', class: 'bouton second', onclick: () => { terminer(section.id); } }, icone('ok'), 'Non, aucune'),
            h('button', { type: 'button', class: 'bouton', onclick: () => { etat.dettes.push({ type: '', montant: '', mensualite: '', echeance: '' }); dessiner(); zone.querySelector('input')?.focus(); } }, icone('plus'), 'Ajouter une dette'))));
        return;
      }
      vider(zone,
        lignes.map((d, n) => {
          const champ = (k, libelle, montant, place) => {
            const input = h('input', {
              type: 'text', value: montant ? afficherMontant(d[k]) : d[k], 'aria-label': `${libelle}, dette ${n + 1}`,
              inputmode: montant ? 'decimal' : null, placeholder: place,
              oninput: (e) => { d[k] = montant ? (lireExpression(e.target.value) ?? '') : e.target.value; majDuree(); surChangement(); },
              onkeydown: (e) => { if (e.key === 'Enter') { e.preventDefault(); suivant(e.target); } },
            });
            return h('label', { class: 'champ-dette' }, h('span', {}, libelle), montant ? h('span', { class: 'saisie-nombre euro' }, input) : input);
          };
          const duree = h('small', { class: 'duree-dette' });
          const majDuree = () => {
            const mt = Number(d.montant) || 0; const me = Number(d.mensualite) || 0;
            duree.textContent = mt && me ? `≈ ${Math.ceil(mt / me)} mois de remboursement restants` : '';
          };
          majDuree();
          return h('div', { class: 'carte-dette' },
            h('span', { class: 'medaillon petit m-sortie' }, dessinIcone('carte_bancaire')),
            h('div', { class: 'champs-dette' },
              champ('type', 'Type de dette', false, 'Ex. découvert bancaire'),
              champ('montant', 'Reste dû', true, '—'),
              champ('mensualite', 'Mensualité', true, '—'),
              champ('echeance', 'Fin prévue', false, 'mm/aaaa'),
              duree),
            h('button', {
              type: 'button', class: 'bouton-icone retirer', 'aria-label': `Retirer la dette ${n + 1}`, title: 'Retirer cette dette',
              onclick: () => { etat.dettes.splice(n, 1); dessiner(); surChangement(); },
            }, icone('croix')));
        }),
        h('button', {
          type: 'button', class: 'bouton-discret ajout',
          onclick: () => { etat.dettes.push({ type: '', montant: '', mensualite: '', echeance: '' }); dessiner(); zone.querySelector('.carte-dette:last-of-type input')?.focus(); },
        }, icone('plus'), 'Ajouter une dette'));
    };
    dessiner();
    return zone;
  }

  /* ------------------------------------------------------------- les volets */

  function resume(section, r) {
    const v = r.valeurs;
    if (section.nominatif) {
      const remplis = (section.champs ?? []).filter((c) => renseigne(etat.valeurs[c.id]));
      return remplis.length ? remplis.slice(0, 3).map((c) => etat.valeurs[c.id]).join(' · ') : 'Nom, référence, adresse, conseiller… uniquement pour le PDF';
    }
    if (section.type === 'dettes') {
      const n = avancement(section, etat).remplis;
      if (!n) return ui.terminees.has(section.id) ? 'Aucune autre dette' : 'Pas encore renseigné';
      return `${pluriel(n, 'dette', 'dettes')} · ${formater(v.dettes_mensualites, 'euro')} par mois`;
    }
    const remplis = (section.champs ?? []).filter((c) => renseigne(etat.valeurs[c.id]));
    if (section.type === 'budget') {
      if (!remplis.length) return ui.terminees.has(section.id) ? 'Rien à déclarer' : 'Pas encore renseigné';
      const noms = remplis.map((c) => c.libelle.replace(/\s*\(.*\)\s*/, ''));
      return `${noms.slice(0, 5).join(' · ')}${noms.length > 5 ? ` · +${noms.length - 5}` : ''}`;
    }
    if (!remplis.length) return ui.terminees.has(section.id) ? 'Rien à déclarer' : 'Pas encore renseigné';
    if ((section.champs ?? []).every((c) => c.type === 'nombre')) {
      return remplis.map((c) => `${formater(Number(etat.valeurs[c.id]), 'nombre')} × ${c.libelle.toLowerCase()}`).join(' · ');
    }
    // Les valeurs calculees qui ne sont pas des montants (mois d'impayes...) completent le resume.
    const calculs = (section.lignes_calculees ?? []).filter((l) => (formats[l.variable] ?? 'euro') !== 'euro' && renseigne(v[l.variable]))
      .map((l) => `≈ ${formater(v[l.variable], formats[l.variable] === 'mois' ? 'decimal' : formats[l.variable])} ${l.libelle.replace(/^nombre de /i, '').toLowerCase()}`);
    // Un montant seul est deja affiche a droite de la tuile : inutile de le repeter.
    const seul = (section.champs ?? []).filter((c) => c.type === 'montant').length === 1 && calculs.length;
    return [...remplis.filter((c) => !(seul && c.type === 'montant')).map((c) => `${c.libelle} ${formater(Number(etat.valeurs[c.id]), c.type === 'montant' ? 'euro' : 'nombre')}`), ...calculs].join(' · ');
  }

  function montantVolet(section, r) {
    const v = r.valeurs;
    if (section.type === 'budget') return formater(v[section.total || `somme_${section.id}`], 'euro');
    if (section.type === 'dettes') return renseigne(v.dettes_mensualites) ? `${formater(v.dettes_mensualites, 'euro')}/mois` : '';
    const l = (section.lignes_calculees ?? []).find((x) => (formats[x.variable] ?? 'euro') === 'euro');
    if (l && avancement(section, etat).remplis) return formater(v[l.variable], 'euro');
    if ((section.champs ?? []).some((c) => c.type === 'montant') && avancement(section, etat).remplis) {
      const c = section.champs.find((x) => x.type === 'montant' && renseigne(etat.valeurs[x.id]));
      return c ? formater(Number(etat.valeurs[c.id]), 'euro') : '';
    }
    return '';
  }

  /* Une sous-partie = une section du parametrage. Elle vit dans une etape
     (bloc) : seule, ou a deux quand les sections se ressemblent. */
  function volet(section, seule) {
    const ton = section.colonne === 'budget' ? (section.id === 'ressources' ? 'entree' : 'sortie') : 'dossier';
    let contenu;
    let visuel = null;
    let note = null;
    if (section.type === 'dettes') contenu = sectionDettes(section);
    else if (section.type === 'budget') {
      contenu = sectionBudget(section);
      note = 'Postes non ajoutés = non concernés';
    } else if ((section.champs ?? []).length && section.champs.every((c) => c.type === 'nombre')) {
      visuel = visuelFoyer(section);
      contenu = h('div', { class: 'grille-compteurs' }, section.champs.map(compteur));
    } else {
      const champs = h('div', { class: 'grille-champs' }, (section.champs ?? []).map((c) => champSimple(c, section)),
        section.id !== 'logement' && section.id !== 'dette' ? (section.lignes_calculees ?? []).map((l) => {
          const valeur = h('output', { class: 'valeur-calculee' }, '—');
          aRafraichir.push((r) => { valeur.textContent = formater(r.valeurs[l.variable], formats[l.variable] ?? 'euro'); });
          return h('div', { class: 'champ calcule' }, h('span', { class: 'etiquette-calcul' }, l.libelle), valeur);
        }) : null);
      if (section.id === 'logement') visuel = visuelLogement();
      if (section.id === 'dette') {
        const d = visuelDette();
        if (d) contenu = h('div', { class: 'pile-dette' }, d.frise, h('div', { class: 'duo-dette' }, champs, d.equivalent), d.alerte);
      }
      contenu ??= champs;
      if (section.nominatif) contenu = h('div', {}, h('p', { class: 'note-cadenas' }, icone('alerte'), 'Jamais conservé, jamais transmis dans un lien : ces informations servent uniquement à l’en-tête du PDF.'), contenu);
    }

    const montantDetail = h('span', { class: 'montant-volet' });
    const marque = h('span', { class: 'marque-sous' });
    const description = section.description && section.type !== 'dettes' && !section.nominatif ? h('p', { class: 'description-sous' }, section.description) : null;
    const detail = h('section', { class: `sous-partie-saisie ton-${ton}${seule ? ' seule' : ''}`, id: `section-${section.id}`, 'data-section': section.id, 'aria-labelledby': seule ? null : `titre-${section.id}` },
      seule ? description : h('header', { class: 'entete-sous' },
        marque,
        h('div', { class: 'titres-detail' }, h('h4', { id: `titre-${section.id}` }, section.titre), description),
        montantDetail),
      h('div', { class: 'corps-sous' },
        visuel && section.id !== 'logement' ? visuel : null,
        contenu,
        section.id === 'logement' ? visuel : null,
        note ? h('p', { class: 'note-pied' }, note) : null));
    volets.set(section.id, { section, ton, detail, montantDetail, marque });
  }

  const lignes = rangees(config);
  const rangeeDe = (id) => lignes.findIndex((r) => r.some((s) => s.id === id));
  const aFaire = (r) => r.filter((s) => !s.nominatif);
  const blocFait = (r) => aFaire(r).length > 0 && aFaire(r).every((s) => estFaite(s, etat));
  const blocs = [];

  /* Une etape : un en-tete cliquable qui se deplie sur place. Plusieurs
     etapes peuvent etre ouvertes ; aucune ne se replie toute seule : seuls
     l'en-tete et « Etape terminee » la replient. */
  function bloc(r, i) {
    const premiere = r[0];
    const facultatif = r.every((s) => s.nominatif);
    const ton = volets.get(premiere.id).ton;
    const titre = r.length > 1 ? (premiere.bloc || r.map((s) => s.court || s.titre).join(' et ')) : premiere.titre;
    const resume = h('span', { class: 'resume-bloc' });
    const montant = h('span', { class: 'montant-bloc' });
    const marque = h('span', { class: 'marque-bloc' });
    const derniere = i === lignes.length - 1;
    const corps = h('div', { class: 'corps-bloc', id: `corps-bloc-${i}`, hidden: true },
      h('div', { class: `sous-parties${r.length > 1 ? ' double' : ''}` }, r.map((s) => volets.get(s.id).detail)),
      h('div', { class: 'pied-bloc' },
        h('button', { type: 'button', class: 'bouton terminer', onclick: () => terminerBloc(i) },
          icone('ok'), derniere ? 'Terminer la saisie' : 'Étape terminée, continuer')));
    const tete = h('button', {
      type: 'button', class: 'tete-bloc', id: `tete-bloc-${i}`, 'aria-expanded': 'false', 'aria-controls': corps.id,
      onclick: () => (ui.ouverts.has(i) ? fermerBloc(i) : ouvrirBloc(i, { focus: true })),
    }, marque,
    h('span', { class: 'titres-bloc' },
      h('span', { class: 'numero-etape' }, `Étape ${i + 1}${facultatif ? ' · facultative' : ''}`),
      h('span', { class: 'titre-bloc' }, titre),
      resume),
    montant, h('span', { class: 'chevron', 'aria-hidden': 'true' }, icone('bas')));
    const el = h('section', { class: `bloc ton-${ton}${facultatif ? ' facultatif' : ''}`, id: `bloc-${premiere.id}`, 'data-bloc': i },
      h('h3', { class: 'h-bloc' }, tete), corps);
    blocs.push({ r, el, tete, corps, resume, montant, marque, facultatif });
    return el;
  }

  function majOuverts() {
    blocs.forEach((b, i) => {
      const ouvert = ui.ouverts.has(i);
      b.corps.hidden = !ouvert;
      b.el.classList.toggle('ouvert', ouvert);
      b.tete.setAttribute('aria-expanded', String(ouvert));
    });
  }

  /* Ouvrir une etape ne touche pas aux autres ; quand on enchaine depuis
     « continuer », on amene la suivante en haut. */
  function ouvrirBloc(i, { focus = false, defiler = false } = {}) {
    const b = blocs[i];
    if (!b) return;
    ui.ouverts.add(i);
    majOuverts();
    if (defiler) b.el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    apparaitre(b.corps);
    if (focus) setTimeout(() => b.corps.querySelector('input, .question-dettes button')?.focus({ preventScroll: true }), defiler ? 400 : 0);
    surOuverture?.(b.r[0].id);
  }

  function fermerBloc(i) {
    ui.ouverts.delete(i);
    majOuverts();
  }

  /* « Etape terminee » : tout le bloc est tenu pour fait (une liste vide =
     rien a declarer), il se replie et la prochaine etape a faire s'ouvre. */
  function terminerBloc(i) {
    for (const s of aFaire(lignes[i])) ui.terminees.add(s.id);
    surChangement();
    fermerBloc(i);
    const ordre = [...lignes.keys()].slice(i + 1).concat([...lignes.keys()].slice(0, i));
    const suivante = ordre.find((j) => aFaire(lignes[j]).length && !blocFait(lignes[j]));
    if (suivante !== undefined) ouvrirBloc(suivante, { focus: true, defiler: true });
    else document.getElementById('fin-saisie')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  /* « Non, aucune » dans les dettes : la sous-partie est faite, l'etape
     reste ouverte ; le curseur va a ce qui reste (ou au bouton de fin). */
  function terminer(id) {
    ui.terminees.add(id);
    surChangement();
    const i = rangeeDe(id);
    const reste = aFaire(lignes[i]).find((s) => !estFaite(s, etat));
    (reste ? volets.get(reste.id).detail.querySelector('input, button') : blocs[i].corps.querySelector('.terminer'))?.focus();
  }
  /* ---------------------------------------------------------- fin de saisie */

  const fin = h('section', { class: 'fin-saisie', id: 'fin-saisie', hidden: true, 'aria-live': 'polite' });
  function majFin(r) {
    const p = progression(config, etat);
    fin.hidden = !p.complet;
    if (!p.complet) return;
    const v = r.valeurs;
    const negatif = (v.solde_apres_dettes ?? 0) < 0;
    vider(fin,
      h('div', { class: 'anneau-fin', 'aria-hidden': 'true' }, icone('ok')),
      h('p', { class: 'surtitre' }, 'Fin de saisie'),
      h('h3', {}, 'Toutes les étapes sont complètes'),
      h('p', {}, 'Le diagnostic est prêt : synthèse, score et proposition de plan.'),
      h('div', { class: 'puces-fin' },
        h('span', { class: 'jeton taupe' }, `${p.faites} / ${p.total} étapes`),
        h('span', { class: `jeton ${negatif ? 'rouge' : 'vert'}` }, `${negatif ? 'Déficit' : 'Reste à vivre'} ${formater(Math.abs(v.solde_apres_dettes ?? 0), 'euro')}`),
        r.score ? pastilleNiveau(r.score.palier, `Score ${formater(r.score.valeur, 'nombre')} / ${r.score.max}`) : null),
      h('button', { type: 'button', class: 'bouton grand', 'data-aller': 'synthese', onclick: () => document.querySelector('.nav [data-vue="synthese"]')?.click() }, 'Voir la synthèse et le PDF', icone('suite')));
  }

  /* ------------------------------------------------------------ assemblage */

  lignes.forEach((r) => r.forEach((s) => volet(s, r.length === 1)));
  const etapes = h('div', { class: 'etapes-saisie', role: 'list' }, lignes.map((r, i) => {
    const el = bloc(r, i);
    el.setAttribute('role', 'listitem');
    return el;
  }));
  vider(racine, etapes, fin);
  // Au depart, la premiere etape qui reste a faire.
  if (!ui.ouverts) {
    const premiere = lignes.findIndex((r) => aFaire(r).length && !blocFait(r));
    ui.ouverts = new Set(premiere >= 0 ? [premiere] : []);
  }
  majOuverts();

  return {
    ouvrir: (id) => ouvrirBloc(rangeeDe(id), { focus: true, defiler: true }),
    rafraichir(resultat) {
      dernierResultat = resultat;
      for (const f of aRafraichir) f(resultat);
      const montants = new Map();
      for (const [id, vt] of volets) {
        const fait = estFaite(vt.section, etat);
        vider(vt.marque, fait ? h('span', { class: 'coche' }, icone('ok')) : h('span', { class: `medaillon m-${vt.ton}` }, dessinIcone(nomIcone(vt.section, 'dossier'))));
        const m = montantVolet(vt.section, resultat);
        montants.set(id, m);
        vt.montantDetail.textContent = m;
      }
      for (const b of blocs) {
        const fait = blocFait(b.r);
        b.el.classList.toggle('fait', fait);
        const faites = aFaire(b.r).filter((s) => estFaite(s, etat)).length;
        vider(b.marque, fait ? h('span', { class: 'coche' }, icone('ok'))
          : h('span', { class: `medaillon m-${volets.get(b.r[0].id).ton}` }, dessinIcone(nomIcone(b.r[0], 'dossier')),
            b.r.length > 1 && faites ? h('span', { class: 'compte-sous' }, `${faites}/${aFaire(b.r).length}`) : null));
        // Le resume : une ligne par sous-partie, avec son etat.
        vider(b.resume, b.r.length === 1 ? h('span', { class: 'ligne-resume' }, resume(b.r[0], resultat))
          : b.r.map((s) => h('span', { class: `ligne-resume${estFaite(s, etat) ? ' faite' : ''}` },
            h('span', { class: 'puce-sous', 'aria-hidden': 'true' }, estFaite(s, etat) ? icone('ok') : null),
            h('strong', {}, s.court || s.titre), ' ', resume(s, resultat))));
        const budgets = b.r.every((s) => s.type === 'budget');
        const m = budgets && b.r.length > 1
          ? formater(b.r.reduce((t, s) => t + (resultat.valeurs[s.total || `somme_${s.id}`] ?? 0), 0), 'euro')
          : b.r.map((s) => montants.get(s.id)).filter(Boolean).join(' · ');
        if (b.montant.textContent !== m && b.montant.textContent) signaler(b.montant);
        b.montant.textContent = m;
      }
      majFin(resultat);
    },
  };
}
