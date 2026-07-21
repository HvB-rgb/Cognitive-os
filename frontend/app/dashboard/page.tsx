import { Fragment } from "react";
import { redirect } from "next/navigation";
import { getEntries } from "@/lib/supabase";
import {
  getWeeklyScore,
  getSpacedRepetitionEntries,
  getLatestDailyPattern,
  getWeekActivity,
} from "@/lib/analyser";
import { getSessionUserId } from "@/lib/session";
import Greeting from "@/components/Greeting";
import RangeFilter from "@/components/RangeFilter";
import HamburgerLogout from "@/components/HamburgerLogout";
import styles from "./dashboard.module.css";

export const dynamic = "force-dynamic";

const DAY_LABELS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

const RANGE_DAYS: Record<string, number> = { today: 1, week: 7, month: 30, all: 3650 };
const RANGE_LABEL: Record<string, string> = {
  today: "today",
  week: "this week",
  month: "this month",
  all: "all time",
};

/** cognitive_entries.created_at -> 0=Mon..6=Sun (JS Date.getDay() is 0=Sun) */
function dayIndex(dateStr: string): number {
  return (new Date(dateStr).getDay() + 6) % 7;
}

function heatColor(count: number): string {
  if (count === 0) return "#eef3fe";
  if (count === 1) return "#bcd4fb";
  if (count <= 3) return "#5f92f4";
  return "#1c4ed8";
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const userId = await getSessionUserId();
  if (!userId) redirect("/login");

  const { range: rangeParam } = await searchParams;
  const range = rangeParam && RANGE_DAYS[rangeParam] ? rangeParam : "week";
  const rangeDays = RANGE_DAYS[range];

  let error: string | null = null;
  let entries: Awaited<ReturnType<typeof getEntries>> = [];
  let score: Awaited<ReturnType<typeof getWeeklyScore>> | null = null;
  let dueEntries: Awaited<ReturnType<typeof getSpacedRepetitionEntries>> = [];
  let pattern: Awaited<ReturnType<typeof getLatestDailyPattern>> = null;
  let weekActivity: Awaited<ReturnType<typeof getWeekActivity>> = [];

  try {
    [entries, score, dueEntries, pattern, weekActivity] = await Promise.all([
      getEntries(userId),
      getWeeklyScore(userId),
      getSpacedRepetitionEntries(userId),
      getLatestDailyPattern(userId),
      getWeekActivity(userId, rangeDays),
    ]);
  } catch (e) {
    error = e instanceof Error ? e.message : "Failed to load dashboard data";
  }

  const totalEntries = entries.length;
  // Entries within the selected range drive the Recent Entries count + list.
  const rangeCutoff = new Date();
  rangeCutoff.setDate(rangeCutoff.getDate() - rangeDays);
  const rangeEntries = entries.filter((e) => new Date(e.created_at) >= rangeCutoff);
  const rangeCount = rangeEntries.length;
  const recentEntries = rangeEntries.slice(0, 4);

  // Active buckets this week — real counts from getWeekActivity(), not the
  // all-time bucket.entry_count used elsewhere in the app.
  const weekBucketCounts = new Map<string, number>();
  for (const e of weekActivity) {
    if (!e.bucket) continue;
    weekBucketCounts.set(e.bucket, (weekBucketCounts.get(e.bucket) ?? 0) + 1);
  }
  const topWeekBuckets = Array.from(weekBucketCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4);

  // Capture activity heatmap: same top-this-week buckets, per weekday count.
  const heatCounts = new Map<string, number[]>();
  for (const [bucket] of topWeekBuckets) heatCounts.set(bucket, [0, 0, 0, 0, 0, 0, 0]);
  for (const e of weekActivity) {
    const row = heatCounts.get(e.bucket);
    if (!row) continue;
    row[dayIndex(e.created_at)]++;
  }

  // Actionability dot-chart: avg actionability_score per weekday (roughly
  // 0.1-0.9 per ai_engine.py's scale) mapped onto 6 dots.
  const dayScores: number[][] = [[], [], [], [], [], [], []];
  for (const e of weekActivity) {
    dayScores[dayIndex(e.created_at)].push(e.actionability_score ?? 0);
  }
  const dayLitCounts = dayScores.map((scores) => {
    if (!scores.length) return 0;
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
    return Math.max(0, Math.min(6, Math.round(avg * 6)));
  });

  const byInterval: Record<number, number> = { 7: 0, 14: 0, 30: 0 };
  for (const e of dueEntries) byInterval[e.intervalDays] = (byInterval[e.intervalDays] ?? 0) + 1;

  const contradictionCount = (pattern?.contradiction_data as unknown[] | null)?.length ?? 0;

  // getWeeklyScore()'s breadth/depth/consistency/reflection are each capped
  // at 25 (they sum to the /100 total) — scaled by 4 here so each row reads
  // as its own /100, matching this design's per-dimension score bars.
  const scoreDims = score
    ? [
        { name: "Consistency", value: Math.round(score.consistency * 4) },
        { name: "Breadth", value: Math.round(score.breadth * 4) },
        { name: "Depth", value: Math.round(score.depth * 4) },
        { name: "Reflection", value: Math.round(score.reflection * 4) },
      ]
    : [];

  return (
    <div className={styles.page}>
    <div className={styles.topbar}>
      <img className={styles.logo} src="/logo.png" alt="" />
      <span className={styles.word}>Cognitive OS</span>
      <div className={styles.navbtns}>
        <a href="/capture">Capture</a>
        <a className={styles.active}>Dashboard</a>
        <a href="/graph">Graph</a>
        <a href="/review">Review</a>
        <HamburgerLogout className={styles.hamb} />
      </div>
    </div>
    <div className={styles.wrap}>
      {error ? (
        <div className={styles.errbox}>{error}</div>
      ) : (
        <>
          <div className={styles.hrow}>
            <div>
              <h1 className={styles.h1}>Your Knowledge Overview</h1>
              <p className={styles.sub}>
                <Greeting />
                You have {dueEntries.length} {dueEntries.length === 1 ? "entry" : "entries"} due for
                review.
              </p>
            </div>
            <div className={styles.chips}>
              <div className={styles.chip}>
                <b>{dueEntries.length}</b>Due for review
              </div>
              <div className={styles.chip}>
                <b>{contradictionCount}</b>Contradictions
              </div>
              <RangeFilter value={range} className={`${styles.chip} ${styles.today} ${styles.rangeSelect}`} />
            </div>
          </div>

          <div className={styles.grid}>
            <div className={`${styles.cell} ${styles.dark}`}>
              <div className={styles.lbl}>Quick Access</div>
              <div className={styles.linklist}>
                <a href="/capture">
                  <b>[+]</b>New capture
                </a>
                <a href="/entries">
                  <b>[↗]</b>All entries
                </a>
                <a href="/graph">
                  <b>[↗]</b>Knowledge graph
                </a>
                <a href="/digest">
                  <b>[↗]</b>Weekly digest
                </a>
                <a href="/connect">
                  <b>[↗]</b>Save from iPhone
                </a>
              </div>
            </div>

            <div className={styles.cell} id="recent">
              <div className={styles.lbl}>
                Recent Entries<span>{totalEntries} total</span>
              </div>
              <div className={styles.bignum}>{String(Math.min(rangeCount, 99)).padStart(2, "0")}</div>
              <div className={styles.rows}>
                {recentEntries.length === 0 && (
                  <p className={styles.empty}>No entries {RANGE_LABEL[range]}.</p>
                )}
                {recentEntries.map((e) => (
                  <a key={e.id} href={`/entries/${e.id}`}>
                    {e.title}
                    <span className={styles.vw}>view ↗</span>
                  </a>
                ))}
              </div>
            </div>

            <div className={styles.cell}>
              <div className={styles.lbl}>
                Active Buckets<span>{RANGE_LABEL[range]}</span>
              </div>
              <div className={styles.bignum}>{String(weekBucketCounts.size).padStart(2, "0")}</div>
              <div className={`${styles.rows} ${styles.buckets}`}>
                {topWeekBuckets.length === 0 && (
                  <p className={styles.empty}>No activity {RANGE_LABEL[range]}.</p>
                )}
                {topWeekBuckets.map(([name, count]) => (
                  <a key={name} href={`/entries?bucket=${encodeURIComponent(name)}`}>
                    {name}
                    <span className={styles.ct}>{count}</span>
                  </a>
                ))}
              </div>
            </div>

            <div className={styles.cell}>
              <div className={styles.lbl}>
                Actionability<span>weekly avg</span>
              </div>
              <div className={styles.dotchart}>
                {dayLitCounts.map((lit, i) => (
                  <div className={styles.dotcol} key={i}>
                    {Array.from({ length: 6 }).map((_, j) => (
                      <i key={j} className={j < lit ? "" : styles.dim} />
                    ))}
                  </div>
                ))}
              </div>
              <div className={styles.daylbl}>
                {DAY_LABELS.map((d) => (
                  <span key={d}>{d}</span>
                ))}
              </div>
            </div>
          </div>

          <div className={styles.grid2}>
            <div className={styles.cell}>
              <div className={styles.lbl}>Review Queue</div>
              <div className={styles.tiles}>
                <div className={`${styles.tile} ${byInterval[7] > 0 ? styles.hot : ""}`}>
                  <b>{byInterval[7]}</b>
                  <span>7 days</span>
                </div>
                <div className={styles.tile}>
                  <b>{byInterval[14]}</b>
                  <span>14 days</span>
                </div>
                <div className={styles.tile}>
                  <b>{byInterval[30]}</b>
                  <span>30 days</span>
                </div>
                <div className={styles.tile}>
                  <b>{dueEntries.length}</b>
                  <span>total due</span>
                </div>
              </div>
            </div>

            <div className={styles.cell}>
              <div className={styles.lbl}>
                Capture Activity<span>Mon – Sun</span>
              </div>
              <div className={styles.legend}>
                <span>
                  <i style={{ background: "#eef3fe" }} />
                  None
                </span>
                <span>
                  <i style={{ background: "#bcd4fb" }} />
                  Light
                </span>
                <span>
                  <i style={{ background: "#5f92f4" }} />
                  Active
                </span>
                <span>
                  <i style={{ background: "#1c4ed8" }} />
                  Heavy
                </span>
              </div>
              {topWeekBuckets.length === 0 ? (
                <p className={styles.empty}>No activity {RANGE_LABEL[range]}.</p>
              ) : (
                <div className={styles.heat}>
                  {topWeekBuckets.map(([name]) => (
                    <Fragment key={name}>
                      <div className={styles.rlabel}>{name}</div>
                      {heatCounts.get(name)!.map((c, i) => (
                        <div key={i} className={styles.hcell} style={{ background: heatColor(c) }} />
                      ))}
                    </Fragment>
                  ))}
                  <div />
                  {DAY_LABELS.map((d) => (
                    <div key={d} className={styles.dlabel}>
                      {d}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className={styles.cell}>
              <div className={styles.lbl}>
                Weekly Score<span>/ 100</span>
              </div>
              {scoreDims.map((dim) => (
                <div
                  key={dim.name}
                  className={`${styles.scorebar} ${dim.value < 50 ? styles.warn : ""}`}
                >
                  <span className={styles.sn}>
                    {dim.name}
                    {dim.value < 50 && (
                      <>
                        <br />
                        <span className={styles.tag}>Needs attention</span>
                      </>
                    )}
                  </span>
                  <span className={styles.sv}>{dim.value}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
    </div>
  );
}
