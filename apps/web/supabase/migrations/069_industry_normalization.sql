-- 069: Industry normalization — make the 2026-07-21 taxonomy clean stick.
--
-- The deep clean consolidated 105 free-text alumni.industry values into 17
-- canonical categories. Enrichment (Apollo, LinkedIn scrapes) writes via the
-- service key and bypasses app code, so normalization must live in the
-- database: a lookup table (mirroring sport_normalization) plus a BEFORE
-- trigger on alumni that canonicalizes industry on every insert/update.
-- Unknown values pass through untouched — the trigger never destroys
-- information, it only folds known aliases.

CREATE TABLE IF NOT EXISTS public.industry_normalization (
  canonical_name text PRIMARY KEY,
  aliases        text[] NOT NULL DEFAULT '{}',
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_industry_normalization_aliases
  ON public.industry_normalization USING gin (aliases);

ALTER TABLE public.industry_normalization ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can read industry normalization" ON public.industry_normalization;
CREATE POLICY "Anyone can read industry normalization"
  ON public.industry_normalization FOR SELECT TO authenticated USING (true);

-- Seed: the exact mapping applied in the 2026-07-21 clean. Aliases are stored
-- lowercase; matching is case-insensitive on both alias and canonical name.
INSERT INTO public.industry_normalization (canonical_name, aliases) VALUES
  ('Finance', ARRAY['financial services','investment management','investment banking','banking','insurance','venture capital & private equity','capital markets','accounting','fintech','financial planning']),
  ('Technology', ARRAY['information technology & services','computer software','semiconductors','computer & network security','internet','information services','telecommunications','information technology','software']),
  ('Healthcare', ARRAY['hospital & health care','medical practice','health, wellness & fitness','mental health care','medical devices','pharmaceuticals','biotechnology','veterinary','health care']),
  ('Education', ARRAY['higher education','primary/secondary education','education management','e-learning','research']),
  ('Consulting', ARRAY['management consulting','professional training & coaching','human resources','staffing & recruiting']),
  ('Law', ARRAY['law practice','legal services']),
  ('Media & Marketing', ARRAY['media','entertainment','media production','publishing','design','music','fine art','marketing & advertising','marketing and advertising','public relations & communications']),
  ('Real Estate & Construction', ARRAY['real estate','construction','civil engineering','architecture & planning','building materials','facilities services']),
  ('Sports', ARRAY['sporting goods','recreational facilities & services']),
  ('Government & Public Sector', ARRAY['government','government administration','military','government relations','public policy','law enforcement','legislative office','public safety','political organization','international affairs','international trade & development']),
  ('Nonprofit', ARRAY['nonprofit organization management','civic & social organization','individual & family services','museums & institutions','philanthropy']),
  ('Manufacturing & Industrial', ARRAY['manufacturing','machinery','electrical/electronic manufacturing','mechanical or industrial engineering','automotive','chemicals','mining & metals','aviation & aerospace','defense & space','shipbuilding','packaging & containers','printing','furniture']),
  ('Energy & Environment', ARRAY['oil & energy','utilities','renewables & environment','environmental services']),
  ('Retail & Consumer', ARRAY['retail','apparel & fashion','cosmetics','wholesale','consumer goods']),
  ('Food & Agriculture', ARRAY['food production','food & beverages','dairy','wine & spirits','farming','agriculture']),
  ('Hospitality & Travel', ARRAY['hospitality','restaurants','leisure, travel & tourism','airlines/aviation']),
  ('Transportation & Logistics', ARRAY['transportation/trucking/railroad','logistics & supply chain'])
ON CONFLICT (canonical_name) DO UPDATE
  SET aliases = EXCLUDED.aliases, updated_at = now();

-- Trigger: fold known variants into canon on every write. SECURITY of the
-- lookup: exact canonical (case-insensitive) first, then alias membership.
CREATE OR REPLACE FUNCTION public.normalize_alumni_industry()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  canon text;
BEGIN
  IF NEW.industry IS NULL OR btrim(NEW.industry) = '' THEN
    NEW.industry := NULL;
    RETURN NEW;
  END IF;

  SELECT canonical_name INTO canon
  FROM public.industry_normalization
  WHERE lower(canonical_name) = lower(btrim(NEW.industry))
     OR lower(btrim(NEW.industry)) = ANY (aliases)
  LIMIT 1;

  IF canon IS NOT NULL THEN
    NEW.industry := canon;
  END IF;
  -- Unknown values pass through unchanged; they surface in audits rather
  -- than being silently destroyed.
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_normalize_alumni_industry ON public.alumni;
CREATE TRIGGER trg_normalize_alumni_industry
  BEFORE INSERT OR UPDATE OF industry ON public.alumni
  FOR EACH ROW
  EXECUTE FUNCTION public.normalize_alumni_industry();
