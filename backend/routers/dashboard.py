from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from collections import Counter
from datetime import date, timedelta
from backend.services.supabase_client import supabase
from backend.services import database
from backend.dependencies import get_current_user

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


# ── Response models ───────────────────────────────────────────────────────────

class ConvergenceResponse(BaseModel):
    score: float
    dominant_bucket: str | None
    distribution: dict[str, int]
    language: str
    entry_count: int
    date: str

class BucketVelocity(BaseModel):
    name: str
    this_week: int
    last_week: int
    change_percent: float
    streak_weeks: int
    streak_direction: str
    language: str
    status: str
    needs_attention: bool

class VelocityResponse(BaseModel):
    buckets: list[BucketVelocity]
    weekly_insight: str
    week_start: str
    week_end: str

class CrossTopicConnection(BaseModel):
    bucket_a: str
    bucket_b: str
    strength: float
    shared_concepts: list[str]
    insight: str

class CrossTopicResponse(BaseModel):
    connections: list[CrossTopicConnection]
    total_connections: int
    date: str

# ── Helper ────────────────────────────────────────────────────────────────────

def _score_to_language(score: float, dominant: str | None, entry_count: int) -> str:
    if entry_count < 3:
        return "Not enough entries today to detect a pattern yet."
    if score >= 0.8:
        return f"Laser focused — almost everything today revolves around {dominant}."
    elif score >= 0.6:
        return f"Strong focus on {dominant} today with some exploration on the side."
    elif score >= 0.4:
        return f"Balanced day — {dominant} leads but you explored multiple areas."
    elif score >= 0.2:
        return "Wide exploration today — your curiosity is ranging across many topics."
    else:
        return "Highly scattered day — you touched almost every bucket equally."

def _velocity_to_language(change_percent: float, bucket: str) -> str:
    if change_percent > 50:
        return f"You're in a deep dive on {bucket} right now"
    elif change_percent > 20:
        return f"{bucket} is gaining momentum"
    elif change_percent > 0:
        return f"Steady progress on {bucket}"
    elif change_percent == 0:
        return f"{bucket} has gone quiet this week"
    elif change_percent > -50:
        return f"Your focus on {bucket} is fading"
    elif change_percent > -80:
        return f"{bucket} has slowed down significantly"
    else:
        return f"You've stepped away from {bucket} completely"

def _velocity_to_status(change_percent: float) -> str:
    if change_percent > 20:
        return "accelerating"
    elif change_percent > 0:
        return "steady"
    elif change_percent == 0:
        return "quiet"
    else:
        return "fading"

# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/health")
async def dashboard_health() -> dict[str, str]:
    return {"status": "ok"}


@router.get("/convergence", response_model=ConvergenceResponse)
async def get_convergence(user: dict = Depends(get_current_user)):
    try:
        db_user_id = user["id"]
        today = date.today().isoformat()
        week_ago = (date.today() - timedelta(days=7)).isoformat()

        if not supabase:
            raise HTTPException(status_code=503, detail="Database not connected.")

        result = (
            supabase.table("cognitive_entries")
            .select("bucket")
            .eq("user_id", db_user_id)
            .eq("processing_status", "completed")
            .gte("created_at", f"{week_ago}T00:00:00")
            .execute()
        )

        entries = result.data or []
        entry_count = len(entries)

        if entry_count == 0:
            return ConvergenceResponse(
                score=0.0,
                dominant_bucket=None,
                distribution={},
                language="No entries yet today. Start capturing thoughts!",
                entry_count=0,
                date=f"{week_ago} to {today}",
            )

        buckets = [e["bucket"] for e in entries if e["bucket"]]
        distribution = dict(Counter(buckets))

        dominant_bucket = Counter(buckets).most_common(1)[0][0]
        dominant_count = Counter(buckets).most_common(1)[0][1]
        score = round(dominant_count / entry_count, 2)

        language = _score_to_language(score, dominant_bucket, entry_count)

        return ConvergenceResponse(
            score=score,
            dominant_bucket=dominant_bucket,
            distribution=distribution,
            language=language,
            entry_count=entry_count,
            date=f"{week_ago} to {today}",
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/velocity", response_model=VelocityResponse)
async def get_velocity(user: dict = Depends(get_current_user)):
    try:
        db_user_id = user["id"]
        today = date.today()
        this_week_start = (today - timedelta(days=7)).isoformat()
        last_week_start = (today - timedelta(days=14)).isoformat()

        if not supabase:
            raise HTTPException(status_code=503, detail="Database not connected.")

        this_week_result = (
            supabase.table("cognitive_entries")
            .select("bucket")
            .eq("user_id", db_user_id)
            .eq("processing_status", "completed")
            .gte("created_at", f"{this_week_start}T00:00:00")
            .execute()
        )

        last_week_result = (
            supabase.table("cognitive_entries")
            .select("bucket")
            .eq("user_id", db_user_id)
            .eq("processing_status", "completed")
            .gte("created_at", f"{last_week_start}T00:00:00")
            .lt("created_at", f"{this_week_start}T00:00:00")
            .execute()
        )

        this_counts = Counter(
            e["bucket"] for e in (this_week_result.data or []) if e["bucket"]
        )
        last_counts = Counter(
            e["bucket"] for e in (last_week_result.data or []) if e["bucket"]
        )

        all_buckets = set(list(this_counts.keys()) + list(last_counts.keys()))
        all_buckets.discard("General")
        all_buckets.discard("Inbox")
        bucket_velocities = []

        for bucket in all_buckets:
            this = this_counts.get(bucket, 0)
            last = last_counts.get(bucket, 0)

            if last == 0:
                change_percent = 100.0 if this > 0 else 0.0
            else:
                change_percent = round(((this - last) / last) * 100, 1)

            status = _velocity_to_status(change_percent)
            language = _velocity_to_language(change_percent, bucket)
            needs_attention = change_percent <= -50 or (last > 2 and this == 0)

            bucket_velocities.append(BucketVelocity(
                name=bucket,
                this_week=this,
                last_week=last,
                change_percent=change_percent,
                streak_weeks=1,
                streak_direction="growing" if change_percent > 0 else "declining",
                language=language,
                status=status,
                needs_attention=needs_attention,
            ))

        bucket_velocities.sort(key=lambda x: x.this_week, reverse=True)

        accelerating = [b.name for b in bucket_velocities if b.status == "accelerating"]
        fading = [b.name for b in bucket_velocities if b.needs_attention]

        if accelerating and fading:
            insight = f"Strong momentum in {', '.join(accelerating)}. {', '.join(fading)} needs your attention."
        elif accelerating:
            insight = f"Good week — {', '.join(accelerating)} is growing. Keep the momentum."
        elif fading:
            insight = f"{', '.join(fading)} has gone quiet. Intentional break or losing track?"
        else:
            insight = "Steady week across all your knowledge areas."

        return VelocityResponse(
            buckets=bucket_velocities,
            weekly_insight=insight,
            week_start=this_week_start,
            week_end=today.isoformat(),
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/cross-topics", response_model=CrossTopicResponse)
async def get_cross_topics(user: dict = Depends(get_current_user)):
    try:
        db_user_id = user["id"]
        today = date.today().isoformat()
        week_ago = (date.today() - timedelta(days=7)).isoformat()

        if not supabase:
            raise HTTPException(status_code=503, detail="Database not connected.")

        result = (
            supabase.table("cognitive_entries")
            .select("bucket, key_points, title")
            .eq("user_id", db_user_id)
            .eq("processing_status", "completed")
            .gte("created_at", f"{week_ago}T00:00:00")
            .execute()
        )

        entries = result.data or []

        if len(entries) < 2:
            return CrossTopicResponse(
                connections=[],
                total_connections=0,
                date=today,
            )

        bucket_map: dict[str, list] = {}
        for entry in entries:
            bucket = entry.get("bucket")
            if not bucket or bucket in {"General", "Inbox"}:
                continue
            if bucket not in bucket_map:
                bucket_map[bucket] = []
            bucket_map[bucket].append(entry)

        buckets = list(bucket_map.keys())
        connections = []
        stopwords = {
            "the", "a", "an", "is", "are", "was", "and", "or",
            "to", "of", "in", "for", "on", "with", "it", "this",
            "that", "be", "as", "at", "by", "from", "has", "have"
        }

        from itertools import combinations
        for bucket_a, bucket_b in combinations(buckets, 2):
            def extract_words(entries_list):
                words = set()
                for e in entries_list:
                    kps = e.get("key_points") or []
                    for kp in kps:
                        for word in kp.lower().split():
                            clean = word.strip(".,!?;:'\"")
                            if len(clean) > 4 and clean not in stopwords:
                                words.add(clean)
                return words

            words_a = extract_words(bucket_map[bucket_a])
            words_b = extract_words(bucket_map[bucket_b])
            shared = words_a & words_b

            if len(shared) >= 2:
                strength = round(
                    len(shared) / max(len(words_a), len(words_b)), 2
                )
                shared_list = list(shared)[:5]
                insight = (
                    f"{bucket_a} and {bucket_b} both touch on "
                    f"{', '.join(shared_list[:3])} — "
                    f"there's a deeper thread connecting these areas."
                )
                connections.append(CrossTopicConnection(
                    bucket_a=bucket_a,
                    bucket_b=bucket_b,
                    strength=strength,
                    shared_concepts=shared_list,
                    insight=insight,
                ))

        connections.sort(key=lambda x: x.strength, reverse=True)

        return CrossTopicResponse(
            connections=connections,
            total_connections=len(connections),
            date=f"{week_ago} to {today}",
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/train")
async def trigger_training(user: dict = Depends(get_current_user)):
    """Manually trigger ML retraining from dashboard."""
    from backend.services.ml_trainer import retrain_from_supabase
    result = await retrain_from_supabase(user["id"])
    return result


@router.get("/ml-stats")
async def get_ml_stats(user: dict = Depends(get_current_user)):
    """Returns ML classifier performance stats."""
    from backend.services.local_classifier import classifier
    from backend.services.ml_trainer import get_disagreement_stats

    stats = await get_disagreement_stats(user["id"])

    return {
        "model_trained": classifier.is_ready,
        "training_samples": classifier.training_samples,
        "confidence_threshold": 0.85,
        "disagreement_stats": stats,
    }