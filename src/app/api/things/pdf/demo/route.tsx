import path from "node:path";
import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { ThingsDocument, type PdfThingGroup } from "@/lib/pdf/things-document";
import { UNASSIGNED } from "@/hooks/use-things";
import { DEMO_MOVE_BASE, DEMO_PROPERTIES, DEMO_ROOMS, DEMO_THINGS } from "@/lib/demo/demo-data";

// The Watch-demo sequence's beat 7 ("the real PDF export feature generates
// and displays the finished document") reuses the exact same renderer the
// real /api/things/pdf route does — ThingsDocument is already fully
// decoupled from Supabase (plain-object props, see things-document.tsx),
// so this is a thin, hardcoded wrapper around it, not new PDF logic.
// Unauthenticated on purpose: it only ever renders the fixed scripted
// content below, never anything from a real account.
export const runtime = "nodejs";

// react-pdf's <Image> can read a local file path directly (same as the
// logo in things-document.tsx) — demo photos live under public/, so this
// just resolves the web-root-relative path the rest of the app renders
// them at (e.g. "/demo/things/fridge.jpg") to that file on disk, rather
// than fetching them over HTTP.
function toDiskPath(photoUrl: string): string {
  return path.join(process.cwd(), "public", photoUrl);
}

export async function GET() {
  const groupsByKey = new Map<string, PdfThingGroup & { areaSortOrder: number }>();

  for (const thing of DEMO_THINGS) {
    const room = thing.roomKey ? DEMO_ROOMS.find((r) => r.key === thing.roomKey) : undefined;
    const key = room?.id ?? UNASSIGNED;
    if (!groupsByKey.has(key)) {
      groupsByKey.set(key, {
        key,
        roomName: room?.name ?? UNASSIGNED,
        areaName: room ? "Ground floor" : null,
        areaSortOrder: 0,
        items: [],
      });
    }
    groupsByKey.get(key)!.items.push({
      id: thing.id,
      name: thing.name,
      category: thing.category,
      width_cm: thing.width_cm,
      depth_cm: thing.depth_cm,
      photo_url: toDiskPath(thing.photo_url),
    });
  }

  // Unassigned last, same deliberate print-manifest sort as the real route.
  const groups = [...groupsByKey.values()].sort((a, b) => {
    if (a.roomName === UNASSIGNED) return 1;
    if (b.roomName === UNASSIGNED) return -1;
    return a.roomName.localeCompare(b.roomName);
  });

  const current = DEMO_PROPERTIES.find((p) => p.role === "current");
  const next = DEMO_PROPERTIES.find((p) => p.role === "new");

  const buffer = await renderToBuffer(
    <ThingsDocument
      userEmail="you@example.com"
      currentPropertyName={current?.nickname ?? "Current"}
      newPropertyName={next?.nickname ?? "New"}
      moveDate={DEMO_MOVE_BASE.move_date}
      totalCount={DEMO_THINGS.length}
      moverName={DEMO_MOVE_BASE.mover_name}
      moverPhone={DEMO_MOVE_BASE.mover_phone}
      notes={DEMO_MOVE_BASE.notes}
      groups={groups}
    />,
  );

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="Currant House to Newhome Street - Things.pdf"`,
    },
  });
}
