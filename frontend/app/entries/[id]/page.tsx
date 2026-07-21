import { redirect, notFound } from "next/navigation";
import { getEntry } from "@/lib/supabase";
import { getSessionUserId } from "@/lib/session";
import HamburgerLogout from "@/components/HamburgerLogout";
import styles from "../entries.module.css";

export const dynamic = "force-dynamic";

const MODE_LABELS: Record<string, string> = { learn: "Learn", think: "Think", reflect: "Reflect" };

export default async function EntryDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const userId = await getSessionUserId();
  if (!userId) redirect("/login");

  const { id } = await params;
  const entry = await getEntry(userId, id);
  if (!entry) notFound();

  const filled = Math.round((entry.actionability_score ?? 0) * 5);

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
        <a className={styles.back} href="/entries">
          ← All entries
        </a>

        <div className={styles.detailCard}>
          <div className={styles.tags}>
            <span className={`${styles.tag} ${styles[entry.cognitive_mode] ?? ""}`}>
              {MODE_LABELS[entry.cognitive_mode] ?? entry.cognitive_mode}
            </span>
            {entry.bucket && (
              <a href={`/entries?bucket=${encodeURIComponent(entry.bucket)}`} className={`${styles.tag} ${styles.bucket}`}>
                {entry.bucket}
              </a>
            )}
            <span className={styles.date}>
              {new Date(entry.created_at).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </span>
          </div>

          <h1 className={styles.detailTitle}>{entry.title}</h1>

          {entry.summary && (
            <div className={styles.section}>
              <p className={styles.plabel}>Summary</p>
              <p className={styles.body}>{entry.summary}</p>
            </div>
          )}

          {entry.key_points?.length > 0 && (
            <div className={styles.section}>
              <p className={styles.plabel}>Key Points</p>
              {entry.key_points.map((pt, i) => (
                <div key={i} className={styles.kp}>
                  <span className={styles.kpMark}>·</span>
                  <span>{pt}</span>
                </div>
              ))}
            </div>
          )}

          <div className={styles.section}>
            <p className={styles.plabel}>Actionability</p>
            <div className={styles.dots}>
              {Array.from({ length: 5 }).map((_, i) => (
                <i key={i} style={{ background: i < filled ? "#2f6fed" : "#e2dbc7" }} />
              ))}
            </div>
          </div>

          {entry.source_url && (
            <div className={styles.section}>
              <p className={styles.plabel}>Source</p>
              <a className={styles.sourceLink} href={entry.source_url} target="_blank" rel="noopener noreferrer">
                {entry.source_url}
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
