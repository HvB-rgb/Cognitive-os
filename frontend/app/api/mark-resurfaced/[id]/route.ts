import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSessionUserId } from "@/lib/session";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const { id } = await params;
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  );

  const { data } = await supabase
    .from("cognitive_entries")
    .select("resurfaced_count")
    .eq("id", id)
    .eq("user_id", userId)
    .single();

  if (!data) {
    return NextResponse.json({ error: "Entry not found." }, { status: 404 });
  }

  await supabase.from("cognitive_entries").update({
    resurfaced_count: (data.resurfaced_count ?? 0) + 1,
    last_resurfaced_at: new Date().toISOString(),
  }).eq("id", id).eq("user_id", userId);

  return NextResponse.json({ status: "ok" });
}
