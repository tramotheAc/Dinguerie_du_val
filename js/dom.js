/* Construire du DOM sans innerHTML : h('div', { class: 'x', onclick }, enfant, …).
   Un texte passe par createTextNode, jamais interprete comme du HTML - ce qui
   compte ici, ou des libelles viennent d'un fichier de parametrage. */

export function h(tag, attrs, ...enfants) {
  const el = tag.includes(':')
    ? document.createElementNS('http://www.w3.org/2000/svg', tag.split(':')[1])
    : document.createElement(tag);
  let valeur;
  for (const [k, v] of Object.entries(attrs ?? {})) {
    if (v === undefined || v === null || v === false) continue;
    if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else if (k === 'value' && 'value' in el && !(el instanceof SVGElement)) valeur = v;
    else if (k === 'checked' || k === 'disabled' || k === 'selected') el[k] = !!v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  ajouter(el, enfants);
  // La valeur d'un <select> se pose apres ses options, sinon elle est perdue.
  if (valeur !== undefined) el.value = valeur;
  return el;
}

function ajouter(el, enfants) {
  for (const e of enfants.flat(Infinity)) {
    if (e === null || e === undefined || e === false) continue;
    el.append(e instanceof Node ? e : document.createTextNode(String(e)));
  }
}

export const svg = (tag, attrs, ...enfants) => h(`svg:${tag}`, attrs, ...enfants);

export function vider(el, ...enfants) {
  el.replaceChildren();
  ajouter(el, enfants);
  return el;
}

/* Une icone au trait, dessinee en SVG plutot que chargee : rien a heberger. */
const TRACES = {
  saisie: 'M4 20h4L19 9l-4-4L4 16v4ZM13.5 6.5l4 4',
  synthese: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
  admin: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z',
  pdf: 'M12 3v12M7 10l5 5 5-5M5 21h14',
  nouveau: 'M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5',
  retour: 'M15 18l-6-6 6-6',
  suite: 'M9 18l6-6-6-6',
  lien: 'M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1',
  alerte: 'M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z',
  ok: 'M20 6 9 17l-5-5',
  plus: 'M12 5v14M5 12h14',
  moins: 'M5 12h14',
  croix: 'M18 6 6 18M6 6l12 12',
  haut: 'M18 15l-6-6-6 6',
  bas: 'M6 9l6 6 6-6',
  copier: 'M9 9h11v11H9zM5 15H4V4h11v1',
  telecharger: 'M12 3v12M7 10l5 5 5-5M5 21h14',
  importer: 'M12 21V9M7 14l5-5 5 5M5 3h14',
  menu: 'M4 6h16M4 12h16M4 18h16',
  oeil: 'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12ZM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z',
};

export function icone(nom, attrs = {}) {
  return svg('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.9', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true', class: 'icone', ...attrs },
    svg('path', { d: TRACES[nom] ?? '' }));
}

/* Petit message ephemere en bas d'ecran. */
export function annoncer(texte, ton = 'info') {
  let zone = document.getElementById('annonces');
  if (!zone) {
    zone = h('div', { id: 'annonces', class: 'annonces', role: 'status', 'aria-live': 'polite' });
    document.body.append(zone);
  }
  const m = h('div', { class: `annonce ${ton}` }, texte);
  zone.append(m);
  setTimeout(() => { m.classList.add('sortie'); setTimeout(() => m.remove(), 300); }, 3200);
}

/* Fenetre de confirmation, en <dialog> natif : focus et Echap geres par le navigateur. */
export function confirmer({ titre, texte, oui = 'Confirmer', non = 'Annuler', danger = false }) {
  return new Promise((resolve) => {
    const d = h('dialog', { class: 'dialogue' },
      h('h3', {}, titre),
      texte ? h('p', {}, texte) : null,
      h('div', { class: 'actions' },
        h('button', { type: 'button', class: 'bouton second', onclick: () => d.close('non') }, non),
        h('button', { type: 'button', class: `bouton${danger ? ' danger' : ''}`, onclick: () => d.close('oui') }, oui)));
    d.addEventListener('close', () => { resolve(d.returnValue === 'oui'); d.remove(); });
    document.body.append(d);
    d.showModal();
  });
}

export function telechargerTexte(nom, contenu, type = 'application/json') {
  const url = URL.createObjectURL(new Blob([contenu], { type }));
  const a = h('a', { href: url, download: nom });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function copier(texte) {
  try {
    await navigator.clipboard.writeText(texte);
    annoncer('Copié dans le presse-papiers', 'ok');
  } catch {
    annoncer('Copie impossible : sélectionnez le texte et copiez-le à la main', 'alerte');
  }
}
