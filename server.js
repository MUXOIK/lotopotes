const express = require('express');
const cors = require('cors');
const https = require('https');

const app = express();
app.use(cors());

// Les 5 grilles du syndicat (FIXES) - numéros principaux
const GRILLES = [
  [7, 12, 23, 34, 45],
  [6, 15, 28, 39, 48],
  [3, 18, 31, 42, 49],
  [8, 19, 32, 41, 46],
  [5, 22, 29, 35, 44]
];

// Numéros chance par grille (les 5 moins sortis depuis 2008, stats FDJ)
const CHANCES = [9, 6, 4, 1, 7];

// Les 13 participants
const PARTICIPANTS = [
  'ANOUFA Fabienne & Moïse',
  'BELLALOU Martine & Patrick',
  'GRINAL Danielle & Serge',
  'HOCHBERG Nathalie & Bruno',
  'JURIS Virgine & Frédéric',
  'KIMAN Laurence & Didier',
  'LEVIN Gabrielle & Didier',
  'MESGUICH Corinne & Jean Philippe',
  'OIKNINE Muriel & Aaron',
  'PARTOUCHE Sylvie & Serge',
  'SITBON Leslie & OHAYON Gilles',
  'TEMAN Eva & FINKELSTEIN Philippe',
  'WEITZMANN Dalia & Jacques'
];

// Stockage en mémoire
let allTirages = [];
let distribution = {};
let cagnotte = 0;
let lastError = '';

// Init distribution
PARTICIPANTS.forEach(p => {
  distribution[p] = { gains: 0, solde: -180 };
});

// Mois français -> numéro
const MOIS = {
  'janvier': '01', 'février': '02', 'mars': '03', 'avril': '04',
  'mai': '05', 'juin': '06', 'juillet': '07', 'août': '08',
  'septembre': '09', 'octobre': '10', 'novembre': '11', 'décembre': '12'
};

function fetchFromUrl(hostname, path) {
  return new Promise((resolve) => {
    const options = {
      hostname,
      path,
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'fr-FR,fr;q=0.9',
        'Cache-Control': 'no-cache'
      },
      timeout: 20000
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => resolve({ ok: true, data, status: res.statusCode }));
    });
    req.on('error', err => resolve({ ok: false, error: err.message }));
    req.on('timeout', () => { req.destroy(); resolve({ ok: false, error: 'timeout' }); });
    req.end();
  });
}

async function fetchLotoResults() {
  console.log('[LOG] === Scraping secretsdujeu.com ===');

  const res = await fetchFromUrl('www.secretsdujeu.com', '/page/jeux_loto_resultats.html');
  if (!res.ok || res.status !== 200) {
    lastError = 'Erreur HTTP secretsdujeu: ' + (res.error || res.status);
    console.log('[LOG] ❌ ' + lastError);
    return null;
  }

  const html = res.data;
  console.log('[LOG] HTML reçu: ' + html.length + ' caractères');

  // ===== DATE =====
  // Pattern: "Tirage du Loto FDJ du lundi 25 mai 2026" ou "Tirage du 25/05/2026"
  let tirageDate = null;
  const datePattern1 = /tirage\s+(?:du\s+)?loto[^<]{0,50}(\d{1,2})\s+(janvier|f[eé]vrier|mars|avril|mai|juin|juillet|ao[uû]t|septembre|octobre|novembre|d[eé]cembre)\s+(\d{4})/i;
  const dm1 = datePattern1.exec(html);
  if (dm1) {
    const jour = dm1[1].padStart(2, '0');
    const mois = MOIS[dm1[2].toLowerCase().replace('é','e').replace('û','u').replace('é','e')] || '01';
    tirageDate = `${dm1[3]}-${mois}-${jour}T20:50:00.000Z`;
    console.log('[LOG] ✅ Date trouvée: ' + tirageDate);
  }

  // Fallback date: calculer le dernier tirage loto (lun/mer/sam)
  if (!tirageDate) {
    console.log('[LOG] ⚠️ Date non parsée, calcul dernier tirage');
    const now = new Date();
    const day = now.getDay();
    const lotoJours = [1, 3, 6];
    let daysBack = 0;
    for (let i = 0; i <= 7; i++) {
      if (lotoJours.includes(((day - i) + 7) % 7)) { daysBack = i; break; }
    }
    const last = new Date(now);
    last.setDate(now.getDate() - daysBack);
    if (daysBack === 0 && now.getHours() < 21) {
      for (let i = 1; i <= 7; i++) {
        if (lotoJours.includes(((day - i) + 7) % 7)) {
          last.setDate(now.getDate() - i); break;
        }
      }
    }
    last.setHours(20, 50, 0, 0);
    tirageDate = last.toISOString();
  }

  // ===== NUMÉROS =====
  // secretsdujeu affiche les boules dans des balises simples
  // On cherche les séquences de 1-2 chiffres dans le HTML autour de la zone résultats
  let nums = [], chance = null, nums2 = [];

  // Stratégie: chercher les divs/spans contenant uniquement 1 ou 2 chiffres (1-49 pour boules, 1-10 pour chance)
  const boulePattern = /(?:class="[^"]*(?:boule|ball|num|numero|result)[^"]*"[^>]*>|<(?:span|div|td|li)[^>]*>)\s*(\d{1,2})\s*<\//gi;
  let m;
  const candidates = [];
  while ((m = boulePattern.exec(html)) !== null) {
    const n = parseInt(m[1]);
    if (n >= 1 && n <= 49) candidates.push(n);
  }
  console.log('[LOG] Candidats boules: ' + candidates.slice(0, 20).join(','));

  // Chercher blocs de 5 numéros consécutifs valides (1-49) pour le 1er tirage
  // + 1 numéro chance (1-10) + 5 pour le 2nd tirage
  if (candidates.length >= 5) {
    nums = candidates.slice(0, 5);
    // Le numéro chance est entre 1 et 10
    for (let i = 5; i < Math.min(candidates.length, 15); i++) {
      if (candidates[i] >= 1 && candidates[i] <= 10) {
        chance = candidates[i];
        // 2nd tirage = les 5 suivants
        nums2 = candidates.slice(i + 1, i + 6);
        break;
      }
    }
    if (!chance && candidates[5]) {
      chance = candidates[5];
      nums2 = candidates.slice(6, 11);
    }
  }

  // ===== MONTANTS RÉELS =====
  // secretsdujeu affiche un tableau avec les gains réels du tirage
  const rapportGains = {};

  // Chercher les montants dans le tableau des gains
  // Format: "116 033,90 €" ou "1 089,20 €"
  const montantPattern = /(\d[\d\s]*[\d]),(\d{2})\s*€/g;
  const montants = [];
  while ((m = montantPattern.exec(html)) !== null) {
    const valStr = m[1].replace(/\s/g, '') + '.' + m[2];
    montants.push(parseFloat(valStr));
  }
  console.log('[LOG] Montants trouvés: ' + montants.join(', '));

  // Les montants dans le tableau sont dans l'ordre des rangs:
  // rang2(5bons), rang3(4+1), rang4(4bons), rang5(3+1), rang6(3bons), rang7(2+1), rang8(2bons), rang9(1+1)
  // "Pas de gagnant" = 0
  // On cherche aussi les "Pas de gagnant" pour le rang 1 (jackpot)
  const pasGagnant = (html.match(/Pas de gagnant/gi) || []).length;
  console.log('[LOG] "Pas de gagnant" count: ' + pasGagnant);

  if (montants.length >= 7) {
    rapportGains['5+1'] = 0; // jackpot: si pas de gagnant on met 0
    rapportGains['5']   = montants[0] || 0;
    rapportGains['4+1'] = montants[1] || 0;
    rapportGains['4']   = montants[2] || 0;
    rapportGains['3+1'] = montants[3] || 0;
    rapportGains['3']   = montants[4] || 0;
    rapportGains['2+1'] = montants[5] || 0;
    rapportGains['2']   = montants[6] || 0;
    rapportGains['1+1'] = montants[7] || 2.20;
    console.log('[LOG] ✅ Montants réels récupérés depuis le HTML');
  } else {
    // Fallback montants standards FDJ (moyennes historiques)
    console.log('[LOG] ⚠️ Montants non parsés, utilisation standards FDJ');
    rapportGains['5+1'] = 0;
    rapportGains['5']   = 100000;
    rapportGains['4+1'] = 1000;
    rapportGains['4']   = 500;
    rapportGains['3+1'] = 50;
    rapportGains['3']   = 20;
    rapportGains['2+1'] = 9;
    rapportGains['2']   = 4;
    rapportGains['1+1'] = 2.20;
  }

  if (nums.length < 5) {
    lastError = 'Numéros non trouvés dans le HTML';
    console.log('[LOG] ❌ ' + lastError);
    console.log('[LOG] Extrait HTML (2000 chars): ' + html.substring(0, 2000));
    return null;
  }

  console.log('[LOG] ✅ Résultat: nums=' + nums.join(',') + ' chance=' + chance + ' nums2=' + nums2.join(','));
  return { nums, chance, nums2, date: tirageDate, rapportGains };
}

function tirageDejàEnregistré(tirage) {
  return allTirages.some(t =>
    t.nums.join(',') === tirage.nums.join(',') &&
    t.date.split('T')[0] === tirage.date.split('T')[0]
  );
}

function calculerGains(grille, nums, chanceGrille, chancetirage, rapportGains) {
  const numsMatches = nums.filter(n => grille.includes(n)).length;
  const chanceMatch = (chanceGrille === chancetirage);

  if (numsMatches === 5 && chanceMatch) return rapportGains['5+1'] || 0;
  if (numsMatches === 5)               return rapportGains['5'] || 0;
  if (numsMatches === 4 && chanceMatch) return rapportGains['4+1'] || 0;
  if (numsMatches === 4)               return rapportGains['4'] || 0;
  if (numsMatches === 3 && chanceMatch) return rapportGains['3+1'] || 0;
  if (numsMatches === 3)               return rapportGains['3'] || 0;
  if (numsMatches === 2 && chanceMatch) return rapportGains['2+1'] || 0;
  if (numsMatches === 2)               return rapportGains['2'] || 0;
  if (numsMatches <= 1 && chanceMatch) return rapportGains['1+1'] || 0;
  return 0;
}

app.get('/api/loto-complet', async (req, res) => {
  try {
    console.log('\n[LOG] === APPEL /api/loto-complet ===');
    const tirage = await fetchLotoResults();

    if (!tirage) {
      return res.status(500).json({ success: false, error: 'Impossible de récupérer les résultats: ' + lastError });
    }

    if (!tirageDejàEnregistré(tirage)) {
      console.log('[LOG] 📊 Nouveau tirage, calcul gains...');
      let gainsTotal = 0;
      GRILLES.forEach((grille, idx) => {
        const gains = calculerGains(grille, tirage.nums, CHANCES[idx], tirage.chance, tirage.rapportGains);
        gainsTotal += gains;
        console.log('[LOG] Grille ' + (idx+1) + ' (chance=' + CHANCES[idx] + '): ' + gains + '€');
      });

      cagnotte += gainsTotal;
      console.log('[LOG] 💰 Cagnotte totale: ' + cagnotte + '€');

      if (cagnotte >= 650) {
        console.log('[LOG] 💸 DISTRIBUTION 650€!');
        const parPerson = 650 / 13;
        PARTICIPANTS.forEach(p => {
          distribution[p].gains += parPerson;
          distribution[p].solde += parPerson;
        });
        cagnotte -= 650;
      }

      allTirages.push({
        nums: tirage.nums,
        chance: tirage.chance,
        nums2: tirage.nums2,
        gains: gainsTotal,
        rapportGains: tirage.rapportGains,
        date: tirage.date
      });
    } else {
      console.log('[LOG] Tirage déjà enregistré, pas de recalcul');
    }

    res.json({
      success: true,
      tirage,
      cagnotte: cagnotte.toFixed(2),
      distribution,
      historique: allTirages.slice(-10),
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.log('[LOG] ❌ Erreur globale: ' + error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/bilan', (req, res) => {
  const bilanArray = PARTICIPANTS.map((name, idx) => ({
    id: idx + 1,
    name,
    gains: distribution[name].gains.toFixed(2),
    solde: distribution[name].solde.toFixed(2)
  }));
  const gainsTotal = Object.values(distribution).reduce((sum, d) => sum + d.gains, 0);
  res.json({
    success: true,
    participants: bilanArray,
    gainsTotal: gainsTotal.toFixed(2),
    soldeTotal: (gainsTotal - 2340).toFixed(2),
    cagnotte: cagnotte.toFixed(2),
    timestamp: new Date().toISOString()
  });
});

app.get('/api/stats', (req, res) => {
  const gainsTotal = Object.values(distribution).reduce((sum, d) => sum + d.gains, 0);
  res.json({
    success: true,
    tiragesEffectues: allTirages.length,
    gainsTotal: gainsTotal.toFixed(2),
    roi: gainsTotal > 0 ? ((gainsTotal / 2340) * 100).toFixed(1) + '%' : '0.0%',
    cagnotte: cagnotte.toFixed(2),
    historique: allTirages.slice(-10),
    timestamp: new Date().toISOString()
  });
});

app.get('/api/test', (req, res) => {
  res.json({ message: 'Backend opérationnel', timestamp: new Date().toISOString() });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('✅ Backend démarré sur port ' + PORT));

// Route debug: affiche le HTML brut reçu de secretsdujeu
app.get('/api/debug-html', async (req, res) => {
  const result = await fetchFromUrl('www.secretsdujeu.com', '/page/jeux_loto_resultats.html');
  if (!result.ok) return res.json({ error: result.error });
  // On retourne les 8000 premiers caractères pour voir la structure
  res.json({
    status: result.status,
    length: result.data.length,
    extrait: result.data.substring(0, 8000)
  });
});
