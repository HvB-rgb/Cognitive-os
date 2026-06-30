import httpx
import re

async def extract_url(url: str) -> str:
    """
    Routes to YouTube extractor or article extractor based on URL.
    """
    if _is_youtube(url):
        return await _extract_youtube(url)
    return await _extract_article(url)


def _is_youtube(url: str) -> bool:
    return any(domain in url for domain in [
        "youtube.com/watch",
        "youtu.be/",
        "youtube.com/shorts",
    ])


async def _extract_youtube(url: str) -> str:
    """Extract title + description from YouTube via yt-dlp."""
    try:
        import yt_dlp
        ydl_opts = {
            "quiet": True,
            "skip_download": True,
            "extract_flat": False,
        }
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=False)
            title = info.get("title", "")
            description = info.get("description", "")[:2000]
            channel = info.get("channel", "")
            duration = info.get("duration_string", "")

            content = f"""
Title: {title}
Channel: {channel}
Duration: {duration}

Description:
{description}
""".strip()

            return content[:4000]

    except Exception as e:
        print(f"[Extractor] YouTube extraction failed: {e}")
        return f"YouTube video: {url}"


async def _extract_article(url: str) -> str:
    """Extract clean text from a web article."""
    try:
        from readability import Document
        async with httpx.AsyncClient(
            timeout=15.0,
            headers={"User-Agent": "Mozilla/5.0"}
        ) as client:
            response = await client.get(url, follow_redirects=True)
            response.raise_for_status()

        doc = Document(response.text)
        clean = re.sub(r'<[^>]+>', ' ', doc.summary())
        clean = re.sub(r'\s+', ' ', clean).strip()
        return clean[:4000]

    except Exception as e:
        print(f"[Extractor] Article extraction failed: {e}")
        return url