"use client";

import { useRef } from "react";
import type { RoomRow } from "@/hooks/use-rooms";
import type { CanvasScale } from "@/lib/canvas-scale";
import { cmToPx, canvasXToPx, canvasYToPx } from "@/lib/canvas-scale";
import { snapRoomPosition } from "@/lib/room-snap";

const MOVE_THRESHOLD_PX = 5;

export function RoomBlock({
  room,
  scale,
  locked,
  selected,
  otherRooms,
  onDragEnd,
  onSelect,
  children,
}: {
  room: RoomRow;
  scale: CanvasScale;
  locked: boolean;
  selected: boolean;
  otherRooms: RoomRow[];
  onDragEnd: (x_cm: number, y_cm: number) => void;
  onSelect: () => void;
  children?: React.ReactNode;
}) {
  const dragState = useRef<{
    startClientX: number;
    startClientY: number;
    startCmX: number;
    startCmY: number;
    moved: boolean;
  } | null>(null);
  const elRef = useRef<HTMLDivElement>(null);

  const left = canvasXToPx(room.canvas_x - scale.minXCm, scale);
  const top = canvasYToPx(room.canvas_y - scale.minYCm, scale);
  const width = cmToPx(room.width_cm, scale);
  const height = cmToPx(room.depth_cm, scale);

  function handlePointerDown(e: React.PointerEvent) {
    if (locked) return;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    dragState.current = {
      startClientX: e.clientX,
      startClientY: e.clientY,
      startCmX: room.canvas_x,
      startCmY: room.canvas_y,
      moved: false,
    };
  }

  function handlePointerMove(e: React.PointerEvent) {
    if (!dragState.current || !elRef.current) return;
    const dxPx = e.clientX - dragState.current.startClientX;
    const dyPx = e.clientY - dragState.current.startClientY;
    if (Math.hypot(dxPx, dyPx) > MOVE_THRESHOLD_PX) dragState.current.moved = true;

    const dxCm = dxPx / scale.pxPerCm;
    const dyCm = dyPx / scale.pxPerCm;
    const rawX = dragState.current.startCmX + dxCm;
    const rawY = dragState.current.startCmY + dyCm;
    const { x: newX, y: newY } = snapRoomPosition(room, rawX, rawY, otherRooms);
    elRef.current.style.left = `${canvasXToPx(newX - scale.minXCm, scale)}px`;
    elRef.current.style.top = `${canvasYToPx(newY - scale.minYCm, scale)}px`;
    elRef.current.dataset.pendingX = String(newX);
    elRef.current.dataset.pendingY = String(newY);
  }

  function handlePointerUp() {
    if (!dragState.current || !elRef.current) return;
    const { moved } = dragState.current;
    const pendingX = elRef.current.dataset.pendingX;
    const pendingY = elRef.current.dataset.pendingY;
    dragState.current = null;

    if (!moved) {
      onSelect();
      return;
    }
    if (pendingX !== undefined && pendingY !== undefined) {
      onDragEnd(Number(pendingX), Number(pendingY));
    }
  }

  return (
    <div
      ref={elRef}
      data-room-id={room.id}
      data-width-cm={room.width_cm}
      data-depth-cm={room.depth_cm}
      onPointerDown={(e) => {
        e.stopPropagation();
        handlePointerDown(e);
      }}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onClick={(e) => e.stopPropagation()}
      className={`absolute overflow-hidden rounded-[2px] border-[1.5px] bg-dark/92 ${
        locked ? "border-dark-ink/25" : "border-dark-ink/40 touch-none"
      } ${selected ? "ring-2 ring-dark-ink ring-offset-1 ring-offset-dark" : ""}`}
      style={{ left, top, width, height }}
    >
      <div className="absolute top-[3px] left-1 z-[4] truncate text-[6px] font-medium tracking-[0.06em] text-[rgba(220,215,205,0.4)] uppercase">
        {room.name}
      </div>
      {children}
    </div>
  );
}
