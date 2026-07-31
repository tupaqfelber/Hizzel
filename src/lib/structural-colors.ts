import type { StructuralType } from "@/lib/supabase/types";

// Structural elements only ever render on the dark Hizzel canvas — unlike
// CATEGORY_COLORS, there's no separate light/tray variant needed.
export const STRUCTURAL_COLORS: Record<StructuralType, string> = {
  door: "#8A5A2E",
  window: "#3E7089",
};
