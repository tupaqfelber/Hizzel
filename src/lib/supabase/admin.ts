import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

// Service-role client — bypasses RLS entirely, including the billing
// migration's column-level REVOKE (grants/revokes only apply to the
// authenticated/anon roles, never service_role). Server-only, never import
// from a client component or a route with a user session — this exists
// solely for the Stripe webhook, which has no user session of its own and
// must write another user's profile row (looked up via the Checkout
// Session's client_reference_id, or the invoice's Stripe customer id).
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set — the Stripe webhook cannot update profiles.");
  }
  return createSupabaseClient<Database>(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
