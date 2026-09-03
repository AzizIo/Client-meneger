"""Pydantic-схема для уведомлений (Notification)."""
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict


class NotificationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    type: str
    title: str
    body: Optional[str] = None
    related_project_id: Optional[str] = None
    related_task_id: Optional[str] = None
    is_read: bool
    created_at: datetime
