"""Pydantic-схема для истории проекта (ActivityLog)."""
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict

from schemas.user import UserOut


class ActivityLogOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    project_id: str
    task_id: Optional[str] = None
    actor_user_id: Optional[str] = None
    actor: Optional[UserOut] = None
    event_type: str
    event_data: Optional[str] = None
    created_at: datetime
