"""
routers/project_executors.py
==============================
Дополнительные исполнители проекта (помимо владельца-executor'а):
список, добавление по email, удаление.
"""
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from database import get_db
from models import User, ProjectExecutor
from security import get_current_user, require_role
from dependencies import get_project_or_404, require_project_access
from utils import log_activity, create_notification
from schemas.project_executor import ProjectExecutorAdd, ProjectExecutorOut

router = APIRouter(
    prefix="/projects/{project_id}/executors", tags=["project-executors"]
)


@router.get("", response_model=List[ProjectExecutorOut])
def list_project_executors(
    project_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _project=Depends(require_project_access),
):
    """
    Все исполнители проекта: сначала владелец (Project.executor_id),
    затем все из project_executor. Owner помечен is_owner=True.
    """
    project = get_project_or_404(project_id, db)

    result: List[ProjectExecutorOut] = [
        ProjectExecutorOut(
            id=project.executor.id,
            full_name=project.executor.full_name,
            email=project.executor.email,
            avatar_url=project.executor.avatar_url,
            is_owner=True,
            added_at=project.created_at,
        )
    ]

    additional = (
        db.query(ProjectExecutor)
        .filter(ProjectExecutor.project_id == project_id)
        .order_by(ProjectExecutor.created_at)
        .all()
    )
    for pe in additional:
        result.append(
            ProjectExecutorOut(
                id=pe.user.id,
                full_name=pe.user.full_name,
                email=pe.user.email,
                avatar_url=pe.user.avatar_url,
                is_owner=False,
                added_at=pe.created_at,
            )
        )

    return result


@router.post("", response_model=ProjectExecutorOut, status_code=status.HTTP_201_CREATED)
def add_project_executor(
    project_id: str,
    payload: ProjectExecutorAdd,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("executor")),
    _project=Depends(require_project_access),
):
    """Добавить исполнителя в проект по email. Только владелец проекта."""
    project = get_project_or_404(project_id, db)

    if project.executor_id != current_user.id:
        raise HTTPException(403, "Только владелец проекта может добавлять исполнителей")

    user = db.query(User).filter(User.email == payload.email).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Пользователь с таким email не найден",
        )
    if user.role != "executor":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Указанный пользователь не зарегистрирован как исполнитель",
        )
    if user.id == project.executor_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Этот пользователь уже владелец проекта",
        )

    existing = (
        db.query(ProjectExecutor)
        .filter(ProjectExecutor.project_id == project_id, ProjectExecutor.user_id == user.id)
        .first()
    )
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Этот исполнитель уже добавлен в проект",
        )

    pe = ProjectExecutor(
        project_id=project_id,
        user_id=user.id,
        added_by_user_id=current_user.id,
    )
    create_notification(
        db,
        recipient_user_id=user.id,
        type="added_to_project",
        title="Вас добавили в проект",
        body=project.name,
        related_project_id=project_id,
    )
    db.add(pe)
    log_activity(db, project_id, "executor_added", actor_user_id=current_user.id,
                 event_data={"added_email": user.email})
    db.commit()
    db.refresh(pe)

    return ProjectExecutorOut(
        id=user.id,
        full_name=user.full_name,
        email=user.email,
        avatar_url=user.avatar_url,
        is_owner=False,
        added_at=pe.created_at,
    )


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_project_executor(
    project_id: str,
    user_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("executor")),
    _project=Depends(require_project_access),
):
    """
    Удалить исполнителя из проекта. Владельца (Project.executor_id)
    удалить так нельзя — для смены владельца нужна отдельная операция
    (PATCH /projects/{id} с новым executor_id).
    """
    project = get_project_or_404(project_id, db)
    if project.executor_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Только владелец проекта может удалять исполнителей",
        )
    if user_id == project.executor_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Нельзя удалить владельца проекта, только дополнительных исполнителей",
        )

    pe = (
        db.query(ProjectExecutor)
        .filter(ProjectExecutor.project_id == project_id, ProjectExecutor.user_id == user_id)
        .first()
    )
    if not pe:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Исполнитель не найден в этом проекте")

    db.delete(pe)
    db.commit()
    return None
