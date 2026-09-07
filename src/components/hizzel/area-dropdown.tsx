import type { Area } from "@/hooks/use-areas";

export function AreaDropdown({
  areas,
  selectedAreaId,
  onSelect,
  onEditAreas,
}: {
  areas: Area[];
  selectedAreaId: string | undefined;
  onSelect: (id: string) => void;
  onEditAreas: () => void;
}) {
  return (
    <div className="absolute top-full left-0 z-30 mt-1 w-48 overflow-hidden rounded-xl bg-[#2A2820] shadow-lg">
      {areas.map((area) => (
        <button
          key={area.id}
          type="button"
          onClick={() => onSelect(area.id)}
          className={`block w-full px-4 py-2.5 text-left text-sm ${
            // The current area reads dimmed — it's already what's showing,
            // not something there's a reason to tap again. Every other
            // (actually selectable) area gets the full-strength color.
            area.id === selectedAreaId ? "text-dark-ink-secondary" : "text-dark-ink"
          }`}
        >
          {area.name}
        </button>
      ))}
      <button
        type="button"
        onClick={onEditAreas}
        className="block w-full border-t border-dark-border px-4 py-2.5 text-left text-sm text-dark-ink-tertiary"
      >
        Edit areas...
      </button>
    </div>
  );
}
