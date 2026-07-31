"use client";

import { useRef } from "react";
import type { StructuralElementRow } from "@/hooks/use-structural-elements";
import type { CanvasScale } from "@/lib/canvas-scale";
import { cmToPx } from "@/lib/canvas-scale";
import { resolveWallDrop, type PlacedStructural } from "@/lib/wall-snap";
import { STRUCTURAL_COLORS } from "@/lib/structural-colors";
import type { WallSide } from "@/lib/supabase/types";

const MOVE_THRESHOLD_PX = 5;
const BAR_THICKNESS_PX = 6;

// Renders as a plain-px-thick bar straddling one wall of its room — a fixed
// px thickness regardless of zoom, same idea as RoomBlock's border-[1.5px].
// Position is relative to the room's own box (like ItemBlock's children,
// plain cmToPx, no canvas offset — the room div itself already carries that).
function geometryFor(
  wallSide: WallSide,
  offsetCm: number,
  widthCm: number,
  room: { width_cm: number; depth_cm: number },
  scale: CanvasScale,
): React.CSSProperties {
  const along = cmToPx(offsetCm, scale);
  const length = cmToPx(widthCm, scale);
  switch (wallSide) {
    case "n":
      return { left: along, top: 0, width: length, height: BAR_THICKNESS_PX, transform: "translateY(-50%)" };
    case "s":
      return {
        left: along,
        top: cmToPx(room.depth_cm, scale),
        width: length,
        height: BAR_THICKNESS_PX,
        transform: "translateY(-50%)",
      };
    case "w":
      return { left: 0, top: along, width: BAR_THICKNESS_PX, height: length, transform: "translateX(-50%)" };
    case "e":
      return {
        left: cmToPx(room.width_cm, scale),
        top: along,
        width: BAR_THICKNESS_PX,
        height: length,
        transform: "translateX(-50%)",
      };
  }
}

export function StructuralBlock({
  element,
  room,
  scale,
  otherElements,
  selected,
  onSelect,
  onDragEnd,
}: {
  element: StructuralElementRow;
  room: { width_cm: number; depth_cm: number };
  scale: CanvasScale;
  otherElements: PlacedStructural[];
  selected: boolean;
  onSelect: () => void;
  onDragEnd: (wallSide: WallSide, offsetCm: number) => void;
}) {
  const dragState = useRef<{ startClientX: number; startClientY: number; moved: boolean } | null>(
    null,
  );
  const elRef = useRef<HTMLDivElement>(null);

  const geometry = geometryFor(element.wall_side, element.offset_cm, element.width_cm, room, scale);

  function handlePointerDown(e: React.PointerEvent) {
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    dragState.current = { startClientX: e.clientX, startClientY: e.clientY, moved: false };
  }

  function handlePointerMove(e: React.PointerEvent) {
    if (!dragState.current || !elRef.current) return;
    const roomEl = elRef.current.closest("[data-room-id]") as HTMLElement | null;
    if (!roomEl) return;

    const dxPx = e.clientX - dragState.current.startClientX;
    const dyPx = e.clientY - dragState.current.startClientY;
    if (Math.hypot(dxPx, dyPx) > MOVE_THRESHOLD_PX) dragState.current.moved = true;

    const roomRect = roomEl.getBoundingClientRect();
    const localXcm = (e.clientX - roomRect.left) / scale.pxPerCm;
    const localYcm = (e.clientY - roomRect.top) / scale.pxPerCm;

    const result = resolveWallDrop(element.width_cm, localXcm, localYcm, room, otherElements);
    if (!result.fits) return;

    const geo = geometryFor(result.wall_side, result.offset_cm, element.width_cm, room, scale);
    Object.assign(elRef.current.style, geo);
    elRef.current.dataset.pendingWall = result.wall_side;
    elRef.current.dataset.pendingOffset = String(result.offset_cm);
  }

  function handlePointerUp() {
    if (!dragState.current || !elRef.current) return;
    const { moved } = dragState.current;
    const pendingWall = elRef.current.dataset.pendingWall as WallSide | undefined;
    const pendingOffset = elRef.current.dataset.pendingOffset;
    dragState.current = null;

    if (!moved) {
      onSelect();
      return;
    }
    if (pendingWall !== undefined && pendingOffset !== undefined) {
      onDragEnd(pendingWall, Number(pendingOffset));
    }
  }

  return (
    <div
      ref={elRef}
      data-structural-id={element.id}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onClick={(e) => e.stopPropagation()}
      className={`absolute z-[5] touch-none rounded-[1px] ${
        selected ? "ring-2 ring-dark-ink ring-offset-1 ring-offset-dark" : ""
      }`}
      style={{ ...geometry, backgroundColor: STRUCTURAL_COLORS[element.type] }}
    />
  );
}
