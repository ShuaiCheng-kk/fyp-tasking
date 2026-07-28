-- requires_owner_review: only write site is the auto-approval rule-escalation branch, which
-- always also sets owner_review_reason in the same call. Never read anywhere — every consumer
-- (SwapRequestsPanel, MyRequestsPanel, ownerDashboardService) already keys off owner_review_reason
-- being non-null instead. Pure redundant flag.
alter table public.shift_swap_requests drop column requires_owner_review;
