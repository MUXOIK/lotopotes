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

// Compare deux tableaux de numéros indépendamment de l'ordre
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
  let incoherent = false;

  GRILLES.forEach((g,i) => {
    const n = t.nums.filter(x=>g.includes(x)).length, c = CHANCES[i]===t.chance;
    let g1 = 0;
    if (n===5&&c) g1=rg['5+1']||0; else if (n===5) g1=rg['5']||0;
    else if (n===4&&c) g1=rg['4+1']||0; else if (n===4) g1=rg['4']||0;
    else if (n===3&&c) g1=rg['3+1']||0; else if (n===3) g1=rg['3']||0;
    else if (n===2&&c) g1=rg['2+1']||0; else if (n===2) g1=rg['2']||0;
    else if (c) g1=rg['1+1']||0;
    let g2 = 0;
    if (t.nums2 && t.nums2.length === 5) {
      const n2 = t.nums2.filter(x=>g.includes(x)).length;
      if (a2) {
        if (n2===5) g2=rg2['5']||0; else if (n2===4) g2=rg2['4']||0;
        else if (n2===3) g2=rg2['3']||0; else if (n2===2) g2=rg2['2']||0;
      }
      // ALERTE: si 2+ numéros matchent au 2nd tirage mais rapportGains2 est vide/incomplet
      if (n2 >= 2 && !a2) {
        incoherent = true;
        console.log('[ALERTE] Grille '+(i+1)+' a '+n2+' numéros au 2nd tirage du '+t.date.split('T')[0]+' mais rapportGains2 est vide — gain potentiellement non comptabilisé !');
      }
    }
    total += g1 + g2;
  });

  return { total, incoherent };
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

        // Si rapportGains2 est entièrement à 0 et que nums2 existe, retenter le scraping
        const rg2vide = Object.values(allTirages[i].rapportGains2).length === 0
          || Object.values(allTirages[i].rapportGains2).every(v => v === 0);
        if (rg2vide && allTirages[i].nums2 && allTirages[i].nums2.length === 5) {
          const retry = await rescraperDate(allTirages[i].date);
          if (retry) {
            if (retry.rapportGains2) { allTirages[i].rapportGains2 = retry.rapportGains2; needSave = true; }
            if (retry.rapportGains) { allTirages[i].rapportGains = retry.rapportGains; needSave = true; }
          }
        }

        const { total: bonGain, incoherent } = calculerGainsTirage(allTirages[i]);
        allTirages[i].dataIncomplete = incoherent;
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

// ===== PARSING GÉNÉRALISTE : gère <tr><td> classique ET structures <div> =====

// Étape 1 : essayer d'extraire les lignes en format <tr><td> classique
function extraireLignesTableau(html) {
  const trRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  const lignes = [];
  let tr;
  while ((tr = trRegex.exec(html)) !== null) {
    const tdRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
    const cellules = [];
    let td;
    while ((td = tdRegex.exec(tr[1])) !== null) {
      const texte = td[1]
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&euro;/g, '€')
        .replace(/\s+/g, ' ')
        .trim();
      cellules.push(texte);
    }
    if (cellules.length > 0) lignes.push(cellules);
  }
  return lignes;
}

// Étape 2 : fallback généraliste pour structures <div> ou mixtes
// Découpe le HTML autour de chaque occurrence de "X bons", puis extrait les cellules
function extraireLignesGenerique(html) {
  const bonRegex = /(\d)\s*(?:bons?|bon)\b/i;
  const celluleRegex = /<\/(?:td|div|span|li|p)>/gi;
  
  // Trouver tous les segments qui commencent par "X bons"
  const segments = [];
  const bonMatches = [...html.matchAll(/(\d)\s*(?:bons?|bon)\b[^<]*(?:<[^>]+>[^<]*)*(?:<\/(?:td|div|span|li|p)>)?/gi)];
  
  for (const match of bonMatches) {
    const segment = match[0];
    const bonsNum = parseInt(match[1]);
    
    // Chercher si le segment contient "Chance"
    const avecChance = /chance/i.test(segment);
    
    // Extraire le montant : chercher un pattern "XX,XX€" ou "/" ou "Pas de gagnant"
    let montant = null;
    
    // Chercher un montant en euros
    const montantMatch = /([\d\s]+,\d{1,2})\s*€/.exec(segment);
    if (montantMatch) {
      montant = parseFloat(montantMatch[1].replace(/\s/g, '').replace(',', '.'));
    } else if (/\/|pas de gagnant/i.test(segment)) {
      montant = 0;
    }
    
    segments.push({ bons: bonsNum, avecChance, montant });
  }
  
  return segments;
}

function parseMontantCellule(texte) {
  if (texte === '/' || /pas de gagnant/i.test(texte)) return 0;
  const m = /([\d\s]+,\d{1,2})/.exec(texte);
  return m ? parseFloat(m[1].replace(/\s/g,'').replace(',','.')) : null;
}

// Analyse structurelle commune : combine <tr><td> classique + fallback généraliste
function analyserLignesGains(html) {
  // Étape 1 : essayer le parsing classique <tr><td>
  let lignes = extraireLignesTableau(html);
  
  // Étape 2 : si aucune ligne trouvée, utiliser le fallback généraliste
  if (lignes.length === 0) {
    console.log('[SCRAPE] ⚠️ Aucune ligne <tr><td> trouvée, essai du fallback généraliste...');
    const resultatGenerique = extraireLignesGenerique(html);
    return resultatGenerique;
  }
  
  // Parsing standard pour <tr><td>
  const analysees = lignes.map(cellules => {
    const labelCell = cellules.find(c => /\d\s*(?:bons?|bon)\b/i.test(c));
    if (!labelCell) return null;
    const bonsMatch = /(\d)\s*(?:bons?|bon)\b/i.exec(labelCell);
    const bons = parseInt(bonsMatch[1]);
    const avecChance = /chance/i.test(labelCell);
    let montantCell = null;
    for (let i = cellules.length - 1; i >= 0; i--) {
      if (/€/.test(cellules[i]) || cellules[i] === '/' || /pas de gagnant/i.test(cellules[i])) {
        montantCell = cellules[i];
        break;
      }
    }
    const montant = montantCell !== null ? parseMontantCellule(montantCell) : null;
    return { bons, avecChance, montant };
  }).filter(Boolean);
  
  return analysees;
}

// Parse le rapport de gains du 1er tirage (9 rangs: 5+1,5,4+1,4,3+1,3,2+1,2,1+1)
function parseMontants1er(html) {
  const analysees = analyserLignesGains(html);
  const rg = {};
  const ordreAttendu = ['5+1','5','4+1','4','3+1','3','2+1','2','1+1'];

  let dernierIdxAvecChance = -1;
  analysees.forEach((l, i) => { if (l.avecChance) dernierIdxAvecChance = i; });

  const premierBloc = analysees.slice(0, dernierIdxAvecChance + 1);
  premierBloc.forEach((l, i) => {
    if (i < ordreAttendu.length) {
      rg[ordreAttendu[i]] = l.montant !== null ? l.montant : 0;
    }
  });
  for (const k of ordreAttendu) if (rg[k] === undefined) rg[k] = 0;
  console.log('[SCRAPE] 1er montants: 5='+rg['5']+'€ 1+1='+rg['1+1']+'€');
  return rg;
}

// Parse le rapport de gains du 2nd tirage (4 rangs: 5,4,3,2 bons)
// Avec DEBUG : afficher le contenu analysé avant de retourner
function parseMontants2nd(html) {
  const analysees = analyserLignesGains(html);

  let dernierIdxAvecChance = -1;
  analysees.forEach((l, i) => { if (l.avecChance) dernierIdxAvecChance = i; });

  const rg = {};
  analysees.forEach((l, i) => {
    if (!l.avecChance && i > dernierIdxAvecChance && [2,3,4,5].includes(l.bons)) {
      if (rg[String(l.bons)] === undefined) rg[String(l.bons)] = l.montant !== null ? l.montant : 0;
    }
  });
  for (const k of ['5','4','3','2']) if (rg[k] === undefined) rg[k] = 0;

  // ===== DEBUG : afficher exactement ce qui a été analysé =====
  console.log('[DEBUG] Analyse lignes 2nd tirage:', JSON.stringify(analysees, null, 2));
  console.log('[SCRAPE] 2nd montants: 5='+rg['5']+'€ 4='+rg['4']+'€ 3='+rg['3']+'€ 2='+rg['2']+'€');

  if (Object.values(rg).every(v => v === 0)) {
    console.log('[SCRAPE] ⚠️ rapportGains2 entièrement à 0 — vérifier la structure du tableau (lignes analysées: '+analysees.length+')');
  }

  return rg;
}

// Re-scraper la page de détail pour une date donnée (utilisé par la migration)
const JOURS_FR = ['dimanche','lundi','mardi','mercredi','jeudi','vendredi','samedi'];
const MOIS_FR = ['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];

async function rescraperDate(dateISO) {
  const d = new Date(dateISO);
  const jour = JOURS_FR[d.getUTCDay()];
  const num = d.getUTCDate();
  const mois = MOIS_FR[d.getUTCMonth()];
  const annee = d.getUTCFullYear();
  const path = `/loto/resultat/tirage-loto-du-${jour}-${num}-${mois}-${annee}`;
  console.log('[MIGRATION] Tentative rescraping: ' + path);
  const detail = await httpGet('www.secretsdujeu.com', path);
  if (!detail.ok || detail.status !== 200) {
    console.log('[MIGRATION] ❌ Page introuvable: ' + path + ' (status ' + detail.status + ')');
    return null;
  }
  const rg1 = parseMontants1er(detail.data);
  const rg2 = parseMontants2nd(detail.data);
  const result = {};
  if (Object.values(rg1).some(v => v > 0)) {
    result.rapportGains = rg1;
    console.log('[MIGRATION] ✅ rapportGains récupéré pour ' + dateISO.split('T')[0]);
  }
  if (Object.values(rg2).some(v => v > 0)) {
    result.rapportGains2 = rg2;
    console.log('[MIGRATION] ✅ rapportGains2 récupéré pour ' + dateISO.split('T')[0]);
  }
  if (Object.keys(result).length === 0) {
    console.log('[MIGRATION] ❌ Toujours rien après rescraping pour ' + dateISO.split('T')[0]);
    return null;
  }
  return result;
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

  tirageCache = {nums, chance, nums2, date, rapportGains: rg1, rapportGains2: rg2};

  // Réhydrater depuis allTirages si le tirage existe déjà en base (source de vérité)
  const dateStr = date.split('T')[0];
  const existant = allTirages.find(t =>
    t.date.split('T')[0] === dateStr &&
    sameNums(t.nums, nums) &&
    sameNums(t.nums2, nums2)
  );
  if (existant) {
    if (existant.rapportGains) tirageCache.rapportGains = existant.rapportGains;
    if (existant.rapportGains2) tirageCache.rapportGains2 = existant.rapportGains2;
    if (existant.nums2?.length) tirageCache.nums2 = existant.nums2;
    console.log('[SCRAPE] Réhydraté depuis data.json');
  }

  cacheExpiry = prochainTirage();
  console.log('[SCRAPE] ✅ Cache→'+cacheExpiry);
  return tirageCache;
}

async function getTirage() {
  if (cacheValide()) { console.log('[CACHE] Hit'); return tirageCache; }
  return await scraper();
}

function dejàEnregistré(t) {
  return allTirages.some(x =>
    x.date.split('T')[0] === t.date.split('T')[0] &&
    sameNums(x.nums, t.nums) &&
    sameNums(x.nums2, t.nums2)
  );
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
      const { total, incoherent } = calculerGainsTirage(tirage);
      console.log('[LOG] Total: '+total+'€' + (incoherent ? ' ⚠️ INCOMPLET' : ''));
      cagnotte += total;
      if (cagnotte>=650) {
        const pp=650/13;
        PARTICIPANTS.forEach(p=>{distribution[p].gains+=pp;distribution[p].solde+=pp;});
        cagnotte-=650;
        console.log('[LOG] DISTRIBUTION!');
      }
      allTirages.push({nums:tirage.nums,chance:tirage.chance,nums2:tirage.nums2,gains:total,rapportGains:tirage.rapportGains,rapportGains2:tirage.rapportGains2,dataIncomplete:incoherent,date:tirage.date});
      await sauvegarder();
    }
    // Indiquer si le tirage courant a des données incomplètes (calculé à la volée pour le cache)
    const checkActuel = calculerGainsTirage(tirage);
    res.json({success:true,tirage,tirageDataIncomplete:checkActuel.incoherent,cagnotte:cagnotte.toFixed(2),distribution,historique:allTirages.slice(-10),timestamp:new Date().toISOString()});
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
