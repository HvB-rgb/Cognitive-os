from __future__ import annotations
from datetime import date
import bcrypt

from backend.services.supabase_client import supabase
from backend.services.combination_generator import generate_combination
from backend.services import database


def _generate_username(first_name: str, last_name: str, dob: date) -> str:
    """<initials><_><ddmm> — e.g. Harsh Vardhan Bagri, 21/08/2006 -> HVB_2108."""
    names = first_name.split() + last_name.split()
    return generate_combination(
        rules=["initials", "symbol", "birthdate"],
        names=names,
        symbol="_",
        birth_date=dob,
        birth_date_parts=["day", "month"],
    )


def _unique_username(first_name: str, last_name: str, dob: date) -> str:
    """Appends -2, -3, ... on collision (e.g. two people sharing initials + ddmm)."""
    base = _generate_username(first_name, last_name, dob)
    username = base
    suffix = 2
    while supabase.table("users").select("id").eq("username", username).execute().data:
        username = f"{base}-{suffix}"
        suffix += 1
    return username


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(password: str, password_hash: str) -> bool:
    return bcrypt.checkpw(password.encode(), password_hash.encode())


async def create_user_with_email(
    email: str,
    password: str,
    first_name: str,
    last_name: str,
    dob: date,
) -> dict:
    """Creates a user via email/password signup. Raises ValueError if the
    email is already registered."""
    if not supabase:
        raise RuntimeError("Database not connected.")

    existing = supabase.table("users").select("id").eq("email", email).execute()
    if existing.data:
        raise ValueError("An account with this email already exists.")

    username = _unique_username(first_name, last_name, dob)

    insert = supabase.table("users").insert({
        "email": email,
        "password_hash": hash_password(password),
        "first_name": first_name,
        "last_name": last_name,
        "dob": dob.isoformat(),
        "username": username,
    }).execute()

    user = insert.data[0]
    user["dashboard_token"] = await database.get_or_create_dashboard_token(user["id"])
    return user
