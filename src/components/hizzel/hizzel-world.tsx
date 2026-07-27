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
import { useRooms, useUpdateRoomPosition } from "@/hooks/use-rooms";
import { useMoveItems, usePlaceItem } from "@/hooks/use-move-items";
import { useFlashStore } from "@/hooks/use-flash-store";
import { categoryFlashColor } from "@/lib/category-colors";
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

interface DragState {
  itemId: string;
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
  const [myHizzelOpen, setMyHizzelOpen] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [drag, setDrag] = useState<DragState | null>(null);

  // Default to the first area once loaded, without a setState-in-effect.
  const selectedAreaId =
    chosenAreaId && areas?.some((a) => a.id === chosenAreaId)
      ? chosenAreaId
      : areas?.[0]?.id;

  const selectedArea = areas?.find((a) => a.id === selectedAreaId);
  const { data: rooms } = useRooms(selectedAreaId);
  const updateArea = useUpdateArea(newProperty?.id);
  const updateRoomPosition = useUpdateRoomPosition(selectedAreaId);
  const { data: items } = useMoveItems(move?.id);
  const placeItem = usePlaceItem(move?.id);
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

  const draggedItem = drag ? items?.find((i) => i.id === drag.itemId) : undefined;
  const selectedItem = selectedItemId ? items?.find((i) => i.id === selectedItemId) : undefined;
  const selectedItemFlashing = selectedItemId ? flashingIds.has(selectedItemId) : false;

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
          className="flex items-center gap-1 rounded-[10px] border-[0.5px] border-dark-ink/10 bg-dark-ink/[.07] px-3.5 py-[7px] text-[11px] font-medium whitespace-nowrap text-dark-tool-label"
        >
          <IconUpload size={12} /> Plan
        </button>
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
        {selectedItem && (
          <div
            className={`flex items-center gap-1 rounded-[10px] border-[0.5px] border-dark-ink/10 bg-dark-ink/[.07] px-2 py-[5px] ${
              selectedItemFlashing ? "animate-item-flash" : ""
            }`}
            style={
              selectedItemFlashing
                ? ({ "--flash-color": categoryFlashColor(selectedItem.category) } as React.CSSProperties)
                : undefined
            }
          >
            <button
              type="button"
              onClick={() => handleRotate(selectedItem.id)}
              aria-label="Rotate"
              className="flex h-6 w-6 shrink-0 items-center justify-center text-dark-tool-label"
            >
              <IconRotate size={13} />
            </button>
            <button
              type="button"
              onClick={() => setEditingItemId(selectedItem.id)}
              aria-label="Edit"
              className="flex h-6 w-6 shrink-0 items-center justify-center text-dark-tool-label"
            >
              <IconPencil size={13} />
            </button>
            <span className="max-w-[88px] truncate text-[11px] font-medium whitespace-nowrap text-dark-tool-label lg:max-w-[160px]">
              {selectedItem.name}
            </span>
            <button
              type="button"
              onClick={() => setSelectedItemId(null)}
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
          className={`${selectedItem ? "hidden lg:flex" : "flex"} h-9 w-10 shrink-0 items-center justify-center rounded-[10px] border-[0.5px] border-dark-ink/10 bg-dark-ink/[.07] text-dark-ink-secondary`}
        >
          <IconSearch size={16} />
        </button>
      </div>

      <div
        ref={canvasRef}
        onClick={() => setSelectedItemId(null)}
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
            otherRooms={rooms.filter((r) => r.id !== room.id)}
            onDragEnd={(x, y) => updateRoomPosition.mutate({ id: room.id, canvas_x: x, canvas_y: y })}
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

      {trayItems.length > 0 && (
        <div className="flex shrink-0 gap-3 overflow-x-auto px-4 py-3 [scrollbar-width:none] lg:pl-24">
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

      {drag && draggedItem && (
        <DragGhost item={draggedItem} clientX={drag.clientX} clientY={drag.clientY} scale={scale} />
      )}
    </div>
  );
}
