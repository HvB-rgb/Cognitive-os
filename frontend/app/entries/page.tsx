import { redirect } from "next/navigation";
import { getEntries } from "@/lib/supabase";
import { getSessionUserId } from "@/lib/session";
import HamburgerLogout from "@/components/HamburgerLogout";
import styles from "./entries.module.css";

export const dynamic = "force-dynamic";

const MODE_LABELS: Record<string, string> = { learn: "Learn", think: "Think", reflect: "Reflect" };

export default async function EntriesPage() {
  const userId = await getSessionUserId();
  if (!userId) redirect("/login");

  let entries: Awaited<ReturnType<typeof getEntries>> = [];
  let error: string | null = null;

  try {
    entries = await getEntries(userId);
  } catch (e) {
    error = e instanceof Error ? e.message : "Failed to load entries";
  }

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
        <h1 className={styles.h1}>All Entries</h1>
        <p className={styles.sub}>
          {entries.length} {entries.length === 1 ? "entry" : "entries"} captured
        </p>

        {error && <div className={styles.errbox}>{error}</div>}

        {entries.length === 0 && !error && (
          <div className={styles.empty}>Nothing captured yet — head to Capture to add your first entry.</div>
        )}

        {entries.map((entry) => (
          <div key={entry.id} className={styles.card}>
            <div className={styles.row}>
              <div className={styles.tags}>
                <span className={`${styles.tag} ${styles[entry.cognitive_mode] ?? ""}`}>
                  {MODE_LABELS[entry.cognitive_mode] ?? entry.cognitive_mode}
                </span>
                <span className={`${styles.tag} ${styles.bucket}`}>{entry.bucket}</span>
              </div>
              <span className={styles.date}>
                {new Date(entry.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              </span>
            </div>
            <p className={styles.title}>{entry.title}</p>
            {entry.summary && <p className={styles.summary}>{entry.summary}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}
