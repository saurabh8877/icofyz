CREATE TABLE IF NOT EXISTS admins (
  id BIGSERIAL PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS content_items (
  id UUID PRIMARY KEY,
  collection TEXT NOT NULL CHECK (collection IN ('products','categories','brands','banners')),
  data JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS content_items_collection_idx ON content_items(collection);
CREATE TABLE IF NOT EXISTS site_settings (
  id BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (id = TRUE),
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
INSERT INTO site_settings(id,data) VALUES(TRUE, '{
 "heroTitle":"Wholesale, reimagined.",
 "heroSubtitle":"Discover independent brands and products made for your business.",
 "heroImage":"",
 "logoImage":"/logo.png",
 "announcement":"Discover something new at iCoFyz",
 "navigation":[{"label":"Home","url":"/"},{"label":"Shop","url":"/#products"},{"label":"Categories","url":"/#categories"},{"label":"Brands","url":"/#brands"}],
 "promoBanners":[],
 "footerText":"A wholesale marketplace connecting independent brands and retailers.",
 "footerLinks":[{"label":"About us","url":"#"},{"label":"Contact","url":"#"},{"label":"Privacy","url":"#"}]
}'::jsonb) ON CONFLICT(id) DO NOTHING;
