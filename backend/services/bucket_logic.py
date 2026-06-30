from backend.models.schemas import AIProcessingResult

MAX_BUCKETS = 20

def apply_bucket_guardrail(
    result: AIProcessingResult,
    existing_buckets: list[str],
) -> AIProcessingResult:
    """
    Tab 3 STG-2.4 — Hard cap at 20 buckets.
    If user is at limit and AI suggests a new bucket,
    merge into the most used existing one.
    """
    is_new_bucket = result.suggested_bucket not in existing_buckets
    at_limit = len(existing_buckets) >= MAX_BUCKETS

    if is_new_bucket and at_limit:
        # Merge into first existing bucket as fallback
        # Later: replace with semantic similarity matching
        fallback = existing_buckets[0] if existing_buckets else "General"
        print(f"[Bucket Logic] Cap reached — merging '{result.suggested_bucket}' into '{fallback}'")
        result.suggested_bucket = fallback

    return result