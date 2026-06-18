const express = require('express');
const cors = require('cors');
const https = require('https');
const app = express();
app.use(cors());

const GRILLES = [[7,12,23,34,45],[6,15,28,39,48],[3,18,31,42,49],[8,19,32,41,46],[5,22,29,35,44]];
const CHANCES = [9,6,4,1,7];
const PARTICIPANTS = ['ANOUFA Fabienne & Moïse','BELLALOU Martine & Patrick','GRINAL Danielle & Serge','HOCHBERG Nathalie & Bruno','JURIS Virgine & Frédéric','KIMAN Laurence & Didier','LEVIN Gabrielle & Didier','MESGUICH Corinne & Jean Philippe','OIKNINE Muriel & Aaron','PARTOUCHE Sylvie & Serge','SITBON Leslie & OHAYON Gilles','TEMAN Eva & FINKELSTEIN Philippe','WEITZMANN Dalia & Jacques'];
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_REPO = process.env.GITHUB_REPO || 'MUXOIK/lotopotes';

let allTirages = [], distribution = {}, cagnotte = 0;
let tirageCache = null, cacheExpiry = null, dataFileSha = null;
PARTICIPANTS.forEach(p => { distribution[p] = {gains:0,solde:-180}; });

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
    if (g > 0) { total += g; gainsDetails.push({grille: i+1, tirage: '1er', gain: g}); }
    if (a2 && rg2) {
      const n2 = t.nums2.filter(x => GRILLES[i].includes(x)).length;
      let g2 = 0;
      if (n2===5) g2=rg2['5']||0;
      else if (n2===4) g2=rg2['4']||0;
      else if (n2===3) g2=rg2['3']||0;
      else if (n2===2) g2=rg2['2']||0;
      if (g2 > 0) { total += g2; gainsDetails.push({grille: i+1, tirage: '2nd', gain: g2}); }
    }
  }
  return {total, gainsDetails};
}

async function sauvegarder() {
  if (!GITHUB_TOKEN) return;
  try {
    const content = Buffer.from(JSON.stringify({allTirages,distribution,cagnotte,updatedAt:new Date().toISOString()},null,2)).toString('base64');
    const res = await githubRequest('PUT','data.json',{message:'data '+new Date().toISOString().split('T')[0],content,...(dataFileSha?{sha:dataFileSha}:{})});
    if (res.ok) { dataFileSha = res.data.content.sha; console.log('[DB] ✅ Sauvegardé'); }
  } catch(e) { console.log('[DB] ❌ Erreur: '+e.message); }
}

async function chargerDonnees() {
  console.log('[DB] Chargement depuis GitHub...');
  if (!GITHUB_TOKEN) { 
    console.log('[DB] ⚠️ GITHUB_TOKEN vide - données locales uniquement');
    PARTICIPANTS.forEach(p=>{distribution[p]={gains:0,solde:-180};}); 
    return; 
  }
  try {
    const res = await githubRequest('GET','data.json');
    if (res.ok && res.data.content) {
      const d = JSON.parse(Buffer.from(res.data.content,'base64').toString('utf8'));
      allTirages = d.allTirages || [];
      distribution = d.distribution || {};
      cagnotte = d.cagnotte || 0;
      dataFileSha = res.data.sha;
      PARTICIPANTS.forEach(p => { if (!distribution[p]) distribution[p]={gains:0,solde:-180}; });
      console.log('[DB] ✅ Chargé: '+allTirages.length+' tirages, cagnotte '+cagnotte.toFixed(2)+'€');
    } else {
      console.log('[DB] ❌ Erreur GitHub');
      PARTICIPANTS.forEach(p=>{distribution[p]={gains:0,solde:-180};});
    }
  } catch(e) { console.log('[DB] ❌ Erreur: '+e.message); }
}

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
  return tirageCache && cacheExpiry && new Date() < cacheExpiry;
}

app.get('/api/loto-complet', async (req, res) => {
  if (cacheValide()) {
    return res.json({success:true,tirage:tirageCache,historique:allTirages,distribution,cagnotte});
  }
  
  const mainResp = await httpGet('www.secretsdujeu.com', '/page/jeux_loto_resultats.html');
  if (!mainResp.ok) {
    return res.json({success:false,tirage:tirageCache,historique:allTirages,distribution,cagnotte,error:'Erreur scraping'});
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
    return res.json({success:false,tirage:tirageCache,historique:allTirages,distribution,cagnotte,error:'Numéros non trouvés'});
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
  const {total, gainsDetails} = calculerGainsTirage(tirage);
  tirage.gainsDetails = gainsDetails;
  tirage.gainTotal = total;
  
  tirageCache = tirage;
  cacheExpiry = prochainTirage();
  
  res.json({success:true,tirage,historique:allTirages,distribution,cagnotte});
});

app.get('/api/stats', async (req, res) => {
  res.json({success:true,historique:allTirages,distribution,cagnotte,tirage:tirageCache});
});

app.get('/api/bilan', async (req, res) => {
  const gainsTotal = allTirages.reduce((sum, t) => sum + (t.gains || 0), 0);
  const tiragesEffectues = allTirages.length;
  res.json({success:true,gainsTotal,tiragesEffectues,distribution,cagnotte});
});

app.get('/api/test', (req, res) => {
  res.json({ok:true,allTirages:allTirages.length,cagnotte:cagnotte.toFixed(2),GITHUB_TOKEN:GITHUB_TOKEN?'✅':'❌'});
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
  console.log('✅ Port '+PORT);
  await chargerDonnees();
});
