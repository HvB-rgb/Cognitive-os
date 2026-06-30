import json
import re
from difflib import SequenceMatcher
from backend.config import get_settings
from backend.models.schemas import AIProcessingResult
from backend.services.local_classifier import classifier
from backend.services.supabase_client import supabase

async def process_with_ai(
    content: str,
    existing_buckets: list[str],
    user_id: str = None,
) -> AIProcessingResult:
    """
    Confidence-gated ensemble:
    1. Try local ML classifier first
    2. If confident → use ML result (free, instant)
    3. If not confident → use Groq
    4. Compare results, log disagreements as training signals
    """
    settings = get_settings()

    # ── Layer 1: Local ML classifier ─────────────────────────────────────────
    ml_bucket, ml_confidence = classifier.predict(content)
    
    if ml_bucket and ml_confidence >= 0.85 and ml_bucket in existing_buckets:
        print(f"[AI Engine] ML confident ({ml_confidence:.2f}) → {ml_bucket} — Groq skipped")
        result = _build_ml_result(content, ml_bucket)
        validated = _validate_and_fix_result(result, content, existing_buckets)
        
        # Check if retraining needed
        if user_id:
            await _check_retrain(user_id)
        
        return validated

    # ── Layer 2: Groq ─────────────────────────────────────────────────────────
    if settings.groq_api_key:
        result = await _process_groq(content, existing_buckets)
    elif settings.openai_api_key:
        result = await _process_openai(content, existing_buckets)
    else:
        result = _process_mock(content, existing_buckets)

    validated = _validate_and_fix_result(result, content, existing_buckets)

    # ── Layer 3: Compare ML vs AI, log disagreements ──────────────────────────
    if ml_bucket and ml_bucket != validated.suggested_bucket and user_id:
        from backend.services.ml_trainer import log_disagreement
        await log_disagreement(
            user_id=user_id,
            content=content,
            ml_bucket=ml_bucket,
            ml_confidence=ml_confidence,
            ai_bucket=validated.suggested_bucket,
        )

    # ── Layer 4: Check if retraining needed ───────────────────────────────────
    if user_id:
        await _check_retrain(user_id)

    return validated


def _build_ml_result(content: str, bucket: str) -> AIProcessingResult:
    """Builds a result using local ML prediction — no API call."""
    import re
    sentences = re.split(r'(?<=[.!?])\s+', content.strip())
    words = content.split()
    title_words = [w for w in words if len(w) > 4][:6]

    return AIProcessingResult(
        title=" ".join(title_words).capitalize() or "Captured thought",
        summary=content[:200],
        key_points=[s.strip() for s in sentences[:3] if len(s.strip()) > 10] or ["Content captured"],
        cognitive_mode="learn",
        actionability_score=0.3,
        suggested_bucket=bucket,
    )


async def _check_retrain(user_id: str):
    """Triggers retraining every 20 new entries."""
    if not supabase:
        return
    try:
        result = (
            supabase.table("cognitive_entries")
            .select("id", count="exact")
            .eq("user_id", user_id)
            .eq("processing_status", "completed")
            .execute()
        )
        count = result.count or 0
        if count > 0 and count % 20 == 0:
            print(f"[AI Engine] {count} entries — triggering retraining")
            from backend.services.ml_trainer import retrain_from_supabase
            train_result = await retrain_from_supabase(user_id)
            print(f"[AI Engine] Retraining result: {train_result}")
    except Exception as e:
        print(f"[AI Engine] Retrain check failed: {e}")


def _build_prompt(content: str, existing_buckets: list[str]) -> str:

    bucket_section = f"""
EXISTING BUCKETS — reuse these first:
{chr(10).join(f'  - {b}' for b in existing_buckets) if existing_buckets else '  None yet — create the first one'}

BUCKET MATCHING RULES:
- Always reuse an existing bucket if the content fits even loosely
- Only create a new bucket if content is completely unrelated to ALL existing ones
- New bucket names: 1-2 words, title case only
""" if existing_buckets else "No buckets yet — create a short specific name (1-2 words, title case)."

    return f"""
You are a precise personal knowledge organiser. Analyse the content and return ONLY valid JSON.

{bucket_section}

BUCKET DEFINITIONS — Use these exact Title Case names when creating or matching:
- "Business"        = startups, entrepreneurship, pricing, marketing, customers, sales, growth, hiring, fundraising, business models.
- "Finance"         = investing, savings, budgets, stocks, gold, portfolio, crypto, tax planning, insurance, money management, banking.
- "Technology"      = software engineering, coding, dev tools, APIs, AI models, LLMs, infrastructure, machine learning, databases.
- "Electronics"     = smartphones, consumer gadgets, laptops, hardware specs, PC builds, smart home devices, cameras, unboxing/hardware reviews.
- "Shopping"        = product links, e-commerce, discount codes, amazon lists, price comparisons, purchase intent, user reviews, buying guides.
- "Lifestyle"       = makeup, skincare, fashion, clothing outfits, grooming, home decor, routines, fragrances, design aesthetics.
- "Health"          = fitness, sleep, diet, mental health, medical info, exercise, gym, energy, wellness, supplements, nutrition.
- "Career"          = job hunting, resumes, interview prep, office politics, promotions, freelancing, networking, professional growth.
- "Learning"        = books, online courses, academic concepts, skills frameworks, education, study techniques, history, philosophy, science.
- "Travel"          = destinations, trips, itineraries, travel documents/visas, tourism planning, transport, hotels, flights.
- "Food"            = cuisine, recipes, dishes, restaurants, food preferences, cooking tutorials, ingredients, baking, meal prep.
- "Sports"          = matches, players, teams, leagues, scores, tournaments, athletic events, fantasy sports, sports news.
- "Entertainment"   = music videos, streaming shows, movies, viral memes, celebrity gossip, pop culture, standup comedy, anime.
- "Reflect"         = personal journals, dreams, notes to self, processing feelings, emotions, self-awareness, therapy reflections.
- "Ideas"           = creative concepts, hypotheticals, app ideas, thought experiments, innovations, rough brainstorms, inventions.
- "Admin"           = verification codes, dynamic OTPs, transient passwords, random clipboard dumps, digital noise to purge.

CRITICAL CLASSIFICATION BOUNDARY RULES:
1. FINANCE vs. BUSINESS:
   - Gold, stocks, portfolio setups, savings tracking, crypto, and tax plans → ALWAYS "Finance".
   - B2B strategies, VC pitching, pricing models, SaaS growth strategies, or hiring team members → ALWAYS "Business".

2. TECHNOLOGY vs. ELECTRONICS:
   - Coding, software frameworks, API docs, GPT/Claude model prompting, Git, hosting, and algorithms → ALWAYS "Technology".
   - Physical smartphones, mechanical keyboards, graphics cards, camera lenses, and smart home hardware → ALWAYS "Electronics".

3. SHOPPING vs. ELECTRONICS vs. LIFESTYLE:
   - If a link or note is focused purely on buying an item, comparing e-commerce prices, or an Amazon wishlist → ALWAYS "Shopping".
   - If it's a breakdown of the technical specs, performance benching, or hardware flaws of a phone/gadget → ALWAYS "Electronics".
   - If it focuses on the beauty application, outfit styling, skincare routine steps, or garment design → ALWAYS "Lifestyle".

4. FOOD vs. TRAVEL vs. ENTERTAINMENT:
   - Recipes, restaurant reviews, cooking ingredients, and home meal plans → ALWAYS "Food".
   - Food content ONLY belongs in "Travel" if it is explicitly framed as a travel itinerary detail or destination food tourism.
   - Mukbangs, viral food stunts, or celebrity chef entertainment clips without explicit recipes/locations → ALWAYS "Entertainment".

5. LEARNING vs. CAREER vs. REFLECT:
   - Theoretical concepts, reading notes from non-fiction books, history, or learning a framework → ALWAYS "Learning".
   - Resumes, optimizing LinkedIn profiles, negotiation tactics, or job interview practice prompts → ALWAYS "Career".
   - Late-night thoughts, dream logs, emotional updates, or venting about personal energy/feelings → ALWAYS "Reflect".

6. SPORTS vs. ENTERTAINMENT vs. HEALTH:
   - Professional matches, league scores, athletic training plans, and athlete stats → ALWAYS "Sports".
   - A personal gym routine, individual fitness goal, or workout log with no named athlete/team/league context → ALWAYS "Health".
   - Movie trailers, Netflix series releases, pop music tracks, and internet viral memes → ALWAYS "Entertainment".

7. EMERGENCY ADMINISTRATIVE RULE:
   - If the input text contains only a two-factor verification code, copy-pasted OTP string, or a corrupted chunk of system log noise → ALWAYS classify as "Admin".

8. IDEAS vs. BUSINESS:
   - A standalone creative concept, app idea, or hypothetical with no concrete execution plan → ALWAYS "Ideas".
   - The same concept once framed with a business model, pricing, target customers, or go-to-market angle → ALWAYS "Business".

9. HEALTH vs. LIFESTYLE:
   - Physical/mental wellness, medical-adjacent routines, supplements, or fitness tracking → ALWAYS "Health".
   - Beauty application, skincare/grooming product routines, or aesthetic/style outcomes → ALWAYS "Lifestyle".

   - NEVER use generic words like "General" or "Miscellaneous" — map strictly into the closest, most high-signal target bucket above.
   
CONTENT TO ANALYSE:
{content}

COGNITIVE MODE — pick exactly one:
- "learn"   = facts, news, research, tutorials, how things work, educational content
- "think"   = opinions, analysis, comparisons, predictions, strategies, arguments
- "reflect" = personal feelings, journal entries, dreams, notes to self, self-awareness

ACTIONABILITY SCORE — pick the most accurate value:
- 0.1 = pure fact, nothing to do ("Earth orbits sun in 365 days")
- 0.2 = worth knowing, no action needed ("Sleep improves memory")
- 0.4 = worth revisiting or sharing ("Index funds beat 90% of managed funds")
- 0.6 = specific recommendation worth acting on ("Exercise 3x week, allocate 40% to savings")
- 0.8 = clear task or follow-up needed ("Apply for grant, follow up with someone")
- 0.9 = urgent action required ("Deadline today, server down")

SCORE CALIBRATION:
- Specific numbers, frequencies, ratios → 0.6 minimum
- Named person to follow up with → 0.8 minimum  
- Pure observation or comparison → 0.2 to 0.3
- Personal journal or dream → 0.1 to 0.2
- Entertainment content → 0.1

Return ONLY this exact JSON, no markdown, no explanation, no extra text:
{{
  "title": "max 8 words, specific not vague",
  "summary": "2-3 sentences extracting the actual insight",
  "key_points": ["specific point 1", "specific point 2", "specific point 3"],
  "cognitive_mode": "learn" or "think" or "reflect",
  "actionability_score": 0.1 to 0.9,
  "suggested_bucket": "exact bucket name"
}}
"""

async def _process_groq(content: str, existing_buckets: list[str]) -> AIProcessingResult:
    """Primary AI — Groq (free tier, very fast)"""
    settings = get_settings()
    try:
        from groq import AsyncGroq
        client = AsyncGroq(api_key=settings.groq_api_key)

        response = await client.chat.completions.create(
            model="openai/gpt-oss-20b",   # was "llama-3.1-8b-instant"
            messages=[{"role": "user", "content": _build_prompt(content, existing_buckets)}],
            temperature=0.3,
            max_tokens=500,
            reasoning_effort="low",
        )
        raw = response.choices[0].message.content
        data = json.loads(raw)
        return AIProcessingResult(**data)

    except Exception as e:
        print(f"[AI Engine] Groq failed: {e} — falling back to mock")
        return _process_mock(content, existing_buckets)

async def _process_openai(content: str, existing_buckets: list[str]) -> AIProcessingResult:
    """Fallback AI — OpenAI GPT-4o-mini"""
    settings = get_settings()
    try:
        from openai import AsyncOpenAI
        client = AsyncOpenAI(api_key=settings.openai_api_key)

        response = await client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": _build_prompt(content, existing_buckets)}],
            response_format={"type": "json_object"},
            temperature=0.3,
        )
        raw = response.choices[0].message.content
        data = json.loads(raw)
        return AIProcessingResult(**data)

    except Exception as e:
        print(f"[AI Engine] OpenAI failed: {e} — falling back to mock")
        return _process_mock(content, existing_buckets)


def _validate_and_fix_result(
    result: AIProcessingResult,
    content: str,
    existing_buckets: list[str]
) -> AIProcessingResult:
    """
    Structural validation only — never overrides Groq's semantic decisions.
    """
    # Fix 1 — Fuzzy bucket matching
    if existing_buckets and result.suggested_bucket not in existing_buckets:
        close_match = _find_close_bucket(result.suggested_bucket, existing_buckets)
        if close_match:
            print(f"[Guardrail] Fuzzy match: '{result.suggested_bucket}' → '{close_match}'")
            result.suggested_bucket = close_match
        else:
            print(f"[Guardrail] New bucket accepted: '{result.suggested_bucket}'")

    # Fix 2 — Generic title
    generic_titles = {
        "summary", "overview", "content", "information",
        "article", "note", "captured thought"
    }
    if result.title.lower() in generic_titles:
        words = [w for w in content.split() if len(w) > 4][:6]
        result.title = " ".join(words).capitalize()

    # Fix 3 — Key points too long
    if result.key_points and all(len(kp) > 100 for kp in result.key_points):
        result.key_points = [kp[:80] + "..." for kp in result.key_points]

    return result

def _recalculate_score(content: str) -> float:
    content_lower = content.lower()

    urgent = [
        "deadline", "urgent", "asap", "immediately", "today",
        "fix", "broken", "down", "emergency", "critical"
    ]
    strong_action = [
        "you should", "you must", "you need to", "have to",
        "apply", "register", "buy", "start", "do this",
        "make sure", "don't miss", "act now"
    ]
    moderate_action = [
        "consider", "might want to", "could", "worth trying",
        "recommend", "suggest", "try", "aim for", "target",
        "per week", "per day", "minutes", "times a week",
        "allocate", "invest", "set aside", "treat it"
    ]
    soft_advice = [
        "interesting", "note that", "keep in mind",
        "generally", "typically", "usually", "tends to"
    ]
    pure_fact = [
        "history", "science", "research shows", "study found",
        "discovered", "according to", "defined as", "is known as",
        "was born", "founded in", "located in"
    ]

    if any(w in content_lower for w in urgent):
        return 0.9
    elif any(w in content_lower for w in strong_action):
        return 0.75
    elif any(w in content_lower for w in moderate_action):
        return 0.6
    elif any(w in content_lower for w in soft_advice):
        return 0.3
    elif any(w in content_lower for w in pure_fact):
        return 0.1
    return 0.35

def _find_close_bucket(suggested: str, existing: list[str]) -> str | None:
    """Finds the closest existing bucket using fuzzy matching."""
    suggested_lower = suggested.lower()
    
    for bucket in existing:
        # Direct substring match
        if suggested_lower in bucket.lower() or bucket.lower() in suggested_lower:
            return bucket
        
        # Fuzzy similarity
        similarity = SequenceMatcher(None, suggested_lower, bucket.lower()).ratio()
        if similarity > 0.6:
            return bucket
    
    return None


def _process_mock(content: str, existing_buckets: list[str]) -> AIProcessingResult:
    """
    Emergency fallback only — Groq should handle all real processing.
    Returns a minimal valid response so the pipeline doesn't crash.
    """
    words = content.split()
    title_words = [w for w in words if len(w) > 4][:6]
    title = " ".join(title_words).capitalize() if title_words else "Captured thought"

    sentences = re.split(r'(?<=[.!?])\s+', content.strip())
    key_points = [s.strip() for s in sentences[:3] if len(s.strip()) > 10]
    if not key_points:
        key_points = ["Content captured", "Ready for review"]

    summary = " ".join(sentences[:2]) if len(sentences) >= 2 else content[:200]

    # Use first existing bucket if available, else Inbox
    fallback_bucket = existing_buckets[0] if existing_buckets else "Inbox"

    return AIProcessingResult(
        title=title,
        summary=summary[:300],
        key_points=key_points,
        cognitive_mode="learn",
        actionability_score=0.3,
        suggested_bucket=fallback_bucket,
    )