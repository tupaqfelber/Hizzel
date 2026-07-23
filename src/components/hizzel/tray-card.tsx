"use client";

import { CATEGORY_COLORS } from "@/lib/category-colors";
import { CATEGORY_ICONS } from "@/lib/category-icons";
import type { MoveItem } from "@/hooks/use-move-items";
import { useFlashStore } from "@/hooks/use-flash-store";

export function TrayCard({
  item,
  dragging,
  onPointerDown,
}: {
  item: MoveItem;
  dragging: boolean;
  onPointerDown: (e: React.PointerEvent) => void;
}) {
  const Icon = CATEGORY_ICONS[item.category];
  const color = CATEGORY_COLORS[item.category];
  const flashing = useFlashStore((s) => s.flashingIds.has(item.id));

  return (
    <div
      data-item-id={item.id}
      onPointerDown={onPointerDown}
      className={`flex w-16 shrink-0 touch-none flex-col items-center gap-1 ${
        dragging ? "opacity-30" : ""
      }`}
    >
      <div
        className={`flex h-12 w-12 items-center justify-center rounded-[8px] ${
          flashing ? "animate-item-flash" : ""
        }`}
        style={{ backgroundColor: color.bold }}
      >
        <Icon size={18} className="text-white/85" />
      </div>
      <span className="max-w-full truncate text-[9px] text-dark-ink-tertiary">
        {item.name}
      </span>
    </div>
  );
}
