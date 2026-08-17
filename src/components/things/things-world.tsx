"use client";

import Image from "next/image";
import { useState } from "react";
import { useAutoFocus } from "@/hooks/use-auto-focus";
import { IconSearch, IconPlus } from "@tabler/icons-react";
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
import { rotatedFootprint, resolvePlacement } from "@/lib/item-snap";
import type { ThingCategory } from "@/lib/supabase/types";

const HOVER_OUTLINE = "2px solid rgba(245,242,236,0.5)";

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
  widthPx,
  onJumpToHizzel,
}: {
  widthPx: number;
  onJumpToHizzel: () => void;
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

  // Drag a card straight from Things into a Hizzel room (desktop diptych).
  // Reuses the same placement pipeline hizzel-world.tsx's in-canvas drag uses —
  // this is just a second entry point into it, sourced from a Things card.
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
      if (Math.hypot(dx, dy) > 5) moved = true;
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
      // The Mid panel's thumbnail rooms carry the same data-room-id the
      // full canvas does, so a hit there is indistinguishable from a hit
      // on the roomEl.closest() above. This just tells us whether we're
      // inside the Mid drop zone at all, for the two cases below it: a
      // successful thumbnail placement also jumps to full Hizzel (the
      // thumbnail is too small to see the result on), and a drop that
      // lands in the zone but misses every room still confirms the item
      // as unassigned instead of silently doing nothing.
      const inMidZone =
        !!el?.closest("[data-hizzel-mid-zone]") || !!roomEl?.closest("[data-hizzel-mid-zone]");
      // The full Hizzel world's own tray strip (visible in the desktop
      // diptych) — a drop here is explicit tray intent, same as missing
      // every room inside the Mid zone below.
      const inTrayZone = !!el?.closest("[data-hizzel-tray]");
      // Dragging a room-placed card and dropping it back on Things world's
      // own Unassigned group — same explicit "send to tray" intent as the
      // arrow button, just via drag instead of tap.
      const inUnassignedZone = !!el?.closest("[data-unassigned-zone]");

      if (draggedItem && roomEl) {
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
          useFlashStore.getState().flash(thing.id);
          if (inMidZone) onJumpToHizzel();
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
      } else if (draggedItem && (inMidZone || inTrayZone || inUnassignedZone)) {
        // Missed every room but still landed in a recognized drop zone.
        // Hizzel's Mid panel / tray strip is explicit "send to tray"
        // intent, same as the arrow. Things' own Unassigned group is NOT —
        // that's just taking it out of the room, and shouldn't clutter the
        // tray any more than a thing that's never been touched would.
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

  return (
    <div
      className={`relative flex h-dvh min-w-0 shrink-0 flex-col overflow-hidden bg-linen lg:!w-1/2 lg:h-full ${widthPx === 0 ? "max-lg:pointer-events-none" : ""}`}
      style={{ width: `${widthPx}px` }}
    >
      <div className="flex items-center gap-2.5 px-5 pt-3.5 pb-2.5 lg:items-start lg:px-9 lg:pt-7 lg:pb-3.5">
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
          <div className="mb-0.5 text-[9px] tracking-[0.14em] text-linen-ink-tertiary uppercase lg:text-[11px]">
            Hizzel
          </div>
          <h1 className="font-serif text-[22px] leading-none tracking-[-0.3px] text-linen-ink lg:text-[32px]">
            My Things
          </h1>
          <div className="mt-0.5 text-[11px] text-[#B0A898]">
            {data?.totalCount ?? 0} items
            {currentProperty ? ` · ${currentProperty.nickname}` : ""}
          </div>
        </div>
      </div>

      <div className="mx-5 mb-3 flex items-center gap-2 lg:mx-9">
        <IconButton
          icon={IconSearch}
          label="Search"
          shape="square"
          size="md"
          onClick={() => setSearchOpen((v) => !v)}
        />
        {searchOpen && (
          <input
            ref={searchInputRef}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search things…"
            className="min-w-0 flex-1 rounded-[10px] bg-linen-field px-3 py-2 text-sm text-linen-ink placeholder:text-[#B0A898] focus:outline-none"
          />
        )}
      </div>

      <div className="mb-3 flex gap-1.5 overflow-x-auto px-5 [scrollbar-width:none] lg:px-9">
        <Pill size="sm" active={category === "All"} onClick={() => setCategory("All")}>
          All
        </Pill>
        {CATEGORIES.map((c) => (
          <Pill key={c} size="sm" active={category === c} onClick={() => setCategory(c)}>
            {c}
          </Pill>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-[90px] [scrollbar-width:none] lg:px-9 lg:pb-10">
        {groups.map((group) => (
          <div key={group.roomName} data-unassigned-zone={group.roomName === UNASSIGNED ? "" : undefined}>
            <div className="pt-2.5 pb-2 text-[10px] font-medium tracking-[0.1em] text-linen-ink-tertiary uppercase lg:text-xs">
              {group.roomName}
            </div>
            <div className="mb-1 grid grid-cols-[repeat(auto-fill,minmax(64px,64px))] gap-1.5 lg:grid-cols-4 lg:gap-2.5">
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

      <button
        type="button"
        onClick={() => setSheetState({ mode: "add" })}
        aria-label="Add a Thing"
        className="absolute right-5 bottom-[82px] z-10 flex h-[42px] w-[42px] items-center justify-center rounded-full bg-linen-ink text-linen shadow-lg lg:right-auto lg:bottom-7 lg:left-9 lg:h-12 lg:w-12"
      >
        <IconPlus size={20} />
      </button>

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
