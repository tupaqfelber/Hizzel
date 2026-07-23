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
