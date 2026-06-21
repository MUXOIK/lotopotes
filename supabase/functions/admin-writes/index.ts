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
