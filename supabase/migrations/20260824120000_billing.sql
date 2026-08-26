-- Billing: Hizzel spatial features (rooms, floor plans, item placement) are
-- gated behind a purchase. Single source of truth for the gate everywhere in
-- the app is hizzel_unlocked_until — null or in the past = locked, in the
-- future = unlocked. Both products just set/extend this one timestamp: the
-- one-time 90-day Move Pass sets it once at purchase time and never touches
-- it again; the Annual subscription sets/extends it to Stripe's current
-- period end on every successful payment (initial + each renewal). No
-- separate expiry cron/background job is needed — a cancelled or
-- failed-to-renew subscription simply stops getting extended, so the stored
-- timestamp naturally lapses and every gating check locks itself out
-- automatically. See src/hooks/use-billing-status.ts for the read side and
-- src/app/api/stripe/webhook/route.ts for the only writer.

create type hizzel_product as enum ('pass', 'annual');

alter table profiles
  add column hizzel_unlocked_until timestamptz,
  add column hizzel_product hizzel_product;

-- SECURITY FIX: the existing "profiles: update own" policy
--   for update using (id = auth.uid())
-- has no WITH CHECK clause. An UPDATE policy without WITH CHECK reuses the
-- USING expression for both — which only constrains which ROW can be
-- touched (must be your own id), never which COLUMNS. Combined with
-- Supabase's default blanket UPDATE grant to the authenticated role, this
-- means any signed-in client could currently run:
--   supabase.from('profiles').update({ plan_tier: 'paid', hizzel_unlocked_until: '2099-01-01' }).eq('id', user.id)
-- and it would succeed. These columns were inert (unused) before this
-- phase, so this was latent rather than exploited — but activating real
-- billing makes it live-exploitable. Fixed with a column-level REVOKE
-- rather than touching the policy itself, so `onboarded` (legitimately
-- written by the client from /welcome) and any future client-writable
-- column keep working unaffected.
revoke update (
  plan_tier,
  stripe_customer_id,
  stripe_subscription_id,
  hizzel_unlocked_until,
  hizzel_product
) on profiles from authenticated;
