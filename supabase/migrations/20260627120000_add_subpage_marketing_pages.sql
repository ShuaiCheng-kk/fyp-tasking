-- Add sub-pages under Products and About to marketing_pages

-- Products: AI Features
INSERT INTO marketing_pages (id, slug, title, route_path, is_editable)
VALUES ('00000000-0000-0000-0002-000000000001', 'products-ai-features', 'AI Features', '/products/ai-features', TRUE)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO marketing_content_blocks (page_id, block_key, block_type, label, value, sort_order) VALUES
  ('00000000-0000-0000-0002-000000000001', 'hero.headline',    'text',     'Hero Headline',    'Enterprise-grade AI. Free for everyone.',                                                       1),
  ('00000000-0000-0000-0002-000000000001', 'hero.subheadline', 'textarea', 'Hero Subheadline', 'Four intelligent tools built into your workflow from day one — no upgrades, no paywalls, no excuses.', 2),
  ('00000000-0000-0000-0002-000000000001', 'cta.headline',     'text',     'CTA Headline',     'Ready to put AI to work?',                                                                      3),
  ('00000000-0000-0000-0002-000000000001', 'cta.subheadline',  'textarea', 'CTA Subheadline',  'All four AI features are free. No upgrade required.',                                           4)
ON CONFLICT (page_id, block_key) DO NOTHING;

-- Products: Recruitment
INSERT INTO marketing_pages (id, slug, title, route_path, is_editable)
VALUES ('00000000-0000-0000-0002-000000000002', 'products-recruitment', 'Recruitment', '/products/recruitment', TRUE)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO marketing_content_blocks (page_id, block_key, block_type, label, value, sort_order) VALUES
  ('00000000-0000-0000-0002-000000000002', 'hero.headline',    'text',     'Hero Headline',    'Find the right people. Fast.',                                                                  1),
  ('00000000-0000-0000-0002-000000000002', 'hero.subheadline', 'textarea', 'Hero Subheadline', 'From job posting to confirmed hire — without the back-and-forth.',                             2),
  ('00000000-0000-0000-0002-000000000002', 'cta.headline',     'text',     'CTA Headline',     'Your next hire is one post away.',                                                              3),
  ('00000000-0000-0000-0002-000000000002', 'cta.subheadline',  'textarea', 'CTA Subheadline',  'Join SMEs already using Tasking to fill shifts faster and smarter.',                           4)
ON CONFLICT (page_id, block_key) DO NOTHING;

-- Products: Attendance
INSERT INTO marketing_pages (id, slug, title, route_path, is_editable)
VALUES ('00000000-0000-0000-0002-000000000003', 'products-attendance', 'Attendance', '/products/attendance', TRUE)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO marketing_content_blocks (page_id, block_key, block_type, label, value, sort_order) VALUES
  ('00000000-0000-0000-0002-000000000003', 'hero.headline',    'text',     'Hero Headline',    'Every clock-in. Verified. Every record. Protected.',                                            1),
  ('00000000-0000-0000-0002-000000000003', 'hero.subheadline', 'textarea', 'Hero Subheadline', 'Accurate attendance tracking with AI built in — so nothing slips through the cracks.',        2),
  ('00000000-0000-0000-0002-000000000003', 'cta.headline',     'text',     'CTA Headline',     'No more disputed timesheets.',                                                                  3),
  ('00000000-0000-0000-0002-000000000003', 'cta.subheadline',  'textarea', 'CTA Subheadline',  'Photo-verified, AI-assisted, and fully auditable — from the first clock-in.',                  4)
ON CONFLICT (page_id, block_key) DO NOTHING;

-- Products: Team Management
INSERT INTO marketing_pages (id, slug, title, route_path, is_editable)
VALUES ('00000000-0000-0000-0002-000000000004', 'products-team-management', 'Team Management', '/products/team-management', TRUE)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO marketing_content_blocks (page_id, block_key, block_type, label, value, sort_order) VALUES
  ('00000000-0000-0000-0002-000000000004', 'hero.headline',    'text',     'Hero Headline',    'Your company structure, exactly how you need it.',                                              1),
  ('00000000-0000-0000-0002-000000000004', 'hero.subheadline', 'textarea', 'Hero Subheadline', 'Full control from the top. Focused access for everyone else.',                                 2),
  ('00000000-0000-0000-0002-000000000004', 'cta.headline',     'text',     'CTA Headline',     'Get your team set up in minutes.',                                                              3),
  ('00000000-0000-0000-0002-000000000004', 'cta.subheadline',  'textarea', 'CTA Subheadline',  'No IT team. No training programme. Just a clean system your whole organisation can use from day one.', 4)
ON CONFLICT (page_id, block_key) DO NOTHING;

-- Products: Smart Notifications
INSERT INTO marketing_pages (id, slug, title, route_path, is_editable)
VALUES ('00000000-0000-0000-0002-000000000005', 'products-smart-notifications', 'Smart Notifications', '/products/smart-notifications', TRUE)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO marketing_content_blocks (page_id, block_key, block_type, label, value, sort_order) VALUES
  ('00000000-0000-0000-0002-000000000005', 'hero.headline',    'text',     'Hero Headline',    'No more chasing people for updates.',                                                           1),
  ('00000000-0000-0000-0002-000000000005', 'hero.subheadline', 'textarea', 'Hero Subheadline', 'Tasking handles the follow-ups. You handle the business.',                                     2),
  ('00000000-0000-0000-0002-000000000005', 'cta.headline',     'text',     'CTA Headline',     'Stay in the loop. Automatically.',                                                              3),
  ('00000000-0000-0000-0002-000000000005', 'cta.subheadline',  'textarea', 'CTA Subheadline',  'Every key moment in your workflow, covered — without you lifting a finger.',                   4)
ON CONFLICT (page_id, block_key) DO NOTHING;

-- About: Mission
INSERT INTO marketing_pages (id, slug, title, route_path, is_editable)
VALUES ('00000000-0000-0000-0002-000000000006', 'about-mission', 'Mission', '/about/mission', TRUE)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO marketing_content_blocks (page_id, block_key, block_type, label, value, sort_order) VALUES
  ('00000000-0000-0000-0002-000000000006', 'hero.headline',    'text',     'Hero Headline',    'We built Tasking because SMEs deserve better.',                                                 1),
  ('00000000-0000-0000-0002-000000000006', 'hero.subheadline', 'textarea', 'Hero Subheadline', 'Not a watered-down version of enterprise software. Not another spreadsheet wrapper. A platform built from scratch for the way SMEs actually operate.', 2)
ON CONFLICT (page_id, block_key) DO NOTHING;

-- About: Problem & Solution
INSERT INTO marketing_pages (id, slug, title, route_path, is_editable)
VALUES ('00000000-0000-0000-0002-000000000007', 'about-problem-solution', 'Problem & Solution', '/about/problem-solution', TRUE)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO marketing_content_blocks (page_id, block_key, block_type, label, value, sort_order) VALUES
  ('00000000-0000-0000-0002-000000000007', 'hero.headline',    'text',     'Hero Headline',    'The problem is real. The fixes are already built.',                                             1),
  ('00000000-0000-0000-0002-000000000007', 'hero.subheadline', 'textarea', 'Hero Subheadline', 'Here''s an honest breakdown of what''s broken in casual workforce management, where existing tools fall short, and exactly how Tasking addresses it.', 2)
ON CONFLICT (page_id, block_key) DO NOTHING;

-- About: Team
INSERT INTO marketing_pages (id, slug, title, route_path, is_editable)
VALUES ('00000000-0000-0000-0002-000000000008', 'about-team', 'Team', '/about/team', TRUE)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO marketing_content_blocks (page_id, block_key, block_type, label, value, sort_order) VALUES
  ('00000000-0000-0000-0002-000000000008', 'hero.headline',    'text',     'Hero Headline',    'The people behind Tasking.',                                                                    1),
  ('00000000-0000-0000-0002-000000000008', 'hero.subheadline', 'textarea', 'Hero Subheadline', 'A multidisciplinary team of six — covering design, frontend, backend, full-stack, and project management — working together to make casual workforce management genuinely simple.', 2)
ON CONFLICT (page_id, block_key) DO NOTHING;

-- About: FAQ
INSERT INTO marketing_pages (id, slug, title, route_path, is_editable)
VALUES ('00000000-0000-0000-0002-000000000009', 'about-faq', 'FAQ', '/about/faq', TRUE)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO marketing_content_blocks (page_id, block_key, block_type, label, value, sort_order) VALUES
  ('00000000-0000-0000-0002-000000000009', 'hero.headline',    'text',     'Hero Headline',    'Questions we get all the time.',                                                                1),
  ('00000000-0000-0000-0002-000000000009', 'hero.subheadline', 'textarea', 'Hero Subheadline', 'Honest answers about how Tasking works, what''s free, and what to expect.',                   2)
ON CONFLICT (page_id, block_key) DO NOTHING;
