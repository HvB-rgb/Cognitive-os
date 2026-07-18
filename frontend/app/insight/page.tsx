import { getWeeklyScore, getLatestDailyPattern } from "@/lib/analyser";
import { getBuckets } from "@/lib/supabase";

export const dynamic = "force-dynamic";

function ScoreRing({ value, label, color }: { value: number; label: string; color: string }) {
  const pct = Math.round(value);
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative w-16 h-16">
        <svg viewBox="0 0 36 36" className="w-16 h-16 -rotate-90">
          <circle cx="18" cy="18" r="15.9" fill="none" stroke="#2a2a2a" strokeWidth="3" />
          <circle
            cx="18" cy="18" r="15.9" fill="none"
            stroke={color} strokeWidth="3"
            strokeDasharray={`${pct} ${100 - pct}`}
            strokeLinecap="round"
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-xs font-mono font-medium">{pct}</span>
      </div>
      <span className="text-xs text-muted">{label}</span>
    </div>
  );
}

export default async function InsightPage() {
  const [score, pattern, buckets] = await Promise.all([
    getWeeklyScore(),
    getLatestDailyPattern(),
    getBuckets(),
  ]);

  const crossTopics = (pattern?.cross_topic_data as { bucket_a: string; bucket_b: string; shared_concepts: string[]; strength: number }[]) ?? [];
  const contradictions = (pattern?.contradiction_data as { bucket: string; entry_a_title: string; entry_b_title: string; shared_concepts: string[] }[]) ?? [];

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight mb-1">Insight</h1>
        <p className="text-muted text-sm">Your weekly knowledge patterns</p>
      </div>

      {/* Weekly Score */}
      <section className="rounded-xl border border-border bg-card p-6 mb-5">
        <div className="flex items-center justify-between mb-5">
          <div>
            <p className="text-xs font-medium text-muted uppercase tracking-widest mb-1">Weekly Knowledge Score</p>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-semibold">{score.total}</span>
              <span className="text-muted">/100</span>
            </div>
          </div>
          <div className="text-right text-sm text-muted">
            <p>{score.distinctBuckets} buckets</p>
            <p>{score.activeDays} active days</p>
            <p>{score.reflectPct}% reflect</p>
          </div>
        </div>
        <div className="flex justify-around">
          <ScoreRing value={score.breadth} label="Breadth" color="#7c6af7" />
          <ScoreRing value={score.depth} label="Depth" color="#34d399" />
          <ScoreRing value={score.consistency} label="Consistency" color="#f59e0b" />
          <ScoreRing value={score.reflection} label="Reflection" color="#f472b6" />
        </div>
      </section>

      {/* Groq Synthesis */}
      {pattern?.groq_synthesis && (
        <section className="rounded-xl border border-accent/30 bg-accent/5 px-5 py-4 mb-5">
          <p className="text-xs font-medium text-accent uppercase tracking-widest mb-2">AI Coach</p>
          <p className="text-sm leading-relaxed">{pattern.groq_synthesis}</p>
          <p className="text-xs text-muted mt-2">Last analysed: {pattern.date}</p>
        </section>
      )}

      {/* Convergence */}
      {pattern?.convergence_score != null && (
        <section className="rounded-xl border border-border bg-card px-5 py-4 mb-5">
          <p className="text-xs font-medium text-muted uppercase tracking-widest mb-3">Convergence Score</p>
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <div className="h-2 rounded-full bg-border overflow-hidden">
                <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${Math.round(pattern.convergence_score * 100)}%` }} />
              </div>
            </div>
            <span className="text-sm font-mono font-medium">{Math.round(pattern.convergence_score * 100)}%</span>
          </div>
          <p className="text-xs text-muted mt-2">
            {pattern.convergence_score >= 0.7 ? "Laser focused" : pattern.convergence_score >= 0.4 ? "Balanced exploration" : "Wide-ranging curiosity"}
          </p>
        </section>
      )}

      {/* Cross-topic connections */}
      {crossTopics.length > 0 && (
        <section className="rounded-xl border border-border bg-card px-5 py-4 mb-5">
          <p className="text-xs font-medium text-muted uppercase tracking-widest mb-3">Cross-Topic Connections</p>
          <div className="flex flex-col gap-3">
            {crossTopics.slice(0, 5).map((c, i) => (
              <div key={i} className="flex items-start gap-3">
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-xs font-medium text-accent bg-accent/10 px-2 py-0.5 rounded-full">{c.bucket_a}</span>
                  <span className="text-muted text-xs">↔</span>
                  <span className="text-xs font-medium text-accent bg-accent/10 px-2 py-0.5 rounded-full">{c.bucket_b}</span>
                </div>
                <p className="text-xs text-muted">{c.shared_concepts.slice(0, 3).join(", ")}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Contradictions */}
      {contradictions.length > 0 && (
        <section className="rounded-xl border border-amber-800/40 bg-amber-950/10 px-5 py-4 mb-5">
          <p className="text-xs font-medium text-amber-400 uppercase tracking-widest mb-3">
            Contradictions Flagged ({contradictions.length})
          </p>
          <div className="flex flex-col gap-4">
            {contradictions.slice(0, 3).map((c, i) => (
              <div key={i}>
                <p className="text-xs text-muted mb-1">{c.bucket}</p>
                <p className="text-sm">"{c.entry_a_title}"</p>
                <p className="text-xs text-muted my-1">vs</p>
                <p className="text-sm">"{c.entry_b_title}"</p>
                <p className="text-xs text-muted mt-1">Shared: {c.shared_concepts.slice(0, 3).join(", ")}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Empty state */}
      {!pattern && score.total === 0 && (
        <div className="text-center py-16 text-muted text-sm">
          Start capturing thoughts — your insight dashboard fills up after your 5th entry.
        </div>
      )}

      <div className="flex gap-4 mt-2 text-xs text-muted">
        <a href="/" className="hover:text-white transition-colors">← Entries</a>
        <a href="/review" className="hover:text-white transition-colors">Review queue →</a>
      </div>
    </div>
  );
}
