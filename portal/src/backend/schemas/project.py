"""Pydantic-схемы для проекта (Project)."""
from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, EmailStr, ConfigDict

from schemas.stage import StageOut
from schemas.user import UserOut


class ProjectCreate(BaseModel):
    """То, что executor отправляет при создании проекта. client_email —
    email уже зарегистрированного пользователя с role='client'."""
    name: str
    description: Optional[str] = None
    client_email: EmailStr


class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None  # 'active' | 'completed' | 'on_hold'
    is_archived: Optional[bool] = None


class ProjectOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    executor_id: str
    client_id: str
    name: str
    description: Optional[str] = None
    status: str
    is_archived: bool
    created_at: datetime
    updated_at: datetime
    stages: List[StageOut] = []


class ProjectDetailOut(ProjectOut):
    """Расширенная версия для экрана 'Project Detail'."""
    executor: UserOut
    client: UserOut
