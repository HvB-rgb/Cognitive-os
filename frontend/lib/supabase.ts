import { createClient } from "@supabase/supabase-js";

export type CognitiveEntry = {
  id: string;
  user_id: string;
  input_type: string;
  cognitive_mode: "learn" | "think" | "reflect";
  original_input: string;
  source_url: string | null;
  cleaned_text: string;
  title: string;
  summary: string;
  key_points: string[];
  bucket: string;
  actionability_score: number;
  processing_status: string;
  created_at: string;
};

export type Bucket = {
  id: string;
  name: string;
  entry_count: number;
};

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) throw new Error("Supabase env vars not set");
  return createClient(url, key);
}

export async function getEntries(userId: string, bucket?: string): Promise<CognitiveEntry[]> {
  const supabase = getAdminClient();
  let query = supabase
    .from("cognitive_entries")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (bucket) query = query.eq("bucket", bucket);

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as CognitiveEntry[];
}

/** Single entry for the detail view. Scoped by user_id so one user can't
 * open another user's entry by guessing its UUID. Returns null if the id
 * doesn't exist or isn't theirs. */
export async function getEntry(userId: string, id: string): Promise<CognitiveEntry | null> {
  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from("cognitive_entries")
    .select("*")
    .eq("user_id", userId)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return (data as CognitiveEntry | null) ?? null;
}

export async function getBuckets(userId: string): Promise<Bucket[]> {
  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from("buckets")
    .select("id, name, entry_count")
    .eq("user_id", userId)
    .order("entry_count", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Bucket[];
}
