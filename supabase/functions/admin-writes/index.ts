import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, X-Admin-Secret",
};

function json(data: unknown, status = 200) {
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

interface GainDetail { grille: number; tirage: string; gain: number }

function computeGains(
  nums: number[], chance: number, nums2: number[],
  rg: Record<string, number>, rg2: Record<string, number>
): { total: number; gainsDetails: GainDetail[] } {
  let total = 0;
  const gainsDetails: GainDetail[] = [];
  const a2 = nums2.length === 5;
  for (let i = 0; i < GRILLES.length; i++) {
    const n = nums.filter((x) => GRILLES[i].includes(x)).length;
    const c = CHANCES[i] === chance;
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
    const win1 = (n === 5 && c) || n === 5 || (n === 4 && c) || n === 4 ||
      (n === 3 && c) || n === 3 || (n === 2 && c) || n === 2 || (n <= 1 && c);
    if (win1) { total += g; gainsDetails.push({ grille: i + 1, tirage: "1er", gain: g }); }
    if (a2) {
      const n2 = nums2.filter((x) => GRILLES[i].includes(x)).length;
      let g2 = 0;
      if (n2 === 5) g2 = rg2["5"] || 0;
      else if (n2 === 4) g2 = rg2["4"] || 0;
      else if (n2 === 3) g2 = rg2["3"] || 0;
      else if (n2 === 2) g2 = rg2["2"] || 0;
      if (n2 >= 2) { total += g2; gainsDetails.push({ grille: i + 1, tirage: "2nd", gain: g2 }); }
    }
  }
  return { total, gainsDetails };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const adminSecret = req.headers.get("X-Admin-Secret");
    const envSecret = Deno.env.get("ADMIN_SECRET") ?? Deno.env.get("APIsecret");
    const validSecrets = [envSecret, "lpm-admin-2026-s3cr3t!"].filter(Boolean);
    if (!adminSecret || !validSecrets.includes(adminSecret)) {
      return json({ error: "Unauthorized" }, 401);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const url = new URL(req.url);
    const action = url.searchParams.get("action");

    if (!action) return json({ error: "Missing action" }, 400);

    // ── PAIEMENTS ──────────────────────────────────────────────────────────────
    if (action === "insert_paiement") {
      const body = await req.json();
      const { montant, montant_par_personne, note, participants } = body;
      if (typeof montant !== "number" || montant <= 0) {
        return json({ error: "Invalid montant" }, 400);
      }
      if (!Array.isArray(participants) || participants.length === 0) {
        return json({ error: "Invalid participants" }, 400);
      }

      const { data: paiement, error: paiementError } = await supabase
        .from("paiements")
        .insert({ montant, montant_par_personne, note })
        .select()
        .single();
      if (paiementError) return json({ error: paiementError.message }, 500);

      const virementRows = (participants as string[]).map((nom) => ({
        participant_nom: nom.trim(),
        effectue: false,
        date_virement: null,
        paiement_id: paiement.id,
      }));
      const { error: virementsError } = await supabase.from("virements").insert(virementRows);
      if (virementsError) return json({ error: virementsError.message }, 500);

      return json({ data: paiement });
    }

    // ── VIREMENTS ──────────────────────────────────────────────────────────────
    if (action === "upsert_virement") {
      const body = await req.json();
      const { participant_nom, paiement_id, effectue, date_virement } = body;
      if (typeof participant_nom !== "string" || participant_nom.trim() === "") {
        return json({ error: "Invalid participant_nom" }, 400);
      }
      if (typeof paiement_id !== "string") {
        return json({ error: "Invalid paiement_id" }, 400);
      }
      const { data, error } = await supabase
        .from("virements")
        .upsert(
          { participant_nom: participant_nom.trim(), paiement_id, effectue: Boolean(effectue), date_virement: date_virement ?? null },
          { onConflict: "participant_nom,paiement_id" },
        )
        .select()
        .single();
      if (error) return json({ error: error.message }, 500);
      return json({ data });
    }

    // ── SAISIE MANUELLE D'UN TIRAGE ────────────────────────────────────────────
    if (action === "upsert_tirage_manual") {
      const body = await req.json();
      const { date, nums, chance, nums2 } = body;

      if (!/^\d{4}-\d{2}-\d{2}$/.test(date ?? "")) return json({ error: "date invalide (YYYY-MM-DD)" }, 400);
      if (!Array.isArray(nums) || nums.length !== 5 || !nums.every((n: unknown) => Number.isInteger(n) && (n as number) >= 1 && (n as number) <= 49)) {
        return json({ error: "nums: tableau de 5 entiers (1-49)" }, 400);
      }
      if (!Number.isInteger(chance) || chance < 1 || chance > 10) {
        return json({ error: "chance: entier entre 1 et 10" }, 400);
      }
      const validNums2: number[] = Array.isArray(nums2) && nums2.length === 5 ? nums2 : [];

      // Fetch rapportGains from cache for accurate prize calculation
      let rg1: Record<string, number> = { "5+1": 0, "5": 0, "4+1": 0, "4": 0, "3+1": 0, "3": 0, "2+1": 0, "2": 0, "1+1": 2.2 };
      let rg2: Record<string, number> = { "5": 0, "4": 0, "3": 0, "2": 0 };
      const { data: cacheRow } = await supabase.from("loto_cache").select("tirage_data").eq("id", 1).maybeSingle();
      if (cacheRow?.tirage_data?.rapportGains) rg1 = { ...rg1, ...cacheRow.tirage_data.rapportGains };
      if (cacheRow?.tirage_data?.rapportGains2) rg2 = { ...rg2, ...cacheRow.tirage_data.rapportGains2 };

      const { total, gainsDetails } = computeGains(nums, chance, validNums2, rg1, rg2);

      const tirage = {
        nums, chance, nums2: validNums2,
        date: date + "T20:50:00.000Z",
        rapportGains: rg1, rapportGains2: rg2,
        gainTotal: total, gains: total, gainsDetails,
      };

      const writes: Promise<unknown>[] = [
        supabase.from("loto_all_tirages").upsert(
          { date_tirage: date, tirage_data: tirage },
          { onConflict: "date_tirage" }
        ),
      ];
      if (total > 0) {
        writes.push(
          supabase.from("loto_historique").upsert(
            { date_tirage: date, tirage_data: tirage, gain_total: total },
            { onConflict: "date_tirage" }
          )
        );
      }
      // Update cache if this is the most recent draw
      const { data: cacheData } = await supabase.from("loto_cache").select("tirage_data").eq("id", 1).maybeSingle();
      const cachedDate = (cacheData?.tirage_data as { date?: string } | null)?.date?.split("T")[0] ?? "";
      if (date >= cachedDate) {
        writes.push(
          supabase.from("loto_cache").upsert(
            { id: 1, tirage_data: tirage },
            { onConflict: "id" }
          )
        );
      }
      await Promise.all(writes);

      return json({ success: true, tirage, gain: total, gainsDetails });
    }

    return json({ error: `Unknown action: ${action}` }, 400);
  } catch (err) {
    return json({ error: (err as Error).message }, 500);
  }
});


const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, X-Admin-Secret",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    // Validate admin secret: accept env var value OR the app default
    const adminSecret = req.headers.get("X-Admin-Secret");
    const envSecret = Deno.env.get("ADMIN_SECRET") ?? Deno.env.get("APIsecret");
    const validSecrets = [envSecret, "lpm-admin-2026-s3cr3t!"].filter(Boolean);
    if (!adminSecret || !validSecrets.includes(adminSecret)) {
      return json({ error: "Unauthorized" }, 401);
    }

    // Service-role client bypasses RLS — only used after secret is verified above
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const url = new URL(req.url);
    const action = url.searchParams.get("action");

    if (!action) return json({ error: "Missing action" }, 400);

    // ── PAIEMENTS ──────────────────────────────────────────────────────────────
    if (action === "insert_paiement") {
      const body = await req.json();
      const { montant, montant_par_personne, note, participants } = body;
      if (typeof montant !== "number" || montant <= 0) {
        return json({ error: "Invalid montant" }, 400);
      }
      if (!Array.isArray(participants) || participants.length === 0) {
        return json({ error: "Invalid participants" }, 400);
      }

      // Insert paiement
      const { data: paiement, error: paiementError } = await supabase
        .from("paiements")
        .insert({ montant, montant_par_personne, note })
        .select()
        .single();
      if (paiementError) return json({ error: paiementError.message }, 500);

      // Auto-create one virement per participant, all pending
      const virementRows = (participants as string[]).map((nom) => ({
        participant_nom: nom.trim(),
        effectue: false,
        date_virement: null,
        paiement_id: paiement.id,
      }));
      const { error: virementsError } = await supabase
        .from("virements")
        .insert(virementRows);
      if (virementsError) return json({ error: virementsError.message }, 500);

      return json({ data: paiement });
    }

    // ── VIREMENTS ──────────────────────────────────────────────────────────────
    if (action === "upsert_virement") {
      const body = await req.json();
      const { participant_nom, paiement_id, effectue, date_virement } = body;
      if (typeof participant_nom !== "string" || participant_nom.trim() === "") {
        return json({ error: "Invalid participant_nom" }, 400);
      }
      if (typeof paiement_id !== "string") {
        return json({ error: "Invalid paiement_id" }, 400);
      }
      const { data, error } = await supabase
        .from("virements")
        .upsert(
          {
            participant_nom: participant_nom.trim(),
            paiement_id,
            effectue: Boolean(effectue),
            date_virement: date_virement ?? null,
          },
          { onConflict: "participant_nom,paiement_id" },
        )
        .select()
        .single();
      if (error) return json({ error: error.message }, 500);
      return json({ data });
    }

    return json({ error: `Unknown action: ${action}` }, 400);
  } catch (err) {
    return json({ error: (err as Error).message }, 500);
  }
});
