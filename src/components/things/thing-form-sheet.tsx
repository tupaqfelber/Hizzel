"use client";

import { useRef, useState } from "react";
import { usePostHog } from "posthog-js/react";
import { IconCamera, IconPhoto } from "@tabler/icons-react";
import { Sheet, SheetBody, SheetFooter } from "@/components/ui/sheet";
import { Pill } from "@/components/ui/pill";
import { FieldLabel, InputField, TextAreaField, DimensionsField } from "@/components/ui/field";
import { GhostButton, SolidButton } from "@/components/ui/button";
import { CATEGORY_COLORS } from "@/lib/category-colors";
import { CATEGORY_ICONS } from "@/lib/category-icons";
import { useCreateThing, useUpdateThing, useDeleteThing, type ThingItem } from "@/hooks/use-things";
import type { ThingCategory } from "@/lib/supabase/types";

const CATEGORIES: ThingCategory[] = [
  "Appliances",
  "Beds",
  "Boxes",
  "Lighting",
  "Other",
  "Seating",
  "Shelving",
  "Storage",
  "Tables",
];

const STANDARD_BOX = { width: "45", depth: "45", height: "60" };

export function ThingFormSheet({
  thing,
  onClose,
}: {
  thing?: ThingItem;
  onClose: () => void;
}) {
  const isEdit = !!thing;
  const [name, setName] = useState(thing?.name ?? "");
  const [category, setCategory] = useState<ThingCategory>(thing?.category ?? "Appliances");
  const [width, setWidth] = useState(thing ? String(thing.width_cm) : "");
  const [depth, setDepth] = useState(thing ? String(thing.depth_cm) : "");
  const [height, setHeight] = useState(thing ? String(thing.height_cm) : "");
  const [notes, setNotes] = useState(thing?.notes ?? "");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(thing?.photo_url ?? null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cameraInputRef = useRef<HTMLInputElement>(null);
  const libraryInputRef = useRef<HTMLInputElement>(null);

  const createThing = useCreateThing();
  const updateThing = useUpdateThing();
  const deleteThing = useDeleteThing();
  const posthog = usePostHog();

  const CategoryIcon = CATEGORY_ICONS[category];
  const categoryColor = CATEGORY_COLORS[category];

  function handleCategorySelect(next: ThingCategory) {
    setCategory(next);
    if (next === "Boxes" && !width && !depth && !height) {
      setWidth(STANDARD_BOX.width);
      setDepth(STANDARD_BOX.depth);
      setHeight(STANDARD_BOX.height);
    }
  }

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const input = {
      name,
      category,
      width_cm: Number(width),
      depth_cm: Number(depth),
      height_cm: Number(height),
      notes,
      photoFile,
    };

    try {
      if (isEdit) {
        await updateThing.mutateAsync({ id: thing.id, ...input });
      } else {
        await createThing.mutateAsync(input);
        posthog?.capture("thing_created", { category: input.category });
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!thing) return;
    setSaving(true);
    try {
      await deleteThing.mutateAsync(thing.id);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't delete");
      setSaving(false);
    }
  }

  return (
    <Sheet title={isEdit ? "Edit Thing" : "Add a Thing"} onClose={onClose}>
      <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
        <SheetBody>
          <button
            type="button"
            onClick={() => libraryInputRef.current?.click()}
            className="relative mx-auto mb-4 mt-1.5 flex aspect-[0.75] w-[150px] items-center justify-center overflow-hidden rounded-2xl"
            style={{ backgroundColor: photoPreview ? undefined : categoryColor.pastel }}
          >
            {photoPreview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photoPreview} alt="" className="h-full w-full object-cover" />
            ) : (
              <CategoryIcon size={44} className="text-linen-ink/40" />
            )}
            <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1.5">
              <span
                onClick={(e) => {
                  e.stopPropagation();
                  cameraInputRef.current?.click();
                }}
                className="flex h-[30px] w-[30px] items-center justify-center rounded-full bg-linen/90 text-linen-ink-secondary shadow-[0_2px_6px_rgba(0,0,0,0.12)]"
              >
                <IconCamera size={14} />
              </span>
              <span className="flex h-[30px] w-[30px] items-center justify-center rounded-full bg-linen/90 text-linen-ink-secondary shadow-[0_2px_6px_rgba(0,0,0,0.12)]">
                <IconPhoto size={14} />
              </span>
            </div>
          </button>
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handlePhotoChange}
          />
          <input
            ref={libraryInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handlePhotoChange}
          />

          <FieldLabel>Name</FieldLabel>
          <InputField
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Small Sofa"
            required
          />

          <FieldLabel>Category</FieldLabel>
          <div className="flex flex-wrap gap-1.5">
            {CATEGORIES.map((c) => (
              <Pill key={c} active={c === category} onClick={() => handleCategorySelect(c)}>
                {c}
              </Pill>
            ))}
          </div>

          <FieldLabel>Dimensions</FieldLabel>
          <DimensionsField
            width={width}
            depth={depth}
            height={height}
            onChange={({ width, depth, height }) => {
              setWidth(width);
              setDepth(depth);
              setHeight(height);
            }}
          />

          <FieldLabel>Notes</FieldLabel>
          <TextAreaField
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Condition, provenance, anything useful..."
          />

          {error && <p className="mt-3 text-xs text-red-700">{error}</p>}

          {isEdit && (
            <button
              type="button"
              onClick={handleDelete}
              disabled={saving}
              className="mt-5 text-xs text-linen-ink-tertiary underline disabled:opacity-60"
            >
              Delete this thing
            </button>
          )}
        </SheetBody>
        <SheetFooter>
          <GhostButton onClick={onClose} disabled={saving}>
            Cancel
          </GhostButton>
          <SolidButton disabled={saving}>
            {isEdit ? "Save Changes" : "Add Thing"}
          </SolidButton>
        </SheetFooter>
      </form>
    </Sheet>
  );
}
