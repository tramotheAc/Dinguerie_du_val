# La dinguerie de val

Calculateur de **diagnostic budgétaire locataire** : on saisit la situation d'un
ménage, la page calcule les indicateurs, le score de fragilité, une proposition de
plan d'apurement et les leviers d'action, puis produit une synthèse **téléchargeable
en PDF**.

Version maquette, transcrite du classeur `Diagnostic budgétaire locataire
version 1.xlsm` (référentiel V1.0, juillet 2026).

> **Rien n'est conservé.** La saisie vit dans la mémoire de la page : ni cookie, ni
> stockage du navigateur, ni envoi réseau. Fermer ou actualiser l'onglet efface tout
> (le navigateur prévient avant). Le PDF est fabriqué dans le navigateur.

---

## Les trois pages

| Page | Rôle |
|---|---|
| `index.html` — **Saisie** | **Six étapes** qui se déplient sur place, plusieurs à la fois si besoin : dossier (facultatif), situation du foyer, dettes, ressources, charges, dépenses facultatives. Une étape regroupe une ou deux sous-parties (foyer et logement, dette locative et autres dettes, charges fixes et vie courante), côte à côte une fois ouverte. Fermée, elle résume chaque sous-partie sur une ligne avec son état (« ✓ Foyer 2 adultes · 1 enfant ») et son montant. Une étape ne se replie que par son en-tête ou par « Étape terminée, continuer », qui ouvre la suivante. Le regroupement et le titre de l'étape se règlent dans l'admin (Formulaire). À droite, le panneau **Équilibre du mois** suit la frappe (anneau des dépenses, reste à vivre, taux d'effort, score). Les listes de budget n'affichent que les postes utiles (réglage « d'office » dans l'admin), les autres s'ajoutent d'un clic ; un champ vide affiche « — ». Confort : fréquence semaine / mois / trimestre / an convertie en mensuel, additions (« 25+12+8 »), Entrée pour passer au champ suivant. **Données de démo** remplit avec un ménage fictif ; **Nouvelle situation** remplace la macro `Réinitialiser_Situation`. |
| `index.html` — **Synthèse** | Cinq blocs, chacun répond à une question, avec une barre « Aller à » figée : **Bilan** (le verdict en une phrase, quatre chiffres, le score, la première piste) · **Le budget** (une cascade des ressources au reste réel, « sur 100 € qui rentrent ») · **Le score expliqué** (d'où viennent les points, une jauge à zones nommées par critère, « en clair ») · **Le plan** (curseur de mensualité, durée et reste au ménage en direct, scénarios comparés à la durée cible) · **Les leviers** (ce qui alerte, ce qu'on peut actionner ; seuls les leviers retenus vont dans le PDF). **Télécharger le PDF**. |
| `admin.html` — **Administration** | Tout le paramétrage : paramètres, formulaire, formules de calcul, barèmes, paliers des jauges et du score, points d'attention, qualifications du plan, leviers, jeu d'essai, liens et Power BI. |

Les données de démonstration (`config/demo.json`) sont entièrement inventées :
numéros de téléphone de la plage 01 99 00 xx xx réservée à la fiction, adresses
e-mail en `example.org`. Un bandeau le rappelle quand elles sont chargées.

---

## Les liens pré-remplis (Power BI)

Un lien peut pré-remplir les champs **cochés « lien »** dans l'administration
(par défaut : composition familiale, loyer, charges, APL, dette locative) :

```
https://tramotheac.github.io/Dinguerie_du_val/#adultes=2&enfants_moins_14=1&loyer=650&apl=210&dette_locative=1200
```

- Les valeurs vont **après le `#`** : cette partie de l'adresse n'est jamais envoyée
  au serveur, elle ne laisse de trace dans aucun journal.
- `/` est accepté comme séparateur (`#loyer=650/charges=80`), ainsi que `?loyer=650`.
- Décimales à la virgule ou au point ; un paramètre inconnu ou illisible est ignoré
  et signalé dans un bandeau.
- **Un lien ne porte jamais de nom** : les champs de la section nominative et les
  champs texte sont refusés d'office, même cochés par erreur.

L'administration (panneau **Liens et Power BI**) fabrique un lien de test et écrit la
**formule DAX** (colonne calculée ou mesure) à partir des noms de colonnes de votre
table. Dans Power BI : catégorie de données « URL web », puis « Valeurs d'URL » dans un
tableau ou un bouton avec l'action « URL web ».

---

## Les formules

Chaque indicateur est une formule lisible, écrite comme dans Excel en français mais
avec des **noms de variables** au lieu d'adresses de cellules :

```
SI(total_ressources > 0; depenses_logement / total_ressources; 0)
BAREME("fourchette_apurement"; solde_apres_dettes; "maxi")
```

- séparateur `;`, décimales `0,5`, pourcentages `35%`, textes `"entre guillemets"` ;
- fonctions : `SI ET OU NON MIN MAX SOMME ABS ARRONDI ARRONDI.SUP ARRONDI.INF
  SIERREUR ESTVIDE BAREME` (les noms anglais `IF AND OR…` marchent aussi) ;
- une division par zéro donne « non calculable » (affiché —), qui rend fausse toute
  comparaison ;
- l'ordre des formules est indifférent : chacune est calculée après celles qu'elle lit,
  un calcul circulaire est signalé.

Les formules ne sont **jamais exécutées par `eval`** : elles sont lues puis calculées
par un petit interpréteur (`js/formules.js`). Une formule saisie dans l'admin ne peut
rien faire d'autre que calculer.

Dans l'admin, chaque formule est vérifiée à la frappe et calculée sur un **jeu
d'essai** (l'exemple du classeur) ; un aide-mémoire liste fonctions et variables,
cliquables pour les insérer. Renommer une variable la renomme dans toutes les formules,
conditions et libellés.

---

## Publier une modification du paramétrage

1. Dans `admin.html`, modifier. Le brouillon est gardé dans **ce navigateur** ; le
   calculateur de ce navigateur l'utilise déjà (bandeau « Paramétrage de test actif »).
2. **Télécharger parametres.json**.
3. Le déposer dans le dépôt à la place de `config/parametres.json` (sur GitHub :
   ouvrir le fichier → crayon, ou *Add file → Upload files*), puis valider.
4. GitHub Pages republie le site en une à deux minutes. Dans l'admin, « Revenir au
   publié » efface alors le brouillon.

Un brouillon fait avant une mise à jour du paramétrage publié reçoit ce qui a été ajouté depuis (une jauge, un indicateur, un réglage), sans perdre ses modifications ni ressusciter ce qu’on y a supprimé. Un brouillon qui contient une erreur n’est jamais utilisé par le calculateur : il
revient au paramétrage publié et le signale.

---

## Écarts avec le classeur Excel

Corrections faites à la transcription, toutes réglables dans l'admin (détail dans
*Vue d'ensemble*) :

| Sujet | Classeur V1.0 | Ici |
|---|---|---|
| Coefficient score | renvoyait un texte, inutilisé | pourcentage : 0 % = mini, 100 % = maxi de la fourchette |
| Correction selon le RAV/UC | ne pouvait que baisser la mensualité | joue dans les deux sens |
| Commentaire du plan > 36 mois | affichait celui du plan « fragile » par le score | chaque qualification porte son commentaire |
| FSL | formule ≠ texte du référentiel ; priorités 4/5 inversées entre feuilles | formule gardée, variante QF documentée, FSL = 4 |
| Score « remboursement des dettes » | lisait le taux d'endettement des crédits seuls | lit l'endettement global (crédits + dettes) |
| Répartition des dépenses | libellés intervertis | corrigés, remboursement des dettes ajouté |
| Seuils affichés | textes figés, parfois contradictoires | écrits à partir des paliers |
| Mois d'impayés | dette / (loyer + charges) | dette / loyer résiduel |

Sur l'exemple du classeur, tous les indicateurs et le score (30 %) sont identiques ;
la mensualité conseillée passe de 90 € à 40 € (score critique → bas de fourchette).
Avec tous les coefficients à 100 %, on retrouve 90 € et 63 mois.

---

## Lancer en local

Le site est statique, sans étape de construction. Il doit être **servi** (le
navigateur bloque la lecture de `config/parametres.json` en `file://`) :

- VS Code : extension **Live Server** → *Go Live* ;
- ou `python3 -m http.server` dans le dossier, puis <http://localhost:8000>.

**Avant chaque commit**, poser les tampons de version :

```
node outils/version.mjs
```

Chaque feuille de style et chaque script est appelé avec `?v=<empreinte du contenu>`.
GitHub Pages laisse le navigateur garder les fichiers dix minutes : sans tampon, une
page neuve pouvait tourner avec d'anciens scripts (boutons sans effet, icônes
absentes). Le test `tests/version.test.mjs` échoue si un tampon est périmé, et la page
affiche un bandeau si elle détecte un mélange de versions.

Tests (Node ≥ 20, aucune dépendance) :

```
node --test tests/*.test.mjs
```

## Organisation

```
index.html, admin.html     les pages
config/parametres.json     le paramétrage publié (barèmes, formules, libellés)
config/demo.json           trois ménages fictifs pour s'exercer
css/charte/                copie de la charte visuelle Aiguillon (+ bandeau injecté)
css/categories.css         5 couleurs de catégories de dépenses (locales, validées clair/sombre)
css/app.css, admin.css     styles propres, uniquement des jetons de la charte
js/formules.js             l'interpréteur de formules
js/moteur.js               le calcul complet et le contrôle du paramétrage
js/saisie.js, synthese.js  les deux vues du calculateur
js/panneau.js              le panneau « Équilibre du mois » de la saisie
js/graphiques.js           jauges, barres, demi-cercle (SVG)
js/icones.js               icônes d'illustration du formulaire (SVG au trait)
js/animations.js           animations sobres (API Web Animations), coupées si
                           le poste demande moins d'animations
js/pdf.js                  export PDF (jsPDF + html2canvas-pro, chargés au clic)
js/url.js                  liens pré-remplis et formule DAX
js/admin.js                l'administration
vendor/                    jsPDF 4.2.1 et html2canvas-pro 2.4.5 (MIT)
outils/version.mjs         pose les tampons de version (cache du navigateur)
tests/                     tests du moteur, des formules, des liens, des tampons
```

La charte vient du dépôt `charte-visuelle` (copie de `jetons`, `socle`,
`composants`, `bouton-theme`, `motif-rail`). Pour la mettre à jour : recopier ces
fichiers dans `css/charte/`, puis `python3 <charte>/outils/couverture.py css/*.css js/*.js`.
