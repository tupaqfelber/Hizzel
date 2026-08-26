import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getStripeClient } from "@/lib/stripe";

const PRICE_IDS: Record<"pass" | "annual", string | undefined> = {
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
    select(cols: "stripe_customer_id"): {
      eq(
        col: "id",
        val: string,
      ): {
        maybeSingle(): Promise<
          | { data: { stripe_customer_id: string | null }; error: null }
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
  if (requestedProduct !== "pass" && requestedProduct !== "annual") {
    return NextResponse.json({ error: "Invalid product" }, { status: 400 });
  }
  const product: "pass" | "annual" = requestedProduct;

  const priceId = PRICE_IDS[product];
  if (!priceId) {
    return NextResponse.json({ error: "Billing is not configured" }, { status: 500 });
  }

  // Reuse an existing Stripe Customer if this user already has one, so a
  // repeat purchase (renewing a lapsed Pass, or Pass -> Annual) doesn't
  // accumulate duplicate Customers.
  const { data: profile } = await (supabase as unknown as ProfilesStripeIdTable)
    .from("profiles")
    .select("stripe_customer_id")
    .eq("id", user.id)
    .maybeSingle();
  const existingCustomerId = profile?.stripe_customer_id ?? undefined;

  const origin = request.headers.get("origin") ?? new URL(request.url).origin;
  const stripe = getStripeClient();

  let session;
  try {
    session = await stripe.checkout.sessions.create({
      mode: product === "pass" ? "payment" : "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      client_reference_id: user.id,
      metadata: { product },
      ...(product === "annual"
        ? { subscription_data: { metadata: { supabase_user_id: user.id } } }
        : {}),
      ...(existingCustomerId
        ? { customer: existingCustomerId }
        : {
            customer_email: user.email ?? undefined,
            // Checkout only auto-creates a Customer for subscription mode
            // by default — without this, a one-time Pass purchase would
            // never get a stripe_customer_id, breaking the portal button
            // and future repurchase reuse above.
            ...(product === "pass" ? { customer_creation: "always" as const } : {}),
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
