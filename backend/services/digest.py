from datetime import datetime, timedelta
from backend.services.supabase_client import supabase


def generate_weekly_digest(internal_user_id: str) -> str | None:
    """Builds a week-in-review digest grouped by bucket. Returns None if nothing was saved."""
    if not supabase:
        return None

    week_ago = (datetime.utcnow() - timedelta(days=7)).isoformat()

    result = (
        supabase.table("cognitive_entries")
        .select("title, bucket, cognitive_mode, created_at")
        .eq("user_id", internal_user_id)
        .gte("created_at", week_ago)
        .order("created_at", desc=True)
        .execute()
    )

    entries = result.data
    if not entries:
        return None

    grouped: dict[str, list[dict]] = {}
    for entry in entries:
        grouped.setdefault(entry["bucket"], []).append(entry)

    lines = [f"📊 *Your week in review* — {len(entries)} items captured\n"]

    for bucket, items in sorted(grouped.items(), key=lambda x: -len(x[1])):
        lines.append(f"\n📁 *{bucket}* ({len(items)})")
        for item in items[:5]:
            lines.append(f"  • {item['title']}")
        if len(items) > 5:
            lines.append(f"  …and {len(items) - 5} more")

    lines.append("\n\nSend /recall to see your latest captures, or /find to search everything.")
    return "\n".join(lines)