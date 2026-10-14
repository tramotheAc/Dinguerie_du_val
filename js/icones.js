/* ===========================================================================
   Les icones d'illustration du formulaire : dessinees au trait, en SVG, dans
   l'esprit de la charte (trait 1,9, bouts ronds). Rien a telecharger.

   Chaque champ peut choisir son icone dans l'admin (propriete « icone ») ;
   sinon on prend celle de son identifiant, puis celle de sa section.
   =========================================================================== */

import { svg } from './dom.js?v=e847c20310';

/* Chaque icone : une liste de traces (path d) dans une grille 24 x 24. */
export const ICONES = {
  utilisateur: ['M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2', 'M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z'],
  famille: ['M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2', 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z', 'M22 21v-2a4 4 0 0 0-3-3.87', 'M16 3.13a4 4 0 0 1 0 7.75'],
  enfant: ['M12 12a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z', 'M7 21v-2a5 5 0 0 1 10 0v2', 'M10 4.5c.5-1 1.2-1.5 2-1.5s1.5.5 2 1.5'],
  ado: ['M12 9a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z', 'M6 22v-3a6 6 0 0 1 12 0v3', 'M9 13.5 12 17l3-3.5'],
  badge: ['M3 6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z', 'M9 13a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z', 'M5.5 17a3.5 3.5 0 0 1 7 0', 'M15 9h3M15 13h3'],
  repere: ['M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 0 1 16 0Z', 'M12 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z'],
  telephone: ['M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2Z'],
  courriel: ['M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z', 'M22 6l-10 7L2 6'],
  calendrier: ['M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z', 'M16 2v4M8 2v4M3 10h18', 'M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01'],
  conseiller: ['M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2', 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z', 'm16 11 2 2 4-4'],
  dossier: ['M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.7-.9l-.8-1.2A2 2 0 0 0 7.9 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z', 'M9 13h6M12 10v6'],
  maison: ['M3 10.5 12 3l9 7.5', 'M5 9v11a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V9'],
  cle: ['M2.6 17.4A2 2 0 0 0 2 18.8V21a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h1a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h.2a2 2 0 0 0 1.4-.6l.8-.8a6.5 6.5 0 1 0-4-4Z', 'M16.5 7.5h.01'],
  recu: ['M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z', 'M8 7h8M8 11h8M8 15h5'],
  aide: ['M11 14h2a2 2 0 1 0 0-4h-3c-.6 0-1.1.2-1.4.6L3 16', 'm7 20 1.6-1.4c.3-.4.8-.6 1.4-.6h4c1.1 0 2.1-.4 2.8-1.2l4.6-4.4a2 2 0 0 0-2.8-2.9l-4.2 3.9', 'm2 15 6 6', 'M19.5 8.5c.7-.7 1.5-1.6 1.5-2.7A2.7 2.7 0 0 0 16 4a2.7 2.7 0 0 0-5 1.8c0 1.2.8 2 1.5 2.8L16 12Z'],
  alerte: ['M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z', 'M12 9v4M12 17h.01'],
  carte_bancaire: ['M4 5h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z', 'M2 10h20', 'M6 15h4'],
  portefeuille: ['M19 7V5a2 2 0 0 0-2-2H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2', 'M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4'],
  mallette: ['M4 7h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2Z', 'M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16'],
  coeur: ['M19 14c1.5-1.5 3-3.2 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.8 0-3 .5-4.5 2-1.5-1.5-2.7-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4 3 5.5l7 7Z'],
  accessibilite: ['M16 5a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z', 'm18 19 1-7-6 1', 'm5 8 3-3 5.5 3-2.4 3.5', 'M4.2 14.5a5 5 0 0 0 6.9 5.3', 'M13.8 17.5a5 5 0 0 0-6.9-5.3'],
  poussette: ['M5 3h1.5a2 2 0 0 1 2 1.6L10 12h9a5 5 0 0 1-5 5H9a4 4 0 0 1-4-4', 'M10 12V5a8 8 0 0 1 9 7', 'M8 21a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3ZM17 21a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z'],
  recherche: ['M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16Z', 'm21 21-4.3-4.3', 'M8 11h6'],
  cadeau: ['M3 8h18v4H3Z', 'M12 8v13', 'M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7', 'M7.5 8a2.5 2.5 0 0 1 0-5C10 3 12 8 12 8s2-5 4.5-5a2.5 2.5 0 0 1 0 5'],
  fauteuil: ['M19 9V6a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v3', 'M3 16a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-5a2 2 0 0 0-4 0v2H7v-2a2 2 0 0 0-4 0Z', 'M5 18v2M19 18v2'],
  plus_rond: ['M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Z', 'M8 12h8M12 8v8'],
  eclair: ['M13 2 3 14h9l-1 8 10-12h-9l1-8Z'],
  goutte: ['M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5S12.5 5.5 12 3c-.5 2.5-2 4.9-4 6.5S5 13 5 15a7 7 0 0 0 7 7Z'],
  wifi: ['M5 12.6a10 10 0 0 1 14 0', 'M8.5 16.1a5 5 0 0 1 7 0', 'M2 8.8a15 15 0 0 1 20 0', 'M12 20h.01'],
  mobile: ['M7 2h10a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Z', 'M12 18h.01'],
  bouclier: ['M20 13c0 5-3.5 7.5-7.7 9a1 1 0 0 1-.7 0C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.2-2.7a1.2 1.2 0 0 1 1.6 0C14.5 3.8 17 5 19 5a1 1 0 0 1 1 1Z', 'm9 12 2 2 4-4'],
  parapluie: ['M22 12a10 10 0 0 0-20 0Z', 'M12 12v8a2 2 0 0 0 4 0', 'M12 2v1'],
  banque: ['M3 22h18', 'M6 18v-7M10 18v-7M14 18v-7M18 18v-7', 'M12 2 20 7H4Z'],
  document: ['M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z', 'M14 2v4a2 2 0 0 0 2 2h4', 'M9 13h6M9 17h6'],
  envoi: ['M22 2 11 13', 'M22 2 15 22l-4-9-9-4Z'],
  chariot: ['M8 22a1 1 0 1 0 0-2 1 1 0 0 0 0 2ZM19 22a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z', 'M2 2h3l2.7 12.4a2 2 0 0 0 2 1.6h9.7a2 2 0 0 0 2-1.6L23 6H6'],
  carburant: ['M3 22h12', 'M4 9h10', 'M14 22V4a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v18', 'M14 13h2a2 2 0 0 1 2 2v2a2 2 0 0 0 4 0V9.8a2 2 0 0 0-.6-1.4L18 5'],
  sante: ['M11 2v2M5 2v2', 'M5 3H4a2 2 0 0 0-2 2v4a6 6 0 0 0 12 0V5a2 2 0 0 0-2-2h-1', 'M8 15a6 6 0 0 0 12 0v-3', 'M20 10a2 2 0 1 0 0 4 2 2 0 0 0 0-4Z'],
  vetement: ['M20.4 3.5 16 2a4 4 0 0 1-8 0L3.6 3.5a2 2 0 0 0-1.3 2.2l.6 3.5a1 1 0 0 0 1 .8H6v10c0 1.1.9 2 2 2h8a2 2 0 0 0 2-2V10h2.2a1 1 0 0 0 1-.8l.6-3.5a2 2 0 0 0-1.3-2.2Z'],
  bus: ['M8 6v6M15 6v6M2 12h19.6', 'M18 18h3s.5-1.7.8-2.8c.1-.4.2-.8.2-1.2 0-.4-.1-.8-.2-1.2l-1.4-5C20.1 6.8 19.1 6 18 6H4a2 2 0 0 0-2 2v10h3', 'M7 20a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM16 20a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z', 'M9 18h5'],
  cartable: ['M4 10a4 4 0 0 1 4-4h8a4 4 0 0 1 4 4v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z', 'M8 10h8', 'M8 18h8', 'M8 22v-6a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v6', 'M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2'],
  cigarette: ['M17 12H3a1 1 0 0 0-1 1v2a1 1 0 0 0 1 1h14', 'M18 8c0-2.5-2-2.5-2-5', 'M21 16a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1', 'M22 8c0-2.5-2-2.5-2-5', 'M7 12v4'],
  television: ['M4 7h16a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2Z', 'm17 2-5 5-5-5'],
  couverts: ['M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2', 'M7 2v20', 'M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7'],
  ticket: ['M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z', 'M13 5v2M13 17v2M13 11v2'],
  de: ['M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z', 'M16 8h.01M8 8h.01M8 16h.01M16 16h.01M12 12h.01'],
  avion: ['M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2Z'],
  etincelle: ['M9.9 15.5A2 2 0 0 0 8.5 14.1L2.4 12.5a.5.5 0 0 1 0-1l6.1-1.6a2 2 0 0 0 1.4-1.4l1.6-6.1a.5.5 0 0 1 1 0l1.6 6.1a2 2 0 0 0 1.4 1.4l6.1 1.6a.5.5 0 0 1 0 1l-6.1 1.6a2 2 0 0 0-1.4 1.4l-1.6 6.1a.5.5 0 0 1-1 0Z', 'M20 3v4M22 5h-4'],
  piece: ['M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Z', 'M15 9.4a4 4 0 1 0 0 5.2', 'M7 11h6M7 13h6'],
  calculette: ['M6 2h12a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Z', 'M8 6h8', 'M16 14v4', 'M16 10h.01M12 10h.01M8 10h.01M12 14h.01M8 14h.01M12 18h.01M8 18h.01'],
  baguette: ['m21.6 2.4-1-1-.2.2a1.2 1.2 0 0 0 0 1.6l.2.2', 'm15 4 6 6', 'M15 10 3.5 21.5a1.2 1.2 0 0 1-1.6 0l-.4-.4a1.2 1.2 0 0 1 0-1.6L13 8', 'M8 2v2M4 6H2M6 4 5 3M18 16l1 1M20 14h2'],
};

export const ICONE_PAR_DEFAUT = {
  // sections
  dossier: 'dossier', composition: 'famille', logement: 'maison', dette: 'alerte', dettes: 'carte_bancaire',
  ressources: 'portefeuille', charges_fixes: 'recu', vie_courante: 'chariot', facultatives: 'etincelle',
  // champs
  nom: 'utilisateur', prenom: 'utilisateur', reference: 'badge', adresse: 'repere', telephone: 'telephone',
  email: 'courriel', date_entretien: 'calendrier', conseiller: 'conseiller',
  adultes: 'utilisateur', enfants_moins_14: 'enfant', enfants_14_plus: 'ado',
  loyer: 'cle', charges: 'recu', apl: 'piece', dette_locative: 'alerte',
  salaire_1: 'mallette', salaire_2: 'mallette', rsa: 'coeur', aah: 'accessibilite', caf: 'poussette',
  are_ass: 'recherche', pension_recue: 'cadeau', retraite: 'fauteuil', autres_ressources: 'plus_rond',
  energie: 'eclair', eau: 'goutte', internet: 'wifi', telephonie: 'mobile', assurance_habitation: 'bouclier',
  assurances: 'parapluie', credits: 'banque', impots: 'document', pension_versee: 'envoi', autres_charges_fixes: 'plus_rond',
  alimentation: 'chariot', carburant: 'carburant', sante: 'sante', habillement: 'vetement', transports: 'bus',
  enfants: 'cartable', autres_vie_courante: 'plus_rond',
  tabac: 'cigarette', streaming: 'television', restaurants: 'couverts', loisirs: 'ticket', jeux: 'de',
  vacances: 'avion', autres_facultatives: 'plus_rond',
  loyer_residuel: 'maison', mois_impayes: 'calendrier',
};

export function nomIcone(objet, repli = 'piece') {
  if (objet?.icone && ICONES[objet.icone]) return objet.icone;
  return ICONE_PAR_DEFAUT[objet?.id] ?? ICONE_PAR_DEFAUT[objet?.variable] ?? repli;
}

export function dessinIcone(nom, attrs = {}) {
  const traces = ICONES[nom] ?? ICONES.piece;
  return svg('svg', {
    viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.9',
    'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true', class: 'icone', ...attrs,
  }, traces.map((d) => svg('path', { d })));
}
