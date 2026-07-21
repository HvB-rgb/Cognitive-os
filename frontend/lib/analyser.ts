import { createClient } from "@supabase/supabase-js";

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_KEY!;
  return createClient(url, key);
}

export type WeeklyScore = {
  total: number;
  breadth: number;
  depth: number;
  consistency: number;
  reflection: number;
  distinctBuckets: number;
  activeDays: number;
  reflectPct: number;
};

export type SpacedEntry = {
  id: string;
  title: string;
  summary: string;
  bucket: string;
  key_points: string[];
  cognitive_mode: string;
  actionability_score: number;
  created_at: string;
  last_resurfaced_at: string | null;
  resurfaced_count: number;
  intervalDays: number;
};

export type DailyPattern = {
  date: string;
  convergence_score: number | null;
  weekly_score: Record<string, number> | null;
  cross_topic_data: unknown[] | null;
  contradiction_data: unknown[] | null;
  groq_synthesis: string | null;
  entry_count_at_trigger: number | null;
};

export async function getWeeklyScore(userId: string): Promise<WeeklyScore> {
  const supabase = getAdminClient();
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);

  const { data } = await supabase
    .from("cognitive_entries")
    .select("bucket, cognitive_mode, created_at")
    .eq("user_id", userId)
    .gte("created_at", weekAgo.toISOString())
    .eq("processing_status", "completed");

  const entries = data ?? [];
  if (!entries.length) return { total: 0, breadth: 0, depth: 0, consistency: 0, reflection: 0, distinctBuckets: 0, activeDays: 0, reflectPct: 0 };

  const distinctBuckets = new Set(entries.map((e) => e.bucket).filter(Boolean)).size;
  const bucketCounts: Record<string, number> = {};
  entries.forEach((e) => { if (e.bucket) bucketCounts[e.bucket] = (bucketCounts[e.bucket] || 0) + 1; });
  const avgPerBucket = Object.keys(bucketCounts).length > 0
    ? Object.values(bucketCounts).reduce((a, b) => a + b, 0) / Object.keys(bucketCounts).length
    : 0;
  const activeDays = new Set(entries.map((e) => e.created_at.slice(0, 10))).size;
  const reflectCount = entries.filter((e) => e.cognitive_mode === "reflect").length;
  const reflectRatio = reflectCount / entries.length;

  const breadth = Math.min(distinctBuckets / 5, 1) * 25;
  const depth = Math.min(avgPerBucket / 8, 1) * 25;
  const consistency = (activeDays / 7) * 25;
  const reflection = Math.min(reflectRatio / 0.2, 1) * 25;

  return {
    total: Math.round(breadth + depth + consistency + reflection),
    breadth: Math.round(breadth * 10) / 10,
    depth: Math.round(depth * 10) / 10,
    consistency: Math.round(consistency * 10) / 10,
    reflection: Math.round(reflection * 10) / 10,
    distinctBuckets,
    activeDays,
    reflectPct: Math.round(reflectRatio * 100),
  };
}

export async function getSpacedRepetitionEntries(userId: string): Promise<SpacedEntry[]> {
  const supabase = getAdminClient();
  const today = new Date();
  const all: SpacedEntry[] = [];

  for (const interval of [7, 14, 30]) {
    const start = new Date(today);
    start.setDate(today.getDate() - interval - 1);
    const end = new Date(today);
    end.setDate(today.getDate() - interval + 1);

    const { data } = await supabase
      .from("cognitive_entries")
      .select("id, title, summary, bucket, key_points, cognitive_mode, actionability_score, last_resurfaced_at, resurfaced_count, created_at")
      .eq("user_id", userId)
      .gte("created_at", start.toISOString())
      .lt("created_at", end.toISOString())
      .eq("processing_status", "completed");

    for (const entry of data ?? []) {
      if (entry.last_resurfaced_at) {
        const daysSince = (today.getTime() - new Date(entry.last_resurfaced_at).getTime()) / 86400000;
        if (daysSince < 5) continue;
      }
      all.push({ ...entry, intervalDays: interval });
    }
  }

  return all;
}

export async function getLatestDailyPattern(userId: string): Promise<DailyPattern | null> {
  const supabase = getAdminClient();
  const { data } = await supabase
    .from("daily_patterns")
    .select("date, convergence_score, weekly_score, cross_topic_data, contradiction_data, groq_synthesis, entry_count_at_trigger")
    .eq("user_id", userId)
    .order("date", { ascending: false })
    .limit(1);

  return data?.[0] ?? null;
}

export type WeekActivityEntry = {
  bucket: string;
  actionability_score: number;
  created_at: string;
};

/** Raw last-7-days entries (bucket/score/timestamp only) — the overview
 * dashboard derives "active buckets this week", the capture heatmap, and
 * the actionability dot-chart from this single query instead of three. */
export async function getWeekActivity(userId: string, sinceDays = 7): Promise<WeekActivityEntry[]> {
  const supabase = getAdminClient();
  const since = new Date();
  since.setDate(since.getDate() - sinceDays);

  const { data } = await supabase
    .from("cognitive_entries")
    .select("bucket, actionability_score, created_at")
    .eq("user_id", userId)
    .gte("created_at", since.toISOString())
    .eq("processing_status", "completed");

  return (data ?? []) as WeekActivityEntry[];
}

export async function markResurfaced(entryId: string, userId: string): Promise<void> {
  const supabase = getAdminClient();
  const { data } = await supabase
    .from("cognitive_entries")
    .select("resurfaced_count")
    .eq("id", entryId)
    .eq("user_id", userId)
    .single();

  await supabase.from("cognitive_entries").update({
    resurfaced_count: (data?.resurfaced_count ?? 0) + 1,
    last_resurfaced_at: new Date().toISOString(),
  }).eq("id", entryId).eq("user_id", userId);
}
