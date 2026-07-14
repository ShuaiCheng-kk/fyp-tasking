-- Reverts 20260714144600. The "offer to the pool first, publish to the board later" split added a
-- second visibility axis to every posting, which turned out not to be worth the surface area: every
-- job simply goes on the public board as before. Hand-offering a job to workers who already worked
-- for the company stays — it's just an extra invite path (recruitmentService.invitePoolWorkers) on
-- a normal posting, not a separate kind of posting.
alter table public.job_postings
  drop column if exists is_pool_only;
