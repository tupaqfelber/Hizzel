"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { usePostHog } from "posthog-js/react";
import {
  IconX,
  IconPlus,
  IconCalendar,
  IconTruck,
  IconNote,
  IconHome,
  IconHome2,
  IconChevronRight,
} from "@tabler/icons-react";
import { createClient } from "@/lib/supabase/client";
import {
  useCurrentMove,
  useOtherMoves,
  useStartNewMove,
  type MoveProperty,
  type CurrentMove,
} from "@/hooks/use-current-move";
import { PropertyFormSheet } from "@/components/my-hizzel/property-form-sheet";
import { MoveDetailsFormSheet } from "@/components/my-hizzel/move-details-form-sheet";
import { useBillingStatus } from "@/hooks/use-billing-status";
import { usePaywallStore } from "@/hooks/use-paywall-store";

const ROLE_GRADIENT = {
  current: "linear-gradient(135deg,#C8A882,#B8986F)",
  new: "linear-gradient(135deg,#9BA89A,#8A9889)",
} as const;

function formatDate(dateStr: string) {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function daysToGo(dateStr: string) {
  const ms = new Date(dateStr + "T00:00:00").getTime() - new Date().setHours(0, 0, 0, 0);
  return Math.round(ms / 86_400_000);
}

function PropertyCard({
  property,
  onClick,
}: {
  property: MoveProperty;
  onClick: () => void;
}) {
  const RoleIcon = property.role === "current" ? IconHome : IconHome2;
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex-1 overflow-hidden rounded-xl bg-[#F5F0E6] text-left"
    >
      <div
        className="relative flex aspect-[1.25] w-full items-center justify-center"
        style={{
          background: property.photo_url ? undefined : ROLE_GRADIENT[property.role],
        }}
      >
        {property.photo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={property.photo_url} alt="" className="h-full w-full object-cover" />
        ) : (
          <RoleIcon size={24} className="text-white/50" />
        )}
        <span className="absolute top-1.5 left-1.5 rounded-[5px] bg-linen/90 px-1.5 py-0.5 text-[8px] font-medium tracking-[0.05em] text-[#5C574F] uppercase">
          {property.role === "current" ? "Current" : "New"}
        </span>
      </div>
      <div className="px-2.5 pt-2 pb-2.5">
        <div className="text-sm font-medium text-linen-ink">{property.nickname}</div>
        <div className="mt-0.5 text-[9px] leading-[1.4] text-linen-ink-tertiary">
          {property.address || "No address yet"}
        </div>
      </div>
    </button>
  );
}

export function MyHizzelOverlay({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const supabase = createClient();
  const posthog = usePostHog();
  const { data: move } = useCurrentMove();
  const { data: otherMoves } = useOtherMoves(move?.id);

  const [sheet, setSheet] = useState<
    | { type: "property"; property: MoveProperty }
    | { type: "move-details" }
    | null
  >(null);
  const [newMoveError, setNewMoveError] = useState<string | null>(null);
  const startNewMove = useStartNewMove();
  const { hizzelUnlocked } = useBillingStatus();
  const [portalLoading, setPortalLoading] = useState(false);

  const current = move?.properties.find((p) => p.role === "current");
  const next = move?.properties.find((p) => p.role === "new");
  const days = move?.move_date ? daysToGo(move.move_date) : null;

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  async function handleSubscriptionClick() {
    if (!hizzelUnlocked) {
      usePaywallStore.getState().open();
      return;
    }
    setPortalLoading(true);
    try {
      const res = await fetch("/api/stripe/portal", { method: "POST" });
      const body = await res.json();
      if (!res.ok || !body.url) throw new Error(body.error ?? "Couldn't open the billing portal");
      window.location.href = body.url;
    } catch {
      setPortalLoading(false);
    }
  }

  async function handleNewMoveClick() {
    const confirmed = window.confirm(
      "Starting a new move will archive your current one. You'll still see it listed, but won't be able to open or edit it.",
    );
    if (!confirmed) return;
    setNewMoveError(null);
    try {
      await startNewMove.mutateAsync();
      posthog?.capture("move_created");
    } catch (err) {
      setNewMoveError(err instanceof Error ? err.message : "Couldn't start a new move");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/45" onClick={onClose} aria-hidden />
      <div className="animate-panel-rise-always relative flex max-h-[85vh] w-full max-w-[440px] flex-col overflow-hidden rounded-[26px] bg-[linear-gradient(160deg,#A87238_0%,#9A6630_30%,#8A5A28_70%,#7A4E20_100%)] shadow-[0_24px_80px_rgba(0,0,0,0.45)]">
      <div className="flex shrink-0 items-center justify-between px-6 pt-4 pb-1">
        <h1 className="font-serif text-2xl tracking-[-0.3px] text-amber-ink">My Hizzel</h1>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-ink/[.12] text-amber-ink/70"
        >
          <IconX size={16} />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-[22px] pt-1 pb-4">
        {move ? (
          <>
            <div className="mt-4 mb-2.5 flex items-center justify-between">
              <div className="text-[10px] font-medium tracking-[0.12em] text-amber-ink/50 uppercase">
                Current move
              </div>
              <button
                type="button"
                onClick={handleNewMoveClick}
                disabled={startNewMove.isPending}
                className="flex items-center gap-1 rounded-full border border-dashed border-amber-ink/40 px-2.5 py-[5px] text-[10px] font-medium text-amber-ink/85 disabled:opacity-60"
              >
                <IconPlus size={10} /> {startNewMove.isPending ? "Creating…" : "New move"}
              </button>
            </div>

            {newMoveError && (
              <button
                type="button"
                onClick={() => setNewMoveError(null)}
                className="mb-2.5 w-full rounded-[10px] bg-amber-ink/10 px-3.5 py-2 text-left text-[11px] text-amber-ink/85"
              >
                {newMoveError}
              </button>
            )}

            <h2 className="font-serif text-[22px] leading-[1.1] text-amber-ink">
              {current?.nickname ?? "?"} → {next?.nickname ?? "?"}
            </h2>
            <button
              type="button"
              onClick={() => setSheet({ type: "move-details" })}
              className="mt-1.5 mb-3.5 flex items-center gap-1.5 text-[11px] text-amber-ink/60"
            >
              <IconCalendar size={11} />
              {move.move_date
                ? `${formatDate(move.move_date)} · ${days === 0 ? "today" : days && days > 0 ? `${days} days to go` : `${Math.abs(days ?? 0)} days ago`}`
                : "Add a move date"}
            </button>

            <div className="mb-4 flex gap-2.5">
              {current && (
                <PropertyCard
                  property={current}
                  onClick={() => setSheet({ type: "property", property: current })}
                />
              )}
              {next && (
                <PropertyCard
                  property={next}
                  onClick={() => setSheet({ type: "property", property: next })}
                />
              )}
            </div>

            <button
              type="button"
              onClick={() => setSheet({ type: "move-details" })}
              className="mb-3 block w-full text-left"
            >
              <div className="mb-1.5 flex items-center gap-1 text-[9px] font-medium tracking-[0.1em] text-amber-ink/50 uppercase">
                <IconTruck size={10} /> Mover
              </div>
              <div className="border-b border-amber-ink/25 pb-1.5 text-xs text-amber-ink">
                {move.mover_name || move.mover_phone
                  ? [move.mover_name, move.mover_phone].filter(Boolean).join(" · ")
                  : "Add mover details"}
              </div>
            </button>

            <button
              type="button"
              onClick={() => setSheet({ type: "move-details" })}
              className="mb-1 block w-full text-left"
            >
              <div className="mb-1.5 flex items-center gap-1 text-[9px] font-medium tracking-[0.1em] text-amber-ink/50 uppercase">
                <IconNote size={10} /> Notes
              </div>
              <div className="min-h-10 border-b border-amber-ink/25 pb-2 text-xs leading-[1.5] text-amber-ink">
                {move.notes || "Add notes"}
              </div>
            </button>

            {otherMoves && otherMoves.length > 0 && (
              <>
                <div className="mt-5 mb-2.5 text-[10px] font-medium tracking-[0.12em] text-amber-ink/50 uppercase">
                  Other moves
                </div>
                {otherMoves.map((m) => (
                  <div
                    key={m.id}
                    className="flex items-center justify-between border-b border-amber-ink/15 py-2.5"
                  >
                    <div>
                      <div className="text-sm font-medium text-amber-ink">{m.displayName}</div>
                      <div className="mt-0.5 text-[10px] text-amber-ink/45">
                        {m.moveDate ? formatDate(m.moveDate) + " · " : ""}
                        {m.isExample ? "Example move · " : ""}
                        {m.thingCount} things, {m.roomCount} rooms
                      </div>
                    </div>
                    <IconChevronRight size={13} className="text-amber-ink/35" />
                  </div>
                ))}
              </>
            )}
          </>
        ) : (
          <p className="mt-10 text-center text-sm text-amber-ink/60">Loading…</p>
        )}
      </div>

      <div className="flex h-[74px] shrink-0 items-center justify-center border-t border-amber-ink/15 pb-2.5">
        <div className="flex w-[280px] gap-0.5 rounded-full bg-linen-ink/35 p-[3px]">
          <button
            type="button"
            onClick={handleSubscriptionClick}
            disabled={portalLoading}
            className="flex-1 rounded-full py-2 text-center text-[11px] font-medium text-amber-ink/60 disabled:opacity-60"
          >
            {portalLoading ? "Opening…" : "Subscription"}
          </button>
          <a
            href="mailto:hello@hizzel.com"
            className="flex-1 rounded-full py-2 text-center text-[11px] font-medium text-amber-ink/60"
          >
            Contact
          </a>
          <button
            type="button"
            onClick={handleSignOut}
            className="flex-1 rounded-full py-2 text-center text-[11px] font-medium text-amber-ink/60"
          >
            Sign out
          </button>
        </div>
      </div>

      {sheet?.type === "property" && (
        <PropertyFormSheet property={sheet.property} onClose={() => setSheet(null)} />
      )}
      {sheet?.type === "move-details" && move && (
        <MoveDetailsFormSheet move={move as CurrentMove} onClose={() => setSheet(null)} />
      )}
      </div>
    </div>
  );
}
