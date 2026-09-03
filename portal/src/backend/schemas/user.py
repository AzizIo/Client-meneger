"""Pydantic-схемы, связанные с пользователем и аутентификацией."""
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, EmailStr, ConfigDict


class RegisterRequest(BaseModel):
    """То, что фронтенд отправляет на /auth/register. role выбирается
    пользователем на экране регистрации."""
    email: EmailStr
    password: str
    full_name: str
    role: str  # 'executor' | 'client'


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    """Уходит фронтенду после успешного логина/регистрации."""
    access_token: str
    token_type: str = "bearer"
    role: str


class UserUpdate(BaseModel):
    """Тело запроса для обновления профиля. Оба поля Optional —
    PATCH обновляет только то, что реально передали."""
    full_name: Optional[str] = None
    email: Optional[EmailStr] = None


class AvatarUpdateRequest(BaseModel):
    """avatar_url — это ГОТОВАЯ ссылка на картинку, а не сам файл."""
    avatar_url: str


class UserOut(BaseModel):
    """Намеренно нет password_hash — это никогда не должно уйти в ответ."""
    model_config = ConfigDict(from_attributes=True)

    id: str
    email: EmailStr
    full_name: str
    avatar_url: Optional[str] = None
    role: str
    is_active: bool
    created_at: datetime
