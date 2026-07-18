import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  );

  const { data } = await supabase
    .from("cognitive_entries")
    .select("resurfaced_count")
    .eq("id", id)
    .single();

  await supabase.from("cognitive_entries").update({
    resurfaced_count: (data?.resurfaced_count ?? 0) + 1,
    last_resurfaced_at: new Date().toISOString(),
  }).eq("id", id);

  return NextResponse.json({ status: "ok" });
}
