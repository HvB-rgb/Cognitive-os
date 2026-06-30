from fastapi import Header, HTTPException
from backend.services.supabase_client import supabase


async def get_current_user(x_dashboard_token: str = Header(..., alias="X-Dashboard-Token")) -> dict:
    """
    Resolves a dashboard token to its owning user.
    Every dashboard route depends on this instead of trusting a telegram_id in the URL.
    """
    if not supabase:
        raise HTTPException(status_code=503, detail="Database not connected.")

    result = (
        supabase.table("users")
        .select("id, phone_number, dashboard_token")
        .eq("dashboard_token", x_dashboard_token)
        .execute()
    )

    if not result.data:
        raise HTTPException(status_code=401, detail="Invalid or missing dashboard token.")

    return result.data[0]