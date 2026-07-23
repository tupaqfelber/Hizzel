"use client";

import { useState } from "react";
import { Sheet, SheetBody, SheetFooter } from "@/components/ui/sheet";
import { FieldLabel, InputField } from "@/components/ui/field";
import { GhostButton, SolidButton } from "@/components/ui/button";
import { useCreateRoom } from "@/hooks/use-rooms";

export function RoomFormSheet({
  areaId,
  onClose,
}: {
  areaId: string;
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  const [width, setWidth] = useState("");
  const [depth, setDepth] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createRoom = useCreateRoom(areaId);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await createRoom.mutateAsync({
        name,
        width_cm: Number(width),
        depth_cm: Number(depth),
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setSaving(false);
    }
  }

  return (
    <Sheet title="Add a Room" onClose={onClose}>
      <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
        <SheetBody>
          <FieldLabel>Name</FieldLabel>
          <InputField
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Kitchen"
            required
            autoFocus
          />

          <FieldLabel>Dimensions</FieldLabel>
          <div className="flex items-center gap-2">
            <input
              type="number"
              inputMode="decimal"
              min={0}
              value={width}
              onChange={(e) => setWidth(e.target.value)}
              placeholder="W"
              aria-label="Width, cm"
              required
              className="min-w-0 flex-1 rounded-[11px] bg-linen-field py-3 text-center text-sm text-linen-ink placeholder:text-[#B0A898] focus:outline-none"
            />
            <span className="shrink-0 text-[13px] text-[#B0A898]">×</span>
            <input
              type="number"
              inputMode="decimal"
              min={0}
              value={depth}
              onChange={(e) => setDepth(e.target.value)}
              placeholder="D"
              aria-label="Depth, cm"
              required
              className="min-w-0 flex-1 rounded-[11px] bg-linen-field py-3 text-center text-sm text-linen-ink placeholder:text-[#B0A898] focus:outline-none"
            />
          </div>
          <div className="mt-1 text-right text-[10px] text-linen-ink-tertiary">
            width × depth, cm
          </div>

          {error && <p className="mt-3 text-xs text-red-700">{error}</p>}
        </SheetBody>
        <SheetFooter>
          <GhostButton onClick={onClose} disabled={saving}>
            Cancel
          </GhostButton>
          <SolidButton disabled={saving}>Add Room</SolidButton>
        </SheetFooter>
      </form>
    </Sheet>
  );
}
