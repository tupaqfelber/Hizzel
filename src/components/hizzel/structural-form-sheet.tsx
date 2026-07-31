"use client";

import { useState } from "react";
import { Sheet, SheetBody, SheetFooter } from "@/components/ui/sheet";
import { FieldLabel, InputField } from "@/components/ui/field";
import { GhostButton, SolidButton } from "@/components/ui/button";
import {
  useUpdateStructuralElement,
  useDeleteStructuralElement,
  type StructuralElementRow,
} from "@/hooks/use-structural-elements";
import { resolveWallPlacement, type PlacedStructural } from "@/lib/wall-snap";
import type { WallSide } from "@/lib/supabase/types";

const WALL_LABELS: Record<WallSide, string> = {
  n: "North",
  e: "East",
  s: "South",
  w: "West",
};

// Edit-only — a door/window is only ever created by dragging a chip onto a
// wall (StructuralChip), never through this form.
export function StructuralFormSheet({
  element,
  room,
  otherElements,
  onClose,
}: {
  element: StructuralElementRow;
  room: { width_cm: number; depth_cm: number };
  otherElements: PlacedStructural[];
  onClose: () => void;
}) {
  const [width, setWidth] = useState(String(element.width_cm));
  const [wallSide, setWallSide] = useState<WallSide>(element.wall_side);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateElement = useUpdateStructuralElement();
  const deleteElement = useDeleteStructuralElement();

  const label = element.type === "door" ? "Door" : "Window";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const newWidth = Number(width);
    const proposedOffset = wallSide === element.wall_side ? element.offset_cm : 0;
    const result = resolveWallPlacement(newWidth, wallSide, proposedOffset, room, otherElements);
    if (!result.fits) {
      setError("Doesn't fit on that wall");
      setSaving(false);
      return;
    }

    try {
      await updateElement.mutateAsync({
        id: element.id,
        width_cm: newWidth,
        wall_side: result.wall_side,
        offset_cm: result.offset_cm,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setSaving(false);
    }
  }

  async function handleDelete() {
    setSaving(true);
    try {
      await deleteElement.mutateAsync(element.id);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't delete");
      setSaving(false);
    }
  }

  return (
    <Sheet title={`Edit ${label}`} onClose={onClose}>
      <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
        <SheetBody>
          <FieldLabel>Width</FieldLabel>
          <InputField
            type="number"
            inputMode="decimal"
            min={0}
            value={width}
            onChange={(e) => setWidth(e.target.value)}
            aria-label="Width, cm"
            required
            autoFocus
          />
          <div className="mt-1 text-right text-[10px] text-linen-ink-tertiary">cm</div>

          <FieldLabel>Wall</FieldLabel>
          <select
            value={wallSide}
            onChange={(e) => setWallSide(e.target.value as WallSide)}
            className="w-full rounded-[11px] border-none bg-linen-field px-3.5 py-3 text-sm text-linen-ink focus:outline-none"
          >
            {(Object.keys(WALL_LABELS) as WallSide[]).map((side) => (
              <option key={side} value={side}>
                {WALL_LABELS[side]}
              </option>
            ))}
          </select>

          {error && <p className="mt-3 text-xs text-red-700">{error}</p>}

          <button
            type="button"
            onClick={handleDelete}
            disabled={saving}
            className="mt-5 text-xs text-linen-ink-tertiary underline disabled:opacity-60"
          >
            Delete this {label.toLowerCase()}
          </button>
        </SheetBody>
        <SheetFooter>
          <GhostButton onClick={onClose} disabled={saving}>
            Cancel
          </GhostButton>
          <SolidButton disabled={saving}>Save Changes</SolidButton>
        </SheetFooter>
      </form>
    </Sheet>
  );
}
