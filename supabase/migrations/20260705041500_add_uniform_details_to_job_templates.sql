-- Free-text detail shown alongside Uniform Required when set to Yes (e.g. "Black polo + apron").
alter table public.job_templates
  add column if not exists uniform_details text;
