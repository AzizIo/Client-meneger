"""
routers/projects.py
=====================
CRUD проекта: создание, список, один проект, обновление статуса/данных,
удаление. Логика перенесена из main.py без изменений.
"""
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, selectinload

from database import get_db
from models import User, Project
from security import get_current_user
from dependencies import get_project_or_404
from utils import log_activity
from schemas.project import ProjectCreate, ProjectUpdate, ProjectOut, ProjectDetailOut

router = APIRouter(prefix="/projects", tags=["projects"])


@router.post("", response_model=ProjectDetailOut, status_code=status.HTTP_201_CREATED)
def create_project(
    payload: ProjectCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Создание проекта. current_user становится executor — он же создатель
    проекта. client ищется по email среди уже зарегистрированных
    пользователей.

    Пока без require_role("executor") — по решению на этом этапе любой
    залогиненный пользователь может создать проект.
    """
    client = db.query(User).filter(User.email == payload.client_email).first()
    if not client:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Пользователь с таким email не найден",
        )
    if client.role != "client":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Указанный пользователь не зарегистрирован как заказчик (client)",
        )
    if client.id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Нельзя создать проект с самим собой в роли заказчика",
        )

    project = Project(
        executor_id=current_user.id,
        client_id=client.id,
        name=payload.name,
        description=payload.description,
    )
    db.add(project)
    db.commit()
    db.refresh(project)
    return project


@router.get("", response_model=List[ProjectOut])
def list_projects(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Список всех проектов — пока без фильтрации по владельцу (на этапе
    теста всем видны все проекты).

    Когда понадобится разделить видимость, здесь добавится фильтр по
    Project.executor_id / Project.client_id == current_user.id.
    """
    projects = (
        db.query(Project)
        .options(selectinload(Project.stages))
        .order_by(Project.created_at.desc())
        .all()
    )
    return projects


@router.get("/{project_id}", response_model=ProjectDetailOut)
def get_project(
    project_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Один проект по id, со вложенными данными executor и client."""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Проект не найден",
        )
    return project


@router.patch("/{project_id}", response_model=ProjectDetailOut)
def update_project(
    project_id: str,
    payload: ProjectUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Изменение статуса/данных проекта. Только владелец (executor_id) —
    client и дополнительные исполнители статус менять не могут.
    """
    project = get_project_or_404(project_id, db)

    if project.executor_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Только владелец проекта может изменять его статус",
        )

    if payload.name is not None:
        project.name = payload.name
    if payload.description is not None:
        project.description = payload.description
    if payload.status is not None:
        if payload.status not in ("active", "completed", "on_hold"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="status должен быть 'active', 'completed' или 'on_hold'",
            )
        project.status = payload.status
        log_activity(db, project_id, "project_status_changed", actor_user_id=current_user.id,
                     event_data={"new_status": payload.status})
    if payload.is_archived is not None:
        project.is_archived = payload.is_archived

    db.commit()
    db.refresh(project)
    return project


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_project(
    project_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = get_project_or_404(project_id, db)

    if project.executor_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Только владелец проекта может его удалить",
        )

    db.delete(project)
    db.commit()
    return None
