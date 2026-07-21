import { redirect } from "next/navigation";
import { getGraphData, type GraphData } from "@/lib/graph";
import { getSessionUserId } from "@/lib/session";
import GraphView from "@/components/GraphView";
import HamburgerLogout from "@/components/HamburgerLogout";
import styles from "./graph.module.css";

export const dynamic = "force-dynamic";

export default async function GraphPage() {
  const userId = await getSessionUserId();
  if (!userId) redirect("/login");

  let data: GraphData = { nodes: [], links: [] };
  let error: string | null = null;

  try {
    data = await getGraphData(userId);
  } catch (e) {
    error = e instanceof Error ? e.message : "Failed to load graph";
  }

  const bucketCount = data.nodes.filter((n) => n.type === "bucket").length;
  const entryCount = data.nodes.filter((n) => n.type === "entry").length;

  return (
    <div className={styles.page}>
      <div className={styles.topbar}>
        <img className={styles.logo} src="/logo.png" alt="" />
        <span className={styles.word}>Cognitive OS</span>
        <div className={styles.navbtns}>
          <a href="/capture">Capture</a>
          <a href="/dashboard">Dashboard</a>
          <a className={styles.active}>Graph</a>
          <a href="/review">Review</a>
          <HamburgerLogout className={styles.hamb} />
        </div>
      </div>

      <div className={styles.wrap}>
        <h1 className={styles.h1}>Knowledge Graph</h1>
        <p className={styles.gs}>
          {bucketCount} {bucketCount === 1 ? "bucket" : "buckets"} · {entryCount}{" "}
          {entryCount === 1 ? "entry" : "entries"}
        </p>

        {error && <div className={styles.errbox}>{error}</div>}

        <div className={styles.canvasHolder}>
          <GraphView data={data} />
        </div>
      </div>
    </div>
  );
}
