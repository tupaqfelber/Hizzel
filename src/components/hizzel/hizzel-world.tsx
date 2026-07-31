"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
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
} from "@tabler/icons-react";
import { useCurrentMove } from "@/hooks/use-current-move";
import { useAreas, useUpdateArea } from "@/hooks/use-areas";
import { useRooms, useUpdateRoomPosition, useUpdateRoom } from "@/hooks/use-rooms";
import { useMoveItems, usePlaceItem } from "@/hooks/use-move-items";
import {
  useStructuralElements,
  useCreateStructuralElement,
  useUpdateStructuralElement,
} from "@/hooks/use-structural-elements";
import { useFlashStore } from "@/hooks/use-flash-store";
import { categoryFlashColor } from "@/lib/category-colors";
import { computeCanvasScale } from "@/lib/canvas-scale";
import { rotatedFootprint, resolvePlacement } from "@/lib/item-snap";
import { resolveWallDrop, STRUCTURAL_DEFAULT_WIDTH_CM } from "@/lib/wall-snap";
import { STRUCTURAL_COLORS, structuralFlashColor } from "@/lib/structural-colors";
import { RoomBlock } from "@/components/hizzel/room-block";
import { ItemBlock } from "@/components/hizzel/item-block";
import { StructuralBlock } from "@/components/hizzel/structural-block";
import { StructuralChip } from "@/components/hizzel/structural-chip";
import { StructuralFormSheet } from "@/components/hizzel/structural-form-sheet";
import { TrayCard } from "@/components/hizzel/tray-card";
import { DragGhost } from "@/components/hizzel/drag-ghost";
import { MyHizzelOverlay } from "@/components/my-hizzel/my-hizzel-overlay";
import { AreaDropdown } from "@/components/hizzel/area-dropdown";
import { RoomFormSheet } from "@/components/hizzel/room-form-sheet";
import { EditAreasSheet } from "@/components/hizzel/edit-areas-sheet";
import { ThingFormSheet } from "@/components/things/thing-form-sheet";
import { FloorPlanReviewSheet } from "@/components/hizzel/floorplan-review-sheet";
import { useExtractFloorPlan, type ExtractResponse } from "@/hooks/use-floorplan-import";
import type { StructuralType } from "@/lib/supabase/types";

interface DragState {
  itemId: string;
  clientX: number;
  clientY: number;
}

interface StructuralDragState {
  type: StructuralType;
  clientX: number;
  clientY: number;
}

export function HizzelWorld({
  widthPx,
  mobileActive,
}: {
  widthPx: number;
  mobileActive: boolean;
}) {
  const { data: move } = useCurrentMove();
  const newProperty = move?.properties.find((p) => p.role === "new");

  const { data: areas } = useAreas(newProperty?.id);
  const [chosenAreaId, setChosenAreaId] = useState<string | undefined>();
  const [areaDropdownOpen, setAreaDropdownOpen] = useState(false);
  const [editAreasOpen, setEditAreasOpen] = useState(false);
  const [addRoomOpen, setAddRoomOpen] = useState(false);
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
  const [selectedStructuralId, setSelectedStructuralId] = useState<string | null>(null);
  const [editingStructuralId, setEditingStructuralId] = useState<string | null>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [structuralDrag, setStructuralDrag] = useState<StructuralDragState | null>(null);

  // Default to the first area once loaded, without a setState-in-effect.
  const selectedAreaId =
    chosenAreaId && areas?.some((a) => a.id === chosenAreaId)
      ? chosenAreaId
      : areas?.[0]?.id;

  const selectedArea = areas?.find((a) => a.id === selectedAreaId);
  const { data: rooms } = useRooms(selectedAreaId);
  const updateArea = useUpdateArea(newProperty?.id);
  const updateRoomPosition = useUpdateRoomPosition(selectedAreaId);
  const updateRoom = useUpdateRoom();
  const { data: items } = useMoveItems(move?.id);
  const placeItem = usePlaceItem(move?.id);
  const { data: structuralElements } = useStructuralElements(rooms?.map((r) => r.id));
  const createStructuralElement = useCreateStructuralElement();
  const updateStructuralElement = useUpdateStructuralElement();
  const flashingIds = useFlashStore((s) => s.flashingIds);

  const canvasRef = useRef<HTMLDivElement>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });

  function measureCanvas() {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    setCanvasSize({ width: rect.width, height: rect.height });
  }

  useEffect(() => {
    if (!canvasRef.current) return;
    const el = canvasRef.current;
    const observer = new ResizeObserver(() => measureCanvas());
    observer.observe(el);
    measureCanvas();
    return () => observer.disconnect();
  }, []);

  // The mobile 3-stop slider changes this world's width continuously (every
  // live drag pointermove, and every step of the snap-to-stop animation) —
  // re-measure each time so the room/item scale never uses a stale width.
  useEffect(() => {
    measureCanvas();
  }, [widthPx]);

  const scale = computeCanvasScale(rooms ?? [], canvasSize.width, canvasSize.height);

  const roomIdSet = new Set((rooms ?? []).map((r) => r.id));
  const trayItems = (items ?? []).filter((i) => !i.roomId || !roomIdSet.has(i.roomId));
  const itemsByRoom = new Map<string, typeof trayItems>();
  for (const item of items ?? []) {
    if (item.roomId && roomIdSet.has(item.roomId)) {
      if (!itemsByRoom.has(item.roomId)) itemsByRoom.set(item.roomId, []);
      itemsByRoom.get(item.roomId)!.push(item);
    }
  }

  const elementsByRoom = new Map<string, NonNullable<typeof structuralElements>>();
  for (const el of structuralElements ?? []) {
    if (!elementsByRoom.has(el.room_id)) elementsByRoom.set(el.room_id, []);
    elementsByRoom.get(el.room_id)!.push(el);
  }

  function startChipDrag(type: StructuralType, e: React.PointerEvent) {
    e.preventDefault();
    const startX = e.clientX;
    const startY = e.clientY;
    setStructuralDrag({ type, clientX: startX, clientY: startY });

    function handleMove(ev: PointerEvent) {
      setStructuralDrag((d) => (d ? { ...d, clientX: ev.clientX, clientY: ev.clientY } : d));
    }

    function handleUp(ev: PointerEvent) {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);

      const el = document.elementFromPoint(ev.clientX, ev.clientY);
      const roomEl = el?.closest("[data-room-id]") as HTMLElement | null;
      const room = roomEl && rooms?.find((r) => r.id === roomEl.dataset.roomId);

      if (roomEl && room) {
        const roomRect = roomEl.getBoundingClientRect();
        const localXcm = (ev.clientX - roomRect.left) / scale.pxPerCm;
        const localYcm = (ev.clientY - roomRect.top) / scale.pxPerCm;
        const width = STRUCTURAL_DEFAULT_WIDTH_CM[type];
        const result = resolveWallDrop(width, localXcm, localYcm, room, elementsByRoom.get(room.id) ?? []);
        if (result.fits) {
          createStructuralElement.mutate({
            room_id: room.id,
            type,
            wall_side: result.wall_side,
            offset_cm: result.offset_cm,
            width_cm: width,
          });
        }
      }

      setStructuralDrag(null);
    }

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
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
        setSelectedItemId((curr) => {
          const next = curr === itemId ? null : itemId;
          // Flash the toolbar's new content on select, not deselect — a
          // packed room can make it unclear which item was actually hit,
          // so this confirms the tap registered and which one it landed on.
          if (next) useFlashStore.getState().flash(next);
          return next;
        });
        setDrag(null);
        return;
      }

      const draggedItem = items?.find((i) => i.id === itemId);
      if (!draggedItem) {
        setDrag(null);
        return;
      }

      const el = document.elementFromPoint(ev.clientX, ev.clientY);
      const roomEl = el?.closest("[data-room-id]") as HTMLElement | null;
      const room = roomEl && rooms?.find((r) => r.id === roomEl.dataset.roomId);

      if (roomEl && room) {
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
          useFlashStore.getState().flash(itemId);
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
    const room = rooms?.find((r) => r.id === roomId);
    if (!room) return;
    updateRoom.mutate({ id: room.id, width_cm: room.depth_cm, depth_cm: room.width_cm });
  }

  const draggedItem = drag ? items?.find((i) => i.id === drag.itemId) : undefined;
  const selectedItem = selectedItemId ? items?.find((i) => i.id === selectedItemId) : undefined;
  const selectedRoom = selectedRoomId ? rooms?.find((r) => r.id === selectedRoomId) : undefined;
  const selectedStructural = selectedStructuralId
    ? structuralElements?.find((e) => e.id === selectedStructuralId)
    : undefined;
  const hasSelection = !!selectedItem || !!selectedRoom || !!selectedStructural;
  const selectedFlashing = !!(
    (selectedItemId && flashingIds.has(selectedItemId)) ||
    (selectedRoomId && flashingIds.has(selectedRoomId)) ||
    (selectedStructuralId && flashingIds.has(selectedStructuralId))
  );
  const selectedFlashColor = selectedItem
    ? categoryFlashColor(selectedItem.category)
    : selectedStructural
      ? structuralFlashColor(selectedStructural.type)
      : "rgba(220, 215, 205, 0.55)";

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

  function handlePlanButtonClick() {
    if ((areas?.length ?? 0) > 0) {
      const confirmed = window.confirm(
        "Uploading a new plan will delete your existing floor plan — all its areas and rooms will be removed, and anything placed in them returned to the tray. Continue?",
      );
      if (!confirmed) return;
    }
    planFileInputRef.current?.click();
  }

  return (
    <div
      className={`relative ${mobileActive ? "flex" : "hidden"} h-dvh min-w-0 shrink-0 flex-col overflow-hidden bg-dark lg:flex lg:!w-1/2 lg:h-full ${widthPx === 0 ? "max-lg:pointer-events-none" : ""}`}
      style={{ width: `${widthPx}px` }}
    >
      <div className="flex items-center gap-3 px-5 pt-3.5 pb-2.5 lg:items-start lg:justify-end lg:gap-3.5 lg:px-9 lg:pt-7 lg:pb-3.5">
        <div className="flex items-center gap-3 lg:flex-row-reverse lg:items-start">
          <button
            type="button"
            onClick={() => setMyHizzelOpen(true)}
            aria-label="Open My Hizzel"
            className="flex h-[42px] w-[42px] shrink-0 items-center justify-center"
          >
            <Image src="/logo-on-dark.png" alt="" width={38} height={38} />
          </button>
          <div className="relative flex-1 lg:flex-initial lg:flex lg:flex-col lg:items-end lg:text-right">
            <div className="mb-0.5 text-[9px] tracking-[0.14em] text-dark-ink-secondary uppercase lg:text-[11px]">
              Hizzel
            </div>
            <h1 className="font-serif text-[22px] leading-none tracking-[-0.3px] text-dark-ink lg:text-[32px]">
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
                  setEditAreasOpen(true);
                }}
              />
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-[5px] px-5 pb-2.5 lg:justify-end lg:gap-[7px] lg:px-9 lg:flex-row-reverse">
        <button
          type="button"
          onClick={() => setAddRoomOpen(true)}
          className="flex items-center gap-1 rounded-[10px] border-[0.5px] border-dark-ink/10 bg-dark-ink/[.07] px-3.5 py-[7px] text-[11px] font-medium whitespace-nowrap text-dark-tool-label"
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
          onClick={() =>
            selectedArea &&
            updateArea.mutate({ id: selectedArea.id, is_locked: !selectedArea.is_locked })
          }
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
            className={`flex items-center gap-1 rounded-[10px] border-[0.5px] border-dark-ink/10 bg-dark-ink/[.07] px-2 py-[5px] ${
              selectedFlashing ? "animate-item-flash" : ""
            }`}
            style={
              selectedFlashing
                ? ({ "--flash-color": selectedFlashColor } as React.CSSProperties)
                : undefined
            }
          >
            {!selectedStructural && (
              <button
                type="button"
                onClick={() => {
                  if (selectedItem) handleRotate(selectedItem.id);
                  else if (selectedRoom) handleRotateRoom(selectedRoom.id);
                }}
                aria-label="Rotate"
                className="flex h-6 w-6 shrink-0 items-center justify-center text-dark-tool-label"
              >
                <IconRotate size={13} />
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                if (selectedItem) setEditingItemId(selectedItem.id);
                else if (selectedRoom) setEditingRoomId(selectedRoom.id);
                else if (selectedStructural) setEditingStructuralId(selectedStructural.id);
              }}
              aria-label="Edit"
              className="flex h-6 w-6 shrink-0 items-center justify-center text-dark-tool-label"
            >
              <IconPencil size={13} />
            </button>
            <span className="max-w-[88px] truncate text-[11px] font-medium whitespace-nowrap text-dark-tool-label lg:max-w-[160px]">
              {selectedItem?.name ?? selectedRoom?.name ?? (selectedStructural?.type === "door" ? "Door" : "Window")}
            </span>
            <button
              type="button"
              onClick={() => {
                setSelectedItemId(null);
                setSelectedRoomId(null);
                setSelectedStructuralId(null);
              }}
              aria-label="Deselect"
              className="flex h-6 w-6 shrink-0 items-center justify-center text-dark-tool-label"
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
          setSelectedItemId(null);
          setSelectedRoomId(null);
          setSelectedStructuralId(null);
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
            selected={selectedRoomId === room.id}
            otherRooms={rooms.filter((r) => r.id !== room.id)}
            onDragEnd={(x, y) => updateRoomPosition.mutate({ id: room.id, canvas_x: x, canvas_y: y })}
            onSelect={() => {
              setSelectedRoomId(room.id);
              setSelectedItemId(null);
              setSelectedStructuralId(null);
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
            {(elementsByRoom.get(room.id) ?? []).map((el) => (
              <StructuralBlock
                key={el.id}
                element={el}
                room={room}
                scale={scale}
                otherElements={(elementsByRoom.get(room.id) ?? []).filter((o) => o.id !== el.id)}
                selected={selectedStructuralId === el.id}
                onSelect={() => {
                  setSelectedStructuralId(el.id);
                  setSelectedItemId(null);
                  setSelectedRoomId(null);
                  useFlashStore.getState().flash(el.id);
                }}
                onDragEnd={(wallSide, offsetCm) =>
                  updateStructuralElement.mutate({ id: el.id, wall_side: wallSide, offset_cm: offsetCm })
                }
              />
            ))}
          </RoomBlock>
        ))}
        {rooms?.length === 0 && (
          <p className="absolute inset-0 flex items-center justify-center px-10 text-center text-sm text-dark-ink-tertiary">
            Add a room or upload a plan
          </p>
        )}
      </div>

      <div className="flex shrink-0 gap-3 overflow-x-auto px-4 py-3 [scrollbar-width:none] lg:pl-24">
        {trayItems.map((item) => (
          <TrayCard
            key={item.id}
            item={item}
            dragging={drag?.itemId === item.id}
            onPointerDown={(e) => startDrag(item.id, e)}
          />
        ))}
        <StructuralChip
          type="door"
          dragging={structuralDrag?.type === "door"}
          onPointerDown={(e) => startChipDrag("door", e)}
        />
        <StructuralChip
          type="window"
          dragging={structuralDrag?.type === "window"}
          onPointerDown={(e) => startChipDrag("window", e)}
        />
      </div>

      {/* Reserves space for the shared bottom toggle bar, now rendered by
          AppShell as a fixed overlay spanning both worlds. */}
      <div className="h-[72px] shrink-0 lg:hidden" />

      {addRoomOpen && selectedAreaId && (
        <RoomFormSheet areaId={selectedAreaId} onClose={() => setAddRoomOpen(false)} />
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
      {editingStructuralId &&
        (() => {
          const el = structuralElements?.find((e) => e.id === editingStructuralId);
          const elRoom = el && rooms?.find((r) => r.id === el.room_id);
          if (!el || !elRoom) return null;
          return (
            <StructuralFormSheet
              element={el}
              room={elRoom}
              otherElements={(elementsByRoom.get(el.room_id) ?? []).filter((o) => o.id !== el.id)}
              onClose={() => setEditingStructuralId(null)}
            />
          );
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
      {structuralDrag && (
        <div
          className="pointer-events-none fixed z-[60] -translate-x-1/2 -translate-y-1/2 rounded-[1px] opacity-70"
          style={{
            left: structuralDrag.clientX,
            top: structuralDrag.clientY,
            width: Math.max(STRUCTURAL_DEFAULT_WIDTH_CM[structuralDrag.type] * scale.pxPerCm, 24),
            height: 6,
            backgroundColor: STRUCTURAL_COLORS[structuralDrag.type],
          }}
        />
      )}
    </div>
  );
}
