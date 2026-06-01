const express = require('express');
const cors = require('cors');
const https = require('https');

const app = express();
app.use(cors());
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
    'ANOUFA Fabienne & Moise','BELLALOU Martine & Patrick','GRINAL Danielle & Serge',
    'HOCHBERG Nathalie & Bruno','JURIS Virgine & Frederic','KIMAN Laurence & Didier',
    'LEVIN Gabrielle & Didier','MESGUICH Corinne & Jean Philippe','OIKNINE Muriel & Aaron',
    'PARTOUCHE Sylvie & Serge','SITBON Leslie & OHAYON Gilles','TEMAN Eva & FINKELSTEIN Philippe',
    'WEITZMANN Dalia & Jacques'
  ];

let allTirages = [];
let distribution = {};
let cagnotte = 0;
let lastError = '';
PARTICIPANTS.forEach(p => { distribution[p] = { gains: 0, solde: -180 }; });

// ===== CACHE DU TIRAGE (1x par jour, expire au prochain tirage) =====
let tirageCache = null;
let cacheExpiry = null;

function prochainTirage() {
    const now = new Date();
    const lotoJours = [1, 3, 6]; // lundi=1, mercredi=3, samedi=6
    for (let i = 0; i <= 7; i++) {
          const candidate = new Date(now);
          candidate.setDate(now.getDate() + i);
          candidate.setHours(21, 0, 0, 0);
          if (lotoJours.includes(candidate.getDay()) && candidate > now) {
                  return candidate;
          }
    }
    // fallback: demain 21h
    const fallback = new Date(now);
    fallback.setDate(now.getDate() + 1);
    fallback.setHours(21, 0, 0, 0);
    return fallback;
}

function cacheEstValide() {
    if (!tirageCache || !cacheExpiry) return false;
    return new Date() < cacheExpiry;
}

function fetchFromUrl(hostname, path) {
    return new Promise((resolve) => {
          const options = {
                  hostname,
                  path,
                  method: 'GET',
                  headers: {
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                            'Accept': 'application/json, text/plain, */*',
                            'Accept-Language': 'fr-FR,fr;q=0.9',
                            'Referer': 'https://www.fdj.fr/',
                            'Cache-Control': 'no-cache'
                  },
                  timeout: 15000
          };
          const req = https.request(options, (res) => {
                  let data = '';
                  res.on('data', chunk => data += chunk);
                  res.on('end', () => resolve({ ok: res.statusCode >= 200 && res.statusCode < 300, data, status: res.statusCode }));
          });
          req.on('error', (e) => resolve({ ok: false, data: '', error: e.message }));
          req.on('timeout', () => { req.destroy(); resolve({ ok: false, data: '', error: 'timeout' }); });
          req.end();
    });
}

// Parse les rapports de gains depuis l'API FDJ
// L'API FDJ retourne un champ "rapportDuJeu" avec les rangs
function parseRapportGains(drawInfo) {
    const rg = {};
    try {
          // Chercher dans les donnees du tirage les montants par rang
          const rapports = drawInfo.rapportDuJeu || drawInfo.winningConditions || drawInfo.prizeTiers || [];

          // Mapping des rangs FDJ vers nos cles
          const rankMap = {
                  1: '5+1',  // 5 num + chance
                  2: '5',    // 5 num
                  3: '4+1',  // 4 num + chance
                  4: '4',    // 4 num
                  5: '3+1',  // 3 num + chance
                  6: '3',    // 3 num
                  7: '2+1',  // 2 num + chance
                  8: '2',    // 2 num
                  9: '1+1',  // 1 num + chance
          };

          if (Array.isArray(rapports)) {
                  rapports.forEach((r, i) => {
                            const rang = r.rank || r.rang || (i + 1);
                            const gain = parseFloat(r.gain || r.jackpot || r.amount || r.montant || 0);
                            const cle = rankMap[rang];
                            if (cle) rg[cle] = gain;
                  });
          }

          // Si pas de donnees structurees, chercher par cles directes
          if (Object.keys(rg).length === 0) {
                  const keys = ['5+1','5','4+1','4','3+1','3','2+1','2','1+1'];
                  keys.forEach(k => {
                            if (drawInfo[k] !== undefined) rg[k] = parseFloat(drawInfo[k]) || 0;
                            if (drawInfo['rang_' + k] !== undefined) rg[k] = parseFloat(drawInfo['rang_' + k]) || 0;
                  });
          }
    } catch(e) {
          console.error('Erreur parseRapportGains:', e.message);
    }
    return rg;
}

// Calcul du gain d'une grille pour un tirage
function calcGainGrille(grille, chance, nums, numChance, rapportGains) {
    const rg = rapportGains || {};
    const n = nums.filter(x => grille.includes(x)).length;
    const c = (chance === numChance);
    if (n === 5 && c) return rg['5+1'] || 0;
    if (n === 5)      return rg['5']   || 0;
    if (n === 4 && c) return rg['4+1'] || 0;
    if (n === 4)      return rg['4']   || 0;
    if (n === 3 && c) return rg['3+1'] || 0;
    if (n === 3)      return rg['3']   || 0;
    if (n === 2 && c) return rg['2+1'] || 0;
    if (n === 2)      return rg['2']   || 0;
    if (n <= 1 && c)  return rg['1+1'] || 0;
    return 0;
}

async function scrapFDJ() {
    console.log('[FDJ] Debut scraping...');
    try {
          // API FDJ officielle - endpoint des derniers resultats loto
          const urls = [
            { host: 'www.fdj.fr', path: '/api/game/draw/loto/last?includeDetails=true' },
            { host: 'api.fdj.fr', path: '/api/draw/last?game=loto&count=1' },
            { host: 'www.fdj.fr', path: '/loto/resultats' }
                ];

          // Essai 1: API officielle FDJ v1
          let resp = await fetchFromUrl('www.fdj.fr', '/api/game/draw/loto/last?includeDetails=true');

          if (resp.ok && resp.data) {
                  const json = JSON.parse(resp.data);
                  const draw = json.draw || json.draws?.[0] || json;

                  if (draw && draw.winningNumbers) {
                            const nums = draw.winningNumbers.filter(n => !n.isLucky).map(n => parseInt(n.value || n)).sort((a,b)=>a-b);
                            const chanceArr = draw.winningNumbers.filter(n => n.isLucky);
                            const chance = chanceArr.length > 0 ? parseInt(chanceArr[0].value || chanceArr[0]) : 0;
                            const nums2 = draw.secondDraw?.winningNumbers?.map(n => parseInt(n.value || n)).sort((a,b)=>a-b) || [];
                            const rapportGains = parseRapportGains(draw);
                            const date = new Date(draw.drawDate || draw.date || Date.now()).toISOString();

                            console.log('[FDJ] API v1 OK:', nums, 'Chance:', chance, 'RG:', rapportGains);
                            return { nums, chance, nums2, date, rapportGains };
                  }
          }

          // Essai 2: API mobile FDJ
          resp = await fetchFromUrl('www.fdj.fr', '/api/game/loto/draws/last?count=1');
          if (resp.ok && resp.data) {
                  try {
                            const json = JSON.parse(resp.data);
                            const draw = Array.isArray(json) ? json[0] : (json.draws?.[0] || json.draw || json);

                            if (draw) {
                                        // Extraire les numeros selon differents formats possibles
                                        let nums = [], chance = 0, nums2 = [], rapportGains = {};

                                        if (draw.boules) {
                                                      nums = draw.boules.map(b => parseInt(b.num || b)).filter(n => n > 0 && n <= 49).sort((a,b)=>a-b);
                                                      chance = parseInt(draw.complementaires?.[0]?.num || draw.chance || draw.numChance || 0);
                                                      nums2 = draw.boules2?.map(b => parseInt(b.num || b)).filter(n => n > 0 && n <= 49).sort((a,b)=>a-b) || [];
                                        } else if (draw.result) {
                                                      const r = draw.result;
                                                      nums = [r.n1,r.n2,r.n3,r.n4,r.n5].filter(Boolean).map(Number).sort((a,b)=>a-b);
                                                      chance = parseInt(r.c || r.chance || r.numChance || 0);
                                                      nums2 = [r.s1,r.s2,r.s3,r.s4,r.s5].filter(Boolean).map(Number).sort((a,b)=>a-b);
                                        }

                                        // Rapport de gains
                                        rapportGains = parseRapportGains(draw);

                                        if (nums.length === 5 && chance > 0) {
                                                      const date = new Date(draw.drawDate || draw.date || Date.now()).toISOString();
                                                      console.log('[FDJ] API v2 OK:', nums, 'Chance:', chance, 'RG:', rapportGains);
                                                      return { nums, chance, nums2, date, rapportGains };
                                        }
                            }
                  } catch(e) { console.error('[FDJ] Parse v2 error:', e.message); }
          }

          // Essai 3: scraping HTML page resultats
          resp = await fetchFromUrl('www.fdj.fr', '/loto/resultats');
          if (resp.ok && resp.data) {
                  const html = resp.data;

                  // Chercher les numeros dans le HTML avec plusieurs patterns
                  const patterns = [
                            /data-numero="(\d+)"/g,
                            /class="[^"]*numero[^"]*"[^>]*>(\d+)/g,
                            /"ball[^"]*":(\d+)/g,
                            /winning-number[^>]*>(\d+)/g
                          ];

                  let nums = [], chance = 0;
                  for (const pattern of patterns) {
                            const matches = [...html.matchAll(pattern)].map(m => parseInt(m[1]));
                            const valid = matches.filter(n => n >= 1 && n <= 49);
                            if (valid.length >= 5) { nums = valid.slice(0, 5).sort((a,b)=>a-b); break; }
                  }

                  // Chercher le numero chance
                  const chancePatterns = [
                            /data-chance="(\d+)"/,
                            /class="[^"]*chance[^"]*"[^>]*>(\d+)/,
                            /"numChance":(\d+)/,
                            /lucky[^>]*>(\d+)/
                          ];
                  for (const p of chancePatterns) {
                            const m = html.match(p);
                            if (m) { chance = parseInt(m[1]); break; }
                  }

                  // Rapport de gains - chercher les montants
                  const rapportGains = {};
                  const gainPatterns = [
                    { re: /rang.*?1.*?([\d\s,]+)\s*€/i, key: '5+1' },
                    { re: /rang.*?2.*?([\d\s,]+)\s*€/i, key: '5' },
                    { re: /rang.*?3.*?([\d\s,]+)\s*€/i, key: '4+1' },
                    { re: /rang.*?4.*?([\d\s,]+)\s*€/i, key: '4' },
                    { re: /rang.*?5.*?([\d\s,]+)\s*€/i, key: '3+1' },
                    { re: /rang.*?6.*?([\d\s,]+)\s*€/i, key: '3' },
                    { re: /rang.*?7.*?([\d\s,]+)\s*€/i, key: '2+1' },
                    { re: /rang.*?8.*?([\d\s,]+)\s*€/i, key: '2' },
                    { re: /rang.*?9.*?([\d\s,]+)\s*€/i, key: '1+1' }
                          ];
                  gainPatterns.forEach(({ re, key }) => {
                            const m = html.match(re);
                            if (m) rapportGains[key] = parseFloat(m[1].replace(/\s/g,'').replace(',','.')) || 0;
                  });

                  if (nums.length === 5) {
                            const dateMatch = html.match(/tirage.*?(\d{2}\/\d{2}\/\d{4})/i);
                            const date = dateMatch ? new Date(dateMatch[1].split('/').reverse().join('-')).toISOString() : new Date().toISOString();
                            console.log('[FDJ] HTML scraping OK:', nums, 'Chance:', chance);
                            return { nums, chance, nums2: [], date, rapportGains };
                  }
          }

          throw new Error('Toutes les sources FDJ ont echoue - status: ' + resp.status);

    } catch(e) {
          console.error('[FDJ] Erreur scraping:', e.message);
          lastError = e.message;
          return null;
    }
}

async function getTirage() {
    if (cacheEstValide()) {
          console.log('[CACHE] Utilisation du cache, expire:', cacheExpiry);
          return tirageCache;
    }

    console.log('[CACHE] Cache invalide, scraping FDJ...');
    const tirage = await scrapFDJ();

    if (tirage) {
          tirageCache = tirage;
          // Cache valide jusqu'au prochain tirage loto
          cacheExpiry = prochainTirage();
          console.log('[CACHE] Cache mis a jour, expire le:', cacheExpiry);

          // Integrer dans l'historique si nouveau tirage
          const DEBUT_SYNDICAT = new Date('2026-06-01T00:00:00.000Z');
          const dateTirage = new Date(tirage.date);

          if (dateTirage >= DEBUT_SYNDICAT) {
                  const exists = allTirages.find(t => Math.abs(new Date(t.date) - dateTirage) < 3600000);
                  if (!exists) {
                            // Calculer les gains de ce tirage
                            let gainsTotal = 0;
                            GRILLES.forEach((grille, idx) => {
                                        const g = calcGainGrille(grille, CHANCES[idx], tirage.nums, tirage.chance, tirage.rapportGains);
                                        gainsTotal += g;
                                        if (tirage.nums2 && tirage.nums2.length > 0) {
                                                      const g2 = calcGainGrille(grille, CHANCES[idx], tirage.nums2, null, {});
                                                      gainsTotal += g2;
                                        }
                            });

                            allTirages.push({
                                        date: tirage.date,
                                        nums: tirage.nums,
                                        chance: tirage.chance,
                                        nums2: tirage.nums2 || [],
                                        rapportGains: tirage.rapportGains || {},
                                        gains: gainsTotal
                            });

                            // Mise a jour distribution
                            if (gainsTotal > 0) {
                                        const gainParParticipant = gainsTotal / PARTICIPANTS.length;
                                        PARTICIPANTS.forEach(p => {
                                                      distribution[p].gains += gainParParticipant;
                                                      distribution[p].solde = distribution[p].gains - 180;
                                        });
                                        cagnotte += gainsTotal;
                            }

                            console.log('[TIRAGE] Nouveau tirage ajoute, gains:', gainsTotal);
                  }
          }
    }

    return tirage;
}

// ===== ROUTES API =====

// Sante du serveur
app.get('/health', (req, res) => {
    res.json({ 
          status: 'ok', 
          uptime: Math.floor(process.uptime()) + 's',
          cache: cacheEstValide() ? 'valide' : 'invalide',
          cacheExpiry: cacheExpiry ? cacheExpiry.toISOString() : null,
          tiragesEnMemoire: allTirages.length,
          timestamp: new Date().toISOString()
    });
});

// Tirage complet avec gains par grille
app.get('/api/loto-complet', async (req, res) => {
    try {
          const tirage = await getTirage();

          if (!tirage) {
                  return res.json({ 
                            success: false, 
                            error: lastError || 'Scraping FDJ impossible',
                            cacheValide: false
                  });
          }

          // Calcul des gains par grille
          const gainsParGrille = GRILLES.map((grille, idx) => {
                  const rg = tirage.rapportGains || {};
                  const n = tirage.nums.filter(x => grille.includes(x)).length;
                  const c = (CHANCES[idx] === tirage.chance);
                  let rang = null;
                  if (n === 5 && c) rang = '5+1';
                  else if (n === 5) rang = '5';
                  else if (n === 4 && c) rang = '4+1';
                  else if (n === 4) rang = '4';
                  else if (n === 3 && c) rang = '3+1';
                  else if (n === 3) rang = '3';
                  else if (n === 2 && c) rang = '2+1';
                  else if (n === 2) rang = '2';
                  else if (n <= 1 && c) rang = '1+1';
                  const gain = rang ? (rg[rang] || 0) : 0;
                  return { grille: idx + 1, nums: grille, chance: CHANCES[idx], matchs: n, chanceMatch: c, rang, gain };
          });

          // Meme logique pour nums2 (2nd tirage)
          const gainsParGrille2 = tirage.nums2 && tirage.nums2.length > 0
            ? GRILLES.map((grille, idx) => {
                        const n = tirage.nums2.filter(x => grille.includes(x)).length;
                        let rang = null;
                        if (n === 5) rang = '5';
                        else if (n === 4) rang = '4';
                        else if (n === 3) rang = '3';
                        else if (n === 2) rang = '2';
                        const gain = rang ? 0 : 0; // 2nd tirage sans rapport de gains specifique
                        return { grille: idx + 1, matchs: n, rang, gain };
            })
                  : [];

          const gainsTotal = Object.values(distribution).reduce((s, d) => s + d.gains, 0);

          res.json({
                  success: true,
                  tirage: {
                            ...tirage,
                            gainsParGrille,
                            gainsParGrille2
                  },
                  distribution,
                  gainsTotal,
                  cagnotte,
                  cacheValide: cacheEstValide(),
                  cacheExpiry: cacheExpiry ? cacheExpiry.toISOString() : null
          });
    } catch(e) {
          console.error('[API] /loto-complet error:', e.message);
          res.status(500).json({ success: false, error: e.message });
    }
});

// Bilan du syndicat
app.get('/api/bilan', (req, res) => {
    try {
          const gainsTotal = Object.values(distribution).reduce((s, d) => s + d.gains, 0);
          const tiragesEffectues = allTirages.length;
          const roi = ((gainsTotal / 2340) * 100).toFixed(2);

          res.json({
                  success: true,
                  gainsTotal: gainsTotal.toFixed(2),
                  cagnotte: cagnotte.toFixed(2),
                  tiragesEffectues,
                  roi,
                  distribution,
                  cotisationTotale: 2340
          });
    } catch(e) {
          res.status(500).json({ success: false, error: e.message });
    }
});

// Stats et historique complet
app.get('/api/stats', (req, res) => {
    try {
          const DEBUT_SYNDICAT = new Date('2026-06-01T00:00:00.000Z');
          const historiqueFiltre = allTirages
            .filter(t => new Date(t.date) >= DEBUT_SYNDICAT)
            .sort((a, b) => new Date(b.date) - new Date(a.date));

          res.json({
                  success: true,
                  historique: historiqueFiltre,
                  tiragesTotal: historiqueFiltre.length,
                  gainsTotal: historiqueFiltre.reduce((s, t) => s + (t.gains || 0), 0).toFixed(2)
          });
    } catch(e) {
          res.status(500).json({ success: false, error: e.message });
    }
});

// Statut du cache
app.get('/api/cache-status', (req, res) => {
    res.json({
          success: true,
          cacheValide: cacheEstValide(),
          cacheExpiry: cacheExpiry ? cacheExpiry.toISOString() : null,
          dernierScraping: tirageCache ? new Date().toISOString() : null,
          tiragesEnMemoire: allTirages.length,
          lastError: lastError || null
    });
});

// Forcer le scraping (admin)
app.post('/api/force-scraping', async (req, res) => {
    try {
          console.log('[ADMIN] Force scraping demande');
          tirageCache = null;
          cacheExpiry = null;
          const tirage = await getTirage();
          if (tirage) {
                  res.json({ success: true, tirage, message: 'Scraping force avec succes' });
          } else {
                  res.json({ success: false, error: lastError || 'Echec du scraping', message: 'Scraping force echoue' });
          }
    } catch(e) {
          res.status(500).json({ success: false, error: e.message });
    }
});

// Rapport de gains detaille pour un tirage (debug)
app.get('/api/rapport-gains', async (req, res) => {
    try {
          const tirage = await getTirage();
          if (!tirage) return res.json({ success: false, error: 'Pas de tirage disponible' });

          const rg = tirage.rapportGains || {};
          const detail = GRILLES.map((grille, idx) => {
                  const n = tirage.nums.filter(x => grille.includes(x)).length;
                  const c = (CHANCES[idx] === tirage.chance);
                  let rang = null;
                  if (n===5&&c) rang='5+1'; else if (n===5) rang='5';
                  else if (n===4&&c) rang='4+1'; else if (n===4) rang='4';
                  else if (n===3&&c) rang='3+1'; else if (n===3) rang='3';
                  else if (n===2&&c) rang='2+1'; else if (n===2) rang='2';
                  else if (c) rang='1+1';
                  return {
                            grille: idx + 1,
                            nums: grille,
                            chance: CHANCES[idx],
                            tirageDraw: tirage.nums,
                            chanceDrawn: tirage.chance,
                            matchNums: n,
                            matchChance: c,
                            rang,
                            gain: rang ? (rg[rang] || 0) : 0
                  };
          });

          res.json({
                  success: true,
                  tirage: { nums: tirage.nums, chance: tirage.chance, date: tirage.date },
                  rapportGains: rg,
                  detail,
                  totalGain: detail.reduce((s, d) => s + d.gain, 0)
          });
    } catch(e) {
          res.status(500).json({ success: false, error: e.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`[SERVER] Lotopotes backend demarre sur port ${PORT}`);
    console.log('[SERVER] Scraping initial au demarrage...');
    getTirage().then(t => {
          if (t) console.log('[SERVER] Tirage initial charge:', t.nums, 'Chance:', t.chance);
          else console.log('[SERVER] Echec tirage initial');
    });
});

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

// ===== CACHE DU TIRAGE =====
let tirageCache = null;      // résultat du scraping
let cacheExpiry = null;      // date d'expiration du cache

function prochainTirage() {
  // Retourne la date du prochain tirage (lun/mer/sam à 21h00)
  // On utilise 21h00 (tirage à 20h50 + 10min de marge)
  const now = new Date();
  const lotoJours = [1, 3, 6]; // lundi=1, mercredi=3, samedi=6
  
  // Chercher le prochain jour de tirage
  for (let i = 0; i <= 7; i++) {
    const candidate = new Date(now);
    candidate.setDate(now.getDate() + i);
    candidate.setHours(21, 0, 0, 0);
    
    if (lotoJours.includes(candidate.getDay()) && candidate > now) {
      return candidate;
    }
  }
}

function cacheEstValide() {
  if (!tirageCache || !cacheExpiry) return false;
  return new Date() < cacheExpiry;
}

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
    if (m && m[1] && m[1] !== 'Pas de gagnant') {
      rapportGains[rang.key] = parseFloat(m[1].replace(/\s/g, '').replace(',', '.'));
    } else {
      rapportGains[rang.key] = 0;
    }
  }
  return rapportGains;
}

async function scraperTirage() {
  console.log('[SCRAPE] Démarrage scraping secretsdujeu.com...');
  
  const main = await fetchFromUrl('www.secretsdujeu.com', '/page/jeux_loto_resultats.html');
  if (!main.ok || main.status !== 200) {
    lastError = 'Erreur page principale: ' + (main.error || main.status);
    return null;
  }
  const html = main.data;

  // DATE
  let tirageDate = null;
  const dateMatch = /"dateModified":"(\d{4}-\d{2}-\d{2})/.exec(html);
  if (dateMatch) {
    tirageDate = dateMatch[1] + 'T20:50:00.000Z';
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
  }

  // NUMÉROS via JSON-LD
  let nums = [], chance = null, nums2 = [];
  const jsonLdNums = /combinaison gagnante[^0-9]*(\d+)-(\d+)-(\d+)-(\d+)-(\d+)[^0-9]*num.ro Chance est le (\d+)/.exec(html);
  if (jsonLdNums) {
    nums = [1,2,3,4,5].map(i => parseInt(jsonLdNums[i]));
    chance = parseInt(jsonLdNums[6]);
  } else {
    lastError = 'Numéros non trouvés dans JSON-LD';
    return null;
  }

  // URL page détail
  const urlMatch = /"url":"(https:\/\/www\.secretsdujeu\.com\/loto\/resultat\/tirage-loto-du-[^"]+)"/.exec(html);
  let rapportGains = null;
  
  if (urlMatch) {
    const tiragePath = urlMatch[1].replace('https://www.secretsdujeu.com', '');
    const detail = await fetchFromUrl('www.secretsdujeu.com', tiragePath);
    
    if (detail.ok && detail.status === 200) {
      rapportGains = parseMontants(detail.data);
      
      // 2nd tirage
      const nums2Pattern = /class=["\']loto-numero second-tir["\'][^>]*>\s*(\d{1,2})\s*<\/p>/g;
      let m2;
      nums2 = [];
      while ((m2 = nums2Pattern.exec(detail.data)) !== null) {
        nums2.push(parseInt(m2[1]));
      }
    }
  }

  if (!rapportGains || (rapportGains['5'] === 0 && rapportGains['4+1'] === 0)) {
    rapportGains = {'5+1':0,'5':100000,'4+1':1000,'4':500,'3+1':50,'3':20,'2+1':9,'2':4,'1+1':2.20};
  }

  const result = { nums, chance, nums2, date: tirageDate, rapportGains };
  
  // Stocker dans le cache + calculer expiry = prochain tirage
  tirageCache = result;
  cacheExpiry = prochainTirage();
  console.log('[SCRAPE] ✅ Cache mis à jour. Valide jusqu\'au: ' + cacheExpiry.toISOString());
  console.log('[SCRAPE] Nums: ' + nums.join(',') + ' Chance: ' + chance);
  
  return result;
}

async function getTirage() {
  if (cacheEstValide()) {
    console.log('[CACHE] ✅ Utilisation du cache (expire: ' + cacheExpiry.toISOString() + ')');
    return tirageCache;
  }
  console.log('[CACHE] ⏰ Cache expiré ou vide → scraping...');
  return await scraperTirage();
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
    const tirage = await getTirage();
    if (!tirage) return res.status(500).json({ success: false, error: lastError });

    const DEBUT_SYNDICAT = new Date('2026-06-01T00:00:00.000Z');
    const dateTirage = new Date(tirage.date);
    if (dateTirage < DEBUT_SYNDICAT) {
      cagnotte = 0;
      PARTICIPANTS.forEach(p => { distribution[p] = { gains: 0, solde: -180 }; });
      allTirages = [];
      return res.json({ success: true, tirage, cagnotte: '0.00', distribution, historique: [], 
        cache: { valide: cacheEstValide(), expire: cacheExpiry }, timestamp: new Date().toISOString() });
    }

    if (!tirageDejàEnregistré(tirage)) {
      let gainsTotal = 0;
      GRILLES.forEach((grille, idx) => {
        const g = calculerGains(grille, tirage.nums, CHANCES[idx], tirage.chance, tirage.rapportGains);
        gainsTotal += g;
        console.log('[LOG] Grille ' + (idx+1) + ' (chance=' + CHANCES[idx] + '): ' + g + '€');
      });
      cagnotte += gainsTotal;
      if (cagnotte >= 650) {
        const pp = 650 / 13;
        PARTICIPANTS.forEach(p => { distribution[p].gains += pp; distribution[p].solde += pp; });
        cagnotte -= 650;
        console.log('[LOG] 💸 DISTRIBUTION 650€!');
      }
      allTirages.push({ nums: tirage.nums, chance: tirage.chance, nums2: tirage.nums2, 
        gains: gainsTotal, rapportGains: tirage.rapportGains, date: tirage.date });
    }

    res.json({ success: true, tirage, cagnotte: cagnotte.toFixed(2), distribution, 
      historique: allTirages.slice(-10), 
      cache: { valide: true, expire: cacheExpiry },
      timestamp: new Date().toISOString() });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

app.get('/api/bilan', (req, res) => {
  const bilanArray = PARTICIPANTS.map((name, idx) => ({ id: idx+1, name, 
    gains: distribution[name].gains.toFixed(2), solde: distribution[name].solde.toFixed(2) }));
  const gainsTotal = Object.values(distribution).reduce((sum, d) => sum + d.gains, 0);
  res.json({ success: true, participants: bilanArray, gainsTotal: gainsTotal.toFixed(2), 
    soldeTotal: (gainsTotal-2340).toFixed(2), cagnotte: cagnotte.toFixed(2),
    tiragesEffectues: allTirages.length,
    timestamp: new Date().toISOString() });
});

app.get('/api/stats', (req, res) => {
  const gainsTotal = Object.values(distribution).reduce((sum, d) => sum + d.gains, 0);
  res.json({ success: true, tiragesEffectues: allTirages.length, gainsTotal: gainsTotal.toFixed(2), 
    roi: gainsTotal > 0 ? ((gainsTotal/2340)*100).toFixed(1)+'%' : '0.0%', 
    cagnotte: cagnotte.toFixed(2), historique: allTirages.slice(-10), timestamp: new Date().toISOString() });
});

app.get('/api/test', (req, res) => {
  res.json({ message: 'Backend operationnel', 
    cache: { valide: cacheEstValide(), expire: cacheExpiry, tirage: tirageCache ? tirageCache.nums : null },
    timestamp: new Date().toISOString() });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('✅ Backend démarré sur port ' + PORT));

// Route admin: forcer un scraping (vide le cache et rescrap)
app.get('/api/force-scrape', async (req, res) => {
  console.log('[ADMIN] Force scraping demandé');
  tirageCache = null;
  cacheExpiry = null;
  const tirage = await scraperTirage();
  if (!tirage) return res.json({ success: false, error: lastError });
  res.json({ success: true, tirage, cacheExpire: cacheExpiry, timestamp: new Date().toISOString() });
});
