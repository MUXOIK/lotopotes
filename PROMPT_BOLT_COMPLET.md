# 🎯 MIGRATION BOLT - LES POTES MILLIONNAIRES

## 📌 CONTEXTE

Tu vas reprendre la gestion complète du projet "Les Potes Millionnaires" - un syndic Loto pour 13 participants (saison 2026-2027, depuis 1er juin).

**Repo GitHub :** https://github.com/MUXOIK/lotopotes
- Frontend : GitHub Pages (`https://muxoik.github.io/lotopotes/`)
- Backend : Node.js sur Render (`https://lotopotes-1.onrender.com`)

---

## 🏗️ ARCHITECTURE (CRITIQUE À COMPRENDRE)

### **Trois fichiers data SÉPARÉS et DISTINCTS :**

1. **data.json** = Historique des GAINS UNIQUEMENT
   - Contient seulement les tirages gagnants (7 actuellement)
   - Champs : nums, chance, nums2, gains, rapportGains, rapportGains2, date
   - Utilisé par : page Historique + Probabilités + calcul cagnotte
   - Mis à jour SEULEMENT si un tirage a des gains > 0

2. **data-scrape.json** = Tirage du jour scrappé
   - Contient le dernier tirage scrappé (du 20/06 actuellement)
   - Champs : tirage{nums, chance, nums2, date, rapportGains, rapportGains2}
   - Utilisé par : page Accueil (bandeau "ON A GAGNÉ")
   - Mis à jour automatiquement chaque tirage (même sans gains)

3. **data-count-tirages.json** = Compteur de tirages joués
   - Contient simplement : `{"nombre_tirages": 9}`
   - Utilisé par : page Bilan (ROI, gain moyen, tirages joués)
   - Incrémenté automatiquement quand nouveau tirage scrappé

**IMPORTANT :** Ces trois fichiers ne doivent JAMAIS être mélangés. Chacun a un usage DISTINCT.

---

## 📱 PAGES DE L'APPLICATION

### **1. Accueil (index.html)**
- **Bandeau principal** : Affiche le tirage du jour (data-scrape.json) avec les gains
- **Si gains** : Affiche "ON A GAGNÉ" + montant en vert
- **Si pas de gains** : Affiche le tirage sans gains
- **Endpoint API** : `/api/loto-complet` (scrape + retourne tirage + historique + distribution)

### **2. Historique**
- **Affiche** : Liste des 7 tirages gagnants (data.json)
- **Colonnes** : Date, Numéros 1er, Chance, Numéros 2nd, Gains
- **Endpoint API** : `/api/loto-complet` (récupère historique)

### **3. Bilan (Stats principales)**
- **Affichage** :
  - Gain distribué à date (toujours 0.00€ car pas de distribution aux participants)
  - Gain total annuel (42.50€ = cagnotte)
  - Solde du syndic (-2297.50€ = 13 × 180€ - 42.50€)
  - Tirages joués (9)
  - ROI (1.8%)
  - Gain moyen / tirage
  - Gain par participant
- **Endpoint API** : `/api/bilan` (retourne gainsTotal, tiragesEffectues, distribution, cagnotte)

### **4. Historique détaillé**
- **Affiche** : Tableau complet avec tous les tirages gagnants
- **Endpoint API** : `/api/loto-complet`

### **5. Paiements**
- Pas encore implémenté (à faire)

### **6. Probabilités** ⚠️ **À RÉPARER**
- **Actuellement** : Affiche "Pas encore de données" (page vide)
- **À corriger** : Doit afficher les statistiques (fréquences, paires gagnantes, etc.)
- **Endpoint API** : `/api/stats` (retourne historique + distribution + cagnotte)
- **Problème connu** : `const data = await resp.json()` était manquant dans loadProbabilites()
- **Statut** : Code frontend fixé, mais affichage des stats à implémenter correctement

### **7. Contrat**
- Page de présentation des règles du syndic

### **8. Admin** 
- Page d'administration (password protégée : "MILLION")

---

## 🔧 ENDPOINTS API (server.js)

### **GET /api/loto-complet**
```javascript
Retourne :
{
  success: boolean,
  tirage: {
    nums: [int],
    chance: int,
    nums2: [int],
    date: ISO8601,
    rapportGains: {montants},
    rapportGains2: {montants},
    gainTotal: float,
    gainsDetails: [{grille, tirage, gain}]
  },
  historique: [tirages gagnants],
  distribution: {PARTICIPANT: {gains, solde}},
  cagnotte: float
}

Logique :
1. Si cache valide (2-3 jours) → retourne tirageScrape (data-scrape.json)
2. Sinon → scrape FDJ, calcule gains, sauvegarde dans data-scrape.json
3. Si gains > 0 → ajoute aussi à data.json (historique)
4. Si nouveau tirage → incrémente nombreTirages dans data-count-tirages.json
```

### **GET /api/stats**
```javascript
Retourne : {historique, distribution, cagnotte}
Utilisé par : page Probabilités
```

### **GET /api/bilan**
```javascript
Retourne :
{
  success: true,
  gainsTotal: 42.50,
  tiragesEffectues: 9,  // ← DEPUIS data-count-tirages.json
  distribution: {...},
  cagnotte: 42.50
}
```

### **GET /api/test**
```javascript
Retourne : {ok, allGains, cagnotte, GITHUB_TOKEN}
(Pour vérifier que tout fonctionne)
```

---

## 🐛 ISSUES À RÉSOUDRE / AMÉLIORER

### **CRITIQUE :**
1. **Page Probabilités vide** 
   - Affiche "Pas encore de données" au lieu des stats
   - À implémenter : calcul des fréquences, paires gagnantes, écarts, etc.
   - Endpoint API fonctionne (`/api/stats`), c'est l'affichage qui manque

### **SECONDAIRE :**
1. **Page Paiements** : À implémenter complètement
2. **Page Admin** : Actuellement basique, peut être améliorée

---

## 📊 DATA ACTUELLE (21 juin 2026)

### **data.json** (7 tirages gagnants)
- 03/06 : 5.20€
- 06/06 : 7.30€
- 08/06 : 9.00€
- 10/06 : 0€ (tirage sans gain mais enregistré)
- 13/06 : 7.50€
- 15/06 : 2.20€
- 17/06 : 11.30€

**Cagnotte totale : 42.50€**

### **data-scrape.json** (tirage du jour)
- 20/06 : 5-16-31-37-41, Chance 5
- Numéros 2nd : 3-9-13-40-46
- Gains : 0€

### **data-count-tirages.json**
- Nombre total de tirages joués depuis 1er juin : **9**

### **Distribution des participants**
- 13 participants
- Cotisation : 180€ par participant par saison (27.69€ / mois)
- Tous avec solde négatif (-180€) car gains < cotisation

---

## 🚀 WORKFLOW AUTOMATISÉ

### **Chaque jour de tirage (lundi, mercredi, samedi à 20h50)**

1. **Frontend appelle `/api/loto-complet`**
2. **Backend scrape FDJ** :
   - Récupère numéros + gains
   - Parse les rapports de gains
3. **Sauvegarde dans data-scrape.json** (toujours)
4. **Si gains > 0** :
   - Ajoute tirage à data.json
   - Incrémenter cagnotte
   - Incrémenter nombreTirages dans data-count-tirages.json
5. **Si gains = 0** :
   - Sauvegarder quand même dans data-scrape.json
   - Incrémenter nombreTirages dans data-count-tirages.json
6. **Frontend affiche** :
   - Bandeau "ON A GAGNÉ" si gains > 0
   - Sinon "Aucun gain"

---

## 🔐 SÉCURITÉ

- **Password Accueil** : "POTES"
- **Password Admin** : "MILLION"
- **GitHub Token** : Variable d'env `GITHUB_TOKEN` (déjà configurée sur Render)
- **GitHub Repo** : MUXOIK/lotopotes (privé)

---

## 📝 TÂCHES PRIORITAIRES

### **URGENT (cette semaine)**
1. **Réparer page Probabilités** : Implémenter l'affichage des statistiques
   - Fréquence des numéros
   - Paires gagnantes
   - Écarts / tendances
   - Graphiques (optionnel)

### **IMPORTANT (cette semaine ou prochaine)**
1. **Page Paiements** : Implémenter le système de distribution
   - Afficher qui a reçu combien
   - Historique des paiements

### **OPTIONNEL (plus tard)**
1. Améliorer design/UX
2. Ajouter notifications
3. Ajouter export PDF/Excel

---

## 🛠️ POUR PRENDRE EN CHARGE LE PROJET

1. **Clone le repo** : https://github.com/MUXOIK/lotopotes
2. **Récupère les fichiers data de GitHub** (ils sont déjà en place)
3. **Modifie** : index.html (frontend) et server.js (backend)
4. **Teste localement** ou pousse directement sur GitHub (Render redéploie automatiquement)
5. **Utilise l'API GitHub** pour sauvegarder les changements dans les fichiers data

---

## 📞 CONTACTS / INFOS IMPORTANTES

- **Render** : Service gratuit (Free tier), spin down après inactivité → délai 50 sec
- **GitHub Pages** : Frontend accessible immédiatement
- **Redéploiement** : Automatique quand tu push sur GitHub (2-3 min)

---

## ✅ CHECKLIST AVANT DE COMMENCER

- [ ] Accès au repo GitHub MUXOIK/lotopotes
- [ ] Comprendre l'architecture à 3 fichiers data
- [ ] Comprendre les endpoints API
- [ ] Identifier que "Probabilités" est la priorité
- [ ] Vérifier que Render déploie correctement après changes
- [ ] Tester `/api/test` pour voir l'état du serveur

---

**Bonne chance et n'hésite pas si tu as des questions !** 🚀
