"use client";

import { CATEGORY_COLORS } from "@/lib/category-colors";
import { rotatedFootprint } from "@/lib/item-snap";
import type { MoveItem } from "@/hooks/use-move-items";

export function DragGhost({
  item,
  clientX,
  clientY,
  scale,
}: {
  item: MoveItem;
  clientX: number;
  clientY: number;
  scale: { pxPerCm: number };
}) {
  const { w, d } = rotatedFootprint(item);
  const width = Math.max(w * scale.pxPerCm, 24);
  const height = Math.max(d * scale.pxPerCm, 24);
  const color = CATEGORY_COLORS[item.category].bold;

  return (
    <div
      className="pointer-events-none fixed z-[60] flex items-end justify-start rounded-[3px] px-[5px] py-[3px] opacity-90 shadow-lg"
      style={{
        left: clientX - width / 2,
        top: clientY - height / 2,
        width,
        height,
        backgroundColor: color,
      }}
    >
      <span className="max-w-full truncate text-[8px] font-medium text-white/85">
        {item.name}
      </span>
    </div>
  );
}
