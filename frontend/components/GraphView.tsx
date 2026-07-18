"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import type { GraphData, GraphNode, GraphLink } from "@/lib/graph";

const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full text-muted text-sm">
      Initialising graph…
    </div>
  ),
});

const MODE_COLORS: Record<string, string> = {
  learn: "#60a5fa",
  think: "#a78bfa",
  reflect: "#fbbf24",
};

const BUCKET_COLORS = [
  "#7c6af7", "#e879f9", "#34d399", "#f97316", "#06b6d4", "#f43f5e",
  "#84cc16", "#eab308",
];

type SimNode = GraphNode & { x?: number; y?: number; fx?: number; fy?: number };
type SimLink = GraphLink & { source: SimNode; target: SimNode };

/* ── Chips ──────────────────────────────────────────────────── */
function ModeChip({ mode }: { mode: string }) {
  const cls: Record<string, string> = {
    learn: "bg-blue-400/15 text-blue-400",
    think: "bg-purple-400/15 text-purple-400",
    reflect: "bg-amber-400/15 text-amber-400",
  };
  return (
    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full shrink-0 ${cls[mode] ?? "bg-border text-muted"}`}>
      {mode}
    </span>
  );
}

function ScoreDots({ score }: { score: number }) {
  const filled = Math.round(score * 5);
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className={`w-1.5 h-1.5 rounded-full ${i < filled ? "bg-accent" : "bg-border"}`} />
      ))}
    </div>
  );
}

/* ── Bucket panel ───────────────────────────────────────────── */
function BucketPanel({
  bucketName, bucketColor, entries, onClose, onSelectEntry,
}: {
  bucketName: string; bucketColor: string; entries: SimNode[];
  onClose: () => void; onSelectEntry: (n: SimNode) => void;
}) {
  const router = useRouter();
  const modes = entries.reduce<Record<string, number>>((acc, e) => {
    const m = e.mode ?? "learn"; acc[m] = (acc[m] ?? 0) + 1; return acc;
  }, {});

  return (
    <div className="absolute top-0 right-0 h-full w-80 bg-[#0f0f0f] border-l border-border flex flex-col z-20 shadow-2xl">
      <div className="p-4 border-b border-border shrink-0">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2.5">
            <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: bucketColor }} />
            <div>
              <p className="text-[10px] text-muted uppercase tracking-widest mb-0.5">Bucket</p>
              <h2 className="text-sm font-semibold">{bucketName}</h2>
            </div>
          </div>
          <button onClick={onClose} className="text-muted hover:text-white text-xl leading-none shrink-0 mt-0.5">×</button>
        </div>
        <div className="flex gap-2 mt-3">
          {Object.entries(modes).map(([mode, count]) => (
            <div key={mode} className="flex items-center gap-1 text-xs text-muted">
              <ModeChip mode={mode} /><span>{count}</span>
            </div>
          ))}
        </div>
        <p className="text-2xl font-semibold mt-2">
          {entries.length}<span className="text-xs font-normal text-muted ml-1.5">entries</span>
        </p>
      </div>

      <div className="flex-1 overflow-y-auto divide-y divide-border/40">
        {entries.map((entry) => (
          <button key={entry.id} onClick={() => onSelectEntry(entry)}
            className="w-full text-left px-4 py-3 hover:bg-white/[0.04] transition-colors group">
            <div className="flex items-start gap-2">
              <ModeChip mode={entry.mode ?? "learn"} />
              <p className="text-xs font-medium leading-snug group-hover:text-white transition-colors line-clamp-2">
                {entry.label}
              </p>
            </div>
            {entry.summary && (
              <p className="text-[10px] text-muted mt-1.5 leading-relaxed line-clamp-2">
                {entry.summary}
              </p>
            )}
          </button>
        ))}
      </div>

      <div className="p-4 border-t border-border shrink-0">
        <button onClick={() => router.push(`/?bucket=${encodeURIComponent(bucketName)}`)}
          className="w-full text-xs font-medium py-2 rounded-lg transition-colors"
          style={{ backgroundColor: bucketColor + "22", border: `1px solid ${bucketColor}44`, color: bucketColor }}>
          Open {bucketName} feed →
        </button>
      </div>
    </div>
  );
}

/* ── Entry panel ────────────────────────────────────────────── */
function EntryPanel({ node, onClose }: { node: SimNode; onClose: () => void }) {
  const router = useRouter();
  return (
    <div className="absolute top-0 right-0 h-full w-80 bg-[#0f0f0f] border-l border-border flex flex-col z-20 shadow-2xl">
      <div className="flex items-start justify-between p-4 border-b border-border">
        <div className="flex-1 min-w-0 pr-2">
          <div className="mb-1.5"><ModeChip mode={node.mode ?? "learn"} /></div>
          <h2 className="text-sm font-semibold leading-snug">{node.label}</h2>
        </div>
        <button onClick={onClose} className="text-muted hover:text-white text-xl leading-none shrink-0">×</button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {node.bucket && (
          <div>
            <p className="text-[10px] text-muted uppercase tracking-widest mb-1">Bucket</p>
            <span className="text-xs bg-accent/10 text-accent px-2 py-0.5 rounded-full">{node.bucket}</span>
          </div>
        )}
        {node.summary && (
          <div>
            <p className="text-[10px] text-muted uppercase tracking-widest mb-1.5">Summary</p>
            <p className="text-muted leading-relaxed text-xs">{node.summary}</p>
          </div>
        )}
        {node.keyPoints && node.keyPoints.length > 0 && (
          <div>
            <p className="text-[10px] text-muted uppercase tracking-widest mb-1.5">Key Points</p>
            <ul className="space-y-1.5">
              {node.keyPoints.map((pt, i) => (
                <li key={i} className="flex gap-2 text-xs text-muted">
                  <span className="text-accent shrink-0 mt-0.5">·</span>
                  <span className="leading-relaxed">{pt}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {node.score != null && (
          <div>
            <p className="text-[10px] text-muted uppercase tracking-widest mb-1.5">Actionability</p>
            <ScoreDots score={node.score} />
          </div>
        )}
      </div>

      <div className="p-4 border-t border-border">
        <button onClick={() => router.push(`/?bucket=${encodeURIComponent(node.bucket ?? "")}`)}
          className="w-full text-xs font-medium py-2 rounded-lg bg-border text-muted hover:text-white transition-colors">
          Go to {node.bucket} bucket →
        </button>
      </div>
    </div>
  );
}

/* ── Main ───────────────────────────────────────────────────── */
export default function GraphView({ data }: { data: GraphData }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const fgRef = useRef<any>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [focusedBucket, setFocusedBucket] = useState<string | null>(null);
  // Capture bucket x,y at click time — node position is guaranteed valid at that moment
  const focusedBucketPos = useRef<{ x: number; y: number } | null>(null);
  const [selectedEntry, setSelectedEntry] = useState<SimNode | null>(null);
  const [hovered, setHovered] = useState<SimNode | null>(null);

  const panelOpen = focusedBucket !== null || selectedEntry !== null;

  /* stable bucket→color map */
  const colorMap = useRef<Record<string, string>>({});
  data.nodes.filter((n) => n.type === "bucket").forEach((n, i) => {
    if (!colorMap.current[n.label])
      colorMap.current[n.label] = BUCKET_COLORS[i % BUCKET_COLORS.length];
  });
  const bucketColor = (name: string) => colorMap.current[name] ?? BUCKET_COLORS[0];

  /* resize */
  useEffect(() => {
    const update = () => {
      if (!containerRef.current) return;
      setDimensions({
        width: Math.max(containerRef.current.clientWidth - (panelOpen ? 320 : 0), 300),
        height: containerRef.current.clientHeight,
      });
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [panelOpen]);

  /* ── Spread entries in rings when bucket is focused ─────────
     Uses the click-time position (stored in focusedBucketPos ref)
     which is always valid — no timing guesswork needed.
     >12 entries → two concentric rings so nothing overlaps.      */
  useEffect(() => {
    if (!fgRef.current) return;

    // Release all pins
    data.nodes.forEach((n) => {
      const s = n as SimNode;
      s.fx = undefined;
      s.fy = undefined;
    });

    if (!focusedBucket || !focusedBucketPos.current) {
      fgRef.current.d3ReheatSimulation();
      setTimeout(() => fgRef.current?.zoomToFit(500, 40), 400);
      return;
    }

    const { x: bx, y: by } = focusedBucketPos.current;

    // Pin bucket at its click-time position
    const bucketNode = data.nodes.find(
      (n) => n.type === "bucket" && n.label === focusedBucket
    ) as SimNode | undefined;
    if (bucketNode) { bucketNode.fx = bx; bucketNode.fy = by; }

    const entries = data.nodes.filter(
      (n) => n.type === "entry" && n.bucket === focusedBucket
    ) as SimNode[];
    if (entries.length === 0) return;

    const INNER_LIMIT = 12;
    const inner = entries.slice(0, INNER_LIMIT);
    const outer = entries.slice(INNER_LIMIT);

    // Inner ring: entries 1–12, radius = 100 + spacing per entry
    const r1 = Math.max(110, inner.length * 12);
    inner.forEach((entry, i) => {
      const angle = (i / inner.length) * 2 * Math.PI - Math.PI / 2;
      entry.fx = bx + r1 * Math.cos(angle);
      entry.fy = by + r1 * Math.sin(angle);
    });

    // Outer ring: entries 13+, 55% further out
    if (outer.length > 0) {
      const r2 = r1 * 1.55;
      outer.forEach((entry, i) => {
        const angle = (i / outer.length) * 2 * Math.PI - Math.PI / 2;
        entry.fx = bx + r2 * Math.cos(angle);
        entry.fy = by + r2 * Math.sin(angle);
      });
    }

    fgRef.current.d3ReheatSimulation();

    setTimeout(() => {
      fgRef.current?.zoomToFit(
        600, 60,
        (n: SimNode) =>
          (n.type === "entry" && n.bucket === focusedBucket) ||
          (n.type === "bucket" && n.label === focusedBucket)
      );
    }, 400);
  }, [focusedBucket, data]);

  /* ── Canvas: node painter ──────────────────────────────────── */
  const paintNode = useCallback(
    (node: object, ctx: CanvasRenderingContext2D, globalScale: number) => {
      const n = node as SimNode & { x: number; y: number };
      const isBucket = n.type === "bucket";
      const isHovered = hovered?.id === n.id;
      const isFocusedBucket = isBucket && n.label === focusedBucket;
      const isInFocused = !isBucket && n.bucket === focusedBucket;
      const isSelected = selectedEntry?.id === n.id;
      const dimmed = focusedBucket !== null && !isFocusedBucket && !isInFocused;

      const color = isBucket
        ? bucketColor(n.label)
        : (MODE_COLORS[n.mode ?? "learn"] ?? "#888");

      // Bucket radius: sqrt-scale capped at 20 so large buckets don't swamp entries
      const r = isBucket
        ? Math.min(Math.max(Math.sqrt(n.count ?? 1) * 3.5 + 8, 12), 20)
        : isInFocused ? 7 : 5;

      ctx.globalAlpha = dimmed ? 0.06 : 1;

      // Glow
      if (!dimmed && (isFocusedBucket || isInFocused || isSelected || isHovered)) {
        ctx.shadowColor = color;
        ctx.shadowBlur = isFocusedBucket ? 30 : isInFocused ? 18 : 14;
      }

      ctx.beginPath();
      ctx.arc(n.x, n.y, r, 0, 2 * Math.PI);
      ctx.fillStyle = color + (isInFocused || isSelected || isBucket ? "ff" : "aa");
      ctx.fill();

      if (isFocusedBucket || isSelected) {
        ctx.beginPath();
        ctx.arc(n.x, n.y, r + 3.5, 0, 2 * Math.PI);
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      ctx.shadowBlur = 0;
      ctx.shadowColor = "transparent";
      ctx.globalAlpha = 1;

      // Labels: bucket always; entry only on hover or explicit select (panel shows the rest)
      const showLabel = isBucket || isSelected || isHovered || globalScale > 3;
      if (showLabel && !dimmed) {
        const raw = n.label.length > 26 ? n.label.slice(0, 26) + "…" : n.label;
        const fs = isBucket
          ? Math.max(13 / globalScale, 9)
          : Math.max(10 / globalScale, 7.5);
        ctx.font = `${isBucket ? "600 " : ""}${fs}px Inter, sans-serif`;
        ctx.textAlign = "center";
        if (isBucket) {
          const tw = ctx.measureText(raw).width;
          ctx.fillStyle = "rgba(8,8,8,0.82)";
          ctx.fillRect(n.x - tw / 2 - 3, n.y + r + 2, tw + 6, fs + 4);
        }
        ctx.fillStyle = isBucket ? "#e5e5e5" : "#bbb";
        ctx.fillText(raw, n.x, n.y + r + fs + 3);
      }
    },
    [hovered, focusedBucket, selectedEntry]
  );

  /* ── Canvas: link painter ──────────────────────────────────── */
  const paintLink = useCallback(
    (link: object, ctx: CanvasRenderingContext2D) => {
      const l = link as SimLink;
      const src = l.source, tgt = l.target;
      if (src.x == null || tgt.x == null) return;

      const inFocus = focusedBucket && (
        (src as GraphNode).bucket === focusedBucket ||
        (src as GraphNode).label === focusedBucket ||
        (tgt as GraphNode).bucket === focusedBucket ||
        (tgt as GraphNode).label === focusedBucket
      );
      const dimmed = focusedBucket && !inFocus;

      ctx.globalAlpha = dimmed ? 0.03 : 1;
      ctx.beginPath();
      ctx.moveTo(src.x!, src.y!);

      if (l.type === "shared-concept") {
        const mx = (src.x! + tgt.x!) / 2, my = (src.y! + tgt.y!) / 2 - 20;
        ctx.quadraticCurveTo(mx, my, tgt.x!, tgt.y!);
        ctx.setLineDash([3, 4]);
        ctx.strokeStyle = (MODE_COLORS[(src as GraphNode).mode ?? "learn"] ?? "#888") + (inFocus ? "88" : "44");
        ctx.lineWidth = 1;
      } else if (l.type === "cross-topic") {
        ctx.lineTo(tgt.x!, tgt.y!);
        ctx.setLineDash([]);
        ctx.strokeStyle = inFocus ? "rgba(124,106,247,0.8)" : "rgba(124,106,247,0.4)";
        ctx.lineWidth = (l.strength ?? 0.3) * 5 + 1;
      } else {
        ctx.lineTo(tgt.x!, tgt.y!);
        ctx.setLineDash([]);
        ctx.strokeStyle = inFocus ? "rgba(255,255,255,0.22)" : "rgba(255,255,255,0.05)";
        ctx.lineWidth = inFocus ? 1.5 : 0.5;
      }

      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
    },
    [focusedBucket]
  );

  /* ── Interactions ───────────────────────────────────────────── */
  const onNodeClick = useCallback((node: object) => {
    const n = node as SimNode;
    if (n.type === "bucket") {
      const toggling = focusedBucket === n.label;
      // Store position NOW — guaranteed valid at click time
      focusedBucketPos.current = toggling ? null : { x: n.x ?? 0, y: n.y ?? 0 };
      setFocusedBucket(toggling ? null : n.label);
      setSelectedEntry(null);
    } else {
      setSelectedEntry((prev) => (prev?.id === n.id ? null : n));
      focusedBucketPos.current = null;
      setFocusedBucket(null);
    }
  }, [focusedBucket]);

  const onNodeHover = useCallback((node: object | null) => {
    setHovered(node ? (node as SimNode) : null);
    if (typeof document !== "undefined")
      document.body.style.cursor = node ? "pointer" : "default";
  }, []);

  const onBgClick = useCallback(() => {
    focusedBucketPos.current = null;
    setFocusedBucket(null);
    setSelectedEntry(null);
  }, []);

  const bucketEntries = focusedBucket
    ? (data.nodes.filter((n) => n.type === "entry" && n.bucket === focusedBucket) as SimNode[])
    : [];

  const sharedCount = data.links.filter((l) => l.type === "shared-concept").length;
  const crossCount = data.links.filter((l) => l.type === "cross-topic").length;

  return (
    <div className="relative w-full h-full flex overflow-hidden rounded-xl border border-border">
      {/* Canvas */}
      <div ref={containerRef} className="flex-1 min-w-0">
        <ForceGraph2D
          ref={fgRef}
          graphData={data as never}
          width={dimensions.width}
          height={dimensions.height}
          backgroundColor="#0a0a0a"
          nodeLabel=""
          nodeCanvasObject={paintNode}
          nodeCanvasObjectMode={() => "replace"}
          linkCanvasObject={paintLink}
          linkCanvasObjectMode={() => "replace"}
          onNodeClick={onNodeClick}
          onNodeHover={onNodeHover}
          onBackgroundClick={onBgClick}
          cooldownTicks={200}
          enableZoomInteraction
          enablePanInteraction
          linkDirectionalParticles={(link) =>
            (link as GraphLink).type === "cross-topic" ? 2 : 0
          }
          linkDirectionalParticleWidth={2}
          linkDirectionalParticleColor={() => "rgba(124,106,247,0.8)"}
        />
      </div>

      {/* Legend */}
      <div className="absolute top-4 left-4 flex flex-col gap-1.5 text-xs bg-[#0f0f0f]/90 backdrop-blur rounded-xl px-3 py-3 border border-border pointer-events-none">
        <p className="text-muted uppercase tracking-widest text-[10px] font-medium mb-0.5">Buckets</p>
        {data.nodes
          .filter((n) => n.type === "bucket")
          .map((n) => (
            <div key={n.id} className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: bucketColor(n.label) }} />
              <span className={focusedBucket === n.label ? "text-white font-medium" : "text-muted"}>{n.label}</span>
            </div>
          ))}
        <div className="border-t border-border my-0.5" />
        <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-[#60a5fa]" /><span className="text-muted">Learn</span></div>
        <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-[#a78bfa]" /><span className="text-muted">Think</span></div>
        <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-[#fbbf24]" /><span className="text-muted">Reflect</span></div>
        {(crossCount > 0 || sharedCount > 0) && (
          <>
            <div className="border-t border-border my-0.5" />
            {crossCount > 0 && <div className="flex items-center gap-1.5"><span className="w-3.5 border-t-2 border-[#7c6af7]" /><span className="text-muted">Cross ({crossCount})</span></div>}
            {sharedCount > 0 && <div className="flex items-center gap-1.5"><span className="w-3.5 border-t border-dashed border-[#60a5fa]" /><span className="text-muted">Shared ({sharedCount})</span></div>}
          </>
        )}
      </div>

      {/* Hint */}
      {!panelOpen && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-xs text-muted bg-[#0f0f0f]/80 px-3 py-1.5 rounded-full border border-border pointer-events-none whitespace-nowrap">
          Click a bucket to expand its entries · Click an entry for details · Click background to reset
        </div>
      )}

      {/* Panels */}
      {focusedBucket && (
        <BucketPanel
          bucketName={focusedBucket}
          bucketColor={bucketColor(focusedBucket)}
          entries={bucketEntries}
          onClose={() => setFocusedBucket(null)}
          onSelectEntry={(n) => { setSelectedEntry(n); setFocusedBucket(null); }}
        />
      )}
      {selectedEntry && (
        <EntryPanel node={selectedEntry} onClose={() => setSelectedEntry(null)} />
      )}
    </div>
  );
}
