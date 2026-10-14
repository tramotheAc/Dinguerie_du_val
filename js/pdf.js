/* ===========================================================================
   Le telechargement du PDF.

   La synthese est rendue une seconde fois, hors ecran, en theme clair et sans
   animation, puis chaque bloc est photographie (html2canvas-pro) et pose sur
   des pages A4 (jsPDF). Un bloc n'est jamais coupe entre deux pages.

   Les deux bibliotheques (700 Ko) ne sont chargees qu'au premier clic, depuis
   le dossier vendor/ du site : pas de dependance a un serveur tiers, et rien
   ne sort du poste - le PDF est fabrique dans le navigateur.
   =========================================================================== */

import { h } from './dom.js?v=e847c20310';
import { couperAnimations } from './animations.js?v=e847c20310';
import { rendreSynthese, identite } from './synthese.js?v=e847c20310';

const chargees = {};
function charger(src) {
  chargees[src] ??= new Promise((ok, ko) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = ok;
    s.onerror = () => ko(new Error(`Chargement impossible : ${src}`));
    document.head.append(s);
  });
  return chargees[src];
}

/* Un SVG photographie est d'abord serialise en image : les var(--…) et les
   classes CSS n'y sont plus resolues. On fige donc les couleurs et le texte
   en attributs avant la capture. */
function figerSvg(racine) {
  for (const el of racine.querySelectorAll('svg, svg *')) {
    const cs = getComputedStyle(el);
    for (const p of ['fill', 'stroke']) {
      const brut = el.getAttribute(p);
      if (brut && brut.includes('var(')) el.setAttribute(p, cs[p]);
    }
    if (el.tagName === 'text') {
      el.setAttribute('fill', cs.fill);
      el.setAttribute('font-size', cs.fontSize);
      el.setAttribute('font-family', cs.fontFamily);
      el.setAttribute('font-weight', cs.fontWeight);
    }
    if (el.tagName === 'svg') {
      const r = el.getBoundingClientRect();
      if (r.width) { el.setAttribute('width', r.width); el.setAttribute('height', r.height); }
    }
  }
}

const nomFichier = (config, etat) => {
  const morceaux = ['diagnostic-budgetaire', etat.valeurs.reference, etat.valeurs.nom, new Date().toISOString().slice(0, 10)]
    .filter(Boolean).map((m) => String(m).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9-]+/g, '-').replace(/^-|-$/g, ''));
  return `${morceaux.filter(Boolean).join('_')}.pdf`;
};

export async function exporterPdf({ config, resultat, etat }) {
  await Promise.all([charger('vendor/jspdf.umd.min.js?v=e847c20310'), charger('vendor/html2canvas-pro.min.js?v=e847c20310')]);
  const { jsPDF } = window.jspdf;
  const capturer = window.html2canvas;

  const racine = document.documentElement;
  const themeAvant = racine.getAttribute('data-theme');
  const zone = h('div', { class: 'zone-pdf', 'aria-hidden': 'true' });
  document.body.append(zone);
  couperAnimations(true);
  racine.setAttribute('data-theme', 'light');
  try {
    rendreSynthese(zone, { config, resultat, etat, mode: 'pdf', animer: false });
    await document.fonts?.ready;
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    figerSvg(zone);

    const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
    const L = 210, H = 297, marge = 12, haut = 16, bas = 14;
    const largeur = L - 2 * marge;
    let y = haut;
    let premiere = true;
    for (const el of zone.querySelectorAll(':scope > [data-bloc-pdf]')) {
      const canvas = await capturer(el, { scale: 2, backgroundColor: '#ffffff', logging: false, useCORS: true });
      let w = largeur;
      let hauteur = (canvas.height / canvas.width) * w;
      const place = H - bas - haut;
      if (hauteur > place) { w = (place / hauteur) * w; hauteur = place; }
      if (!premiere && y + hauteur > H - bas) { doc.addPage(); y = haut; }
      doc.addImage(canvas.toDataURL('image/jpeg', 0.92), 'JPEG', marge + (largeur - w) / 2, y, w, hauteur, undefined, 'FAST');
      y += hauteur + 4;
      premiere = false;
    }

    // En-tete et pied de chaque page
    const n = doc.getNumberOfPages();
    const qui = identite(config, etat).filter((x) => ['Nom', 'Prénom', 'Référence locataire'].includes(x.libelle)).map((x) => x.valeur).join(' ');
    for (let p = 1; p <= n; p++) {
      doc.setPage(p);
      doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(32, 56, 100);
      doc.text(config.meta.titre, marge, 9);
      doc.setFont('helvetica', 'normal'); doc.setTextColor(91, 106, 130);
      if (qui) doc.text(qui, L - marge, 9, { align: 'right' });
      doc.setDrawColor(211, 219, 230); doc.line(marge, 11.5, L - marge, 11.5);
      doc.setFontSize(7.5);
      doc.text(`${config.meta.sous_titre} · référentiel ${config.meta.referentiel ?? ''}`.trim(), marge, H - 7);
      doc.text(`Page ${p} / ${n}`, L - marge, H - 7, { align: 'right' });
    }
    doc.setProperties({ title: `${config.meta.sous_titre}${qui ? ` - ${qui}` : ''}`, creator: config.meta.titre });
    doc.save(nomFichier(config, etat));
  } finally {
    zone.remove();
    if (themeAvant) racine.setAttribute('data-theme', themeAvant); else racine.removeAttribute('data-theme');
    couperAnimations(false);
  }
}
