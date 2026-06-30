async def transcribe_audio(audio_bytes: bytes) -> str:
    """
    Transcribes audio using Groq Whisper (free).
    Falls back to local faster-whisper if Groq fails.
    """
    return await _transcribe_groq(audio_bytes)


async def _transcribe_groq(audio_bytes: bytes) -> str:
    try:
        from groq import AsyncGroq
        from backend.config import get_settings
        import tempfile, os

        settings = get_settings()
        if not settings.groq_api_key:
            return await _transcribe_local(audio_bytes)

        client = AsyncGroq(api_key=settings.groq_api_key)

        with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False) as f:
            f.write(audio_bytes)
            tmp_path = f.name

        with open(tmp_path, "rb") as audio_file:
            transcription = await client.audio.transcriptions.create(
                file=("audio.mp3", audio_file.read()),
                model="whisper-large-v3",
                response_format="text",
            )
        os.unlink(tmp_path)
        print(f"[Transcriber] Groq Whisper success")
        return transcription

    except Exception as e:
        print(f"[Transcriber] Groq Whisper failed: {e} — trying local")
        return await _transcribe_local(audio_bytes)


async def _transcribe_local(audio_bytes: bytes) -> str:
    try:
        from faster_whisper import WhisperModel
        import tempfile, os

        model = WhisperModel("tiny", device="cpu", compute_type="int8")

        with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False) as f:
            f.write(audio_bytes)
            tmp_path = f.name

        segments, _ = model.transcribe(tmp_path)
        text = " ".join(seg.text for seg in segments).strip()
        os.unlink(tmp_path)
        print(f"[Transcriber] Local Whisper success")
        return text

    except Exception as e:
        print(f"[Transcriber] Local also failed: {e}")
        return "[Transcription failed — please try again]"