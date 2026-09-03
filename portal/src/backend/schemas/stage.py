"""Pydantic-схемы для этапов проекта (Stage)."""
from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict


class StageCreate(BaseModel):
    """position не передаётся явно — вычисляется на сервере."""
    name: str


class StageUpdate(BaseModel):
    name: Optional[str] = None
    status: Optional[str] = None  # 'not_started' | 'in_progress' | 'completed'


class StageReorderItem(BaseModel):
    """Один элемент списка нового порядка этапов."""
    id: str
    position: int


class StageReorderRequest(BaseModel):
    """Тело запроса для drag-and-drop: фронт присылает ВЕСЬ новый
    порядок целиком."""
    stages: List[StageReorderItem]


class StageOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    project_id: str
    name: str
    position: int
    status: str
    created_at: datetime
