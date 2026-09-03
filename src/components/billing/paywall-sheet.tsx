"use client";

import { useState } from "react";
import { usePostHog } from "posthog-js/react";
import { IconChevronRight } from "@tabler/icons-react";
import { Sheet, SheetBody } from "@/components/ui/sheet";
import { usePaywallStore } from "@/hooks/use-paywall-store";
import { CATEGORY_COLORS } from "@/lib/category-colors";

// Each plan borrows a category's existing pastel tone rather than inventing
// new colours — Boxes (packing, a short one-off) for the one-time Pass,
// Storage (long-term) for the recurring Annual — so the cards read as part
// of the same Aesop-muted palette as everywhere else, not a bolted-on
// pricing-page look.
const PLAN_COLOR = {
  pass: CATEGORY_COLORS.Boxes.pastel,
  annual: CATEGORY_COLORS.Storage.pastel,
} as const;

export function PaywallSheet() {
  const isOpen = usePaywallStore((s) => s.isOpen);
  const close = usePaywallStore((s) => s.close);
  const posthog = usePostHog();
  const [loadingProduct, setLoadingProduct] = useState<"pass" | "annual" | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  async function handleUpgrade(product: "pass" | "annual") {
    setLoadingProduct(product);
    setError(null);
    posthog?.capture("checkout_started", { product });
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product }),
      });
      const body = await res.json();
      if (!res.ok || !body.url) throw new Error(body.error ?? "Couldn't start checkout");
      window.location.href = body.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setLoadingProduct(null);
    }
  }

  return (
    <Sheet title="Hizzel House Moving Plans" onClose={close}>
      <SheetBody>
        <p className="mb-4 text-sm text-linen-ink-secondary">
          Rooms, floor plans, and placing your things in space are part of Hizzel. Your
          Things stay free forever — unlock Hizzel with one of these:
        </p>
        <button
          type="button"
          onClick={() => handleUpgrade("pass")}
          disabled={!!loadingProduct}
          className="mb-2 flex w-full items-center justify-between gap-3 rounded-[11px] px-3.5 py-3 text-left transition-opacity disabled:opacity-60 active:opacity-80"
          style={{ backgroundColor: PLAN_COLOR.pass }}
        >
          <div>
            <div className="text-sm font-medium text-linen-ink">
              {loadingProduct === "pass" ? "Redirecting…" : "Move Pass — £6"}
            </div>
            <div className="mt-0.5 text-xs text-linen-ink-secondary">
              One-time payment, unlocks Hizzel for 90 days across your whole account.
            </div>
          </div>
          <IconChevronRight size={16} className="shrink-0 text-linen-ink/40" />
        </button>
        <button
          type="button"
          onClick={() => handleUpgrade("annual")}
          disabled={!!loadingProduct}
          className="flex w-full items-center justify-between gap-3 rounded-[11px] px-3.5 py-3 text-left transition-opacity disabled:opacity-60 active:opacity-80"
          style={{ backgroundColor: PLAN_COLOR.annual }}
        >
          <div>
            <div className="text-sm font-medium text-linen-ink">
              {loadingProduct === "annual" ? "Redirecting…" : "Annual — £10/year"}
            </div>
            <div className="mt-0.5 text-xs text-linen-ink-secondary">
              No 90-day limit, and your Things/history carry over across every future move.
            </div>
          </div>
          <IconChevronRight size={16} className="shrink-0 text-linen-ink/40" />
        </button>
        {error && <p className="mt-3 text-xs text-red-700">{error}</p>}
      </SheetBody>
    </Sheet>
  );
}
