-- Ensure home page industry card name blocks exist (safe if already present from admin UI)
INSERT INTO marketing_content_blocks (page_id, block_key, block_type, label, value, sort_order) VALUES
  ('00000000-0000-0000-0001-000000000001', 'industries.card.retail',    'text', 'Industry Card: Retail',    'Retail',           91),
  ('00000000-0000-0000-0001-000000000001', 'industries.card.food',      'text', 'Industry Card: Food',      'Food & Beverage',  92),
  ('00000000-0000-0000-0001-000000000001', 'industries.card.logistics', 'text', 'Industry Card: Logistics', 'Logistics',        93),
  ('00000000-0000-0000-0001-000000000001', 'industries.card.events',    'text', 'Industry Card: Events',    'Event Management', 94)
ON CONFLICT (page_id, block_key) DO NOTHING;

-- Seed default icons for the 4 home page industry cards
INSERT INTO marketing_content_blocks (page_id, block_key, block_type, label, value, sort_order) VALUES
  ('00000000-0000-0000-0001-000000000001', 'industries.card.retail.icon',    'text', 'Industry Card Icon: Retail',    'store',          95),
  ('00000000-0000-0000-0001-000000000001', 'industries.card.food.icon',      'text', 'Industry Card Icon: Food',      'utensils',       96),
  ('00000000-0000-0000-0001-000000000001', 'industries.card.logistics.icon', 'text', 'Industry Card Icon: Logistics', 'map-pin',        97),
  ('00000000-0000-0000-0001-000000000001', 'industries.card.events.icon',    'text', 'Industry Card Icon: Events',    'calendar-check', 98)
ON CONFLICT (page_id, block_key) DO NOTHING;
