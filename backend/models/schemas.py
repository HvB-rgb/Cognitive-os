from pydantic import BaseModel, field_validator
from typing import Literal, Optional

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