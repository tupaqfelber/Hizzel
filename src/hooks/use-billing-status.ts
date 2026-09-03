import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { PlanTier } from "@/lib/supabase/types";

// hizzel_unlocked_until / hizzel_product aren't in the generated Database
// type yet — same cast pattern as every other hook reading a column from an
// unapplied-to-generated-types migration in this codebase (see
// use-move-items.ts's in_tray comment for the full reasoning). Delete this
// interface + the cast once the migration's applied and types regenerated.
interface ProfileRow {
  plan_tier: PlanTier;
  hizzel_unlocked_until: string | null;
  hizzel_product: "pass" | "annual" | null;
}

interface ProfilesBillingReadTable {
  from(table: "profiles"): {
    select(cols: "plan_tier, hizzel_unlocked_until, hizzel_product"): {
      eq(
        col: "id",
        val: string,
      ): {
        maybeSingle(): Promise<
          { data: ProfileRow | null; error: null } | { data: null; error: { message: string } }
        >;
      };
    };
  };
}

// NEXT_PUBLIC_BILLING_ENABLED is the master kill-switch: false makes every
// gate pass through regardless of plan, useful for continued dev/demo
// without hitting the paywall. Read once at module load — Next.js inlines
// NEXT_PUBLIC_* vars into the client bundle at build time, so flipping it
// needs a `next dev` restart, not just an edit to .env.local.
const BILLING_ENABLED = process.env.NEXT_PUBLIC_BILLING_ENABLED === "true";

export function useBillingStatus() {
  const supabase = createClient();

  const query = useQuery({
    queryKey: ["billing-status"],
    queryFn: async (): Promise<ProfileRow | null> => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return null;

      const { data, error } = await (supabase as unknown as ProfilesBillingReadTable)
        .from("profiles")
        .select("plan_tier, hizzel_unlocked_until, hizzel_product")
        .eq("id", user.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const hizzelUnlocked =
    !BILLING_ENABLED ||
    (!!query.data?.hizzel_unlocked_until && new Date(query.data.hizzel_unlocked_until) > new Date());

  return {
    ...query,
    hizzelUnlocked,
    planTier: query.data?.plan_tier ?? "free",
    product: query.data?.hizzel_product ?? null,
    unlockedUntil: query.data?.hizzel_unlocked_until ?? null,
  };
}
