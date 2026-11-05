import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient as createServiceClient, type SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

// The data access layer. Every page and server action gets the database
// through requireAdmin(), which only hands it out after checking that the
// signed-in user has profiles.is_superadmin. The secret key never leaves
// this file.

export type Viewer = { id: string; email: string | null; isAdmin: boolean; name: string };

// The signed-in user (verified from the session's signed JWT) and whether
// they're an admin. Cached per request, so the layout and page share it.
export const getViewer = cache(async (): Promise<Viewer | null> => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const id = data?.claims?.sub;
  if (!id) return null;

  const { data: profile } = await serviceClient()
    .from("profiles")
    .select("email, first_name, last_name, is_superadmin")
    .eq("id", id)
    .maybeSingle();

  return {
    id,
    email: profile?.email ?? (typeof data.claims.email === "string" ? data.claims.email : null),
    isAdmin: profile?.is_superadmin === true,
    name: [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") || "Admin",
  };
});

// Use at the top of every admin page and server action. Signed-out visitors
// go to /login and signed-in non-admins to /denied.
export async function requireAdmin(): Promise<{ viewer: Viewer; db: SupabaseClient }> {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");
  if (!viewer.isAdmin) redirect("/denied");
  return { viewer, db: serviceClient() };
}

// Bypasses RLS, so admins can see every user's rows.
function serviceClient() {
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!secretKey) throw new Error("SUPABASE_SECRET_KEY is not set");
  return createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
