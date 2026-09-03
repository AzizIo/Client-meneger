"""Pydantic-схемы для дополнительных исполнителей проекта."""
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, EmailStr


class ProjectExecutorAdd(BaseModel):
    email: EmailStr


class ProjectExecutorOut(BaseModel):
    id: str
    full_name: str
    email: EmailStr
    avatar_url: Optional[str] = None
    is_owner: bool
    added_at: datetime
