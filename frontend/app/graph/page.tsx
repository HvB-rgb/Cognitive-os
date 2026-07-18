import { getGraphData, type GraphData } from "@/lib/graph";
import GraphView from "@/components/GraphView";

export const dynamic = "force-dynamic";

export default async function GraphPage() {
  let data: GraphData = { nodes: [], links: [] };
  let error: string | null = null;

  try {
    data = await getGraphData();
  } catch (e) {
    error = e instanceof Error ? e.message : "Failed to load graph";
  }

  return (
    <div className="flex flex-col h-screen px-4 py-6">
      <div className="flex items-center justify-between mb-4 shrink-0">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Knowledge Graph</h1>
          <p className="text-muted text-xs mt-0.5">
            {data.nodes.filter((n) => n.type === "bucket").length} buckets ·{" "}
            {data.nodes.filter((n) => n.type === "entry").length} entries ·{" "}
            {data.links.filter((l) => l.type === "cross-topic").length} cross-topic ·{" "}
            {data.links.filter((l) => l.type === "shared-concept").length} shared-concept links
          </p>
        </div>
        <nav className="flex gap-4 text-sm text-muted">
          <a href="/" className="hover:text-white transition-colors">Entries</a>
          <a href="/insight" className="hover:text-white transition-colors">Insight</a>
          <a href="/review" className="hover:text-white transition-colors">Review</a>
        </nav>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-900/50 bg-red-950/20 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      ) : (
        <div className="flex-1 min-h-0">
          <GraphView data={data} />
        </div>
      )}

    </div>
  );
}
