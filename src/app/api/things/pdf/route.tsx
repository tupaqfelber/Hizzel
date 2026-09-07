import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { createClient } from "@/lib/supabase/server";
import { ThingsDocument, type PdfThingGroup } from "@/lib/pdf/things-document";
import { UNASSIGNED } from "@/hooks/use-things";

// react-pdf reads real font files from disk (see things-document.tsx) and
// isn't edge-compatible — needs the Node runtime, not the default edge
// one some route handlers can use.
export const runtime = "nodejs";

// Same kill-switch use-billing-status.ts reads client-side — keeps the
// server-side gate below in sync with what the client already decided,
// rather than a build ever disagreeing with itself.
const BILLING_ENABLED = process.env.NEXT_PUBLIC_BILLING_ENABLED === "true";

// hizzel_unlocked_until isn't in the generated Database type yet — same
// cast pattern as use-billing-status.ts and every other reader of a
// column from an unapplied-to-generated-types migration in this codebase.
interface ProfileBillingRow {
  hizzel_unlocked_until: string | null;
}
interface ProfilesBillingReadTable {
  from(table: "profiles"): {
    select(cols: "hizzel_unlocked_until"): {
      eq(
        col: "id",
        val: string,
      ): {
        maybeSingle(): Promise<
          { data: ProfileBillingRow | null; error: null } | { data: null; error: { message: string } }
        >;
      };
    };
  };
}

interface ThingRow {
  id: string;
  name: string;
  category: import("@/lib/supabase/types").ThingCategory;
  width_cm: number;
  depth_cm: number;
  photo_url: string | null;
}

interface PlacementRow {
  thing_id: string;
  room_id: string | null;
  rooms: { name: string; areas: { name: string; sort_order: number } | null } | null;
}

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const { data: move, error: moveError } = await supabase
    .from("moves")
    .select("id, is_example, move_date, notes, mover_name, mover_phone, properties(role, nickname)")
    .eq("status", "current")
    .limit(1)
    .maybeSingle();
  if (moveError) {
    return NextResponse.json({ error: moveError.message }, { status: 500 });
  }
  if (!move) {
    return NextResponse.json({ error: "No current move" }, { status: 404 });
  }

  // Same accountUnlocked-or-is_example exemption already duplicated in
  // hizzel-world.tsx / things-world.tsx / my-hizzel-overlay.tsx — checked
  // again here (not just client-side) since a client-only check can be
  // bypassed by hitting this endpoint directly.
  const { data: profile } = await (supabase as unknown as ProfilesBillingReadTable)
    .from("profiles")
    .select("hizzel_unlocked_until")
    .eq("id", user.id)
    .maybeSingle();
  const accountUnlocked =
    !BILLING_ENABLED ||
    (!!profile?.hizzel_unlocked_until && new Date(profile.hizzel_unlocked_until) > new Date());
  if (!accountUnlocked && !move.is_example) {
    return NextResponse.json({ error: "Subscription required" }, { status: 403 });
  }

  const [thingsRes, placementsRes] = await Promise.all([
    supabase
      .from("things")
      .select("id, name, category, width_cm, depth_cm, photo_url")
      .order("name")
      .returns<ThingRow[]>(),
    supabase
      .from("placements")
      .select("thing_id, room_id, rooms(name, areas(name, sort_order))")
      .eq("move_id", move.id)
      .returns<PlacementRow[]>(),
  ]);
  if (thingsRes.error) {
    return NextResponse.json({ error: thingsRes.error.message }, { status: 500 });
  }
  if (placementsRes.error) {
    return NextResponse.json({ error: placementsRes.error.message }, { status: 500 });
  }

  const placementByThing = new Map(placementsRes.data.map((p) => [p.thing_id, p]));
  const groupsByKey = new Map<string, PdfThingGroup & { areaSortOrder: number }>();

  for (const thing of thingsRes.data) {
    const placement = placementByThing.get(thing.id);
    const roomId = placement?.room_id ?? null;
    const key = roomId ?? UNASSIGNED;
    const roomName = roomId ? (placement?.rooms?.name ?? UNASSIGNED) : UNASSIGNED;
    const areaName = roomId ? (placement?.rooms?.areas?.name ?? null) : null;
    const areaSortOrder = roomId ? (placement?.rooms?.areas?.sort_order ?? 0) : 0;

    if (!groupsByKey.has(key)) {
      groupsByKey.set(key, { key, roomName, areaName, areaSortOrder, items: [] });
    }
    groupsByKey.get(key)!.items.push({
      id: thing.id,
      name: thing.name,
      category: thing.category,
      width_cm: thing.width_cm,
      depth_cm: thing.depth_cm,
      photo_url: thing.photo_url,
    });
  }

  // Unassigned last here — the deliberate opposite of useGroupedThings'
  // own in-app sort (Unassigned first, "the to-do pile"), which is right
  // for a live list but wrong for a print manifest: a mover reading this
  // wants organized rooms first, with anything not yet placed as a
  // trailing catch-all, not leading.
  const groups = [...groupsByKey.values()].sort((a, b) => {
    if (a.roomName === UNASSIGNED) return 1;
    if (b.roomName === UNASSIGNED) return -1;
    if (a.areaSortOrder !== b.areaSortOrder) return a.areaSortOrder - b.areaSortOrder;
    return a.roomName.localeCompare(b.roomName);
  });

  const currentProperty = move.properties.find((p) => p.role === "current");
  const newProperty = move.properties.find((p) => p.role === "new");

  const buffer = await renderToBuffer(
    <ThingsDocument
      userEmail={user.email ?? ""}
      currentPropertyName={currentProperty?.nickname ?? "Current"}
      newPropertyName={newProperty?.nickname ?? "New"}
      moveDate={move.move_date}
      totalCount={thingsRes.data.length}
      moverName={move.mover_name}
      moverPhone={move.mover_phone}
      notes={move.notes}
      groups={groups}
    />,
  );

  const filename = `${currentProperty?.nickname ?? "My"} to ${newProperty?.nickname ?? "New"} - Things.pdf`;
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename.replace(/"/g, "")}"`,
    },
  });
}
