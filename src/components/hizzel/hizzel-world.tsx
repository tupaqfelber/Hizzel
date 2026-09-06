"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { useIsomorphicLayoutEffect } from "@/hooks/use-isomorphic-layout-effect";
import {
  IconPlus,
  IconUpload,
  IconLock,
  IconLockOpen,
  IconSearch,
  IconChevronDown,
  IconRotate,
  IconPencil,
  IconX,
  IconArrowsMaximize,
} from "@tabler/icons-react";
import { usePostHog } from "posthog-js/react";
import { useCurrentMove } from "@/hooks/use-current-move";
import { useAreas, useUpdateArea, useCreateArea } from "@/hooks/use-areas";
import { useRooms, useUpdateRoomPosition, useUpdateRoom } from "@/hooks/use-rooms";
import { useMoveItems, usePlaceItem } from "@/hooks/use-move-items";
import { useFlashStore } from "@/hooks/use-flash-store";
import { useScrollToItemStore } from "@/hooks/use-scroll-to-item-store";
import { useSelectItemStore } from "@/hooks/use-select-item-store";
import { useBillingStatus } from "@/hooks/use-billing-status";
import { usePaywallStore } from "@/hooks/use-paywall-store";
import { CATEGORY_COLORS, categoryFlashColor } from "@/lib/category-colors";
import { computeCanvasScale } from "@/lib/canvas-scale";
import { rotatedFootprint, resolvePlacement } from "@/lib/item-snap";
import { RoomBlock } from "@/components/hizzel/room-block";
import { ItemBlock } from "@/components/hizzel/item-block";
import { TrayCard } from "@/components/hizzel/tray-card";
import { DragGhost } from "@/components/hizzel/drag-ghost";
import { MyHizzelOverlay } from "@/components/my-hizzel/my-hizzel-overlay";
import { AreaDropdown } from "@/components/hizzel/area-dropdown";
import { RoomFormSheet } from "@/components/hizzel/room-form-sheet";
import { EditAreasSheet } from "@/components/hizzel/edit-areas-sheet";
import { ThingFormSheet } from "@/components/things/thing-form-sheet";
import { FloorPlanReviewSheet } from "@/components/hizzel/floorplan-review-sheet";
import { useExtractFloorPlan, type ExtractResponse } from "@/hooks/use-floorplan-import";
import type { WorldMode } from "@/components/app-shell";

interface DragState {
  itemId: string;
  clientX: number;
  clientY: number;
}

// Matches ThingsWorld's own — the sliver's fixed peek height.
const SLIVER_HEIGHT_PX = 84;
// The tray strip used to be the only way to see/reach an unplaced item
// while working inside Hizzel. Now that Things is visible alongside
// Hizzel in every mode that matters for dragging (Mid, landscape,
// desktop), and Things' own Unassigned group is always present (see
// use-things.ts) as a real drop target, the tray is redundant — and was
// also a layout-participating flex sibling whose content changes forced
// the canvas to keep resizing/re-measuring, a real contributor to the
// landscape sizing bugs. Kept disabled rather than deleted in case it's
// wanted back — nothing else needs to change if TRAY_ENABLED flips back
// to true (trayItems, TrayCard, and the drop-zone marker are all intact).
const TRAY_ENABLED = false;

export function HizzelWorld({
  mode,
  sizePx,
  landscapeWidthPx,
  landscapeHeightPx,
  onJumpToFull,
  onExpand,
}: {
  // "desktop"/"landscape": always-visible diptych, fixed 50% split,
  // differing only in sizing tier (no structural difference here, unlike
  // ThingsWorld's controls row). "full"/"mid"/"sliver": portrait's three
  // slider stops.
  mode: WorldMode;
  // Only meaningful for "full"/"mid"/"sliver" (portrait) — the slider's
  // current height allocation for this world.
  sizePx: number;
  // Only meaningful for mode==="landscape" — explicit pixel dimensions
  // computed once in AppShell from the same viewportWidth/viewportHeight
  // state that decides orientation, rather than a CSS percentage (which
  // depends on the whole ancestor chain having already settled its own
  // box — see the matching comment in app-shell.tsx).
  landscapeWidthPx?: number;
  landscapeHeightPx?: number;
  // Tapping the Hizzel sliver (shown below portrait's Full-Things stop)
  // jumps straight to Hizzel's own Full stop — same precedent as the old
  // Mid-panel thumbnail's tap-to-expand.
  onJumpToFull?: () => void;
  // Mid's own "make me fullscreen" button, shown only at mode==="mid" —
  // replaces the old shared divide arrows (which had a direction to get
  // backward; this doesn't).
  onExpand?: () => void;
}) {
  const { data: move } = useCurrentMove();
  const newProperty = move?.properties.find((p) => p.role === "new");

  const { data: areas } = useAreas(newProperty?.id);
  const [chosenAreaId, setChosenAreaId] = useState<string | undefined>();
  const [areaDropdownOpen, setAreaDropdownOpen] = useState(false);
  const [editAreasOpen, setEditAreasOpen] = useState(false);
  const [addRoomOpen, setAddRoomOpen] = useState(false);
  // Separate from selectedAreaId — after creating a brand-new area on
  // demand (see handleAddRoomClick), the areas query's refetch can lag a
  // render or two behind, during which selectedAreaId would still read as
  // undefined. This is set directly from the mutation's own return value,
  // so opening the sheet never races the cache.
  const [addRoomAreaId, setAddRoomAreaId] = useState<string | undefined>(undefined);
  const [extracting, setExtracting] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [reviewData, setReviewData] = useState<ExtractResponse | null>(null);
  const planFileInputRef = useRef<HTMLInputElement>(null);
  const extractFloorPlan = useExtractFloorPlan();
  const [myHizzelOpen, setMyHizzelOpen] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [editingRoomId, setEditingRoomId] = useState<string | null>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  // A real drag (pointerdown -> real movement -> pointerup) still fires a
  // plain click afterwards, same as any mouseup/touchend does — the
  // canvas background's own "click empty space to deselect" handler below
  // was swallowing the selection this same gesture had just set, right
  // after setting it. Set right when a drag concludes with real movement;
  // the canvas's onClick checks and clears it before deciding to deselect.
  const justDraggedRef = useRef(false);

  // A Things card dropped straight into a room (things-world.tsx's own
  // cross-world drag) should land in the toolbar exactly as if it had been
  // tapped here directly — otherwise the top bar keeps showing whatever
  // was selected before, even though the item you just placed is the one
  // that matters now. Subscribed directly (not via the useX(selector) +
  // effect-on-value combo) so the setState call happens inside the
  // subscription callback, not synchronously in the effect body itself —
  // this fires on every request even for the same id repeated back to
  // back, since useSelectItemStore.requestSelect always produces a new
  // state object.
  useEffect(() => {
    return useSelectItemStore.subscribe((state) => {
      if (!state.itemId) return;
      setSelectedItemId(state.itemId);
      setSelectedRoomId(null);
      // No flash() call here — things-world.tsx's own successful-placement
      // branch already flashes this id (flashingIds is global, so it
      // lights up this item's block here too), and the toolbar's flash
      // reads that same shared state once selectedItemId matches it.
    });
  }, []);

  // Default to the first area once loaded, without a setState-in-effect.
  const selectedAreaId =
    chosenAreaId && areas?.some((a) => a.id === chosenAreaId)
      ? chosenAreaId
      : areas?.[0]?.id;

  const selectedArea = areas?.find((a) => a.id === selectedAreaId);
  const { data: rooms } = useRooms(selectedAreaId);
  const updateArea = useUpdateArea(newProperty?.id);
  const createArea = useCreateArea(newProperty?.id);
  const updateRoomPosition = useUpdateRoomPosition(selectedAreaId);
  const updateRoom = useUpdateRoom();
  const { data: items } = useMoveItems(move?.id);
  const placeItem = usePlaceItem(move?.id);
  const flashingIds = useFlashStore((s) => s.flashingIds);
  const { hizzelUnlocked: accountUnlocked } = useBillingStatus();
  // The onboarding example move ("Hizzel Now" -> "Hizzel New", seeded for
  // every new signup) is a free intro demo, not a real move -- billing
  // gating never accounted for it, so exploring it hit the paywall
  // immediately. Every gate in this file reads this combined value, not
  // the raw account status.
  const hizzelUnlocked = accountUnlocked || !!move?.is_example;
  const posthog = usePostHog();

  const canvasRef = useRef<HTMLDivElement>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });

  function measureCanvas() {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    setCanvasSize({ width: rect.width, height: rect.height });
  }

  useIsomorphicLayoutEffect(() => {
    if (!canvasRef.current) return;
    const el = canvasRef.current;
    const observer = new ResizeObserver(() => measureCanvas());
    observer.observe(el);
    measureCanvas();
    return () => observer.disconnect();
  }, []);

  // The portrait 3-stop slider changes this world's height continuously
  // (every live drag pointermove, and every step of the snap-to-stop
  // animation) — re-measure each time so the room/item scale never uses a
  // stale size. Layout effect (not a plain effect), same reasoning as
  // AppShell's own orientation detection: this needs to re-measure using
  // the corrected `mode`/sizing *before* paint, not after — otherwise a
  // mode change (e.g. rotating into landscape) can paint once against the
  // still-transitioning layout, caching a near-zero size that only a later
  // real resize would ever correct.
  useIsomorphicLayoutEffect(() => {
    measureCanvas();
    // Belt-and-suspenders for real device rotation specifically: a live
    // report showed the landscape canvas coming out too narrow after
    // rotating while Full-Hizzel, on a real phone only (unreproducible
    // via simulated viewport resizes) — consistent with iOS Safari's
    // address-bar chrome still animating when `mode`/`sizePx` first
    // update. These catch a size that only settles a beat later.
    const t1 = setTimeout(measureCanvas, 150);
    const t2 = setTimeout(measureCanvas, 450);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [sizePx, mode]);

  // 32px of padding on a big desktop panel is unnoticeable; the same 32px
  // on a narrow mobile half-screen (landscape/mid/full) eats a much bigger
  // share of the already-tight space the plan has to work with.
  const canvasPaddingPx = mode === "desktop" ? 32 : 16;
  const scale = computeCanvasScale(rooms ?? [], canvasSize.width, canvasSize.height, canvasPaddingPx);

  const roomIdSet = new Set((rooms ?? []).map((r) => r.id));
  // The tray is a stable, EXPLICIT set — not "everything unassigned" (that's
  // Things world's own Unassigned list, which can be huge). A never-touched
  // thing, one dragged straight to the tray, and one merely moved to
  // Unassigned within Things can all read as roomId: null — inTray is the
  // explicit flag that tells them apart (see use-move-items.ts). Also not
  // "whatever isn't on the floor currently being viewed": an item placed in
  // a *different* area's room still has a roomId and must stay put, not
  // flicker into the tray just because that area isn't the one on screen
  // right now.
  const trayItems = (items ?? []).filter((i) => !i.roomId && i.inTray);
  const itemsByRoom = new Map<string, typeof trayItems>();
  for (const item of items ?? []) {
    if (item.roomId && roomIdSet.has(item.roomId)) {
      if (!itemsByRoom.has(item.roomId)) itemsByRoom.set(item.roomId, []);
      itemsByRoom.get(item.roomId)!.push(item);
    }
  }

  function startDrag(itemId: string, e: React.PointerEvent) {
    e.preventDefault();
    const startX = e.clientX;
    const startY = e.clientY;
    let moved = false;
    setDrag({ itemId, clientX: startX, clientY: startY });

    function handleMove(ev: PointerEvent) {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      if (Math.hypot(dx, dy) > 5) moved = true;
      setDrag((d) => (d ? { ...d, clientX: ev.clientX, clientY: ev.clientY } : d));
    }

    function handleUp(ev: PointerEvent) {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);

      if (!moved) {
        // Read (not a functional updater) — calling other stores' setState
        // from inside a setSelectedItemId updater callback previously threw
        // "Cannot update a component while rendering a different component"
        // (React treats functional updaters as part of the render phase).
        const next = selectedItemId === itemId ? null : itemId;
        setSelectedItemId(next);
        if (next) {
          // Flash the toolbar's new content on select, not deselect — a
          // packed room can make it unclear which item was actually hit,
          // so this confirms the tap registered and which one it landed on.
          useFlashStore.getState().flash(next);
          // Mirror the selection into Things — flash + scroll that item's
          // own card into view there too, so the connection between the
          // two views is obvious. Only ever reachable with Things visible
          // on screen at the same time: on mobile this selection only
          // happens in the full-Hizzel stop (Things at 0 width), and the
          // Mid thumbnail isn't tappable at all.
          useScrollToItemStore.getState().requestScroll(next);
        }
        setDrag(null);
        return;
      }

      // A real drag still fires a plain click right after this pointerup —
      // the canvas background's click-to-deselect handler needs to ignore
      // that one, or it immediately undoes whatever selection this drag's
      // own success branch below is about to set.
      justDraggedRef.current = true;

      const draggedItem = items?.find((i) => i.id === itemId);
      if (!draggedItem) {
        setDrag(null);
        return;
      }

      const el = document.elementFromPoint(ev.clientX, ev.clientY);
      const roomEl = el?.closest("[data-room-id]") as HTMLElement | null;
      const room = roomEl && rooms?.find((r) => r.id === roomEl.dataset.roomId);

      if (roomEl && room && !hizzelUnlocked) {
        // Gate the whole "dropped on a room" case here, before ever
        // checking fit — gating only the fits branch would let an
        // oversized item silently bounce to the tray with zero indication
        // Hizzel is locked at all.
        usePaywallStore.getState().open();
      } else if (roomEl && room) {
        const roomRect = roomEl.getBoundingClientRect();
        const localXcm = (ev.clientX - roomRect.left) / scale.pxPerCm;
        const localYcm = (ev.clientY - roomRect.top) / scale.pxPerCm;
        const { w, d } = rotatedFootprint(draggedItem);
        const targetX = localXcm - w / 2;
        const targetY = localYcm - d / 2;

        const roomItems = itemsByRoom.get(room.id) ?? [];
        const others = roomItems
          .filter((i) => i.id !== itemId)
          .map((i) => {
            const fp = rotatedFootprint(i);
            return { id: i.id, x: i.x_cm!, y: i.y_cm!, w: fp.w, d: fp.d };
          });

        const placed = resolvePlacement({ w, d }, targetX, targetY, room, others);
        if (!placed.fits) {
          // Too big for this room outright — reject, back to the tray.
          placeItem.mutate({
            thingId: itemId,
            roomId: null,
            x_cm: null,
            y_cm: null,
            rotation_deg: draggedItem.rotation_deg,
          });
          useFlashStore.getState().flash(itemId);
        } else {
          placeItem.mutate({
            thingId: itemId,
            roomId: room.id,
            x_cm: placed.x,
            y_cm: placed.y,
            rotation_deg: draggedItem.rotation_deg,
          });
          posthog?.capture("item_placed", { roomId: room.id });
          useFlashStore.getState().flash(itemId);
          // Same treatment as dropping a Things card in, and as tapping
          // the item directly: whatever you just moved is the thing the
          // toolbar (and Things' own list) should now point at, not
          // whatever was selected before the drag started.
          setSelectedItemId(itemId);
          setSelectedRoomId(null);
          useScrollToItemStore.getState().requestScroll(itemId);
          for (const bumped of placed.displaced) {
            const bumpedItem = roomItems.find((i) => i.id === bumped.id);
            if (!bumpedItem) continue;
            placeItem.mutate({
              thingId: bumped.id,
              roomId: room.id,
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
      } else if (draggedItem.roomId) {
        placeItem.mutate({
          thingId: itemId,
          roomId: null,
          x_cm: null,
          y_cm: null,
          rotation_deg: draggedItem.rotation_deg,
        });
      }

      setDrag(null);
    }

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
  }

  function handleRotate(itemId: string) {
    const item = items?.find((i) => i.id === itemId);
    if (!item || item.x_cm == null || item.y_cm == null || !item.roomId) return;
    if (!hizzelUnlocked) {
      usePaywallStore.getState().open();
      return;
    }
    const room = rooms?.find((r) => r.id === item.roomId);
    if (!room) return;

    const newRotation = (item.rotation_deg + 90) % 360;
    const newFootprint = rotatedFootprint({ ...item, rotation_deg: newRotation });
    const roomItems = itemsByRoom.get(item.roomId) ?? [];
    const others = roomItems
      .filter((i) => i.id !== itemId)
      .map((i) => {
        const fp = rotatedFootprint(i);
        return { id: i.id, x: i.x_cm!, y: i.y_cm!, w: fp.w, d: fp.d };
      });
    const placed = resolvePlacement(newFootprint, item.x_cm, item.y_cm, room, others);
    if (!placed.fits) {
      // Rotated footprint doesn't fit the room at all — reject the
      // rotation entirely; the item stays exactly as it was.
      return;
    }
    placeItem.mutate({
      thingId: itemId,
      roomId: item.roomId,
      x_cm: placed.x,
      y_cm: placed.y,
      rotation_deg: newRotation,
    });
    for (const bumped of placed.displaced) {
      const bumpedItem = roomItems.find((i) => i.id === bumped.id);
      if (!bumpedItem) continue;
      placeItem.mutate({
        thingId: bumped.id,
        roomId: item.roomId,
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

  // A room "rotate" is just a width/depth swap — a room is a plain
  // rectangle in this 2D plan, so there's nothing else a 90° turn would
  // need to change. No fit/collision check against sibling rooms (unlike
  // item rotate) — this is a quick fix-up tool for AI-guessed orientation,
  // not a placement engine; if it overlaps afterward, dragging already
  // handles nudging rooms apart.
  function handleRotateRoom(roomId: string) {
    if (!hizzelUnlocked) {
      usePaywallStore.getState().open();
      return;
    }
    const room = rooms?.find((r) => r.id === roomId);
    if (!room) return;
    updateRoom.mutate({ id: room.id, width_cm: room.depth_cm, depth_cm: room.width_cm });
  }

  const draggedItem = drag ? items?.find((i) => i.id === drag.itemId) : undefined;
  const selectedItem = selectedItemId ? items?.find((i) => i.id === selectedItemId) : undefined;
  const selectedRoom = selectedRoomId ? rooms?.find((r) => r.id === selectedRoomId) : undefined;
  const hasSelection = !!selectedItem || !!selectedRoom;
  const selectedFlashing = !!(
    (selectedItemId && flashingIds.has(selectedItemId)) ||
    (selectedRoomId && flashingIds.has(selectedRoomId))
  );
  const selectedFlashColor = selectedItem
    ? categoryFlashColor(selectedItem.category)
    : "rgba(220, 215, 205, 0.55)";
  // The toolbar keeps the item's own colour for as long as it stays
  // selected (not just the initial flash) — a room has no category colour
  // of its own, so it keeps the plain neutral toolbar background.
  const selectedItemBold = selectedItem ? CATEGORY_COLORS[selectedItem.category].bold : null;
  const toolbarLabelClass = selectedItemBold ? "text-white/85" : "text-dark-tool-label";

  async function handlePlanFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file later
    if (!file) return;
    setExtracting(true);
    setUploadError(null);
    try {
      const result = await extractFloorPlan.mutateAsync(file);
      setReviewData(result);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Couldn't read that file");
    } finally {
      setExtracting(false);
    }
  }

  // "+ Room" was a no-op whenever the property had zero areas yet (e.g.
  // right after "+ New move", which deliberately starts area-less) —
  // selectedAreaId falls back to areas?.[0]?.id, which is undefined with
  // no areas, and the sheet's render guard silently skipped opening. This
  // transparently creates a first area on demand so the button always
  // works, matching "the clear, obvious path for anyone without a plan".
  async function handleAddRoomClick() {
    // Deliberately accountUnlocked, not hizzelUnlocked — adding a room /
    // uploading a plan is the actual paid feature, not just trying the
    // example out. Everything else in this file uses the example-exempt
    // value; these two don't.
    if (!accountUnlocked) {
      usePaywallStore.getState().open();
      return;
    }
    let areaId = selectedAreaId;
    if (!areaId && newProperty?.id) {
      try {
        areaId = await createArea.mutateAsync("Ground floor");
        setChosenAreaId(areaId);
      } catch (err) {
        console.error("Couldn't create a default area for the first room", err);
        return;
      }
    }
    if (!areaId) return;
    setAddRoomAreaId(areaId);
    setAddRoomOpen(true);
  }

  function handlePlanButtonClick() {
    // Deliberately accountUnlocked, not hizzelUnlocked — see
    // handleAddRoomClick's comment above.
    if (!accountUnlocked) {
      usePaywallStore.getState().open();
      return;
    }
    if ((areas?.length ?? 0) > 0) {
      const confirmed = window.confirm(
        "Uploading a new plan will delete your existing floor plan — all its areas and rooms will be removed, and anything placed in them returned to the tray. Continue?",
      );
      if (!confirmed) return;
    }
    planFileInputRef.current?.click();
  }

  if (mode === "sliver") {
    return (
      <button
        type="button"
        onClick={onJumpToFull}
        aria-label="Open Hizzel"
        className="flex w-full shrink-0 items-center justify-end gap-2.5 bg-dark px-5 text-right"
        style={{ height: SLIVER_HEIGHT_PX }}
      >
        <div className="flex flex-col items-end">
          <span className="font-serif text-[15px] leading-none text-dark-ink">
            {newProperty?.nickname ?? "…"}
          </span>
          <span className="mt-[2px] text-[8px] text-dark-ink-tertiary">
            {selectedArea?.name ?? "No area yet"}
          </span>
        </div>
        <Image src="/logo-on-dark.png" alt="" width={20} height={20} />
      </button>
    );
  }

  return (
    <div
      className={`relative flex min-h-0 w-full shrink-0 flex-col overflow-hidden bg-dark ${
        mode === "desktop" ? "lg:!w-1/2 lg:!h-full" : ""
      }`}
      style={
        mode === "landscape"
          ? { width: landscapeWidthPx, height: landscapeHeightPx }
          : { height: sizePx }
      }
    >
      <div
        className={`relative flex items-start justify-end gap-3 px-5 pt-3.5 pb-2.5 ${
          mode === "desktop" ? "lg:gap-3.5 lg:px-9 lg:pt-7 lg:pb-3.5" : ""
        }`}
      >
        {mode === "mid" && onExpand && (
          // Left side, opposite the logo button (which sits at the right
          // edge of this header, per the flex-row-reverse group below) —
          // matches Things' own expand icon sitting opposite its logo too.
          <button
            type="button"
            onClick={onExpand}
            aria-label="Expand Hizzel"
            className="absolute top-3.5 left-5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-dark-ink/[.07] text-dark-tool-label"
          >
            <IconArrowsMaximize size={15} />
          </button>
        )}
        <div className="flex flex-row-reverse items-start gap-3">
          <button
            type="button"
            onClick={() => setMyHizzelOpen(true)}
            aria-label="Open My Hizzel"
            className="flex h-[42px] w-[42px] shrink-0 items-center justify-center"
          >
            <Image src="/logo-on-dark.png" alt="" width={38} height={38} />
          </button>
          <div
            className={`relative flex flex-col items-end text-right ${
              mode === "desktop" ? "flex-1 lg:flex-initial" : ""
            }`}
          >
            <div
              className={`mb-0.5 text-[9px] tracking-[0.14em] text-dark-ink-secondary uppercase ${
                mode === "desktop" ? "lg:text-[11px]" : ""
              }`}
            >
              Hizzel
            </div>
            <h1
              className={`font-serif leading-none tracking-[-0.3px] text-dark-ink ${
                mode === "desktop" ? "text-[22px] lg:text-[32px]" : "text-[18px]"
              }`}
            >
              {newProperty?.nickname ?? "…"}
            </h1>
            <button
              type="button"
              onClick={() => setAreaDropdownOpen((v) => !v)}
              className="mt-[3px] flex items-center gap-1 text-[11px] text-dark-ink-tertiary lg:justify-end"
            >
              {selectedArea?.name ?? "No area yet"}
              <IconChevronDown size={10} />
            </button>
            {areaDropdownOpen && (
              <AreaDropdown
                areas={areas ?? []}
                selectedAreaId={selectedAreaId}
                onSelect={(id) => {
                  setChosenAreaId(id);
                  setAreaDropdownOpen(false);
                }}
                onEditAreas={() => {
                  setAreaDropdownOpen(false);
                  if (!hizzelUnlocked) {
                    usePaywallStore.getState().open();
                    return;
                  }
                  setEditAreasOpen(true);
                }}
              />
            )}
          </div>
        </div>
      </div>

      <div
        className={`flex flex-row-reverse items-center justify-end gap-[5px] px-5 pb-2.5 ${
          mode === "desktop" ? "lg:gap-[7px] lg:px-9" : ""
        }`}
      >
        <button
          type="button"
          onClick={handleAddRoomClick}
          disabled={createArea.isPending}
          className="flex items-center gap-1 rounded-[10px] border-[0.5px] border-dark-ink/10 bg-dark-ink/[.07] px-3.5 py-[7px] text-[11px] font-medium whitespace-nowrap text-dark-tool-label disabled:opacity-60"
        >
          <IconPlus size={12} /> Room
        </button>
        <button
          type="button"
          onClick={handlePlanButtonClick}
          disabled={extracting}
          className="flex items-center gap-1 rounded-[10px] border-[0.5px] border-dark-ink/10 bg-dark-ink/[.07] px-3.5 py-[7px] text-[11px] font-medium whitespace-nowrap text-dark-tool-label disabled:opacity-60"
        >
          <IconUpload size={12} /> {extracting ? "Reading…" : "Plan"}
        </button>
        <input
          ref={planFileInputRef}
          type="file"
          accept="image/*,application/pdf"
          className="hidden"
          onChange={handlePlanFileSelected}
        />
        <button
          type="button"
          onClick={() => {
            if (!selectedArea) return;
            if (!hizzelUnlocked) {
              usePaywallStore.getState().open();
              return;
            }
            updateArea.mutate({ id: selectedArea.id, is_locked: !selectedArea.is_locked });
          }}
          aria-label={selectedArea?.is_locked ? "Unlock area" : "Lock area"}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] border-[0.5px] border-dark-ink/10 bg-dark-ink/[.07] text-dark-tool-label"
        >
          {selectedArea?.is_locked ? <IconLock size={14} /> : <IconLockOpen size={14} />}
        </button>
        {/* Right of the padlock on mobile (plain DOM order); the outer
            row's lg:flex-row-reverse flips that to left-of-padlock on
            desktop, with no reversal needed on this group's own children —
            rotate, edit, name, close reads the same way on both. */}
        {hasSelection && (
          <div
            className={`flex items-center gap-1 rounded-[10px] border-[0.5px] border-dark-ink/10 px-2 py-[5px] ${
              selectedItemBold ? "" : "bg-dark-ink/[.07]"
            } ${selectedFlashing ? "animate-item-flash" : ""}`}
            style={{
              ...(selectedItemBold ? { backgroundColor: selectedItemBold } : {}),
              ...(selectedFlashing
                ? ({ "--flash-color": selectedFlashColor } as React.CSSProperties)
                : {}),
            }}
          >
            <button
              type="button"
              onClick={() => {
                if (selectedItem) handleRotate(selectedItem.id);
                else if (selectedRoom) handleRotateRoom(selectedRoom.id);
              }}
              aria-label="Rotate"
              className={`flex h-6 w-6 shrink-0 items-center justify-center ${toolbarLabelClass}`}
            >
              <IconRotate size={13} />
            </button>
            <button
              type="button"
              onClick={() => {
                if (selectedItem) setEditingItemId(selectedItem.id);
                else if (selectedRoom) {
                  if (!hizzelUnlocked) {
                    usePaywallStore.getState().open();
                    return;
                  }
                  setEditingRoomId(selectedRoom.id);
                }
              }}
              aria-label="Edit"
              className={`flex h-6 w-6 shrink-0 items-center justify-center ${toolbarLabelClass}`}
            >
              <IconPencil size={13} />
            </button>
            <span
              className={`max-w-[88px] truncate text-[11px] font-medium whitespace-nowrap lg:max-w-[160px] ${toolbarLabelClass}`}
            >
              {selectedItem?.name ?? selectedRoom?.name}
            </span>
            <button
              type="button"
              onClick={() => {
                setSelectedItemId(null);
                setSelectedRoomId(null);
              }}
              aria-label="Deselect"
              className={`flex h-6 w-6 shrink-0 items-center justify-center ${toolbarLabelClass}`}
            >
              <IconX size={13} />
            </button>
          </div>
        )}
        <div className="flex-1" />
        <button
          type="button"
          aria-label="Search"
          className={`${hasSelection ? "hidden lg:flex" : "flex"} h-9 w-10 shrink-0 items-center justify-center rounded-[10px] border-[0.5px] border-dark-ink/10 bg-dark-ink/[.07] text-dark-ink-secondary`}
        >
          <IconSearch size={16} />
        </button>
      </div>

      {uploadError && (
        <button
          type="button"
          onClick={() => setUploadError(null)}
          className="mx-5 mb-2 rounded-[10px] bg-dark-ink/[.07] px-3.5 py-2 text-left text-[11px] text-dark-ink-secondary"
        >
          {uploadError}
        </button>
      )}

      <div
        ref={canvasRef}
        onClick={() => {
          if (justDraggedRef.current) {
            justDraggedRef.current = false;
            return;
          }
          setSelectedItemId(null);
          setSelectedRoomId(null);
        }}
        className="relative flex-1 overflow-hidden"
      >
        <div className="absolute top-2.5 right-2.5 text-[9px] font-medium tracking-[0.1em] text-dark-ink/20">
          N ↑
        </div>
        {rooms?.map((room) => (
          <RoomBlock
            key={room.id}
            room={room}
            scale={scale}
            locked={!!selectedArea?.is_locked}
            billingLocked={!hizzelUnlocked}
            onBillingLockedAttempt={() => usePaywallStore.getState().open()}
            selected={selectedRoomId === room.id}
            otherRooms={rooms.filter((r) => r.id !== room.id)}
            onDragEnd={(x, y) => updateRoomPosition.mutate({ id: room.id, canvas_x: x, canvas_y: y })}
            onSelect={() => {
              setSelectedRoomId(room.id);
              setSelectedItemId(null);
              useFlashStore.getState().flash(room.id);
            }}
          >
            {(itemsByRoom.get(room.id) ?? []).map((item) =>
              item.x_cm == null || item.y_cm == null ? null : (
                <ItemBlock
                  key={item.id}
                  item={{ ...item, x_cm: item.x_cm, y_cm: item.y_cm }}
                  scale={scale}
                  selected={selectedItemId === item.id}
                  dragging={drag?.itemId === item.id}
                  onPointerDown={(e) => startDrag(item.id, e)}
                />
              ),
            )}
          </RoomBlock>
        ))}
        {rooms?.length === 0 && (
          <p className="absolute inset-0 flex items-center justify-center px-10 text-center text-sm text-dark-ink-tertiary">
            Add a room or upload a plan
          </p>
        )}
      </div>

      {/* data-hizzel-tray marks this as a valid cross-world drop target
          (see things-world.tsx's startCardDrag) — always rendered, even
          with zero items, so dragging the very first thing into an empty
          tray still has somewhere to land. empty:py-0 collapses it to no
          height when there's nothing in it, so it stays invisible.
          Disabled — see TRAY_ENABLED above. */}
      {TRAY_ENABLED && (
        <div
          data-hizzel-tray
          className="flex shrink-0 gap-3 overflow-x-auto px-4 py-3 empty:py-0 [scrollbar-width:none] lg:pl-24"
        >
          {trayItems.map((item) => (
            <TrayCard
              key={item.id}
              item={item}
              dragging={drag?.itemId === item.id}
              onPointerDown={(e) => startDrag(item.id, e)}
            />
          ))}
        </div>
      )}

      {addRoomOpen && addRoomAreaId && (
        <RoomFormSheet
          areaId={addRoomAreaId}
          onClose={() => {
            setAddRoomOpen(false);
            setAddRoomAreaId(undefined);
          }}
        />
      )}
      {editAreasOpen && newProperty && (
        <EditAreasSheet propertyId={newProperty.id} onClose={() => setEditAreasOpen(false)} />
      )}
      {myHizzelOpen && <MyHizzelOverlay onClose={() => setMyHizzelOpen(false)} />}
      {editingItemId &&
        (() => {
          const editingItem = items?.find((i) => i.id === editingItemId);
          return editingItem ? (
            <ThingFormSheet thing={editingItem} onClose={() => setEditingItemId(null)} />
          ) : null;
        })()}
      {editingRoomId &&
        selectedAreaId &&
        (() => {
          const editingRoom = rooms?.find((r) => r.id === editingRoomId);
          return editingRoom ? (
            <RoomFormSheet
              areaId={selectedAreaId}
              moveId={move?.id}
              room={editingRoom}
              areas={areas}
              onClose={() => setEditingRoomId(null)}
            />
          ) : null;
        })()}
      {reviewData && newProperty && (
        <FloorPlanReviewSheet
          propertyId={newProperty.id}
          moveId={move?.id}
          hasExistingPlan={(areas?.length ?? 0) > 0}
          extraction={reviewData}
          onClose={() => setReviewData(null)}
        />
      )}

      {drag && draggedItem && (
        <DragGhost item={draggedItem} clientX={drag.clientX} clientY={drag.clientY} scale={scale} />
      )}
    </div>
  );
}
