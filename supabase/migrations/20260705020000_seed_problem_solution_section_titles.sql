-- Seed section title blocks for the Problem & Solution page
-- Page ID: 00000000-0000-0000-0002-000000000007
INSERT INTO marketing_content_blocks (page_id, block_key, block_type, label, value, sort_order) VALUES
  ('00000000-0000-0000-0002-000000000007', 'problems.title',    'text',     'Problems Section Title',    'What SMEs are dealing with every day',                                             10),
  ('00000000-0000-0000-0002-000000000007', 'problems.subtitle', 'textarea', 'Problems Section Subtitle', '',                                                                                11),
  ('00000000-0000-0000-0002-000000000007', 'gaps.title',        'text',     'Market Gaps Section Title',    'Existing tools weren''t built for this',                                       20),
  ('00000000-0000-0000-0002-000000000007', 'gaps.subtitle',     'textarea', 'Market Gaps Section Subtitle', 'Seven specific gaps in the tools SMEs are currently using — and paying for.', 21)
ON CONFLICT (page_id, block_key) DO NOTHING;
