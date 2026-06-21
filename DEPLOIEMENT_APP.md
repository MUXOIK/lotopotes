# Les Potes Millionnaires — App Déploiement

## Structure du projet

```
/
├── server.js          # Backend Node.js (deploy sur Render)
├── app/               # Frontend React PWA (deploy sur Vercel/Netlify/GitHub Pages)
│   ├── src/
│   ├── dist/          # Build prêt à déployer
│   └── package.json
├── data.json          # Historique gains (sauvegardé sur GitHub)
├── data-scrape.json   # Dernier tirage scrappé
└── data-count-tirages.json
```

---

## Option 1 : Déployer en tant que PWA (Recommandé)

La PWA est **installable directement depuis le navigateur** sur iOS et Android — pas besoin de passer par les stores.

### Build

```bash
cd app
npm run build
# → dist/ est prêt
```

### Déploiement sur Vercel (recommandé)

```bash
cd app
npx vercel --prod
```

### Déploiement sur Netlify

```bash
cd app
npx netlify deploy --prod --dir dist
```

### Déploiement sur GitHub Pages

Dans `app/vite.config.ts`, ajouter `base: '/lotopotes/'` puis :

```bash
cd app
npm run build
# Copier dist/ vers la branche gh-pages
```

---

## Option 2 : Packager pour les Stores (iOS / Android)

### Prérequis

- Node.js 18+
- Pour iOS : Mac + Xcode 14+
- Pour Android : Android Studio + SDK

### Avec Capacitor

```bash
# 1. Installer Capacitor
cd app
npm install @capacitor/core @capacitor/cli @capacitor/ios @capacitor/android

# 2. Initialiser
npx cap init "Les Potes Millionnaires" "fr.lotopotes.app" --web-dir dist

# 3. Build web
npm run build

# 4. Ajouter les plateformes
npx cap add ios
npx cap add android

# 5. Synchroniser
npx cap sync

# 6. Ouvrir dans Xcode / Android Studio
npx cap open ios
npx cap open android
```

### Avec Expo (alternative React Native)

Pour un vrai build natif avec hot reload, Expo est une alternative complète.
Mais la PWA Capacitor est suffisante pour les stores si l'app est bien construite.

---

## Option 3 : Déploiement sur les Stores via PWABuilder

PWABuilder.com permet de packager une PWA pour :
- Microsoft Store (direct)
- Google Play Store (via Trusted Web Activity)
- Apple App Store (via WKWebView wrapper)

**Procédure :**
1. Déployer la PWA sur Vercel/Netlify
2. Aller sur https://www.pwabuilder.com
3. Entrer l'URL de l'app
4. Télécharger les packages pour chaque store

---

## Mise à jour de l'app

```bash
cd app
npm run build
# Re-déployer sur Vercel/Netlify
# La PWA se met à jour automatiquement sur les appareils des utilisateurs
```

---

## Variables d'environnement

Le fichier `.env` est déjà configuré automatiquement avec les clés Supabase.

Pour le backend (Render), les variables suivantes doivent être définies :
- `GITHUB_TOKEN` : Token GitHub pour lire/écrire les fichiers data
- `GITHUB_REPO` : Repo GitHub (ex: `MUXOIK/lotopotes`)
- `PORT` : Port du serveur (défaut : 3000)

---

## Mots de passe

- **Accès app** : `POTES`
- **Admin** : `MILLION`

⚠️ Ces mots de passe sont dans le code source. Pour une vraie sécurité, les déplacer en variables d'env ou en base de données.
