-- "Offer to the worker pool first": a posting the Owner hand-offers to Casual Workers who have
-- already worked for this company (verified pool) instead of putting it on the public job board.
-- status stays 'open' so the whole invitation -> confirm -> FCFS -> shift chain works unchanged;
-- only public board visibility is gated. The Owner can publish it to the board at any time by
-- flipping this back to false (e.g. when the pool doesn't take all the openings).
alter table public.job_postings
  add column is_pool_only boolean not null default false;

create index if not exists idx_job_postings_is_pool_only on public.job_postings(is_pool_only);
