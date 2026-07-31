"use client";

import { STRUCTURAL_COLORS } from "@/lib/structural-colors";
import { STRUCTURAL_ICONS } from "@/lib/structural-icons";
import type { StructuralType } from "@/lib/supabase/types";

const STRUCTURAL_LABELS: Record<StructuralType, string> = {
  door: "Door",
  window: "Window",
};

// Drag source for creating a new door/window — unlike TrayCard, there's no
// backing row yet (structural_elements.room_id can never be null, so there's
// no "unplaced" state to represent); the row only comes into existence on a
// successful drop onto a wall.
export function StructuralChip({
  type,
  dragging,
  onPointerDown,
}: {
  type: StructuralType;
  dragging: boolean;
  onPointerDown: (e: React.PointerEvent) => void;
}) {
  const Icon = STRUCTURAL_ICONS[type];

  return (
    <div
      onPointerDown={onPointerDown}
      className={`flex w-16 shrink-0 touch-none flex-col items-center gap-1 ${
        dragging ? "opacity-30" : ""
      }`}
    >
      <div
        className="flex h-12 w-12 items-center justify-center rounded-[8px]"
        style={{ backgroundColor: STRUCTURAL_COLORS[type] }}
      >
        <Icon size={18} className="text-white/85" />
      </div>
      <span className="max-w-full truncate text-[9px] text-dark-ink-tertiary">
        {STRUCTURAL_LABELS[type]}
      </span>
    </div>
  );
}
