"""
routers/activity.py
=====================
История событий проекта (кто что сделал и когда).
"""
from typing import List

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session, selectinload

from database import get_db
from models import User, ActivityLog
from security import get_current_user
from dependencies import require_project_access
from schemas.activity import ActivityLogOut

router = APIRouter(prefix="/projects/{project_id}/activity", tags=["activity"])


@router.get("", response_model=List[ActivityLogOut])
def list_activity(
    project_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _project=Depends(require_project_access),
):
    """История проекта, от новых к старым."""
    logs = (
        db.query(ActivityLog)
        .options(selectinload(ActivityLog.actor))
        .filter(ActivityLog.project_id == project_id)
        .order_by(ActivityLog.created_at.desc())
        .all()
    )
    return logs
