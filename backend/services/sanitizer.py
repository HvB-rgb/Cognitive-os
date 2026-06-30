import re

def sanitize(text: str, max_chars: int = 4000) -> str:
    # Step 1 — Fix encoding artifacts first, before anything else
    text = text.encode('utf-8', errors='ignore').decode('utf-8')
    text = text.replace('â€"', '—')
    text = text.replace('â€™', "'")
    text = text.replace('â€œ', '"')
    text = text.replace('â€', '"')
    text = text.replace('Ã©', 'é')
    text = text.replace('Ã¨', 'è')
    text = text.replace('Ã ', 'à')

    # Step 2 — Remove zero-width characters
    text = re.sub(r'[\u200b\u200c\u200d\ufeff]', '', text)

    # Step 3 — Collapse excessive newlines and spaces
    text = re.sub(r'\n{3,}', '\n\n', text)
    text = re.sub(r' {2,}', ' ', text)

    # Step 4 — Strip and cap
    text = text.strip()
    return text[:max_chars]


def is_url(text: str) -> bool:
    return text.strip().startswith(("http://", "https://"))