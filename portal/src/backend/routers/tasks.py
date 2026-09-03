"""
routers/tasks.py
==================
CRUD задач + весь approval-цикл (ядро бизнес-логики продукта).

Поток согласования:
  1. executor отправляет задачу на согласование -> создаётся Approval
     со status='pending', round_number=1 (или +1) task.status
     становится 'pending_approval'
  2. client принимает решение -> approved или rejected:
     - approved: task.status = 'approved', раунд закрывается
     - rejected: task.status = 'changes_requested', раунд закрывается,
       но задачу можно отправить на согласование СНОВА — новый
       Approval с round_number + 1
"""
from datetime import datetime
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from database import get_db
from models import User, Task, Approval
from security import get_current_user, require_role
from dependencies import get_project_or_404, get_stage_or_404, get_task_or_404, require_project_access
from utils import log_activity, create_notification
from schemas.task import TaskCreate, TaskUpdate, TaskOut, TaskDetailOut
from schemas.approval import ApprovalDecision, ApprovalOut

router = APIRouter(
    prefix="/projects/{project_id}/stages/{stage_id}/tasks", tags=["tasks"]
)


@router.post("", response_model=TaskOut, status_code=status.HTTP_201_CREATED)
def create_task(
    project_id: str,
    stage_id: str,
    payload: TaskCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("executor")),
    _project=Depends(require_project_access),
):
    """Создание задачи — только executor. require_role("executor")
    вернёт 403 раньше, чем выполнится хоть строчка этого кода."""
    get_stage_or_404(project_id, stage_id, db)

    max_position = (
        db.query(Task.position)
        .filter(Task.stage_id == stage_id)
        .order_by(Task.position.desc())
        .first()
    )
    next_position = (max_position[0] + 1) if max_position else 0

    task = Task(
        stage_id=stage_id,
        title=payload.title,
        description=payload.description,
        assignee_id=payload.assignee_id,
        position=next_position,
    )
    db.add(task)
    db.commit()
    db.refresh(task)
    return task


@router.get("", response_model=List[TaskOut])
def list_tasks(
    project_id: str,
    stage_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _project=Depends(require_project_access),
):
    """Список задач этапа — доступен и executor, и client."""
    get_stage_or_404(project_id, stage_id, db)
    tasks = (
        db.query(Task)
        .filter(Task.stage_id == stage_id)
        .order_by(Task.position)
        .all()
    )
    return tasks


@router.get("/{task_id}", response_model=TaskDetailOut)
def get_task(
    project_id: str,
    stage_id: str,
    task_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _project=Depends(require_project_access),
):
    """Одна задача со всей историей раундов согласования."""
    get_stage_or_404(project_id, stage_id, db)
    task = get_task_or_404(stage_id, task_id, db)
    return task


@router.patch("/{task_id}", response_model=TaskOut)
def update_task(
    project_id: str,
    stage_id: str,
    task_id: str,
    payload: TaskUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("executor")),
    _project=Depends(require_project_access),
):
    """Редактирование задачи — только executor."""
    get_stage_or_404(project_id, stage_id, db)
    task = get_task_or_404(stage_id, task_id, db)

    if payload.title is not None:
        task.title = payload.title
    if payload.description is not None:
        task.description = payload.description
    if payload.assignee_id is not None:
        task.assignee_id = payload.assignee_id

    db.commit()
    db.refresh(task)
    return task


@router.delete("/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_task(
    project_id: str,
    stage_id: str,
    task_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("executor")),
    _project=Depends(require_project_access),
):
    """Удаление задачи — только executor. cascade в models.py удалит
    вместе с ней все Approval, File, Comment, привязанные к ней."""
    get_stage_or_404(project_id, stage_id, db)
    task = get_task_or_404(stage_id, task_id, db)
    db.delete(task)
    db.commit()
    return None


@router.post(
    "/{task_id}/approvals", response_model=ApprovalOut, status_code=status.HTTP_201_CREATED
)
def send_for_approval(
    project_id: str,
    stage_id: str,
    task_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("executor")),
):
    """
    'Отправить на согласование' — кнопка на стороне executor.

    Защита от повторной отправки: если у задачи уже есть Approval со
    status='pending', отправлять второй раз бессмысленно (и создало бы
    дубль round_number, нарушив UniqueConstraint в БД).
    """
    project = get_project_or_404(project_id, db)
    get_stage_or_404(project_id, stage_id, db)
    task = get_task_or_404(stage_id, task_id, db)

    existing_pending = (
        db.query(Approval)
        .filter(Approval.task_id == task_id, Approval.status == "pending")
        .first()
    )
    if existing_pending:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Задача уже отправлена на согласование, ждём решения клиента",
        )

    max_round = (
        db.query(Approval.round_number)
        .filter(Approval.task_id == task_id)
        .order_by(Approval.round_number.desc())
        .first()
    )
    next_round = (max_round[0] + 1) if max_round else 1

    approval = Approval(
        task_id=task_id,
        round_number=next_round,
        status="pending",
        submitted_by_user_id=current_user.id,
    )
    db.add(approval)

    # task.status — denormalized-кэш текущего состояния, держим его
    # синхронным с реальным состоянием в Approval.
    task.status = "pending_approval"
    log_activity(db, project_id, "approval_requested", actor_user_id=current_user.id,
                 task_id=task_id, event_data={"task_title": task.title, "round": next_round})
    create_notification(
        db,
        recipient_user_id=project.client_id,
        type="approval_requested",
        title="Задача отправлена на согласование",
        body=task.title,
        related_project_id=project_id,
        related_task_id=task_id,
    )
    db.commit()
    db.refresh(approval)
    return approval


@router.post("/{task_id}/approvals/{approval_id}/decide", response_model=ApprovalOut)
def decide_approval(
    project_id: str,
    stage_id: str,
    task_id: str,
    approval_id: str,
    payload: ApprovalDecision,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("client")),
):
    """
    'Одобрить' / 'Отправить на доработку' — кнопки на стороне client.

    require_role("client") — только заказчик может принимать решение
    (нельзя самому себе одобрить свою же работу).
    """
    if payload.status not in ("approved", "rejected"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="status должен быть 'approved' или 'rejected'",
        )

    stage = get_stage_or_404(project_id, stage_id, db)
    task = get_task_or_404(stage_id, task_id, db)

    approval = (
        db.query(Approval)
        .filter(Approval.id == approval_id, Approval.task_id == task_id)
        .first()
    )
    if not approval:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Раунд согласования не найден")

    if approval.status != "pending":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="По этому раунду решение уже принято",
        )

    approval.status = payload.status
    approval.decision_comment = payload.decision_comment
    approval.decided_by_user_id = current_user.id
    approval.decided_at = datetime.utcnow()

    # Синхронизируем denormalized task.status с решением по раунду.
    task.status = "approved" if payload.status == "approved" else "changes_requested"
    log_activity(db, project_id, "approval_decided", actor_user_id=current_user.id,
                 task_id=task_id, event_data={"status": payload.status, "comment": payload.decision_comment})
    create_notification(
        db,
        recipient_user_id=approval.submitted_by_user_id,
        type="approval_decided",
        title="Одобрено" if payload.status == "approved" else "Требуются правки",
        body=payload.decision_comment,
        related_project_id=project_id,
        related_task_id=task_id,
    )

    db.commit()
    db.refresh(approval)

    # ---------------------------------------------------------------
    # Проверка: все ли задачи этапа теперь approved?
    # Если да — весь stage переходит в статус "fully_approved". Если
    # хотя бы одна задача не approved — stage откатывается на
    # "in_progress" (актуально при повторном раунде согласования после
    # того, как этап уже был fully_approved).
    # ---------------------------------------------------------------
    all_tasks = db.query(Task).filter(Task.stage_id == stage_id).all()

    if all_tasks and all(t.status == "approved" for t in all_tasks):
        stage.status = "fully_approved"
    elif stage.status == "fully_approved":
        stage.status = "in_progress"

    db.commit()

    return approval
