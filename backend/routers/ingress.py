from fastapi import APIRouter, HTTPException, UploadFile, File, Form, Depends
from backend.models.schemas import IngestTextRequest, IngestResponse
from backend.config import get_settings, Settings
from backend.dependencies import get_current_user
from backend.services.media_router import route_payload
from backend.services.extractor import extract_url
from backend.services.ai_engine import process_with_ai
from backend.services.bucket_logic import apply_bucket_guardrail
from backend.services import database
import traceback

router = APIRouter(prefix="/api/process", tags=["ingestion"])


@router.post("/text", response_model=IngestResponse)
async def process_text(
    payload: IngestTextRequest,
    current_user: dict = Depends(get_current_user),
    settings: Settings = Depends(get_settings),
):
    try:
        # The signed-in user is resolved from the X-Dashboard-Token header,
        # NOT the user_id in the body — otherwise any client could write into
        # someone else's account by sending their id. payload.user_id is
        # ignored (kept in the schema only for backward compatibility).
        db_user_id = current_user["id"]
        routed = route_payload(payload.payload_type, payload.raw_content)
        content = routed["cleaned_content"]
        source_url = content if routed["route"] == "link" else None

        # Step 3 — Extract if URL
        if routed.get("needs_extraction"):
            content = await extract_url(content)

        # Step 4 — Fetch real buckets from DB
        # Step 4 — Fetch real buckets from DB
        existing_buckets = []
        if db_user_id:
            try:
                existing_buckets = await database.get_user_buckets(db_user_id)
            except Exception as db_err:
                print(f"[Ingress Dynamic Warning] Supabase connection unreachable: {db_err}")

        # 🌟 THE DYNAMIC SAFETY BRIDGE
        # If your local connection drops out completely, seed core categories 
        # so your local ML classifier and Groq aren't forced to run completely blind!
        if not existing_buckets:
            existing_buckets = ["Business", "Finance", "Technology", "Health", "Learning", "Travel", "Entertainment", "Sports", "Reflect", "Ideas"]

        # Step 5 — AI processing
        result = await process_with_ai(content, existing_buckets, user_id=db_user_id)

        # Step 6 — Bucket guardrail
        result = apply_bucket_guardrail(result, existing_buckets)

        # Step 7 — Save to DB
        entry_id = None
        if db_user_id:
            await database.get_or_create_bucket(db_user_id, result.suggested_bucket)
            entry_id = await database.save_entry(
                user_id=db_user_id,
                input_type=routed["route"],
                original_input=payload.raw_content,
                cleaned_text=content,
                result=result,
                source_url=source_url,
            )
            await database.increment_bucket_count(db_user_id, result.suggested_bucket)

        return IngestResponse(
            entry_id=entry_id,
            status="completed",
            result=result,
            persisted=bool(entry_id),   # ← False if it was never actually saved
        )

    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/voice", response_model=IngestResponse)
async def process_voice(
    audio_file: UploadFile = File(...),
    user_id: str = Form(None),
    current_user: dict = Depends(get_current_user),
    settings: Settings = Depends(get_settings),
):
    allowed_types = {"audio/ogg", "audio/mpeg", "audio/mp3", "audio/wav", "audio/webm", "audio/mp4", "audio/x-m4a"}
    if audio_file.content_type not in allowed_types:
        raise HTTPException(status_code=415, detail=f"Unsupported audio type: {audio_file.content_type}")

    audio_bytes = await audio_file.read()
    if len(audio_bytes) > 25 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Audio exceeds 25MB limit.")

    try:
        from backend.services.transcriber import transcribe_audio

        # Owner comes from the token, not the form field (see /text above).
        db_user_id = current_user["id"]

        transcript = await transcribe_audio(audio_bytes)
        existing_buckets = await database.get_user_buckets(db_user_id) if db_user_id else []
        result = await process_with_ai(transcript, existing_buckets, user_id=db_user_id)
        result = apply_bucket_guardrail(result, existing_buckets)

        entry_id = None
        if db_user_id:
            await database.get_or_create_bucket(db_user_id, result.suggested_bucket)
            entry_id = await database.save_entry(
                user_id=db_user_id,
                input_type="voice",
                original_input=transcript,
                cleaned_text=transcript,
                result=result,
            )
            await database.increment_bucket_count(db_user_id, result.suggested_bucket)

        return IngestResponse(entry_id=entry_id, status="completed", result=result)

    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))
    
'''from fastapi import APIRouter, HTTPException, UploadFile, File, Form, Depends
from backend.models.schemas import IngestTextRequest, IngestResponse, AIProcessingResult
from backend.config import get_settings, Settings

router = APIRouter(prefix="/api/process", tags=["ingestion"])

@router.post("/text", response_model=IngestResponse)
async def process_text(
    payload: IngestTextRequest,
    settings: Settings = Depends(get_settings),
):
    try:
        return IngestResponse(
            status="completed",
            result=AIProcessingResult(
                title=f"[MOCK] {payload.raw_content[:40]}",
                summary="Gateway live. AI engine not yet wired.",
                key_points=["Gateway operational", "Awaiting AI engine"],
                cognitive_mode="learn",
                actionability_score=0.5,
                suggested_bucket="Inbox",
            )
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/voice", response_model=IngestResponse)
async def process_voice(
    user_id: str = Form(...),
    audio_file: UploadFile = File(...),
    settings: Settings = Depends(get_settings),
):
    allowed_types = {"audio/ogg", "audio/mpeg", "audio/wav", "audio/webm"}
    if audio_file.content_type not in allowed_types:
        raise HTTPException(status_code=415, detail=f"Unsupported audio type: {audio_file.content_type}")

    audio_bytes = await audio_file.read()
    if len(audio_bytes) > 25 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Audio exceeds 25MB limit.")

    return IngestResponse(status="pending")
'''