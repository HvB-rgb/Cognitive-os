from __future__ import annotations
from backend.services.supabase_client import supabase
import uuid
import hashlib

async def get_or_create_dashboard_token(internal_user_id: str) -> str | None:
    """Returns the user's dashboard token, generating one if it's missing."""
    if not supabase:
        return None
    try:
        result = (
            supabase.table("users")
            .select("dashboard_token")
            .eq("id", internal_user_id)
            .execute()
        )
        if result.data and result.data[0].get("dashboard_token"):
            return result.data[0]["dashboard_token"]

        new_token = str(uuid.uuid4())
        supabase.table("users").update({"dashboard_token": new_token}).eq("id", internal_user_id).execute()
        return new_token
    except Exception as e:
        print(f"[DB] get_or_create_dashboard_token failed: {e}")
        return None


async def reset_dashboard_token(internal_user_id: str) -> str | None:
    """Generates a brand-new token, invalidating the old one immediately."""
    if not supabase:
        return None
    try:
        new_token = str(uuid.uuid4())
        supabase.table("users").update({"dashboard_token": new_token}).eq("id", internal_user_id).execute()
        return new_token
    except Exception as e:
        print(f"[DB] reset_dashboard_token failed: {e}")
        return None

async def get_or_create_user(telegram_id: str) -> dict | None:
    """
    Finds user by telegram_id stored in phone_number field.
    Creates them if they don't exist.
    """
    if not supabase:
        return None
    try:
        result = (
            supabase.table("users")
            .select("*")
            .eq("phone_number", telegram_id)
            .execute()
        )
        if result.data:
            return result.data[0]

        # Create new user
        insert = (
            supabase.table("users")
            .insert({"phone_number": telegram_id})
            .execute()
        )
        return insert.data[0] if insert.data else None
    except Exception as e:
        print(f"[DB] get_or_create_user failed: {e}")
        return None


async def get_user_buckets(user_id: str) -> list[str]:
    """
    Returns list of bucket names for this user.
    Used by ai_engine to suggest correct bucket.
    """
    if not supabase:
        return []
    try:
        result = (
            supabase.table("buckets")
            .select("name")
            .eq("user_id", user_id)
            .execute()
        )
        return [row["name"] for row in result.data] if result.data else []
    except Exception as e:
        print(f"[DB] get_user_buckets failed: {e}")
        return []


async def get_or_create_bucket(user_id: str, bucket_name: str) -> bool:
    """
    Creates bucket if it doesn't exist for this user.
    Returns True on success.
    """
    if not supabase:
        return False
    try:
        existing = (
            supabase.table("buckets")
            .select("id")
            .eq("user_id", user_id)
            .eq("name", bucket_name)
            .execute()
        )
        if existing.data:
            return True

        supabase.table("buckets").insert({
            "user_id": user_id,
            "name": bucket_name,
            "entry_count": 0,
        }).execute()
        return True
    except Exception as e:
        print(f"[DB] get_or_create_bucket failed: {e}")
        return False


async def increment_bucket_count(user_id: str, bucket_name: str):
    """Increments entry_count on the bucket after saving an entry."""
    if not supabase:
        return
    try:
        result = (
            supabase.table("buckets")
            .select("entry_count")
            .eq("user_id", user_id)
            .eq("name", bucket_name)
            .execute()
        )
        if result.data:
            current = result.data[0]["entry_count"] or 0
            supabase.table("buckets").update(
                {"entry_count": current + 1}
            ).eq("user_id", user_id).eq("name", bucket_name).execute()
    except Exception as e:
        print(f"[DB] increment_bucket_count failed: {e}")


async def get_all_users() -> list[dict]:
    """Returns all registered users — used by the weekly digest job."""
    if not supabase:
        return []
    try:
        result = supabase.table("users").select("id, phone_number").execute()
        return result.data if result.data else []
    except Exception as e:
        print(f"[DB] get_all_users failed: {e}")
        return []

# ── Dashboard token management ────────────────────────────────────────────────

async def get_or_create_dashboard_token(internal_user_id: str) -> str | None:
    """Returns the user's dashboard token, generating one if it's missing."""
    if not supabase:
        return None
    try:
        result = (
            supabase.table("users")
            .select("dashboard_token")
            .eq("id", internal_user_id)
            .execute()
        )
        if result.data and result.data[0].get("dashboard_token"):
            return result.data[0]["dashboard_token"]

        new_token = str(uuid.uuid4())
        supabase.table("users").update({"dashboard_token": new_token}).eq("id", internal_user_id).execute()
        return new_token
    except Exception as e:
        print(f"[DB] get_or_create_dashboard_token failed: {e}")
        return None


async def reset_dashboard_token(internal_user_id: str) -> str | None:
    """Generates a brand-new token, invalidating the old one immediately."""
    if not supabase:
        return None
    try:
        new_token = str(uuid.uuid4())
        supabase.table("users").update({"dashboard_token": new_token}).eq("id", internal_user_id).execute()
        return new_token
    except Exception as e:
        print(f"[DB] reset_dashboard_token failed: {e}")
        return None


# ── PIN management ────────────────────────────────────────────────────────────

def _hash_pin(pin: str) -> str:
    return hashlib.sha256(pin.encode()).hexdigest()


async def set_user_pin(internal_user_id: str, pin: str) -> bool:
    if not supabase:
        return False
    try:
        supabase.table("users").update({"pin_hash": _hash_pin(pin)}).eq("id", internal_user_id).execute()
        return True
    except Exception as e:
        print(f"[DB] set_user_pin failed: {e}")
        return False


async def verify_user_pin(internal_user_id: str, pin: str) -> bool:
    if not supabase:
        return False
    try:
        result = supabase.table("users").select("pin_hash").eq("id", internal_user_id).execute()
        if not result.data or not result.data[0].get("pin_hash"):
            return False
        return result.data[0]["pin_hash"] == _hash_pin(pin)
    except Exception as e:
        print(f"[DB] verify_user_pin failed: {e}")
        return False


# ── Used by weekly digest ─────────────────────────────────────────────────────

async def get_all_users() -> list[dict]:
    if not supabase:
        return []
    try:
        result = supabase.table("users").select("id, phone_number").execute()
        return result.data if result.data else []
    except Exception as e:
        print(f"[DB] get_all_users failed: {e}")
        return []

async def save_entry(
    user_id: str,
    input_type: str,
    original_input: str,
    cleaned_text: str,
    result,                     # AIProcessingResult
    source_url: str | None = None,
) -> str | None:
    """
    Saves a completed cognitive entry.
    Returns the entry UUID on success.
    """
    if not supabase:
        return None
    try:
        insert = supabase.table("cognitive_entries").insert({
            "user_id": user_id,
            "input_type": input_type,
            "cognitive_mode": result.cognitive_mode,
            "original_input": original_input,
            "source_url": source_url,
            "cleaned_text": cleaned_text,
            "title": result.title,
            "summary": result.summary,
            "key_points": result.key_points,
            "bucket": result.suggested_bucket,
            "actionability_score": result.actionability_score,
            "processing_status": "completed",
        }).execute()
        return insert.data[0]["id"] if insert.data else None
    except Exception as e:
        print(f"[DB] save_entry failed: {e}")
        return None


# ── Website credentials ───────────────────────────────────────────────────────

async def create_website_credential(
    user_id: str,
    site_name: str,
    email: str,
    password_encrypted: str,
    combination: str,
) -> dict | None:
    if not supabase:
        return None
    try:
        insert = (
            supabase.table("website_credentials")
            .insert({
                "user_id": user_id,
                "site_name": site_name,
                "email": email,
                "password_encrypted": password_encrypted,
                "combination": combination,
            })
            .execute()
        )
        return insert.data[0] if insert.data else None
    except Exception as e:
        print(f"[DB] create_website_credential failed: {e}")
        return None


async def get_website_credentials(user_id: str) -> list[dict]:
    if not supabase:
        return []
    try:
        result = (
            supabase.table("website_credentials")
            .select("id, site_name, email, combination, created_at, updated_at")
            .eq("user_id", user_id)
            .order("created_at", desc=True)
            .execute()
        )
        return result.data or []
    except Exception as e:
        print(f"[DB] get_website_credentials failed: {e}")
        return []


async def get_website_credential(user_id: str, credential_id: str) -> dict | None:
    if not supabase:
        return None
    try:
        result = (
            supabase.table("website_credentials")
            .select("*")
            .eq("user_id", user_id)
            .eq("id", credential_id)
            .execute()
        )
        return result.data[0] if result.data else None
    except Exception as e:
        print(f"[DB] get_website_credential failed: {e}")
        return None


async def update_website_credential(user_id: str, credential_id: str, updates: dict) -> dict | None:
    if not supabase:
        return None
    try:
        result = (
            supabase.table("website_credentials")
            .update(updates)
            .eq("user_id", user_id)
            .eq("id", credential_id)
            .execute()
        )
        return result.data[0] if result.data else None
    except Exception as e:
        print(f"[DB] update_website_credential failed: {e}")
        return None


async def delete_website_credential(user_id: str, credential_id: str) -> bool:
    if not supabase:
        return False
    try:
        result = (
            supabase.table("website_credentials")
            .delete()
            .eq("user_id", user_id)
            .eq("id", credential_id)
            .execute()
        )
        return bool(result.data)
    except Exception as e:
        print(f"[DB] delete_website_credential failed: {e}")
        return False