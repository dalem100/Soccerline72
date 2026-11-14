# Alignements Soccer 7 — application iPhone gratuite (version 1.1)

Cette version transforme le script Python en application web progressive (PWA) installable sur l’écran d’accueil d’un iPhone. Elle ne nécessite ni abonnement, ni serveur applicatif, ni compte Apple Developer. Après la première ouverture, elle fonctionne hors connexion.

## Fonctions principales

- Effectif saisi directement sur iPhone ou importé depuis un CSV choisi dans l’app Fichiers, iCloud Drive ou un fournisseur de fichiers disponible sur l’iPhone.
- Positions : GK, DG, DD, MG, MC, MD, AP et ALL.
- Notes de rapidité et de technique sur 5.
- Trois périodes, deux blocs par période.
- Gardienne souhaitée pour chaque période, avec remplacement automatique si elle devient indisponible.
- Équité calculée sur les blocs au champ; les blocs comme gardienne ne comptent pas comme temps au champ.
- Priorité aux joueuses qui étaient au banc au bloc précédent.
- Mode strict (positions autorisées seulement) ou souple (hors-position possible avec pénalité).
- Blessure en cours de match : les blocs déjà joués sont conservés et le reste est recalculé.
- Si moins de sept joueuses restent disponibles, les postes impossibles à remplir sont affichés « Poste vacant » au lieu de bloquer l’application.
- Régénération d’une proposition réellement différente, pour tout le match ou seulement à partir d’un bloc choisi.
- Tableau de temps de jeu, changements entre blocs, impression ou création d’un PDF depuis Safari.
- Export CSV de l’effectif et de l’alignement par la feuille de partage iOS, avec repli automatique vers Téléchargements si le partage de fichiers n’est pas disponible.
- Sauvegarde automatique locale sur l’appareil et export CSV/JSON.

## Installation gratuite sur iPhone

### 1. Publier gratuitement avec GitHub Pages

1. Créer un compte gratuit sur GitHub, puis un dépôt public, par exemple `soccer7`.
2. Décompresser l’archive et téléverser le contenu de ce dossier à la racine du dépôt. Le fichier `index.html` doit être à la racine.
3. Dans le dépôt, ouvrir **Settings > Pages**.
4. Sous **Build and deployment**, choisir **Deploy from a branch**, branche **main**, dossier **/(root)**, puis enregistrer.
5. Attendre la publication. L’adresse sera normalement `https://VOTRE-COMPTE.github.io/soccer7/`.

Le code peut être public sans exposer l’effectif : les noms et alignements saisis dans l’application sont enregistrés uniquement dans le stockage local de Safari, jamais dans le dépôt GitHub.

### 2. Ajouter l’application à l’écran d’accueil

1. Ouvrir l’adresse publiée dans **Safari** sur l’iPhone.
2. Toucher **Partager** (carré avec flèche vers le haut).
3. Choisir **Sur l’écran d’accueil**, puis **Ajouter**.
4. Ouvrir une première fois l’icône avec une connexion Internet afin de mettre les fichiers en cache.

L’application apparaîtra comme une application indépendante. Aucune installation depuis l’App Store n’est requise.

## Utilisation pendant un match

1. Dans **Effectif**, ajouter ou importer les joueuses.
2. Choisir les gardiennes des trois périodes, ou laisser le choix automatique.
3. Garder **Positions strictes** activé si les préférences doivent être obligatoires.
4. Toucher **Générer l’alignement des 6 blocs**.
5. En cas de blessure, dans **Match** :
   - choisir la joueuse;
   - choisir le bloc à partir duquel elle n’est plus disponible;
   - toucher **Marquer indisponible et recalculer**.
6. Les blocs antérieurs au bloc choisi restent inchangés. Le bloc choisi et les blocs suivants sont réoptimisés.
7. Pour une blessure entre deux blocs, choisir le prochain bloc. Pour une blessure pendant un bloc nécessitant un remplacement immédiat, choisir le bloc courant.
8. Le bouton **Réintégrer** remet une joueuse disponible et recalcule à partir du bloc indiqué dans le sélecteur.

## Demander une autre proposition

1. Dans l’onglet **Match**, ouvrir la carte **Régénérer un alignement différent**.
2. Avant le match, choisir **Bloc 1** pour remplacer l’ensemble de la proposition.
3. En cours de match, choisir le prochain bloc à jouer afin de conserver tous les blocs antérieurs.
4. Toucher **Générer une autre proposition**.

Le moteur essaie jusqu’à 80 variantes et compare la gardienne et les six postes de chaque bloc modifiable. Il n’accepte la nouvelle proposition que si elle est réellement différente. Si les contraintes n’admettent qu’une seule solution, l’application l’indique sans remplacer le plan actuel.

## Importer et exporter un CSV sur iPhone

### Importer

1. Dans **Effectif**, toucher **Importer CSV de l’iPhone**.
2. Choisir le fichier dans **Sur mon iPhone**, **iCloud Drive** ou un autre emplacement offert par l’app Fichiers.
3. Confirmer le remplacement de l’effectif courant, s’il y en a un.

L’import accepte les fichiers à colonnes séparées par une virgule, un point-virgule ou une tabulation. Les fichiers UTF-8 avec marque BOM sont acceptés, ce qui permet de réimporter directement un fichier exporté par l’application.

### Exporter

- **Exporter l’effectif CSV** produit un fichier réimportable contenant les joueuses, positions, notes, présences et indicateurs de gardienne.
- **Exporter l’alignement CSV**, dans l’onglet **Bilan**, produit le temps au champ, la cible, l’écart et les rôles des six blocs.
- Sur les versions compatibles de Safari, la feuille de partage iOS s’ouvre : choisir **Enregistrer dans Fichiers**, AirDrop, Mail ou une autre destination.
- Si le partage de fichiers n’est pas offert, le fichier est placé dans les téléchargements de Safari.

## Import CSV

Le séparateur de colonnes doit être une virgule ou une tabulation. Les positions d’une joueuse sont séparées par un point-virgule.

```csv
Nom,Positions,Rapidite,Technique,Presente,Gardienne
Ana,GK;DG,4,3.5,Oui,Oui
Dalia,DG;MG,4,3,Oui,Non
Jade,ALL,3.5,3.5,Oui,Non
```

Les colonnes obligatoires sont `Nom` et `Positions`. Un fichier complet est fourni : `effectif_exemple.csv`.

## Logique de calcul

1. La gardienne de chaque bloc est choisie selon le choix de période et sa disponibilité. Une remplaçante admissible est sélectionnée au besoin.
2. Les cibles de temps au champ sont recalculées selon les blocs déjà joués, les disponibilités futures et les blocs comme gardienne.
3. Pour chaque bloc, une optimisation par programmation dynamique affecte six joueuses distinctes aux six postes.
4. Le score privilégie, dans l’ordre : le retour des joueuses précédemment au banc, l’écart à la cible de temps au champ, les positions préférées, puis une légère variation pour produire des plans moins répétitifs.
5. La génération des six blocs est séquentielle. Elle cherche une solution équitable, mais ne garantit pas l’optimum global absolu sur l’ensemble du match. Le bilan signale les écarts à la cible et les bancs consécutifs inévitables.

## Limites importantes

- L’application est une PWA, non une application publiée dans l’App Store. C’est ce qui permet une utilisation gratuite sans compte Apple Developer.
- Les données locales peuvent être effacées si Safari supprime les données du site. Exporter le CSV ou la sauvegarde JSON avant un match important.
- Le fichier JSON sert de sauvegarde/audit exportable dans cette version; la restauration intégrée se fait par le CSV de l’effectif.
- Avec le mode strict, une combinaison peut être impossible même si sept joueuses sont disponibles. Dans ce cas, corriger les positions ou désactiver le mode strict.
- Si moins de sept joueuses sont disponibles, l’application conserve une gardienne et remplit le maximum de postes au champ; elle n’invente jamais de joueuse.
- L’ordre exact des remplacements reste une recommandation. L’entraîneur doit l’adapter aux règles de la ligue, à l’état de santé des joueuses et à la situation du match.

## Essai local sur ordinateur

Les modules hors ligne exigent un serveur HTTP; ne pas ouvrir simplement `index.html` comme fichier.

```bash
python3 -m http.server 8080
```

Puis ouvrir `http://localhost:8080`.

## Tests techniques

Aucune dépendance n’est requise. Avec Node.js installé :

```bash
npm test
npm run check
```

Les tests couvrent : génération complète, unicité des joueuses par bloc, respect des positions strictes, absence de banc consécutif dans le cas nominal, recalcul après blessure, remplacement d’une gardienne blessée, jeu à effectif réduit, détection d’une couverture stricte impossible et régénération d’une proposition distincte avec conservation des blocs antérieurs.

## Fichiers

- `index.html` : interface mobile.
- `styles.css` : mise en page iPhone, terrain et impression.
- `planner.js` : moteur de génération testable indépendamment.
- `app.js` : gestion de l’effectif, des blessures et de la sauvegarde locale.
- `sw.js` et `manifest.webmanifest` : installation et fonctionnement hors ligne.
- `effectif_exemple.csv` : gabarit d’import.
- `tests/planner.test.js` : tests automatisés.

Licence : MIT.
