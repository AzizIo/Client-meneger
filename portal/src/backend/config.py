"""
config.py
=========
Все константы и настройки приложения в одном месте. Раньше SECRET_KEY,
лимиты на файлы и GROQ_API_KEY были раскиданы по main.py вперемешку с
эндпоинтами — теперь любой модуль, которому это нужно, просто делает
`from config import ...`, и значение гарантированно одно и то же везде.
"""
from pathlib import Path

# --- JWT / auth ---
SECRET_KEY = "change-me-to-a-random-secret-in-production"  # в .env в реальном проекте
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # токен живёт 7 дней

# --- Файлы ---
UPLOAD_DIR = Path("uploads")
UPLOAD_DIR.mkdir(exist_ok=True)

ALLOWED_MIME_TYPES = {
    "image/jpeg", "image/png", "image/gif", "image/webp",
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "text/plain",
    "application/zip",
}

MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB

# --- AI (ai-summary эндпоинт) ---
GROQ_API_KEY = ""
