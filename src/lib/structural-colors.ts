import type { StructuralType } from "@/lib/supabase/types";

// Structural elements only ever render on the dark Hizzel canvas — unlike
// CATEGORY_COLORS, there's no separate light/tray variant needed.
export const STRUCTURAL_COLORS: Record<StructuralType, string> = {
  door: "#8A5A2E",
  window: "#3E7089",
};

// Same hex-to-rgba conversion as categoryFlashColor, for the shared
// .animate-item-flash keyframe's --flash-color custom property.
export function structuralFlashColor(type: StructuralType): string {
  const hex = STRUCTURAL_COLORS[type];
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, 0.65)`;
}
