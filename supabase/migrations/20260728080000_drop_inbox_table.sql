-- The `inbox` table existed for exactly one flow: notifying an existing user (already a member of
-- a DIFFERENT company) that another company invited them, so they could accept/decline joining a
-- second company. Multi-company / cross-company membership was confirmed out of scope on
-- 2026-07-16 (see project memory) -- the Communication page's Invites tab was already hidden from
-- the UI, and this table had exactly one write site in the whole codebase
-- (invitationRepository.insertInboxInvite). Dropping it now; all supporting code (routes,
-- repository/service methods, the CommunicationView invites tab, the backfill script) is removed
-- in the same change. No other table has a FK pointing at `inbox` (confirmed before writing this).

drop table if exists public.inbox;
