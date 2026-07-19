from fastapi import APIRouter, HTTPException
from backend.models.schemas import SignupRequest, SignupResponse, LoginRequest, LoginResponse
from backend.services.user_auth import create_user_with_email, login_with_username

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


@router.post("/login", response_model=LoginResponse)
async def login(payload: LoginRequest):
    try:
        user = await login_with_username(payload.username.strip())
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))

    if not user:
        raise HTTPException(status_code=404, detail="No account with that ID. Check the ID and try again.")

    return LoginResponse(
        id=user["id"],
        username=user["username"],
        first_name=user.get("first_name") or "",
        dashboard_token=user["dashboard_token"],
    )
