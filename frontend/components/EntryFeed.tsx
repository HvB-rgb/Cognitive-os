"use client";

import { useState } from "react";
import type { CognitiveEntry } from "@/lib/supabase";

const MODE_COLORS = {
  learn: "text-blue-400 bg-blue-400/10",
  think: "text-purple-400 bg-purple-400/10",
  reflect: "text-amber-400 bg-amber-400/10",
};

const MODE_LABELS = {
  learn: "Learn",
  think: "Think",
  reflect: "Reflect",
};

function scoreBar(score: number) {
  const pct = Math.round(score * 100);
  return (
    <div className="flex items-center gap-2">
      <div className="h-1 w-16 rounded-full bg-border overflow-hidden">
        <div
          className="h-full rounded-full bg-accent"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs font-mono text-muted">{pct}%</span>
    </div>
  );
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function EntryCard({ entry }: { entry: CognitiveEntry }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <article
      className="rounded-xl border border-border bg-card p-5 cursor-pointer hover:border-accent/40 transition-colors"
      onClick={() => setExpanded((v) => !v)}
    >
      {/* Top row */}
      <div className="flex items-start justify-between gap-4 mb-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className={`text-xs font-medium px-2 py-0.5 rounded-full ${
              MODE_COLORS[entry.cognitive_mode] ?? "text-muted bg-border"
            }`}
          >
            {MODE_LABELS[entry.cognitive_mode] ?? entry.cognitive_mode}
          </span>
          <span className="text-xs text-muted bg-border px-2 py-0.5 rounded-full">
            {entry.bucket}
          </span>
        </div>
        <span className="text-xs text-muted shrink-0 font-mono">
          {formatDate(entry.created_at)}
        </span>
      </div>

      {/* Title */}
      <h2 className="text-base font-medium mb-2 leading-snug">{entry.title}</h2>

      {/* Summary */}
      <p className="text-sm text-muted leading-relaxed">{entry.summary}</p>

      {/* Expanded: key points + score */}
      {expanded && (
        <div className="mt-4 pt-4 border-t border-border space-y-4">
          {entry.key_points?.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted uppercase tracking-widest mb-2">
                Key points
              </p>
              <ul className="space-y-1">
                {entry.key_points.map((pt, i) => (
                  <li key={i} className="text-sm text-muted flex gap-2">
                    <span className="text-accent mt-0.5">·</span>
                    <span>{pt}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex items-center gap-6">
            <div>
              <p className="text-xs text-muted mb-1">Actionability</p>
              {scoreBar(entry.actionability_score ?? 0)}
            </div>
            <div>
              <p className="text-xs text-muted mb-1">Input</p>
              <span className="text-xs font-mono text-muted capitalize">
                {entry.input_type}
              </span>
            </div>
            {entry.source_url && (
              <div className="min-w-0 flex-1">
                <p className="text-xs text-muted mb-1">Source</p>
                <a
                  href={entry.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="text-xs text-accent hover:underline truncate block"
                >
                  {entry.source_url}
                </a>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Expand hint */}
      <div className="mt-3 text-xs text-muted/50 select-none">
        {expanded ? "↑ collapse" : "↓ expand"}
      </div>
    </article>
  );
}

export default function EntryFeed({ entries }: { entries: CognitiveEntry[] }) {
  return (
    <div className="flex flex-col gap-3">
      {entries.map((entry) => (
        <EntryCard key={entry.id} entry={entry} />
      ))}
    </div>
  );
}
