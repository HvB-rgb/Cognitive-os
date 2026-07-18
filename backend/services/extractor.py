import asyncio
import httpx
import re

async def extract_url(url: str) -> str:
    """
    Routes to YouTube, Instagram, or article extractor based on URL.
    """
    if _is_youtube(url):
        return await _extract_youtube(url)
    if _is_instagram(url):
        return await _extract_instagram(url)
    return await _extract_article(url)


def _is_youtube(url: str) -> bool:
    return any(domain in url for domain in [
        "youtube.com/watch",
        "youtu.be/",
        "youtube.com/shorts",
    ])


def _is_instagram(url: str) -> bool:
    return any(domain in url for domain in [
        "instagram.com/reel/",
        "instagram.com/reels/",
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


N_FRAMES = 3


async def _extract_instagram(url: str) -> str:
    """
    Extract caption + engagement + visual/audio content from an Instagram
    Reel. Caption/engagement come from yt-dlp metadata; frames are sampled
    evenly across the clip and described via Groq vision; the audio track
    is transcribed via the existing Groq Whisper transcriber. Frame/audio
    enrichment can fail independently without failing the whole
    extraction — the caption alone is still useful content.
    """
    try:
        import yt_dlp
        ydl_opts = {
            "quiet": True,
            "skip_download": True,
            "extract_flat": False,
        }
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=False)
    except Exception as e:
        print(f"[Extractor] Instagram extraction failed: {e}")
        return f"Instagram reel: {url}"

    uploader = info.get("uploader", "")
    description = info.get("description", "")[:2000]
    likes = info.get("like_count", 0)
    comments = info.get("comment_count", 0)

    video_url, audio_url = _pick_dash_urls(info.get("formats", []))

    frame_descriptions, transcript = await asyncio.gather(
        _describe_frames(video_url),
        _transcribe_reel_audio(audio_url),
    )

    sections = [
        f"Instagram Reel by {uploader}",
        f"Likes: {likes} | Comments: {comments}",
        "",
        "Caption:",
        description or "(none)",
    ]
    if frame_descriptions:
        sections += ["", "Visual content:"] + [f"- {d}" for d in frame_descriptions]
    if transcript:
        sections += ["", "Spoken audio:", transcript]

    return "\n".join(sections).strip()[:4000]


def _pick_dash_urls(formats: list[dict]) -> tuple[str | None, str | None]:
    """Picks the lowest-bitrate video-only and audio-only DASH streams —
    enough resolution for frame description, minimal bandwidth."""
    video_fmts = [f for f in formats if f.get("vcodec") not in (None, "none") and f.get("url")]
    audio_fmts = [f for f in formats if f.get("acodec") not in (None, "none") and f.get("url")]
    video_fmts.sort(key=lambda f: f.get("tbr") or 0)
    audio_fmts.sort(key=lambda f: f.get("tbr") or 0)
    video_url = video_fmts[0]["url"] if video_fmts else None
    audio_url = audio_fmts[0]["url"] if audio_fmts else None
    return video_url, audio_url


async def _describe_frames(video_url: str | None, n_frames: int = N_FRAMES) -> list[str]:
    if not video_url:
        return []

    import tempfile
    import os
    from backend.services.vision import analyze_image

    try:
        proc = await asyncio.create_subprocess_exec(
            "ffprobe", "-v", "error", "-show_entries", "format=duration",
            "-of", "csv=p=0", video_url,
            stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.DEVNULL,
        )
        stdout, _ = await asyncio.wait_for(proc.communicate(), timeout=20)
        duration = float(stdout.decode().strip())
    except Exception as e:
        print(f"[Extractor] ffprobe failed: {e}")
        return []

    if duration <= 0:
        return []

    fps = n_frames / duration

    with tempfile.TemporaryDirectory() as tmpdir:
        out_pattern = os.path.join(tmpdir, "frame_%d.jpg")
        try:
            proc = await asyncio.create_subprocess_exec(
                "ffmpeg", "-y", "-i", video_url, "-vf", f"fps={fps}",
                "-frames:v", str(n_frames), "-q:v", "4", out_pattern,
                stdout=asyncio.subprocess.DEVNULL, stderr=asyncio.subprocess.DEVNULL,
            )
            await asyncio.wait_for(proc.communicate(), timeout=30)
        except Exception as e:
            print(f"[Extractor] ffmpeg frame extraction failed: {e}")
            return []

        descriptions = []
        for i in range(1, n_frames + 1):
            frame_path = os.path.join(tmpdir, f"frame_{i}.jpg")
            if not os.path.exists(frame_path):
                continue
            with open(frame_path, "rb") as f:
                frame_bytes = f.read()
            desc = await analyze_image(frame_bytes)
            if desc:
                descriptions.append(desc)

        return descriptions


async def _transcribe_reel_audio(audio_url: str | None) -> str:
    if not audio_url:
        return ""

    try:
        async with httpx.AsyncClient(timeout=20.0, headers={"User-Agent": "Mozilla/5.0"}) as client:
            response = await client.get(audio_url, follow_redirects=True)
            response.raise_for_status()
    except Exception as e:
        print(f"[Extractor] Reel audio download failed: {e}")
        return ""

    from backend.services.transcriber import transcribe_audio
    return await transcribe_audio(response.content)


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