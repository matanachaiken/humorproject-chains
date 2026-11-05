import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// First line of defense: every route except sign-in needs a session.
// The admin flag itself is checked in lib/dal.ts, next to the data.
const PUBLIC_PATHS = ["/login", "/auth/callback"];

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refreshes the auth token if it has expired, then verifies it locally.
  const { data } = await supabase.auth.getClaims();
  const user = data?.claims?.sub ?? null;

  const { pathname } = request.nextUrl;
  if (!user && !PUBLIC_PATHS.includes(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
