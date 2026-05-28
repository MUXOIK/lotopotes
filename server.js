const express = require('express');
const cors = require('cors');
const https = require('https');

const app = express();
app.use(cors());

const GRILLES = [
  [7, 12, 23, 34, 45],
  [6, 15, 28, 39, 48],
  [3, 18, 31, 42, 49],
  [8, 19, 32, 41, 46],
  [5, 22, 29, 35, 44]
];
const CHANCES = [9, 6, 4, 1, 7];

const PARTICIPANTS = [
  'ANOUFA Fabienne & Moïse','BELLALOU Martine & Patrick','GRINAL Danielle & Serge',
  'HOCHBERG Nathalie & Bruno','JURIS Virgine & Frédéric','KIMAN Laurence & Didier',
  'LEVIN Gabrielle & Didier','MESGUICH Corinne & Jean Philippe','OIKNINE Muriel & Aaron',
  'PARTOUCHE Sylvie & Serge','SITBON Leslie & OHAYON Gilles','TEMAN Eva & FINKELSTEIN Philippe',
  'WEITZMANN Dalia & Jacques'
];

let allTirages = [];
let distribution = {};
let cagnotte = 0;
let lastError = '';
PARTICIPANTS.forEach(p => { distribution[p] = { gains: 0, solde: -180 }; });

function fetchFromUrl(hostname, path) {
  return new Promise((resolve) => {
    const options = {
      hostname, path, method: 'GET',
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
    lastError = 'Erreur HTTP: ' + (res.error || res.status);
    console.log('[LOG] ❌ ' + lastError);
    return null;
  }

  const html = res.data;
  console.log('[LOG] HTML reçu: ' + html.length + ' chars');

  // ===== DATE via JSON-LD dateModified (fiable à 100%) =====
  let tirageDate = null;
  const dateMatch = /"dateModified":"(\d{4}-\d{2}-\d{2})/.exec(html);
  if (dateMatch) {
    tirageDate = dateMatch[1] + 'T20:50:00.000Z';
    console.log('[LOG] ✅ Date JSON-LD: ' + tirageDate);
  } else {
    // Fallback: calculer dernier tirage loto
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
        if (lotoJours.includes(((day - i) + 7) % 7)) { last.setDate(now.getDate() - i); break; }
      }
    }
    last.setHours(20, 50, 0, 0);
    tirageDate = last.toISOString();
    console.log('[LOG] ⚠️ Date calculée: ' + tirageDate);
  }

  // ===== NUMÉROS via JSON-LD ou patterns HTML précis =====
  let nums = [], chance = null, nums2 = [];

  // Stratégie 1: chercher dans le JSON-LD structured data les numéros
  // secretsdujeu embed parfois les numéros dans des balises data-* ou script
  
  // Stratégie 2: chercher le bloc résultat principal
  // Le HTML contient des séquences comme: >3<...>4<...>15<...>17<...>41<  puis >4< (chance) puis >9<...>25<
  // On cherche un bloc de 5 nombres 1-49 distincts et croissants
  
  // Chercher tous les nombres isolés dans des balises
  const allNums = [];
  const numPattern = /(?:<[^>]+>)\s*(\d{1,2})\s*(?:<\/)/g;
  let m;
  while ((m = numPattern.exec(html)) !== null) {
    const n = parseInt(m[1]);
    if (n >= 1 && n <= 49) allNums.push(n);
  }
  console.log('[LOG] Tous nums trouvés (premiers 50): ' + allNums.slice(0, 50).join(','));

  // Trouver 5 nombres consécutifs dans allNums qui forment un tirage valide:
  // - tous entre 1 et 49
  // - tous distincts
  // Puis le suivant entre 1-10 = numéro chance
  // Puis 5 autres = 2nd tirage
  
  for (let i = 0; i <= allNums.length - 6; i++) {
    const candidate = allNums.slice(i, i + 5);
    const isValid = candidate.every(n => n >= 1 && n <= 49) &&
                    new Set(candidate).size === 5;
    if (isValid) {
      // Chercher le numéro chance parmi les suivants (doit être 1-10)
      for (let j = i + 5; j < Math.min(i + 15, allNums.length); j++) {
        if (allNums[j] >= 1 && allNums[j] <= 10) {
          const candidateNums2 = allNums.slice(j + 1, j + 6);
          const isValid2 = candidateNums2.length === 5 &&
                           candidateNums2.every(n => n >= 1 && n <= 49) &&
                           new Set(candidateNums2).size === 5;
          if (isValid2) {
            nums = candidate;
            chance = allNums[j];
            nums2 = candidateNums2;
            console.log('[LOG] ✅ Trouvé à index ' + i + ': nums=' + nums + ' chance=' + chance + ' nums2=' + nums2);
            break;
          }
        }
      }
      if (nums.length === 5) break;
    }
  }

  // ===== MONTANTS RÉELS =====
  const rapportGains = {};
  // Chercher les montants format "116 033,90" ou "1 089,20"
  const montantPattern = /(\d[\d\s]{0,8}),(\d{2})\s*(?:€|&euro;)/g;
  const montants = [];
  while ((m = montantPattern.exec(html)) !== null) {
    const val = parseFloat(m[1].replace(/\s/g, '') + '.' + m[2]);
    if (val >= 2 && val <= 10000000) montants.push(val);
  }
  console.log('[LOG] Montants trouvés: ' + montants.join(', '));

  if (montants.length >= 7) {
    rapportGains['5+1'] = 0;
    rapportGains['5']   = montants[0];
    rapportGains['4+1'] = montants[1];
    rapportGains['4']   = montants[2];
    rapportGains['3+1'] = montants[3];
    rapportGains['3']   = montants[4];
    rapportGains['2+1'] = montants[5];
    rapportGains['2']   = montants[6];
    rapportGains['1+1'] = montants[7] || 2.20;
    console.log('[LOG] ✅ Montants réels: 5bons=' + rapportGains['5'] + '€');
  } else {
    console.log('[LOG] ⚠️ Fallback montants standards');
    Object.assign(rapportGains, {'5+1':0,'5':100000,'4+1':1000,'4':500,'3+1':50,'3':20,'2+1':9,'2':4,'1+1':2.20});
  }

  if (nums.length < 5) {
    lastError = 'Numéros non trouvés. allNums: ' + allNums.slice(0,30).join(',');
    console.log('[LOG] ❌ ' + lastError);
    return null;
  }

  return { nums, chance, nums2, date: tirageDate, rapportGains };
}

function tirageDejàEnregistré(tirage) {
  return allTirages.some(t =>
    t.nums.join(',') === tirage.nums.join(',') &&
    t.date.split('T')[0] === tirage.date.split('T')[0]
  );
}

function calculerGains(grille, nums, chanceGrille, chanceTirage, rapportGains) {
  const numsMatches = nums.filter(n => grille.includes(n)).length;
  const chanceMatch = (chanceGrille === chanceTirage);
  if (numsMatches === 5 && chanceMatch) return rapportGains['5+1'] || 0;
  if (numsMatches === 5)                return rapportGains['5']   || 0;
  if (numsMatches === 4 && chanceMatch) return rapportGains['4+1'] || 0;
  if (numsMatches === 4)                return rapportGains['4']   || 0;
  if (numsMatches === 3 && chanceMatch) return rapportGains['3+1'] || 0;
  if (numsMatches === 3)                return rapportGains['3']   || 0;
  if (numsMatches === 2 && chanceMatch) return rapportGains['2+1'] || 0;
  if (numsMatches === 2)                return rapportGains['2']   || 0;
  if (numsMatches <= 1 && chanceMatch)  return rapportGains['1+1'] || 0;
  return 0;
}

app.get('/api/loto-complet', async (req, res) => {
  try {
    console.log('\n[LOG] === APPEL /api/loto-complet ===');
    const tirage = await fetchLotoResults();
    if (!tirage) return res.status(500).json({ success: false, error: lastError });

    if (!tirageDejàEnregistré(tirage)) {
      let gainsTotal = 0;
      GRILLES.forEach((grille, idx) => {
        const gains = calculerGains(grille, tirage.nums, CHANCES[idx], tirage.chance, tirage.rapportGains);
        gainsTotal += gains;
        console.log('[LOG] Grille ' + (idx+1) + ' (chance=' + CHANCES[idx] + '): ' + gains + '€');
      });
      cagnotte += gainsTotal;
      if (cagnotte >= 650) {
        const parPerson = 650 / 13;
        PARTICIPANTS.forEach(p => { distribution[p].gains += parPerson; distribution[p].solde += parPerson; });
        cagnotte -= 650;
        console.log('[LOG] 💸 DISTRIBUTION 650€!');
      }
      allTirages.push({ nums: tirage.nums, chance: tirage.chance, nums2: tirage.nums2, gains: gainsTotal, rapportGains: tirage.rapportGains, date: tirage.date });
    }

    res.json({ success: true, tirage, cagnotte: cagnotte.toFixed(2), distribution, historique: allTirages.slice(-10), timestamp: new Date().toISOString() });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

app.get('/api/bilan', (req, res) => {
  const bilanArray = PARTICIPANTS.map((name, idx) => ({ id: idx+1, name, gains: distribution[name].gains.toFixed(2), solde: distribution[name].solde.toFixed(2) }));
  const gainsTotal = Object.values(distribution).reduce((sum, d) => sum + d.gains, 0);
  res.json({ success: true, participants: bilanArray, gainsTotal: gainsTotal.toFixed(2), soldeTotal: (gainsTotal-2340).toFixed(2), cagnotte: cagnotte.toFixed(2), timestamp: new Date().toISOString() });
});

app.get('/api/stats', (req, res) => {
  const gainsTotal = Object.values(distribution).reduce((sum, d) => sum + d.gains, 0);
  res.json({ success: true, tiragesEffectues: allTirages.length, gainsTotal: gainsTotal.toFixed(2), roi: gainsTotal > 0 ? ((gainsTotal/2340)*100).toFixed(1)+'%' : '0.0%', cagnotte: cagnotte.toFixed(2), historique: allTirages.slice(-10), timestamp: new Date().toISOString() });
});

app.get('/api/test', (req, res) => {
  res.json({ message: 'Backend opérationnel', timestamp: new Date().toISOString() });
});

// Debug: voir tranches du HTML brut
app.get('/api/debug-html', async (req, res) => {
  const result = await fetchFromUrl('www.secretsdujeu.com', '/page/jeux_loto_resultats.html');
  if (!result.ok) return res.json({ error: result.error });
  const from = parseInt(req.query.from) || 0;
  const to = parseInt(req.query.to) || 8000;
  res.json({ status: result.status, length: result.data.length, from, to, extrait: result.data.substring(from, to) });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('✅ Backend démarré sur port ' + PORT));
