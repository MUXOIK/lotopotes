// Jeu d'essai — flux paiement admin (3 cas)
// Logique identique à SectionAdmin.tsx:202 et SectionPaiements.tsx
// Exécuter : node test-paiements.mjs

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
  'WEITZMANN Dalia & Jacques',
];
const NB_PARTICIPANTS = 13;

// ─── Copie exacte du calcul SectionAdmin.tsx:202 ─────────────────────────────
function calculerMontantParPersonne(montantTotal) {
  return parseFloat((montantTotal / NB_PARTICIPANTS).toFixed(2));
}

// ─── Simulation insert_paiement (crée les virements pour chaque membre) ───────
function simulerPaiement({ montant, note, datePaiement, dateVirement }) {
  const montant_par_personne = calculerMontantParPersonne(montant);
  const totalDistribue = montant_par_personne * NB_PARTICIPANTS;
  const centimeNonDistribue = parseFloat((montant - totalDistribue).toFixed(4));
  const virements = PARTICIPANTS.map((nom) => ({
    participant_nom: nom,
    effectue: true,
    date_virement: dateVirement,
    gain: montant_par_personne,
  }));
  return {
    montant,
    montant_par_personne,
    note,
    created_at: datePaiement + 'T00:00:00.000Z',
    virements,
    totalDistribue,
    centimeNonDistribue,
    virementsEffectues: NB_PARTICIPANTS,
  };
}

// ─── Formatage date FR ────────────────────────────────────────────────────────
function dateFR(iso) {
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });
}

console.log('='.repeat(70));
console.log('  TEST — Flux paiement administrateur — 3 cas');
console.log('  Logique SectionAdmin.tsx + SectionPaiements.tsx');
console.log('='.repeat(70));

// ─── CAS 1 — 650.00€ ÷ 13 = 50.00€ exactement ───────────────────────────────
console.log('\n' + '─'.repeat(70));
console.log('  CAS 1 — Saisie admin : 650.00€ ÷ 13 membres');
console.log('─'.repeat(70));
const p1 = simulerPaiement({
  montant: 650,
  note: 'Gains tirage du 03/06/2026',
  datePaiement: '2026-06-03',
  dateVirement: '2026-06-20',
});
console.log(`  montant_par_personne  : ${p1.montant_par_personne.toFixed(2)}€`);
console.log(`  total distribué       : ${p1.totalDistribue.toFixed(2)}€`);
console.log(`  centime non distribué : ${p1.centimeNonDistribue}€`);
console.log(`  virements créés       : ${p1.virementsEffectues}/${NB_PARTICIPANTS}`);
console.log(`  date virement         : ${p1.virements[0].date_virement}`);
console.log();
console.log('  [Suivi des virements — tous les membres passent au statut "payé"]');
p1.virements.forEach((v, i) =>
  console.log(`    ${String(i + 1).padStart(2)}. ${v.participant_nom.padEnd(40)} ✅ ${v.date_virement}  +${v.gain.toFixed(2)}€`)
);

// ─── CAS 2 — 100.00€ ÷ 13 = arrondi ─────────────────────────────────────────
console.log('\n' + '─'.repeat(70));
console.log('  CAS 2 — Test arrondi : 100.00€ ÷ 13 membres');
console.log('─'.repeat(70));
const p2 = simulerPaiement({
  montant: 100,
  note: 'Gains tirage du 10/06/2026',
  datePaiement: '2026-06-10',
  dateVirement: '2026-06-20',
});
const raw = 100 / NB_PARTICIPANTS;
console.log(`  calcul brut           : 100 / 13 = ${raw.toFixed(10)}…`);
console.log(`  toFixed(2)            : "${raw.toFixed(2)}"  (3ème décimale = ${Math.floor(raw * 1000) % 10} → arrondi vers le bas)`);
console.log(`  parseFloat            : ${p2.montant_par_personne.toFixed(2)}€`);
console.log(`  total distribué       : ${p2.montant_par_personne.toFixed(2)}€ × 13 = ${p2.totalDistribue.toFixed(2)}€`);
console.log(`  centime non distribué : +${p2.centimeNonDistribue.toFixed(4)}€ (absorbé, non attribué)`);
console.log(`  virements créés       : ${p2.virementsEffectues}/${NB_PARTICIPANTS}`);
console.log();
console.log('  [Suivi des virements]');
p2.virements.forEach((v, i) =>
  console.log(`    ${String(i + 1).padStart(2)}. ${v.participant_nom.padEnd(40)} ✅ ${v.date_virement}  +${v.gain.toFixed(2)}€`)
);

// ─── CAS 3 — Cumul des deux virements sur la page Paiements ──────────────────
console.log('\n' + '─'.repeat(70));
console.log('  CAS 3 — Page Paiements : cumul des 2 virements le 20/06/2026');
console.log('─'.repeat(70));
console.log(`  Paiement 1 : ${p1.montant.toFixed(2)}€ total | ${p1.montant_par_personne.toFixed(2)}€/pers. | ${dateFR(p1.created_at)} | ${p1.virementsEffectues}/${NB_PARTICIPANTS} virements`);
console.log(`  Paiement 2 : ${p2.montant.toFixed(2)}€ total | ${p2.montant_par_personne.toFixed(2)}€/pers. | ${dateFR(p2.created_at)} | ${p2.virementsEffectues}/${NB_PARTICIPANTS} virements`);
console.log(`  Total distribué (les 2) : ${(p1.montant + p2.montant).toFixed(2)}€`);
console.log();
console.log('  [Détail par membre — les 2 virements]');
PARTICIPANTS.forEach((nom, i) => {
  const total = p1.montant_par_personne + p2.montant_par_personne;
  console.log(
    `    ${String(i + 1).padStart(2)}. ${nom.padEnd(40)} ` +
    `V1: ${p1.montant_par_personne.toFixed(2)}€ (${p1.virements[0].date_virement}) + ` +
    `V2: ${p2.montant_par_personne.toFixed(2)}€ (${p2.virements[0].date_virement}) = ` +
    `${total.toFixed(2)}€`
  );
});

// ─── Assertions ───────────────────────────────────────────────────────────────
console.log('\n' + '='.repeat(70));
console.log('  ASSERTIONS');
console.log('='.repeat(70));

let ok = true;
function assert(label, cond) {
  console.log(`  [${cond ? 'PASS' : 'FAIL'}] ${label}`);
  if (!cond) ok = false;
  return cond;
}

// Cas 1
assert('Cas 1 : 650 ÷ 13 = 50.00€/pers.',         p1.montant_par_personne === 50);
assert('Cas 1 : total distribué = 650.00€',         p1.totalDistribue === 650);
assert('Cas 1 : centime non distribué = 0€',         p1.centimeNonDistribue === 0);
assert('Cas 1 : 13 virements effectués',             p1.virementsEffectues === 13);
assert('Cas 1 : date virement = 2026-06-20',         p1.virements[0].date_virement === '2026-06-20');
assert('Cas 1 : tous les membres ont 50.00€',        p1.virements.every(v => v.gain === 50));

// Cas 2
assert('Cas 2 : 100 ÷ 13 = 7.69€/pers.',            p2.montant_par_personne === 7.69);
assert('Cas 2 : total distribué = 99.97€',           p2.totalDistribue === 99.97);
assert('Cas 2 : centime non distribué = 0.03€',      Math.abs(p2.centimeNonDistribue - 0.03) < 0.0001);
assert('Cas 2 : 13 virements effectués',             p2.virementsEffectues === 13);
assert('Cas 2 : tous les membres ont 7.69€',         p2.virements.every(v => v.gain === 7.69));

// Cas 3
const totalParMembre = p1.montant_par_personne + p2.montant_par_personne;
assert('Cas 3 : total par membre = 57.69€',          totalParMembre === 57.69);
assert('Cas 3 : total global distribué = 749.97€',   (p1.totalDistribue + p2.totalDistribue) === 749.97);

console.log();
console.log(`  ${ok ? 'Toutes les assertions passent.' : 'Des assertions ont échoué.'}`);
console.log();
console.log('  Pour la visualisation UI : ouvrir http://localhost:5173/test-paiements.html');
console.log('='.repeat(70));
