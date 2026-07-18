import base64

DEFAULT_PROMPT = (
    "Describe what's in this image in 1-3 sentences. If it contains readable "
    "text (a screenshot, a slide, an on-screen caption), transcribe the text "
    "verbatim instead of describing the layout."
)


async def analyze_image(image_bytes: bytes, prompt: str = DEFAULT_PROMPT) -> str:
    """
    Describes an image (or reads any text in it) using Groq vision.
    Returns "" on failure so callers can skip it without crashing the pipeline.
    """
    try:
        from groq import AsyncGroq
        from backend.config import get_settings

        settings = get_settings()
        if not settings.groq_api_key:
            return ""

        client = AsyncGroq(api_key=settings.groq_api_key)
        b64_image = base64.b64encode(image_bytes).decode("utf-8")

        response = await client.chat.completions.create(
            model="meta-llama/llama-4-scout-17b-16e-instruct",
            messages=[{
                "role": "user",
                "content": [
                    {"type": "text", "text": prompt},
                    {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{b64_image}"}},
                ],
            }],
            temperature=0.3,
            max_tokens=300,
        )
        return response.choices[0].message.content.strip()

    except Exception as e:
        print(f"[Vision] Image analysis failed: {e}")
        return ""
