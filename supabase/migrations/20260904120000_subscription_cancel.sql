-- Lets the in-app "Unsubscribe" button (my-hizzel-overlay.tsx) show a
-- correct button state after a customer has already scheduled their Annual
-- subscription to cancel at period end -- without this, hizzel_unlocked_until
-- alone can't distinguish "renewing normally" from "already cancelled but
-- still inside the paid-up period" (the natural-lapse design makes both look
-- identical until the date actually passes). Once true, the Subscription
-- button offers Pass/Annual again (as if starting fresh) rather than another
-- "Unsubscribe", since the customer might change their mind and re-buy
-- before the period even ends.
alter table profiles
  add column hizzel_cancel_at_period_end boolean not null default false;

-- Same security reasoning as the original billing migration's revoke: only
-- the server (the new /api/stripe/subscription/cancel route, and the
-- webhook resetting it on a fresh purchase) should ever set this, via the
-- admin client which bypasses grants entirely.
revoke update (hizzel_cancel_at_period_end) on profiles from authenticated;
