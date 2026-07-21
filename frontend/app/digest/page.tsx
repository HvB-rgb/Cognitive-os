import { redirect } from "next/navigation";
import { getWeeklyScore, getLatestDailyPattern } from "@/lib/analyser";
import { getSessionUserId } from "@/lib/session";
import HamburgerLogout from "@/components/HamburgerLogout";
import styles from "./digest.module.css";

export const dynamic = "force-dynamic";

type CrossTopic = { bucket_a: string; bucket_b: string; shared_concepts?: string[]; strength?: number };
type Contradiction = { bucket: string; entry_a_title: string; entry_b_title: string; shared_concepts?: string[] };

export default async function DigestPage() {
  const userId = await getSessionUserId();
  if (!userId) redirect("/login");

  let score: Awaited<ReturnType<typeof getWeeklyScore>> | null = null;
  let pattern: Awaited<ReturnType<typeof getLatestDailyPattern>> = null;
  let error: string | null = null;

  try {
    [score, pattern] = await Promise.all([getWeeklyScore(userId), getLatestDailyPattern(userId)]);
  } catch (e) {
    error = e instanceof Error ? e.message : "Failed to load digest";
  }

  const crossTopics = (pattern?.cross_topic_data as CrossTopic[] | null) ?? [];
  const contradictions = (pattern?.contradiction_data as Contradiction[] | null) ?? [];

  const dims = score
    ? [
        { name: "Consistency", value: Math.round(score.consistency * 4) },
        { name: "Breadth", value: Math.round(score.breadth * 4) },
        { name: "Depth", value: Math.round(score.depth * 4) },
        { name: "Reflection", value: Math.round(score.reflection * 4) },
      ]
    : [];

  const nothingYet = !error && (!score || score.total === 0) && !pattern;

  return (
    <div className={styles.page}>
      <div className={styles.topbar}>
        <img className={styles.logo} src="/logo.png" alt="" />
        <span className={styles.word}>Cognitive OS</span>
        <div className={styles.navbtns}>
          <a href="/capture">Capture</a>
          <a href="/dashboard">Dashboard</a>
          <a href="/graph">Graph</a>
          <a href="/review">Review</a>
          <HamburgerLogout className={styles.hamb} />
        </div>
      </div>

      <div className={styles.wrap}>
        <a className={styles.back} href="/dashboard">
          ← Dashboard
        </a>
        <h1 className={styles.h1}>Weekly Digest</h1>
        <p className={styles.sub}>Your knowledge patterns from the past week</p>

        {error && <div className={styles.errbox}>{error}</div>}

        {nothingYet && (
          <div className={styles.empty}>
            Your digest fills in as you capture — check back once you have a few entries.
          </div>
        )}

        {score && score.total > 0 && (
          <div className={styles.card}>
            <p className={styles.lbl}>Weekly Knowledge Score</p>
            <div className={styles.scoreTop}>
              <div className={styles.scoreBig}>
                {score.total}
                <span>/ 100</span>
              </div>
              <div className={styles.scoreMeta}>
                <div>{score.distinctBuckets} buckets</div>
                <div>{score.activeDays} active days</div>
                <div>{score.reflectPct}% reflect</div>
              </div>
            </div>
            <div className={styles.dims}>
              {dims.map((d) => (
                <div className={styles.dim} key={d.name}>
                  <div className={styles.dimVal}>{d.value}</div>
                  <div className={styles.dimName}>{d.name}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {pattern?.groq_synthesis && (
          <div className={`${styles.card} ${styles.coach}`}>
            <p className={styles.lbl}>AI Coach</p>
            <p className={styles.coachText}>{pattern.groq_synthesis}</p>
            <p className={styles.coachDate}>Last analysed: {pattern.date}</p>
          </div>
        )}

        {crossTopics.length > 0 && (
          <div className={styles.card}>
            <p className={styles.lbl}>Cross-Topic Connections</p>
            {crossTopics.slice(0, 6).map((c, i) => (
              <div key={i} className={styles.crossRow}>
                <span className={styles.pill}>{c.bucket_a}</span>
                <span className={styles.arrow}>↔</span>
                <span className={styles.pill}>{c.bucket_b}</span>
                {c.shared_concepts && c.shared_concepts.length > 0 && (
                  <span className={styles.shared}>{c.shared_concepts.slice(0, 3).join(", ")}</span>
                )}
              </div>
            ))}
          </div>
        )}

        {contradictions.length > 0 && (
          <div className={`${styles.card} ${styles.warnCard}`}>
            <p className={styles.lbl}>Contradictions Flagged ({contradictions.length})</p>
            {contradictions.slice(0, 4).map((c, i) => (
              <div key={i} className={styles.contra}>
                <p className={styles.contraBucket}>{c.bucket}</p>
                <p className={styles.contraTitle}>{c.entry_a_title}</p>
                <p className={styles.vs}>vs</p>
                <p className={styles.contraTitle}>{c.entry_b_title}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
