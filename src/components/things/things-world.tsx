"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { usePostHog } from "posthog-js/react";
import { useAutoFocus } from "@/hooks/use-auto-focus";
import { IconSearch, IconPlus, IconArrowsMaximize } from "@tabler/icons-react";
import { IconButton } from "@/components/ui/icon-button";
import { Pill } from "@/components/ui/pill";
import { ItemCard } from "@/components/things/item-card";
import { ThingFormSheet } from "@/components/things/thing-form-sheet";
import { MyHizzelOverlay } from "@/components/my-hizzel/my-hizzel-overlay";
import { DragGhost } from "@/components/hizzel/drag-ghost";
import { useCurrentMove } from "@/hooks/use-current-move";
import { useGroupedThings, useSendToTray, UNASSIGNED, type ThingItem } from "@/hooks/use-things";
import { useMoveItems, usePlaceItem } from "@/hooks/use-move-items";
import { useFlashStore } from "@/hooks/use-flash-store";
import { useScrollToItemStore } from "@/hooks/use-scroll-to-item-store";
import { useSelectItemStore } from "@/hooks/use-select-item-store";
import { useBillingStatus } from "@/hooks/use-billing-status";
import { usePaywallStore } from "@/hooks/use-paywall-store";
import { rotatedFootprint, resolvePlacement } from "@/lib/item-snap";
import type { ThingCategory } from "@/lib/supabase/types";
import type { WorldMode } from "@/components/app-shell";

const HOVER_OUTLINE = "2px solid rgba(245,242,236,0.5)";
// Matches AppShell's own SLIVER_PX — the sliver's fixed peek height.
const SLIVER_HEIGHT_PX = 84;

interface CardDragState {
  thingId: string;
  clientX: number;
  clientY: number;
}

const CATEGORIES: ThingCategory[] = [
  "Appliances",
  "Beds",
  "Boxes",
  "Lighting",
  "Other",
  "Seating",
  "Shelving",
  "Storage",
  "Tables",
];

export function ThingsWorld({
  mode,
  sizePx,
  onJumpToHizzel,
  onDragStart,
  onExpand,
}: {
  // "desktop" / "landscape": always-visible diptych (no slider), differing
  // only in sizing tier and — for this component specifically — the
  // controls row's own structural arrangement (see the render below).
  // "full" / "mid" / "sliver": portrait's three slider stops.
  mode: WorldMode;
  // Only meaningful for "full"/"mid"/"sliver" (portrait) — the slider's
  // current height allocation for this world. Ignored for "desktop"/
  // "landscape", which size via a fixed 50% split instead.
  sizePx: number;
  onJumpToHizzel: () => void;
  // Called the moment a card drag actually starts moving (not on a plain
  // tap). At the portrait Full-Things stop, the Hizzel sliver below is a
  // static preview, not a real canvas — a card drag started there still
  // has nowhere real to land. AppShell uses this to auto-reveal Mid the
  // instant a drag begins, the same way a successful placement already
  // auto-jumps to full Hizzel below.
  onDragStart?: () => void;
  // Mid's own "make me fullscreen" button, shown only at mode==="mid" —
  // replaces the old shared divide arrows (which had a direction to get
  // backward; this doesn't).
  onExpand?: () => void;
}) {
  const { data: move } = useCurrentMove();
  const { data } = useGroupedThings(move?.id);
  const sendToTray = useSendToTray(move?.id);

  const [category, setCategory] = useState<ThingCategory | "All">("All");
  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [sheetState, setSheetState] = useState<
    { mode: "add" } | { mode: "edit"; thing: ThingItem } | null
  >(null);
  const [myHizzelOpen, setMyHizzelOpen] = useState(false);
  const [cardDrag, setCardDrag] = useState<CardDragState | null>(null);
  const searchInputRef = useAutoFocus<HTMLInputElement>();

  const { data: moveItems } = useMoveItems(move?.id);
  const placeItem = usePlaceItem(move?.id);
  const { hizzelUnlocked: accountUnlocked } = useBillingStatus();
  // The onboarding example move is a free intro demo, not a real move --
  // see the matching comment in hizzel-world.tsx.
  const hizzelUnlocked = accountUnlocked || !!move?.is_example;
  const posthog = usePostHog();

  // Selecting an item in Hizzel's canvas requests a scroll here (the flash
  // itself needs no extra wiring — ItemCard already reacts to the same
  // useFlashStore id that selection flashes).
  const scrollToItemId = useScrollToItemStore((s) => s.itemId);
  const scrollToItemNonce = useScrollToItemStore((s) => s.nonce);
  useEffect(() => {
    if (!scrollToItemId) return;
    document
      .querySelector(`[data-thing-id="${scrollToItemId}"]`)
      ?.scrollIntoView({ behavior: "smooth", block: "center" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scrollToItemNonce]);

  const currentProperty = move?.properties?.find((p) => p.role === "current");

  const groups = (data?.groups ?? [])
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => {
        if (category !== "All" && item.category !== category) return false;
        if (search && !item.name.toLowerCase().includes(search.toLowerCase()))
          return false;
        return true;
      }),
    }))
    .filter((group) => group.items.length > 0);

  // Drag a card straight from Things into a Hizzel room (desktop/landscape
  // diptych, or the portrait slider once a room is on screen). Reuses the
  // same placement pipeline hizzel-world.tsx's in-canvas drag uses — this
  // is just a second entry point into it, sourced from a Things card.
  function startCardDrag(thing: ThingItem, e: React.PointerEvent) {
    e.preventDefault();
    const startX = e.clientX;
    const startY = e.clientY;
    let moved = false;
    let hoveredRoomEl: HTMLElement | null = null;
    setCardDrag({ thingId: thing.id, clientX: startX, clientY: startY });

    function clearHover() {
      if (hoveredRoomEl) {
        hoveredRoomEl.style.outline = "";
        hoveredRoomEl.style.outlineOffset = "";
        hoveredRoomEl = null;
      }
    }

    function handleMove(ev: PointerEvent) {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      if (Math.hypot(dx, dy) > 5 && !moved) {
        moved = true;
        onDragStart?.();
      }
      setCardDrag((d) => (d ? { ...d, clientX: ev.clientX, clientY: ev.clientY } : d));

      const el = document.elementFromPoint(ev.clientX, ev.clientY);
      const roomEl = el?.closest("[data-room-id]") as HTMLElement | null;
      if (roomEl !== hoveredRoomEl) {
        clearHover();
        if (roomEl) {
          roomEl.style.outline = HOVER_OUTLINE;
          roomEl.style.outlineOffset = "-2px";
          hoveredRoomEl = roomEl;
        }
      }
    }

    function handleUp(ev: PointerEvent) {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
      // Captured before clearHover() nulls it out — handleMove has been
      // tracking this continuously and reliably (it's what drives the
      // hover outline), so it's a more trustworthy source for "which room
      // is this drop over" than a single fresh elementFromPoint query
      // exactly at the release instant, which real touch input can land
      // a frame or a few pixels off from.
      const lastHoveredRoomEl = hoveredRoomEl;
      clearHover();

      if (!moved) {
        setSheetState({ mode: "edit", thing });
        setCardDrag(null);
        return;
      }

      const draggedItem = moveItems?.find((i) => i.id === thing.id);
      const el = document.elementFromPoint(ev.clientX, ev.clientY);
      const roomEl = (el?.closest("[data-room-id]") as HTMLElement | null) ?? lastHoveredRoomEl;
      const inTrayZone = !!el?.closest("[data-hizzel-tray]");
      // Dragging a room-placed card and dropping it back on Things world's
      // own Unassigned group — same explicit "send to tray" intent as the
      // arrow button, just via drag instead of tap.
      const inUnassignedZone = !!el?.closest("[data-unassigned-zone]");

      if (draggedItem && roomEl && !hizzelUnlocked) {
        // Gate the whole "dropped on a room" case before ever checking fit
        // — same reasoning as hizzel-world.tsx's startDrag: gating only the
        // fits branch would let an oversized item silently bounce to the
        // tray with zero indication Hizzel is locked at all.
        usePaywallStore.getState().open();
      } else if (draggedItem && roomEl) {
        const roomId = roomEl.dataset.roomId!;
        const widthCm = Number(roomEl.dataset.widthCm);
        const depthCm = Number(roomEl.dataset.depthCm);
        const roomRect = roomEl.getBoundingClientRect();
        const pxPerCm = roomRect.width / widthCm;
        const localXcm = (ev.clientX - roomRect.left) / pxPerCm;
        const localYcm = (ev.clientY - roomRect.top) / pxPerCm;
        const { w, d } = rotatedFootprint(draggedItem);
        const targetX = localXcm - w / 2;
        const targetY = localYcm - d / 2;

        const roomItems = (moveItems ?? []).filter(
          (i) => i.roomId === roomId && i.x_cm != null && i.y_cm != null,
        );
        const others = roomItems
          .filter((i) => i.id !== thing.id)
          .map((i) => {
            const fp = rotatedFootprint(i);
            return { id: i.id, x: i.x_cm!, y: i.y_cm!, w: fp.w, d: fp.d };
          });

        const placed = resolvePlacement(
          { w, d },
          targetX,
          targetY,
          { width_cm: widthCm, depth_cm: depthCm },
          others,
        );
        if (!placed.fits) {
          // Too big for this room outright — reject, back to the tray.
          placeItem.mutate({
            thingId: thing.id,
            roomId: null,
            x_cm: null,
            y_cm: null,
            rotation_deg: draggedItem.rotation_deg,
          });
          useFlashStore.getState().flash(thing.id);
        } else {
          placeItem.mutate({
            thingId: thing.id,
            roomId,
            x_cm: placed.x,
            y_cm: placed.y,
            rotation_deg: draggedItem.rotation_deg,
          });
          posthog?.capture("item_placed", { roomId });
          useFlashStore.getState().flash(thing.id);
          // The item you just dropped into a room should be the one
          // showing (and flashing) in Hizzel's own toolbar too, exactly
          // as if you'd tapped it there directly — not whatever was
          // selected before, or nothing.
          useSelectItemStore.getState().requestSelect(thing.id);
          for (const bumped of placed.displaced) {
            const bumpedItem = roomItems.find((i) => i.id === bumped.id);
            if (!bumpedItem) continue;
            placeItem.mutate({
              thingId: bumped.id,
              roomId,
              x_cm: bumped.x,
              y_cm: bumped.y,
              rotation_deg: bumpedItem.rotation_deg,
            });
          }
          for (const unplacedId of placed.unplaced) {
            const bumpedItem = roomItems.find((i) => i.id === unplacedId);
            if (!bumpedItem) continue;
            placeItem.mutate({
              thingId: unplacedId,
              roomId: null,
              x_cm: null,
              y_cm: null,
              rotation_deg: bumpedItem.rotation_deg,
            });
            useFlashStore.getState().flash(unplacedId);
          }
        }
      } else if (draggedItem && (inTrayZone || inUnassignedZone)) {
        // Missed every room but still landed in a recognized drop zone.
        // Hizzel's own tray strip is explicit "send to tray" intent, same
        // as the arrow. Things' own Unassigned group is NOT — that's just
        // taking it out of the room, and shouldn't clutter the tray any
        // more than a thing that's never been touched would.
        placeItem.mutate({
          thingId: thing.id,
          roomId: null,
          x_cm: null,
          y_cm: null,
          rotation_deg: draggedItem.rotation_deg,
          inTray: !inUnassignedZone,
        });
        useFlashStore.getState().flash(thing.id);
      }
      // Dropped somewhere else entirely (back in Things, or outside the
      // app): no-op, card stays put.

      setCardDrag(null);
    }

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
  }

  const draggedCardItem = cardDrag ? moveItems?.find((i) => i.id === cardDrag.thingId) : undefined;

  // Compact single-row controls (search + categories + a small inline
  // "+Thing" pill) — landscape and portrait-Mid both only ever have half
  // the screen's height to work with, so a separate full-width button row
  // (see the "full" case below) would eat too much of it.
  const useCompactControls = mode === "landscape" || mode === "mid";

  if (mode === "sliver") {
    return (
      <button
        type="button"
        onClick={onJumpToHizzel}
        aria-label="Open Things"
        className="flex w-full shrink-0 items-center gap-2.5 bg-linen px-5 text-left"
        style={{ height: SLIVER_HEIGHT_PX }}
      >
        <Image src="/logo.png" alt="" width={26} height={26} className="mix-blend-multiply" />
        <span className="font-serif text-[17px] leading-none text-linen-ink">My Things</span>
      </button>
    );
  }

  return (
    <div
      className={`relative flex min-h-0 w-full shrink-0 flex-col overflow-hidden bg-linen ${
        mode === "desktop" ? "lg:!w-1/2 lg:!h-full" : ""
      }`}
      style={mode === "landscape" ? { width: "50%", height: "100%" } : { height: sizePx }}
    >
      <div
        className={`flex items-center gap-2.5 px-5 pt-3.5 pb-2.5 ${
          mode === "desktop" ? "lg:items-start lg:px-9 lg:pt-7 lg:pb-3.5" : ""
        }`}
      >
        <button type="button" onClick={() => setMyHizzelOpen(true)} aria-label="Open My Hizzel">
          <Image
            src="/logo.png"
            alt=""
            width={32}
            height={32}
            className="mix-blend-multiply"
          />
        </button>
        <div className="flex-1">
          <div
            className={`mb-0.5 text-[9px] tracking-[0.14em] text-linen-ink-tertiary uppercase ${
              mode === "desktop" ? "lg:text-[11px]" : ""
            }`}
          >
            Hizzel
          </div>
          <h1
            className={`font-serif leading-none tracking-[-0.3px] text-linen-ink ${
              mode === "desktop" ? "text-[22px] lg:text-[32px]" : "text-[18px]"
            }`}
          >
            My Things
          </h1>
          <div className="mt-0.5 text-[11px] text-[#B0A898]">
            {data?.totalCount ?? 0} items
            {currentProperty ? ` · ${currentProperty.nickname}` : ""}
          </div>
        </div>
        {mode === "mid" && onExpand && (
          <button
            type="button"
            onClick={onExpand}
            aria-label="Expand My Things"
            className="flex h-8 w-8 shrink-0 items-center justify-center self-start rounded-full bg-linen-ink/[.07] text-linen-ink-secondary"
          >
            <IconArrowsMaximize size={15} />
          </button>
        )}
      </div>

      {useCompactControls ? (
        // Landscape / portrait-Mid: search, categories, and a small
        // inline "+Thing" pill all share one row — matches
        // hizzel_landscape_v3 / hizzel_portrait_mid_v4 exactly.
        <div className="mb-3 flex items-center gap-1.5 overflow-x-auto px-5 [scrollbar-width:none]">
          <IconButton
            icon={IconSearch}
            label="Search"
            shape="square"
            size="sm"
            onClick={() => setSearchOpen((v) => !v)}
          />
          <Pill size="sm" active={category === "All"} onClick={() => setCategory("All")}>
            All
          </Pill>
          {CATEGORIES.map((c) => (
            <Pill key={c} size="sm" active={category === c} onClick={() => setCategory(c)}>
              {c}
            </Pill>
          ))}
          <button
            type="button"
            onClick={() => setSheetState({ mode: "add" })}
            className="flex shrink-0 items-center gap-1 rounded-[10px] border-[0.5px] border-linen-ink/10 bg-linen-ink/[.07] px-3 py-[6px] text-[10px] font-medium whitespace-nowrap text-linen-ink-secondary"
          >
            <IconPlus size={10} /> Thing
          </button>
        </div>
      ) : (
        // Desktop (unchanged) and portrait-Full (the new "v4" treatment):
        // search + full category list on one row, then a full-width
        // "+ Thing" button on its own row below.
        <>
          <div
            className={`mb-3 flex items-center gap-1.5 overflow-x-auto px-5 [scrollbar-width:none] ${
              mode === "desktop" ? "lg:px-9" : ""
            }`}
          >
            <IconButton
              icon={IconSearch}
              label="Search"
              shape="square"
              size={mode === "desktop" ? "md" : "sm"}
              onClick={() => setSearchOpen((v) => !v)}
            />
            <Pill size="sm" active={category === "All"} onClick={() => setCategory("All")}>
              All
            </Pill>
            {CATEGORIES.map((c) => (
              <Pill key={c} size="sm" active={category === c} onClick={() => setCategory(c)}>
                {c}
              </Pill>
            ))}
          </div>
          <div className={`mb-3 px-5 ${mode === "desktop" ? "lg:px-9" : ""}`}>
            <button
              type="button"
              onClick={() => setSheetState({ mode: "add" })}
              className="flex w-full items-center justify-center gap-1 rounded-full bg-linen-ink py-[9px] text-xs font-medium text-linen"
            >
              <IconPlus size={12} /> Thing
            </button>
          </div>
        </>
      )}

      {searchOpen && (
        <div className={`mb-3 px-5 ${mode === "desktop" ? "lg:px-9" : ""}`}>
          <input
            ref={searchInputRef}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search things…"
            className="w-full rounded-[10px] bg-linen-field px-3 py-2 text-sm text-linen-ink placeholder:text-[#B0A898] focus:outline-none"
          />
        </div>
      )}

      <div
        className={`min-h-0 flex-1 overflow-y-auto px-4 pb-[90px] [scrollbar-width:none] ${
          mode === "desktop" ? "lg:px-9 lg:pb-10" : ""
        }`}
      >
        {groups.map((group) => (
          <div
            key={group.key}
            data-unassigned-zone={group.roomName === UNASSIGNED ? "" : undefined}
            // Same three data attributes RoomBlock and a canvas room carry
            // — makes a room's own section in this list a real drop
            // target, running through the exact same elementFromPoint
            // hit-test and resolvePlacement pipeline a canvas drop does.
            data-room-id={group.roomWidthCm != null ? group.key : undefined}
            data-width-cm={group.roomWidthCm ?? undefined}
            data-depth-cm={group.roomDepthCm ?? undefined}
          >
            <div
              className={`pt-2.5 pb-2 text-[10px] font-medium tracking-[0.1em] text-linen-ink-tertiary uppercase ${
                mode === "desktop" ? "lg:text-xs" : ""
              }`}
            >
              {/* Two same-named rooms on different floors ("Landing",
                  "Shower Room") would otherwise look identical here — the
                  floor name disambiguates which one this group is. */}
              {group.areaName ? `${group.areaName} · ${group.roomName}` : group.roomName}
            </div>
            <div
              className={`mb-1 grid gap-1.5 ${
                mode === "desktop"
                  ? "grid-cols-[repeat(auto-fill,minmax(64px,64px))] lg:grid-cols-4 lg:gap-2.5"
                  : "grid-cols-5"
              }`}
            >
              {group.items.map((item) => (
                <ItemCard
                  key={item.id}
                  thing={item}
                  dragging={cardDrag?.thingId === item.id}
                  onPointerDown={(e) => startCardDrag(item, e)}
                  onSendToTray={() => sendToTray.mutate(item.id)}
                />
              ))}
            </div>
          </div>
        ))}
        {groups.length === 0 && (
          <p className="flex h-full items-center justify-center px-10 text-center text-sm text-linen-ink-tertiary">
            No things yet — tap + to add your first one.
          </p>
        )}
      </div>

      {sheetState?.mode === "add" && (
        <ThingFormSheet onClose={() => setSheetState(null)} />
      )}
      {sheetState?.mode === "edit" && (
        <ThingFormSheet thing={sheetState.thing} onClose={() => setSheetState(null)} />
      )}
      {myHizzelOpen && <MyHizzelOverlay onClose={() => setMyHizzelOpen(false)} />}

      {cardDrag && draggedCardItem && (
        <DragGhost
          item={draggedCardItem}
          clientX={cardDrag.clientX}
          clientY={cardDrag.clientY}
          scale={{ pxPerCm: hoveredRoomPxPerCm(cardDrag.clientX, cardDrag.clientY) }}
        />
      )}
    </div>
  );
}

// Ghost sizing while cross-world dragging: use the room under the pointer's
// exact scale once hovering one. Every room shares the same uniform
// px-per-cm (computeCanvasScale fits the whole floorplan to the viewport),
// so even before the pointer reaches a room, fall back to any room already
// on screen rather than a guessed constant — a fixed number here is
// typically several times the real canvas scale and renders a wildly
// oversized ghost for the entire time the drag is still over the Things
// side. Only guess a fallback if no room is on screen at all (empty
// apartment), which can't be a valid drop target anyway.
function hoveredRoomPxPerCm(clientX: number, clientY: number): number {
  if (typeof document === "undefined") return 3;
  const el = document.elementFromPoint(clientX, clientY);
  const hoveredRoomEl = el?.closest("[data-room-id]") as HTMLElement | null;
  const roomEl = hoveredRoomEl ?? document.querySelector<HTMLElement>("[data-room-id]");
  if (roomEl) {
    const widthCm = Number(roomEl.dataset.widthCm);
    if (widthCm > 0) {
      return roomEl.getBoundingClientRect().width / widthCm;
    }
  }
  return 3;
}
