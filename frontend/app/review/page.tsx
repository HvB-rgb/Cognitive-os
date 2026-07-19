import { getSpacedRepetitionEntries, type SpacedEntry } from "@/lib/analyser";
import ReviewCard from "@/components/ReviewCard";

export const dynamic = "force-dynamic";

export default async function ReviewPage() {
  let entries: SpacedEntry[] = [];
  let error: string | null = null;

  try {
    entries = await getSpacedRepetitionEntries();
  } catch (e) {
    error = e instanceof Error ? e.message : "Failed to load review queue";
  }

  const byInterval: Record<number, SpacedEntry[]> = { 7: [], 14: [], 30: [] };
  for (const e of entries) byInterval[e.intervalDays]?.push(e);

  const labels: Record<number, string> = {
    7: "7 days ago",
    14: "2 weeks ago",
    30: "1 month ago",
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight mb-1">Review Queue</h1>
        <p className="text-muted text-sm">
          {entries.length > 0
            ? `${entries.length} entries due for review — spaced repetition keeps ideas alive`
            : "No entries due for review right now"}
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-900/50 bg-red-950/20 px-4 py-3 text-sm text-red-400 mb-6">
          {error}
        </div>
      )}

      {entries.length === 0 && !error && (
        <div className="text-center py-20 text-muted text-sm">
          Check back after you have entries that are 7, 14, or 30 days old.
        </div>
      )}

      {([7, 14, 30] as const).map((interval) => {
        const group = byInterval[interval];
        if (!group.length) return null;
        return (
          <section key={interval} className="mb-8">
            <p className="text-xs font-medium text-muted uppercase tracking-widest mb-3">
              {labels[interval]} — {group.length} {group.length === 1 ? "entry" : "entries"}
            </p>
            <div className="flex flex-col gap-3">
              {group.map((entry) => (
                <ReviewCard key={entry.id} entry={entry} />
              ))}
            </div>
          </section>
        );
      })}

      <div className="flex gap-4 mt-2 text-xs text-muted">
        <a href="/dashboard" className="hover:text-white transition-colors">← Entries</a>
        <a href="/insight" className="hover:text-white transition-colors">Insight →</a>
      </div>
    </div>
  );
}
