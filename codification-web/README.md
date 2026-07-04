# Codification & arborescence projets — installation

Petite appli web partagée pour appliquer la procédure PRO-SMI-ALL-QSE-002 :
registre des numéros uniques clients/installations, générateur de codes
documents/programmes, export d'arborescence de dossiers en .zip.

Tous les collaborateurs y accèdent depuis leur navigateur, en tapant l'adresse
du poste qui héberge l'appli. Aucune installation côté utilisateur.

## 1. Choisir le poste hôte

N'importe quel PC ou serveur Windows du réseau de l'entreprise, **allumé en
permanence** pendant les heures de travail (ou un vrai serveur si vous en
avez un). Toutes les données (clients, installations, historique) sont
stockées dans un simple fichier sur ce poste, dans `server/data.json`.

## 2. Installer Node.js (une seule fois, sur ce poste)

Télécharger et installer la version LTS depuis https://nodejs.org (choisir
"Windows Installer .msi"). Cocher l'option qui ajoute Node au PATH (cochée
par défaut).

Vérifier l'installation dans une invite de commande :
```
node --version
npm --version
```

## 3. Copier les fichiers et installer les dépendances

Copier tout le dossier `codification-web` sur le poste hôte, par exemple
dans `C:\Outils\codification-web`. Puis, dans une invite de commande :

```
cd C:\Outils\codification-web\server
npm install
```

Cette commande télécharge les 3 petites librairies utilisées (Express,
Archiver, CORS) — aucune compilation native n'est nécessaire, ça fonctionne
sur n'importe quel poste Windows sans outils de développement installés.

## 4. Démarrer le serveur

```
cd C:\Outils\codification-web\server
node server.js
```

La console affiche :
```
Codification projets — serveur démarré sur le port 3000
Accès local     : http://localhost:3000
Accès réseau LAN: http://<adresse-IP-de-ce-poste>:3000
```

Trouver l'adresse IP du poste avec `ipconfig` (ligne "Adresse IPv4").
Chaque collaborateur ouvre alors `http://<cette-IP>:3000` dans son
navigateur, depuis son propre poste, tant qu'il est sur le même réseau
d'entreprise.

**Important** : tant que cette fenêtre de commande reste ouverte, le serveur
tourne. Si vous la fermez, l'appli devient inaccessible pour tout le monde.
Pour un usage quotidien fiable, voir l'étape 5.

## 5. (Recommandé) Garder le serveur actif en permanence

Pour éviter de dépendre d'une fenêtre de commande ouverte, utiliser `pm2`,
un gestionnaire de processus qui redémarre le serveur automatiquement (y
compris après un redémarrage du poste) :

```
npm install -g pm2
npm install -g pm2-windows-startup
pm2-startup install
cd C:\Outils\codification-web\server
pm2 start server.js --name codification-projets
pm2 save
```

Le serveur tourne alors en arrière-plan en permanence. Commandes utiles :
```
pm2 status                        (voir si ça tourne)
pm2 logs codification-projets     (voir les logs)
pm2 restart codification-projets  (redémarrer)
```

## 6. Ouvrir le port dans le pare-feu Windows (si besoin)

Si les collègues n'arrivent pas à se connecter depuis leur poste, il faut
autoriser le port 3000 dans le pare-feu Windows du poste hôte :

Panneau de configuration → Pare-feu Windows Defender → Paramètres avancés →
Règles de trafic entrant → Nouvelle règle → Port → TCP → 3000 → Autoriser
la connexion.

## 7. Sauvegarde des données

Toutes les données vivent dans un seul fichier :
`server/data.json`. Pour sauvegarder, il suffit de copier ce fichier
régulièrement (par exemple vers votre serveur `\\servdatat`). Pour restaurer,
remplacer le fichier et redémarrer le serveur.

## 8. Données historiques déjà importées

`server/data.json` contient déjà l'import de `Suivi_Numero_Affaire.xls` :
258 clients et 1708 installations historiques. La numérotation des
**nouvelles** installations ajoutées via l'appli continue automatiquement
après le dernier numéro connu de chaque client (pas de collision avec
l'historique).

Le fichier `import_a_verifier.xlsx` à la racine du projet est le détail de
cet import (onglets Résumé / Collisions à trancher / Installations / Clients
sans installation) — à consulter en cas de doute sur un client ou un numéro
particulier. Une soixantaine de codes clients étaient présents sous des noms
légèrement différents dans deux onglets du fichier source (probablement des
renommages au fil des années) ; le nom le plus fréquent a été retenu
automatiquement — l'onglet "Collisions à trancher" liste ces cas si vous
voulez vérifier ou corriger un nom.

Si vous corrigez `import_a_verifier.xlsx` et voulez régénérer les données à
partir de la version corrigée :
```
cd server
python3 import_from_excel.py import_a_verifier.xlsx data.json
```
Cela écrase entièrement `data.json` — sauvegardez-le d'abord si des codes ou
un historique de génération ont déjà été créés depuis le lancement de
l'appli, car ils seraient perdus (l'historique des documents/programmes
générés, lui, n'existait pas dans le fichier Excel d'origine et ne peut donc
pas être régénéré par ce script).

## Évolutions possibles

- Changer le port : définir la variable d'environnement `PORT` avant de
  lancer (`set PORT=8080 && node server.js`).
- Passer sur un vrai nom de domaine interne ou un reverse proxy IIS si le
  périmètre grandit.
- Migrer `data.json` vers SQL Server si le volume d'utilisateurs ou de
  documents devient important — la logique métier est isolée dans
  `codification.js` et `db.js`, ce qui facilite la bascule plus tard.
