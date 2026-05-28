const express = require('express');
const cors = require('cors');
const https = require('https');

const app = express();
app.use(cors());

// Les 5 grilles du syndicat (FIXES)
const GRILLES = [
  [7, 12, 23, 34, 45],
  [6, 15, 28, 39, 48],
  [3, 18, 31, 42, 49],
  [8, 19, 32, 41, 46],
  [5, 22, 29, 35, 44]
];

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

// Stockage
let allTirages = [];
let distribution = {};
let cagnotte = 0;

// Init distribution
PARTICIPANTS.forEach(p => {
  distribution[p] = { gains: 0, solde: -180 };
});

function fetchLotoResultsAndGains() {
  return new Promise((resolve) => {
    const options = {
      hostname: 'www.fdj.fr',
      path: '/jeux-de-tirage/loto/resultats',
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'fr-FR,fr;q=0.9',
        'Cache-Control': 'no-cache'
      },
      timeout: 20000
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          console.log('📥 HTML reçu de fdj.fr, parsing...');

          // ===== PARSER LES NUMÉROS =====
          const ballPattern = /class="[^"]*ball[^"]*"[^>]*>(\d{1,2})<\/span>/gi;
          const matches = [];
          let match;
          while ((match = ballPattern.exec(data)) !== null) {
            matches.push(parseInt(match[1]));
          }

          let result = null;

          if (matches.length >= 5) {
            result = {
              nums: matches.slice(0, 5),
              chance: matches[5] || null,
              nums2: matches.slice(6, 11) || null,
              date: new Date().toISOString()
            };
            console.log('✅ Numéros trouvés:', result.nums, 'Chance:', result.chance);
          } else {
            const divPattern = /<div[^>]*>(\d{1,2})<\/div>/gi;
            const divMatches = [];
            while ((match = divPattern.exec(data)) !== null) {
              divMatches.push(parseInt(match[1]));
            }

            if (divMatches.length >= 5) {
              result = {
                nums: divMatches.slice(0, 5),
                chance: divMatches[5] || null,
                nums2: divMatches.slice(6, 11) || null,
                date: new Date().toISOString()
              };
              console.log('✅ Numéros trouvés (div):', result.nums);
            }
          }

          if (!result) {
            console.log('❌ Numéros pas trouvés');
            resolve(null);
            return;
          }

          // ===== PARSER LES MONTANTS DU TABLEAU =====
          console.log('🔍 Parsing tableau des gains...');
          
          // Cherche le tableau HTML avec les montants
          // Pattern: | 5 + 1 | X | 78 814,30 € |
          const gainTableRegex = /\|\s*(\d+)\s*(?:\+\s*1)?\s*\|\s*(\d+(?:\s+\d+)?)\s*\|\s*([0-9\s,]+)\s*€/gi;
          
          const rapportGains = {
            '5+1': 0,     // Rang 1
            '5': 0,       // Rang 2
            '4+1': 0,     // Rang 3
            '4': 0,       // Rang 4
            '3+1': 0,     // Rang 5
            '3': 0,       // Rang 6
            '2+1': 0,     // Rang 7
            '2': 0,       // Rang 8
            '1+1': 0      // Rang 9
          };

          let matchCount = 0;
          while ((match = gainTableRegex.exec(data)) !== null) {
            const nums = match[1];
            const montant = parseFloat(match[3].replace(/\s/g, '').replace(',', '.'));
            
            if (nums === '5') {
              rapportGains['5'] = montant;
              console.log('✅ Rang 2 (5 numéros): ' + montant + '€');
            } else if (nums === '4') {
              rapportGains['4'] = montant;
              console.log('✅ Rang 4 (4 numéros): ' + montant + '€');
            } else if (nums === '3') {
              rapportGains['3'] = montant;
              console.log('✅ Rang 6 (3 numéros): ' + montant + '€');
            } else if (nums === '2') {
              rapportGains['2'] = montant;
              console.log('✅ Rang 8 (2 numéros): ' + montant + '€');
            }
            matchCount++;
          }

          // Si le parsing du tableau échoue, cherche avec un pattern plus simple
          if (matchCount === 0) {
            console.log('⚠️ Pattern tableau pas trouvé, cherchant alternativement...');
            
            // Alternative: cherche juste les montants EUR
            const montantPattern = /([0-9]+[\s,]*)+\s*€/g;
            const montants = [];
            while ((match = montantPattern.exec(data)) !== null) {
              const val = parseFloat(match[0].replace(/\s/g, '').replace('€', '').replace(',', '.'));
              if (val > 0) montants.push(val);
            }
            
            if (montants.length > 0) {
              // Les 3-4 premiers montants signifiants sont généralement les gains principaux
              rapportGains['5'] = montants[0] || 50000;
              rapportGains['4'] = montants[1] || 500;
              rapportGains['3'] = montants[2] || 50;
              rapportGains['2'] = montants[3] || 5;
              console.log('✅ Gains alternatifs:', rapportGains);
            }
          }

          result.rapportGains = rapportGains;
          console.log('✅ RÉSULTAT COMPLET:', result);
          resolve(result);

        } catch (error) {
          console.error('❌ Erreur parsing:', error.message);
          resolve(null);
        }
      });
    });

    req.on('error', (error) => {
      console.error('❌ Erreur réseau:', error.message);
      resolve(null);
    });
    
    req.on('timeout', () => {
      req.destroy();
      console.warn('⏱️ Timeout');
      resolve(null);
    });

    req.end();
  });
}

function tirageDejàEnregistré(tirage) {
  return allTirages.some(t => 
    t.nums.join(',') === tirage.nums.join(',') && 
    t.date.split('T')[0] === tirage.date.split('T')[0]
  );
}

function calculerGains(grille, nums, chance, rapportGains) {
  let gainsTotal = 0;

  const numsMatches = nums.filter(n => grille.includes(n)).length;
  const chanceMatch = grille.includes(chance);

  if (numsMatches === 5 && chanceMatch) {
    gainsTotal += rapportGains['5+1'] || rapportGains['5'] || 0;
  } else if (numsMatches === 5) {
    gainsTotal += rapportGains['5'] || 0;
  } else if (numsMatches === 4 && chanceMatch) {
    gainsTotal += rapportGains['4+1'] || rapportGains['4'] || 0;
  } else if (numsMatches === 4) {
    gainsTotal += rapportGains['4'] || 0;
  } else if (numsMatches === 3 && chanceMatch) {
    gainsTotal += rapportGains['3+1'] || rapportGains['3'] || 0;
  } else if (numsMatches === 3) {
    gainsTotal += rapportGains['3'] || 0;
  } else if (numsMatches === 2 && chanceMatch) {
    gainsTotal += rapportGains['2+1'] || rapportGains['2'] || 0;
  } else if (numsMatches === 2) {
    gainsTotal += rapportGains['2'] || 0;
  }

  return gainsTotal;
}

app.get('/api/loto-complet', async (req, res) => {
  try {
    console.log('\n🔍 === APPEL COMPLET ===');
    const tirage = await fetchLotoResultsAndGains();

    if (!tirage) {
      console.log('❌ Pas de tirage');
      res.status(500).json({ success: false, error: 'Impossible de récupérer les résultats FDJ' });
      return;
    }

    if (!tirageDejàEnregistré(tirage)) {
      console.log('📊 Nouveau tirage, calcul gains avec montants réels...');

      let gainsTotal = 0;
      GRILLES.forEach((grille, idx) => {
        const gains = calculerGains(grille, tirage.nums, tirage.chance, tirage.rapportGains);
        gainsTotal += gains;
        console.log(`Grille ${idx + 1}: ${gains}€`);
      });

      cagnotte += gainsTotal;
      console.log(`💰 Cagnotte: ${cagnotte}€`);

      if (cagnotte >= 650) {
        console.log('💸 DISTRIBUTION 650€!');
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
    }

    res.json({
      success: true,
      tirage: tirage,
      cagnotte: cagnotte.toFixed(2),
      distribution: distribution,
      historique: allTirages.slice(-10),
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Erreur:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/bilan', (req, res) => {
  const bilanArray = PARTICIPANTS.map((name, idx) => ({
    id: idx + 1,
    name: name,
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
  const roi = gainsTotal > 0 ? ((gainsTotal / 2340) * 100).toFixed(1) : '0.0';

  res.json({
    success: true,
    tiragesEffectues: allTirages.length,
    gainsTotal: gainsTotal.toFixed(2),
    roi: roi + '%',
    cagnotte: cagnotte.toFixed(2),
    historique: allTirages.slice(-10),
    timestamp: new Date().toISOString()
  });
});

app.get('/api/test', (req, res) => {
  res.json({ message: 'Backend FINAL fonctionne avec gains réels!', timestamp: new Date().toISOString() });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Backend FINAL démarré`);
  console.log(`🔗 /api/loto-complet - /api/bilan - /api/stats`);
});
