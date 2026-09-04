import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripeClient } from "@/lib/stripe";

// profiles.stripe_subscription_id / hizzel_cancel_at_period_end aren't in
// the generated Database type yet — same cast pattern as every other
// hook/route in this codebase (see use-move-items.ts's in_tray comment).
// Delete this interface + the casts once types are regenerated.
interface ProfilesSubscriptionTable {
  from(table: "profiles"): {
    select(cols: "stripe_subscription_id"): {
      eq(
        col: "id",
        val: string,
      ): {
        maybeSingle(): Promise<
          | { data: { stripe_subscription_id: string | null }; error: null }
          | { data: null; error: { message: string } }
        >;
      };
    };
    update(values: { hizzel_cancel_at_period_end: boolean }): {
      eq(col: "id", val: string): Promise<{ error: { message: string } | null }>;
    };
  };
}

// Schedules the caller's Annual subscription to cancel at the end of the
// current period (never immediately — they've already paid for it). No
// confirmation dialog here; the client shows one before ever calling this,
// using hizzel_unlocked_until it already has to state the exact date.
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const { data: profile } = await (supabase as unknown as ProfilesSubscriptionTable)
    .from("profiles")
    .select("stripe_subscription_id")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile?.stripe_subscription_id) {
    return NextResponse.json({ error: "No active subscription to cancel" }, { status: 400 });
  }

  const stripe = getStripeClient();
  try {
    await stripe.subscriptions.update(profile.stripe_subscription_id, {
      cancel_at_period_end: true,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not cancel the subscription" },
      { status: 502 },
    );
  }

  // hizzel_cancel_at_period_end is one of the client-write-revoked billing
  // columns — only this server route (and the webhook, resetting it on a
  // fresh purchase) may set it, via the admin client which bypasses grants.
  const admin = createAdminClient() as unknown as ProfilesSubscriptionTable;
  await admin.from("profiles").update({ hizzel_cancel_at_period_end: true }).eq("id", user.id);

  return NextResponse.json({ ok: true });
}
