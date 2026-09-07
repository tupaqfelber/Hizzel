import type { ThingCategory } from "@/lib/supabase/types";

// react-pdf can't consume the @tabler/icons-react React components (or a
// webfont) directly — it needs raw <Svg>/<Path> data. These are the exact
// path strings extracted from each icon's own installed source
// (node_modules/@tabler/icons-react/dist/esm/icons/Icon*.mjs) for the
// same 9 categories CATEGORY_ICONS (src/lib/category-icons.ts) maps, so
// the PDF's icons are pixel-identical to the app's, not hand-approximated.
// Tabler's own outline-icon defaults (viewBox "0 0 24 24", stroke
// currentColor, strokeWidth 2, round cap/join, fill none) are baked into
// how these get rendered in things-document.tsx rather than repeated here.
export const CATEGORY_ICON_PATHS: Record<ThingCategory, string[]> = {
  // IconRefresh
  Appliances: [
    "M20 11a8.1 8.1 0 0 0 -15.5 -2m-.5 -4v4h4",
    "M4 13a8.1 8.1 0 0 0 15.5 2m.5 4v-4h-4",
  ],
  // IconBed
  Beds: [
    "M5 9a2 2 0 1 0 4 0a2 2 0 1 0 -4 0",
    "M22 17v-3h-20",
    "M2 8v9",
    "M12 14h10v-2a3 3 0 0 0 -3 -3h-7v5",
  ],
  // IconPackage
  Boxes: [
    "M12 3l8 4.5l0 9l-8 4.5l-8 -4.5l0 -9l8 -4.5",
    "M12 12l8 -4.5",
    "M12 12l0 9",
    "M12 12l-8 -4.5",
    "M16 5.25l-8 4.5",
  ],
  // IconBulb
  Lighting: [
    "M3 12h1m8 -9v1m8 8h1m-15.4 -6.4l.7 .7m12.1 -.7l-.7 .7",
    "M9 16a5 5 0 1 1 6 0a3.5 3.5 0 0 0 -1 3a2 2 0 0 1 -4 0a3.5 3.5 0 0 0 -1 -3",
    "M9.7 17l4.6 0",
  ],
  // IconCube
  Other: [
    "M21 16.008v-8.018a1.98 1.98 0 0 0 -1 -1.717l-7 -4.008a2.016 2.016 0 0 0 -2 0l-7 4.008c-.619 .355 -1 1.01 -1 1.718v8.018c0 .709 .381 1.363 1 1.717l7 4.008a2.016 2.016 0 0 0 2 0l7 -4.008c.619 -.355 1 -1.01 1 -1.718",
    "M12 22v-10",
    "M12 12l8.73 -5.04",
    "M3.27 6.96l8.73 5.04",
  ],
  // IconArmchair
  Seating: [
    "M5 11a2 2 0 0 1 2 2v2h10v-2a2 2 0 1 1 4 0v4a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-4a2 2 0 0 1 2 -2",
    "M5 11v-5a3 3 0 0 1 3 -3h8a3 3 0 0 1 3 3v5",
    "M6 19v2",
    "M18 19v2",
  ],
  // IconStack2
  Shelving: [
    "M12 4l-8 4l8 4l8 -4l-8 -4",
    "M4 12l8 4l8 -4",
    "M4 16l8 4l8 -4",
  ],
  // IconArchive
  Storage: [
    "M3 6a2 2 0 0 1 2 -2h14a2 2 0 0 1 2 2a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2",
    "M5 8v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2 -2v-10",
    "M10 12l4 0",
  ],
  // IconTable
  Tables: [
    "M3 5a2 2 0 0 1 2 -2h14a2 2 0 0 1 2 2v14a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-14",
    "M3 10h18",
    "M10 3v18",
  ],
};
