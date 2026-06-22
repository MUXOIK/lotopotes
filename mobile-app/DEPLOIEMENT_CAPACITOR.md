# Deploiement LotoPotes sur Android & iOS

## Prerequis sur ta machine locale

### Android
- Android Studio installe (https://developer.android.com/studio)
- Java 17+ (fourni avec Android Studio)
- SDK Android 33+

### iOS (Mac uniquement)
- Xcode 14+ installe depuis le App Store
- `sudo gem install cocoapods`
- Compte Apple Developer (99$/an pour publier)

---

## 1. Recuperer le code

```bash
# Clone ou telecharge le projet, puis :
cd mobile-app
npm install
```

## 2. Build de l'app web

```bash
npm run build
```

## 3. Initialiser Capacitor (premiere fois seulement)

```bash
npx cap init LotoPotes fr.lotopotes.app --web-dir dist
```

## 4. Ajouter les plateformes (premiere fois seulement)

```bash
npx cap add android
npx cap add ios        # Mac uniquement
```

## 5. Synchroniser le build web vers les projets natifs

```bash
npx cap sync
```
> A refaire apres chaque `npm run build`

---

## 6. Tester sur Android

```bash
npx cap open android
```
- Android Studio s'ouvre
- Brancher un telephone Android en mode debug (ou utiliser un emulateur)
- Cliquer sur le bouton ▶️ Run

**Ou directement depuis le terminal (si un appareil est connecte) :**
```bash
npx cap run android
```

## 7. Tester sur iOS (Mac uniquement)

```bash
npx cap open ios
```
- Xcode s'ouvre
- Selectionner un simulateur ou un iPhone connecte
- Cmd+R pour lancer

---

## 8. Workflow quotidien (apres modifications du code)

```bash
npm run build && npx cap sync
# puis relancer depuis Android Studio ou Xcode
```

---

## 9. Publier sur les stores

### Google Play Store
1. Dans Android Studio : Build → Generate Signed Bundle/APK → Android App Bundle
2. Creer un compte Google Play Console (25$ une fois)
3. Uploader le `.aab` dans Play Console

### Apple App Store
1. Dans Xcode : Product → Archive
2. Distribuer via App Store Connect
3. Compte Apple Developer requis (99$/an)

---

## Variables d'environnement

Le fichier `.env` contient deja les cles Supabase. Sur les stores, ces valeurs sont compilees dans le bundle — aucune configuration supplementaire necessaire.

---

## Notes importantes

- **L'app fonctionne aussi comme PWA** (Progressive Web App) directement depuis le navigateur mobile, sans stores.
- Le code syndicat (`LP-XXXX`) est genere a la creation et doit etre partage aux participants.
- Le mot de passe tresorier par defaut est : premier mot du nom du tresorier en MAJUSCULES.
  Ex: tresorier "Jean Philippe MARTIN" → mot de passe `JEAN`
