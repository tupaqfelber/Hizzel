"use client";

import { CATEGORY_COLORS, categoryFlashColor } from "@/lib/category-colors";
import { rotatedFootprint } from "@/lib/item-snap";
import { cmToPx, type CanvasScale } from "@/lib/canvas-scale";
import type { MoveItem } from "@/hooks/use-move-items";
import { useFlashStore } from "@/hooks/use-flash-store";

// Rotate/edit for a selected item live in the toolbar now (HizzelWorld),
// not on the block itself — this stays a plain visual block plus the
// selection ring, which is the only on-canvas indicator of what's selected.
export function ItemBlock({
  item,
  scale,
  selected,
  dragging,
  onPointerDown,
}: {
  item: MoveItem & { x_cm: number; y_cm: number };
  scale: CanvasScale;
  selected: boolean;
  dragging: boolean;
  onPointerDown: (e: React.PointerEvent) => void;
}) {
  const { w, d } = rotatedFootprint(item);
  const left = cmToPx(item.x_cm, scale);
  const top = cmToPx(item.y_cm, scale);
  const width = cmToPx(w, scale);
  const height = cmToPx(d, scale);
  const color = CATEGORY_COLORS[item.category].bold;
  const flashing = useFlashStore((s) => s.flashingIds.has(item.id));

  return (
    <div
      data-item-id={item.id}
      onPointerDown={(e) => {
        e.stopPropagation();
        onPointerDown(e);
      }}
      onClick={(e) => e.stopPropagation()}
      className={`absolute z-[3] flex touch-none items-end justify-start overflow-hidden rounded-[3px] border border-dark px-[5px] py-[3px] ${
        dragging ? "opacity-30" : ""
      } ${selected ? "ring-2 ring-dark-ink ring-offset-1 ring-offset-dark" : ""} ${flashing ? "animate-item-flash" : ""}`}
      style={
        {
          left,
          top,
          width,
          height,
          backgroundColor: color,
          "--flash-color": categoryFlashColor(item.category),
        } as React.CSSProperties
      }
    >
      <span className="min-w-0 max-w-full truncate text-[8px] font-medium text-white/85 lg:text-xs">
        {item.name}
      </span>
    </div>
  );
}
