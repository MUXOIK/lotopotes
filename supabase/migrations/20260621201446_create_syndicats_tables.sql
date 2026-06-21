-- Tables pour l'app générique LotoPotes (multi-syndicats)

CREATE TABLE IF NOT EXISTS syndicats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  nom text NOT NULL,
  tresorier_nom text NOT NULL,
  nb_mois integer NOT NULL DEFAULT 12,
  date_debut date NOT NULL,
  prix_tirage_1 numeric(6,2) NOT NULL DEFAULT 2.20,
  prix_tirage_2 numeric(6,2) NOT NULL DEFAULT 0.80,
  nb_grilles integer NOT NULL DEFAULT 5,
  admin_password text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE syndicats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_syndicats" ON syndicats FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "insert_syndicats" ON syndicats FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "update_syndicats" ON syndicats FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "delete_syndicats" ON syndicats FOR DELETE TO anon, authenticated USING (true);

-- Participants d'un syndicat
CREATE TABLE IF NOT EXISTS syndic_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  syndicat_id uuid NOT NULL REFERENCES syndicats(id) ON DELETE CASCADE,
  nom text NOT NULL,
  ordre integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE syndic_participants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_syndic_participants" ON syndic_participants FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "insert_syndic_participants" ON syndic_participants FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "update_syndic_participants" ON syndic_participants FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "delete_syndic_participants" ON syndic_participants FOR DELETE TO anon, authenticated USING (true);

-- Grilles d'un syndicat
CREATE TABLE IF NOT EXISTS syndic_grilles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  syndicat_id uuid NOT NULL REFERENCES syndicats(id) ON DELETE CASCADE,
  numeros integer[] NOT NULL,
  numero_chance integer NOT NULL,
  ordre integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE syndic_grilles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_syndic_grilles" ON syndic_grilles FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "insert_syndic_grilles" ON syndic_grilles FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "update_syndic_grilles" ON syndic_grilles FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "delete_syndic_grilles" ON syndic_grilles FOR DELETE TO anon, authenticated USING (true);

-- Paiements d'un syndicat
CREATE TABLE IF NOT EXISTS syndic_paiements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  syndicat_id uuid NOT NULL REFERENCES syndicats(id) ON DELETE CASCADE,
  montant numeric(10,2) NOT NULL,
  montant_par_personne numeric(10,2) NOT NULL,
  note text DEFAULT 'Distribution syndicat',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE syndic_paiements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_syndic_paiements" ON syndic_paiements FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "insert_syndic_paiements" ON syndic_paiements FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "update_syndic_paiements" ON syndic_paiements FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "delete_syndic_paiements" ON syndic_paiements FOR DELETE TO anon, authenticated USING (true);

-- Virements individuels d'un syndicat
CREATE TABLE IF NOT EXISTS syndic_virements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  syndicat_id uuid NOT NULL REFERENCES syndicats(id) ON DELETE CASCADE,
  participant_nom text NOT NULL,
  effectue boolean NOT NULL DEFAULT false,
  date_virement date,
  paiement_id uuid REFERENCES syndic_paiements(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE (paiement_id, participant_nom)
);

ALTER TABLE syndic_virements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_syndic_virements" ON syndic_virements FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "insert_syndic_virements" ON syndic_virements FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "update_syndic_virements" ON syndic_virements FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "delete_syndic_virements" ON syndic_virements FOR DELETE TO anon, authenticated USING (true);
