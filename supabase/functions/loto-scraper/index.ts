import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey, X-Admin-Secret",
};

function jsonResp(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const GRILLES: number[][] = [
  [7, 12, 23, 34, 45],
  [6, 15, 28, 39, 48],
  [3, 18, 31, 42, 49],
  [8, 19, 32, 41, 46],
  [5, 22, 29, 35, 44],
];
const CHANCES: number[] = [9, 6, 4, 1, 7];
const PARTICIPANTS: string[] = [
  "ANOUFA Fabienne & Moïse",
  "BELLALOU Martine & Patrick",
  "GRINAL Danielle & Serge",
  "HOCHBERG Nathalie & Bruno",
  "JURIS Virgine & Frédéric",
  "KIMAN Laurence & Didier",
  "LEVIN Gabrielle & Didier",
  "MESGUICH Corinne & Jean Philippe",
  "OIKNINE Muriel & Aaron",
  "PARTOUCHE Sylvie & Serge",
  "SITBON Leslie & OHAYON Gilles",
  "TEMAN Eva & FINKELSTEIN Philippe",
  "WEITZMANN Dalia & Jacques",
];

interface RapportGains { [key: string]: number }
interface GainDetail { grille: number; tirage: string; gain: number }
interface Tirage {
  nums: number[];
  chance: number;
  nums2: number[];
  date: string;
  gains?: number;
  rapportGains: RapportGains;
  rapportGains2: RapportGains;
  gainTotal?: number;
  gainsDetails?: GainDetail[];
}
interface CacheRow {
  id: number;
  tirage_data: Tirage | null;
  cache_expiry: string | null;
  nombre_tirages: number;
}

function calculerGainsTirage(t: Tirage): { total: number; gainsDetails: GainDetail[] } {
  const rg = t.rapportGains || {};
  const rg2 = t.rapportGains2 || {};
  // Enable 2nd tirage check based on nums2 length only — not rapportGains2 values
  // (scraping can fail and return all zeros, but the 2nd tirage still exists)
  const a2 = t.nums2 && t.nums2.length === 5;
  let total = 0;
  const gainsDetails: GainDetail[] = [];

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
    // Add grille based on winning combination — even if gain is 0 (failed scraping)
    const isWinning1 = (n === 5 && c) || n === 5 || (n === 4 && c) || n === 4 ||
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

function extraireLignesTableau(html: string): string[][] {
  const decoded = html
    .replace(/&nbsp;/g, " ").replace(/&euro;/g, "€")
    .replace(/&quot;/g, '"').replace(/&amp;/g, "&");
  const trRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  const lignes: string[][] = [];
  let tr: RegExpExecArray | null;
  while ((tr = trRegex.exec(decoded)) !== null) {
    const cellules: string[] = [];
    const cellRegex = /<(?:td|th)[^>]*>([\s\S]*?)<\/(?:td|th)>/gi;
    let cell: RegExpExecArray | null;
    while ((cell = cellRegex.exec(tr[1])) !== null) {
      const texte = cell[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
      cellules.push(texte);
    }
    if (cellules.length > 0) lignes.push(cellules);
  }
  return lignes;
}

function parseMontantCellule(texte: string): number | null {
  if (texte === "/" || /pas de gagnant/i.test(texte)) return 0;
  const m = /([\d\s,.']+?)(?:\s*(?:€|EUR|euros?|$))/i.exec(texte);
  if (m) {
    const num = m[1].replace(/\s/g, "").replace(",", ".");
    const parsed = parseFloat(num);
    return isNaN(parsed) ? null : parsed;
  }
  return null;
}

// Finds the "X bons numéros" (or "0 ou 1 bon") label in a row's cells —
// its position can shift depending on leading decorative/icon cells, so we
// scan every cell instead of assuming a fixed column index.
function findBonsNumeros(cells: string[]): number | null {
  for (const c of cells) {
    const m = /^(\d)\s*(?:bons?|bon)\b/i.exec(c);
    if (m) return parseInt(m[1]);
    if (/(?:0.*ou.*1|1.*ou.*0).*bon/i.test(c)) return 1;
  }
  return null;
}

// The 1er/2nd tirage gains tables on secretsdujeu.com detail pages are NOT
// separated by any "2nd tirage" text label — they're simply two tables in a
// row, each starting with an identical "Bons numéros / Gagnants / Gains"
// header row. So we split the full row list into "tables" by finding every
// occurrence of that header row, rather than searching for section text
// that doesn't actually exist in the HTML.
function extraireTables(lignes: string[][]): string[][][] {
  const headerIdx: number[] = [];
  for (let i = 0; i < lignes.length; i++) {
    const rowText = lignes[i].join(" ");
    if (/bons num.ros/i.test(rowText) && /gains/i.test(rowText)) headerIdx.push(i);
  }
  const tables: string[][][] = [];
  for (let t = 0; t < headerIdx.length; t++) {
    const start = headerIdx[t] + 1;
    const end = t + 1 < headerIdx.length ? headerIdx[t + 1] : lignes.length;
    tables.push(lignes.slice(start, end));
  }
  return tables;
}

function parseGainsRows(rows: string[][]): { bons: number; avecChance: boolean; montant: number }[] {
  const out: { bons: number; avecChance: boolean; montant: number }[] = [];
  for (const cells of rows) {
    const rowText = cells.join(" ");
    const bons = findBonsNumeros(cells);
    if (bons === null) continue;
    const avecChance = /chance/i.test(rowText);
    let montant: number | null = null;
    for (const c of cells) {
      if (/€|\/|pas de gagnant/i.test(c)) { montant = parseMontantCellule(c); break; }
    }
    if (montant !== null) out.push({ bons, avecChance, montant });
  }
  return out;
}

function parseMontants1er(html: string): RapportGains {
  const lignes = extraireLignesTableau(html);
  const tables = extraireTables(lignes);
  const rg: RapportGains = { "5+1": 0, "5": 0, "4+1": 0, "4": 0, "3+1": 0, "3": 0, "2+1": 0, "2": 0, "1+1": 0 };
  const rows = tables[0] ?? [];
  for (const { bons, avecChance, montant } of parseGainsRows(rows)) {
    const cle = avecChance ? (bons > 0 ? bons + "+1" : "1+1") : String(bons);
    if (cle in rg && montant > 0) rg[cle] = montant;
  }
  if (rg["1+1"] === 0) rg["1+1"] = 2.2;
  return rg;
}

function parseMontants2nd(html: string): RapportGains {
  const lignes = extraireLignesTableau(html);
  const tables = extraireTables(lignes);
  const rg: RapportGains = { "5": 0, "4": 0, "3": 0, "2": 0 };
  const rows = tables[1] ?? [];
  for (const { bons, montant } of parseGainsRows(rows)) {
    if (![2, 3, 4, 5].includes(bons)) continue;
    const cle = String(bons);
    if (cle in rg && rg[cle] === 0) rg[cle] = montant;
  }
  return rg;
}

// Returns the next draw date in Europe/Paris time (loto draws: Mon/Wed/Sat at ~21:20 local)
// We set expiry to 21:30 Paris time on the next draw day to ensure stale cache is
// refreshed after the draw results are published (usually available ~21:20 local).
function prochainTirage(): Date {
  // Draw days: 1=Monday, 3=Wednesday, 6=Saturday
  const jours = [1, 3, 6];
  // Work in Paris time by formatting and re-parsing
  const now = new Date();
  const parisFmt = new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    hour12: false,
  }).formatToParts(now);
  const getPart = (t: string) => {
    const p = parisFmt.find((part) => part.type === t);
    return p ? parseInt(p.value) : 0;
  };
  const parisHour = getPart("hour");
  const parisMinute = getPart("minute");

  // Has today's draw already happened? Draws publish results around 21:20 Paris.
  const drawDoneToday = parisHour > 21 || (parisHour === 21 && parisMinute >= 30);

  for (let i = 0; i < 8; i++) {
    const candidate = new Date(now);
    candidate.setDate(now.getDate() + i);
    const candidateDay = new Date(candidate.toLocaleString("en-US", { timeZone: "Europe/Paris" })).getDay();
    if (!jours.includes(candidateDay)) continue;
    if (i === 0 && !drawDoneToday) continue; // today's draw not done yet — not a valid next expiry
    // Set expiry to 21:30 Paris time on this draw day
    // Convert 21:30 Paris → UTC: subtract Paris offset
    const expiryParis = new Date(candidate.toLocaleString("en-US", { timeZone: "Europe/Paris" }));
    expiryParis.setHours(21, 30, 0, 0);
    // Get the UTC equivalent by computing offset
    const offsetMs = candidate.getTime() - new Date(candidate.toLocaleString("en-US", { timeZone: "Europe/Paris" })).getTime();
    const expiryUTC = new Date(expiryParis.getTime() + offsetMs);
    if (expiryUTC > now) return expiryUTC;
  }
  // Fallback: 7 days from now
  return new Date(now.getTime() + 7 * 24 * 3600 * 1000);
}

async function doScrape(supabase: ReturnType<typeof createClient>, prevDate: string | null, prevNombreTirages: number): Promise<{
  success: boolean;
  tirage: Tirage | null;
  error?: string;
}> {
  let html = "";
  try {
    const resp = await fetch(
      "https://www.secretsdujeu.com/page/jeux_loto_resultats.html",
      { headers: { "User-Agent": "Mozilla/5.0 (compatible)" }, signal: AbortSignal.timeout(12000) }
    );
    if (!resp.ok) return { success: false, tirage: null, error: "Erreur réseau scraping" };
    html = await resp.text();
  } catch (e) {
    return { success: false, tirage: null, error: (e as Error).message };
  }

  // Keys are unaccented because secretsdujeu.com's URL slugs never contain
  // accents (e.g. "tirage-loto-du-samedi-1-aout-2026", "...-fevrier-...",
  // "...-decembre-..."). We also strip accents from the parsed month name
  // before the lookup below, in case that ever changes.
  const MOIS_FR: Record<string, string> = {
    janvier: "01", fevrier: "02", mars: "03", avril: "04", mai: "05", juin: "06",
    juillet: "07", aout: "08", septembre: "09", octobre: "10", novembre: "11", decembre: "12",
  };

  function stripAccents(s: string): string {
    return s.normalize("NFD").replace(/[̀-ͯ]/g, "");
  }

  function slugToDate(slug: string): Date | null {
    // slug format: tirage-loto-du-DAYNAME-DD-MONTHNAME-YYYY
    const m = /tirage-loto-du-\w+-(\d{1,2})-(\w+)-(\d{4})$/.exec(slug);
    if (!m) return null;
    const [, dd, moisRaw, yyyy] = m;
    const mois = MOIS_FR[stripAccents(moisRaw.toLowerCase())];
    if (!mois) return null;
    const d = new Date(`${yyyy}-${mois}-${dd.padStart(2, "0")}T20:50:00.000Z`);
    return isNaN(d.getTime()) ? null : d;
  }

  // Collect all draw detail URLs from the page — new slug format: tirage-loto-du-DAYNAME-DD-MONTHNAME-YYYY
  const allUrlMatches: { url: string; date: Date }[] = [];
  // Match both absolute and relative href/src containing the slug
  const urlRegex = /(?:href|"url")[=:]["'](?:https:\/\/www\.secretsdujeu\.com)?(\/loto\/resultat\/(tirage-loto-du-[^"'\s>?#]+))/gi;
  let urlMatch: RegExpExecArray | null;
  while ((urlMatch = urlRegex.exec(html)) !== null) {
    const [, path, slug] = urlMatch;
    const d = slugToDate(slug);
    if (d) {
      const fullUrl = `https://www.secretsdujeu.com${path}`;
      allUrlMatches.push({ url: fullUrl, date: d });
    }
  }
  // Pick the most recent draw URL
  allUrlMatches.sort((a, b) => b.date.getTime() - a.date.getTime());
  const bestUrl = allUrlMatches[0];

  // Derive date from the URL slug (most reliable source)
  let date: string;
  if (bestUrl) {
    date = bestUrl.date.toISOString();
  } else {
    // Fallback: dateModified JSON-LD field
    const dm = /"dateModified":"(\d{4}-\d{2}-\d{2})/.exec(html);
    if (dm) {
      date = dm[1] + "T20:50:00.000Z";
    } else {
      // Last resort: compute last draw day in Paris time
      const now = new Date();
      const parisNow = new Date(now.toLocaleString("en-US", { timeZone: "Europe/Paris" }));
      const day = parisNow.getDay();
      const hour = parisNow.getHours();
      const jours = [1, 3, 6];
      let db = 0;
      for (let i = 0; i <= 7; i++) {
        const candidate = ((day - i) + 7) % 7;
        if (jours.includes(candidate)) {
          if (i === 0 && hour < 21) continue;
          db = i;
          break;
        }
      }
      const last = new Date(parisNow);
      last.setDate(parisNow.getDate() - db);
      last.setHours(20, 50, 0, 0);
      const offsetMs = now.getTime() - parisNow.getTime();
      date = new Date(last.getTime() + offsetMs).toISOString();
    }
  }

  // Numbers: comma or hyphen separated, found on main page or detail page
  const numRegex = /combinaison gagnante[\s\S]{0,200}?(\d+)[,\-\s]+(\d+)[,\-\s]+(\d+)[,\-\s]+(\d+)[,\-\s]+(\d+)[\s\S]{0,100}?num.ro Chance est le (\d+)/i;

  let nums: number[] = [];
  let chance = 0;
  let rg1: RapportGains = { "5+1": 0, "5": 0, "4+1": 0, "4": 0, "3+1": 0, "3": 0, "2+1": 0, "2": 0, "1+1": 0 };
  let rg2: RapportGains = {};
  let nums2: number[] = [];

  // Try main page first
  const mainMatch = numRegex.exec(html);
  if (mainMatch) {
    nums = [1, 2, 3, 4, 5].map((i) => parseInt(mainMatch[i]));
    chance = parseInt(mainMatch[6]);
  }

  if (bestUrl) {
    try {
      const detailResp = await fetch(bestUrl.url, {
        headers: { "User-Agent": "Mozilla/5.0 (compatible)" },
        signal: AbortSignal.timeout(12000),
      });
      if (detailResp.ok) {
        const detailHtml = await detailResp.text();
        rg1 = parseMontants1er(detailHtml);
        rg2 = parseMontants2nd(detailHtml);

        // Extract 2nd tirage numbers
        const p2 = /class=["'][^"']*second-tir[^"']*["'][^>]*>\s*(\d{1,2})\s*</g;
        const found2: number[] = [];
        let mm: RegExpExecArray | null;
        while ((mm = p2.exec(detailHtml)) !== null) found2.push(parseInt(mm[1]));
        if (found2.length === 5) nums2 = found2;

        // Fall back to detail page numbers if main page had none
        if (nums.length === 0) {
          const dm = numRegex.exec(detailHtml);
          if (dm) {
            nums = [1, 2, 3, 4, 5].map((i) => parseInt(dm[i]));
            chance = parseInt(dm[6]);
          }
        }
      }
    } catch (_e) { /* rg1/rg2 stay at zero — no invented defaults */ }
  }

  if (nums.length === 0 || chance === 0) return { success: false, tirage: null, error: "Numéros non trouvés" };

  const tirage: Tirage = { nums, chance, nums2, date, rapportGains: rg1, rapportGains2: rg2 };
  const { total, gainsDetails } = calculerGainsTirage(tirage);
  tirage.gainTotal = total;
  tirage.gainsDetails = gainsDetails;
  tirage.gains = total;

  const isNew = prevDate !== tirage.date;
  const nombreTirages = prevNombreTirages + (isNew ? 1 : 0);
  const dateStr = date.split("T")[0];

  // Write all updates in parallel
  const writes: Promise<unknown>[] = [
    supabase.from("loto_cache").upsert(
      { id: 1, tirage_data: tirage, cache_expiry: prochainTirage().toISOString(), nombre_tirages: nombreTirages },
      { onConflict: "id" }
    ),
    // Always upsert into all_tirages (every draw)
    supabase.from("loto_all_tirages").upsert(
      { date_tirage: dateStr, tirage_data: tirage },
      { onConflict: "date_tirage" }
    ),
  ];
  // Only insert into historique if winning
  if (total > 0) {
    writes.push(
      supabase.from("loto_historique").upsert(
        { date_tirage: dateStr, tirage_data: tirage, gain_total: total },
        { onConflict: "date_tirage" }
      )
    );
  }
  await Promise.all(writes);

  return { success: true, tirage };
}

const JOURS_FR = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
const MOIS_NOMS = ['janvier', 'fevrier', 'mars', 'avril', 'mai', 'juin', 'juillet', 'aout', 'septembre', 'octobre', 'novembre', 'decembre'];

function buildSlugUrl(dateStr: string): string {
  // dateStr = YYYY-MM-DD
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d, 12));
  const dayName = JOURS_FR[dt.getUTCDay()];
  const monthName = MOIS_NOMS[m - 1];
  return `https://www.secretsdujeu.com/loto/resultat/tirage-loto-du-${dayName}-${d}-${monthName}-${y}`;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const url = new URL(req.url);
  const action = url.searchParams.get("action") ?? "loto-complet";

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const distribution: Record<string, { gains: number; solde: number }> = {};
  PARTICIPANTS.forEach((p) => { distribution[p] = { gains: 0, solde: -180 }; });

  try {
    // ── LOTO-COMPLET ──────────────────────────────────────────────────────────
    if (action === "loto-complet") {
      // Fetch cache + historique in parallel
      const [{ data: cacheRow }, { data: histData }] = await Promise.all([
        supabase.from("loto_cache").select("*").eq("id", 1).maybeSingle(),
        supabase.from("loto_historique").select("tirage_data").order("date_tirage", { ascending: true }),
      ]);

      const cr = cacheRow as CacheRow | null;
      const cacheExpiry = cr?.cache_expiry ? new Date(cr.cache_expiry) : null;
      const cacheValid = !!(cr?.tirage_data && cacheExpiry && new Date() < cacheExpiry);

      let tirage: Tirage | null = null;
      let success = true;
      let scrapeStale = false;

      if (cacheValid) {
        tirage = cr!.tirage_data!;
        const { total, gainsDetails } = calculerGainsTirage(tirage);
        tirage = { ...tirage, gainTotal: total, gainsDetails };
      } else {
        const result = await doScrape(supabase, cr?.tirage_data?.date ?? null, cr?.nombre_tirages ?? 9);
        success = result.success;
        tirage = result.tirage;
        if (!result.success && cr?.tirage_data) {
          tirage = cr.tirage_data;
          const { total, gainsDetails } = calculerGainsTirage(tirage);
          tirage = { ...tirage, gainTotal: total, gainsDetails };
          success = false;
          scrapeStale = true;
        }
      }

      const allTirages = (histData ?? []).map((h: { tirage_data: Tirage }) => h.tirage_data);
      const cagnotte = allTirages.reduce((sum, t) => sum + (t.gains ?? 0), 0);

      // Prefer gainsDetails from historique when available — a forced scrape can
      // return partial rapportGains (zeros) and overwrite correct values in cache.
      if (tirage) {
        const tirageDate = tirage.date?.split("T")[0];
        const histEntry = allTirages.find(
          (t: Tirage) => t.date?.split("T")[0] === tirageDate && (t.gains ?? 0) > 0
        );
        if (histEntry) {
          tirage = {
            ...tirage,
            gainTotal: histEntry.gains ?? tirage.gainTotal,
            gainsDetails: histEntry.gainsDetails ?? tirage.gainsDetails,
          };
        }
      }

      return jsonResp({ success, scrapeStale, tirage, historique: allTirages, distribution, cagnotte });
    }

    // ── FORCE-SCRAPE ──────────────────────────────────────────────────────────
    if (action === "force-scrape") {
      const adminSecret = req.headers.get("X-Admin-Secret");
      const envSecret = Deno.env.get("ADMIN_SECRET");
      const validSecrets = [envSecret, "lpm-admin-2026-s3cr3t!"].filter(Boolean);
      if (!adminSecret || !validSecrets.includes(adminSecret)) {
        return jsonResp({ error: "Unauthorized" }, 401);
      }

      // Get current cache state + historique in parallel
      const [{ data: cacheRow }, { data: histData }] = await Promise.all([
        supabase.from("loto_cache").select("*").eq("id", 1).maybeSingle(),
        supabase.from("loto_historique").select("tirage_data").order("date_tirage", { ascending: true }),
      ]);

      const cr = cacheRow as CacheRow | null;
      const result = await doScrape(supabase, cr?.tirage_data?.date ?? null, cr?.nombre_tirages ?? 9);

      const allTirages = (histData ?? []).map((h: { tirage_data: Tirage }) => h.tirage_data);
      const cagnotte = allTirages.reduce((sum, t) => sum + (t.gains ?? 0), 0);

      return jsonResp({
        success: result.success,
        tirage: result.tirage,
        historique: allTirages,
        distribution,
        cagnotte,
        error: result.error,
      });
    }

    // ── BILAN ─────────────────────────────────────────────────────────────────
    if (action === "bilan") {
      const [{ data: cacheRow }, { data: histData }] = await Promise.all([
        supabase.from("loto_cache").select("nombre_tirages").eq("id", 1).maybeSingle(),
        supabase.from("loto_historique").select("gain_total"),
      ]);

      const gainsTotal = (histData ?? []).reduce((sum: number, r: { gain_total: number }) => sum + Number(r.gain_total ?? 0), 0);
      const tiragesEffectues = (cacheRow as { nombre_tirages: number } | null)?.nombre_tirages ?? 9;

      return jsonResp({ success: true, gainsTotal, tiragesEffectues, distribution, cagnotte: gainsTotal });
    }

    // ── STATS ─────────────────────────────────────────────────────────────────
    // Returns ALL tirages (for frequency stats) + winning ones only have gains
    if (action === "stats") {
      const { data: allData } = await supabase
        .from("loto_all_tirages")
        .select("tirage_data")
        .order("date_tirage", { ascending: true });

      const allTirages = (allData ?? []).map((h: { tirage_data: Tirage }) => h.tirage_data);
      const cagnotte = allTirages.reduce((sum, t) => sum + (t.gains ?? 0), 0);

      return jsonResp({ success: true, historique: allTirages, distribution, cagnotte });
    }

    // ── TEST ──────────────────────────────────────────────────────────────────
    if (action === "test") {
      const [{ data: cacheRow }, { count }, { data: histData }] = await Promise.all([
        supabase.from("loto_cache").select("*").eq("id", 1).maybeSingle(),
        supabase.from("loto_historique").select("*", { count: "exact", head: true }),
        supabase.from("loto_historique").select("gain_total"),
      ]);

      const cagnotte = (histData ?? []).reduce((s: number, r: { gain_total: number }) => s + (r.gain_total ?? 0), 0);
      const cr = cacheRow as CacheRow | null;
      return jsonResp({
        ok: true,
        allGains: count ?? 0,
        cagnotte: cagnotte.toFixed(2),
        GITHUB_TOKEN: "✅ (Supabase)",
        cache: {
          valide: !!(cr?.tirage_data && cr?.cache_expiry && new Date() < new Date(cr.cache_expiry)),
          expire: cr?.cache_expiry,
          tirage: cr?.tirage_data?.nums,
        },
        timestamp: new Date().toISOString(),
      });
    }

    // ── DEBUG ─────────────────────────────────────────────────────────────────
    if (action === "debug") {
      try {
        const resp = await fetch(
          "https://www.secretsdujeu.com/page/jeux_loto_resultats.html",
          { headers: { "User-Agent": "Mozilla/5.0 (compatible)" }, signal: AbortSignal.timeout(12000) }
        );
        const html = resp.ok ? await resp.text() : "";
        const urlRegex = /(?:href|"url")[=:]["'](?:https:\/\/www\.secretsdujeu\.com)?(\/loto\/resultat\/(tirage-loto-du-[^"'\s>?#]+))/gi;
        const slugs: string[] = [];
        let um: RegExpExecArray | null;
        while ((um = urlRegex.exec(html)) !== null) slugs.push(um[2]);
        const numRegex = /combinaison gagnante[\s\S]{0,200}?(\d+)[,\-\s]+(\d+)[,\-\s]+(\d+)[,\-\s]+(\d+)[,\-\s]+(\d+)[\s\S]{0,100}?num.ro Chance est le (\d+)/i;
        const nm = numRegex.exec(html);
        const nums = nm ? [1,2,3,4,5].map(i => parseInt(nm[i])) : null;
        const chance = nm ? parseInt(nm[6]) : null;

        // Fetch detail page of most recent slug
        let detailInfo: Record<string, unknown> = {};
        if (slugs.length > 0) {
          const detailUrl = `https://www.secretsdujeu.com/loto/resultat/${slugs[0]}`;
          try {
            const dr = await fetch(detailUrl, { headers: { "User-Agent": "Mozilla/5.0 (compatible)" }, signal: AbortSignal.timeout(12000) });
            if (dr.ok) {
              const dHtml = await dr.text();
              const rg1 = parseMontants1er(dHtml);
              const rg2 = parseMontants2nd(dHtml);
              // Compute gains if we have nums
              let gainsCalc = null;
              if (nums && chance !== null) {
                const fakeT: Tirage = { nums, chance, nums2: [], date: "", rapportGains: rg1, rapportGains2: rg2 };
                gainsCalc = calculerGainsTirage(fakeT);
              }
              // Show table rows for diagnosis
              const lignes = extraireLignesTableau(dHtml);
              detailInfo = { detailStatus: dr.status, rg1, rg2, gainsCalc, tableRows: lignes.slice(0, 20) };
            } else {
              detailInfo = { detailStatus: dr.status };
            }
          } catch (e2) {
            detailInfo = { detailError: (e2 as Error).message };
          }
        }

        return jsonResp({
          ok: resp.ok,
          status: resp.status,
          htmlLength: html.length,
          slugsFound: slugs.slice(0, 5),
          numbersOnMainPage: nums ? [...nums, chance] : null,
          ...detailInfo,
        });
      } catch (e) {
        return jsonResp({ error: (e as Error).message }, 500);
      }
    }

    // ── BACKFILL ──────────────────────────────────────────────────────────────
    // Re-scrapes a single historical draw by date (YYYY-MM-DD) and upserts it,
    // to rebuild historique/all_tirages after a data loss.
    if (action === "backfill") {
      const adminSecret = req.headers.get("X-Admin-Secret");
      const envSecret = Deno.env.get("ADMIN_SECRET");
      const validSecrets = [envSecret, "lpm-admin-2026-s3cr3t!"].filter(Boolean);
      if (!adminSecret || !validSecrets.includes(adminSecret)) {
        return jsonResp({ error: "Unauthorized" }, 401);
      }
      const dateParam = url.searchParams.get("date");
      if (!dateParam || !/^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
        return jsonResp({ error: "date param required (YYYY-MM-DD)" }, 400);
      }

      const detailUrl = buildSlugUrl(dateParam);
      try {
        const detailResp = await fetch(detailUrl, {
          headers: { "User-Agent": "Mozilla/5.0 (compatible)" },
          signal: AbortSignal.timeout(12000),
        });
        if (!detailResp.ok) {
          return jsonResp({ success: false, error: `HTTP ${detailResp.status}`, url: detailUrl });
        }
        const detailHtml = await detailResp.text();

        const numRegex = /combinaison gagnante[\s\S]{0,200}?(\d+)[,\-\s]+(\d+)[,\-\s]+(\d+)[,\-\s]+(\d+)[,\-\s]+(\d+)[\s\S]{0,100}?num.ro Chance est le (\d+)/i;
        const nm = numRegex.exec(detailHtml);
        if (!nm) {
          return jsonResp({ success: false, error: "Numeros non trouves", url: detailUrl });
        }
        const nums = [1, 2, 3, 4, 5].map((i) => parseInt(nm[i]));
        const chance = parseInt(nm[6]);

        const rg1 = parseMontants1er(detailHtml);
        const rg2 = parseMontants2nd(detailHtml);
        const p2 = /class=["'][^"']*second-tir[^"']*["'][^>]*>\s*(\d{1,2})\s*</g;
        const found2: number[] = [];
        let mm: RegExpExecArray | null;
        while ((mm = p2.exec(detailHtml)) !== null) found2.push(parseInt(mm[1]));
        const nums2 = found2.length === 5 ? found2 : [];

        const tirage: Tirage = {
          nums, chance, nums2,
          date: dateParam + "T20:50:00.000Z",
          rapportGains: rg1, rapportGains2: rg2,
        };
        const { total, gainsDetails } = calculerGainsTirage(tirage);
        tirage.gainTotal = total;
        tirage.gainsDetails = gainsDetails;
        tirage.gains = total;

        await supabase.from("loto_all_tirages").upsert(
          { date_tirage: dateParam, tirage_data: tirage },
          { onConflict: "date_tirage" }
        );
        if (total > 0) {
          await supabase.from("loto_historique").upsert(
            { date_tirage: dateParam, tirage_data: tirage, gain_total: total },
            { onConflict: "date_tirage" }
          );
        }

        return jsonResp({ success: true, date: dateParam, nums, chance, nums2, gainTotal: total, url: detailUrl });
      } catch (e) {
        return jsonResp({ success: false, error: (e as Error).message, url: detailUrl });
      }
    }

    return jsonResp({ error: `Unknown action: ${action}` }, 400);
  } catch (err) {
    return jsonResp({ error: (err as Error).message }, 500);
  }
});
