"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { GraphData, GraphNode } from "@/lib/graph";
import styles from "./graphView.module.css";

const MODE_COLOR: Record<string, string> = { learn: "#2563eb", think: "#7c3aed", reflect: "#a3690a" };
const MODE_LABEL: Record<string, string> = { learn: "Learn", think: "Think", reflect: "Reflect" };
const BUCKET_COLORS = [
  "#7c6af7", "#e879f9", "#34d399", "#f97316", "#06b6d4", "#f43f5e", "#84cc16", "#eab308",
];

const CAM_DUR = 550;
const MAX_LEASH = 130;
const CHASE_EASE = 0.18;

type EngineBucket = { name: string; count: number; color: string; bx: number; by: number; moved: boolean };
type EngineEntry = {
  id: string;
  mode: string;
  bucket: string;
  title: string;
  summary?: string;
  keyPoints: string[];
  score: number;
  tx: number;
  ty: number;
  transStart: number;
  transFrom: { x: number; y: number };
  targetVisible: number;
  transVisFrom: number;
  _sx: number;
  _sy: number;
};

function hexA(hex: string, a: number) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}
function easeOutCubic(t: number) {
  return 1 - Math.pow(1 - t, 3);
}
function modeChipClass(mode: string | undefined) {
  const m = mode ?? "learn";
  return `${styles.mchip} ${(styles as Record<string, string>)[m] ?? ""}`;
}

export default function GraphView({ data }: { data: GraphData }) {
  const router = useRouter();
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [focusedBucket, setFocusedBucket] = useState<string | null>(null);
  const [selectedEntry, setSelectedEntry] = useState<GraphNode | null>(null);
  const apiRef = useRef<{
    openBucketPanel: (name: string | null) => void;
    openEntryById: (id: string) => void;
    closeAll: () => void;
  } | null>(null);

  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;
    const ctx2d = canvas.getContext("2d");
    if (!ctx2d) return;
    const ctx: CanvasRenderingContext2D = ctx2d;

    let W = wrap.clientWidth;
    let H = wrap.clientHeight;
    const DPR = Math.min(window.devicePixelRatio || 1, 2);

    const bucketNodes: EngineBucket[] = data.nodes
      .filter((n) => n.type === "bucket")
      .map((n, i) => ({
        name: n.label,
        count: n.count ?? 0,
        color: BUCKET_COLORS[i % BUCKET_COLORS.length],
        bx: 0,
        by: 0,
        moved: false,
      }));

    const entryNodes: EngineEntry[] = data.nodes
      .filter((n) => n.type === "entry")
      .map((n) => ({
        id: n.id,
        mode: n.mode ?? "learn",
        bucket: n.bucket ?? "",
        title: n.label,
        summary: n.summary,
        keyPoints: n.keyPoints ?? [],
        score: n.score ?? 0,
        tx: 0,
        ty: 0,
        transStart: 0,
        transFrom: { x: 0, y: 0 },
        targetVisible: 0,
        transVisFrom: 0,
        _sx: 0,
        _sy: 0,
      }));

    let focusedBucketName: string | null = null;
    let selected: EngineEntry | null = null;
    let hovered: { type: "bucket" | "entry"; name?: string; id?: string } | null = null;

    const pointer = {
      downX: 0,
      downY: 0,
      moved: false,
      dragNode: null as null | { type: "bucket" | "entry"; node: EngineBucket | EngineEntry },
    };
    const now = () => performance.now();

    function resize() {
      W = wrap!.clientWidth;
      H = wrap!.clientHeight;
      canvas!.width = W * DPR;
      canvas!.height = H * DPR;
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    }

    function layoutBuckets() {
      const cx = W / 2;
      const cy = H / 2;
      const R = Math.min(W, H) * 0.33;
      bucketNodes.forEach((b, i) => {
        if (b.moved) return;
        const a = (i / Math.max(bucketNodes.length, 1)) * 2 * Math.PI - Math.PI / 2;
        b.bx = cx + R * Math.cos(a);
        b.by = cy + R * Math.sin(a);
      });
    }

    const camera = { scale: 1, ox: 0, oy: 0 };
    let camFrom = { ...camera };
    let camTo = { ...camera };
    let camStart = now();
    function setCamera(target: { scale: number; ox: number; oy: number }) {
      camFrom = currentCamera();
      camTo = target;
      camStart = now();
    }
    function currentCamera() {
      const t = Math.min(1, (now() - camStart) / CAM_DUR);
      const e = easeOutCubic(t);
      return {
        scale: camFrom.scale + (camTo.scale - camFrom.scale) * e,
        ox: camFrom.ox + (camTo.ox - camFrom.ox) * e,
        oy: camFrom.oy + (camTo.oy - camFrom.oy) * e,
      };
    }
    function fitDefault() {
      setCamera({ scale: 1, ox: 0, oy: 0 });
    }
    function fitTo(points: { x: number; y: number }[]) {
      const pad = 70;
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;
      points.forEach((p) => {
        minX = Math.min(minX, p.x);
        maxX = Math.max(maxX, p.x);
        minY = Math.min(minY, p.y);
        maxY = Math.max(maxY, p.y);
      });
      const bw = Math.max(maxX - minX, 40) + pad * 2;
      const bh = Math.max(maxY - minY, 40) + pad * 2;
      const scale = Math.min(Math.min(W / bw, H / bh), 1.8);
      const bcx = (minX + maxX) / 2;
      const bcy = (minY + maxY) / 2;
      setCamera({ scale, ox: W / 2 - bcx * scale, oy: H / 2 - bcy * scale });
    }
    function screenFor(x: number, y: number) {
      const c = currentCamera();
      return { x: x * c.scale + c.ox, y: y * c.scale + c.oy };
    }
    function screenToWorld(x: number, y: number) {
      const c = currentCamera();
      return { x: (x - c.ox) / c.scale, y: (y - c.oy) / c.scale };
    }

    function entryTargets(bucket: EngineBucket) {
      const fe = entryNodes.filter((e) => e.bucket === bucket.name);
      const INNER_LIMIT = 12;
      const inner = fe.slice(0, INNER_LIMIT);
      const outer = fe.slice(INNER_LIMIT);
      const r1 = Math.max(92, inner.length * 11);
      const out: { e: EngineEntry; x: number; y: number }[] = [];
      inner.forEach((e, i) => {
        const a = (i / Math.max(inner.length, 1)) * 2 * Math.PI - Math.PI / 2;
        out.push({ e, x: bucket.bx + r1 * Math.cos(a), y: bucket.by + r1 * Math.sin(a) });
      });
      if (outer.length) {
        const r2 = r1 * 1.55;
        outer.forEach((e, i) => {
          const a = (i / outer.length) * 2 * Math.PI - Math.PI / 2;
          out.push({ e, x: bucket.bx + r2 * Math.cos(a), y: bucket.by + r2 * Math.sin(a) });
        });
      }
      return out;
    }

    function displayPos(e: EngineEntry) {
      const t = Math.min(1, (now() - e.transStart) / CAM_DUR);
      const ee = easeOutCubic(t);
      return { x: e.transFrom.x + (e.tx - e.transFrom.x) * ee, y: e.transFrom.y + (e.ty - e.transFrom.y) * ee };
    }
    function displayVis(e: EngineEntry) {
      const t = Math.min(1, (now() - e.transStart) / CAM_DUR);
      const ee = easeOutCubic(t);
      return e.transVisFrom + (e.targetVisible - e.transVisFrom) * ee;
    }

    function applyFocus(name: string | null) {
      focusedBucketName = name;
      selected = null;
      const t = now();
      entryNodes.forEach((e) => {
        const disp = displayPos(e);
        e.transFrom = disp;
        e.transStart = t;
        e.transVisFrom = displayVis(e);
      });
      if (name) {
        const b = bucketNodes.find((bb) => bb.name === name);
        if (!b) return;
        const targets = entryTargets(b);
        entryNodes.forEach((e) => {
          const tgt = targets.find((tt) => tt.e.id === e.id);
          if (tgt) {
            e.tx = tgt.x;
            e.ty = tgt.y;
            e.targetVisible = 1;
          } else {
            e.tx = b.bx;
            e.ty = b.by;
            e.targetVisible = 0;
          }
        });
        fitTo([{ x: b.bx, y: b.by }, ...targets.map((tt) => ({ x: tt.x, y: tt.y }))]);
      } else {
        entryNodes.forEach((e) => {
          const b = bucketNodes.find((bb) => bb.name === e.bucket);
          e.tx = b ? b.bx : W / 2;
          e.ty = b ? b.by : H / 2;
          e.targetVisible = 0;
        });
        fitDefault();
      }
    }

    function updateChase() {
      if (!focusedBucketName) return;
      const b = bucketNodes.find((bb) => bb.name === focusedBucketName);
      if (!b) return;
      entryNodes.forEach((e) => {
        if (e.bucket !== focusedBucketName) return;
        if (pointer.dragNode && pointer.dragNode.type === "entry" && pointer.dragNode.node === e) return;
        const t = Math.min(1, (now() - e.transStart) / CAM_DUR);
        if (t < 1) return;
        const dx = e.tx - b.bx;
        const dy = e.ty - b.by;
        const dist = Math.hypot(dx, dy);
        if (dist > MAX_LEASH) {
          const pull = (dist - MAX_LEASH) / dist;
          e.tx -= dx * pull * CHASE_EASE;
          e.ty -= dy * pull * CHASE_EASE;
        }
      });
    }

    function draw() {
      updateChase();
      ctx.clearRect(0, 0, W, H);
      const cam = currentCamera();
      ctx.save();
      ctx.translate(cam.ox, cam.oy);
      ctx.scale(cam.scale, cam.scale);

      if (focusedBucketName) {
        const b = bucketNodes.find((bb) => bb.name === focusedBucketName);
        if (b) {
          entryNodes
            .filter((e) => e.bucket === focusedBucketName)
            .forEach((e) => {
              const p = displayPos(e);
              const vis = displayVis(e);
              ctx.globalAlpha = 0.22 * vis;
              ctx.beginPath();
              ctx.moveTo(b.bx, b.by);
              ctx.lineTo(p.x, p.y);
              ctx.strokeStyle = "rgba(28,28,32,0.4)";
              ctx.lineWidth = 1;
              ctx.stroke();
            });
          ctx.globalAlpha = 1;
        }
      }

      bucketNodes.forEach((b) => {
        const x = b.bx;
        const y = b.by;
        const dim = focusedBucketName !== null && focusedBucketName !== b.name;
        const isFocused = focusedBucketName === b.name;
        const isHover = hovered?.type === "bucket" && hovered.name === b.name;
        const r = Math.min(Math.max(Math.sqrt(b.count) * 3.2 + 9, 13), 21);
        ctx.globalAlpha = dim ? 0.18 : 1;
        if (isFocused || isHover) {
          ctx.shadowColor = b.color;
          ctx.shadowBlur = isFocused ? 26 : 16;
        }
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fillStyle = b.color;
        ctx.fill();
        ctx.shadowBlur = 0;
        if (isFocused) {
          ctx.beginPath();
          ctx.arc(x, y, r + 4, 0, Math.PI * 2);
          ctx.strokeStyle = b.color;
          ctx.lineWidth = 1.5;
          ctx.setLineDash([4, 3]);
          ctx.stroke();
          ctx.setLineDash([]);
        }
        ctx.fillStyle = "#fff";
        ctx.font = `italic 500 ${r * 0.62}px Newsreader, serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(b.name[0] ?? "?", x, y + 1);
        if (!dim) {
          ctx.font = "600 11px Inter, sans-serif";
          ctx.textBaseline = "alphabetic";
          const label = b.name;
          const tw = ctx.measureText(label).width;
          ctx.fillStyle = "rgba(250,248,242,0.88)";
          ctx.fillRect(x - tw / 2 - 4, y + r + 7, tw + 8, 16);
          ctx.fillStyle = "#3a352c";
          ctx.fillText(label, x, y + r + 19);
        }
      });
      ctx.globalAlpha = 1;

      entryNodes.forEach((e) => {
        const p = displayPos(e);
        const vis = displayVis(e);
        if (vis < 0.02) return;
        const x = p.x;
        const y = p.y;
        const isSel = selected?.id === e.id;
        const isHover = hovered?.type === "entry" && hovered.id === e.id;
        const r = isSel || isHover ? 8 : 6;
        ctx.globalAlpha = vis;
        const color = MODE_COLOR[e.mode] ?? "#888";
        if (isSel || isHover) {
          ctx.shadowColor = color;
          ctx.shadowBlur = 14;
        }
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
        ctx.shadowBlur = 0;
        if (isSel) {
          ctx.beginPath();
          ctx.arc(x, y, r + 3.5, 0, Math.PI * 2);
          ctx.strokeStyle = color;
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }
        e._sx = x;
        e._sy = y;
      });
      ctx.globalAlpha = 1;
      ctx.restore();
    }

    function hitTest(sx: number, sy: number) {
      for (const e of entryNodes) {
        const vis = displayVis(e);
        if (vis < 0.5) continue;
        const w = screenFor(e._sx, e._sy);
        if (Math.hypot(sx - w.x, sy - w.y) < 14) return { type: "entry" as const, node: e };
      }
      for (const b of bucketNodes) {
        const w = screenFor(b.bx, b.by);
        const r = Math.min(Math.max(Math.sqrt(b.count) * 3.2 + 9, 13), 21);
        if (Math.hypot(sx - w.x, sy - w.y) < r + 6) return { type: "bucket" as const, node: b };
      }
      return null;
    }

    function toDisplayEntry(e: EngineEntry): GraphNode {
      return {
        id: e.id,
        label: e.title,
        type: "entry",
        mode: e.mode,
        bucket: e.bucket,
        summary: e.summary,
        keyPoints: e.keyPoints,
        score: e.score,
      };
    }

    function openBucketPanel(name: string | null) {
      applyFocus(name);
      setFocusedBucket(name);
      setSelectedEntry(null);
    }
    function openEntryPanel(e: EngineEntry) {
      selected = e;
      applyFocus(null);
      setFocusedBucket(null);
      setSelectedEntry(toDisplayEntry(e));
    }
    function openEntryById(id: string) {
      const e = entryNodes.find((en) => en.id === id);
      if (e) openEntryPanel(e);
    }
    function closeAll() {
      selected = null;
      applyFocus(null);
      setFocusedBucket(null);
      setSelectedEntry(null);
    }
    apiRef.current = { openBucketPanel, openEntryById, closeAll };

    function onMouseDown(ev: MouseEvent) {
      const rect = canvas!.getBoundingClientRect();
      const sx = ev.clientX - rect.left;
      const sy = ev.clientY - rect.top;
      pointer.downX = sx;
      pointer.downY = sy;
      pointer.moved = false;
      pointer.dragNode = hitTest(sx, sy);
    }
    function onMouseMove(ev: MouseEvent) {
      const rect = canvas!.getBoundingClientRect();
      const sx = ev.clientX - rect.left;
      const sy = ev.clientY - rect.top;
      if (pointer.dragNode) {
        if (Math.hypot(sx - pointer.downX, sy - pointer.downY) > 4) pointer.moved = true;
        if (pointer.moved) {
          const w = screenToWorld(sx, sy);
          if (pointer.dragNode.type === "bucket") {
            const b = pointer.dragNode.node as EngineBucket;
            b.bx = w.x;
            b.by = w.y;
            b.moved = true;
          } else {
            const e = pointer.dragNode.node as EngineEntry;
            e.tx = w.x;
            e.ty = w.y;
            e.transFrom = { x: w.x, y: w.y };
            e.transStart = now() - CAM_DUR;
            e.targetVisible = 1;
            e.transVisFrom = 1;
          }
          canvas!.style.cursor = "grabbing";
          return;
        }
      }
      const hit = hitTest(sx, sy);
      hovered = hit
        ? hit.type === "bucket"
          ? { type: "bucket", name: (hit.node as EngineBucket).name }
          : { type: "entry", id: (hit.node as EngineEntry).id }
        : null;
      canvas!.style.cursor = hit ? "grab" : "default";
    }
    function onMouseUp(ev: MouseEvent) {
      const wasDrag = pointer.moved;
      const dragged = pointer.dragNode;
      pointer.dragNode = null;
      if (wasDrag) {
        canvas!.style.cursor = "grab";
        return;
      }
      const rect = canvas!.getBoundingClientRect();
      const hit = dragged || hitTest(ev.clientX - rect.left, ev.clientY - rect.top);
      if (!hit) {
        closeAll();
        return;
      }
      if (hit.type === "bucket") {
        const name = (hit.node as EngineBucket).name;
        openBucketPanel(name === focusedBucketName ? null : name);
      } else {
        openEntryPanel(hit.node as EngineEntry);
      }
    }

    canvas.addEventListener("mousedown", onMouseDown);
    canvas.addEventListener("mousemove", onMouseMove);
    canvas.addEventListener("mouseup", onMouseUp);

    const ro = new ResizeObserver(() => {
      resize();
      layoutBuckets();
    });
    ro.observe(wrap);

    layoutBuckets();
    resize();
    layoutBuckets();
    entryNodes.forEach((e) => {
      const b = bucketNodes.find((bb) => bb.name === e.bucket);
      e.tx = b ? b.bx : W / 2;
      e.ty = b ? b.by : H / 2;
      e.transFrom = { x: e.tx, y: e.ty };
      e.targetVisible = 0;
      e.transVisFrom = 0;
      e._sx = e.tx;
      e._sy = e.ty;
    });

    let raf = 0;
    function loop() {
      draw();
      raf = requestAnimationFrame(loop);
    }
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      canvas.removeEventListener("mousedown", onMouseDown);
      canvas.removeEventListener("mousemove", onMouseMove);
      canvas.removeEventListener("mouseup", onMouseUp);
      apiRef.current = null;
    };
  }, [data]);

  const bucketList = data.nodes.filter((n) => n.type === "bucket");
  const bucketColorOf = (name: string) => {
    const i = bucketList.findIndex((b) => b.label === name);
    return BUCKET_COLORS[i % BUCKET_COLORS.length];
  };
  const bucketEntries = focusedBucket
    ? data.nodes.filter((n) => n.type === "entry" && n.bucket === focusedBucket)
    : [];
  const modeCounts = bucketEntries.reduce<Record<string, number>>((acc, e) => {
    const m = e.mode ?? "learn";
    acc[m] = (acc[m] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div ref={wrapRef} className={styles.canvasWrap}>
      <canvas ref={canvasRef} className={styles.canvas} />

      <div className={styles.legend}>
        <p className={styles.lt}>Buckets</p>
        {bucketList.map((b) => (
          <div key={b.id} className={`${styles.lr} ${focusedBucket === b.label ? styles.lrAct : ""}`}>
            <i style={{ background: bucketColorOf(b.label) }} />
            {b.label}
          </div>
        ))}
        <div className={styles.ldiv} />
        <div className={styles.lr}>
          <i style={{ background: MODE_COLOR.learn }} />
          Learn
        </div>
        <div className={styles.lr}>
          <i style={{ background: MODE_COLOR.think }} />
          Think
        </div>
        <div className={styles.lr}>
          <i style={{ background: MODE_COLOR.reflect }} />
          Reflect
        </div>
      </div>

      {!focusedBucket && !selectedEntry && (
        <div className={styles.hint}>
          Click a bucket to expand its entries · Click an entry for details · Click background to reset
        </div>
      )}

      <div className={styles.legendstrip}>
        {bucketList.map((b) => (
          <div
            key={b.id}
            className={`${styles.lchip} ${focusedBucket === b.label ? styles.lchipAct : ""}`}
            onClick={() => apiRef.current?.openBucketPanel(focusedBucket === b.label ? null : b.label)}
          >
            <i style={{ background: bucketColorOf(b.label) }} />
            {b.label}
          </div>
        ))}
      </div>

      <div className={`${styles.panel} ${focusedBucket ? styles.panelOpen : ""}`}>
        {focusedBucket && (
          <>
            <div className={styles.phead}>
              <div className={styles.pheadTop}>
                <div style={{ display: "flex", gap: 9 }}>
                  <span className={styles.pdot} style={{ background: bucketColorOf(focusedBucket) }} />
                  <div>
                    <p className={styles.pl}>Bucket</p>
                    <h2>{focusedBucket}</h2>
                  </div>
                </div>
                <button className={styles.pclose} onClick={() => apiRef.current?.closeAll()}>
                  ×
                </button>
              </div>
              <div className={styles.modechips}>
                {Object.entries(modeCounts).map(([m, c]) => (
                  <span key={m} className={modeChipClass(m)}>
                    {MODE_LABEL[m] ?? m} · {c}
                  </span>
                ))}
              </div>
              <p className={styles.pcount}>
                {bucketEntries.length}
                <span className={styles.pcountSpan}>entries</span>
              </p>
            </div>
            <div className={styles.plist}>
              {bucketEntries.length ? (
                bucketEntries.map((e) => (
                  <button key={e.id} className={styles.prow} onClick={() => apiRef.current?.openEntryById(e.id)}>
                    <p className={styles.rtitle}>{e.label}</p>
                    {e.summary && <p className={styles.rsum}>{e.summary}</p>}
                  </button>
                ))
              ) : (
                <div className={styles.pempty}>No entries captured here yet.</div>
              )}
            </div>
            <div className={styles.pfoot}>
              <button
                style={{
                  background: hexA(bucketColorOf(focusedBucket), 0.13),
                  border: `1px solid ${hexA(bucketColorOf(focusedBucket), 0.35)}`,
                  color: bucketColorOf(focusedBucket),
                }}
                onClick={() => router.push(`/entries?bucket=${encodeURIComponent(focusedBucket)}`)}
              >
                Open {focusedBucket} feed →
              </button>
            </div>
          </>
        )}
      </div>

      <div className={`${styles.panel} ${selectedEntry ? styles.panelOpen : ""}`}>
        {selectedEntry && (
          <>
            <div className={styles.phead} style={{ borderBottom: "none", paddingBottom: 0 }}>
              <div className={styles.pheadTop}>
                <span className={modeChipClass(selectedEntry.mode)}>
                  {MODE_LABEL[selectedEntry.mode ?? "learn"] ?? selectedEntry.mode}
                </span>
                <button className={styles.pclose} onClick={() => apiRef.current?.closeAll()}>
                  ×
                </button>
              </div>
              <h2 style={{ marginTop: 2 }}>{selectedEntry.label}</h2>
            </div>
            <div className={styles.ebody}>
              <div>
                <p className={styles.pl}>Bucket</p>
                <span className={styles.tagpill}>{selectedEntry.bucket}</span>
              </div>
              {selectedEntry.summary && (
                <div>
                  <p className={styles.pl}>Summary</p>
                  <p style={{ fontSize: 12, color: "#5b564a", lineHeight: 1.6, margin: "4px 0 0" }}>
                    {selectedEntry.summary}
                  </p>
                </div>
              )}
              {selectedEntry.keyPoints && selectedEntry.keyPoints.length > 0 && (
                <div>
                  <p className={styles.pl}>Key Points</p>
                  <div style={{ marginTop: 6 }}>
                    {selectedEntry.keyPoints.map((k, i) => (
                      <div key={i} className={styles.kp}>
                        <span className={styles.kpMark}>·</span>
                        <span>{k}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {selectedEntry.score != null && (
                <div>
                  <p className={styles.pl}>Actionability</p>
                  <div className={styles.dots} style={{ marginTop: 6 }}>
                    {Array.from({ length: 5 }).map((_, i) => (
                      <i
                        key={i}
                        style={{
                          background: i < Math.round((selectedEntry.score ?? 0) * 5) ? "#2f6fed" : "#e2dbc7",
                        }}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className={styles.pfoot}>
              <button
                style={{ background: "#f0ece0", color: "#5b564a" }}
                onClick={() => router.push(`/entries?bucket=${encodeURIComponent(selectedEntry.bucket ?? "")}`)}
              >
                Go to {selectedEntry.bucket} bucket →
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
