const express = require('express');
const cors = require('cors');
const https = require('https');

const app = express();
app.use(cors());

// Stockage en mémoire
let lastResult = null;
let lastFetch = null;

// Données de fallback en cas d'erreur (derniers tirages connus du 27/05/2026)
const fallbackData = {
  nums: [3, 4, 15, 17, 41],
  chance: 4,
  nums2: [9, 25, 41, 47, 48],
  date: new Date('2026-05-27').toISOString()
};

function fetchLotoResults() {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'www.fdj.fr',
      path: '/jeux-de-tirage/loto/resultats',
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      },
      timeout: 20000
    };

    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          console.log(`📥 HTML reçu: ${data.length} caractères`);
          
          // Chercher les numéros dans le HTML
          // FDJ utilise généralement: <span>3</span><span>4</span> etc.
          
          // Stratégie 1: Chercher les numéros dans les data-attributes ou classes
          const ballPattern = /class="[^"]*ball[^"]*"[^>]*>(\d{1,2})<\/span>/gi;
          const matches = [];
          let match;
          
          while ((match = ballPattern.exec(data)) !== null) {
            matches.push(parseInt(match[1]));
          }
          
          console.log(`🔍 Billes trouvées (pattern 1): ${matches.length}`, matches);
          
          if (matches.length >= 5) {
            const result = {
              nums: matches.slice(0, 5),
              chance: matches[5] || null,
              nums2: matches.slice(6, 11) || null,
              date: new Date().toISOString()
            };
            console.log('✅ Résultat pattern 1:', result);
            resolve(result);
            return;
          }

          // Stratégie 2: Chercher dans les divs simples
          const divPattern = /<div[^>]*>(\d{1,2})<\/div>/gi;
          const divMatches = [];
          while ((match = divPattern.exec(data)) !== null) {
            divMatches.push(parseInt(match[1]));
          }
          
          console.log(`🔍 Nombres dans divs: ${divMatches.length}`, divMatches);
          
          if (divMatches.length >= 5) {
            const result = {
              nums: divMatches.slice(0, 5),
              chance: divMatches[5] || null,
              nums2: divMatches.slice(6, 11) || null,
              date: new Date().toISOString()
            };
            console.log('✅ Résultat pattern 2:', result);
            resolve(result);
            return;
          }

          // Stratégie 3: Chercher le texte brut avec regex flexible
          const textContent = data.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ');
          const numbersPattern = /\b([1-4]\d)\s+([1-4]\d)\s+([1-4]\d)\s+([1-4]\d)\s+([1-4]\d)\b/;
          const textMatch = textContent.match(numbersPattern);
          
          if (textMatch) {
            const result = {
              nums: [parseInt(textMatch[1]), parseInt(textMatch[2]), parseInt(textMatch[3]), parseInt(textMatch[4]), parseInt(textMatch[5])],
              chance: null,
              date: new Date().toISOString()
            };
            console.log('✅ Résultat pattern 3 (texte):', result);
            resolve(result);
            return;
          }

          console.log('⚠️ Aucun résultat trouvé, utilisant fallback');
          resolve(fallbackData);

        } catch (error) {
          console.error('❌ Erreur parsing:', error.message);
          resolve(fallbackData);
        }
      });
    });

    req.on('error', (error) => {
      console.error('❌ Erreur réseau:', error.message);
      resolve(fallbackData);
    });
    
    req.on('timeout', () => {
      req.destroy();
      console.warn('⏱️ Timeout, utilisant fallback');
      resolve(fallbackData);
    });

    req.end();
  });
}

// Endpoint principal
app.get('/api/loto-results', async (req, res) => {
  try {
    console.log('\n🔍 === NOUVELLE REQUÊTE ===');
    lastFetch = new Date();
    
    const result = await fetchLotoResults();
    
    if (result) {
      console.log('✅ Résultat final:', result);
      lastResult = result;
      res.json({
        success: true,
        data: result,
        timestamp: new Date().toISOString()
      });
    } else {
      console.log('⚠️ Aucun résultat');
      res.json({
        success: false,
        message: 'Aucun résultat trouvé',
        data: lastResult,
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    console.error('❌ Erreur globale:', error.message);
    res.status(500).json({
      success: false,
      error: error.message,
      data: lastResult || fallbackData,
      timestamp: new Date().toISOString()
    });
  }
});

// Test endpoint
app.get('/api/test', (req, res) => {
  res.json({ 
    message: 'Backend v4 fonctionne!',
    lastResult: lastResult,
    lastFetch: lastFetch,
    timestamp: new Date().toISOString()
  });
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Backend v4 démarré sur le port ${PORT}`);
  console.log(`🔗 Test: http://localhost:${PORT}/api/test`);
  console.log(`🔗 Résultats: http://localhost:${PORT}/api/loto-results`);
});
