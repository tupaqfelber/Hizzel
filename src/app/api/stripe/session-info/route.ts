import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getStripeClient } from "@/lib/stripe";

// Feeds /billing/success's Google Ads "Purchase" conversion (see
// src/lib/gtag.ts) — that page only has the checkout session_id from its
// own URL, and needs the *real* amount/currency/product to report an
// accurate value and to skip firing entirely for a free Trial redemption
// (already covered by the separate "Sign Up" conversion; counting a £0
// checkout as a "Purchase" would dilute the actual revenue signal).
//
// Requires auth and checks the session's own client_reference_id matches
// the caller — a Stripe session id is an unguessable random token, but
// there's no reason to let an authenticated user probe an arbitrary
// session id that isn't theirs for its amount/product either.
export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const sessionId = new URL(request.url).searchParams.get("session_id");
  if (!sessionId) {
    return NextResponse.json({ error: "Missing session_id" }, { status: 400 });
  }

  const stripe = getStripeClient();
  let session;
  try {
    session = await stripe.checkout.sessions.retrieve(sessionId);
  } catch {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  if (session.client_reference_id !== user.id) {
    return NextResponse.json({ error: "Not your session" }, { status: 403 });
  }

  return NextResponse.json({
    product: session.metadata?.product ?? null,
    amountTotal: session.amount_total,
    currency: session.currency,
  });
}
