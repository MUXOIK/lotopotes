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
    return null;
  }

  const html = res.data;
  console.log('[LOG] HTML: ' + html.length + ' chars');

  // ===== DATE via JSON-LD dateModified =====
  let tirageDate = null;
  const dateMatch = /"dateModified":"(\d{4}-\d{2}-\d{2})/.exec(html);
  if (dateMatch) {
    tirageDate = dateMatch[1] + 'T20:50:00.000Z';
    console.log('[LOG] ✅ Date: ' + tirageDate);
  } else {
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

  // ===== NUMÉROS via JSON-LD (ultra fiable) =====
  // Pattern: "combinaison gagnante à ce tirage est 3-4-15-17-41 et le numéro Chance est le 4"
  let nums = [], chance = null, nums2 = [];

  const jsonLdNums = /combinaison gagnante[^0-9]*(\d+)-(\d+)-(\d+)-(\d+)-(\d+)[^0-9]*num.ro Chance est le (\d+)/.exec(html);
  if (jsonLdNums) {
    nums = [1,2,3,4,5].map(i => parseInt(jsonLdNums[i]));
    chance = parseInt(jsonLdNums[6]);
    console.log('[LOG] ✅ Nums JSON-LD: ' + nums.join(',') + ' chance=' + chance);
  } else {
    // Fallback: chercher séquences de boules dans le HTML
    const allNums = [];
    const numPattern = /(?:<[^>]+>)\s*(\d{1,2})\s*(?:<\/)/g;
    let m;
    while ((m = numPattern.exec(html)) !== null) {
      const n = parseInt(m[1]);
      if (n >= 1 && n <= 49) allNums.push(n);
    }
    for (let i = 0; i <= allNums.length - 6; i++) {
      const candidate = allNums.slice(i, i + 5);
      if (candidate.every(n => n >= 1 && n <= 49) && new Set(candidate).size === 5) {
        for (let j = i + 5; j < Math.min(i + 15, allNums.length); j++) {
          if (allNums[j] >= 1 && allNums[j] <= 10) {
            const c2 = allNums.slice(j + 1, j + 6);
            if (c2.length === 5 && new Set(c2).size === 5) {
              nums = candidate; chance = allNums[j]; nums2 = c2;
              break;
            }
          }
        }
        if (nums.length === 5) break;
      }
    }
    console.log('[LOG] ⚠️ Nums fallback HTML: ' + nums.join(','));
  }

  // ===== 2ND TIRAGE =====
  // Chercher "2nd tirage.*?(\d+)-(\d+)-(\d+)-(\d+)-(\d+)" ou les boules après le 1er tirage
  const nums2Match = /2.{0,20}tirage[^0-9]*(\d{1,2})[^0-9]+(\d{1,2})[^0-9]+(\d{1,2})[^0-9]+(\d{1,2})[^0-9]+(\d{1,2})/.exec(html);
  if (nums2Match) {
    nums2 = [1,2,3,4,5].map(i => parseInt(nums2Match[i]));
    console.log('[LOG] ✅ Nums2: ' + nums2.join(','));
  }

  // ===== MONTANTS RÉELS =====
  // Les montants FDJ sont dans le tableau HTML, format "78 814,30" ou "916,00"
  // On cherche dans tout le HTML les montants avec virgule
  const rapportGains = {};
  const montantPattern = /(\d[\d\s]{0,8}),(\d{2})\s*(?:€|&euro;|\u20ac)/g;
  const montants = [];
  let m2;
  while ((m2 = montantPattern.exec(html)) !== null) {
    const val = parseFloat(m2[1].replace(/\s/g, '') + '.' + m2[2]);
    if (val >= 2.00 && val <= 10000000) montants.push(val);
  }
  // Dédoublonner et trier par ordre décroissant (rang 2 en premier)
  const montantsUniques = [...new Set(montants)].sort((a, b) => b - a);
  console.log('[LOG] Montants uniques trouvés: ' + montantsUniques.join(', '));

  // Les rangs dans l'ordre du tableau FDJ:
  // rang2=5bons, rang3=4+1, rang4=4bons, rang5=3+1, rang6=3bons, rang7=2+1, rang8=2bons, rang9=1+1
  if (montantsUniques.length >= 7) {
    rapportGains['5+1'] = 0;
    rapportGains['5']   = montantsUniques[0];  // plus grand = rang 2
    rapportGains['4+1'] = montantsUniques[1];
    rapportGains['4']   = montantsUniques[2];
    rapportGains['3+1'] = montantsUniques[3];
    rapportGains['3']   = montantsUniques[4];
    rapportGains['2+1'] = montantsUniques[5];
    rapportGains['2']   = montantsUniques[6];
    rapportGains['1+1'] = montantsUniques[7] || 2.20;
    console.log('[LOG] ✅ Montants réels: rang2=' + rapportGains['5'] + '€, rang3=' + rapportGains['4+1'] + '€, rang4=' + rapportGains['4'] + '€');
  } else {
    // Fallback montants standards FDJ
    console.log('[LOG] ⚠️ Fallback montants standards (' + montantsUniques.length + ' montants trouvés)');
    Object.assign(rapportGains, {'5+1':0,'5':100000,'4+1':1000,'4':500,'3+1':50,'3':20,'2+1':9,'2':4,'1+1':2.20});
  }

  if (nums.length < 5) {
    lastError = 'Numéros non trouvés';
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
  const n = nums.filter(x => grille.includes(x)).length;
  const c = (chanceGrille === chanceTirage);
  if (n === 5 && c) return rapportGains['5+1'] || 0;
  if (n === 5)      return rapportGains['5']   || 0;
  if (n === 4 && c) return rapportGains['4+1'] || 0;
  if (n === 4)      return rapportGains['4']   || 0;
  if (n === 3 && c) return rapportGains['3+1'] || 0;
  if (n === 3)      return rapportGains['3']   || 0;
  if (n === 2 && c) return rapportGains['2+1'] || 0;
  if (n === 2)      return rapportGains['2']   || 0;
  if (n <= 1 && c)  return rapportGains['1+1'] || 0;
  return 0;
}

app.get('/api/loto-complet', async (req, res) => {
  try {
    console.log('\n[LOG] === /api/loto-complet ===');
    const tirage = await fetchLotoResults();
    if (!tirage) return res.status(500).json({ success: false, error: lastError });

    if (!tirageDejàEnregistré(tirage)) {
      let gainsTotal = 0;
      GRILLES.forEach((grille, idx) => {
        const g = calculerGains(grille, tirage.nums, CHANCES[idx], tirage.chance, tirage.rapportGains);
        gainsTotal += g;
        console.log('[LOG] Grille ' + (idx+1) + ' (chance=' + CHANCES[idx] + '): ' + g + '€');
      });
      cagnotte += gainsTotal;
      console.log('[LOG] 💰 Cagnotte: ' + cagnotte + '€');
      if (cagnotte >= 650) {
        const pp = 650 / 13;
        PARTICIPANTS.forEach(p => { distribution[p].gains += pp; distribution[p].solde += pp; });
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

// Debug HTML (tranches de 8000 chars)
app.get('/api/debug-html', async (req, res) => {
  const result = await fetchFromUrl('www.secretsdujeu.com', '/page/jeux_loto_resultats.html');
  if (!result.ok) return res.json({ error: result.error });
  const from = parseInt(req.query.from) || 0;
  const to = parseInt(req.query.to) || 8000;
  // Extraire aussi tous les montants trouvés
  const montantPattern = /(\d[\d\s]{0,8}),(\d{2})\s*(?:€|&euro;)/g;
  const montants = [];
  let m;
  while ((m = montantPattern.exec(result.data)) !== null) {
    const val = parseFloat(m[1].replace(/\s/g, '') + '.' + m[2]);
    if (val >= 2 && val <= 10000000) montants.push({ pos: m.index, val });
  }
  res.json({ status: result.status, length: result.data.length, from, to, montants_tous: montants.slice(0, 30), extrait: result.data.substring(from, to) });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('✅ Backend démarré sur port ' + PORT));

// Debug étendu: chercher spécifiquement les montants dans tout le HTML
app.get('/api/debug-montants', async (req, res) => {
  const result = await fetchFromUrl('www.secretsdujeu.com', '/page/jeux_loto_resultats.html');
  if (!result.ok) return res.json({ error: result.error });
  const html = result.data;
  
  // Chercher toutes les occurrences de nombres avec virgule (montants €)
  const patterns = [
    { name: 'virgule_euro', re: /(\d[\d\s]{0,10},\d{2})\s*(?:€|&euro;|&#8364;)/g },
    { name: 'point_euro', re: /(\d+\.\d{2})\s*(?:€|&euro;)/g },
    { name: 'nbsp_euro', re: /(\d[\d\u00a0]{0,10},\d{2})\s*€/g },
  ];
  
  const resultats = {};
  for (const p of patterns) {
    const matches = [];
    let m;
    while ((m = p.re.exec(html)) !== null) {
      matches.push({ pos: m.index, raw: m[0].trim(), contexte: html.substring(m.index - 30, m.index + 50) });
    }
    resultats[p.name] = matches.slice(0, 20);
  }
  
  // Chercher aussi autour du mot "gagnant" et des tableaux
  const gagnantIdx = html.indexOf('Gagnants');
  const gainIdx = html.indexOf('Gains');
  
  res.json({
    longueur_html: html.length,
    position_Gagnants: gagnantIdx,
    position_Gains: gainIdx,
    extrait_autour_Gains: html.substring(gainIdx - 100, gainIdx + 2000),
    resultats_montants: resultats
  });
});
