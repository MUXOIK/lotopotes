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

function parseMontants(html) {
  // Format dans la page détail: "78 814,30&nbsp;&euro;" ou "916,00&nbsp;&euro;"
  // &nbsp; = espace insécable, &euro; = €
  const rapportGains = {};
  
  // Chercher les rangs explicitement dans le HTML
  const rangs = [
    { key: '5+1', pattern: /5 bons N[^<]*Chance[\s\S]{0,200}?LotoMessage[^>]*>(Pas de gagnant|[\d\s]+,\d{2})&nbsp;&euro;/ },
    { key: '5',   pattern: /5 bons N[°º](?!.*Chance)[\s\S]{0,200}?LotoMessage[^>]*>([\d\s]+,\d{2})&nbsp;&euro;/ },
    { key: '4+1', pattern: /4 bons N[^<]*Chance[\s\S]{0,200}?LotoMessage[^>]*>([\d\s]+,\d{2})&nbsp;&euro;/ },
    { key: '4',   pattern: /4 bons N[°º](?!.*Chance)[\s\S]{0,200}?LotoMessage[^>]*>([\d\s]+,\d{2})&nbsp;&euro;/ },
    { key: '3+1', pattern: /3 bons N[^<]*Chance[\s\S]{0,200}?LotoMessage[^>]*>([\d\s]+,\d{2})&nbsp;&euro;/ },
    { key: '3',   pattern: /3 bons N[°º](?!.*Chance)[\s\S]{0,200}?LotoMessage[^>]*>([\d\s]+,\d{2})&nbsp;&euro;/ },
    { key: '2+1', pattern: /2 bons N[^<]*Chance[\s\S]{0,200}?LotoMessage[^>]*>([\d\s]+,\d{2})&nbsp;&euro;/ },
    { key: '2',   pattern: /2 bons N[°º](?!.*Chance)[\s\S]{0,200}?LotoMessage[^>]*>([\d\s]+,\d{2})&nbsp;&euro;/ },
    { key: '1+1', pattern: /(?:1 bon|0 ou 1)[^<]*Chance[\s\S]{0,200}?LotoMessage[^>]*>([\d\s]+,\d{2})&nbsp;&euro;/ },
  ];

  for (const rang of rangs) {
    const m = rang.pattern.exec(html);
    if (m && m[1] && m[1] !== 'Pas de gagnant') {
      rapportGains[rang.key] = parseFloat(m[1].replace(/\s/g, '').replace(',', '.'));
    } else {
      rapportGains[rang.key] = 0;
    }
  }
  return rapportGains;
}

async function fetchLotoResults() {
  console.log('[LOG] === Scraping secretsdujeu.com ===');
  
  // ÉTAPE 1: Page principale -> récupérer URL du dernier tirage + numéros via JSON-LD
  const main = await fetchFromUrl('www.secretsdujeu.com', '/page/jeux_loto_resultats.html');
  if (!main.ok || main.status !== 200) {
    lastError = 'Erreur page principale: ' + (main.error || main.status);
    return null;
  }
  const html = main.data;
  console.log('[LOG] Page principale: ' + html.length + ' chars');

  // DATE via JSON-LD dateModified
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

  // NUMÉROS via JSON-LD
  let nums = [], chance = null, nums2 = [];
  const jsonLdNums = /combinaison gagnante[^0-9]*(\d+)-(\d+)-(\d+)-(\d+)-(\d+)[^0-9]*num.ro Chance est le (\d+)/.exec(html);
  if (jsonLdNums) {
    nums = [1,2,3,4,5].map(i => parseInt(jsonLdNums[i]));
    chance = parseInt(jsonLdNums[6]);
    console.log('[LOG] ✅ Nums: ' + nums.join(',') + ' chance=' + chance);
  } else {
    lastError = 'Numéros non trouvés dans JSON-LD';
    console.log('[LOG] ❌ ' + lastError);
    return null;
  }

  // URL de la page détail du dernier tirage (1er élément de l'ItemList)
  const urlMatch = /"url":"(https:\/\/www\.secretsdujeu\.com\/loto\/resultat\/tirage-loto-du-[^"]+)"/.exec(html);
  
  // ÉTAPE 2: Page détail -> récupérer montants réels ET 2nd tirage
  let rapportGains = null;
  if (urlMatch) {
    const tiragePath = urlMatch[1].replace('https://www.secretsdujeu.com', '');
    console.log('[LOG] Page détail: ' + tiragePath);
    const detail = await fetchFromUrl('www.secretsdujeu.com', tiragePath);
    
    if (detail.ok && detail.status === 200) {
      rapportGains = parseMontants(detail.data);
      console.log('[LOG] ✅ Montants: 5=' + rapportGains['5'] + '€, 4+1=' + rapportGains['4+1'] + '€, 4=' + rapportGains['4'] + '€');
      
      // 2nd tirage depuis la page détail
      const nums2Match = /2.{0,30}tirage[\s\S]{0,500}?(\d{1,2})-(\d{1,2})-(\d{1,2})-(\d{1,2})-(\d{1,2})/.exec(detail.data);
      if (nums2Match) {
        nums2 = [1,2,3,4,5].map(i => parseInt(nums2Match[i]));
        console.log('[LOG] ✅ Nums2: ' + nums2.join(','));
      }
    }
  }

  // Fallback montants si page détail indisponible
  if (!rapportGains || rapportGains['5'] === 0 && rapportGains['4+1'] === 0) {
    console.log('[LOG] ⚠️ Fallback montants standards');
    rapportGains = {'5+1':0,'5':100000,'4+1':1000,'4':500,'3+1':50,'3':20,'2+1':9,'2':4,'1+1':2.20};
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
    } else {
      console.log('[LOG] Tirage déjà enregistré');
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
  res.json({ message: 'Backend operationnel', timestamp: new Date().toISOString() });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('✅ Backend démarré sur port ' + PORT));
