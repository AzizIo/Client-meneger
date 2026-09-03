"""Pydantic-схемы для комментариев (Comment)."""
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict

from schemas.user import UserOut


class CommentCreate(BaseModel):
    body: str
    is_internal: bool = False


class CommentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    task_id: str
    author_user_id: Optional[str] = None
    author: Optional[UserOut] = None
    body: str
    is_internal: bool
    created_at: datetime
