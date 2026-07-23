import {
  IconRefresh,
  IconBed,
  IconPackage,
  IconBulb,
  IconCube,
  IconArmchair,
  IconStack2,
  IconArchive,
  IconTable,
  type Icon,
} from "@tabler/icons-react";
import type { ThingCategory } from "@/lib/supabase/types";

// Shown on a Thing's card/preview whenever it has no photo yet.
export const CATEGORY_ICONS: Record<ThingCategory, Icon> = {
  Appliances: IconRefresh,
  Beds: IconBed,
  Boxes: IconPackage,
  Lighting: IconBulb,
  Other: IconCube,
  Seating: IconArmchair,
  Shelving: IconStack2,
  Storage: IconArchive,
  Tables: IconTable,
};
