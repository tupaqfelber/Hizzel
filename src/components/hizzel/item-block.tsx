"use client";

import { IconRotate } from "@tabler/icons-react";
import { CATEGORY_COLORS } from "@/lib/category-colors";
import { rotatedFootprint } from "@/lib/item-snap";
import { cmToPx, type CanvasScale } from "@/lib/canvas-scale";
import type { MoveItem } from "@/hooks/use-move-items";

export function ItemBlock({
  item,
  scale,
  selected,
  dragging,
  onPointerDown,
  onRotate,
}: {
  item: MoveItem & { x_cm: number; y_cm: number };
  scale: CanvasScale;
  selected: boolean;
  dragging: boolean;
  onPointerDown: (e: React.PointerEvent) => void;
  onRotate: () => void;
}) {
  const { w, d } = rotatedFootprint(item);
  const left = cmToPx(item.x_cm, scale);
  const top = cmToPx(item.y_cm, scale);
  const width = cmToPx(w, scale);
  const height = cmToPx(d, scale);
  const color = CATEGORY_COLORS[item.category].bold;

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
      } ${selected ? "ring-2 ring-dark-ink ring-offset-1 ring-offset-dark" : ""}`}
      style={{ left, top, width, height, backgroundColor: color }}
    >
      <span className="min-w-0 max-w-full truncate text-[8px] font-medium text-white/85 lg:text-xs">
        {item.name}
      </span>
      {selected && (
        <button
          type="button"
          aria-label="Rotate"
          onClick={(e) => {
            e.stopPropagation();
            onRotate();
          }}
          onPointerDown={(e) => e.stopPropagation()}
          className="absolute -top-3 -right-3 flex h-6 w-6 items-center justify-center rounded-full bg-linen text-linen-ink shadow"
        >
          <IconRotate size={12} />
        </button>
      )}
    </div>
  );
}
