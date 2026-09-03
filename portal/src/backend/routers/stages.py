"""
routers/stages.py
===================
CRUD этапов проекта + drag-and-drop reorder. Вложенный путь
/projects/{project_id}/stages — этапы всегда существуют в контексте
конкретного проекта.
"""
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from database import get_db
from models import User, Stage
from security import get_current_user
from dependencies import get_project_or_404, require_project_access
from schemas.stage import StageCreate, StageUpdate, StageReorderRequest, StageOut

router = APIRouter(prefix="/projects/{project_id}/stages", tags=["stages"])


@router.post("", response_model=StageOut, status_code=status.HTTP_201_CREATED)
def create_stage(
    project_id: str,
    payload: StageCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _project=Depends(require_project_access),
):
    """
    Создаёт новый этап в конце списка существующих этапов проекта.
    position = (максимальный текущий position + 1); если этапов пока
    нет — первый этап получает position = 0.
    """
    get_project_or_404(project_id, db)

    max_position = (
        db.query(Stage.position)
        .filter(Stage.project_id == project_id)
        .order_by(Stage.position.desc())
        .first()
    )
    next_position = (max_position[0] + 1) if max_position else 0

    stage = Stage(
        project_id=project_id,
        name=payload.name,
        position=next_position,
    )
    db.add(stage)
    db.commit()
    db.refresh(stage)
    return stage


@router.get("", response_model=List[StageOut])
def list_stages(
    project_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _project=Depends(require_project_access),
):
    """Список этапов проекта, отсортированный по position — порядок,
    в котором рисуется степпер на фронте."""
    get_project_or_404(project_id, db)
    stages = (
        db.query(Stage)
        .filter(Stage.project_id == project_id)
        .order_by(Stage.position)
        .all()
    )
    return stages


@router.patch("/{stage_id}", response_model=StageOut)
def update_stage(
    project_id: str,
    stage_id: str,
    payload: StageUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _project=Depends(require_project_access),
):
    """Переименование этапа и/или смена статуса."""
    stage = (
        db.query(Stage)
        .filter(Stage.id == stage_id, Stage.project_id == project_id)
        .first()
    )
    if not stage:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Этап не найден")

    if payload.name is not None:
        stage.name = payload.name
    if payload.status is not None:
        stage.status = payload.status

    db.commit()
    db.refresh(stage)
    return stage


@router.put("/reorder", response_model=List[StageOut])
def reorder_stages(
    project_id: str,
    payload: StageReorderRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _project=Depends(require_project_access),
):
    """
    Применяет новый порядок этапов после drag-and-drop на фронте.

    Путь /reorder идёт перед /{stage_id} специально не нужен — FastAPI
    матчит по точному совпадению сегмента пути, "reorder" не спутается
    с UUID в /{stage_id}.
    """
    get_project_or_404(project_id, db)

    stages_by_id = {
        s.id: s
        for s in db.query(Stage).filter(Stage.project_id == project_id).all()
    }

    for item in payload.stages:
        stage = stages_by_id.get(item.id)
        if stage is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Этап {item.id} не принадлежит этому проекту",
            )
        stage.position = item.position

    db.commit()

    updated_stages = (
        db.query(Stage)
        .filter(Stage.project_id == project_id)
        .order_by(Stage.position)
        .all()
    )
    return updated_stages


@router.delete("/{stage_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_stage(
    project_id: str,
    stage_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _project=Depends(require_project_access),
):
    """Удаляет этап. cascade="all, delete-orphan" в models.py означает,
    что все Task внутри этого этапа удалятся автоматически вместе с ним."""
    stage = (
        db.query(Stage)
        .filter(Stage.id == stage_id, Stage.project_id == project_id)
        .first()
    )
    if not stage:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Этап не найден")

    db.delete(stage)
    db.commit()
    return None
