import Stripe from "stripe";

let stripeClient: Stripe | null = null;

// Server-only — never import this from a client component. Same
// lazy-init + clear-error shape as src/lib/anthropic.ts's getAnthropicClient.
export function getStripeClient(): Stripe {
  if (stripeClient) return stripeClient;
  const apiKey = process.env.STRIPE_SECRET_KEY;
  if (!apiKey) {
    throw new Error("STRIPE_SECRET_KEY is not set — billing is not configured.");
  }
  stripeClient = new Stripe(apiKey);
  return stripeClient;
}
