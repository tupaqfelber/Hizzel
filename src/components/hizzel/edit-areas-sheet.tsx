"use client";

import { useState } from "react";
import { IconGripVertical, IconTrash, IconChevronUp, IconChevronDown } from "@tabler/icons-react";
import { Sheet, SheetBody, SheetFooter } from "@/components/ui/sheet";
import { InputField } from "@/components/ui/field";
import { GhostButton, SolidButton } from "@/components/ui/button";
import { useAreas, useCreateArea, useUpdateArea, useDeleteArea } from "@/hooks/use-areas";

export function EditAreasSheet({
  propertyId,
  onClose,
}: {
  propertyId: string;
  onClose: () => void;
}) {
  const { data: areas } = useAreas(propertyId);
  const createArea = useCreateArea(propertyId);
  const updateArea = useUpdateArea(propertyId);
  const deleteArea = useDeleteArea(propertyId);

  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    await createArea.mutateAsync(newName.trim());
    setNewName("");
  }

  function startRename(id: string, currentName: string) {
    setEditingId(id);
    setEditingName(currentName);
  }

  async function commitRename() {
    if (editingId && editingName.trim()) {
      await updateArea.mutateAsync({ id: editingId, name: editingName.trim() });
    }
    setEditingId(null);
  }

  function move(index: number, direction: -1 | 1) {
    if (!areas) return;
    const target = areas[index + direction];
    const current = areas[index];
    if (!target) return;
    updateArea.mutate({ id: current.id, sort_order: target.sort_order });
    updateArea.mutate({ id: target.id, sort_order: current.sort_order });
  }

  return (
    <Sheet title="Edit Areas" onClose={onClose}>
      <div className="flex min-h-0 flex-1 flex-col">
        <SheetBody>
          {areas?.map((area, i) => (
            <div
              key={area.id}
              className="flex items-center gap-2 border-b border-linen-border py-2.5"
            >
              <IconGripVertical size={14} className="shrink-0 text-linen-ink-tertiary" />
              {editingId === area.id ? (
                <input
                  autoFocus
                  value={editingName}
                  onChange={(e) => setEditingName(e.target.value)}
                  onBlur={commitRename}
                  onKeyDown={(e) => e.key === "Enter" && commitRename()}
                  className="min-w-0 flex-1 border-b border-linen-ink/30 bg-transparent text-sm text-linen-ink focus:outline-none"
                />
              ) : (
                <button
                  type="button"
                  onClick={() => startRename(area.id, area.name)}
                  className="min-w-0 flex-1 truncate text-left text-sm text-linen-ink"
                >
                  {area.name}
                </button>
              )}
              <button
                type="button"
                disabled={i === 0}
                onClick={() => move(i, -1)}
                className="shrink-0 text-linen-ink-tertiary disabled:opacity-30"
                aria-label="Move up"
              >
                <IconChevronUp size={14} />
              </button>
              <button
                type="button"
                disabled={!areas || i === areas.length - 1}
                onClick={() => move(i, 1)}
                className="shrink-0 text-linen-ink-tertiary disabled:opacity-30"
                aria-label="Move down"
              >
                <IconChevronDown size={14} />
              </button>
              <button
                type="button"
                onClick={() => deleteArea.mutate(area.id)}
                className="shrink-0 text-linen-ink-tertiary"
                aria-label={`Delete ${area.name}`}
              >
                <IconTrash size={14} />
              </button>
            </div>
          ))}

          <form onSubmit={handleAdd} className="mt-4 flex gap-2">
            <InputField
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. First floor"
            />
            <SolidButton className="flex-none px-5" disabled={!newName.trim()}>
              Add
            </SolidButton>
          </form>
        </SheetBody>
        <SheetFooter>
          <GhostButton onClick={onClose} className="w-full">
            Done
          </GhostButton>
        </SheetFooter>
      </div>
    </Sheet>
  );
}
