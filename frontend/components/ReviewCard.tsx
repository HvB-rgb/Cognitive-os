"use client";

import { useState } from "react";
import type { SpacedEntry } from "@/lib/analyser";

const MODE_LABELS: Record<string, string> = {
  learn: "Learn",
  think: "Think",
  reflect: "Reflect",
};

export default function ReviewCard({ entry }: { entry: SpacedEntry }) {
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  async function handleMark() {
    setLoading(true);
    setFailed(false);
    try {
      const res = await fetch(`/api/mark-resurfaced/${entry.id}`, { method: "POST" });
      if (!res.ok) {
        setFailed(true);
        return;
      }
      setDone(true);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={`rcard ${done ? "done" : ""}`}>
      <div>
        <div className="tags">
          <span className={`tag ${entry.cognitive_mode}`}>
            {MODE_LABELS[entry.cognitive_mode] ?? entry.cognitive_mode}
          </span>
          <span className="tag bucket">{entry.bucket}</span>
        </div>
        <p className={`rtitle ${done ? "struck" : ""}`}>{entry.title}</p>
        <span className="rmeta">
          {done
            ? "Marked as reviewed"
            : failed
              ? "Couldn't save — try again"
              : `Reviewed ${entry.resurfaced_count ?? 0} ${entry.resurfaced_count === 1 ? "time" : "times"}`}
        </span>
      </div>
      {!done && (
        <button className="markbtn" onClick={handleMark} disabled={loading}>
          {loading ? "Saving…" : failed ? "Retry" : "Mark as reviewed"}
        </button>
      )}

      <style jsx>{`
        .rcard {
          background: #faf8f2;
          border: 1px solid #e2dbc7;
          border-radius: 10px;
          padding: 18px 20px;
          margin-bottom: 12px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 16px;
        }
        .rcard.done {
          opacity: 0.5;
        }
        .tags {
          display: flex;
          gap: 8px;
          margin-bottom: 8px;
        }
        .tag {
          font-family: "JetBrains Mono", monospace;
          font-size: 10.5px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          border-radius: 999px;
          padding: 3px 10px;
        }
        .tag.learn {
          background: #e7f0ff;
          color: #2563eb;
        }
        .tag.think {
          background: #eee9fe;
          color: #7c3aed;
        }
        .tag.reflect {
          background: #fdf1d8;
          color: #a3690a;
        }
        .tag.bucket {
          background: #f0ece0;
          color: #5b564a;
          font-weight: 500;
          text-transform: none;
          letter-spacing: 0;
        }
        .rtitle {
          font-size: 15px;
          font-weight: 600;
          margin: 0 0 6px;
          color: #1c1c20;
        }
        .rtitle.struck {
          text-decoration: line-through;
          color: #8a8474;
          font-weight: 500;
        }
        .rmeta {
          font-size: 12px;
          color: #9a9482;
        }
        .markbtn {
          background: #eef3fe;
          color: #2f6fed;
          border: none;
          padding: 9px 16px;
          border-radius: 8px;
          font-size: 12.5px;
          font-weight: 600;
          cursor: pointer;
          font-family: inherit;
          flex-shrink: 0;
        }
        .markbtn:disabled {
          opacity: 0.5;
          cursor: default;
        }
      `}</style>
    </div>
  );
}
