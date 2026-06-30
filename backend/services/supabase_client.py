from supabase import create_client, Client
from backend.config import get_settings

settings = get_settings()

def get_supabase() -> Client | None:
    if not settings.supabase_url or not settings.supabase_key:
        print("[Supabase] No credentials — running without DB")
        return None
    return create_client(settings.supabase_url, settings.supabase_key)

supabase: Client | None = get_supabase()