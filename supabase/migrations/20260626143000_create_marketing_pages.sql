-- Create marketing_pages table
CREATE TABLE IF NOT EXISTS marketing_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  route_path TEXT NOT NULL,
  is_editable BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create marketing_content_blocks table
CREATE TABLE IF NOT EXISTS marketing_content_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id UUID NOT NULL REFERENCES marketing_pages(id) ON DELETE CASCADE,
  block_key TEXT NOT NULL,
  block_type TEXT NOT NULL CHECK (block_type IN ('text', 'textarea', 'list')),
  label TEXT NOT NULL,
  value TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(page_id, block_key)
);

-- Seed: Home page
INSERT INTO marketing_pages (id, slug, title, route_path, is_editable)
VALUES ('00000000-0000-0000-0001-000000000001', 'home', 'Home', '/', TRUE);

INSERT INTO marketing_content_blocks (page_id, block_key, block_type, label, value, sort_order) VALUES
  ('00000000-0000-0000-0001-000000000001', 'hero.badge',              'text',     'Hero Badge',                    'Built for SMEs',                                                                                                                                   1),
  ('00000000-0000-0000-0001-000000000001', 'hero.headline.line1',     'text',     'Hero Headline Line 1',          'Hire. Schedule. Track.',                                                                                                                            2),
  ('00000000-0000-0000-0001-000000000001', 'hero.headline.line2',     'text',     'Hero Headline Line 2',          'All in One Place.',                                                                                                                                 3),
  ('00000000-0000-0000-0001-000000000001', 'hero.subheadline',        'textarea', 'Hero Subheadline',              'Tasking is the all-in-one casual workforce management platform that helps SMEs hire, schedule, and track their teams without the complexity.',       4),
  ('00000000-0000-0000-0001-000000000001', 'why.title',               'text',     'Why Section Title',             'Why SMEs Choose Tasking',                                                                                                                           5),
  ('00000000-0000-0000-0001-000000000001', 'why.card.simple.title',   'text',     'Why Card 1 Title',              'Simple Enough for Anyone',                                                                                                                          6),
  ('00000000-0000-0000-0001-000000000001', 'why.card.simple.desc',    'textarea', 'Why Card 1 Description',        'Designed for SME owners who need results without a learning curve. No technical knowledge needed - just set up and go.',                            7),
  ('00000000-0000-0000-0001-000000000001', 'why.card.control.title',  'text',     'Why Card 2 Title',              'Full Control, Department by Department',                                                                                                             8),
  ('00000000-0000-0000-0001-000000000001', 'why.card.control.desc',   'textarea', 'Why Card 2 Description',        'Managers handle their own recruitment and scheduling while owners keep full visibility across all departments.',                                     9),
  ('00000000-0000-0000-0001-000000000001', 'why.card.ai.title',       'text',     'Why Card 3 Title',              'Enterprise AI - Free for Everyone',                                                                                                                 10),
  ('00000000-0000-0000-0001-000000000001', 'why.card.ai.desc',        'textarea', 'Why Card 3 Description',        'AI-powered job description generation, candidate recommendations, and anomaly detection are included in the free plan.',                            11),
  ('00000000-0000-0000-0001-000000000001', 'why.card.casual.title',   'text',     'Why Card 4 Title',              'Built for Casual Workforce Realities',                                                                                                              12),
  ('00000000-0000-0000-0001-000000000001', 'why.card.casual.desc',    'textarea', 'Why Card 4 Description',        'Photo-based clock-in verification, digital attendance records, and automated workflows are built for flexible workers.',                            13),
  ('00000000-0000-0000-0001-000000000001', 'products.title',          'text',     'Products Section Title',        'Everything You Need, In One Platform',                                                                                                              14),
  ('00000000-0000-0000-0001-000000000001', 'industries.title',        'text',     'Industries Section Title',      'Built for the Industries That Run on Casual Workers',                                                                                               15),
  ('00000000-0000-0000-0001-000000000001', 'cta.headline',            'text',     'CTA Headline',                  'Ready to simplify your workforce?',                                                                                                                 16),
  ('00000000-0000-0000-0001-000000000001', 'cta.subheadline',         'textarea', 'CTA Subheadline',               'Join SMEs already using Tasking to hire smarter, schedule faster, and track with confidence.',                                                     17);

-- Seed: About page
INSERT INTO marketing_pages (id, slug, title, route_path, is_editable)
VALUES ('00000000-0000-0000-0001-000000000002', 'about', 'About', '/about', TRUE);

INSERT INTO marketing_content_blocks (page_id, block_key, block_type, label, value, sort_order) VALUES
  ('00000000-0000-0000-0001-000000000002', 'hero.headline',    'text',     'Hero Headline',    'Built by people who''ve seen the chaos firsthand.',                                                                                                 1),
  ('00000000-0000-0000-0001-000000000002', 'hero.subheadline', 'textarea', 'Hero Subheadline', 'Tasking was born out of a simple frustration - watching SMEs struggle with casual workforce management using tools that were never built for them.', 2);

-- Seed: Pricing page
INSERT INTO marketing_pages (id, slug, title, route_path, is_editable)
VALUES ('00000000-0000-0000-0001-000000000003', 'pricing', 'Pricing', '/pricing', TRUE);

INSERT INTO marketing_content_blocks (page_id, block_key, block_type, label, value, sort_order) VALUES
  ('00000000-0000-0000-0001-000000000003', 'hero.headline',    'text',     'Hero Headline',    'Simple, Transparent Pricing',                                                  1),
  ('00000000-0000-0000-0001-000000000003', 'hero.subheadline', 'textarea', 'Hero Subheadline', 'Start free. Upgrade when you''re ready. No hidden fees, no surprises.',        2),
  ('00000000-0000-0000-0001-000000000003', 'cta.headline',     'text',     'CTA Headline',     'Start for free today',                                                         3),
  ('00000000-0000-0000-0001-000000000003', 'cta.subheadline',  'textarea', 'CTA Subheadline',  'No credit card required. Set up your team in minutes.',                        4);

-- Seed: Products page
INSERT INTO marketing_pages (id, slug, title, route_path, is_editable)
VALUES ('00000000-0000-0000-0001-000000000004', 'products', 'Products', '/products', TRUE);

INSERT INTO marketing_content_blocks (page_id, block_key, block_type, label, value, sort_order) VALUES
  ('00000000-0000-0000-0001-000000000004', 'hero.headline',    'text',     'Hero Headline',    'Every Tool Your Team Needs',                                                                                        1),
  ('00000000-0000-0000-0001-000000000004', 'hero.subheadline', 'textarea', 'Hero Subheadline', 'From hiring to scheduling to attendance — Tasking covers the full casual workforce lifecycle in one platform.',    2),
  ('00000000-0000-0000-0001-000000000004', 'intro.title',      'text',     'Intro Title',      'Built for Real SME Workflows',                                                                                      3),
  ('00000000-0000-0000-0001-000000000004', 'intro.body',       'textarea', 'Intro Body',       'Each module is designed to work standalone or as part of the full suite, giving you flexibility as you scale.',   4),
  ('00000000-0000-0000-0001-000000000004', 'cta.headline',     'text',     'CTA Headline',     'See Tasking in action',                                                                                             5),
  ('00000000-0000-0000-0001-000000000004', 'cta.subheadline',  'textarea', 'CTA Subheadline',  'Get started free and explore every feature your team needs.',                                                      6);

-- Seed: Industries page
INSERT INTO marketing_pages (id, slug, title, route_path, is_editable)
VALUES ('00000000-0000-0000-0001-000000000005', 'industries', 'Industries', '/industries', TRUE);

INSERT INTO marketing_content_blocks (page_id, block_key, block_type, label, value, sort_order) VALUES
  ('00000000-0000-0000-0001-000000000005', 'hero.headline',    'text',     'Hero Headline',    'Built for the Industries That Rely on Casual Workers',                                                         1),
  ('00000000-0000-0000-0001-000000000005', 'hero.subheadline', 'textarea', 'Hero Subheadline', 'Hospitality, retail, events, construction — Tasking adapts to the unique demands of your industry.',          2),
  ('00000000-0000-0000-0001-000000000005', 'intro.title',      'text',     'Intro Title',      'Your Industry, Your Workflow',                                                                                  3),
  ('00000000-0000-0000-0001-000000000005', 'intro.body',       'textarea', 'Intro Body',       'Whether you run a café, a retail chain, or a construction firm, Tasking gives you the tools to manage your casual workforce with confidence.', 4),
  ('00000000-0000-0000-0001-000000000005', 'cta.headline',     'text',     'CTA Headline',     'Find your industry fit',                                                                                        5),
  ('00000000-0000-0000-0001-000000000005', 'cta.subheadline',  'textarea', 'CTA Subheadline',  'Join SMEs across industries already simplifying their casual workforce management with Tasking.',              6);
