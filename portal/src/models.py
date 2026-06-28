"""
models.py
=========
SQLAlchemy MODELS — это таблицы в базе данных, представленные как
Python-классы. Каждый class с __tablename__ = одна таблица в SQLite.

Аналогия из фронтенда: представь interface Project — но он не просто
описывает форму данных, а ещё и "живой": project.tasks сам подтянет
связанные строки из таблицы task (через relationship), как будто
там уже сделан JOIN под капотом.

=========================================================================
ВАЖНОЕ ИЗМЕНЕНИЕ МОДЕЛИ (упрощение от первой версии):
=========================================================================
Раньше было: Company (агентство) -> User (сотрудник), Client (компания
заказчика) -> ClientUser (человек заказчика). Это было нужно для модели
"агентство с командой сотрудников обслуживает компании-заказчики".

Теперь: ОДНА таблица User с полем role ('executor' | 'client').
Не нужны Company и Client вообще — это были лишние уровни абстракции
для модели "просто один исполнитель и один заказчик на проект".

Project теперь напрямую ссылается на ДВУХ пользователей:
  - executor_id -> User.id (кто делает работу)
  - client_id   -> User.id (кто принимает работу)

Один User с role='executor' может вести много Project (с разными
клиентами) — это и есть связь "один ко многим", которую ты подтвердил.
=========================================================================
"""

from datetime import datetime, date
from typing import Optional

from sqlalchemy import (
    Column,
    String,
    Integer,
    Boolean,
    Text,
    ForeignKey,
    DateTime,
    UniqueConstraint,
    CheckConstraint,
)
from sqlalchemy.orm import relationship
import uuid

from database import Base


def generate_uuid() -> str:
    """ID генерируется в приложении, не в БД — удобно иметь id объекта
    ДО того, как он сохранён (например, чтобы сослаться на него в той
    же транзакции)."""
    return str(uuid.uuid4())


class User(Base):
    """
    Единственная таблица для людей в системе. role различает, что
    человек может делать:
      'executor' — ведёт проекты, создаёт задачи, отправляет на согласование
      'client'   — смотрит проекты, одобряет/отклоняет задачи

    Один и тот же человек физически не может одновременно быть и тем,
    и другим в этой модели — роль выбирается один раз при регистрации.
    """
    __tablename__ = "user"

    id = Column(String, primary_key=True, default=generate_uuid)
    email = Column(String, nullable=False, unique=True)
    password_hash = Column(String, nullable=False)
    full_name = Column(String, nullable=False)
    avatar_url = Column(String, nullable=True)
    role = Column(String, nullable=False)  # 'executor' | 'client'
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (
        CheckConstraint("role IN ('executor', 'client')", name="ck_user_role"),
    )

    # Аналог: user.projects_as_executor вернёт все Project, где
    # executor_id == user.id (SQLAlchemy сам сделает нужный SELECT).
    # foreign_keys= нужен явно, потому что у Project ДВА ForeignKey
    # на User (executor_id и client_id) — без этого SQLAlchemy не
    # поймёт, какой из них имеется в виду в каждой relationship.
    projects_as_executor = relationship(
        "Project",
        back_populates="executor",
        foreign_keys="Project.executor_id",
    )
    projects_as_client = relationship(
        "Project",
        back_populates="client",
        foreign_keys="Project.client_id",
    )
    assigned_tasks = relationship("Task", back_populates="assignee")


class Project(Base):
    """Проект — теперь напрямую связан с executor и client (оба — User),
    без промежуточных Company/Client."""
    __tablename__ = "project"

    id = Column(String, primary_key=True, default=generate_uuid)
    executor_id = Column(String, ForeignKey("user.id", ondelete="CASCADE"), nullable=False)
    client_id = Column(String, ForeignKey("user.id", ondelete="CASCADE"), nullable=False)
    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    status = Column(String, nullable=False, default="active")
    is_archived = Column(Boolean, nullable=False, default=False)
    share_token = Column(String, nullable=True, unique=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (
        CheckConstraint(
            "status IN ('active', 'on_hold', 'completed', 'archived')",
            name="ck_project_status",
        ),
    )

    # foreign_keys= обязателен с обеих сторон каждой relationship,
    # когда между двумя таблицами больше одной связи (executor_id
    # И client_id оба ведут в user.id) — иначе SQLAlchemy выдаст
    # ошибку "не знаю, какой FK использовать".
    executor = relationship(
        "User", back_populates="projects_as_executor", foreign_keys=[executor_id]
    )
    client = relationship(
        "User", back_populates="projects_as_client", foreign_keys=[client_id]
    )

    stages = relationship(
        "Stage", back_populates="project", cascade="all, delete-orphan",
        order_by="Stage.position",
    )
    activity_logs = relationship("ActivityLog", back_populates="project", cascade="all, delete-orphan")


class Stage(Base):
    """Этап проекта (Брифинг, Прототип, Дизайн...)."""
    __tablename__ = "stage"

    id = Column(String, primary_key=True, default=generate_uuid)
    project_id = Column(String, ForeignKey("project.id", ondelete="CASCADE"), nullable=False)
    name = Column(String, nullable=False)
    position = Column(Integer, nullable=False)
    status = Column(String, nullable=False, default="not_started")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (
        CheckConstraint(
            "status IN ('not_started', 'in_progress', 'completed')",
            name="ck_stage_status",
        ),
    )

    project = relationship("Project", back_populates="stages")
    tasks = relationship(
        "Task", back_populates="stage", cascade="all, delete-orphan",
        order_by="Task.position",
    )


class Task(Base):
    """Задача внутри этапа. Контейнер — раунды согласования живут
    в Approval (см. ниже)."""
    __tablename__ = "task"

    id = Column(String, primary_key=True, default=generate_uuid)
    stage_id = Column(String, ForeignKey("stage.id", ondelete="CASCADE"), nullable=False)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    assignee_id = Column(String, ForeignKey("user.id", ondelete="SET NULL"), nullable=True)
    status = Column(String, nullable=False, default="not_started")
    due_date = Column(DateTime, nullable=True)
    position = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (
        CheckConstraint(
            "status IN ('not_started', 'in_progress', 'pending_approval', "
            "'approved', 'changes_requested')",
            name="ck_task_status",
        ),
    )

    stage = relationship("Stage", back_populates="tasks")
    assignee = relationship("User", back_populates="assigned_tasks")
    approvals = relationship(
        "Approval", back_populates="task", cascade="all, delete-orphan",
        order_by="Approval.round_number",
    )
    files = relationship("File", back_populates="task", cascade="all, delete-orphan")
    comments = relationship(
        "Comment", back_populates="task", cascade="all, delete-orphan",
        order_by="Comment.created_at",
    )


class Approval(Base):
    """
    Один раунд согласования. round_number растёт с каждой новой
    пересылкой задачи клиенту — это и даёт историю "отправили ->
    отклонили -> доработали -> снова отправили".

    submitted_by_user_id и decided_by_user_id — оба ссылаются на User
    (раньше decided_by был на отдельную таблицу ClientUser, теперь
    просто на User с role='client').
    """
    __tablename__ = "approval"

    id = Column(String, primary_key=True, default=generate_uuid)
    task_id = Column(String, ForeignKey("task.id", ondelete="CASCADE"), nullable=False)
    round_number = Column(Integer, nullable=False)
    status = Column(String, nullable=False, default="pending")  # pending|approved|rejected
    submitted_by_user_id = Column(String, ForeignKey("user.id", ondelete="SET NULL"), nullable=True)
    decided_by_user_id = Column(String, ForeignKey("user.id", ondelete="SET NULL"), nullable=True)
    decision_comment = Column(Text, nullable=True)
    submitted_at = Column(DateTime, default=datetime.utcnow)
    decided_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        UniqueConstraint("task_id", "round_number", name="uq_approval_task_round"),
        CheckConstraint("status IN ('pending', 'approved', 'rejected')", name="ck_approval_status"),
    )

    task = relationship("Task", back_populates="approvals")
    files = relationship("File", back_populates="approval", cascade="all, delete-orphan")


class File(Base):
    """Файл — привязан либо к Task (общий файл задачи), либо к Approval
    (версия, отправленная на конкретный раунд согласования). Ровно
    одно из task_id/approval_id должно быть заполнено — это проверяется
    в коде эндпоинта, не в БД."""
    __tablename__ = "file"

    id = Column(String, primary_key=True, default=generate_uuid)
    task_id = Column(String, ForeignKey("task.id", ondelete="CASCADE"), nullable=True)
    approval_id = Column(String, ForeignKey("approval.id", ondelete="CASCADE"), nullable=True)
    uploaded_by_user_id = Column(String, ForeignKey("user.id", ondelete="SET NULL"), nullable=True)
    file_name = Column(String, nullable=False)
    file_url = Column(String, nullable=False)
    file_size_bytes = Column(Integer, nullable=True)
    mime_type = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    task = relationship("Task", back_populates="files")
    approval = relationship("Approval", back_populates="files")


class Comment(Base):
    """Сообщение в истории задачи. author_user_id ссылается на User
    (любой роли) — раньше было два отдельных поля для сотрудника и
    клиента, теперь один и тот же тип ссылки, потому что и executor,
    и client — это просто User с разными role."""
    __tablename__ = "comment"

    id = Column(String, primary_key=True, default=generate_uuid)
    task_id = Column(String, ForeignKey("task.id", ondelete="CASCADE"), nullable=False)
    author_user_id = Column(String, ForeignKey("user.id", ondelete="SET NULL"), nullable=True)
    body = Column(Text, nullable=False)
    is_internal = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    task = relationship("Task", back_populates="comments")


class ActivityLog(Base):
    """Автособытия системы для экрана 'История' (генерируются
    приложением, не пишутся людьми вручную)."""
    __tablename__ = "activity_log"

    id = Column(String, primary_key=True, default=generate_uuid)
    project_id = Column(String, ForeignKey("project.id", ondelete="CASCADE"), nullable=False)
    task_id = Column(String, ForeignKey("task.id", ondelete="CASCADE"), nullable=True)
    actor_user_id = Column(String, ForeignKey("user.id", ondelete="SET NULL"), nullable=True)
    event_type = Column(String, nullable=False)
    event_data = Column(Text, nullable=True)  # JSON-строка с доп. контекстом
    created_at = Column(DateTime, default=datetime.utcnow)

    project = relationship("Project", back_populates="activity_logs")


class Notification(Base):
    """Уведомления — recipient_user_id ссылается на User любой роли."""
    __tablename__ = "notification"

    id = Column(String, primary_key=True, default=generate_uuid)
    recipient_user_id = Column(String, ForeignKey("user.id", ondelete="CASCADE"), nullable=False)
    type = Column(String, nullable=False)
    title = Column(String, nullable=False)
    body = Column(Text, nullable=True)
    related_project_id = Column(String, ForeignKey("project.id", ondelete="CASCADE"), nullable=True)
    related_task_id = Column(String, ForeignKey("task.id", ondelete="CASCADE"), nullable=True)
    is_read = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
