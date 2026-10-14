/* ===========================================================================
   Charte visuelle Aiguillon - le bouton clair / sombre

   Rien n'est memorise. A chaque ouverture la page suit le reglage du systeme,
   et le clic ne vaut que pour la visite en cours - ce qui evite le cas
   deroutant d'une page qui s'ouvre en sombre des mois apres un clic oublie.
   Sans stockage, il n'y a pas non plus de clignotement au chargement, ni de
   fenetre privee a menager.

   A charger en fin de <body>, ou dans le script de la page.
   =========================================================================== */
(function () {
  'use strict';

  var prefereSombre = window.matchMedia('(prefers-color-scheme: dark)');

  function themeEffectif() {
    var pose = document.documentElement.getAttribute('data-theme');
    return pose ? pose : (prefereSombre.matches ? 'dark' : 'light');
  }

  function synchroniserBouton() {
    var bouton = document.getElementById('bascule-theme');
    if (!bouton) return;
    var sombre = themeEffectif() === 'dark';
    bouton.dataset.effectif = sombre ? 'dark' : 'light';
    bouton.setAttribute('aria-label',
      sombre ? 'Passer au thème clair' : 'Passer au thème sombre');
    // La page peut avoir des dessins qui lisent leurs couleurs dans le theme.
    if (typeof window.surChangementDeTheme === 'function') {
      window.surChangementDeTheme(sombre ? 'dark' : 'light');
    }
  }

  function basculerTheme() {
    // « light » et « dark » : ce sont les valeurs que la charte attend. Ecrire
    // « clair » ou « sombre » ici laisserait :root:not([data-theme="light"])
    // vrai, et le mode clair ne prendrait jamais sur un poste regle en sombre.
    document.documentElement.setAttribute(
      'data-theme', themeEffectif() === 'dark' ? 'light' : 'dark');
    synchroniserBouton();
  }

  function brancher() {
    var bouton = document.getElementById('bascule-theme');
    if (bouton) bouton.addEventListener('click', basculerTheme);
    synchroniserBouton();
  }

  // Tant que personne n'a clique, la page suit le systeme en direct.
  prefereSombre.addEventListener('change', function () {
    if (!document.documentElement.getAttribute('data-theme')) synchroniserBouton();
  });

  if (document.readyState !== 'loading') brancher();
  else document.addEventListener('DOMContentLoaded', brancher);
})();
