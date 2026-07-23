"use client";

import { useState } from "react";
import { Sheet, SheetBody, SheetFooter } from "@/components/ui/sheet";
import { FieldLabel, InputField, TextAreaField } from "@/components/ui/field";
import { GhostButton, SolidButton } from "@/components/ui/button";
import { useUpdateMove, type CurrentMove } from "@/hooks/use-current-move";

export function MoveDetailsFormSheet({
  move,
  onClose,
}: {
  move: CurrentMove;
  onClose: () => void;
}) {
  const [moveDate, setMoveDate] = useState(move.move_date ?? "");
  const [moverName, setMoverName] = useState(move.mover_name ?? "");
  const [moverPhone, setMoverPhone] = useState(move.mover_phone ?? "");
  const [notes, setNotes] = useState(move.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateMove = useUpdateMove();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await updateMove.mutateAsync({
        id: move.id,
        move_date: moveDate || null,
        mover_name: moverName,
        mover_phone: moverPhone,
        notes,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setSaving(false);
    }
  }

  return (
    <Sheet title="Edit Move Details" onClose={onClose}>
      <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
        <SheetBody>
          <FieldLabel>Move date</FieldLabel>
          <InputField
            type="date"
            value={moveDate}
            onChange={(e) => setMoveDate(e.target.value)}
          />

          <FieldLabel>Mover name</FieldLabel>
          <InputField
            value={moverName}
            onChange={(e) => setMoverName(e.target.value)}
            placeholder="e.g. Reeves Britannia"
          />

          <FieldLabel>Mover phone</FieldLabel>
          <InputField
            type="tel"
            value={moverPhone}
            onChange={(e) => setMoverPhone(e.target.value)}
            placeholder="e.g. 01730 262158"
          />

          <FieldLabel>Notes</FieldLabel>
          <TextAreaField
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Anything useful about the move..."
          />

          {error && <p className="mt-3 text-xs text-red-700">{error}</p>}
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
