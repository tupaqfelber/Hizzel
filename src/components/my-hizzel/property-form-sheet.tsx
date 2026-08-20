"use client";

import { useRef, useState } from "react";
import { IconCamera, IconPhoto, IconHome, IconHome2 } from "@tabler/icons-react";
import { Sheet, SheetBody, SheetFooter } from "@/components/ui/sheet";
import { FieldLabel, InputField } from "@/components/ui/field";
import { GhostButton, SolidButton } from "@/components/ui/button";
import { useUpdateProperty, type MoveProperty } from "@/hooks/use-current-move";

const ROLE_GRADIENT = {
  current: "linear-gradient(135deg,#C8A882,#B8986F)",
  new: "linear-gradient(135deg,#9BA89A,#8A9889)",
} as const;

// UK postcode, permissive: 1-2 letters + 1-2 digits + optional letter/digit,
// a space (any amount, or none as typed), then a digit + 2 letters. Address
// is one free-text field, not split into street/city/postcode, so this just
// finds and reformats a postcode-shaped substring wherever it sits.
const UK_POSTCODE_RE = /\b([a-z]{1,2}\d[a-z\d]?)\s*(\d[a-z]{2})\b/gi;

function formatPostcode(address: string): string {
  return address.replace(
    UK_POSTCODE_RE,
    (_match, outward: string, inward: string) => `${outward.toUpperCase()} ${inward.toUpperCase()}`,
  );
}

export function PropertyFormSheet({
  property,
  onClose,
}: {
  property: MoveProperty;
  onClose: () => void;
}) {
  const [nickname, setNickname] = useState(property.nickname);
  const [address, setAddress] = useState(property.address);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(property.photo_url);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cameraInputRef = useRef<HTMLInputElement>(null);
  const libraryInputRef = useRef<HTMLInputElement>(null);
  const updateProperty = useUpdateProperty();

  const RoleIcon = property.role === "current" ? IconHome : IconHome2;

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!nickname.trim() && !address.trim()) {
      setError("Enter a nickname or an address");
      return;
    }
    // Also apply here, not just on blur — a tap straight from the address
    // field to "Save Changes" (common on mobile, with a virtual keyboard
    // still up) doesn't reliably fire blur first, so relying on blur alone
    // could let a lowercase postcode slip through uncorrected.
    const formattedAddress = formatPostcode(address);
    setSaving(true);
    setError(null);
    try {
      await updateProperty.mutateAsync({
        id: property.id,
        nickname,
        address: formattedAddress,
        photoFile,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setSaving(false);
    }
  }

  return (
    <Sheet
      title={property.role === "current" ? "Edit Current Home" : "Edit New Home"}
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
        <SheetBody>
          <button
            type="button"
            onClick={() => libraryInputRef.current?.click()}
            className="relative mx-auto mb-4 mt-1.5 flex aspect-[1.25] w-full items-center justify-center overflow-hidden rounded-2xl"
            style={{ background: photoPreview ? undefined : ROLE_GRADIENT[property.role] }}
          >
            {photoPreview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photoPreview} alt="" className="h-full w-full object-cover" />
            ) : (
              <RoleIcon size={32} className="text-white/50" />
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

          <FieldLabel>Nickname</FieldLabel>
          <InputField
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            placeholder="e.g. Bramshott"
          />

          <FieldLabel>Address</FieldLabel>
          <InputField
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            onBlur={() => setAddress((a) => formatPostcode(a))}
            placeholder="e.g. Bramshott Cottage, South Harting, gu31 5nn"
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
