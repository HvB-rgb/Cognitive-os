"use client";

import { useState } from "react";
import type { SpacedEntry } from "@/lib/analyser";

const MODE_COLORS: Record<string, string> = {
  learn: "text-blue-400 bg-blue-400/10",
  think: "text-purple-400 bg-purple-400/10",
  reflect: "text-amber-400 bg-amber-400/10",
};

export default function ReviewCard({ entry }: { entry: SpacedEntry }) {
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleMark() {
    setLoading(true);
    try {
      await fetch(`/api/mark-resurfaced/${entry.id}`, { method: "POST" });
      setDone(true);
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <div className="rounded-xl border border-border bg-card px-5 py-4 opacity-40">
        <p className="text-sm text-muted line-through">{entry.title}</p>
        <p className="text-xs text-muted mt-1">Marked as reviewed</p>
      </div>
    );
  }

  return (
    <article className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-start justify-between gap-4 mb-3">
        <div className="flex items-center gap-2">
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${MODE_COLORS[entry.cognitive_mode] ?? "text-muted bg-border"}`}>
            {entry.cognitive_mode}
          </span>
          <span className="text-xs text-muted bg-border px-2 py-0.5 rounded-full">{entry.bucket}</span>
        </div>
        <span className="text-xs text-muted font-mono shrink-0">
          {new Date(entry.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
        </span>
      </div>

      <h2 className="text-base font-medium mb-2">{entry.title}</h2>
      <p className="text-sm text-muted leading-relaxed mb-4">{entry.summary}</p>

      {entry.key_points?.length > 0 && (
        <ul className="mb-4 space-y-1">
          {entry.key_points.map((pt, i) => (
            <li key={i} className="text-sm text-muted flex gap-2">
              <span className="text-accent">·</span>
              <span>{pt}</span>
            </li>
          ))}
        </ul>
      )}

      <div className="flex items-center justify-between">
        <span className="text-xs text-muted">
          Reviewed {entry.resurfaced_count ?? 0} {entry.resurfaced_count === 1 ? "time" : "times"}
        </span>
        <button
          onClick={handleMark}
          disabled={loading}
          className="text-xs font-medium px-3 py-1.5 rounded-lg bg-accent/15 text-accent hover:bg-accent/25 transition-colors disabled:opacity-50"
        >
          {loading ? "Saving…" : "Mark as reviewed"}
        </button>
      </div>
    </article>
  );
}
