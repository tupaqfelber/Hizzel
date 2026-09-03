import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getStripeClient } from "@/lib/stripe";

// profiles.stripe_customer_id isn't in the generated Database type yet —
// same cast pattern as /api/stripe/checkout/route.ts.
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

  const { data: profile } = await (supabase as unknown as ProfilesStripeIdTable)
    .from("profiles")
    .select("stripe_customer_id")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile?.stripe_customer_id) {
    return NextResponse.json({ error: "No billing account yet" }, { status: 400 });
  }

  const origin = request.headers.get("origin") ?? new URL(request.url).origin;
  const stripe = getStripeClient();

  let session;
  try {
    session = await stripe.billingPortal.sessions.create({
      customer: profile.stripe_customer_id,
      return_url: origin,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not open the billing portal" },
      { status: 502 },
    );
  }

  return NextResponse.json({ url: session.url });
}
