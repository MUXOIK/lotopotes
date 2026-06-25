import express from 'express';
import cors from 'cors';
import https from 'https';
const app = express();
app.use(cors());

// ============================================
// CONFIGURATION
// ============================================

const GRILLES = [[7,12,23,34,45],[6,15,28,39,48],[3,18,31,42,49],[8,19,32,41,46],[5,22,29,35,44]];
const CHANCES = [9,6,4,1,7];
const PARTICIPANTS = ['ANOUFA Fabienne & Moïse','BELLALOU Martine & Patrick','GRINAL Danielle & Serge','HOCHBERG Nathalie & Bruno','JURIS Virgine & Frédéric','KIMAN Laurence & Didier','LEVIN Gabrielle & Didier','MESGUICH Corinne & Jean Philippe','OIKNINE Muriel & Aaron','PARTOUCHE Sylvie & Serge','SITBON Leslie & OHAYON Gilles','TEMAN Eva & FINKELSTEIN Philippe','WEITZMANN Dalia & Jacques'];
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_REPO = process.env.GITHUB_REPO || 'MUXOIK/lotopotes';

// ============================================
// STATE - Deux sources de données distinctes
// ============================================

let tirageScrape = null;      // Tirage du jour (data-scrape.json)
let cacheExpiry = null;        // Quand le cache expire
let dataHistoriqueSha = null;  // SHA de data.json
let dataScrapeJeSha = null;    // SHA de data-scrape.json

// Variables pour historique et distribution (chargées de data.json)
let allGains = [];             // [{date, grille, tirage, gain}, ...]
let distribution = {};         // {PARTICIPANT: {gains, solde}, ...}
let cagnotte = 0;              // Somme des gains
let nombreTirages = 9;         // Nombre total de tirages depuis le 1er juin
let dataCountTiragesSha = null; // SHA de data-count-tirages.json

PARTICIPANTS.forEach(p => { distribution[p] = {gains:0,solde:-180}; });

// ============================================
// UTILITAIRES
// ============================================

function sameNums(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  return [...a].sort((x,y)=>x-y).join(',') === [...b].sort((x,y)=>x-y).join(',');
}

function githubRequest(method, path, body) {
  return new Promise((resolve) => {
    const payload = body ? JSON.stringify(body) : null;
    const options = {
      hostname: 'api.github.com',
      path: '/repos/' + GITHUB_REPO + '/contents/' + path,
      method,
      headers: {'Authorization':'token '+GITHUB_TOKEN,'User-Agent':'lotopotes','Accept':'application/vnd.github.v3+json','Content-Type':'application/json',...(payload?{'Content-Length':Buffer.byteLength(payload)}:{})},
      timeout: 15000
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', c => { data += c; });
      res.on('end', () => { try { resolve({ok:res.statusCode<400,status:res.statusCode,data:JSON.parse(data)}); } catch(e) { resolve({ok:false,error:'parse'}); } });
    });
    req.on('error', err => resolve({ok:false,error:err.message}));
    req.on('timeout', () => { req.destroy(); resolve({ok:false,error:'timeout'}); });
    if (payload) req.write(payload);
    req.end();
  });
}

function calculerGainsTirage(t) {
  const rg = t.rapportGains || {};
  const rg2 = t.rapportGains2 || {};
  const a2 = t.nums2 && t.nums2.length === 5 && Object.values(rg2).some(v=>v>0);
  let total = 0;
  const gainsDetails = [];
  for (let i = 0; i < GRILLES.length; i++) {
    const n = t.nums.filter(x => GRILLES[i].includes(x)).length;
    const c = (CHANCES[i] === t.chance);
    let g = 0;
    if (n===5&&c) g=rg['5+1']||0;
    else if (n===5) g=rg['5']||0;
    else if (n===4&&c) g=rg['4+1']||0;
    else if (n===4) g=rg['4']||0;
    else if (n===3&&c) g=rg['3+1']||0;
    else if (n===3) g=rg['3']||0;
    else if (n===2&&c) g=rg['2+1']||0;
    else if (n===2) g=rg['2']||0;
    else if (n<=1&&c) g=rg['1+1']||0;
    const estGagnant1=(n===5&&c)||n===5||(n===4&&c)||n===4||(n===3&&c)||n===3||(n===2&&c)||(n<1&&c); if (estGagnant1) { total += g; gainsDetails.push({grille: i+1, tirage: '1er', gain: g}); }
    if (a2 && rg2) {
      const n2 = t.nums2.filter(x => GRILLES[i].includes(x)).length;
      let g2 = 0;
      if (n2===5) g2=rg2['5']||0;
      else if (n2===4) g2=rg2['4']||0;
      else if (n2===3) g2=rg2['3']||0;
      else if (n2===2) g2=rg2['2']||0;
      const estGagnant2=n2===5||n2===4||n2===3||n2===2; if (estGagnant2) { total += g2; gainsDetails.push({grille: i+1, tirage: '2nd', gain: g2}); }
    }
  }
  return {total, gainsDetails};
}

// ============================================
// CHARGEMENT DEPUIS GITHUB
// ============================================

async function chargerHistoriqueDonnees() {
  console.log('[DB] Chargement data.json (historique gains)...');
  if (!GITHUB_TOKEN) { 
    console.log('[DB] ⚠️  GITHUB_TOKEN vide');
    allGains = [];
    distribution = {};
    PARTICIPANTS.forEach(p=>{distribution[p]={gains:0,solde:-180};});
    return; 
  }
  try {
    const res = await githubRequest('GET','data.json');
    if (res.ok && res.data.content) {
      const d = JSON.parse(Buffer.from(res.data.content,'base64').toString('utf8'));
      allGains = d.allTirages || [];
      distribution = d.distribution || {};
      cagnotte = d.cagnotte || 0;
      dataHistoriqueSha = res.data.sha;
      PARTICIPANTS.forEach(p => { if (!distribution[p]) distribution[p]={gains:0,solde:-180}; });
      console.log('[DB] ✅ Historique chargé: '+allGains.length+' tirages gagnants, cagnotte '+cagnotte.toFixed(2)+'€');
    } else {
      console.log('[DB] ❌ Erreur GitHub historique');
    }
  } catch(e) { console.log('[DB] ❌ Erreur: '+e.message); }
}

async function chargerScrapeData() {
  console.log('[DB] Chargement data-scrape.json (tirage du jour)...');
  if (!GITHUB_TOKEN) { 
    console.log('[DB] ⚠️  GITHUB_TOKEN vide');
    tirageScrape = null;
    return; 
  }
  try {
    const res = await githubRequest('GET','data-scrape.json');
    if (res.ok && res.data.content) {
      const d = JSON.parse(Buffer.from(res.data.content,'base64').toString('utf8'));
      tirageScrape = d.tirage || null;
      dataScrapeJeSha = res.data.sha;
      if (tirageScrape) console.log('[DB] ✅ Tirage scrappé chargé: '+tirageScrape.date.split('T')[0]);
    } else {
      console.log('[DB] ⚠️  data-scrape.json pas encore créé');
      tirageScrape = null;
    }
  } catch(e) { console.log('[DB] ⚠️  Erreur chargement scrape: '+e.message); tirageScrape = null; }
}

async function chargerCompteurTirages() {
  console.log('[DB] Chargement data-count-tirages.json (compteur)...');
  if (!GITHUB_TOKEN) { 
    console.log('[DB] ⚠️  GITHUB_TOKEN vide');
    nombreTirages = 9;
    return; 
  }
  try {
    const res = await githubRequest('GET','data-count-tirages.json');
    if (res.ok && res.data.content) {
      const d = JSON.parse(Buffer.from(res.data.content,'base64').toString('utf8'));
      nombreTirages = d.nombre_tirages || 9;
      dataCountTiragesSha = res.data.sha;
      console.log('[DB] ✅ Compteur chargé: '+nombreTirages+' tirages');
    } else {
      console.log('[DB] ⚠️  data-count-tirages.json pas encore créé');
      nombreTirages = 9;
    }
  } catch(e) { console.log('[DB] ⚠️  Erreur chargement compteur: '+e.message); nombreTirages = 9; }
}

// ============================================
// SAUVEGARDE VERS GITHUB
// ============================================

async function sauvegarderScrape(tirage) {
  if (!GITHUB_TOKEN) return;
  try {
    const content = Buffer.from(JSON.stringify({tirage},null,2)).toString('base64');
    const res = await githubRequest('PUT','data-scrape.json',{message:'scrape '+new Date().toISOString().split('T')[0],content,...(dataScrapeJeSha?{sha:dataScrapeJeSha}:{})});
    if (res.ok) { dataScrapeJeSha = res.data.content.sha; console.log('[DB] ✅ data-scrape.json sauvegardé'); }
  } catch(e) { console.log('[DB] ❌ Erreur sauvegarde scrape: '+e.message); }
}

async function ajouterAuHistorique(tirage, gainsDetails) {
  if (!GITHUB_TOKEN || gainsDetails.length === 0) return;
  try {
    allGains.push(tirage);
    const gainTotal = gainsDetails.reduce((sum, g) => sum + g.gain, 0);
    cagnotte += gainTotal;
    const content = Buffer.from(JSON.stringify({allTirages:allGains,distribution,cagnotte,updatedAt:new Date().toISOString()},null,2)).toString('base64');
    const res = await githubRequest('PUT','data.json',{message:'gain '+gainTotal+'€ le '+tirage.date.split('T')[0],content,...(dataHistoriqueSha?{sha:dataHistoriqueSha}:{})});
    if (res.ok) { dataHistoriqueSha = res.data.content.sha; console.log('[DB] ✅ data.json mis à jour avec gain'); }
  } catch(e) { console.log('[DB] ❌ Erreur ajout historique: '+e.message); }
}

async function sauvegarderCompteur() {
  if (!GITHUB_TOKEN) return;
  try {
    const content = Buffer.from(JSON.stringify({nombre_tirages:nombreTirages},null,2)).toString('base64');
    const res = await githubRequest('PUT','data-count-tirages.json',{message:'tirage '+nombreTirages+' le '+new Date().toISOString().split('T')[0],content,...(dataCountTiragesSha?{sha:dataCountTiragesSha}:{})});
    if (res.ok) { dataCountTiragesSha = res.data.content.sha; console.log('[DB] ✅ Compteur sauvegardé: '+nombreTirages+' tirages'); }
  } catch(e) { console.log('[DB] ❌ Erreur sauvegarde compteur: '+e.message); }
}

// ============================================
// SCRAPING
// ============================================

function httpGet(host, path) {
  return new Promise((resolve) => {
    const options = {hostname:host,path,method:'GET',headers:{'User-Agent':'Mozilla/5.0'},timeout:15000};
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', c => { data += c; });
      res.on('end', () => resolve({ok:true,status:res.statusCode,data}));
    });
    req.on('error', err => resolve({ok:false,error:err.message}));
    req.on('timeout', () => { req.destroy(); resolve({ok:false,error:'timeout'}); });
    req.end();
  });
}

function extraireLignesTableau(html) {
  const decoded = html.replace(/&nbsp;/g, ' ').replace(/&euro;/g, '€').replace(/&quot;/g, '"').replace(/&amp;/g, '&');
  const trRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  const lignes = [];
  let tr;
  while ((tr = trRegex.exec(decoded)) !== null) {
    const cellules = [];
    const cellRegex = /<(?:td|th)[^>]*>([\s\S]*?)<\/(?:td|th)>/gi;
    let cell;
    while ((cell = cellRegex.exec(tr[1])) !== null) {
      const texte = cell[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      cellules.push(texte);
    }
    if (cellules.length > 0) lignes.push(cellules);
  }
  return lignes;
}

function parseMontantCellule(texte) {
  if (texte === '/' || /pas de gagnant/i.test(texte)) return 0;
  const m = /([\d\s,.']+?)(?:\s*(?:€|EUR|euros?|$))/i.exec(texte);
  if (m) {
    const num = m[1].replace(/\s/g,'').replace(',','.');
    const parsed = parseFloat(num);
    return isNaN(parsed) ? null : parsed;
  }
  return null;
}

function parseMontants1er(html) {
  const lignes = extraireLignesTableau(html);
  const rg = {'5+1':0,'5':0,'4+1':0,'4':0,'3+1':0,'3':0,'2+1':0,'2':0,'1+1':0};
  
  for (let i = 0; i < lignes.length; i++) {
    const rowText = lignes[i].join(' ');
    if (/2nd.*tirage|second.*tirage/i.test(rowText)) break;
    
    const cells = lignes[i];
    let bonsMatch = /^(\d)\s*(?:bons?|bon)\b/i.exec(cells[0] || '');
    
    if (!bonsMatch && /0.*ou.*1.*bon/i.test(cells[0])) {
      bonsMatch = ['', '1'];
    }
    if (!bonsMatch) continue;
    
    const bons = parseInt(bonsMatch[1]);
    const avecChance = /chance/i.test(rowText);
    let montant = null;
    
    for (let j = 0; j < cells.length; j++) {
      if (/€|\/|pas de gagnant/i.test(cells[j])) {
        montant = parseMontantCellule(cells[j]);
        break;
      }
    }
    
    const cle = avecChance ? (bons+'+1') : String(bons);
    if (cle in rg) {
      rg[cle] = montant !== null ? montant : 0;
    }
  }
  return rg;
}

function parseMontants2nd(html) {
  const lignes = extraireLignesTableau(html);
  const rg = {'5':0,'4':0,'3':0,'2':0};
  let foundSecond = false;
  
  for (let i = 0; i < lignes.length; i++) {
    const rowText = lignes[i].join(' ');
    if (/2nd.*tirage|second.*tirage/i.test(rowText)) {
      foundSecond = true;
      continue;
    }
    if (!foundSecond) continue;
    
    const cells = lignes[i];
    const bonsMatch = /^(\d)\s*(?:bons?|bon)\b/i.exec(cells[0] || '');
    if (!bonsMatch) continue;
    
    const bons = parseInt(bonsMatch[1]);
    if (![2,3,4,5].includes(bons)) continue;
    
    let montant = null;
    for (let j = 0; j < cells.length; j++) {
      if (/€|\/|pas de gagnant/i.test(cells[j])) {
        montant = parseMontantCellule(cells[j]);
        break;
      }
    }
    
    const cle = String(bons);
    if (cle in rg && rg[cle] === 0) {
      rg[cle] = montant !== null ? montant : 0;
    }
  }
  return rg;
}

function prochainTirage() {
  const now = new Date();
  const jours = [1, 3, 6];
  for (let i = 0; i < 3; i++) {
    const d = new Date(now);
    d.setDate(now.getDate() + i);
    const dayOfWeek = d.getDay();
    if (jours.includes(dayOfWeek)) {
      d.setHours(20, 50, 0, 0);
      if (d > now) return d;
    }
  }
  const d = new Date(now);
  d.setDate(now.getDate() + 7);
  d.setHours(20, 50, 0, 0);
  return d;
}

function cacheValide() {
  return tirageScrape && cacheExpiry && new Date() < cacheExpiry;
}

// ============================================
// ENDPOINTS API
// ============================================

app.get('/api/loto-complet', async (req, res) => {
  // Attendre la fin de l'initialisation si le serveur vient de démarrer
  if (initPromise) await initPromise;

  if (cacheValide()) {
    const {total, gainsDetails} = calculerGainsTirage(tirageScrape);
    return res.json({success:true,tirage:{...tirageScrape,gainTotal:total,gainsDetails},historique:allGains,distribution,cagnotte});
  }
  
  const mainResp = await httpGet('www.secretsdujeu.com', '/page/jeux_loto_resultats.html');
  if (!mainResp.ok) {
    const {total, gainsDetails} = tirageScrape ? calculerGainsTirage(tirageScrape) : {total:0,gainsDetails:[]};
    return res.json({success:false,tirage:tirageScrape?{...tirageScrape,gainTotal:total,gainsDetails}:null,historique:allGains,distribution,cagnotte,error:'Erreur scraping'});
  }
  
  const html = mainResp.data;
  let date = null;
  const dm = /\"dateModified\":\"(\d{4}-\d{2}-\d{2})/.exec(html);
  if (dm) date = dm[1]+'T20:50:00.000Z';
  else {
    const now = new Date(), day = now.getDay(), jours = [1,3,6];
    let db = 0;
    for (let i = 0; i <= 7; i++) { if (jours.includes(((day-i)+7)%7)) { db = i; break; } }
    const last = new Date(now); last.setDate(now.getDate()-db);
    if (db === 0 && now.getHours() < 21) {
      for (let i = 1; i <= 7; i++) {
        if (jours.includes(((day-i)+7)%7)) { last.setDate(now.getDate()-i); break; }
      }
    }
    last.setHours(20, 50, 0, 0);
    date = last.toISOString();
  }
  
  const m = /combinaison gagnante[^0-9]*(\d+)-(\d+)-(\d+)-(\d+)-(\d+)[^0-9]*num.ro Chance est le (\d+)/.exec(html);
  if (!m) {
    const {total, gainsDetails} = tirageScrape ? calculerGainsTirage(tirageScrape) : {total:0,gainsDetails:[]};
    return res.json({success:false,tirage:tirageScrape?{...tirageScrape,gainTotal:total,gainsDetails}:null,historique:allGains,distribution,cagnotte,error:'Numéros non trouvés'});
  }
  
  const nums = [1,2,3,4,5].map(i => parseInt(m[i]));
  const chance = parseInt(m[6]);
  let rg1 = {'5+1':0,'5':100000,'4+1':1000,'4':500,'3+1':50,'3':20,'2+1':9,'2':4,'1+1':2.20};
  let rg2 = {}, nums2 = [];
  
  const urlM = /\"url\":\"(https:\/\/www\.secretsdujeu\.com\/loto\/resultat\/tirage-loto-du-[^\"]+)\"/.exec(html);
  if (urlM) {
    const detail = await httpGet('www.secretsdujeu.com', urlM[1].replace('https://www.secretsdujeu.com',''));
    if (detail.ok && detail.status === 200) {
      rg1 = parseMontants1er(detail.data);
      rg2 = parseMontants2nd(detail.data);
      const p2 = /class=[\"']loto-numero second-tir[\"'][^>]*>\s*(\d{1,2})\s*<\/p>/g;
      let mm;
      while ((mm = p2.exec(detail.data)) !== null) nums2.push(parseInt(mm[1]));
    }
  }
  
  const tirage = {nums, chance, nums2, date, rapportGains: rg1, rapportGains2: rg2};
  
  // FALLBACK : Si scraping échoue, reprendre l'historique
  if (allGains.length > 0 && Object.values(tirage.rapportGains).every(v => v === 0)) {
    const dernierGain = allGains[allGains.length - 1];
    if (sameNums(tirage.nums, dernierGain.nums) && sameNums(tirage.nums2, dernierGain.nums2)) {
      tirage.rapportGains = dernierGain.rapportGains || tirage.rapportGains;
      tirage.rapportGains2 = dernierGain.rapportGains2 || tirage.rapportGains2;
    }
  }
  
  const {total, gainsDetails} = calculerGainsTirage(tirage);
  tirage.gainTotal = total;
  tirage.gainsDetails = gainsDetails;
  
  // Incrémenter le compteur si c'est un nouveau tirage
  const previousDate = tirageScrape ? tirageScrape.date : null;
  tirageScrape = tirage;
  cacheExpiry = prochainTirage();
  
  if (!previousDate || previousDate !== tirage.date) {
    nombreTirages++;
    await sauvegarderCompteur();
  }
  
  // Sauvegarder dans data-scrape.json
  await sauvegarderScrape(tirage);
  
  // Si gains > 0, ajouter à data.json (historique)
  if (total > 0) {
    await ajouterAuHistorique(tirage, gainsDetails);
  }
  
  res.json({success:true,tirage,historique:allGains,distribution,cagnotte});
});

app.get('/api/stats', async (req, res) => {
  if (initPromise) await initPromise;
  res.json({success:true,historique:allGains,distribution,cagnotte});
});

app.get('/api/bilan', async (req, res) => {
  if (initPromise) await initPromise;
  const gainsTotal = allGains.reduce((sum, t) => sum + (t.gains || 0), 0);
  const tiragesEffectues = nombreTirages;
  res.json({success:true,gainsTotal,tiragesEffectues,distribution,cagnotte});
});

app.get('/api/test', (req, res) => {
  res.json({ok:true,allGains:allGains.length,cagnotte:cagnotte.toFixed(2),GITHUB_TOKEN:GITHUB_TOKEN?'✅':'❌'});
});

// ============================================
// DÉMARRAGE
// ============================================

// Promesse d'initialisation — les requêtes l'attendent si le serveur vient de démarrer
let initPromise = null;

async function initialiser() {
  console.log('[INIT] Chargement des données...');
  await chargerHistoriqueDonnees();
  await chargerScrapeData();
  await chargerCompteurTirages();
  if (tirageScrape) {
    cacheExpiry = prochainTirage();
    const {total, gainsDetails} = calculerGainsTirage(tirageScrape);
    tirageScrape.gainTotal = total;
    tirageScrape.gainsDetails = gainsDetails;
    console.log('[CACHE] ✅ Pré-rempli avec tirage du '+tirageScrape.date.split('T')[0]);
  }
  console.log('[INIT] ✅ Prêt — cache valide: '+cacheValide());
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('✅ Port '+PORT);
  initPromise = initialiser();
});
 
