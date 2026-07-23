import { IconArrowRight } from "@tabler/icons-react";
import { CATEGORY_COLORS } from "@/lib/category-colors";
import { CATEGORY_ICONS } from "@/lib/category-icons";
import type { ThingItem } from "@/hooks/use-things";

export function ItemCard({
  thing,
  dragging,
  onPointerDown,
  onSendToTray,
}: {
  thing: ThingItem;
  dragging: boolean;
  onPointerDown: (e: React.PointerEvent) => void;
  onSendToTray: () => void;
}) {
  const Icon = CATEGORY_ICONS[thing.category];
  const color = CATEGORY_COLORS[thing.category];

  return (
    <div
      onPointerDown={onPointerDown}
      className={`relative touch-none overflow-hidden rounded-[10px] bg-linen-card ${dragging ? "opacity-30" : ""}`}
    >
      <div className="block w-full text-left">
        <div
          className="flex aspect-[0.7] w-full items-center justify-center"
          style={{ backgroundColor: thing.photo_url ? undefined : color.pastel }}
        >
          {thing.photo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={thing.photo_url}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : (
            <Icon size={18} className="text-linen-ink/40" />
          )}
        </div>
        <div className="border-t border-linen-ink/[.06] px-[5px] pt-1 pb-1.5 lg:px-2.5 lg:pt-2 lg:pb-2.5">
          <div className="truncate text-[8px] font-medium text-linen-ink lg:text-xs">
            {thing.name}
          </div>
          <div className="text-[7px] text-linen-ink-tertiary lg:text-[11px]">
            {thing.width_cm}×{thing.depth_cm}
          </div>
        </div>
      </div>
      <button
        type="button"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          onSendToTray();
        }}
        aria-label={`Send ${thing.name} to tray`}
        className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-linen-ink/[.08] text-linen-ink-secondary"
      >
        <IconArrowRight size={9} />
      </button>
    </div>
  );
}
