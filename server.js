const express = require('express');
const cors = require('cors');
const https = require('https');
const app = express();
app.use(cors());

const GRILLES = [[7,12,23,34,45],[6,15,28,39,48],[3,18,31,42,49],[8,19,32,41,46],[5,22,29,35,44]];
const CHANCES = [9,6,4,1,7];
const PARTICIPANTS = ['ANOUFA Fabienne & Moïse','BELLALOU Martine & Patrick','GRINAL Danielle & Serge','HOCHBERG Nathalie & Bruno','JURIS Virgine & Frédéric','KIMAN Laurence & Didier','LEVIN Gabrielle & Didier','MESGUICH Corinne & Jean Philippe','OIKNINE Muriel & Aaron','PARTOUCHE Sylvie & Serge','SITBON Leslie & OHAYON Gilles','TEMAN Eva & FINKELSTEIN Philippe','WEITZMANN Dalia & Jacques'];
const DEBUT = new Date('2026-06-01T00:00:00.000Z');
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_REPO = process.env.GITHUB_REPO || 'MUXOIK/lotopotes';

let allTirages = [], distribution = {}, cagnotte = 0, lastError = '';
let tirageCache = null, cacheExpiry = null, dataFileSha = null;
PARTICIPANTS.forEach(p => { distribution[p] = {gains:0,solde:-180}; });

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
  GRILLES.forEach((g,i) => {
    const n = t.nums.filter(x=>g.includes(x)).length, c = CHANCES[i]===t.chance;
    let g1 = 0;
    if (n===5&&c) g1=rg['5+1']||0; else if (n===5) g1=rg['5']||0;
    else if (n===4&&c) g1=rg['4+1']||0; else if (n===4) g1=rg['4']||0;
    else if (n===3&&c) g1=rg['3+1']||0; else if (n===3) g1=rg['3']||0;
    else if (n===2&&c) g1=rg['2+1']||0; else if (n===2) g1=rg['2']||0;
    else if (c) g1=rg['1+1']||0;
    let g2 = 0;
    if (a2) {
      const n2 = t.nums2.filter(x=>g.includes(x)).length;
      if (n2===5) g2=rg2['5']||0; else if (n2===4) g2=rg2['4']||0;
      else if (n2===3) g2=rg2['3']||0; else if (n2===2) g2=rg2['2']||0;
    }
    total += g1 + g2;
  });
  return total;
}

async function sauvegarder() {
  if (!GITHUB_TOKEN) return;
  try {
    const content = Buffer.from(JSON.stringify({allTirages,distribution,cagnotte,updatedAt:new Date().toISOString()},null,2)).toString('base64');
    const res = await githubRequest('PUT','data.json',{message:'data '+new Date().toISOString().split('T')[0],content,...(dataFileSha?{sha:dataFileSha}:{})});
    if (res.ok) { dataFileSha = res.data.content.sha; console.log('[DB] ✅ Sauvegardé'); }
    else console.log('[DB] Erreur: '+JSON.stringify(res.data).substring(0,200));
  } catch(e) { console.log('[DB] Erreur save: '+e.message); }
}

async function chargerDonnees() {
  if (!GITHUB_TOKEN) { PARTICIPANTS.forEach(p=>{distribution[p]={gains:0,solde:-180};}); return; }
  try {
    const res = await githubRequest('GET','data.json');
    if (res.ok && res.data.content) {
      const d = JSON.parse(Buffer.from(res.data.content,'base64').toString('utf8'));
      allTirages = d.allTirages || [];
      distribution = d.distribution || {};
      cagnotte = d.cagnotte || 0;
      dataFileSha = res.data.sha;
      PARTICIPANTS.forEach(p => { if (!distribution[p]) distribution[p]={gains:0,solde:-180}; });
      console.log('[DB] Chargé: '+allTirages.length+' tirages, cagnotte='+cagnotte+'€');

      // MIGRATION: recalculer les gains si rapportGains2 manquant ou gains incorrect
      let needSave = false;
      let nouvelleCagnotte = 0;
      for (let i=0; i<allTirages.length; i++) {
        if (!allTirages[i].rapportGains2) { allTirages[i].rapportGains2 = {}; needSave = true; }
        const bonGain = calculerGainsTirage(allTirages[i]);
        if (Math.abs(bonGain - allTirages[i].gains) > 0.01) {
          console.log('[MIGRATION] Tirage '+allTirages[i].date.split('T')[0]+': '+allTirages[i].gains+'€ → '+bonGain+'€');
          allTirages[i].gains = bonGain;
          needSave = true;
        }
        nouvelleCagnotte += allTirages[i].gains;
      }
      if (Math.abs(nouvelleCagnotte - cagnotte) > 0.01) {
        console.log('[MIGRATION] Cagnotte: '+cagnotte+'€ → '+nouvelleCagnotte+'€');
        cagnotte = nouvelleCagnotte;
        needSave = true;
      }
      if (needSave) { console.log('[MIGRATION] Sauvegarde...'); await sauvegarder(); }
    } else {
      PARTICIPANTS.forEach(p=>{distribution[p]={gains:0,solde:-180};});
      console.log('[DB] Fichier vide');
    }
  } catch(e) {
    PARTICIPANTS.forEach(p=>{distribution[p]={gains:0,solde:-180};});
    console.log('[DB] Erreur: '+e.message);
  }
}

function prochainTirage() {
  const now = new Date(), day = now.getDay(), jours = [1,3,6];
  for (let i=0; i<=7; i++) {
    const c = new Date(now); c.setDate(now.getDate()+i); c.setHours(21,0,0,0);
    if (jours.includes(c.getDay()) && c > now) return c;
  }
}

function cacheValide() { return tirageCache && cacheExpiry && new Date() < cacheExpiry; }

function httpGet(hostname, path) {
  return new Promise((resolve) => {
    const options = {hostname,path,method:'GET',headers:{'User-Agent':'Mozilla/5.0 Chrome/120','Accept':'text/html','Accept-Language':'fr-FR','Cache-Control':'no-cache'},timeout:20000};
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', c => { data += c; });
      res.on('end', () => resolve({ok:true,data,status:res.statusCode}));
    });
    req.on('error', err => resolve({ok:false,error:err.message}));
    req.on('timeout', () => { req.destroy(); resolve({ok:false,error:'timeout'}); });
    req.end();
  });
}

function parseMontants1er(html) {
  const rg = {};
  const rangs = [
    {k:'5+1',p:/5 bons N[^<]*Chance[\s\S]{0,300}?LotoMessage[^>]*>(Pas de gagnant|[\d\s]+,\d{2})&nbsp;&euro;/},
    {k:'5',  p:/5 bons N[°º](?!.*Chance)[\s\S]{0,300}?LotoMessage[^>]*>([\d\s]+,\d{2})&nbsp;&euro;/},
    {k:'4+1',p:/4 bons N[^<]*Chance[\s\S]{0,300}?LotoMessage[^>]*>([\d\s]+,\d{2})&nbsp;&euro;/},
    {k:'4',  p:/4 bons N[°º](?!.*Chance)[\s\S]{0,300}?LotoMessage[^>]*>([\d\s]+,\d{2})&nbsp;&euro;/},
    {k:'3+1',p:/3 bons N[^<]*Chance[\s\S]{0,300}?LotoMessage[^>]*>([\d\s]+,\d{2})&nbsp;&euro;/},
    {k:'3',  p:/3 bons N[°º](?!.*Chance)[\s\S]{0,300}?LotoMessage[^>]*>([\d\s]+,\d{2})&nbsp;&euro;/},
    {k:'2+1',p:/2 bons N[^<]*Chance[\s\S]{0,300}?LotoMessage[^>]*>([\d\s]+,\d{2})&nbsp;&euro;/},
    {k:'2',  p:/2 bons N[°º](?!.*Chance)[\s\S]{0,300}?LotoMessage[^>]*>([\d\s]+,\d{2})&nbsp;&euro;/},
    {k:'1+1',p:/(?:1 bon|0 ou 1)[^<]*Chance[\s\S]{0,300}?LotoMessage[^>]*>([\d\s]+,\d{2})&nbsp;&euro;/},
  ];
  for (const r of rangs) {
    const m = r.p.exec(html);
    rg[r.k] = (m&&m[1]&&m[1]!=='Pas de gagnant') ? parseFloat(m[1].replace(/\s/g,'').replace(',','.')) : 0;
  }
  return rg;
}

function parseMontants2nd(html) {
  const rg = {};
  const idx = html.indexOf('tabpanel-1');
  if (idx < 0) return rg;
  const bloc = html.substring(idx, idx+8000);
  const rangs = [
    {k:'5',p:/5 bons[\s\S]{0,300}?LotoMessage[^>]*>([\d\s]+,\d{2})&nbsp;&euro;/},
    {k:'4',p:/4 bons[\s\S]{0,300}?LotoMessage[^>]*>([\d\s]+,\d{2})&nbsp;&euro;/},
    {k:'3',p:/3 bons[\s\S]{0,300}?LotoMessage[^>]*>([\d\s]+,\d{2})&nbsp;&euro;/},
    {k:'2',p:/2 bons[\s\S]{0,300}?LotoMessage[^>]*>([\d\s]+,\d{2})&nbsp;&euro;/},
  ];
  for (const r of rangs) {
    const m = r.p.exec(bloc);
    rg[r.k] = (m&&m[1]) ? parseFloat(m[1].replace(/\s/g,'').replace(',','.')) : 0;
  }
  console.log('[SCRAPE] 2nd montants: 5='+rg['5']+'€ 4='+rg['4']+'€ 3='+rg['3']+'€ 2='+rg['2']+'€');
  return rg;
}

async function scraper() {
  console.log('[SCRAPE] Démarrage...');
  const main = await httpGet('www.secretsdujeu.com','/page/jeux_loto_resultats.html');
  if (!main.ok || main.status!==200) { lastError='Erreur page principale'; return null; }
  const html = main.data;

  let date = null;
  const dm = /"dateModified":"(\d{4}-\d{2}-\d{2})/.exec(html);
  if (dm) { date = dm[1]+'T20:50:00.000Z'; }
  else {
    const now=new Date(),day=now.getDay(),jours=[1,3,6];
    let db=0;
    for (let i=0;i<=7;i++) { if (jours.includes(((day-i)+7)%7)){db=i;break;} }
    const last=new Date(now); last.setDate(now.getDate()-db);
    if (db===0&&now.getHours()<21){for(let i=1;i<=7;i++){if(jours.includes(((day-i)+7)%7)){last.setDate(now.getDate()-i);break;}}}
    last.setHours(20,50,0,0); date=last.toISOString();
  }

  const m = /combinaison gagnante[^0-9]*(\d+)-(\d+)-(\d+)-(\d+)-(\d+)[^0-9]*num.ro Chance est le (\d+)/.exec(html);
  if (!m) { lastError='Numéros non trouvés'; return null; }
  const nums = [1,2,3,4,5].map(i=>parseInt(m[i]));
  const chance = parseInt(m[6]);
  console.log('[SCRAPE] 1er: '+nums.join(',')+'  Chance:'+chance);

  const urlM = /"url":"(https:\/\/www\.secretsdujeu\.com\/loto\/resultat\/tirage-loto-du-[^"]+)"/.exec(html);
  let rg1 = {'5+1':0,'5':100000,'4+1':1000,'4':500,'3+1':50,'3':20,'2+1':9,'2':4,'1+1':2.20};
  let rg2 = {}, nums2 = [];

  if (urlM) {
    const detail = await httpGet('www.secretsdujeu.com', urlM[1].replace('https://www.secretsdujeu.com',''));
    if (detail.ok && detail.status===200) {
      rg1 = parseMontants1er(detail.data);
      rg2 = parseMontants2nd(detail.data);
      const p2 = /class=["\']loto-numero second-tir["\'][^>]*>\s*(\d{1,2})\s*<\/p>/g;
      let mm;
      while ((mm=p2.exec(detail.data))!==null) nums2.push(parseInt(mm[1]));
      console.log('[SCRAPE] 2nd nums: '+nums2.join(','));
      console.log('[SCRAPE] 1er montants: 5='+rg1['5']+'€ 1+1='+rg1['1+1']+'€');
    }
  }

  tirageCache = {nums,chance,nums2,date,rapportGains:rg1,rapportGains2:rg2};
  cacheExpiry = prochainTirage();
  console.log('[SCRAPE] ✅ Cache→'+cacheExpiry);
  return tirageCache;
}

async function getTirage() {
  if (cacheValide()) { console.log('[CACHE] Hit'); return tirageCache; }
  return await scraper();
}

function dejàEnregistré(t) {
  return allTirages.some(x=>x.nums.join(',')===t.nums.join(',')&&x.date.split('T')[0]===t.date.split('T')[0]);
}

app.get('/api/loto-complet', async (req, res) => {
  try {
    const tirage = await getTirage();
    if (!tirage) return res.status(500).json({success:false,error:lastError});
    if (new Date(tirage.date)<DEBUT) {
      cagnotte=0;allTirages=[];PARTICIPANTS.forEach(p=>{distribution[p]={gains:0,solde:-180};});
      return res.json({success:true,tirage,cagnotte:'0.00',distribution,historique:[],timestamp:new Date().toISOString()});
    }
    if (!dejàEnregistré(tirage)) {
      const total = calculerGainsTirage(tirage);
      console.log('[LOG] Total: '+total+'€');
      cagnotte += total;
      if (cagnotte>=650) {
        const pp=650/13;
        PARTICIPANTS.forEach(p=>{distribution[p].gains+=pp;distribution[p].solde+=pp;});
        cagnotte-=650;
        console.log('[LOG] DISTRIBUTION!');
      }
      allTirages.push({nums:tirage.nums,chance:tirage.chance,nums2:tirage.nums2,gains:total,rapportGains:tirage.rapportGains,rapportGains2:tirage.rapportGains2,date:tirage.date});
      await sauvegarder();
    }
    res.json({success:true,tirage,cagnotte:cagnotte.toFixed(2),distribution,historique:allTirages.slice(-10),timestamp:new Date().toISOString()});
  } catch(e) { res.status(500).json({success:false,error:e.message}); }
});

app.get('/api/bilan', (req, res) => {
  const dist=Object.values(distribution).reduce((s,d)=>s+d.gains,0);
  const gt=dist+cagnotte;
  res.json({success:true,participants:PARTICIPANTS.map((n,i)=>({id:i+1,name:n,gains:distribution[n].gains.toFixed(2),solde:distribution[n].solde.toFixed(2)})),gainsTotal:gt.toFixed(2),soldeTotal:(gt-2340).toFixed(2),cagnotte:cagnotte.toFixed(2),tiragesEffectues:allTirages.length,timestamp:new Date().toISOString()});
});

app.get('/api/stats', (req, res) => {
  const dist=Object.values(distribution).reduce((s,d)=>s+d.gains,0);
  const gt=dist+cagnotte;
  res.json({success:true,tiragesEffectues:allTirages.length,gainsTotal:gt.toFixed(2),roi:gt>0?((gt/2340)*100).toFixed(1)+'%':'0.0%',cagnotte:cagnotte.toFixed(2),historique:allTirages.slice(-10),timestamp:new Date().toISOString()});
});

app.get('/api/test', (req, res) => {
  res.json({message:'OK',cache:{valide:cacheValide(),expire:cacheExpiry,tirage:tirageCache?tirageCache.nums:null},github:{token:!!GITHUB_TOKEN,sha:dataFileSha},timestamp:new Date().toISOString()});
});

app.get('/api/force-scrape', async (req, res) => {
  tirageCache=null; cacheExpiry=null;
  await chargerDonnees();
  const tirage = await scraper();
  if (!tirage) return res.json({success:false,error:lastError});
  res.json({success:true,tirage,message:'Rechargez Accueil pour recalculer.',timestamp:new Date().toISOString()});
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
  console.log('✅ Port '+PORT);
  await chargerDonnees();
});
