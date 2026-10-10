# Floppy Bird 🐤

Un jeu d'arcade à une touche, dans l'esprit de Flappy Bird, pensé pour le téléphone.
Vole entre les tuyaux, enchaîne les passages **parfaits** et bats ton record.

## Ce qui rend le jeu addictif

- **Une seule touche** : tape l'écran (ou Espace / ↑ au clavier) pour battre des ailes.
- **Combos PARFAIT** : passe pile au centre d'un trou pour gagner des points bonus.
  Plus tu enchaînes, plus ça rapporte (jusqu'à +6 par tuyau).
- **Difficulté progressive** : les tuyaux accélèrent, les trous rétrécissent et,
  à partir de 5 points, certains tuyaux se mettent à bouger (signalés par des flèches).
- **4 ambiances** qui changent tous les 15 points : jour, crépuscule, nuit, néon.
- **Médailles** : bronze (10), argent (25), or (50), platine (100).
- **6 oiseaux** qui s'équipent automatiquement selon ton record : Jaune, Tomate (10),
  Glacier (25), Ninja (40), Or massif (60), Arc-en-ciel (100).
- **Interface minimaliste** : un bouton Start, un bouton Restart, rien d'autre.
- **Rejouer instantané**, sons synthétisés, vibrations (Android), pause automatique
  quand on quitte l'appli.

## Structure

```
index.html            page et menus
style.css             style des menus
game.js               moteur du jeu (physique, rendu, sons, sauvegarde)
manifest.webmanifest  infos pour l'installer comme une appli
sw.js                 service worker : fonctionne hors ligne
icons/                icônes de l'appli
tools/make-icons.mjs  régénère les icônes PNG depuis icons/icon.svg
.github/workflows/deploy.yml  déploiement automatique sur GitHub Pages
```

Aucune dépendance, aucun build : c'est du HTML/CSS/JavaScript pur.

## Jouer en local

```bash
python3 -m http.server 8000
```

Puis ouvre http://localhost:8000.

## Déployer (gratuit) avec GitHub Pages

1. Sur GitHub, va dans **Settings → Pages**.
2. Dans **Source**, choisis **GitHub Actions** (ou « Deploy from a branch », `main`, `/ (root)` :
   les deux fonctionnent, le jeu est à la racine).
3. Le jeu est publié sur `https://<ton-pseudo>.github.io/Game-project/`.

## L'installer sur le téléphone

Ouvre l'adresse du jeu sur ton téléphone, puis :

- **Android (Chrome)** : menu ⋮ → **Installer l'application** / **Ajouter à l'écran d'accueil**.
- **iPhone (Safari)** : bouton Partager → **Sur l'écran d'accueil**.

Le jeu s'ouvre alors en plein écran, comme une vraie appli, et marche hors ligne.

## Aller plus loin : Play Store / App Store

Le jeu peut être empaqueté en appli native avec [Capacitor](https://capacitorjs.com/) :

```bash
mkdir www && cp -r index.html game.js style.css sw.js manifest.webmanifest icons www/
npm init -y
npm install @capacitor/core @capacitor/cli @capacitor/android
npx cap init "Floppy Bird" com.tonnom.floppybird --web-dir www
npx cap add android
npx cap open android   # ouvre Android Studio pour générer l'APK / l'AAB
```

(Pour iOS : `@capacitor/ios` et `npx cap add ios`, nécessite un Mac avec Xcode.)

## Régler la difficulté

Tout est en haut de `game.js`, dans l'objet `CFG` : gravité, force du battement,
vitesse, taille des trous, etc. Après une modification, change `VERSION` dans
`sw.js` pour que les téléphones récupèrent la nouvelle version.
