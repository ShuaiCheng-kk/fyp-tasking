-- Seed modules section title and subtitle for the Products page
INSERT INTO marketing_content_blocks (page_id, block_key, block_type, label, value, sort_order) VALUES
  ('00000000-0000-0000-0001-000000000004', 'modules.title',    'text',     'Modules Section Title',    'Five modules. One workflow. Zero gaps.',                                                                                                        20),
  ('00000000-0000-0000-0001-000000000004', 'modules.subtitle', 'textarea', 'Modules Section Subtitle', 'Every module in Tasking is designed to work together — from the moment you post a job to the moment the shift ends.',                          21)
ON CONFLICT (page_id, block_key) DO NOTHING;
