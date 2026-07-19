from fastapi import APIRouter, HTTPException
from backend.models.schemas import SignupRequest, SignupResponse
from backend.services.user_auth import create_user_with_email

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/signup", response_model=SignupResponse)
async def signup(payload: SignupRequest):
    try:
        user = await create_user_with_email(
            email=payload.email,
            password=payload.password,
            first_name=payload.first_name,
            last_name=payload.last_name,
            dob=payload.dob,
        )
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))

    return SignupResponse(
        id=user["id"],
        username=user["username"],
        email=user["email"],
        dashboard_token=user["dashboard_token"],
    )
