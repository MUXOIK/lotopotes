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
const DEBUT_SYNDICAT = new Date('2026-06-01T00:00:00.000Z');

// Config GitHub
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_REPO = process.env.GITHUB_REPO || 'MUXOIK/lotopotes';
const DATA_FILE = 'data.json';

let allTirages = [];
let distribution = {};
let cagnotte = 0;
let lastError = '';
let dataFileSha = null; // SHA du fichier GitHub (nécessaire pour les mises à jour)

PARTICIPANTS.forEach(p => { distribution[p] = { gains: 0, solde: -180 }; });

// ===== GITHUB API =====
function githubRequest(method, path, body) {
  return new Promise((resolve) => {
    const payload = body ? JSON.stringify(body) : null;
    const options = {
      hostname: 'api.github.com',
      path: '/repos/' + GITHUB_REPO + '/contents/' + path,
      method: method,
      headers: {
        'Authorization': 'token ' + GITHUB_TOKEN,
        'User-Agent': 'lotopotes-backend',
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
        ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {})
      },
      timeout: 15000
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try { resolve({ ok: res.statusCode < 400, status: res.statusCode, data: JSON.parse(data) }); }
        catch(e) { resolve({ ok: false, error: 'Parse error', raw: data }); }
      });
    });
    req.on('error', err => resolve({ ok: false, error: err.message }));
    req.on('timeout', () => { req.destroy(); resolve({ ok: false, error: 'timeout' }); });
    if (payload) req.write(payload);
    req.end();
  });
}

async function chargerDonnees() {
  if (!GITHUB_TOKEN) {
    console.log('[DB] ⚠️ Pas de GITHUB_TOKEN — mode mémoire uniquement');
    PARTICIPANTS.forEach(p => { distribution[p] = { gains: 0, solde: -180 }; });
    return;
  }
  try {
    const res = await githubRequest('GET', DATA_FILE);
    if (res.ok && res.data.content) {
      const content = Buffer.from(res.data.content, 'base64').toString('utf8');
      const data = JSON.parse(content);
      allTirages = data.allTirages || [];
      distribution = data.distribution || {};
      cagnotte = data.cagnotte || 0;
      dataFileSha = res.data.sha;
      PARTICIPANTS.forEach(p => { if (!distribution[p]) distribution[p] = { gains: 0, solde: -180 }; });
      console.log('[DB] ✅ Données chargées depuis GitHub: ' + allTirages.length + ' tirages, cagnotte=' + cagnotte + '€');
    } else if (res.status === 404) {
      console.log('[DB] Fichier data.json inexistant — sera créé au premier tirage');
      PARTICIPANTS.forEach(p => { distribution[p] = { gains: 0, solde: -180 }; });
    } else {
      console.log('[DB] ❌ Erreur chargement: ' + JSON.stringify(res.data));
      PARTICIPANTS.forEach(p => { distribution[p] = { gains: 0, solde: -180 }; });
    }
  } catch(e) {
    console.log('[DB] ❌ Exception: ' + e.message);
    PARTICIPANTS.forEach(p => { distribution[p] = { gains: 0, solde: -180 }; });
  }
}

async function sauvegarderDonnees() {
  if (!GITHUB_TOKEN) { console.log('[DB] Pas de token — sauvegarde ignorée'); return; }
  try {
    const data = { allTirages, distribution, cagnotte, updatedAt: new Date().toISOString() };
    const content = Buffer.from(JSON.stringify(data, null, 2)).toString('base64');
    const body = {
      message: 'Update data - ' + new Date().toISOString().split('T')[0],
      content: content,
      ...(dataFileSha ? { sha: dataFileSha } : {})
    };
    const res = await githubRequest('PUT', DATA_FILE, body);
    if (res.ok) {
      dataFileSha = res.data.content.sha;
      console.log('[DB] ✅ Données sauvegardées sur GitHub (' + allTirages.length + ' tirages)');
    } else {
      console.log('[DB] ❌ Erreur sauvegarde: ' + JSON.stringify(res.data));
    }
  } catch(e) {
    console.log('[DB] ❌ Exception sauvegarde: ' + e.message);
  }
}

// ===== CACHE =====
let tirageCache = null;
let cacheExpiry = null;

function prochainTirage() {
  const now = new Date();
  const lotoJours = [1, 3, 6];
  for (let i = 0; i <= 7; i++) {
    const candidate = new Date(now);
    candidate.setDate(now.getDate() + i);
    candidate.setHours(21, 0, 0, 0);
    if (lotoJours.includes(candidate.getDay()) && candidate > now) return candidate;
  }
}

function cacheEstValide() {
  return tirageCache && cacheExpiry && new Date() < cacheExpiry;
}

function fetchFromUrl(hostname, path) {
  return new Promise((resolve) => {
    const options = {
      hostname, path, method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8',
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
  const rapportGains = {};
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
    rapportGains[rang.key] = (m && m[1] && m[1] !== 'Pas de gagnant')
      ? parseFloat(m[1].replace(/\s/g, '').replace(',', '.')) : 0;
  }
  return rapportGains;
}

async function scraperTirage() {
  console.log('[SCRAPE] Démarrage...');
  const main = await fetchFromUrl('www.secretsdujeu.com', '/page/jeux_loto_resultats.html');
  if (!main.ok || main.status !== 200) { lastError = 'Erreur page principale'; return null; }
  const html = main.data;

  // DATE
  let tirageDate = null;
  const dateMatch = /"dateModified":"(\d{4}-\d{2}-\d{2})/.exec(html);
  if (dateMatch) {
    tirageDate = dateMatch[1] + 'T20:50:00.000Z';
  } else {
    const now = new Date(); const day = now.getDay(); const lotoJours = [1,3,6];
    let db = 0;
    for (let i = 0; i <= 7; i++) { if (lotoJours.includes(((day-i)+7)%7)) { db=i; break; } }
    const last = new Date(now); last.setDate(now.getDate()-db);
    if (db===0 && now.getHours()<21) { for (let i=1;i<=7;i++) { if (lotoJours.includes(((day-i)+7)%7)) { last.setDate(now.getDate()-i); break; } } }
    last.setHours(20,50,0,0); tirageDate = last.toISOString();
  }

  // NUMÉROS
  let nums=[], chance=null, nums2=[];
  const m = /combinaison gagnante[^0-9]*(\d+)-(\d+)-(\d+)-(\d+)-(\d+)[^0-9]*num.ro Chance est le (\d+)/.exec(html);
  if (m) { nums=[1,2,3,4,5].map(i=>parseInt(m[i])); chance=parseInt(m[6]); }
  else { lastError='Numéros non trouvés'; return null; }

  // PAGE DÉTAIL → montants + 2nd tirage
  const urlM = /"url":"(https:\/\/www\.secretsdujeu\.com\/loto\/resultat\/tirage-loto-du-[^"]+)"/.exec(html);
  let rapportGains = null;
  if (urlM) {
    const detail = await fetchFromUrl('www.secretsdujeu.com', urlM[1].replace('https://www.secretsdujeu.com',''));
    if (detail.ok && detail.status===200) {
      rapportGains = parseMontants(detail.data);

      // Montants du 2nd tirage (pas de chance, seulement 4 rangs)
      // On cherche dans le tableau "Option 2nd tirage"
      const rg2 = {};
      const section2nd = detail.data.indexOf('tabpanel-1');
      if (section2nd > 0) {
        // Chercher les montants après tabpanel-1 (dans les 3000 prochains chars)
        const html2nd = detail.data.substring(section2nd, section2nd + 5000);
        const rangs2 = [
          { key: '5', pattern: /5 bons[\s\S]{0,200}?LotoMessage[^>]*>([\d\s]+,\d{2})&nbsp;&euro;/ },
          { key: '4', pattern: /4 bons[\s\S]{0,200}?LotoMessage[^>]*>([\d\s]+,\d{2})&nbsp;&euro;/ },
          { key: '3', pattern: /3 bons[\s\S]{0,200}?LotoMessage[^>]*>([\d\s]+,\d{2})&nbsp;&euro;/ },
          { key: '2', pattern: /2 bons[\s\S]{0,200}?LotoMessage[^>]*>([\d\s]+,\d{2})&nbsp;&euro;/ },
        ];
        for (const r of rangs2) {
          const m2 = r.pattern.exec(html2nd);
          rg2[r.key] = m2 && m2[1] ? parseFloat(m2[1].replace(/\s/g,'').replace(',','.')) : 0;
        }
        console.log('[SCRAPE] ✅ Montants 2nd tirage: 5=' + rg2['5'] + '€, 4=' + rg2['4'] + '€, 3=' + rg2['3'] + '€, 2=' + rg2['2'] + '€');
      }
      tirageCache = { ...tirageCache, rapportGains2: rg2 };

      const p2 = /class=["\']loto-numero second-tir["\'][^>]*>\s*(\d{1,2})\s*<\/p>/g;
      let m2; while ((m2=p2.exec(detail.data))!==null) nums2.push(parseInt(m2[1]));
      console.log('[SCRAPE] ✅ Montants: 5bons=' + rapportGains['5'] + '€, 1+1=' + rapportGains['1+1'] + '€');
    }
  }
  if (!rapportGains || Object.values(rapportGains).every(v=>v===0))
    rapportGains = {'5+1':0,'5':100000,'4+1':1000,'4':500,'3+1':50,'3':20,'2+1':9,'2':4,'1+1':2.20};

  tirageCache = { nums, chance, nums2, date: tirageDate, rapportGains, rapportGains2: tirageCache?.rapportGains2 || {} };
  cacheExpiry = prochainTirage();
  console.log('[SCRAPE] ✅ ' + nums.join(',') + ' Chance:' + chance + ' | Cache→' + cacheExpiry);
  return tirageCache;
}

async function getTirage() {
  if (cacheEstValide()) { console.log('[CACHE] ✅'); return tirageCache; }
  return await scraperTirage();
}

function tirageDejàEnregistré(t) {
  return allTirages.some(x => x.nums.join(',')===t.nums.join(',') && x.date.split('T')[0]===t.date.split('T')[0]);
}

function calculerGains(grille, nums, cg, ct, rg) {
  const n = nums.filter(x=>grille.includes(x)).length, c = cg===ct;
  if (n===5&&c) return rg['5+1']||0; if (n===5) return rg['5']||0;
  if (n===4&&c) return rg['4+1']||0; if (n===4) return rg['4']||0;
  if (n===3&&c) return rg['3+1']||0; if (n===3) return rg['3']||0;
  if (n===2&&c) return rg['2+1']||0; if (n===2) return rg['2']||0;
  if (c) return rg['1+1']||0; return 0;
}

app.get('/api/loto-complet', async (req, res) => {
  try {
    const tirage = await getTirage();
    if (!tirage) return res.status(500).json({ success: false, error: lastError });
    const dateTirage = new Date(tirage.date);
    if (dateTirage < DEBUT_SYNDICAT) {
      cagnotte=0; allTirages=[]; PARTICIPANTS.forEach(p=>{distribution[p]={gains:0,solde:-180};});
      return res.json({ success:true, tirage, cagnotte:'0.00', distribution, historique:[], timestamp:new Date().toISOString() });
    }
    if (!tirageDejàEnregistré(tirage)) {
      let gainsTotal = 0;

      // 1er tirage (5 numéros + chance)
      GRILLES.forEach((g,i) => {
        const gain = calculerGains(g, tirage.nums, CHANCES[i], tirage.chance, tirage.rapportGains);
        if (gain > 0) console.log('[LOG] 🎉 1er tirage Grille'+(i+1)+': +'+gain+'€');
        gainsTotal += gain;
      });

      // 2nd tirage (5 numéros seulement, pas de chance)
      // Rangs: 5 bons, 4 bons, 3 bons, 2 bons (pas de chance dans le 2nd tirage)
      if (tirage.nums2 && tirage.nums2.length === 5 && tirage.rapportGains2) {
        GRILLES.forEach((g,i) => {
          const n = tirage.nums2.filter(x => g.includes(x)).length;
          let gain2 = 0;
          if (n===5) gain2 = tirage.rapportGains2['5'] || 0;
          else if (n===4) gain2 = tirage.rapportGains2['4'] || 0;
          else if (n===3) gain2 = tirage.rapportGains2['3'] || 0;
          else if (n===2) gain2 = tirage.rapportGains2['2'] || 0;
          if (gain2 > 0) console.log('[LOG] 🎉 2nd tirage Grille'+(i+1)+': +'+gain2+'€');
          gainsTotal += gain2;
        });
      }

      cagnotte += gainsTotal;
      if (cagnotte>=650) { const pp=650/13; PARTICIPANTS.forEach(p=>{distribution[p].gains+=pp;distribution[p].solde+=pp;}); cagnotte-=650; console.log('[LOG] 💸 DISTRIBUTION!'); }
      allTirages.push({nums:tirage.nums,chance:tirage.chance,nums2:tirage.nums2,gains:gainsTotal,rapportGains:tirage.rapportGains,date:tirage.date});
      await sauvegarderDonnees(); // 💾 SAUVEGARDE GITHUB
    }
    res.json({ success:true, tirage, cagnotte:cagnotte.toFixed(2), distribution, historique:allTirages.slice(-10), timestamp:new Date().toISOString() });
  } catch(e) { res.status(500).json({ success:false, error:e.message }); }
});

app.get('/api/bilan', (req, res) => {
  // gainsTotal = ce qui a été distribué + ce qui est en cagnotte
  const distribue = Object.values(distribution).reduce((s,d)=>s+d.gains,0);
  const gt = distribue + cagnotte;
  res.json({ success:true, participants:PARTICIPANTS.map((n,i)=>({id:i+1,name:n,gains:distribution[n].gains.toFixed(2),solde:distribution[n].solde.toFixed(2)})), gainsTotal:gt.toFixed(2), soldeTotal:(gt-2340).toFixed(2), cagnotte:cagnotte.toFixed(2), tiragesEffectues:allTirages.length, timestamp:new Date().toISOString() });
});

app.get('/api/stats', (req, res) => {
  const distribue = Object.values(distribution).reduce((s,d)=>s+d.gains,0);
  const gt = distribue + cagnotte;
  res.json({ success:true, tiragesEffectues:allTirages.length, gainsTotal:gt.toFixed(2), roi:gt>0?((gt/2340)*100).toFixed(1)+'%':'0.0%', cagnotte:cagnotte.toFixed(2), historique:allTirages.slice(-10), timestamp:new Date().toISOString() });
});

app.get('/api/test', (req, res) => {
  res.json({ message:'Backend operationnel', cache:{valide:cacheEstValide(),expire:cacheExpiry,tirage:tirageCache?tirageCache.nums:null}, github:{token:!!GITHUB_TOKEN,repo:GITHUB_REPO,sha:dataFileSha}, timestamp:new Date().toISOString() });
});

app.get('/api/force-scrape', async (req, res) => {
  console.log('[ADMIN] Force scraping + recalcul complet');
  // Vider complètement les données et recharger depuis GitHub
  tirageCache = null;
  cacheExpiry = null;
  await chargerDonnees(); // Recharger les données propres depuis GitHub
  const tirage = await scraperTirage(); // Rescraper les numéros et montants
  if (!tirage) return res.json({ success:false, error:lastError });
  res.json({ success:true, tirage, message:'Cache vidé, données rechargées. Rechargez la page accueil pour recalculer.', timestamp:new Date().toISOString() });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
  console.log('✅ Backend démarré sur port ' + PORT);
  await chargerDonnees(); // Charger les données GitHub au démarrage
});
