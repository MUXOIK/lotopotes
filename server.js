const express = require('express');
const cors = require('cors');
const https = require('https');

const app = express();
app.use(cors());

// Stockage en mémoire du dernier tirage
let lastResult = null;
let lastFetch = null;

// Fonction pour récupérer et parser les résultats FDJ
function fetchLotoResults() {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'www.fdj.fr',
      path: '/jeux-de-tirage/loto/resultats',
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; loto-monitor/1.0)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'fr-FR,fr;q=0.9',
        'Cache-Control': 'no-cache'
      },
      timeout: 15000
    };

    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          console.log('📥 HTML reçu, parsing en cours...');
          
          // Stratégie 1 : Chercher les balises div avec les numéros
          // FDJ utilise des divs avec classes spécifiques pour afficher les numéros
          // Chercher le pattern: <div>3</div><div>4</div><div>15</div><div>17</div><div>41</div>
          
          // Netttoyer le HTML et chercher les numéros
          const cleanedHtml = data.replace(/\s+/g, ' ');
          
          // Regex pour trouver 5 nombres consécutifs entre 1 et 49
          const numberSequenceRegex = /<[^>]*>(\d{1,2})<\/[^>]*>\s*<[^>]*>(\d{1,2})<\/[^>]*>\s*<[^>]*>(\d{1,2})<\/[^>]*>\s*<[^>]*>(\d{1,2})<\/[^>]*>\s*<[^>]*>(\d{1,2})<\/[^>]*>/;
          
          const numbersMatch = cleanedHtml.match(numberSequenceRegex);
          
          if (numbersMatch) {
            const nums = [
              parseInt(numbersMatch[1]),
              parseInt(numbersMatch[2]),
              parseInt(numbersMatch[3]),
              parseInt(numbersMatch[4]),
              parseInt(numbersMatch[5])
            ];
            
            console.log('✅ Numéros trouvés:', nums);
            
            // Chercher le numéro chance (généralement après une image "chance")
            // Le numéro chance est entre 1 et 10
            const chanceRegex = /chance[\s\S]{0,200}>(\d{1,2})<\/[^>]*>/i;
            const chanceMatch = cleanedHtml.match(chanceRegex);
            
            let chance = null;
            if (chanceMatch) {
              chance = parseInt(chanceMatch[1]);
              if (chance > 10) chance = null; // Invalide si > 10
            }
            
            if (chance !== null) {
              console.log('✅ Numéro chance trouvé:', chance);
              
              const result = {
                date: new Date().toISOString(),
                nums: nums,
                chance: chance
              };
              
              resolve(result);
            } else {
              console.log('⚠️ Numéro chance non trouvé');
              resolve(null);
            }
          } else {
            console.log('⚠️ Numéros non trouvés avec la première stratégie');
            
            // Stratégie 2 : Chercher directement dans le texte "3 4 15 17 41"
            // Extrait le texte brut
            const textContent = data.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ');
            
            // Cherche le pattern dans le texte
            const textRegex = /(\d{1,2})\s+(\d{1,2})\s+(\d{1,2})\s+(\d{1,2})\s+(\d{1,2})/;
            const textMatch = textContent.match(textRegex);
            
            if (textMatch) {
              const nums = [
                parseInt(textMatch[1]),
                parseInt(textMatch[2]),
                parseInt(textMatch[3]),
                parseInt(textMatch[4]),
                parseInt(textMatch[5])
              ];
              
              console.log('✅ Numéros trouvés en texte brut:', nums);
              
              // Chercher le chance en texte brut aussi
              const chanceTextRegex = /Chance[:\s]+(\d{1,2})/i;
              const chanceTextMatch = textContent.match(chanceTextRegex);
              
              let chance = null;
              if (chanceTextMatch) {
                chance = parseInt(chanceTextMatch[1]);
              }
              
              if (chance !== null && chance <= 10) {
                const result = {
                  date: new Date().toISOString(),
                  nums: nums,
                  chance: chance
                };
                resolve(result);
              } else {
                console.log('⚠️ Chance non trouvé ou invalide');
                resolve(null);
              }
            } else {
              console.log('❌ Impossible de parser les résultats');
              resolve(null);
            }
          }
        } catch (error) {
          console.error('❌ Erreur parsing:', error.message);
          reject(error);
        }
      });
    });

    req.on('error', (error) => {
      console.error('❌ Erreur réseau:', error.message);
      reject(error);
    });
    
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Timeout FDJ'));
    });

    req.end();
  });
}

// Endpoint pour récupérer les résultats
app.get('/api/loto-results', async (req, res) => {
  try {
    console.log('🔍 Requête reçue pour les résultats Loto...');
    lastFetch = new Date();
    
    const result = await fetchLotoResults();
    
    if (result) {
      console.log('✅ Résultat récupéré et validé:', result);
      lastResult = result;
      res.json({
        success: true,
        data: result,
        timestamp: new Date().toISOString()
      });
    } else {
      console.log('⚠️ Aucun résultat trouvé (FDJ peut ne pas avoir publié encore)');
      res.json({
        success: false,
        message: 'Aucun résultat trouvé. Le tirage a peut-être lieu plus tard.',
        data: lastResult,
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    console.error('❌ Erreur globale:', error.message);
    res.status(500).json({
      success: false,
      error: error.message,
      data: lastResult,
      timestamp: new Date().toISOString()
    });
  }
});

// Test endpoint
app.get('/api/test', (req, res) => {
  res.json({ 
    message: 'Backend fonctionne!',
    lastResult: lastResult,
    lastFetch: lastFetch,
    timestamp: new Date().toISOString()
  });
});

// Healthcheck
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Backend démarré sur le port ${PORT}`);
  console.log(`🔗 Test: http://localhost:${PORT}/api/test`);
  console.log(`🔗 Résultats: http://localhost:${PORT}/api/loto-results`);
  console.log(`🔗 Health: http://localhost:${PORT}/health`);
});
