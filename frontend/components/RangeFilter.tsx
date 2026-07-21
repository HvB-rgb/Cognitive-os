"use client";

import { useRouter } from "next/navigation";

/** The dashboard is a Server Component, so the time-range control has to
 * be a small client island that just navigates to ?range=… — the server
 * re-reads the param and re-runs its queries for that window. */
export default function RangeFilter({ value, className }: { value: string; className?: string }) {
  const router = useRouter();
  return (
    <select
      className={className}
      value={value}
      onChange={(e) => router.push(`/dashboard?range=${e.target.value}`)}
      aria-label="Time range"
    >
      <option value="today">Today</option>
      <option value="week">This week</option>
      <option value="month">This month</option>
      <option value="all">All time</option>
    </select>
  );
}
