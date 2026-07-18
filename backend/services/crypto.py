from __future__ import annotations
from cryptography.fernet import Fernet
from backend.config import get_settings

settings = get_settings()
_fernet = Fernet(settings.encryption_key.encode()) if settings.encryption_key else None


def encrypt_secret(plaintext: str) -> str:
    if not _fernet:
        raise RuntimeError("ENCRYPTION_KEY is not configured.")
    return _fernet.encrypt(plaintext.encode()).decode()


def decrypt_secret(token: str) -> str:
    if not _fernet:
        raise RuntimeError("ENCRYPTION_KEY is not configured.")
    return _fernet.decrypt(token.encode()).decode()
