# Dossier TP – Institut Saint-Roch

App de travaux pratiques en électricité pour les 3Pélec : schéma de principe, unifilaire (façon Trikker), schéma de câblage sur la planche, bon de commande avec catalogue Niko, outillage, mode opératoire et fiches.

- App : https://olivier7887.github.io/dossier-tp/ (installable, fonctionne hors connexion)
- Données : Google Sheet « Dossier TP – données » (compte de l'école) avec le script `apps-script/Code.gs`
- Créé par Lesenfants Olivier

## Mise en route (une seule fois)

### 1. Script du Google Sheet
1. Ouvrir le Google Sheet « Dossier TP – données » avec le compte de l'école.
2. **Extensions › Apps Script**. Effacer le contenu de `Code.gs` et coller tout le fichier [`apps-script/Code.gs`](apps-script/Code.gs). Enregistrer.
3. En haut, choisir la fonction **installer** puis **Exécuter**. Accepter les autorisations (Google affiche un avertissement « application non validée » : c'est votre propre script, cliquez sur *Paramètres avancés › Accéder à…*).
   Le script crée les onglets Profs, Bloqués, Élèves, Dossiers et Catalogue, remplit le catalogue et crée le dossier Drive des photos.

### 2. Les deux déploiements
Dans Apps Script : **Déployer › Nouveau déploiement › roue dentée › Application Web**.

| Déploiement | Description | Exécuter en tant que | Qui a accès |
|---|---|---|---|
| A | Connexion | Moi | Tous les utilisateurs de elmarche.be |
| B | Données | Moi | Tout le monde |

Copier l'**URL de l'application Web** de chacun (elle se termine par `/exec`).

### 3. Relier l'app
Mettre les deux adresses dans [`config.js`](config.js) (`loginUrl` = A, `apiUrl` = B).

### 4. Activer GitHub Pages
Dépôt › **Settings › Pages** › Source : *Deploy from a branch* › Branche **main**, dossier **/ (root)** › Save.

## Utilisation
- **Élèves** : ouvrir l'app, « Se connecter avec mon compte de l'école », puis « Ouvrir Dossier TP ». La connexion est gardée 180 jours. Le travail s'enregistre sur l'appareil et part dans le Sheet dès qu'il y a internet. Remettre un dossier (avec la photo) demande internet.
- **Profs** : ajouter une adresse dans l'onglet **Profs**. Bloquer un élève : ajouter son adresse dans **Bloqués**.
- **Classes** : une ligne par classe dans l'onglet **Classes**, avec l'adresse du professeur et, si besoin, celle d'un 2e professeur en colonne C (listes déroulantes tirées de l'onglet Profs). Les deux voient la classe dans « Mes élèves ». Les élèves choisissent leur classe et leur professeur dans l'app.
- **Propriétaire** : le prof dont la remarque, dans l'onglet Profs, contient « Propriétaire » voit le bouton **Nouvelle année scolaire** (archive dans le Drive, puis remise à zéro des élèves et des dossiers).
- **Catalogue** : modifiable depuis l'app (page Catalogue, mode prof) ou directement dans l'onglet Catalogue.

## Mettre à jour le script
Recoller `Code.gs`, exécuter **installer** (ajoute les onglets et colonnes manquants, sans toucher aux données), puis **Déployer › Gérer les déploiements**, crayon, *Version : Nouvelle version*, **Déployer** – pour les **deux** déploiements. Les adresses ne changent pas.
