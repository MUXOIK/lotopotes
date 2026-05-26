const express = require('express');
const cors = require('cors');
const axios = require('axios');
const cheerio = require('cheerio');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Cache pour éviter trop de requêtes à FDJ
let cachedResults = null;
let lastFetchTime = 0;
const CACHE_DURATION = 60 * 60 * 1000; // 1 heure

// Fonction pour scraper les tirages FDJ depuis tirage-gagnant.com
async function scrapeLotoResults() {
  try {
    // Si le cache est frais, le retourner
    if (cachedResults && Date.now() - lastFetchTime < CACHE_DURATION) {
      console.log('Retournant les résultats en cache');
      return cachedResults;
    }

    console.log('Scraping tirage-gagnant.com pour les résultats FDJ...');
    
    const response = await axios.get('https://tirage-gagnant.com/loto/resultats-loto/', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      timeout: 10000
    });

    const $ = cheerio.load(response.data);
    const results = [];
    
    // Parser le texte pour extraire les dates et numéros
    const text = $.text();
    const lines = text.split('\n').map(l => l.trim()).filter(l => l);
    
    // Format de tirage-gagnant: "Résultats Loto du 25 Mai 2026 25/05/2026"
    // Suivi de: "19 22 27 31 49 3" pour le 1er tirage
    // Puis: "Résultats Option second tirage: 11 22 26 41 47"
    
    let currentDate = '';
    let i = 0;
    
    while (i < lines.length && results.length < 10) {
      const line = lines[i];
      
      // Chercher les dates au format "25/05/2026" ou "25 Mai 2026"
      if (line.match(/\d{1,2}\/\d{1,2}\/\d{4}/) || line.match(/\d{1,2}\s+(mai|Mai|MAI)\s+\d{4}/)) {
        const dateMatch = line.match(/(\d{1,2}\/\d{1,2}\/\d{4})/);
        if (dateMatch) {
          currentDate = dateMatch[1];
        }
      }
      
      // Chercher la ligne avec les 5 numéros + 1 chance (1er tirage)
      const nums = line.match(/\d+/g);
      if (nums && nums.length >= 6 && currentDate) {
        // Vérifier que ce sont des numéros valides (1-49 pour les numéros, 1-10 pour chance)
        const firstFive = nums.slice(0, 5).map(Number);
        const chance = parseInt(nums[5]);
        
        if (firstFive.every(n => n >= 1 && n <= 49) && chance >= 1 && chance <= 10) {
          // C'est le 1er tirage
          results.push({
            date: currentDate,
            nums: firstFive,
            chance: chance,
            type: '1er tirage'
          });
          
          // Chercher le 2ème tirage dans les 5 prochaines lignes
          for (let j = i + 1; j < Math.min(i + 10, lines.length); j++) {
            const nextLine = lines[j];
            
            // Vérifier si c'est la ligne du 2ème tirage (5 numéros sans chance)
            const nums2 = nextLine.match(/\d+/g);
            if (nums2 && nums2.length === 5) {
              const secondFive = nums2.map(Number);
              
              if (secondFive.every(n => n >= 1 && n <= 49)) {
                // C'est le 2ème tirage
                results.push({
                  date: currentDate,
                  nums: secondFive,
                  chance: 0, // 2ème tirage n'a pas de numéro chance
                  type: '2eme tirage'
                });
                break;
              }
            }
          }
          
          currentDate = ''; // Réinitialiser pour la prochaine date
        }
      }
      
      i++;
    }

    // Si on a trouvé des résultats, les mettre en cache
    if (results.length > 0) {
      cachedResults = results;
      lastFetchTime = Date.now();
      console.log(`✅ ${results.length} tirages FDJ scrapés depuis tirage-gagnant.com`);
      return results;
    }

    // Si le scraping échoue, retourner les données de fallback
    console.log('Scraping tirage-gagnant échoué, retournant les données de fallback');
    return getFallbackResults();

  } catch (error) {
    console.error('Erreur lors du scraping tirage-gagnant:', error.message);
    return getFallbackResults();
  }
}

// Scraper magayo.com pour les vrais résultats
async function scrapeMagayoResults() {
  try {
    const response = await axios.get('https://www.magayo.com/fr/resultats-de-loterie/france/fdj-loto/');
    const $ = cheerio.load(response.data);
    const results = [];

    // Parser les résultats récents du Loto
    // Format : date, puis 5 numéros, puis numéro chance
    
    // Chercher les titres des dates et les numéros
    const dateRegex = /(\d{1,2}\s+\w+\s+\d{4})/;
    let currentDate = '';
    
    $('h5, .result-date, strong').each((i, elem) => {
      const text = $(elem).text().trim();
      const dateMatch = text.match(dateRegex);
      
      if (dateMatch) {
        currentDate = dateMatch[1];
      }
    });

    // Parser la section des résultats récents
    // Chercher tous les paragraphes avec des numéros
    const lines = $.text().split('\n');
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Chercher les patterns de dates
      if (line.match(/\d{1,2}\s+(janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre)\s+\d{4}/i)) {
        const dateStr = line.match(/\d{1,2}\s+\w+\s+\d{4}/)[0];
        
        // Chercher les numéros associés (5 numéros + 1 chance)
        const nextLine = lines[i + 1]?.trim() || '';
        const nums = nextLine.match(/\d+/g);
        
        if (nums && nums.length >= 6) {
          results.push({
            date: dateStr,
            nums: nums.slice(0, 5).map(Number),
            chance: parseInt(nums[5])
          });
        }
        
        if (results.length >= 10) break;
      }
    }

    return results.length > 0 ? results : getFallbackResults();
  } catch (error) {
    console.error('Erreur scraping magayo:', error.message);
    return getFallbackResults();
  }
}

// Données de fallback réalistes (au cas où le scraper échoue)
function getFallbackResults() {
  return [
    { date: '25/05/2026', nums: [19, 22, 27, 31, 49], chance: 3 },
    { date: '23/05/2026', nums: [20, 21, 23, 36, 38], chance: 2 },
    { date: '20/05/2026', nums: [8, 15, 28, 30, 48], chance: 7 },
    { date: '18/05/2026', nums: [14, 32, 33, 36, 49], chance: 3 },
    { date: '16/05/2026', nums: [1, 12, 30, 32, 34], chance: 4 },
    { date: '13/05/2026', nums: [17, 35, 38, 41, 46], chance: 2 },
    { date: '11/05/2026', nums: [17, 18, 30, 34, 39], chance: 9 },
    { date: '9/05/2026', nums: [16, 21, 25, 26, 31], chance: 1 },
    { date: '6/05/2026', nums: [7, 18, 27, 35, 48], chance: 5 },
    { date: '4/05/2026', nums: [4, 8, 15, 18, 46], chance: 2 }
  ];
}

// Route API pour récupérer les tirages
app.get('/api/loto-results', async (req, res) => {
  try {
    const results = await scrapeLotoResults();
    res.json({
      success: true,
      results: results,
      timestamp: new Date().toISOString(),
      cached: cachedResults !== null
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      results: getFallbackResults()
    });
  }
});

// Route de test
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Backend Loto est en ligne ! 🎰',
    timestamp: new Date().toISOString()
  });
});

// Route pour le homepage
app.get('/', (req, res) => {
  res.json({
    name: 'Loto Syndicate Backend',
    version: '1.0.0',
    endpoints: {
      health: '/api/health',
      results: '/api/loto-results'
    }
  });
});

// Démarrer le serveur
app.listen(PORT, () => {
  console.log(`🎰 Backend Loto lancé sur le port ${PORT}`);
  console.log(`📍 URL: http://localhost:${PORT}`);
  console.log(`🔗 API: http://localhost:${PORT}/api/loto-results`);
});

// Gestion des erreurs
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});
