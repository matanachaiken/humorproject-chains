import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Google sends people back here. Whether they may see anything is decided
// by lib/dal.ts on the next page, not here.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  if (!code) return NextResponse.redirect(`${origin}/login?error=missing_code`);

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return NextResponse.redirect(`${origin}/login?error=auth_failed`);

  return NextResponse.redirect(`${origin}/`);
}
