import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getStripeClient } from "@/lib/stripe";

const PRICE_IDS: Record<"trial" | "pass" | "annual", string | undefined> = {
  trial: process.env.STRIPE_PRICE_TRIAL_ID,
  pass: process.env.STRIPE_PRICE_PASS_ID,
  annual: process.env.STRIPE_PRICE_ANNUAL_ID,
};

// profiles.stripe_customer_id isn't in the generated Database type yet —
// same cast pattern as every other hook/route in this codebase reading a
// column from a migration that hasn't been regenerated into types.ts (see
// src/hooks/use-move-items.ts's in_tray comment for the full reasoning).
// Delete this interface + cast once the billing migration's applied and
// types are regenerated.
interface ProfilesStripeIdTable {
  from(table: "profiles"): {
    select(cols: "stripe_customer_id, trial_used"): {
      eq(
        col: "id",
        val: string,
      ): {
        maybeSingle(): Promise<
          | { data: { stripe_customer_id: string | null; trial_used: boolean }; error: null }
          | { data: null; error: { message: string } }
        >;
      };
    };
  };
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const requestedProduct: unknown = body?.product;
  if (requestedProduct !== "trial" && requestedProduct !== "pass" && requestedProduct !== "annual") {
    return NextResponse.json({ error: "Invalid product" }, { status: 400 });
  }
  const product: "trial" | "pass" | "annual" = requestedProduct;

  const priceId = PRICE_IDS[product];
  if (!priceId) {
    return NextResponse.json({ error: "Billing is not configured" }, { status: 500 });
  }

  // Reuse an existing Stripe Customer if this user already has one, so a
  // repeat purchase (renewing a lapsed Pass, or Pass -> Annual) doesn't
  // accumulate duplicate Customers.
  const { data: profile } = await (supabase as unknown as ProfilesStripeIdTable)
    .from("profiles")
    .select("stripe_customer_id, trial_used")
    .eq("id", user.id)
    .maybeSingle();
  const existingCustomerId = profile?.stripe_customer_id ?? undefined;

  // One trial per account, ever — trial_used is never reset by a later
  // real purchase (unlike hizzel_product, which gets overwritten), so
  // this stays a reliable "have they ever had one" check even after they
  // convert to a paid Pass/Annual.
  if (product === "trial" && profile?.trial_used) {
    return NextResponse.json({ error: "You've already used your free trial" }, { status: 400 });
  }

  const origin = request.headers.get("origin") ?? new URL(request.url).origin;
  const stripe = getStripeClient();

  let session;
  try {
    session = await stripe.checkout.sessions.create({
      mode: product === "annual" ? "subscription" : "payment",
      line_items: [{ price: priceId, quantity: 1 }],
      client_reference_id: user.id,
      metadata: { product },
      // Off by default — without this, Checkout never shows a "have a
      // promo code?" field at all, so a coupon created in Stripe would
      // have nowhere for a customer to actually enter it.
      allow_promotion_codes: true,
      ...(product === "annual"
        ? { subscription_data: { metadata: { supabase_user_id: user.id } } }
        : {}),
      ...(existingCustomerId
        ? { customer: existingCustomerId }
        : {
            customer_email: user.email ?? undefined,
            // Checkout only auto-creates a Customer for subscription mode
            // by default — without this, a one-time Pass/Trial purchase
            // would never get a stripe_customer_id, breaking the portal
            // button and future repurchase reuse above.
            ...(product !== "annual" ? { customer_creation: "always" as const } : {}),
          }),
      success_url: `${origin}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: origin,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not create checkout session" },
      { status: 502 },
    );
  }

  if (!session.url) {
    return NextResponse.json({ error: "Could not create checkout session" }, { status: 502 });
  }
  return NextResponse.json({ url: session.url });
}
