import type { ThingCategory } from "@/lib/supabase/types";

// A Thing's colour is derived from its category alone — no per-item override in v1.
// `pastel` tints the Things-world card; `bold` fills the Hizzel-world floor-plan block.
export const CATEGORY_COLORS: Record<ThingCategory, { pastel: string; bold: string }> = {
  Appliances: { pastel: "#D6DEDF", bold: "#6E8088" },
  Beds: { pastel: "#D6C9DE", bold: "#4A2E78" },
  Boxes: { pastel: "#E4D7AC", bold: "#A07C10" },
  Lighting: { pastel: "#EAD3AC", bold: "#B07820" },
  Other: { pastel: "#DAD3C7", bold: "#5C544A" },
  Seating: { pastel: "#E7C3B8", bold: "#8A2018" },
  Shelving: { pastel: "#DEC0CE", bold: "#7A2E4E" },
  Storage: { pastel: "#C0D6D0", bold: "#155A4E" },
  Tables: { pastel: "#C3D2DE", bold: "#14407A" },
};

// Every flash confirmation in the app (tray reject/return, successful
// placement, toolbar select) uses the item's own category colour rather
// than one universal tone — this converts a category's bold hex into the
// translucent rgba the .animate-item-flash keyframe expects, fed in via
// the --flash-color CSS custom property (a keyframe can't read a plain hex
// + alpha directly).
export function categoryFlashColor(category: ThingCategory): string {
  const hex = CATEGORY_COLORS[category].bold;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, 0.65)`;
}
