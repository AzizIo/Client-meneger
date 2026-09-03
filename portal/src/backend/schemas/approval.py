"""Pydantic-схемы для согласований (Approval)."""
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict


class ApprovalDecision(BaseModel):
    """Тело запроса, когда client жмёт Approve / Request Changes."""
    status: str  # 'approved' | 'rejected'
    decision_comment: Optional[str] = None


class ApprovalOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    task_id: str
    round_number: int
    status: str
    submitted_by_user_id: Optional[str] = None
    decided_by_user_id: Optional[str] = None
    decision_comment: Optional[str] = None
    submitted_at: datetime
    decided_at: Optional[datetime] = None
