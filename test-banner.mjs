// Jeu d'essai — bandeau "ON A GAGNÉ !" — 3 scénarios
// Copie autonome de la logique métier (supabase/functions/loto-scraper/index.ts)
// Exécuter : node test-banner.mjs

// ─── Données fixes du jeu ────────────────────────────────────────────────────
const GRILLES = [
  [7, 12, 23, 34, 45],  // grille 1 — chance 9
  [6, 15, 28, 39, 48],  // grille 2 — chance 6
  [3, 18, 31, 42, 49],  // grille 3 — chance 4
  [8, 19, 32, 41, 46],  // grille 4 — chance 1
  [5, 22, 29, 35, 44],  // grille 5 — chance 7
];
const CHANCES = [9, 6, 4, 1, 7];

// Montants FDJ de référence
const RG = {
  "5+1": 2_000_000, "5": 100_000,
  "4+1": 1_000,     "4": 400,
  "3+1": 50,        "3": 15,
  "2+1": 6,         "2": 4.4,
  "1+1": 2.2,
};
const RG2 = { "5": 100_000, "4": 400, "3": 15, "2": 4.4 };

// ─── Copie exacte de calculerGainsTirage (loto-scraper/index.ts:62-106) ──────
function calculerGainsTirage(t) {
  const rg = t.rapportGains || {};
  const rg2 = t.rapportGains2 || {};
  const a2 = t.nums2 && t.nums2.length === 5;
  let total = 0;
  const gainsDetails = [];
  for (let i = 0; i < GRILLES.length; i++) {
    const n = t.nums.filter((x) => GRILLES[i].includes(x)).length;
    const c = CHANCES[i] === t.chance;
    let g = 0;
    if      (n === 5 && c) g = rg["5+1"] || 0;
    else if (n === 5)      g = rg["5"]   || 0;
    else if (n === 4 && c) g = rg["4+1"] || 0;
    else if (n === 4)      g = rg["4"]   || 0;
    else if (n === 3 && c) g = rg["3+1"] || 0;
    else if (n === 3)      g = rg["3"]   || 0;
    else if (n === 2 && c) g = rg["2+1"] || 0;
    else if (n === 2)      g = rg["2"]   || 0;
    else if (n <= 1 && c)  g = rg["1+1"] || 0;
    const isWinning1 =
      (n === 5 && c) || n === 5 || (n === 4 && c) || n === 4 ||
      (n === 3 && c) || n === 3 || (n === 2 && c) || n === 2 || (n <= 1 && c);
    if (isWinning1) { total += g; gainsDetails.push({ grille: i + 1, tirage: "1er", gain: g }); }
    if (a2) {
      const n2 = t.nums2.filter((x) => GRILLES[i].includes(x)).length;
      let g2 = 0;
      if      (n2 === 5) g2 = rg2["5"] || 0;
      else if (n2 === 4) g2 = rg2["4"] || 0;
      else if (n2 === 3) g2 = rg2["3"] || 0;
      else if (n2 === 2) g2 = rg2["2"] || 0;
      const isWinning2 = n2 === 5 || n2 === 4 || n2 === 3 || n2 === 2;
      if (isWinning2) { total += g2; gainsDetails.push({ grille: i + 1, tirage: "2nd", gain: g2 }); }
    }
  }
  return { total, gainsDetails };
}

// ─── Logique showGain (SectionAccueil.tsx:38-40) ──────────────────────────────
function showGain(tirage) {
  return (tirage.gainTotal ?? 0) > 0 &&
    tirage.date &&
    new Date(tirage.date) >= new Date("2026-06-01");
}

// ─── Construction des tirages de test ─────────────────────────────────────────
// Rappel : les 5 numéros tirés sont communs à toutes les grilles.
// Il est physiquement impossible d'avoir p.ex. grille 1 → 4 matchs
// ET grille 2 → 3 matchs simultanément (cela nécessiterait 7 numéros distincts).
// Les scénarios ci-dessous sont les combinaisons les plus riches réalisables.

const DATE_TEST = "2026-06-26T20:50:00.000Z";

// --- CAS 1 — 3 grilles gagnantes sur le 1er tirage uniquement ----------------
// nums=[7,6,3,12,15], chance=4
//   Grille 1 [7,12,23,34,45] : 2 matchs (7,12), chance(9)≠4 → rang "2"   = 4,40 €
//   Grille 2 [6,15,28,39,48] : 2 matchs (6,15), chance(6)≠4 → rang "2"   = 4,40 €
//   Grille 3 [3,18,31,42,49] : 1 match  (3),    chance(4)=4 → rang "1+1" = 2,20 €
//   Total : 11,00 €
const tirage1 = {
  nums: [7, 6, 3, 12, 15],
  chance: 4,
  nums2: [],
  date: DATE_TEST,
  rapportGains: RG,
  rapportGains2: {},
};
const res1 = calculerGainsTirage(tirage1);
tirage1.gainTotal = res1.total;
tirage1.gainsDetails = res1.gainsDetails;

// --- CAS 2 — Gains répartis sur 1er ET 2nd tirage du même jour ---------------
// 1er tirage : nums=[7,12,23,6,15], chance=9
//   Grille 1 [7,12,23,34,45] : 3 matchs (7,12,23), chance(9)=9 → rang "3+1" = 50,00 €
//   Grille 2 [6,15,28,39,48] : 2 matchs (6,15),    chance(6)≠9 → rang "2"   =  4,40 €
// 2nd tirage : nums2=[3,18,8,19,32]
//   Grille 3 [3,18,31,42,49] : 2 matchs (3,18)   → rang "2"  =  4,40 €
//   Grille 4 [8,19,32,41,46] : 3 matchs (8,19,32) → rang "3" = 15,00 €
//   Total : 73,80 €
const tirage2 = {
  nums: [7, 12, 23, 6, 15],
  chance: 9,
  nums2: [3, 18, 8, 19, 32],
  date: DATE_TEST,
  rapportGains: RG,
  rapportGains2: RG2,
};
const res2 = calculerGainsTirage(tirage2);
tirage2.gainTotal = res2.total;
tirage2.gainsDetails = res2.gainsDetails;

// --- CAS 3 — Aucune grille gagnante (bandeau absent) -------------------------
// nums=[1,2,10,11,13], chance=2 — aucun numéro dans aucune grille, chance hors CHANCES
const tirage3 = {
  nums: [1, 2, 10, 11, 13],
  chance: 2,
  nums2: [],
  date: DATE_TEST,
  rapportGains: RG,
  rapportGains2: {},
};
const res3 = calculerGainsTirage(tirage3);
tirage3.gainTotal = res3.total;
tirage3.gainsDetails = res3.gainsDetails;

// ─── Affichage console ────────────────────────────────────────────────────────
function afficherCas(num, titre, tirage) {
  const show = showGain(tirage);
  console.log();
  console.log("─".repeat(68));
  console.log(`  CAS ${num} — ${titre}`);
  console.log("─".repeat(68));
  console.log(`  nums    : ${JSON.stringify(tirage.nums)}  chance : ${tirage.chance}`);
  if (tirage.nums2.length > 0) {
    console.log(`  nums2   : ${JSON.stringify(tirage.nums2)}`);
  }
  console.log();
  console.log(`  showGain         : ${show ? "OUI → bandeau visible" : "NON → bandeau masqué"}`);
  console.log(`  gainTotal        : ${tirage.gainTotal.toFixed(2)} €`);
  console.log(`  gainsDetails (${tirage.gainsDetails.length} entrée(s)) :`);
  if (tirage.gainsDetails.length === 0) {
    console.log("    (aucune grille gagnante)");
  } else {
    for (const d of tirage.gainsDetails) {
      console.log(`    Grille ${d.grille} (${d.tirage}) → ${d.gain.toFixed(2)} €`);
    }
  }
  console.log();
  // Simulation du rendu du bandeau
  if (show) {
    console.log('  [RENDU BANDEAU]');
    console.log('  ┌──────────────────────────────────────────┐');
    console.log('  │  🎉🏆🎉                                   │');
    console.log('  │  ON A GAGNÉ !                            │');
    const detail = tirage.gainsDetails
      .map((d) => `Grille ${d.grille} (${d.tirage}) → ${d.gain.toFixed(2)}€`)
      .join(' | ');
    console.log(`  │  ${detail}`);
    console.log(`  │  Total : ${tirage.gainTotal.toFixed(2)}€ 🎰`);
    console.log('  └──────────────────────────────────────────┘');
  } else {
    console.log('  [RENDU BANDEAU]');
    console.log('  (bandeau "ON A GAGNÉ !" non affiché — gainTotal = 0)');
  }
}

console.log("=".repeat(68));
console.log("  TEST — Bandeau 'ON A GAGNÉ !' — 3 scénarios");
console.log("  Logique SectionAccueil.tsx:38-57");
console.log("=".repeat(68));

afficherCas(1, "3 grilles gagnantes — 1er tirage uniquement", tirage1);
afficherCas(2, "Gains sur 1er ET 2nd tirage du même jour", tirage2);
afficherCas(3, "Aucune grille gagnante — bandeau absent", tirage3);

// ─── Vérifications PASS/FAIL ──────────────────────────────────────────────────
console.log();
console.log("=".repeat(68));
console.log("  ASSERTIONS");
console.log("=".repeat(68));

function assert(label, condition) {
  console.log(`  [${condition ? "PASS" : "FAIL"}] ${label}`);
  return condition;
}

let allOk = true;
allOk &= assert("Cas 1 : showGain = true",           showGain(tirage1) === true);
allOk &= assert("Cas 1 : 3 grilles gagnantes",       tirage1.gainsDetails.length === 3);
allOk &= assert("Cas 1 : total = 11.00 €",           tirage1.gainTotal === 11);
allOk &= assert("Cas 1 : grille 1 rang '2'",         tirage1.gainsDetails[0].gain === 4.4);
allOk &= assert("Cas 1 : grille 2 rang '2'",         tirage1.gainsDetails[1].gain === 4.4);
allOk &= assert("Cas 1 : grille 3 rang '1+1'",       tirage1.gainsDetails[2].gain === 2.2);

allOk &= assert("Cas 2 : showGain = true",           showGain(tirage2) === true);
allOk &= assert("Cas 2 : 4 entrées gainsDetails",    tirage2.gainsDetails.length === 4);
allOk &= assert("Cas 2 : total = 73.80 €",           tirage2.gainTotal === 73.8);
allOk &= assert("Cas 2 : grille 1 '3+1' (1er)",      tirage2.gainsDetails[0].gain === 50 && tirage2.gainsDetails[0].tirage === "1er");
allOk &= assert("Cas 2 : grille 2 '2' (1er)",        tirage2.gainsDetails[1].gain === 4.4 && tirage2.gainsDetails[1].tirage === "1er");
allOk &= assert("Cas 2 : grille 3 '2' (2nd)",        tirage2.gainsDetails[2].gain === 4.4 && tirage2.gainsDetails[2].tirage === "2nd");
allOk &= assert("Cas 2 : grille 4 '3' (2nd)",        tirage2.gainsDetails[3].gain === 15  && tirage2.gainsDetails[3].tirage === "2nd");

allOk &= assert("Cas 3 : showGain = false",          showGain(tirage3) === false);
allOk &= assert("Cas 3 : 0 grille gagnante",         tirage3.gainsDetails.length === 0);
allOk &= assert("Cas 3 : total = 0 €",               tirage3.gainTotal === 0);

console.log();
console.log(`  ${allOk ? "Toutes les assertions passent." : "Des assertions ont échoué — voir ci-dessus."}`);
console.log();
console.log("  Pour la visualisation UI : ouvrir http://localhost:5173/test-banner.html");
console.log("=".repeat(68));
