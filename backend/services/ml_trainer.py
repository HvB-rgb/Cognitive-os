from backend.services.supabase_client import supabase
from backend.services.local_classifier import classifier


async def retrain_from_supabase(user_id: str) -> dict:
    """
    Fetches all completed entries for a user and retrains the classifier.
    Called automatically every 20 new entries.
    """
    if not supabase:
        return {"success": False, "reason": "No database connection"}

    try:
        result = (
            supabase.table("cognitive_entries")
            .select("cleaned_text, bucket")
            .eq("user_id", user_id)
            .eq("processing_status", "completed")
            .not_.is_("cleaned_text", "null")
            .not_.is_("bucket", "null")
            .execute()
        )

        entries = result.data or []

        # Filter out noise buckets
        entries = [
            e for e in entries
            if e["bucket"] not in {"General", "Inbox"}
            and len(e.get("cleaned_text", "")) > 20
        ]

        if len(entries) < 30:
            return {
                "success": False,
                "reason": f"Not enough clean entries ({len(entries)}/30)"
            }

        texts = [e["cleaned_text"] for e in entries]
        buckets = [e["bucket"] for e in entries]

        success = classifier.train(texts, buckets)

        return {
            "success": success,
            "samples": len(texts),
            "buckets": list(set(buckets)),
        }

    except Exception as e:
        print(f"[Trainer] Retraining failed: {e}")
        return {"success": False, "reason": str(e)}


async def log_disagreement(
    user_id: str,
    content: str,
    ml_bucket: str,
    ml_confidence: float,
    ai_bucket: str,
):
    """
    Logs cases where ML and AI disagree.
    These become high-value training signals.
    """
    if not supabase:
        return
    try:
        supabase.table("ml_disagreements").insert({
            "user_id": user_id,
            "content_preview": content[:200],
            "ml_prediction": ml_bucket,
            "ml_confidence": ml_confidence,
            "ai_prediction": ai_bucket,
            "resolved": False,
        }).execute()
        print(f"[Trainer] Disagreement logged: ML={ml_bucket} AI={ai_bucket}")
    except Exception as e:
        print(f"[Trainer] Failed to log disagreement: {e}")


async def get_disagreement_stats(user_id: str) -> dict:
    """Returns stats on how often ML and AI disagree."""
    if not supabase:
        return {}
    try:
        result = (
            supabase.table("ml_disagreements")
            .select("ml_prediction, ai_prediction")
            .eq("user_id", user_id)
            .execute()
        )
        total = len(result.data or [])
        return {
            "total_disagreements": total,
            "message": f"ML and AI disagreed {total} times — used as training signals"
        }
    except Exception as e:
        return {"error": str(e)}