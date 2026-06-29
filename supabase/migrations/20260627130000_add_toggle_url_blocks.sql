-- Extend block_type to include 'toggle' and 'url'
ALTER TABLE marketing_content_blocks
  DROP CONSTRAINT IF EXISTS marketing_content_blocks_block_type_check;

ALTER TABLE marketing_content_blocks
  ADD CONSTRAINT marketing_content_blocks_block_type_check
  CHECK (block_type IN ('text', 'textarea', 'list', 'image', 'toggle', 'url'));

-- ── HOME PAGE ────────────────────────────────────────────────────────────────
-- Section visibility toggles
INSERT INTO marketing_content_blocks (page_id, block_key, block_type, label, value, sort_order) VALUES
  ('00000000-0000-0000-0001-000000000001', 'section.hero.visible',       'toggle', 'Show Hero Section',         'true', 50),
  ('00000000-0000-0000-0001-000000000001', 'section.how-it-works.visible','toggle', 'Show How It Works Section', 'true', 51),
  ('00000000-0000-0000-0001-000000000001', 'section.why.visible',         'toggle', 'Show Why Tasking Section',  'true', 52),
  ('00000000-0000-0000-0001-000000000001', 'section.products.visible',    'toggle', 'Show Products Section',     'true', 53),
  ('00000000-0000-0000-0001-000000000001', 'section.industries.visible',  'toggle', 'Show Industries Section',   'true', 54),
  ('00000000-0000-0000-0001-000000000001', 'section.cta.visible',         'toggle', 'Show CTA Section',          'true', 55)
ON CONFLICT (page_id, block_key) DO NOTHING;

-- CTA button
INSERT INTO marketing_content_blocks (page_id, block_key, block_type, label, value, sort_order) VALUES
  ('00000000-0000-0000-0001-000000000001', 'cta.button.label', 'text', 'CTA Button Label', 'Get Started Free', 60),
  ('00000000-0000-0000-0001-000000000001', 'cta.button.url',   'url',  'CTA Button URL',   '/get-started',     61)
ON CONFLICT (page_id, block_key) DO NOTHING;

-- ── PRODUCTS: AI FEATURES ────────────────────────────────────────────────────
INSERT INTO marketing_content_blocks (page_id, block_key, block_type, label, value, sort_order) VALUES
  ('00000000-0000-0000-0002-000000000001', 'cta.button.label', 'text', 'CTA Button Label', 'Get Started Free', 10),
  ('00000000-0000-0000-0002-000000000001', 'cta.button.url',   'url',  'CTA Button URL',   '/get-started',     11)
ON CONFLICT (page_id, block_key) DO NOTHING;

-- ── PRODUCTS: RECRUITMENT ────────────────────────────────────────────────────
INSERT INTO marketing_content_blocks (page_id, block_key, block_type, label, value, sort_order) VALUES
  ('00000000-0000-0000-0002-000000000002', 'cta.button.label', 'text', 'CTA Button Label', 'Get Started Free', 10),
  ('00000000-0000-0000-0002-000000000002', 'cta.button.url',   'url',  'CTA Button URL',   '/get-started',     11)
ON CONFLICT (page_id, block_key) DO NOTHING;

-- ── PRODUCTS: ATTENDANCE ─────────────────────────────────────────────────────
INSERT INTO marketing_content_blocks (page_id, block_key, block_type, label, value, sort_order) VALUES
  ('00000000-0000-0000-0002-000000000003', 'cta.button.label', 'text', 'CTA Button Label', 'Get Started Free', 10),
  ('00000000-0000-0000-0002-000000000003', 'cta.button.url',   'url',  'CTA Button URL',   '/get-started',     11)
ON CONFLICT (page_id, block_key) DO NOTHING;

-- ── PRODUCTS: TEAM MANAGEMENT ────────────────────────────────────────────────
INSERT INTO marketing_content_blocks (page_id, block_key, block_type, label, value, sort_order) VALUES
  ('00000000-0000-0000-0002-000000000004', 'cta.button.label', 'text', 'CTA Button Label', 'Get Started Free', 10),
  ('00000000-0000-0000-0002-000000000004', 'cta.button.url',   'url',  'CTA Button URL',   '/get-started',     11)
ON CONFLICT (page_id, block_key) DO NOTHING;

-- ── PRODUCTS: SMART NOTIFICATIONS ───────────────────────────────────────────
INSERT INTO marketing_content_blocks (page_id, block_key, block_type, label, value, sort_order) VALUES
  ('00000000-0000-0000-0002-000000000005', 'cta.button.label', 'text', 'CTA Button Label', 'Get Started Free', 10),
  ('00000000-0000-0000-0002-000000000005', 'cta.button.url',   'url',  'CTA Button URL',   '/get-started',     11)
ON CONFLICT (page_id, block_key) DO NOTHING;

-- ── PRICING ──────────────────────────────────────────────────────────────────
INSERT INTO marketing_content_blocks (page_id, block_key, block_type, label, value, sort_order) VALUES
  ('00000000-0000-0000-0001-000000000003', 'cta.button.label', 'text', 'CTA Button Label', 'Get Started Free', 10),
  ('00000000-0000-0000-0001-000000000003', 'cta.button.url',   'url',  'CTA Button URL',   '/get-started',     11)
ON CONFLICT (page_id, block_key) DO NOTHING;

-- ── PRODUCTS (parent) ────────────────────────────────────────────────────────
INSERT INTO marketing_content_blocks (page_id, block_key, block_type, label, value, sort_order) VALUES
  ('00000000-0000-0000-0001-000000000004', 'cta.button.label', 'text', 'CTA Button Label', 'Get Started Free', 10),
  ('00000000-0000-0000-0001-000000000004', 'cta.button.url',   'url',  'CTA Button URL',   '/get-started',     11)
ON CONFLICT (page_id, block_key) DO NOTHING;

-- ── INDUSTRIES ───────────────────────────────────────────────────────────────
INSERT INTO marketing_content_blocks (page_id, block_key, block_type, label, value, sort_order) VALUES
  ('00000000-0000-0000-0001-000000000005', 'cta.button.label', 'text', 'CTA Button Label', 'Get Started Free', 10),
  ('00000000-0000-0000-0001-000000000005', 'cta.button.url',   'url',  'CTA Button URL',   '/get-started',     11)
ON CONFLICT (page_id, block_key) DO NOTHING;
