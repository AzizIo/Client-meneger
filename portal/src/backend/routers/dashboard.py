"""
routers/dashboard.py
======================
Агрегированные данные для главной страницы/дашборда.
"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session, selectinload

from database import get_db
from models import User, Task
from security import get_current_user

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/pending-approvals")
def list_pending_approval_tasks(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Все задачи, ожидающие согласования."""
    tasks = (
        db.query(Task)
        .options(selectinload(Task.assignee))
        .filter(Task.status == "pending_approval")
        .order_by(Task.created_at.desc())
        .all()
    )
    return tasks
