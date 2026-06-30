from backend.services.sanitizer import sanitize, is_url

def route_payload(payload_type: str, raw_content: str) -> dict:
    """
    Decides processing path based on payload type.
    Returns a dict with route info and cleaned content.
    """
    cleaned = sanitize(raw_content)

    if payload_type == "voice":
        return {
            "route": "voice",
            "cleaned_content": cleaned,
            "needs_transcription": True,
        }

    if payload_type == "url" or is_url(cleaned):
        return {
            "route": "link",
            "cleaned_content": cleaned,
            "needs_extraction": True,
        }

    return {
        "route": "text",
        "cleaned_content": cleaned,
        "needs_extraction": False,
    }