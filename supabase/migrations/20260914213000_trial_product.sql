-- Promotional "7-Day Free Trial" tier (paywall-sheet.tsx) — a genuinely
-- separate one-time Stripe product/price at £0, going through the same
-- checkout.session.completed webhook path as Pass/Annual, just unlocking
-- 7 days instead of 90/365. See src/app/api/stripe/webhook/route.ts.

alter type hizzel_product add value 'trial';

-- hizzel_product gets overwritten on every purchase (a later real Pass
-- purchase would replace 'trial' with 'pass'), so it can't answer "has
-- this account ever had a trial" once they've converted — a separate,
-- never-reset flag is needed for the one-trial-per-account guard in
-- checkout/route.ts.
alter table profiles
  add column trial_used boolean not null default false;

-- Same reasoning as the original billing migration's REVOKE (see
-- 20260824120000_billing.sql) — only the webhook's admin client should
-- ever set this, never the client directly (which could otherwise reset
-- its own trial eligibility).
revoke update (trial_used) on profiles from authenticated;
