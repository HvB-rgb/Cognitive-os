import { getSpacedRepetitionEntries, type SpacedEntry } from "@/lib/analyser";
import ReviewCard from "@/components/ReviewCard";
import HamburgerLogout from "@/components/HamburgerLogout";
import styles from "./review.module.css";

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
    <div className={styles.page}>
      <div className={styles.topbar}>
        <img className={styles.logo} src="/logo.png" alt="" />
        <span className={styles.word}>Cognitive OS</span>
        <div className={styles.navbtns}>
          <a href="/capture">Capture</a>
          <a href="/dashboard">Dashboard</a>
          <a href="/graph">Graph</a>
          <a className={styles.active}>Review</a>
          <HamburgerLogout className={styles.hamb} />
        </div>
      </div>

      <div className={styles.pageBg}>
        <img
          className={`${styles.floatMark} ${styles.fmL1}`}
          src="/logo.png"
          alt=""
          style={{ "--end-op": 0.14 } as React.CSSProperties}
        />
        <img
          className={`${styles.floatMark} ${styles.fmL2}`}
          src="/logo.png"
          alt=""
          style={{ "--end-op": 0.22 } as React.CSSProperties}
        />
        <img
          className={`${styles.floatMark} ${styles.fmR1}`}
          src="/logo.png"
          alt=""
          style={{ "--end-op": 0.14 } as React.CSSProperties}
        />
        <img
          className={`${styles.floatMark} ${styles.fmR2}`}
          src="/logo.png"
          alt=""
          style={{ "--end-op": 0.2 } as React.CSSProperties}
        />

        <div className={styles.wrap}>
          <h1 className={styles.h1}>Review Queue</h1>
          <p className={styles.sub}>
            {entries.length > 0
              ? `${entries.length} ${entries.length === 1 ? "entry" : "entries"} due for review — spaced repetition keeps ideas alive`
              : "No entries due for review right now"}
          </p>

          {error && <div className={styles.errbox}>{error}</div>}

          {entries.length === 0 && !error && (
            <div className={styles.empty}>
              Check back after you have entries that are 7, 14, or 30 days old.
            </div>
          )}

          {([7, 14, 30] as const).map((interval) => {
            const group = byInterval[interval];
            if (!group.length) return null;
            return (
              <section key={interval} className={styles.group}>
                <div className={styles.glabel}>
                  <span>{labels[interval]}</span>
                  <span>
                    {group.length} {group.length === 1 ? "entry" : "entries"}
                  </span>
                </div>
                {group.map((entry) => (
                  <ReviewCard key={entry.id} entry={entry} />
                ))}
              </section>
            );
          })}

          <div className={styles.footNav}>
            <a href="/dashboard">← Dashboard</a>
            <a href="/graph">Graph →</a>
          </div>
        </div>
      </div>
    </div>
  );
}
