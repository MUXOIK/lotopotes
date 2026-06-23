
-- Loto cache (single row, id always = 1)
CREATE TABLE IF NOT EXISTS loto_cache (
  id INTEGER PRIMARY KEY DEFAULT 1,
  tirage_data JSONB,
  cache_expiry TIMESTAMPTZ,
  nombre_tirages INTEGER NOT NULL DEFAULT 9
);

-- Initialize with one row
INSERT INTO loto_cache (id, nombre_tirages)
VALUES (1, 9)
ON CONFLICT (id) DO NOTHING;

-- Enable RLS
ALTER TABLE loto_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "loto_cache_select_anon" ON loto_cache FOR SELECT TO anon USING (true);
CREATE POLICY "loto_cache_select_auth" ON loto_cache FOR SELECT TO authenticated USING (true);
CREATE POLICY "loto_cache_all_service" ON loto_cache FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Loto historique (one row per winning draw date)
CREATE TABLE IF NOT EXISTS loto_historique (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date_tirage DATE NOT NULL,
  tirage_data JSONB NOT NULL,
  gain_total NUMERIC(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(date_tirage)
);

ALTER TABLE loto_historique ENABLE ROW LEVEL SECURITY;

CREATE POLICY "loto_historique_select_anon" ON loto_historique FOR SELECT TO anon USING (true);
CREATE POLICY "loto_historique_select_auth" ON loto_historique FOR SELECT TO authenticated USING (true);
CREATE POLICY "loto_historique_all_service" ON loto_historique FOR ALL TO service_role USING (true) WITH CHECK (true);
