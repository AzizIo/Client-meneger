"""
routers/comments.py
=====================
Комментарии к задаче: создание (executor и client), список (с
фильтрацией internal-заметок для client), удаление своего комментария.
"""
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from database import get_db
from models import User, Comment
from security import get_current_user
from dependencies import get_project_or_404, get_stage_or_404, get_task_or_404, require_project_access
from utils import log_activity, create_notification
from schemas.comment import CommentCreate, CommentOut

router = APIRouter(
    prefix="/projects/{project_id}/stages/{stage_id}/tasks/{task_id}/comments",
    tags=["comments"],
)


@router.post("", response_model=CommentOut, status_code=status.HTTP_201_CREATED)
def create_comment(
    project_id: str,
    stage_id: str,
    task_id: str,
    payload: CommentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _project=Depends(require_project_access),
):
    """
    Создать комментарий к задаче. Доступно и executor, и client.

    is_internal форсируется в False для client — заметки "только для
    своей команды" не имеют смысла со стороны заказчика.
    """
    project = get_project_or_404(project_id, db)
    get_stage_or_404(project_id, stage_id, db)
    get_task_or_404(stage_id, task_id, db)

    is_internal = payload.is_internal if current_user.role == "executor" else False

    comment = Comment(
        task_id=task_id,
        author_user_id=current_user.id,
        body=payload.body,
        is_internal=is_internal,
    )
    if not is_internal:
        recipient_id = project.client_id if current_user.role == "executor" else project.executor_id
        create_notification(
            db,
            recipient_user_id=recipient_id,
            type="new_comment",
            title="Новый комментарий",
            body=payload.body[:200],
            related_project_id=project_id,
            related_task_id=task_id,
        )
    db.add(comment)
    log_activity(db, project_id, "comment_added", actor_user_id=current_user.id, task_id=task_id)
    db.commit()
    db.refresh(comment)
    return comment


@router.get("", response_model=List[CommentOut])
def list_comments(
    project_id: str,
    stage_id: str,
    task_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _project=Depends(require_project_access),
):
    """
    Список комментариев задачи, от старых к новым.

    Client не видит is_internal-комментарии вообще — фильтруем на
    уровне запроса, чтобы данные не утекали в сетевой ответ клиенту.
    """
    get_stage_or_404(project_id, stage_id, db)
    get_task_or_404(stage_id, task_id, db)

    query = db.query(Comment).filter(Comment.task_id == task_id)

    if current_user.role == "client":
        query = query.filter(Comment.is_internal == False)  # noqa: E712

    comments = query.order_by(Comment.created_at).all()
    return comments


@router.delete("/{comment_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_comment(
    project_id: str,
    stage_id: str,
    task_id: str,
    comment_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _project=Depends(require_project_access),
):
    """Удалить комментарий — может только автор."""
    get_stage_or_404(project_id, stage_id, db)
    get_task_or_404(stage_id, task_id, db)

    comment = (
        db.query(Comment)
        .filter(Comment.id == comment_id, Comment.task_id == task_id)
        .first()
    )
    if not comment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Комментарий не найден")

    if comment.author_user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Можно удалить только свой комментарий",
        )

    db.delete(comment)
    db.commit()
    return None
