/*
# Création des tables LES POTES MILLIONNAIRES

Application de gestion d'un syndicat Loto pour 13 participants.
Données partagées (single-tenant, pas d'auth individuelle).

1. Tables créées
   - `paiements` : Journal des distributions effectuées par l'admin
     - id (uuid PK)
     - montant (numeric) : Montant total distribué
     - montant_par_personne (numeric) : Montant / 13
     - note (text) : Note facultative
     - created_at (timestamptz)
   - `virements` : Suivi des virements individuels par participant
     - id (uuid PK)
     - participant_nom (text) : Nom du participant
     - effectue (boolean) : Si le virement a été fait
     - date_virement (date) : Date du virement
     - paiement_id (uuid FK → paiements) : Lié à un paiement
     - created_at (timestamptz)

2. Sécurité
   - RLS activé sur les deux tables
   - Accès anon + authenticated en lecture/écriture (app partagée, pas d'auth individuelle)
*/

CREATE TABLE IF NOT EXISTS paiements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  montant numeric(10,2) NOT NULL,
  montant_par_personne numeric(10,2) NOT NULL,
  note text DEFAULT 'Distribution syndicat',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE paiements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_paiements" ON paiements;
CREATE POLICY "anon_select_paiements" ON paiements FOR SELECT
TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_paiements" ON paiements;
CREATE POLICY "anon_insert_paiements" ON paiements FOR INSERT
TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_paiements" ON paiements;
CREATE POLICY "anon_update_paiements" ON paiements FOR UPDATE
TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_paiements" ON paiements;
CREATE POLICY "anon_delete_paiements" ON paiements FOR DELETE
TO anon, authenticated USING (true);

CREATE TABLE IF NOT EXISTS virements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_nom text NOT NULL,
  effectue boolean NOT NULL DEFAULT false,
  date_virement date,
  paiement_id uuid REFERENCES paiements(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE virements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_virements" ON virements;
CREATE POLICY "anon_select_virements" ON virements FOR SELECT
TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_virements" ON virements;
CREATE POLICY "anon_insert_virements" ON virements FOR INSERT
TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_virements" ON virements;
CREATE POLICY "anon_update_virements" ON virements FOR UPDATE
TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_virements" ON virements;
CREATE POLICY "anon_delete_virements" ON virements FOR DELETE
TO anon, authenticated USING (true);
