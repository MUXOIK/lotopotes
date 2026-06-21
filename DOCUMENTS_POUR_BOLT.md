# 📋 DOCUMENTS À ENVOYER À BOLT

## 📌 COMMENT ENVOYER À BOLT

**Tu as deux options :**

### **Option 1 : Via URL GitHub** (RECOMMANDÉ)
- Bolt peut accéder directement : https://github.com/MUXOIK/lotopotes
- Il récupère les fichiers source (index.html, server.js, data.json, etc.)
- Il voit l'historique des commits
- **À envoyer à Bolt** : Juste le lien GitHub + le PROMPT

### **Option 2 : Copier/coller les fichiers**
- Tu copie le contenu de chaque fichier dans le chat avec Bolt
- Moins pratique mais fonctionne

---

## 📁 FICHIERS CRITIQUES (à faire connaître à Bolt)

### **Frontend**
- **index.html** : L'application web complète
  - Récupère sur GitHub ou copie/colle le contenu

### **Backend**
- **server.js** : Node.js avec tous les endpoints API
  - Récupère sur GitHub ou copie/colle le contenu

### **Data**
- **data.json** : Historique des tirages gagnants (7)
- **data-scrape.json** : Tirage du jour scrappé (20/06)
- **data-count-tirages.json** : Compteur de tirages (9)
  - Tout sur GitHub, Bolt peut les voir

### **Config**
- **package.json** : Dépendances Node (express, cors)
- **.env.example** : Variables d'env (GITHUB_TOKEN, PORT)

---

## 📄 DOCUMENTS À ENVOYER (créés ce soir)

### **1. PROMPT_BOLT_COMPLET.md** ⭐ PRINCIPAL
**À COPIER/COLLER ENTIÈREMENT dans le chat Bolt**

Contient :
- Architecture complète (3 fichiers data)
- Explication de chaque page
- Endpoints API détaillés
- Issues à résoudre (Probabilités = PRIORITÉ)
- Workflow automatisé
- Checklist

**👉 C'est le document ESSENTIEL à envoyer**

### **2. DEPLOIEMENT_REFONTE.md** (optionnel)
Explique comment déployer sur Render
- Utile si Bolt doit redéployer
- Sinon pas obligatoire

### **3. Notes sur l'architecture** (optionnel)
- Pourquoi 3 fichiers data séparés
- Logique d'incrémentation du compteur
- Fallback historique

---

## 🎯 PROCÉDURE RECOMMANDÉE

### **Étape 1 : Envoie le PROMPT à Bolt**

```
Copie/colle ENTIÈREMENT le contenu de PROMPT_BOLT_COMPLET.md

Puis dis à Bolt :

"Je reprends mon projet 'Les Potes Millionnaires' avec toi.
Voici l'architecture, les fichiers, et ce qui reste à faire.

Repo GitHub : https://github.com/MUXOIK/lotopotes
Tu peux récupérer tous les fichiers directement de GitHub.

La PRIORITÉ : Réparer la page Probabilités (elle affiche 'Pas encore de données').

Dis-moi si tu as besoin de précisions sur l'architecture."
```

### **Étape 2 : Fais pointer Bolt vers GitHub**

```
"Voici le repo GitHub : https://github.com/MUXOIK/lotopotes

Tu peux :
- Cloner le repo
- Faire des modifications
- Pousser sur main
- Render redéploiera automatiquement (2-3 min)
"
```

### **Étape 3 : Priorité = Probabilités**

```
"La première tâche :
1. Ouvrir la page Probabilités (actuellement vide)
2. Elle appelle /api/stats qui retourne les données
3. À implémenter : affichage des statistiques
   - Fréquence des numéros
   - Paires gagnantes
   - Graphiques (optionnel)
"
```

---

## 📦 FICHIERS PHYSIQUES À ENVOYER

Tu peux télécharger et envoyer à Bolt (si tu veux être exhaustif) :

- ✅ **PROMPT_BOLT_COMPLET.md** ← OBLIGATOIRE
- ✅ **DEPLOIEMENT_REFONTE.md** ← Optionnel
- ✅ **server.js** ← Pour info (Bolt verra sur GitHub)
- ✅ **index.html** ← Pour info (Bolt verra sur GitHub)
- ✅ **package.json** ← Pour info (Bolt verra sur GitHub)

**Mais franchement, le PROMPT suffit + le lien GitHub.**

---

## ✅ CHECKLIST POUR TOI

Avant d'envoyer à Bolt :

- [ ] Tu as copié PROMPT_BOLT_COMPLET.md entièrement
- [ ] Tu as l'URL GitHub : https://github.com/MUXOIK/lotopotes
- [ ] Tu as noté que Probabilités est la PRIORITÉ
- [ ] Tu as expliqué à Bolt l'architecture à 3 fichiers data

---

## 🚀 C'EST PRÊT !

**Tu peux maintenant envoyer ça à Bolt et te reposer !** 😴

Bolt prendra le relais et réparera la page Probabilités. 👍
