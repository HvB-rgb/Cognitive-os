import { getBuckets, getEntries, type CognitiveEntry, type Bucket } from "@/lib/supabase";
import EntryFeed from "@/components/EntryFeed";

export const revalidate = 60;

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ bucket?: string }>;
}) {
  const { bucket } = await searchParams;

  let entries: CognitiveEntry[] = [];
  let buckets: Bucket[] = [];
  let error: string | null = null;

  try {
    [entries, buckets] = await Promise.all([getEntries(bucket), getBuckets()]);
  } catch (e) {
    error = e instanceof Error ? e.message : "Failed to load data";
  }

  const totalEntries = buckets.reduce((sum, b) => sum + (b.entry_count ?? 0), 0);

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      {/* Header */}
      <div className="mb-10">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-baseline gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">Cognitive OS</h1>
            <span className="text-sm text-muted font-mono">{totalEntries} entries</span>
          </div>
          <nav className="flex gap-4 text-sm text-muted">
            <a href="/capture" className="hover:text-white transition-colors">Capture</a>
            <a href="/graph" className="hover:text-white transition-colors">Graph</a>
            <a href="/insight" className="hover:text-white transition-colors">Insight</a>
            <a href="/review" className="hover:text-white transition-colors">Review</a>
          </nav>
        </div>
        <p className="text-muted text-sm">Your personal knowledge layer</p>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-900/50 bg-red-950/20 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      ) : (
        <div className="flex gap-8">
          {/* Sidebar — Buckets */}
          <aside className="w-44 shrink-0">
            <p className="text-xs font-medium text-muted uppercase tracking-widest mb-3">Buckets</p>
            <nav className="flex flex-col gap-1">
              <a
                href="/dashboard"
                className={`flex items-center justify-between rounded-md px-3 py-2 text-sm transition-colors ${
                  !bucket
                    ? "bg-accent/15 text-accent font-medium"
                    : "text-muted hover:text-white hover:bg-card"
                }`}
              >
                <span>All</span>
                <span className="text-xs font-mono">{totalEntries}</span>
              </a>
              {buckets.map((b) => (
                <a
                  key={b.id}
                  href={`/dashboard?bucket=${encodeURIComponent(b.name)}`}
                  className={`flex items-center justify-between rounded-md px-3 py-2 text-sm transition-colors ${
                    bucket === b.name
                      ? "bg-accent/15 text-accent font-medium"
                      : "text-muted hover:text-white hover:bg-card"
                  }`}
                >
                  <span className="truncate">{b.name}</span>
                  <span className="text-xs font-mono shrink-0 ml-2">{b.entry_count}</span>
                </a>
              ))}
            </nav>
          </aside>

          {/* Entry Feed */}
          <main className="flex-1 min-w-0">
            {entries.length === 0 ? (
              <div className="text-center py-20 text-muted text-sm">
                No entries{bucket ? ` in ${bucket}` : ""} yet.
              </div>
            ) : (
              <EntryFeed entries={entries} />
            )}
          </main>
        </div>
      )}
    </div>
  );
}
