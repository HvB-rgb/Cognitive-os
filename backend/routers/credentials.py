from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Depends
from backend.dependencies import get_current_user
from backend.services import database
from backend.services.crypto import encrypt_secret, decrypt_secret
from backend.services.combination_generator import generate_combination
from backend.models.schemas import (
    CombinationPreviewRequest,
    CombinationPreviewResponse,
    WebsiteCredentialCreate,
    WebsiteCredentialUpdate,
    WebsiteCredentialResponse,
    WebsiteCredentialRevealResponse,
)

router = APIRouter(prefix="/api/dashboard/credentials", tags=["credentials"])

PASSWORD_MASK = "••••••••"


# ── Helpers ──────────────────────────────────────────────────────────────────

def _resolve_combination(payload: WebsiteCredentialCreate | WebsiteCredentialUpdate) -> str | None:
    """Uses an explicit combination if given, otherwise generates one from
    the supplied rule inputs. Returns None if neither was provided."""
    if payload.combination:
        return payload.combination
    if not payload.combination_rules:
        return None
    try:
        return generate_combination(
            rules=payload.combination_rules,
            names=payload.names,
            symbol=payload.symbol,
            birth_date=payload.birth_date,
            birth_date_parts=payload.birth_date_parts,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


def _to_response(row: dict) -> WebsiteCredentialResponse:
    return WebsiteCredentialResponse(
        id=row["id"],
        site_name=row["site_name"],
        email=row["email"],
        password_masked=PASSWORD_MASK,
        combination=row.get("combination") or "",
        created_at=row["created_at"],
        updated_at=row["updated_at"],
    )


# ── Endpoints ────────────────────────────────────────────────────────────────

@router.post("/preview-combination", response_model=CombinationPreviewResponse)
async def preview_combination(
    payload: CombinationPreviewRequest, user: dict = Depends(get_current_user)
):
    """Generates a combination string without saving anything — lets the
    dashboard show a live preview as the user toggles rules."""
    try:
        combination = generate_combination(
            rules=payload.rules,
            names=payload.names,
            symbol=payload.symbol,
            birth_date=payload.birth_date,
            birth_date_parts=payload.birth_date_parts,
        )
        return CombinationPreviewResponse(combination=combination)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("", response_model=WebsiteCredentialResponse)
async def create_credential(
    payload: WebsiteCredentialCreate, user: dict = Depends(get_current_user)
):
    combination = _resolve_combination(payload)
    row = await database.create_website_credential(
        user_id=user["id"],
        site_name=payload.site_name,
        email=payload.email,
        password_encrypted=encrypt_secret(payload.password),
        combination=combination or "",
    )
    if not row:
        raise HTTPException(status_code=500, detail="Failed to save credential.")
    return _to_response(row)


@router.get("", response_model=list[WebsiteCredentialResponse])
async def list_credentials(user: dict = Depends(get_current_user)):
    rows = await database.get_website_credentials(user["id"])
    return [_to_response(r) for r in rows]


@router.get("/{credential_id}/reveal", response_model=WebsiteCredentialRevealResponse)
async def reveal_credential(credential_id: str, user: dict = Depends(get_current_user)):
    """Explicit action to decrypt and return the plaintext password."""
    row = await database.get_website_credential(user["id"], credential_id)
    if not row:
        raise HTTPException(status_code=404, detail="Credential not found.")
    try:
        password = decrypt_secret(row["password_encrypted"])
    except Exception:
        raise HTTPException(status_code=500, detail="Failed to decrypt password.")
    return WebsiteCredentialRevealResponse(id=row["id"], password=password)


@router.patch("/{credential_id}", response_model=WebsiteCredentialResponse)
async def update_credential(
    credential_id: str, payload: WebsiteCredentialUpdate, user: dict = Depends(get_current_user)
):
    existing = await database.get_website_credential(user["id"], credential_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Credential not found.")

    updates: dict = {}
    if payload.site_name is not None:
        updates["site_name"] = payload.site_name
    if payload.email is not None:
        updates["email"] = payload.email
    if payload.password is not None:
        updates["password_encrypted"] = encrypt_secret(payload.password)

    combination = _resolve_combination(payload)
    if combination is not None:
        updates["combination"] = combination

    if not updates:
        return _to_response(existing)

    updates["updated_at"] = datetime.now(timezone.utc).isoformat()

    row = await database.update_website_credential(user["id"], credential_id, updates)
    if not row:
        raise HTTPException(status_code=500, detail="Failed to update credential.")
    return _to_response(row)


@router.delete("/{credential_id}")
async def delete_credential(credential_id: str, user: dict = Depends(get_current_user)):
    existing = await database.get_website_credential(user["id"], credential_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Credential not found.")
    ok = await database.delete_website_credential(user["id"], credential_id)
    if not ok:
        raise HTTPException(status_code=500, detail="Failed to delete credential.")
    return {"status": "deleted", "id": credential_id}
