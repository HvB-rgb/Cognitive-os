import { redirect } from "next/navigation";
import { getEntries } from "@/lib/supabase";
import { getSessionUserId } from "@/lib/session";
import HamburgerLogout from "@/components/HamburgerLogout";
import styles from "./entries.module.css";

export const dynamic = "force-dynamic";

const MODE_LABELS: Record<string, string> = { learn: "Learn", think: "Think", reflect: "Reflect" };

export default async function EntriesPage({
  searchParams,
}: {
  searchParams: Promise<{ bucket?: string }>;
}) {
  const userId = await getSessionUserId();
  if (!userId) redirect("/login");

  const { bucket } = await searchParams;

  let entries: Awaited<ReturnType<typeof getEntries>> = [];
  let error: string | null = null;

  try {
    entries = await getEntries(userId, bucket);
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
        <a className={styles.back} href={bucket ? "/entries" : "/dashboard"}>
          ← {bucket ? "All entries" : "Dashboard"}
        </a>
        <h1 className={styles.h1}>{bucket ? bucket : "All Entries"}</h1>
        <p className={styles.sub}>
          {entries.length} {entries.length === 1 ? "entry" : "entries"}
          {bucket ? " in this bucket" : " captured"}
        </p>

        {error && <div className={styles.errbox}>{error}</div>}

        {entries.length === 0 && !error && (
          <div className={styles.empty}>
            {bucket
              ? "No entries in this bucket yet."
              : "Nothing captured yet — head to Capture to add your first entry."}
          </div>
        )}

        {entries.map((entry) => (
          <a key={entry.id} href={`/entries/${entry.id}`} className={styles.cardLink}>
            <div className={styles.card}>
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
          </a>
        ))}
      </div>
    </div>
  );
}
