import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripeClient } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPostHogServerClient } from "@/lib/posthog-server";

const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;

// profiles.hizzel_unlocked_until / hizzel_product aren't in the generated
// Database type yet — same cast pattern as every other hook/route in this
// codebase reading/writing a column from a migration not yet regenerated
// into types.ts (see use-move-items.ts's in_tray comment). Delete this
// interface + the casts below once the billing migration's applied and
// types are regenerated.
interface ProfilesBillingTable {
  from(table: "profiles"): {
    update(values: {
      plan_tier?: "free" | "paid";
      stripe_customer_id?: string | null;
      stripe_subscription_id?: string | null;
      hizzel_unlocked_until?: string;
      hizzel_product?: "pass" | "annual";
    }): {
      eq(col: "id" | "stripe_customer_id", val: string): Promise<{ error: { message: string } | null }>;
    };
    select(cols: "id"): {
      eq(
        col: "stripe_customer_id",
        val: string,
      ): {
        maybeSingle(): Promise<
          { data: { id: string } | null; error: { message: string } | null }
        >;
      };
    };
  };
}

function customerId(customer: string | Stripe.Customer | Stripe.DeletedCustomer | null): string | null {
  if (!customer) return null;
  return typeof customer === "string" ? customer : customer.id;
}

// Stripe API versions after mid-2025 moved current_period_end off the
// Subscription object itself and onto each subscription item — verified
// against this project's actually-installed `stripe` package rather than
// assumed from older docs/training data.
function subscriptionPeriodEnd(subscription: Stripe.Subscription): number | undefined {
  return subscription.items.data[0]?.current_period_end;
}

export async function POST(request: Request) {
  const stripe = getStripeClient();
  const signature = request.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!signature || !webhookSecret) {
    return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });
  }

  // Next.js App Router Route Handlers never auto-parse the body — this
  // request.text() already IS the exact raw payload Stripe signed. Do NOT
  // call request.json() and re-stringify it for signature verification:
  // that can reorder keys / change whitespace vs. the original bytes and
  // silently break constructEvent's HMAC check.
  const rawBody = await request.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    return NextResponse.json(
      { error: `Signature verification failed: ${err instanceof Error ? err.message : "unknown"}` },
      { status: 400 },
    );
  }

  const supabase = createAdminClient() as unknown as ProfilesBillingTable;
  const posthog = getPostHogServerClient();

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      const userId = session.client_reference_id;
      if (!userId) break;

      const product = (session.metadata?.product ?? (session.mode === "payment" ? "pass" : "annual")) as
        | "pass"
        | "annual";
      const stripeCustomerId = customerId(session.customer);

      let unlockedUntil: string;
      let subscriptionId: string | null = null;
      if (session.mode === "payment") {
        unlockedUntil = new Date(Date.now() + NINETY_DAYS_MS).toISOString();
      } else {
        subscriptionId =
          typeof session.subscription === "string" ? session.subscription : (session.subscription?.id ?? null);
        const subscription = subscriptionId ? await stripe.subscriptions.retrieve(subscriptionId) : null;
        const periodEnd = subscription ? subscriptionPeriodEnd(subscription) : undefined;
        unlockedUntil = periodEnd
          ? new Date(periodEnd * 1000).toISOString()
          : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
      }

      await supabase.from("profiles").update({
        plan_tier: "paid",
        stripe_customer_id: stripeCustomerId,
        stripe_subscription_id: subscriptionId,
        hizzel_unlocked_until: unlockedUntil,
        hizzel_product: product,
      }).eq("id", userId);

      posthog.capture({
        distinctId: userId,
        event: "payment_succeeded",
        properties: { product, mode: session.mode, amount_total: session.amount_total },
      });
      break;
    }

    case "invoice.payment_succeeded": {
      // The authoritative event for EVERY subscription renewal
      // (checkout.session.completed only fires once, for the first
      // payment). Deliberately not special-cased to skip the first
      // invoice — running this for it too is a harmless idempotent no-op
      // (same current_period_end value already written above).
      const invoice = event.data.object;
      const stripeCustomerId = customerId(invoice.customer);
      const subscriptionRef = invoice.parent?.subscription_details?.subscription;
      const subscriptionId = typeof subscriptionRef === "string" ? subscriptionRef : (subscriptionRef?.id ?? null);
      if (!stripeCustomerId || !subscriptionId) break;

      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      const periodEnd = subscriptionPeriodEnd(subscription);
      if (!periodEnd) break;

      await supabase.from("profiles").update({
        hizzel_unlocked_until: new Date(periodEnd * 1000).toISOString(),
        plan_tier: "paid",
      }).eq("stripe_customer_id", stripeCustomerId);

      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("stripe_customer_id", stripeCustomerId)
        .maybeSingle();
      if (profile) {
        posthog.capture({ distinctId: profile.id, event: "payment_succeeded", properties: { renewal: true } });
      }
      break;
    }

    case "invoice.payment_failed": {
      const invoice = event.data.object;
      const stripeCustomerId = customerId(invoice.customer);
      if (stripeCustomerId) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("id")
          .eq("stripe_customer_id", stripeCustomerId)
          .maybeSingle();
        if (profile) {
          posthog.capture({
            distinctId: profile.id,
            event: "payment_failed",
            properties: { reason: "invoice_payment_failed" },
          });
        }
      }
      // No DB write — a failed renewal just means hizzel_unlocked_until
      // never gets extended, and it locks itself out naturally once it lapses.
      break;
    }

    case "checkout.session.expired": {
      const session = event.data.object;
      const userId = session.client_reference_id;
      if (userId) {
        posthog.capture({ distinctId: userId, event: "payment_failed", properties: { reason: "checkout_abandoned" } });
      }
      break;
    }

    default:
      break;
  }

  await posthog.shutdown();
  return NextResponse.json({ received: true });
}
