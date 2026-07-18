import { createClient } from "@supabase/supabase-js";

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  );
}

export type GraphNode = {
  id: string;
  label: string;
  type: "bucket" | "entry";
  mode?: string;
  bucket?: string;
  count?: number;
  summary?: string;
  keyPoints?: string[];
  score?: number;
};

export type GraphLink = {
  source: string;
  target: string;
  type: "membership" | "cross-topic" | "shared-concept";
  strength?: number;
  sharedConcepts?: string[];
};

export type GraphData = {
  nodes: GraphNode[];
  links: GraphLink[];
};

const STOPWORDS = new Set([
  "the","a","an","is","are","was","and","or","to","of","in","for",
  "on","with","it","this","that","be","as","at","by","from","has",
  "have","its","they","their","which","also","can","will","more",
]);

function extractKeywords(texts: string[]): Set<string> {
  const words = new Set<string>();
  texts.forEach((t) => {
    t.toLowerCase().split(/\s+/).forEach((w) => {
      const clean = w.replace(/[.,!?;:'"()\[\]]/g, "");
      if (clean.length > 4 && !STOPWORDS.has(clean)) words.add(clean);
    });
  });
  return words;
}

export async function getGraphData(): Promise<GraphData> {
  const supabase = getAdminClient();

  const [bucketsRes, entriesRes, patternsRes] = await Promise.all([
    supabase.from("buckets").select("id, name, entry_count"),
    supabase
      .from("cognitive_entries")
      .select("id, title, bucket, cognitive_mode, summary, key_points, actionability_score")
      .eq("processing_status", "completed")
      .order("created_at", { ascending: false })
      .limit(80),
    supabase
      .from("daily_patterns")
      .select("cross_topic_data")
      .order("date", { ascending: false })
      .limit(1),
  ]);

  const buckets = bucketsRes.data ?? [];
  const entries = entriesRes.data ?? [];
  const crossTopics =
    (patternsRes.data?.[0]?.cross_topic_data as {
      bucket_a: string;
      bucket_b: string;
      strength: number;
    }[]) ?? [];

  // Pre-compute keywords per entry for cross-entry links
  const entryKeywords = entries.map((e) =>
    extractKeywords([e.title ?? "", ...(e.key_points ?? [])])
  );

  // Find cross-entry concept links (entries in different buckets sharing 3+ keywords)
  const sharedConceptLinks: GraphLink[] = [];
  for (let i = 0; i < entries.length; i++) {
    for (let j = i + 1; j < entries.length; j++) {
      if (entries[i].bucket === entries[j].bucket) continue;
      const shared = Array.from(entryKeywords[i]).filter((w) => entryKeywords[j].has(w));
      if (shared.length >= 3) {
        const strength = shared.length / Math.max(entryKeywords[i].size, entryKeywords[j].size);
        if (strength > 0.12) {
          sharedConceptLinks.push({
            source: `entry:${entries[i].id}`,
            target: `entry:${entries[j].id}`,
            type: "shared-concept",
            strength: Math.round(strength * 100) / 100,
            sharedConcepts: shared.slice(0, 5),
          });
        }
      }
    }
  }

  const nodes: GraphNode[] = [
    ...buckets.map((b) => ({
      id: `bucket:${b.name}`,
      label: b.name,
      type: "bucket" as const,
      count: b.entry_count ?? 0,
    })),
    ...entries.map((e) => ({
      id: `entry:${e.id}`,
      label: e.title ?? "Untitled",
      type: "entry" as const,
      mode: e.cognitive_mode,
      bucket: e.bucket,
      summary: e.summary,
      keyPoints: e.key_points ?? [],
      score: e.actionability_score,
    })),
  ];

  const links: GraphLink[] = [
    ...entries
      .filter((e) => e.bucket)
      .map((e) => ({
        source: `entry:${e.id}`,
        target: `bucket:${e.bucket}`,
        type: "membership" as const,
      })),
    ...crossTopics.map((c) => ({
      source: `bucket:${c.bucket_a}`,
      target: `bucket:${c.bucket_b}`,
      type: "cross-topic" as const,
      strength: c.strength,
    })),
    ...sharedConceptLinks,
  ];

  return { nodes, links };
}
