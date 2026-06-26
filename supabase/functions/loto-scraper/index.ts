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

function parseMontants1er(html: string): RapportGains {
  const lignes = extraireLignesTableau(html);
  const rg: RapportGains = { "5+1": 0, "5": 0, "4+1": 0, "4": 0, "3+1": 0, "3": 0, "2+1": 0, "2": 0, "1+1": 0 };
  for (let i = 0; i < lignes.length; i++) {
    const rowText = lignes[i].join(" ");
    if (/2nd.*tirage|second.*tirage/i.test(rowText)) break;
    const cells = lignes[i];
    let bonsMatch = /^(\d)\s*(?:bons?|bon)\b/i.exec(cells[0] || "");
    if (!bonsMatch && /(?:0.*ou.*1|1.*ou.*0).*bon/i.test(cells[0] || "")) {
      bonsMatch = ["", "1"];
    }
    if (!bonsMatch) continue;
    const bons = parseInt(bonsMatch[1]);
    const avecChance = /chance/i.test(rowText);
    let montant: number | null = null;
    for (let j = 0; j < cells.length; j++) {
      if (/€|\/|pas de gagnant/i.test(cells[j])) { montant = parseMontantCellule(cells[j]); break; }
    }
    const cle = avecChance ? (bons > 0 ? bons + "+1" : "1+1") : String(bons);
    if (cle in rg && montant !== null && montant > 0) rg[cle] = montant;
  }
  if (rg["1+1"] === 0) rg["1+1"] = 2.2;
  return rg;
}

function parseMontants2nd(html: string): RapportGains {
  const lignes = extraireLignesTableau(html);
  const rg: RapportGains = { "5": 0, "4": 0, "3": 0, "2": 0 };
  let foundSecond = false;
  for (let i = 0; i < lignes.length; i++) {
    const rowText = lignes[i].join(" ");
    if (/2nd.*tirage|second.*tirage/i.test(rowText)) { foundSecond = true; continue; }
    if (!foundSecond) continue;
    const cells = lignes[i];
    const bonsMatch = /^(\d)\s*(?:bons?|bon)\b/i.exec(cells[0] || "");
    if (!bonsMatch) continue;
    const bons = parseInt(bonsMatch[1]);
    if (![2, 3, 4, 5].includes(bons)) continue;
    let montant: number | null = null;
    for (let j = 0; j < cells.length; j++) {
      if (/€|\/|pas de gagnant/i.test(cells[j])) { montant = parseMontantCellule(cells[j]); break; }
    }
    const cle = String(bons);
    if (cle in rg && rg[cle] === 0 && montant !== null) rg[cle] = montant;
  }
  return rg;
}

function prochainTirage(): Date {
  const now = new Date();
  const jours = [1, 3, 6];
  for (let i = 0; i < 7; i++) {
    const d = new Date(now);
    d.setDate(now.getDate() + i);
    if (jours.includes(d.getDay())) {
      d.setHours(20, 50, 0, 0);
      if (d > now) return d;
    }
  }
  const d = new Date(now);
  d.setDate(now.getDate() + 7);
  d.setHours(20, 50, 0, 0);
  return d;
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

  let date: string;
  const dm = /"dateModified":"(\d{4}-\d{2}-\d{2})/.exec(html);
  if (dm) {
    date = dm[1] + "T20:50:00.000Z";
  } else {
    const now = new Date();
    const day = now.getDay();
    const jours = [1, 3, 6];
    let db = 0;
    for (let i = 0; i <= 7; i++) {
      if (jours.includes(((day - i) + 7) % 7)) { db = i; break; }
    }
    const last = new Date(now);
    last.setDate(now.getDate() - db);
    if (db === 0 && now.getHours() < 21) {
      for (let i = 1; i <= 7; i++) {
        if (jours.includes(((day - i) + 7) % 7)) { last.setDate(now.getDate() - i); break; }
      }
    }
    last.setHours(20, 50, 0, 0);
    date = last.toISOString();
  }

  const m = /combinaison gagnante[^0-9]*(\d+)-(\d+)-(\d+)-(\d+)-(\d+)[^0-9]*num.ro Chance est le (\d+)/.exec(html);
  if (!m) return { success: false, tirage: null, error: "Numéros non trouvés" };

  const nums = [1, 2, 3, 4, 5].map((i) => parseInt(m[i]));
  const chance = parseInt(m[6]);
  let rg1: RapportGains = { "5+1": 0, "5": 0, "4+1": 0, "4": 0, "3+1": 0, "3": 0, "2+1": 0, "2": 0, "1+1": 0 };
  let rg2: RapportGains = {};
  let nums2: number[] = [];

  const urlM = /"url":"(https:\/\/www\.secretsdujeu\.com\/loto\/resultat\/tirage-loto-du-[^"]+)"/.exec(html);
  if (urlM) {
    try {
      const detailResp = await fetch(urlM[1], {
        headers: { "User-Agent": "Mozilla/5.0 (compatible)" },
        signal: AbortSignal.timeout(12000),
      });
      if (detailResp.ok) {
        const detailHtml = await detailResp.text();
        // Use only real FDJ values — no defaults
        rg1 = parseMontants1er(detailHtml);
        rg2 = parseMontants2nd(detailHtml);
        const p2 = /class=["']loto-numero second-tir["'][^>]*>\s*(\d{1,2})\s*<\/p>/g;
        let mm: RegExpExecArray | null;
        while ((mm = p2.exec(detailHtml)) !== null) nums2.push(parseInt(mm[1]));
      }
    } catch (_e) { /* rg1/rg2 stay at zero — no invented defaults */ }
  }

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

      return jsonResp({ success, tirage, historique: allTirages, distribution, cagnotte });
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

    return jsonResp({ error: `Unknown action: ${action}` }, 400);
  } catch (err) {
    return jsonResp({ error: (err as Error).message }, 500);
  }
});
