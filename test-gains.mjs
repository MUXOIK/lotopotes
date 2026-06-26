// Jeu d'essai — calculerGainsTirage — 10 combinaisons gagnantes FDJ Loto
// Copie autonome de la logique métier (supabase/functions/loto-scraper/index.ts)
// Exécuter : node test-gains.mjs

// ─── Constantes du jeu (identiques à l'app) ───────────────────────────────────
const GRILLES = [
  [7, 12, 23, 34, 45],  // grille 1 — chance 9
  [6, 15, 28, 39, 48],  // grille 2 — chance 6
  [3, 18, 31, 42, 49],  // grille 3 — chance 4
  [8, 19, 32, 41, 46],  // grille 4 — chance 1
  [5, 22, 29, 35, 44],  // grille 5 — chance 7
];
const CHANCES = [9, 6, 4, 1, 7];

// ─── Copie exacte de calculerGainsTirage (loto-scraper/index.ts:62-106) ───────
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
    if (n === 5 && c) g = rg["5+1"] || 0;
    else if (n === 5) g = rg["5"] || 0;
    else if (n === 4 && c) g = rg["4+1"] || 0;
    else if (n === 4) g = rg["4"] || 0;
    else if (n === 3 && c) g = rg["3+1"] || 0;
    else if (n === 3) g = rg["3"] || 0;
    else if (n === 2 && c) g = rg["2+1"] || 0;
    else if (n === 2) g = rg["2"] || 0;
    else if (n <= 1 && c) g = rg["1+1"] || 0;
    const isWinning1 =
      (n === 5 && c) || n === 5 || (n === 4 && c) || n === 4 ||
      (n === 3 && c) || n === 3 || (n === 2 && c) || n === 2 || (n <= 1 && c);
    if (isWinning1) {
      total += g;
      gainsDetails.push({ grille: i + 1, tirage: "1er", gain: g });
    }
    if (a2) {
      const n2 = t.nums2.filter((x) => GRILLES[i].includes(x)).length;
      let g2 = 0;
      if (n2 === 5) g2 = rg2["5"] || 0;
      else if (n2 === 4) g2 = rg2["4"] || 0;
      else if (n2 === 3) g2 = rg2["3"] || 0;
      else if (n2 === 2) g2 = rg2["2"] || 0;
      const isWinning2 = n2 === 5 || n2 === 4 || n2 === 3 || n2 === 2;
      if (isWinning2) {
        total += g2;
        gainsDetails.push({ grille: i + 1, tirage: "2nd", gain: g2 });
      }
    }
  }
  return { total, gainsDetails };
}

// ─── Montants de référence (valeurs FDJ typiques) ─────────────────────────────
const RG = {
  "5+1": 2_000_000,
  "5":       100_000,
  "4+1":       1_000,
  "4":           400,
  "3+1":          50,
  "3":            15,
  "2+1":           6,
  "2":           4.4,
  "1+1":         2.2,
};

// ─── Constructeur de tirage fictif ────────────────────────────────────────────
// Tous les tirages ciblent la GRILLE 1 = [7,12,23,34,45], CHANCE 9.
// Les nums en dehors de cette grille utilisent des valeurs hors grille (ex: 99)
// pour éviter tout faux positif sur les autres grilles.
function makeTirage(nums, chance) {
  return { nums, chance, nums2: [], rapportGains: RG, rapportGains2: {} };
}

// ─── Cas de test ─────────────────────────────────────────────────────────────
const CAS = [
  {
    rang: "5+1",
    desc: "5 numéros + numéro Chance",
    tirage: makeTirage([7, 12, 23, 34, 45], 9),
    cleAttendue: "5+1",
    gainAttendu: RG["5+1"],
  },
  {
    rang: "5",
    desc: "5 numéros (sans Chance)",
    tirage: makeTirage([7, 12, 23, 34, 45], 99),
    cleAttendue: "5",
    gainAttendu: RG["5"],
  },
  {
    rang: "4+1",
    desc: "4 numéros + numéro Chance",
    tirage: makeTirage([7, 12, 23, 34, 99], 9),
    cleAttendue: "4+1",
    gainAttendu: RG["4+1"],
  },
  {
    rang: "4",
    desc: "4 numéros (sans Chance)",
    tirage: makeTirage([7, 12, 23, 34, 99], 99),
    cleAttendue: "4",
    gainAttendu: RG["4"],
  },
  {
    rang: "3+1",
    desc: "3 numéros + numéro Chance",
    tirage: makeTirage([7, 12, 23, 99, 98], 9),
    cleAttendue: "3+1",
    gainAttendu: RG["3+1"],
  },
  {
    rang: "3",
    desc: "3 numéros (sans Chance)",
    tirage: makeTirage([7, 12, 23, 99, 98], 99),
    cleAttendue: "3",
    gainAttendu: RG["3"],
  },
  {
    rang: "2+1",
    desc: "2 numéros + numéro Chance",
    tirage: makeTirage([7, 12, 99, 98, 97], 9),
    cleAttendue: "2+1",
    gainAttendu: RG["2+1"],
  },
  {
    rang: "2",
    desc: "2 numéros (sans Chance)",
    tirage: makeTirage([7, 12, 99, 98, 97], 99),
    cleAttendue: "2",
    gainAttendu: RG["2"],
  },
  {
    rang: "1+1",
    desc: "1 numéro + numéro Chance",
    tirage: makeTirage([7, 99, 98, 97, 96], 9),
    cleAttendue: "1+1",
    gainAttendu: RG["1+1"],
  },
  {
    rang: "0+1",
    desc: "0 numéro + numéro Chance  ⚠️  même branche code que 1+1 (n<=1 && c)",
    tirage: makeTirage([99, 98, 97, 96, 95], 9),
    cleAttendue: "1+1",  // clé utilisée par le code pour les deux cas
    gainAttendu: RG["1+1"],
  },
];

// ─── Exécution des tests ──────────────────────────────────────────────────────
console.log("=".repeat(72));
console.log("  TEST — calculerGainsTirage — 10 rangs gagnants FDJ Loto");
console.log("  Grille testée : [7,12,23,34,45]  Chance : 9  (grille 1)");
console.log("=".repeat(72));

let passed = 0;
let failed = 0;

for (const cas of CAS) {
  const { total, gainsDetails } = calculerGainsTirage(cas.tirage);

  // Vérification : une seule entrée dans gainsDetails, grille 1, gain attendu
  const detail = gainsDetails.find((d) => d.grille === 1 && d.tirage === "1er");
  const gainObtenu = detail ? detail.gain : 0;
  const nbGagnants = gainsDetails.length;

  const ok =
    gainObtenu === cas.gainAttendu &&
    total === cas.gainAttendu &&
    nbGagnants === 1;

  const statut = ok ? "PASS" : "FAIL";
  if (ok) passed++; else failed++;

  console.log();
  console.log(`  [${statut}] ${cas.rang.padEnd(4)} — ${cas.desc}`);
  console.log(`         nums  : ${JSON.stringify(cas.tirage.nums)}  chance : ${cas.tirage.chance}`);
  console.log(`         gain  : attendu=${cas.gainAttendu} €   obtenu=${gainObtenu} €   total=${total} €`);
  console.log(`         gainsDetails (${nbGagnants} entrée(s)) : ${JSON.stringify(gainsDetails)}`);
  if (!ok) {
    if (gainObtenu !== cas.gainAttendu) {
      console.log(`         => ERREUR gain : attendu ${cas.gainAttendu}, obtenu ${gainObtenu}`);
    }
    if (nbGagnants !== 1) {
      console.log(`         => ERREUR nb de grilles gagnantes : attendu 1, obtenu ${nbGagnants}`);
    }
  }
}

console.log();
console.log("=".repeat(72));
console.log(`  Résultat : ${passed} PASS  /  ${failed} FAIL  (sur ${CAS.length} tests)`);

if (failed === 0) {
  console.log("  Tous les rangs sont correctement calculés.");
} else {
  console.log("  Des rangs ont retourné une valeur inattendue — voir détails ci-dessus.");
}

const noteOuverture = CAS.find((c) => c.rang === "0+1");
console.log();
console.log("  NOTE 0+1 :");
console.log("  Le rang '0 numéro + Chance' n'a pas de clé dédiée dans rapportGains.");
console.log("  La condition du code est (n <= 1 && c), ce qui couvre n=0 ET n=1.");
console.log("  Les deux cas utilisent la clé '1+1' et retournent le même gain (2,20 €).");
console.log("  Cela est cohérent avec les règles FDJ où '0+1' = tirage 2nd chance");
console.log("  et '1+1' = 2,20 € fixe, tous deux gérés sous la même clé.");
console.log("=".repeat(72));
