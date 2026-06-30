import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
from backend.services.supabase_client import supabase
from backend.config import get_settings


def find_relevant_items(internal_user_id: str, query: str, top_k: int = 10) -> list[dict]:
    """Stage 1: TF-IDF cosine similarity against all user entries. Sync — matches the rest of database.py's pattern."""
    try:
        result = (
            supabase.table("cognitive_entries")
            .select("id, title, summary, bucket, cognitive_mode, created_at")
            .eq("user_id", internal_user_id)
            .execute()
        )
    except Exception as e:
        print(f"[Search] Supabase fetch failed: {e}")
        return []

    items = result.data
    if not items:
        return []

    corpus = [f"{item['title']} {item.get('summary', '')}" for item in items]

    vectorizer = TfidfVectorizer(stop_words="english", ngram_range=(1, 2))
    try:
        tfidf_matrix = vectorizer.fit_transform(corpus)
        query_vec = vectorizer.transform([query])
        scores = cosine_similarity(query_vec, tfidf_matrix).flatten()
    except ValueError:
        return []

    top_indices = np.argsort(scores)[::-1][:top_k]
    return [
        {**items[i], "score": float(scores[i])}
        for i in top_indices
        if scores[i] > 0.05
    ]


async def groq_rerank(query: str, candidates: list[dict], top_n: int = 3) -> str | None:
    """Stage 2: Groq re-ranks candidates. Async — matches AsyncGroq pattern in ai_engine.py."""
    if not candidates:
        return None

    settings = get_settings()
    if not settings.groq_api_key:
        lines = []
        for i, c in enumerate(candidates[:top_n], 1):
            lines.append(f"{i}. {c['title']}\n   📁 {c['bucket']} · 🧠 {c['cognitive_mode']}")
        return "\n\n".join(lines)

    formatted = "\n\n".join([
        f"[{i+1}] Title: {c['title']}\n"
        f"    Summary: {c.get('summary', 'N/A')[:300]}\n"
        f"    Bucket: {c['bucket']} · Mode: {c['cognitive_mode']}"
        for i, c in enumerate(candidates)
    ])

    prompt = f"""You are a personal knowledge assistant. The user is searching their saved knowledge base.

Query: "{query}"

Retrieved candidates:
{formatted}

Return the top {top_n} most relevant results. For each write:
- The title
- One sentence on why it matches the query
- The bucket it belongs to

Keep it concise. Use plain text only — no asterisks, no markdown. This renders in Telegram."""

    try:
        from groq import AsyncGroq
        client = AsyncGroq(api_key=settings.groq_api_key)
        response = await client.chat.completions.create(
            model="openai/gpt-oss-20b",   # was "llama-3.1-8b-instant"
            messages=[{"role": "user", "content": prompt}],
            temperature=0.3,
            max_tokens=500,
            reasoning_effort="low",
        )
        return response.choices[0].message.content.strip()
    except Exception as e:
        print(f"[Search] Groq rerank failed: {e}")
        lines = []
        for i, c in enumerate(candidates[:top_n], 1):
            lines.append(f"{i}. {c['title']}\n   📁 {c['bucket']}")
        return "\n\n".join(lines)