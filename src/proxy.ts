import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function proxy(request: NextRequest) {
  // No Supabase project linked yet (see .env.local.example) — skip auth
  // gating rather than crashing every request during early scaffolding.
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return NextResponse.next();
  }
  return updateSession(request);
}

export const config = {
  matcher: [
    // api/stripe/webhook is excluded — it's called directly by Stripe's
    // servers with no Supabase session at all (verified instead via the
    // signature header), so the auth gate would redirect it to /login
    // before the route's own signature check ever ran. Confirmed via
    // `stripe listen` logging every event as a 307 until this was added.
    // manifest.webmanifest is excluded the same way image assets already
    // were — Chrome fetches it unauthenticated to decide installability,
    // and a 307-to-/login instead of real JSON silently breaks that.
    "/((?!_next/static|_next/image|favicon.ico|manifest\\.webmanifest|api/stripe/webhook|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
