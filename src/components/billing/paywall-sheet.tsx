"use client";

import { useState } from "react";
import { usePostHog } from "posthog-js/react";
import { Sheet, SheetBody, SheetFooter } from "@/components/ui/sheet";
import { GhostButton, SolidButton } from "@/components/ui/button";
import { usePaywallStore } from "@/hooks/use-paywall-store";

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
    <Sheet title="Unlock Hizzel" onClose={close}>
      <SheetBody>
        <p className="mb-4 text-sm text-linen-ink-secondary">
          Rooms, floor plans, and placing your things in space are part of Hizzel. Your
          Things stay free forever — unlock Hizzel with one of these:
        </p>
        <div className="mb-2 rounded-[11px] bg-linen-field px-3.5 py-3">
          <div className="text-sm font-medium text-linen-ink">Move Pass — £6</div>
          <div className="mt-0.5 text-xs text-linen-ink-tertiary">
            One-time payment, unlocks Hizzel for 90 days across your whole account.
          </div>
        </div>
        <div className="rounded-[11px] bg-linen-field px-3.5 py-3">
          <div className="text-sm font-medium text-linen-ink">Annual — £10/year</div>
          <div className="mt-0.5 text-xs text-linen-ink-tertiary">
            No 90-day limit, and your Things/history carry over across every future move.
          </div>
        </div>
        {error && <p className="mt-3 text-xs text-red-700">{error}</p>}
      </SheetBody>
      <SheetFooter>
        <GhostButton type="button" onClick={() => handleUpgrade("pass")} disabled={!!loadingProduct}>
          {loadingProduct === "pass" ? "Redirecting…" : "Get Move Pass"}
        </GhostButton>
        <SolidButton type="button" onClick={() => handleUpgrade("annual")} disabled={!!loadingProduct}>
          {loadingProduct === "annual" ? "Redirecting…" : "Get Annual"}
        </SolidButton>
      </SheetFooter>
    </Sheet>
  );
}
