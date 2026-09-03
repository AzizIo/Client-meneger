"""Pydantic-схема для файлов (File)."""
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict


class FileOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    task_id: Optional[str] = None
    approval_id: Optional[str] = None
    uploaded_by_user_id: Optional[str] = None
    file_name: str
    file_url: str
    file_size_bytes: Optional[int] = None
    mime_type: Optional[str] = None
    created_at: datetime
