"use client";

import { useLayoutEffect, useRef, useState } from "react";
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

  // Item names are never abbreviated — a name that doesn't fit at the
  // block's true-to-scale size is hidden entirely rather than shown
  // truncated, since a partial name reads worse than none. The full name
  // is always reachable by tapping the item (the toolbar above shows it).
  // Measured post-layout rather than estimated, so it stays correct across
  // every room size/zoom without duplicating the mobile/desktop font-size
  // breakpoint in JS. `invisible` (not unmounting) keeps the span
  // measurable so it can reappear the moment the block is big enough to
  // hold it again.
  const labelRef = useRef<HTMLSpanElement>(null);
  const [labelFits, setLabelFits] = useState(true);

  useLayoutEffect(() => {
    const el = labelRef.current;
    if (!el) return;
    setLabelFits(el.scrollWidth <= el.clientWidth);
  }, [item.name, width, height]);

  return (
    <div
      data-item-id={item.id}
      onPointerDown={(e) => {
        e.stopPropagation();
        onPointerDown(e);
      }}
      onClick={(e) => e.stopPropagation()}
      className={`absolute z-[3] flex touch-none items-end justify-start overflow-hidden rounded-[3px] border border-dark px-[5px] py-[3px] ${
        // No transition while a real pointer is actively dragging this
        // block — it should follow the cursor exactly, not lag behind an
        // easing curve. Otherwise (a room/position change landing from
        // elsewhere, e.g. the Watch-demo sequence scripting an item into
        // place) sliding in reads far better than an instant jump-cut.
        dragging ? "opacity-30" : "transition-all duration-700 ease-out"
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
      <span
        ref={labelRef}
        className={`min-w-0 max-w-full overflow-hidden text-[8px] font-medium whitespace-nowrap text-white/85 lg:text-xs ${
          labelFits ? "" : "invisible"
        }`}
      >
        {item.name}
      </span>
    </div>
  );
}
