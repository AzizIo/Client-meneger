"""
utils.py
=========
Мелкие хелперы, вызываемые из нескольких роутеров:
- log_activity — запись события в историю проекта
- create_notification — создание уведомления

Оба НЕ делают db.commit() сами — уведомление/лог создаются в рамках
той же транзакции, что и основное действие (например, отправка на
согласование), и коммитятся вместе с ним одним db.commit() в конце
вызывающей функции. Так надёжнее: если основное действие упадёт,
"осиротевшая" запись не останется в БД.
"""
import json
from typing import Optional

from sqlalchemy.orm import Session

from models import ActivityLog, Notification


def log_activity(
    db: Session,
    project_id: str,
    event_type: str,
    actor_user_id: Optional[str] = None,
    task_id: Optional[str] = None,
    event_data: Optional[dict] = None,
) -> None:
    log = ActivityLog(
        project_id=project_id,
        task_id=task_id,
        actor_user_id=actor_user_id,
        event_type=event_type,
        event_data=json.dumps(event_data) if event_data else None,
    )
    db.add(log)


def create_notification(
    db: Session,
    recipient_user_id: str,
    type: str,
    title: str,
    body: Optional[str] = None,
    related_project_id: Optional[str] = None,
    related_task_id: Optional[str] = None,
) -> None:
    notification = Notification(
        recipient_user_id=recipient_user_id,
        type=type,
        title=title,
        body=body,
        related_project_id=related_project_id,
        related_task_id=related_task_id,
    )
    db.add(notification)
