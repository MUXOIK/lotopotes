CREATE TABLE IF NOT EXISTS loto_all_tirages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  date_tirage DATE NOT NULL UNIQUE,
  tirage_data JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE loto_all_tirages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_loto_all_tirages" ON loto_all_tirages FOR SELECT
  TO anon, authenticated USING (true);

CREATE POLICY "insert_loto_all_tirages" ON loto_all_tirages FOR INSERT
  TO service_role WITH CHECK (true);

CREATE POLICY "update_loto_all_tirages" ON loto_all_tirages FOR UPDATE
  TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "delete_loto_all_tirages" ON loto_all_tirages FOR DELETE
  TO service_role USING (true);

-- Seed from existing loto_historique (all winning draws so far)
INSERT INTO loto_all_tirages (date_tirage, tirage_data)
SELECT date_tirage, tirage_data FROM loto_historique
ON CONFLICT (date_tirage) DO NOTHING;
