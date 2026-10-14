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
| `index.html` — **Saisie** | Le formulaire, construit depuis le paramétrage. Totaux, loyer résiduel, mois d'impayés et score se mettent à jour à la frappe. « Nouvelle situation » remplace la macro `Réinitialiser_Situation`. |
| `index.html` — **Synthèse** | Chiffres clés, jauges des indicateurs, répartition des dépenses, score, points d'attention, plan d'apurement (avec simulation d'une autre mensualité), leviers, détail des calculs. Bouton **Télécharger le PDF**. |
| `admin.html` — **Administration** | Tout le paramétrage : paramètres, formulaire, formules de calcul, barèmes, paliers des jauges et du score, points d'attention, qualifications du plan, leviers, jeu d'essai, liens et Power BI. |

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

Un brouillon qui contient une erreur n'est jamais utilisé par le calculateur : il
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

Sur l'exemple du classeur, tous les indicateurs et le score (30/100) sont identiques ;
la mensualité conseillée passe de 90 € à 40 € (score critique → bas de fourchette).
Avec tous les coefficients à 100 %, on retrouve 90 € et 63 mois.

---

## Lancer en local

Le site est statique, sans étape de construction. Il doit être **servi** (le
navigateur bloque la lecture de `config/parametres.json` en `file://`) :

- VS Code : extension **Live Server** → *Go Live* ;
- ou `python3 -m http.server` dans le dossier, puis <http://localhost:8000>.

Tests (Node ≥ 20, aucune dépendance) :

```
node --test tests/*.test.mjs
```

## Organisation

```
index.html, admin.html     les pages
config/parametres.json     le paramétrage publié (barèmes, formules, libellés)
css/charte/                copie de la charte visuelle Aiguillon (+ bandeau injecté)
css/app.css, admin.css     styles propres, uniquement des jetons de la charte
js/formules.js             l'interpréteur de formules
js/moteur.js               le calcul complet et le contrôle du paramétrage
js/saisie.js, synthese.js  les deux vues du calculateur
js/graphiques.js           jauges, barres, demi-cercle (SVG)
js/animations.js           animations sobres (API Web Animations), coupées si
                           le poste demande moins d'animations
js/pdf.js                  export PDF (jsPDF + html2canvas-pro, chargés au clic)
js/url.js                  liens pré-remplis et formule DAX
js/admin.js                l'administration
vendor/                    jsPDF 4.2.1 et html2canvas-pro 2.4.5 (MIT)
tests/                     tests du moteur, des formules, des liens
```

La charte vient du dépôt `charte-visuelle` (copie de `jetons`, `socle`,
`composants`, `bouton-theme`, `motif-rail`). Pour la mettre à jour : recopier ces
fichiers dans `css/charte/`, puis `python3 <charte>/outils/couverture.py css/*.css js/*.js`.
