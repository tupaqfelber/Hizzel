"use client";

import { useRef } from "react";
import type { RoomRow } from "@/hooks/use-rooms";
import type { CanvasScale } from "@/lib/canvas-scale";
import { cmToPx } from "@/lib/canvas-scale";
import { snapRoomPosition } from "@/lib/room-snap";

export function RoomBlock({
  room,
  scale,
  locked,
  otherRooms,
  onDragEnd,
  children,
}: {
  room: RoomRow;
  scale: CanvasScale;
  locked: boolean;
  otherRooms: RoomRow[];
  onDragEnd: (x_cm: number, y_cm: number) => void;
  children?: React.ReactNode;
}) {
  const dragState = useRef<{
    startClientX: number;
    startClientY: number;
    startCmX: number;
    startCmY: number;
  } | null>(null);
  const elRef = useRef<HTMLDivElement>(null);

  const left = cmToPx(room.canvas_x - scale.minXCm, scale);
  const top = cmToPx(room.canvas_y - scale.minYCm, scale);
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
    };
  }

  function handlePointerMove(e: React.PointerEvent) {
    if (!dragState.current || !elRef.current) return;
    const dxCm = (e.clientX - dragState.current.startClientX) / scale.pxPerCm;
    const dyCm = (e.clientY - dragState.current.startClientY) / scale.pxPerCm;
    const rawX = dragState.current.startCmX + dxCm;
    const rawY = dragState.current.startCmY + dyCm;
    const { x: newX, y: newY } = snapRoomPosition(room, rawX, rawY, otherRooms);
    elRef.current.style.left = `${cmToPx(newX - scale.minXCm, scale)}px`;
    elRef.current.style.top = `${cmToPx(newY - scale.minYCm, scale)}px`;
    elRef.current.dataset.pendingX = String(newX);
    elRef.current.dataset.pendingY = String(newY);
  }

  function handlePointerUp() {
    if (!dragState.current || !elRef.current) return;
    const pendingX = elRef.current.dataset.pendingX;
    const pendingY = elRef.current.dataset.pendingY;
    dragState.current = null;
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
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      className={`absolute overflow-hidden rounded-[2px] border-[1.5px] bg-dark/92 ${
        locked ? "border-dark-ink/25" : "border-dark-ink/40 touch-none"
      }`}
      style={{ left, top, width, height }}
    >
      <div className="absolute top-[3px] left-1 z-[4] truncate text-[6px] font-medium tracking-[0.06em] text-[rgba(220,215,205,0.4)] uppercase">
        {room.name}
      </div>
      {children}
    </div>
  );
}
