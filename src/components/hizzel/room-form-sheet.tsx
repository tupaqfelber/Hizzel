"use client";

import { useState } from "react";
import { usePostHog } from "posthog-js/react";
import { Sheet, SheetBody, SheetFooter } from "@/components/ui/sheet";
import { FieldLabel, InputField } from "@/components/ui/field";
import { GhostButton, SolidButton } from "@/components/ui/button";
import { useCreateRoom, useUpdateRoom, useDeleteRoom, type RoomRow } from "@/hooks/use-rooms";
import type { Area } from "@/hooks/use-areas";

export function RoomFormSheet({
  areaId,
  moveId,
  room,
  areas,
  onClose,
}: {
  areaId: string;
  moveId?: string;
  room?: RoomRow;
  areas?: Area[];
  onClose: () => void;
}) {
  const isEdit = !!room;
  const [name, setName] = useState(room?.name ?? "");
  const [width, setWidth] = useState(room ? String(room.width_cm) : "");
  const [depth, setDepth] = useState(room ? String(room.depth_cm) : "");
  const [targetAreaId, setTargetAreaId] = useState(room?.area_id ?? areaId);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createRoom = useCreateRoom(areaId);
  const updateRoom = useUpdateRoom();
  const deleteRoom = useDeleteRoom(areaId, moveId);
  const posthog = usePostHog();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      if (room) {
        await updateRoom.mutateAsync({
          id: room.id,
          name,
          width_cm: Number(width),
          depth_cm: Number(depth),
          area_id: targetAreaId !== room.area_id ? targetAreaId : undefined,
        });
      } else {
        await createRoom.mutateAsync({
          name,
          width_cm: Number(width),
          depth_cm: Number(depth),
        });
        posthog?.capture("room_created");
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!room) return;
    setSaving(true);
    try {
      await deleteRoom.mutateAsync(room.id);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't delete");
      setSaving(false);
    }
  }

  return (
    <Sheet title={isEdit ? "Edit Room" : "Add a Room"} onClose={onClose}>
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

          {isEdit && areas && areas.length > 1 && (
            <>
              <FieldLabel>Area</FieldLabel>
              <select
                value={targetAreaId}
                onChange={(e) => setTargetAreaId(e.target.value)}
                className="w-full rounded-[11px] border-none bg-linen-field px-3.5 py-3 text-sm text-linen-ink focus:outline-none"
              >
                {areas.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </>
          )}

          {error && <p className="mt-3 text-xs text-red-700">{error}</p>}

          {isEdit && (
            <button
              type="button"
              onClick={handleDelete}
              disabled={saving}
              className="mt-5 text-xs text-linen-ink-tertiary underline disabled:opacity-60"
            >
              Delete this room
            </button>
          )}
        </SheetBody>
        <SheetFooter>
          <GhostButton onClick={onClose} disabled={saving}>
            Cancel
          </GhostButton>
          <SolidButton disabled={saving}>{isEdit ? "Save Changes" : "Add Room"}</SolidButton>
        </SheetFooter>
      </form>
    </Sheet>
  );
}
