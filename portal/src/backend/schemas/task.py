"""Pydantic-схемы для задач (Task)."""
from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict

from schemas.user import UserOut
from schemas.approval import ApprovalOut


class TaskCreate(BaseModel):
    title: str
    description: Optional[str] = None
    assignee_id: Optional[str] = None
    due_date: Optional[datetime] = None


class TaskUpdate(BaseModel):
    """Статус сюда НЕ входит намеренно: статус задачи меняется только
    через действия с Approval, а не прямым PATCH."""
    title: Optional[str] = None
    description: Optional[str] = None
    assignee_id: Optional[str] = None
    due_date: Optional[datetime] = None


class TaskOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    stage_id: str
    title: str
    description: Optional[str] = None
    assignee_id: Optional[str] = None
    assignee: Optional[UserOut] = None
    status: str
    position: int
    due_date: Optional[datetime] = None
    created_at: datetime


class TaskDetailOut(TaskOut):
    """Для экрана Task Detail — сразу со всей историей раундов согласования."""
    approvals: List[ApprovalOut] = []
