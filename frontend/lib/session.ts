import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) throw new Error("Supabase env vars not set");
  return createClient(url, key);
}

/** Resolves the signed-in user's id server-side from the httpOnly
 * dashboard_token cookie (set by /api/session on login/signup). Server
 * Components have no access to localStorage, so this cookie is the only
 * way they can know who's asking — every private page must call this and
 * redirect to /login when it returns null, and every data query must
 * scope by the id it returns. */
export async function getSessionUserId(): Promise<string | null> {
  const token = (await cookies()).get("dashboard_token")?.value;
  if (!token) return null;

  const supabase = getAdminClient();
  const { data } = await supabase
    .from("users")
    .select("id")
    .eq("dashboard_token", token)
    .single();

  return data?.id ?? null;
}
