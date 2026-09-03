"""
dependencies.py
================
Общие проверки-хелперы, переиспользуемые в разных роутерах:
"проект существует", "этап существует и принадлежит проекту", "задача
существует", "у текущего пользователя есть доступ к проекту".

Раньше это были одноимённые private-функции (_get_project_or_404 и
т.д.), продублированные объявлениями в разных местах main.py — здесь
они определены один раз и импортируются, где нужны.
"""
from fastapi import Depends, HTTPException, status
from sqlalchemy.orm import Session

from database import get_db
from models import Project, Stage, Task, ProjectExecutor, User
from security import get_current_user


def get_project_or_404(project_id: str, db: Session) -> Project:
    """Общая проверка, что проект существует."""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Проект не найден",
        )
    return project


def get_stage_or_404(project_id: str, stage_id: str, db: Session) -> Stage:
    """Общая проверка: этап существует И принадлежит именно этому
    проекту — без второй части проверки можно было бы случайно
    обратиться к чужому этапу, зная только его id."""
    stage = (
        db.query(Stage)
        .filter(Stage.id == stage_id, Stage.project_id == project_id)
        .first()
    )
    if not stage:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Этап не найден")
    return stage


def get_task_or_404(stage_id: str, task_id: str, db: Session) -> Task:
    task = db.query(Task).filter(Task.id == task_id, Task.stage_id == stage_id).first()
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Задача не найдена")
    return task


def require_project_access(
    project_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Project:
    """
    Единая проверка доступа для ВСЕХ вложенных роутов проекта
    (stages, tasks, comments, files, executors).

    Без этой проверки любой залогиненный юзер, зная project_id чужого
    проекта, мог бы напрямую читать его stages/tasks/files/comments —
    даже если сам проект не отображается в его /projects списке.
    """
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Проект не найден")

    is_related = (
        project.executor_id == current_user.id
        or project.client_id == current_user.id
        or db.query(ProjectExecutor)
            .filter(
                ProjectExecutor.project_id == project_id,
                ProjectExecutor.user_id == current_user.id,
            )
            .first() is not None
    )

    if not is_related:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="У вас нет доступа к этому проекту")

    return project
