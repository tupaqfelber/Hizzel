import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/lib/supabase/types";

const PUBLIC_PATHS = ["/login", "/auth"];

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          supabaseResponse = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            supabaseResponse.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isPublicPath = PUBLIC_PATHS.some((path) =>
    request.nextUrl.pathname.startsWith(path),
  );

  if (!user && !isPublicPath) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    return NextResponse.redirect(loginUrl);
  }

  // Un-onboarded users must always be able to reach /welcome itself and
  // everything under it — that now includes /welcome/demo (the Watch-demo
  // sequence every new signup needs to reach before ticking "onboarded")
  // and its own PDF-generation route. An exact-match check missed both:
  // visiting /welcome/demo 307'd straight back to /welcome, and its
  // /api/things/pdf/demo fetch would have hit the same redirect and
  // returned a login-page HTML response instead of a real PDF.
  const isWelcomeFlow =
    request.nextUrl.pathname === "/welcome" ||
    request.nextUrl.pathname.startsWith("/welcome/") ||
    request.nextUrl.pathname === "/api/things/pdf/demo";

  if (user && !isPublicPath && !isWelcomeFlow) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("onboarded")
      .eq("id", user.id)
      .single();

    if (profile && !profile.onboarded) {
      const welcomeUrl = request.nextUrl.clone();
      welcomeUrl.pathname = "/welcome";
      return NextResponse.redirect(welcomeUrl);
    }
  }

  return supabaseResponse;
}
