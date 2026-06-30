import asyncio
import httpx
import time
from aiogram import Bot, Dispatcher, F
from aiogram.types import Message, Voice
from aiogram.filters import CommandStart, Command
from aiogram.fsm.storage.memory import MemoryStorage
from backend.config import get_settings
from backend.services import database
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from backend.services import digest as digest_service

scheduler = AsyncIOScheduler()
settings = get_settings()

bot = Bot(token=settings.telegram_bot_token)
dp = Dispatcher(storage=MemoryStorage())

API_BASE = settings.backend_url

# Session tracking — resets if the bot restarts
authenticated_sessions: dict[str, float] = {}
failed_attempts: dict[str, int] = {}
SESSION_TIMEOUT = 30 * 60  # 30 minutes

DASHBOARD_BASE_URL = f"{settings.backend_url}/dashboard"

def is_authenticated(user_id: str) -> bool:
    ts = authenticated_sessions.get(user_id)
    if ts is None:
        return False
    if time.time() - ts > SESSION_TIMEOUT:
        authenticated_sessions.pop(user_id, None)
        return False
    return True


# ── /setpin ───────────────────────────────────────────────────────────────────
@dp.message(Command("setpin"))
async def handle_setpin(message: Message):
    pin = message.text.removeprefix("/setpin").strip()
    if not pin.isdigit() or len(pin) != 4:
        await message.answer("Usage: /setpin 1234 — must be exactly 4 digits.")
        return

    user_id = str(message.from_user.id)
    user = await database.get_or_create_user(user_id)
    if not user:
        await message.answer("❌ Could not load your profile.")
        return

    success = await database.set_user_pin(user["id"], pin)
    if success:
        authenticated_sessions[user_id] = time.time()
        await message.answer("✅ PIN set. You're verified for this session.")
    else:
        await message.answer("❌ Could not set PIN. Try again.")


# ── /unlock ───────────────────────────────────────────────────────────────────
@dp.message(Command("unlock"))
async def handle_unlock(message: Message):
    pin = message.text.removeprefix("/unlock").strip()
    user_id = str(message.from_user.id)

    if failed_attempts.get(user_id, 0) >= 5:
        await message.answer("🔒 Too many attempts. Try again later or use /reset_link if locked out.")
        return

    user = await database.get_or_create_user(user_id)
    if not user:
        await message.answer("❌ Could not load your profile.")
        return

    if await database.verify_user_pin(user["id"], pin):
        authenticated_sessions[user_id] = time.time()
        failed_attempts.pop(user_id, None)
        await message.answer("✅ Unlocked for this session.")
    else:
        failed_attempts[user_id] = failed_attempts.get(user_id, 0) + 1
        await message.answer("❌ Incorrect PIN.")


# ── /dashboard ────────────────────────────────────────────────────────────────
@dp.message(Command("dashboard"))
async def handle_dashboard(message: Message):
    user_id = str(message.from_user.id)
    if not is_authenticated(user_id):
        await message.answer("🔒 Locked. Send /unlock <your PIN> first (or /setpin if you haven't set one).")
        return

    user = await database.get_or_create_user(user_id)
    if not user:
        await message.answer("❌ Could not load your profile.")
        return

    token = await database.get_or_create_dashboard_token(user["id"])
    if not token:
        await message.answer("❌ Could not generate your dashboard link. Try again.")
        return

    await message.answer(
        "🔗 *Your private dashboard token:*\n"
        f"`{token}`\n\n"
        "This is private — don't share it. If exposed, send /reset_link.",
        parse_mode="Markdown"
    )


# ── /reset_link ───────────────────────────────────────────────────────────────
@dp.message(Command("reset_link"))
async def handle_reset_link(message: Message):
    user_id = str(message.from_user.id)
    user = await database.get_or_create_user(user_id)
    if not user:
        await message.answer("❌ Could not load your profile.")
        return

    new_token = await database.reset_dashboard_token(user["id"])
    if not new_token:
        await message.answer("❌ Could not reset your link. Try again.")
        return

    await message.answer(
        f"🔄 Old token invalidated.\n\nNew token:\n`{new_token}`",
        parse_mode="Markdown"
    )
    

# ── /recall ───────────────────────────────────────────────────────────────────
@dp.message(Command("recall"))
async def handle_recall(message: Message):
    user_id = str(message.from_user.id)
    if not is_authenticated(user_id):
        await message.answer("🔒 Locked. Send /unlock <your PIN> first (or /setpin if you haven't set one).")
        return
    user = await database.get_or_create_user(user_id)
    if not user:
        await message.answer("📭 No entries found.")
        return

    from backend.services.supabase_client import supabase
    result = (
        supabase.table("cognitive_entries")
        .select("title, bucket, cognitive_mode, created_at")
        .eq("user_id", user["id"])
        .order("created_at", desc=True)
        .limit(5)
        .execute()
    )

    if not result.data:
        await message.answer("📭 No entries yet. Send me something to capture!")
        return

    lines = ["📚 *Your last 5 captures:*\n"]
    for i, entry in enumerate(result.data, 1):
        lines.append(
            f"{i}. *{entry['title']}*\n"
            f"   📁 {entry['bucket']} · 🧠 {entry['cognitive_mode']}\n"
        )

    await message.answer("\n".join(lines), parse_mode="Markdown")


# ── /find ─────────────────────────────────────────────────────────────────────
@dp.message(Command("find"))
async def handle_find(message: Message):
    query = message.text.removeprefix("/find").strip()

    if not query:
        await message.answer(
            "Usage: /find <your query>\n"
            "Example: /find transformer architecture"
        )
        return

    user_id = str(message.from_user.id)
    if not is_authenticated(user_id):
        await message.answer("🔒 Locked. Send /unlock <your PIN> first (or /setpin if you haven't set one).")
        return
    user = await database.get_or_create_user(user_id)
    if not user:
        await message.answer("❌ Could not load your profile.")
        return

    thinking = await message.answer("🔍 Searching your knowledge base...")

    from backend.services.search import find_relevant_items, groq_rerank

    candidates = find_relevant_items(
        internal_user_id=user["id"],
        query=query
    )

    if not candidates:
        await thinking.edit_text(
            "📭 Nothing matched that query.\n"
            "Try different keywords, or save more content first!"
        )
        return

    result = await groq_rerank(query=query, candidates=candidates)

    if not result:
        await thinking.edit_text("⚠️ Found items but couldn't rank them. Try again.")
        return

    await thinking.edit_text(
        f"🔍 *Results for:* {query}\n\n{result}",
        parse_mode="Markdown"
    )


# ── Weekly digest job ─────────────────────────────────────────────────────────
async def send_weekly_digests():
    print("[Digest] Running weekly digest job...")
    users = await database.get_all_users()
    for user in users:
        text = digest_service.generate_weekly_digest(user["id"])
        if not text:
            continue
        try:
            await bot.send_message(chat_id=int(user["phone_number"]), text=text, parse_mode="Markdown")
        except Exception as e:
            print(f"[Digest] Failed to send to {user['phone_number']}: {e}")


# ── /digest — manual trigger for testing/demo ───────────────────────────────
@dp.message(Command("digest"))
async def handle_digest(message: Message):
    user_id = str(message.from_user.id)
    if not is_authenticated(user_id):
        await message.answer("🔒 Locked. Send /unlock <your PIN> first (or /setpin if you haven't set one).")
        return
    user = await database.get_or_create_user(user_id)
    if not user:
        await message.answer("❌ Could not load your profile.")
        return

    text = digest_service.generate_weekly_digest(user["id"])
    if not text:
        await message.answer("📭 Nothing saved in the last 7 days yet.")
        return

    await message.answer(text, parse_mode="Markdown")

# ── /start ────────────────────────────────────────────────────────────────────
@dp.message(CommandStart())
async def handle_start(message: Message):
    name = message.from_user.first_name or "there"
    await message.answer(
        f"👋 Hey {name}! Cognitive is live.\n\n"
        f"Here's what you can send me:\n"
        f"• 💬 Any thought or text\n"
        f"• 🔗 A link or YouTube URL\n"
        f"• 🎙️ A voice note\n"
        f"• 🔍 Use /find <query> to search\n\n"
        f"I'll process it, extract the key ideas, and organize it for you."
    )


# ── /help ─────────────────────────────────────────────────────────────────────
@dp.message(Command("help"))
async def handle_help(message: Message):
    # 🌟 FIXED: Cleared the breaking trailing comma syntax error
    help_text = (
        "📖 *How to use Cognitive:*\n\n"
        "*Text/URL:* Just paste or type anything\n"
        "*Voice:* Send a voice note, I'll transcribe it\n\n"
        "Everything gets categorized into your personal knowledge buckets automatically.\n\n"
        "Commands:\n"
        "/start — Welcome message\n"
        "/help — This help directory\n"
        "/status — Check if the backend system is healthy\n"
        "/recall — See your last 5 captured ideas\n"
        "/find [query] — Search your knowledge base securely\n"
        "/setpin [pin] — Set a 4-digit PIN to secure your data\n"
        "/unlock [pin] — Unlock your session\n"
    )
    await message.answer(help_text, parse_mode="Markdown")


# ── /status ───────────────────────────────────────────────────────────────────
@dp.message(Command("status"))
async def handle_status(message: Message):
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(f"{API_BASE}/health", timeout=5.0)
        if response.status_code == 200:
            await message.answer("✅ All systems operational.")
        else:
            await message.answer("⚠️ API is reachable but returned an unexpected status.")
    except Exception:
        await message.answer("❌ Cannot reach the API. Is uvicorn running?")


# ── Text / URL messages ───────────────────────────────────────────────────────
@dp.message(F.text)
async def handle_text(message: Message):
    user_id = str(message.from_user.id)
    raw_content = message.text

    if raw_content.startswith("/"):
        return

    thinking = await message.answer("⏳ Processing your thought...")

    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{API_BASE}/api/process/text",
                json={
                    "user_id": user_id,
                    "payload_type": "url" if raw_content.startswith("http") else "text",
                    "raw_content": raw_content,
                },
                timeout=30.0,
            )
        response.raise_for_status()
        data = response.json()

        '''if data["status"] == "completed" and data["result"]:
            result = data["result"]
            key_points = "\n".join(f"  • {pt}" for pt in result["key_points"])
            await thinking.edit_text(
                f"✅ *{result['title']}*\n\n"
                f"📝 {result['summary']}\n\n"
                f"💡 *Key points:*\n{key_points}\n\n"
                f"📁 Bucket: `{result['suggested_bucket']}`\n"
                f"🧠 Mode: `{result['cognitive_mode']}`\n"
                f"⚡ Score: `{result['actionability_score']}`",
                parse_mode="Markdown"
            )'''
        if data["status"] == "completed" and data["result"]:
            result = data["result"]
            key_points = "\n".join(f"  • {pt}" for pt in result["key_points"])

            warning = ""
            if not data.get("persisted", True):
                warning = "\n\n⚠️ *Not saved* — database unreachable right now. This won't appear in /recall or /find."

            await thinking.edit_text(
                f"✅ *{result['title']}*\n\n"
                f"📝 {result['summary']}\n\n"
                f"💡 *Key points:*\n{key_points}\n\n"
                f"📁 Bucket: `{result['suggested_bucket']}`\n"
                f"🧠 Mode: `{result['cognitive_mode']}`\n"
                f"⚡ Score: `{result['actionability_score']}`"
                f"{warning}",
                parse_mode="Markdown"
            )
        else:
            await thinking.edit_text("⚠️ Processed but no result returned. Try again.")

    except httpx.TimeoutException:
        await thinking.edit_text("⏱️ Request timed out. The server might be busy.")
    except httpx.HTTPStatusError as e:
        await thinking.edit_text(f"❌ API error: {e.response.status_code}")
    except Exception as e:
        await thinking.edit_text(f"❌ Unexpected error: {str(e)}")


# ── Voice messages ────────────────────────────────────────────────────────────
@dp.message(F.voice)
async def handle_voice(message: Message):
    user_id = str(message.from_user.id)
    thinking = await message.answer("🎙️ Downloading your voice note...")

    try:
        voice: Voice = message.voice
        file = await bot.get_file(voice.file_id)
        file_bytes = await bot.download_file(file.file_path)

        await thinking.edit_text("⏳ Transcribing...")

        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{API_BASE}/api/process/voice",
                data={"user_id": user_id},
                files={"audio_file": ("voice.ogg", file_bytes, "audio/ogg")},
                timeout=60.0,
            )
        response.raise_for_status()
        data = response.json()

        if data["status"] == "completed" and data.get("result"):
            result = data["result"]
            key_points = "\n".join(f"  • {pt}" for pt in result["key_points"])
            await thinking.edit_text(
                f"✅ *{result['title']}*\n\n"
                f"📝 {result['summary']}\n\n"
                f"💡 *Key points:*\n{key_points}\n\n"
                f"📁 Bucket: `{result['suggested_bucket']}`\n"
                f"🧠 Mode: `{result['cognitive_mode']}`\n"
                f"⚡ Score: `{result['actionability_score']}`",
                parse_mode="Markdown"
            )
        else:
            await thinking.edit_text("⚠️ Voice processing returned unexpected status.")

    except httpx.TimeoutException:
        await thinking.edit_text("⏱️ Transcription timed out. Try a shorter voice note.")
    except Exception as e:
        await thinking.edit_text(f"❌ Error processing voice: {str(e)}")


# ── Audio files sent as documents (MP3, WAV, etc) ────────────────────────────
@dp.message(F.document)
async def handle_document(message: Message):
    user_id = str(message.from_user.id)
    doc = message.document

    audio_mimes = {"audio/mpeg", "audio/mp3", "audio/wav", "audio/ogg", "audio/webm", "audio/mp4", "audio/x-m4a"}
    if doc.mime_type not in audio_mimes:
        await message.answer(
            "⚠️ I can only process audio files right now.\n"
            "Supported: MP3, WAV, OGG\nComing soon: PDFs, images"
        )
        return

    thinking = await message.answer("🎙️ Downloading your audio file...")

    try:
        file = await bot.get_file(doc.file_id)
        file_bytes = await bot.download_file(file.file_path)
        await thinking.edit_text("⏳ Transcribing audio...")

        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{API_BASE}/api/process/voice",
                data={"user_id": user_id},
                files={"audio_file": (doc.file_name, file_bytes, doc.mime_type)},
                timeout=60.0,
            )
        response.raise_for_status()
        data = response.json()

        if data["status"] == "completed" and data.get("result"):
            result = data["result"]
            key_points = "\n".join(f"  • {pt}" for pt in result["key_points"])
            await thinking.edit_text(
                f"✅ *{result['title']}*\n\n"
                f"📝 {result['summary']}\n\n"
                f"💡 *Key points:*\n{key_points}\n\n"
                f"📁 Bucket: `{result['suggested_bucket']}`\n"
                f"🧠 Mode: `{result['cognitive_mode']}`\n"
                f"⚡ Score: `{result['actionability_score']}`",
                parse_mode="Markdown"
            )
        else:
            await thinking.edit_text("⚠️ Audio processed but no result returned.")

    except httpx.TimeoutException:
        await thinking.edit_text("⏱️ Transcription timed out. Try a shorter file.")
    except Exception as e:
        await thinking.edit_text(f"❌ Error: {str(e)}")


@dp.message(~F.text & ~F.voice & ~F.document)
async def handle_unsupported(message: Message):
    await message.answer(
        "⚠️ I can only process text, links, voice notes, and audio files.\n"
        "Photos and stickers coming soon!"
    )



# ── Entry point ───────────────────────────────────────────────────────────────
async def main():
    print(f"[Telegram Worker] Bot polling started seamlessly...")
    scheduler.add_job(send_weekly_digests, "cron", day_of_week="sun", hour=9, minute=0)
    scheduler.start()
    await dp.start_polling(bot, allowed_updates=dp.resolve_used_update_types())

if __name__ == "__main__":
    asyncio.run(main())