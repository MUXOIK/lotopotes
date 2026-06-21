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
    // Validate admin secret from request header
    const adminSecret = req.headers.get("X-Admin-Secret");
    const expectedSecret = Deno.env.get("ADMIN_SECRET") ?? Deno.env.get("APIsecret");
    if (!expectedSecret || adminSecret !== expectedSecret) {
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
      const { montant, montant_par_personne, note } = body;
      if (typeof montant !== "number" || montant <= 0) {
        return json({ error: "Invalid montant" }, 400);
      }
      const { data, error } = await supabase
        .from("paiements")
        .insert({ montant, montant_par_personne, note })
        .select()
        .single();
      if (error) return json({ error: error.message }, 500);
      return json({ data });
    }

    // ── VIREMENTS ──────────────────────────────────────────────────────────────
    if (action === "upsert_virement") {
      const body = await req.json();
      const { participant_nom, effectue, date_virement } = body;
      if (typeof participant_nom !== "string" || participant_nom.trim() === "") {
        return json({ error: "Invalid participant_nom" }, 400);
      }
      const { data, error } = await supabase
        .from("virements")
        .upsert(
          { participant_nom: participant_nom.trim(), effectue: Boolean(effectue), date_virement: date_virement ?? null },
          { onConflict: "participant_nom" },
        )
        .select()
        .single();
      if (error) return json({ error: error.message }, 500);
      return json({ data });
    }

    if (action === "reset_virements") {
      const { error } = await supabase
        .from("virements")
        .delete()
        .neq("id", "00000000-0000-0000-0000-000000000000");
      if (error) return json({ error: error.message }, 500);
      return json({ ok: true });
    }

    return json({ error: `Unknown action: ${action}` }, 400);
  } catch (err) {
    return json({ error: (err as Error).message }, 500);
  }
});
