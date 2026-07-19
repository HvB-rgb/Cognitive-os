from pydantic import BaseModel, field_validator
from typing import Literal, Optional
from datetime import date

class IngestTextRequest(BaseModel):
    user_id: str
    payload_type: Literal["text", "url"]
    raw_content: str

    @field_validator("raw_content")
    @classmethod
    def must_not_be_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Content cannot be empty.")
        return v[:4000]

class AIProcessingResult(BaseModel):
    title: str
    summary: str
    key_points: list[str]
    cognitive_mode: Literal["learn", "think", "reflect"]
    actionability_score: float
    suggested_bucket: str

class IngestResponse(BaseModel):
    entry_id: Optional[str] = None
    status: Literal["completed", "pending", "failed"]
    result: Optional[AIProcessingResult] = None
    error: Optional[str] = None
    persisted: bool = True   # ← add this


# ── Website Credentials ─────────────────────────────────────────────────────

CombinationRule = Literal["initials", "symbol", "birthdate"]
BirthDatePart = Literal["day", "month", "year"]


class CombinationPreviewRequest(BaseModel):
    rules: list[CombinationRule]
    names: Optional[list[str]] = None
    symbol: Optional[str] = None
    birth_date: Optional[date] = None
    birth_date_parts: Optional[list[BirthDatePart]] = None


class CombinationPreviewResponse(BaseModel):
    combination: str


class WebsiteCredentialCreate(BaseModel):
    site_name: str
    email: str
    password: str

    # Either pass a pre-generated combination directly, or supply the
    # generation inputs below and let the server build it. Raw inputs
    # (names/symbol/birth_date) are used only to compute the string and
    # are not persisted.
    combination: Optional[str] = None
    combination_rules: Optional[list[CombinationRule]] = None
    names: Optional[list[str]] = None
    symbol: Optional[str] = None
    birth_date: Optional[date] = None
    birth_date_parts: Optional[list[BirthDatePart]] = None


class WebsiteCredentialUpdate(BaseModel):
    site_name: Optional[str] = None
    email: Optional[str] = None
    password: Optional[str] = None

    combination: Optional[str] = None
    combination_rules: Optional[list[CombinationRule]] = None
    names: Optional[list[str]] = None
    symbol: Optional[str] = None
    birth_date: Optional[date] = None
    birth_date_parts: Optional[list[BirthDatePart]] = None


class WebsiteCredentialResponse(BaseModel):
    id: str
    site_name: str
    email: str
    password_masked: str
    combination: str
    created_at: str
    updated_at: str


class WebsiteCredentialRevealResponse(BaseModel):
    id: str
    password: str


# ── Email/password signup ────────────────────────────────────────────────────

class SignupRequest(BaseModel):
    email: str
    password: str
    first_name: str
    last_name: str
    dob: date

    @field_validator("password")
    @classmethod
    def password_min_length(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters.")
        return v

    @field_validator("email")
    @classmethod
    def email_not_empty(cls, v: str) -> str:
        v = v.strip().lower()
        if "@" not in v:
            raise ValueError("Enter a valid email address.")
        return v


class SignupResponse(BaseModel):
    id: str
    username: str
    email: str
    dashboard_token: str


class LoginRequest(BaseModel):
    username: str


class LoginResponse(BaseModel):
    id: str
    username: str
    first_name: str
    dashboard_token: str