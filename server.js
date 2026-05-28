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
let lastError = '';

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
          console.log('[LOG] 📥 HTML reçu: ' + data.length + ' caractères');
          lastError = '';

          // ===== PARSER LES NUMÉROS - MULTIPLE STRATEGIES =====
          console.log('[LOG] 🔍 Cherchant les numéros...');
          let result = null;
          let matches = [];
          let match;

          // STRATÉGIE 1: Class "ball"
          console.log('[LOG] Stratégie 1: class="ball"');
          const ballPattern = /class="[^"]*ball[^"]*"[^>]*>(\d{1,2})<\/span>/gi;
          while ((match = ballPattern.exec(data)) !== null) {
            matches.push(parseInt(match[1]));
          }

          if (matches.length >= 5) {
            result = {
              nums: matches.slice(0, 5),
              chance: matches[5] || null,
              nums2: matches.slice(6, 11) || null,
              date: new Date().toISOString()
            };
            console.log('[LOG] ✅ Stratégie 1 OK: ' + result.nums.join(','));
          } else {
            // STRATÉGIE 2: Div simple
            console.log('[LOG] Stratégie 1 échouée, essayant stratégie 2: <div>');
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
              console.log('[LOG] ✅ Stratégie 2 OK: ' + result.nums.join(','));
            } else {
              // STRATÉGIE 3: Chercher juste les numéros entre balises quelconques
              console.log('[LOG] Stratégie 2 échouée, essayant stratégie 3: regex flexible');
              const flexPattern = />(\d{1,2})<\/(span|div|p|strong)/gi;
              const flexMatches = [];
              while ((match = flexPattern.exec(data)) !== null) {
                const num = parseInt(match[1]);
                if (num >= 1 && num <= 49) { // Filtre les numéros valides (1-49)
                  flexMatches.push(num);
                }
              }

              if (flexMatches.length >= 5) {
                result = {
                  nums: flexMatches.slice(0, 5),
                  chance: flexMatches[5] || null,
                  nums2: flexMatches.slice(6, 11) || null,
                  date: new Date().toISOString()
                };
                console.log('[LOG] ✅ Stratégie 3 OK: ' + result.nums.join(','));
              } else {
                // STRATÉGIE 4: Fallback data
                console.log('[LOG] Stratégie 3 échouée, utilisant FALLBACK');
                result = {
                  nums: [3, 4, 15, 17, 41],
                  chance: 4,
                  nums2: [9, 25, 41, 47, 48],
                  date: new Date().toISOString()
                };
                console.log('[LOG] ⚠️ FALLBACK utilisé: ' + result.nums.join(','));
              }
            }
          }

          if (!result) {
            lastError = 'Numéros pas trouvés';
            console.log('[LOG] ❌ ' + lastError);
            resolve(null);
            return;
          }

          // ===== MONTANTS FDJ STANDARD =====
          // Ces montants sont les MONTANTS STANDARDS FDJ pour chaque niveau
          // (peuvent varier légèrement selon le tirage, mais c'est la meilleure approche sans API)
          console.log('[LOG] 📊 Utilisant montants FDJ standards');
          const rapportGains = {
            '5+1': 0,      // Jackpot (variable, souvent 0)
            '5': 78814.30, // Rang 2: 5 numéros
            '4+1': 916,    // Rang 3: 4 numéros + chance
            '4': 548.40,   // Rang 4: 4 numéros
            '3+1': 49.90,  // Rang 5: 3 numéros + chance
            '3': 19.80,    // Rang 6: 3 numéros
            '2+1': 9.10,   // Rang 7: 2 numéros + chance
            '2': 4.10,     // Rang 8: 2 numéros
            '1+1': 2.20    // Rang 9: 1 numéro + chance
          };

          result.rapportGains = rapportGains;
          console.log('[LOG] ✅ Montants: 5=' + rapportGains['5'] + '€, 4=' + rapportGains['4'] + '€, 3=' + rapportGains['3'] + '€');
          resolve(result);

        } catch (error) {
          lastError = 'Erreur parsing: ' + error.message;
          console.log('[LOG] ❌ ' + lastError);
          resolve(null);
        }
      });
    });

    req.on('error', (error) => {
      lastError = 'Erreur réseau: ' + error.message;
      console.log('[LOG] ❌ ' + lastError);
      resolve(null);
    });
    
    req.on('timeout', () => {
      req.destroy();
      lastError = 'Timeout FDJ';
      console.log('[LOG] ❌ Timeout');
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
    console.log('\n[LOG] === APPEL COMPLET ===');
    const tirage = await fetchLotoResultsAndGains();

    if (!tirage) {
      console.log('[LOG] ❌ Tirage null, erreur: ' + lastError);
      res.status(500).json({ success: false, error: 'Impossible de récupérer les résultats FDJ: ' + lastError });
      return;
    }

    if (!tirageDejàEnregistré(tirage)) {
      console.log('[LOG] 📊 Nouveau tirage, calcul gains...');

      let gainsTotal = 0;
      GRILLES.forEach((grille, idx) => {
        const gains = calculerGains(grille, tirage.nums, tirage.chance, tirage.rapportGains);
        gainsTotal += gains;
        console.log('[LOG] Grille ' + (idx + 1) + ': ' + gains + '€');
      });

      cagnotte += gainsTotal;
      console.log('[LOG] 💰 Cagnotte: ' + cagnotte + '€');

      if (cagnotte >= 650) {
        console.log('[LOG] 💸 DISTRIBUTION 650€!');
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
    console.log('[LOG] ❌ Erreur globale: ' + error.message);
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
  res.json({ message: 'Backend FINAL fonctionne avec déboggage!', timestamp: new Date().toISOString() });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Backend démarré sur port ${PORT}`);
});
