"""
main.py
=======
Здесь два слоя + сама точка входа:

  Pydantic SCHEMAS — форма данных в HTTP request/response. Аналог твоих
  TS interface для API. Паттерн: {Entity}Create (что приходит) /
  {Entity}Out (что уходит обратно, без password_hash и т.п.).

  AUTH-эндпоинты — те же /auth/register и /auth/login, что были раньше,
  адаптированные под новую модель: вместо отдельной регистрации
  "агентства" и "клиента" — ОДИН эндпоинт регистрации с полем role
  ('executor' | 'client'), как у тебя сделано на фронте.

Запуск: uvicorn main:app --reload
"""
import os
import httpx
import uvicorn
from datetime import datetime, timedelta
from typing import Optional, List
import os
import uuid
import shutil
from pathlib import Path
from fastapi import UploadFile, File as FastAPIFile

from fastapi import FastAPI, APIRouter, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session, selectinload
from pydantic import BaseModel, EmailStr, ConfigDict
from jose import jwt, JWTError
from passlib.context import CryptContext
from database import Base, engine, get_db
from models import User, Project, Stage, Task, Approval, File, Comment, ActivityLog, Notification, ProjectExecutor


# =========================================================================
# AUTH SETUP — хеширование паролей и JWT
# =========================================================================
# Установить: pip install "passlib[bcrypt]" "python-jose[cryptography]"

SECRET_KEY = "change-me-to-a-random-secret-in-production"  # в .env в реальном проекте
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # токен живёт 7 дней

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(plain_password: str) -> str:
    return pwd_context.hash(plain_password)


def verify_password(plain_password: str, password_hash: str) -> bool:
    return pwd_context.verify(plain_password, password_hash)


def create_access_token(data: dict) -> str:
    """Упаковывает {"sub": user_id, "role": "executor"|"client"} в
    подписанную строку-токен. Данные внутри читаемы кем угодно (это не
    шифрование), но подпись не даёт их незаметно подделать — поэтому
    сюда никогда не кладём пароли, только id и роль."""
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


# Извлекает токен из заголовка Authorization: Bearer <token>
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> User:
    """
    Dependency-"страж" для защищённых эндпоинтов. Подключается так:

        @app.get("/projects")
        def list_projects(current_user: User = Depends(get_current_user)):
            ...

    FastAPI сам разберёт токен ДО того, как выполнится код эндпоинта.
    Если токен невалиден/просрочен — пользователь получит 401 раньше,
    чем твой код вообще начнёт работать.

    Аналогия из фронтенда: axios interceptor, который проверяет токен
    на каждый запрос — только проверка происходит на сервере, и её
    нельзя обойти, подделав код в браузере.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Не удалось подтвердить личность",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    user = db.query(User).filter(User.id == user_id).first()
    if user is None or not user.is_active:
        raise credentials_exception
    return user


def require_role(*allowed_roles: str):
    """
    Фабрика dependency-функций для проверки роли — пригодится дальше,
    когда будем писать эндпоинты типа "только executor может создать
    проект" или "только client может одобрить задачу".

    Использование:
        @app.post("/projects")
        def create_project(
            current_user: User = Depends(require_role("executor")),
        ):
            ...

    Если у current_user role не входит в allowed_roles — 403 Forbidden
    ещё до выполнения кода эндпоинта.
    """
    def checker(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Доступно только для роли: {', '.join(allowed_roles)}",
            )
        return current_user
    return checker


# =========================================================================
# Pydantic SCHEMAS — auth
# =========================================================================

class RegisterRequest(BaseModel):
    """То, что фронтенд отправляет на /auth/register. role выбирается
    пользователем на экране регистрации (как у тебя на фронте сделано —
    переключатель 'Я исполнитель' / 'Я заказчик')."""
    email: EmailStr
    password: str
    full_name: str
    role: str  # 'executor' | 'client'


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    """Уходит фронтенду после успешного логина/регистрации. Фронт
    кладёт access_token в localStorage и подставляет в заголовок
    каждого следующего запроса: Authorization: Bearer <access_token>."""
    access_token: str
    token_type: str = "bearer"
    role: str


class UserUpdate(BaseModel):
    """Тело запроса для обновления профиля. Оба поля Optional —
    PATCH обновляет только то, что реально передали, а не всё подряд.
    Если бы поля были обязательными, фронту пришлось бы каждый раз
    слать full_name и email вместе, даже если меняется что-то одно."""
    full_name: Optional[str] = None
    email: Optional[EmailStr] = None


class AvatarUpdateRequest(BaseModel):
    """Отдельная схема под отдельный эндпоинт аватарки. avatar_url —
    это ГОТОВАЯ ссылка на картинку (например, из внешнего хостинга
    типа imgur/cloudinary, или из облака, если подключите его позже),
    а не сам файл. Загрузка реального файла с компьютера пользователя —
    это отдельная история (multipart/form-data вместо JSON), сделаем
    её, когда дойдём до загрузки файлов в задачах."""
    avatar_url: str


class UserOut(BaseModel):
    """Намеренно нет password_hash — это никогда не должно уйти в ответ."""
    model_config = ConfigDict(from_attributes=True)

    id: str
    email: EmailStr
    full_name: str
    avatar_url: Optional[str] = None
    role: str
    is_active: bool
    created_at: datetime


# =========================================================================
# FastAPI APP + auth-роутер
# =========================================================================

app = FastAPI(title="Approval Portal API")

# CORS — без этого браузер блокирует запросы с фронтенда (другой порт =
# другой "источник" для браузера, даже если оба на localhost).
# Сначала браузер сам шлёт служебный OPTIONS-запрос ("preflight"),
# спрашивая разрешения, и только потом настоящий POST/GET/etc.
# Без этого middleware FastAPI отвечает на OPTIONS 405 Method Not
# Allowed, и настоящий запрос до кода эндпоинта не доходит вообще.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

auth_router = APIRouter(prefix="/auth", tags=["auth"])


@auth_router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
def register(payload: RegisterRequest, db: Session = Depends(get_db)):
    if payload.role not in ("executor", "client"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="role должен быть 'executor' или 'client'",
        )

    existing = db.query(User).filter(User.email == payload.email).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Пользователь с таким email уже существует",
        )

    user = User(
        email=payload.email,
        password_hash=hash_password(payload.password),
        full_name=payload.full_name,
        role=payload.role,
    )
    db.add(user)
    db.commit()

    # Сразу выдаём токен — после регистрации не нужен отдельный логин,
    # это лишний шаг для UX.
    token = create_access_token({"sub": user.id, "role": user.role})
    return TokenResponse(access_token=token, role=user.role)


@auth_router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email).first()

    # Намеренно одна и та же ошибка для "юзер не найден" и "пароль
    # неверный" — иначе перебором можно узнать, какие email существуют.
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Неверный email или пароль",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Аккаунт деактивирован",
        )

    token = create_access_token({"sub": user.id, "role": user.role})
    return TokenResponse(access_token=token, role=user.role)


@auth_router.get("/me", response_model=UserOut)
def get_my_profile(current_user: User = Depends(get_current_user)):
    """Проверочный эндпоинт: 'кто я сейчас залогинен'. Полезен на
    фронте при загрузке приложения — спросить /auth/me с сохранённым
    токеном и понять, валиден ли он ещё, и какие данные показывать."""
    return current_user


@auth_router.patch("/me", response_model=UserOut)
def update_user_info(
    data: UserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Обновление профиля текущего пользователя.

    Почему PATCH, а не PUT: PATCH означает "обнови только переданные
    поля", PUT по конвенции означает "замени весь объект целиком".
    У нас оба поля Optional именно под PATCH-семантику.

    current_user здесь — это не просто "проверка, что юзер залогинен":
    Depends(get_current_user) вернул реальный SQLAlchemy-объект User,
    привязанный к текущей db-сессии. Поэтому простое присвоение
    current_user.full_name = ... уже "знает", какую строку в БД менять —
    не нужно отдельно делать SELECT по id.
    """
    if data.full_name:
        current_user.full_name = data.full_name

    if data.email:
        # Проверяем, что email не занят КЕМ-ТО ДРУГИМ — User.id != current_user.id
        # обязателен, иначе пользователь не сможет "обновить" профиль,
        # даже не меняя email (он же найдёт сам себя как "существующего").
        existing = (
            db.query(User)
            .filter(User.email == data.email, User.id != current_user.id)
            .first()
        )
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Этот email уже используется другим аккаунтом",
            )
        current_user.email = data.email

    db.commit()
    db.refresh(current_user)  # подтягиваем актуальные данные (updated_at и т.п.)
    return current_user


@auth_router.put("/me/avatar", response_model=UserOut)
def update_avatar(
    data: AvatarUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Обновление ссылки на аватарку. Отдельный эндпоинт, а не часть
    общего PATCH /me — потому что это семантически другое действие
    (полная замена одного конкретного значения), и на фронте у тебя,
    скорее всего, отдельный UI-элемент именно под аватарку (например,
    кружок с фото и кнопка "изменить" под ним), а не часть формы
    "редактировать профиль".

    PUT, а не PATCH: PUT означает "вот новое значение этого ресурса
    целиком", что точно описывает замену avatar_url — нет смысла
    в частичном обновлении одного-единственного поля.
    """
    current_user.avatar_url = data.avatar_url
    db.commit()
    db.refresh(current_user)
    return current_user


@auth_router.delete("/me/avatar", response_model=UserOut)
def delete_avatar(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Убирает аватарку — просто сбрасывает поле в NULL. Полезно для
    кнопки 'Удалить фото' в настройках профиля."""
    current_user.avatar_url = None
    db.commit()
    db.refresh(current_user)
    return current_user


app.include_router(auth_router)


# =========================================================================
# Pydantic SCHEMAS — Project
# =========================================================================

class ProjectCreate(BaseModel):
    """То, что executor отправляет при создании проекта. client_email —
    это email уже зарегистрированного пользователя с role='client',
    а не сам client_id — так удобнее на фронте (executor вводит email
    в текстовое поле, а не выбирает UUID из списка)."""
    name: str
    description: Optional[str] = None
    client_email: EmailStr

class ProjectUpdate(BaseModel):
    """Все поля Optional — PATCH обновляет только переданное.
    Отдельная схема от ProjectCreate: там обязателен client_email
    (создание проекта), здесь его вообще нет (клиента на проекте
    не меняем этим эндпоинтом)."""
    name: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None  # 'active' | 'completed' | 'on_hold'
    is_archived: Optional[bool] = None
class ProjectOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    executor_id: str
    client_id: str
    name: str
    description: Optional[str] = None
    status: str
    is_archived: bool
    created_at: datetime
    updated_at: datetime
    stages: List["StageOut"] = []


class ProjectDetailOut(ProjectOut):
    """Расширенная версия для экрана 'Project Detail' — сразу с данными
    исполнителя и заказчика, чтобы фронту не делать два отдельных
    запроса на /auth/me-подобные эндпоинты для каждого из них."""
    executor: UserOut
    client: UserOut


# =========================================================================
# РОУТЕР: /projects
# =========================================================================

projects_router = APIRouter(prefix="/projects", tags=["projects"])


@projects_router.post("", response_model=ProjectDetailOut, status_code=status.HTTP_201_CREATED)
def create_project(
    payload: ProjectCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Создание проекта. current_user (тот, кто прислал запрос) становится
    executor — он же создатель проекта. client ищется по email среди
    уже зарегистрированных пользователей.

    Пока без require_role("executor") — по твоему решению на этом этапе
    любой залогиненный пользователь может создать проект. Когда понадобится
    ограничить это только executor'ами, замена тривиальна:
        current_user: User = Depends(require_role("executor"))
    вместо текущей строки — require_role уже определён выше в файле.
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


@projects_router.get("", response_model=List[ProjectOut])
def list_projects(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Список всех проектов — пока без фильтрации по владельцу (по
    твоему решению, на этапе теста всем видны все проекты).

    Когда понадобится разделить видимость (executor видит только свои
    проекты как executor, client — только свои как client), здесь
    добавится фильтр, примерно так:

        from sqlalchemy import or_
        projects = (
            db.query(Project)
            .filter(or_(
                Project.executor_id == current_user.id,
                Project.client_id == current_user.id,
            ))
            .all()
        )

    current_user пока не используется в теле функции — оставлен только
    как Depends(get_current_user), то есть как проверка "доступ только
    для залогиненных", без влияния на сам результат запроса.
    """
    projects = (
    db.query(Project)
    .options(selectinload(Project.stages))
    .order_by(Project.created_at.desc())
    .all()
    )

    return projects


@projects_router.get("/{project_id}", response_model=ProjectDetailOut)
def get_project(
    project_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Один проект по id, со вложенными данными executor и client —
    нужно для экрана Project Detail (заголовок с именами обоих участников)."""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Проект не найден",
        )
    return project
@projects_router.patch("/{project_id}", response_model=ProjectDetailOut)
def update_project(
    project_id: str,
    payload: ProjectUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Изменение статуса/данных проекта. Только владелец (executor_id) —
    по аналогии с проверкой в add_project_executor. client и
    дополнительные исполнители статус менять не могут: решение о
    завершении/паузе проекта — прерогатива того, кто им управляет.
    """
    project = _get_project_or_404(project_id, db)

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
@projects_router.delete("/{project_id}")
def delete_project(
    project_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = (
        db.query(Project)
        .filter(Project.id == project_id)
        .first()
    )
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Проект не найден")
    db.delete(project)
    db.commit()
    return None

#  @stages_router.delete("/{stage_id}", status_code=status.HTTP_204_NO_CONTENT)
# def delete_stage(
#     project_id: str,
#     stage_id: str,
#     db: Session = Depends(get_db),
#     current_user: User = Depends(get_current_user),
#     _project: Project = Depends(require_project_access)
# ):
#     """Удаляет этап. cascade="all, delete-orphan" в models.py означает,
#     что все Task внутри этого этапа удалятся автоматически вместе с ним —
#     об этом стоит предупреждать пользователя на фронте перед удалением."""
#     stage = (
#         db.query(Stage)
#         .filter(Stage.id == stage_id, Stage.project_id == project_id)
#         .first()
#     )
#     if not stage:
#         raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Этап не найден")

#     db.delete(stage)
#     db.commit()
#     return None


app.include_router(projects_router)


# =========================================================================
# Pydantic SCHEMAS — Stage
# =========================================================================

class StageCreate(BaseModel):
    """position не передаётся явно — вычисляется на сервере как
    'следующий после последнего существующего этапа в проекте',
    чтобы фронту не нужно было самому считать порядковый номер."""
    name: str


class StageUpdate(BaseModel):
    """Всё Optional — PATCH обновляет только переданные поля."""
    name: Optional[str] = None
    status: Optional[str] = None  # 'not_started' | 'in_progress' | 'completed'


class StageReorderItem(BaseModel):
    """Один элемент списка нового порядка этапов."""
    id: str
    position: int


class StageReorderRequest(BaseModel):
    """Тело запроса для drag-and-drop: фронт после перетаскивания
    присылает ВЕСЬ новый порядок целиком — список {id, position} для
    каждого этапа проекта. Так надёжнее, чем пересчитывать сдвиги
    на сервере по одному измененному элементу."""
    stages: List[StageReorderItem]


class StageOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    project_id: str
    name: str
    position: int
    status: str
    created_at: datetime


ProjectOut.model_rebuild()


GROQ_API_KEY = ""

@app.get("/tasks/{task_id}/ai-summary")
async def get_ai_summary(task_id: str, db: Session = Depends(get_db)):
    task = db.query(Task).get(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Задача не найдена")

    comments = db.query(Comment).filter(Comment.task_id == task_id).all()
    comments_text = "\n".join(
        f"{c.author.full_name if c.author else 'Unknown'}: {c.body}"
        for c in comments
    ) or "нет комментариев"

    prompt = f"""Кратко (2-3 предложения) опиши суть задачи и её текущий статус 
для человека, который должен её утвердить или отклонить.

Задача: {task.title}
Описание: {task.description}
Комментарии:
{comments_text}
"""

    async with httpx.AsyncClient() as client:
        resp = await client.post(
            "https://api.groq.com/openai/v1/chat/completions",
            headers={"Authorization": f"Bearer {GROQ_API_KEY}", "Content-Type": "application/json"},
            json={"model": "llama-3.3-70b-versatile", "max_tokens": 200, "messages": [{"role": "user", "content": prompt}]},
        )
        data = resp.json()
        return {"summary": data["choices"][0]["message"]["content"]}

# =========================================================================
# РОУТЕР: /projects/{project_id}/stages
# =========================================================================
# Вложенный путь — этапы всегда существуют в контексте конкретного
# проекта, поэтому project_id явно виден в самом URL, а не только
# в теле запроса. Это REST-конвенция для вложенных сущностей.



stages_router = APIRouter(prefix="/projects/{project_id}/stages", tags=["stages"])


def _get_project_or_404(project_id: str, db: Session) -> Project:
    """Общая проверка, что проект существует — переиспользуется в
    каждом эндпоинте этого роутера, чтобы не дублировать одинаковый
    if not project: raise HTTPException(...) четыре раза."""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Проект не найден",
        )
    return project
def require_project_access(
    project_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Project:
    """
    Единая проверка доступа для ВСЕХ вложенных роутов проекта
    (stages, tasks, comments, files, executors).

    FastAPI подставляет project_id автоматически — он берётся из URL
    пути, даже если этот путь вложенный, например
    /projects/{project_id}/stages/{stage_id}/tasks/{task_id}/comments —
    project_id всё равно доступен по имени параметра.

    Используется как доп. Depends в каждом эндпоинте, где project_id
    есть в пути:

        @some_router.get("/...")
        def some_endpoint(
            project_id: str,
            ...,
            _project: Project = Depends(require_project_access),
        ):
            ...

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

@stages_router.post("", response_model=StageOut, status_code=status.HTTP_201_CREATED)
def create_stage(
    project_id: str,
    payload: StageCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _project: Project = Depends(require_project_access)
):
    """
    Создаёт новый этап в конце списка существующих этапов проекта.

    position вычисляется как (максимальный текущий position + 1) —
    если этапов пока нет, max(...) вернёт None, поэтому используем
    "or -1", чтобы первый этап получил position = 0.
    """
    _get_project_or_404(project_id, db)

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


@stages_router.get("", response_model=List[StageOut])
def list_stages(
    project_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _project: Project = Depends(require_project_access)
):
    """Список этапов проекта, отсортированный по position — это и
    есть порядок, в котором рисуется степпер на фронте."""
    _get_project_or_404(project_id, db)
    stages = (
        db.query(Stage)
        .filter(Stage.project_id == project_id)
        .order_by(Stage.position)
        .all()
    )
    return stages


@stages_router.patch("/{stage_id}", response_model=StageOut)
def update_stage(
    project_id: str,
    stage_id: str,
    payload: StageUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _project: Project = Depends(require_project_access)
):
    """Переименование этапа и/или смена статуса (например, когда
    задачи внутри этапа все выполнены — фронт шлёт status='completed')."""
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


@stages_router.put("/reorder", response_model=List[StageOut])
def reorder_stages(
    project_id: str,
    payload: StageReorderRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _project: Project = Depends(require_project_access)
):
    """
    Применяет новый порядок этапов после drag-and-drop на фронте.

    Путь /reorder идёт ПЕРЕД /{stage_id} в файле специально не нужен —
    FastAPI матчит по точному совпадению сегмента пути, "reorder" не
    спутается с UUID в /{stage_id}, поэтому порядок объявления здесь
    не важен (в отличие от некоторых других фреймворков).
    """
    _get_project_or_404(project_id, db)

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


@stages_router.delete("/{stage_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_stage(
    project_id: str,
    stage_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _project: Project = Depends(require_project_access)
):
    """Удаляет этап. cascade="all, delete-orphan" в models.py означает,
    что все Task внутри этого этапа удалятся автоматически вместе с ним —
    об этом стоит предупреждать пользователя на фронте перед удалением."""
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


app.include_router(stages_router)


# =========================================================================
# Pydantic SCHEMAS — Task
# =========================================================================

class TaskCreate(BaseModel):
    title: str
    description: Optional[str] = None
    assignee_id: Optional[str] = None
    due_date: Optional[datetime] = None


class TaskUpdate(BaseModel):
    """Все поля Optional — PATCH обновляет только переданное.
    Статус сюда НЕ входит намеренно: статус задачи меняется только
    через действия с Approval (send-for-approval/decide), а не прямым
    PATCH — иначе можно было бы случайно поставить status='approved'
    мимо реального согласования с клиентом."""
    title: Optional[str] = None
    description: Optional[str] = None
    assignee_id: Optional[str] = None
    due_date: Optional[datetime] = None


class TaskOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    stage_id: str
    title: str
    description: Optional[str] = None
    assignee_id: Optional[str] = None
    # Вложенный объект — НЕ просто assignee_id, а сразу полные данные
    # пользователя (avatar_url, full_name), чтобы фронту не пришлось
    # отдельным запросом дотягивать аватарку по id для каждой задачи.
    # Optional, потому что assignee_id сам по себе nullable — задача
    # может быть вообще без назначенного исполнителя.
    assignee: Optional[UserOut] = None
    status: str
    position: int
    due_date: Optional[datetime] = None  
    created_at: datetime


# =========================================================================
# Pydantic SCHEMAS — Approval
# =========================================================================

class ApprovalDecision(BaseModel):
    """Тело запроса, когда client жмёт Approve / Request Changes."""
    status: str  # 'approved' | 'rejected'
    decision_comment: Optional[str] = None  # имеет смысл заполнять при rejected


class ApprovalOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    task_id: str
    round_number: int
    status: str
    submitted_by_user_id: Optional[str] = None
    decided_by_user_id: Optional[str] = None
    decision_comment: Optional[str] = None
    submitted_at: datetime
    decided_at: Optional[datetime] = None


class TaskDetailOut(TaskOut):
    """Для экрана Task Detail — сразу со всей историей раундов
    согласования, чтобы фронту не делать отдельный запрос."""
    approvals: List[ApprovalOut] = []


# =========================================================================
# РОУТЕР: /projects/{project_id}/stages/{stage_id}/tasks
# =========================================================================

tasks_router = APIRouter(
    prefix="/projects/{project_id}/stages/{stage_id}/tasks", tags=["tasks"]
)


def _get_stage_or_404(project_id: str, stage_id: str, db: Session) -> Stage:
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


def _get_task_or_404(stage_id: str, task_id: str, db: Session) -> Task:
    task = db.query(Task).filter(Task.id == task_id, Task.stage_id == stage_id).first()
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Задача не найдена")
    return task


@tasks_router.post("", response_model=TaskOut, status_code=status.HTTP_201_CREATED)
def create_task(
    project_id: str,
    stage_id: str,
    payload: TaskCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("executor")),
    _project: Project = Depends(require_project_access)
):
    """Создание задачи — только executor (по твоему решению на этом
    этапе). require_role("executor") вернёт 403 раньше, чем выполнится
    хоть строчка этого кода, если зайдёт client."""
    _get_stage_or_404(project_id, stage_id, db)

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


@tasks_router.get("", response_model=List[TaskOut])
def list_tasks(
    project_id: str,
    stage_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _project: Project = Depends(require_project_access)
):
    """Список задач этапа — доступен и executor, и client (оба могут
    смотреть), поэтому здесь обычный get_current_user, без require_role."""
    _get_stage_or_404(project_id, stage_id, db)
    tasks = (
        db.query(Task)
        .filter(Task.stage_id == stage_id)
        .order_by(Task.position)
        .all()
    )
    return tasks


@tasks_router.get("/{task_id}", response_model=TaskDetailOut)
def get_task(
    project_id: str,
    stage_id: str,
    task_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _project: Project = Depends(require_project_access)
):
    """Одна задача со всей историей раундов согласования — для
    экрана Task Detail."""
    _get_stage_or_404(project_id, stage_id, db)
    task = _get_task_or_404(stage_id, task_id, db)
    return task


@tasks_router.patch("/{task_id}", response_model=TaskOut)
def update_task(
    project_id: str,
    stage_id: str,
    task_id: str,
    payload: TaskUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("executor")),
    _project: Project = Depends(require_project_access)
):
    """Редактирование задачи — только executor."""
    _get_stage_or_404(project_id, stage_id, db)
    task = _get_task_or_404(stage_id, task_id, db)

    if payload.title is not None:
        task.title = payload.title
    if payload.description is not None:
        task.description = payload.description
    if payload.assignee_id is not None:
        task.assignee_id = payload.assignee_id

    db.commit()
    db.refresh(task)
    return task


@tasks_router.delete("/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_task(
    project_id: str,
    stage_id: str,
    task_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("executor")),
    _project: Project = Depends(require_project_access)
):
    """Удаление задачи — только executor. cascade в models.py удалит
    вместе с ней все Approval, File, Comment, привязанные к ней."""
    _get_stage_or_404(project_id, stage_id, db)
    task = _get_task_or_404(stage_id, task_id, db)
    db.delete(task)
    db.commit()
    return None


# =========================================================================
# Approval-эндпоинты — ядро бизнес-логики продукта
# =========================================================================
# Поток:
#   1. executor отправляет задачу на согласование -> создаётся Approval
#      со status='pending', round_number=1 (или +1, если это уже не
#      первая попытка), task.status становится 'pending_approval'
#   2. client принимает решение -> approved или rejected:
#      - approved: task.status = 'approved', раунд закрывается
#      - rejected: task.status = 'changes_requested', раунд закрывается,
#        но задачу можно отправить на согласование СНОВА — это создаст
#        новый Approval с round_number + 1


@tasks_router.post(
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
    status='pending', значит она уже ждёт решения клиента — отправлять
    второй раз бессмысленно (и создало бы дубль raund_number,
    нарушив UniqueConstraint в БД).
    """
    project = _get_project_or_404(project_id, db)
    _get_stage_or_404(project_id, stage_id, db)
    task = _get_task_or_404(stage_id, task_id, db)

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

    # task.status — это denormalized-кэш текущего состояния (см.
    # объяснение в models.py/schema.sql), держим его синхронным
    # с реальным состоянием в Approval.
    task.status = "pending_approval"
    log_activity(db, project_id, "approval_requested", actor_user_id=current_user.id,
                 task_id=task_id, event_data={"task_title": task.title, "round": next_round})
    create_notification(                              # ← добавить
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

@tasks_router.post("/{task_id}/approvals/{approval_id}/decide", response_model=ApprovalOut)
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

    require_role("client") — только заказчик может принимать решение,
    executor сюда не должен иметь доступа (логично: нельзя самому
    себе одобрить свою же работу).
    """
    if payload.status not in ("approved", "rejected"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="status должен быть 'approved' или 'rejected'",
        )

    stage = _get_stage_or_404(project_id, stage_id, db)
    task = _get_task_or_404(stage_id, task_id, db)

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

    # Синхронизируем denormalized task.status с решением по раунду —
    # 'approved' -> задача готова, 'rejected' -> задача возвращается
    # executor'у на доработку (и может быть отправлена на новый раунд).
    task.status = "approved" if payload.status == "approved" else "changes_requested"
    log_activity(db, project_id, "approval_decided", actor_user_id=current_user.id,
                 task_id=task_id, event_data={"status": payload.status, "comment": payload.decision_comment})
    create_notification(                              # ← добавить
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
    # Если да — весь stage переходит в статус "fully_approved"
    # (фиолетовый на фронте). Если хотя бы одна задача не approved —
    # stage откатывается на "in_progress" (актуально для случая,
    # когда клиент отклонил задачу ПОСЛЕ того, как этап уже был
    # fully_approved — например, при повторном раунде согласования).
    # ---------------------------------------------------------------
    all_tasks = db.query(Task).filter(Task.stage_id == stage_id).all()

    if all_tasks and all(t.status == "approved" for t in all_tasks):
        stage.status = "fully_approved"
    elif stage.status == "fully_approved":
        # Была фиолетовой, но что-то снова не approved — снимаем статус
        stage.status = "in_progress"

    db.commit()

    return approval


app.include_router(tasks_router)

# =========================================================================
# Pydantic SCHEMAS — Comment
# =========================================================================

class CommentCreate(BaseModel):
    body: str
    # is_internal — заметка "только для команды исполнителя", клиент её
    # не должен видеть и не должен иметь возможность её создать (см.
    # проверку в create_comment ниже).
    is_internal: bool = False


class CommentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    task_id: str
    author_user_id: Optional[str] = None
    author: Optional[UserOut] = None
    body: str
    is_internal: bool
    created_at: datetime


# =========================================================================
# РОУТЕР: /projects/{project_id}/stages/{stage_id}/tasks/{task_id}/comments
# =========================================================================

comments_router = APIRouter(
    prefix="/projects/{project_id}/stages/{stage_id}/tasks/{task_id}/comments",
    tags=["comments"],
)


@comments_router.post("", response_model=CommentOut, status_code=status.HTTP_201_CREATED)
def create_comment(
    project_id: str,
    stage_id: str,
    task_id: str,
    payload: CommentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _project: Project = Depends(require_project_access)
):
    """
    Создать комментарий к задаче. Доступно и executor, и client —
    оба должны иметь возможность обсуждать задачу.

    is_internal форсируется в False для client — заметки "только для
    своей команды" не имеют смысла со стороны заказчика, и client не
    должен даже случайно пометить свой комментарий как internal.
    """
    project = _get_project_or_404(project_id, db)   
    _get_stage_or_404(project_id, stage_id, db)
    _get_task_or_404(stage_id, task_id, db)

    is_internal = payload.is_internal if current_user.role == "executor" else False

    comment = Comment(
        task_id=task_id,
        author_user_id=current_user.id,
        body=payload.body,
        is_internal=is_internal,
    )
    if not is_internal:
            recipient_id = project.client_id if current_user.role == "executor" else project.executor_id
            create_notification(                            # ← добавить
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


@comments_router.get("", response_model=List[CommentOut])
def list_comments(
    project_id: str,
    stage_id: str,
    task_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _project: Project = Depends(require_project_access)
):
    """
    Список комментариев задачи, от старых к новым.

    Client не видит is_internal-комментарии вообще — фильтруем на
    уровне запроса, а не просто скрываем на фронте, чтобы данные не
    утекали в сетевой ответ клиенту.
    """
    _get_stage_or_404(project_id, stage_id, db)
    _get_task_or_404(stage_id, task_id, db)

    query = db.query(Comment).filter(Comment.task_id == task_id)

    if current_user.role == "client":
        query = query.filter(Comment.is_internal == False)  # noqa: E712

    comments = query.order_by(Comment.created_at).all()
    return comments


@comments_router.delete("/{comment_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_comment(
    project_id: str,
    stage_id: str,
    task_id: str,
    comment_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _project: Project = Depends(require_project_access)
):
    """Удалить комментарий — может только автор. Проверка по
    author_user_id, а не по роли, чтобы никто не удалял чужие
    сообщения (даже executor не может стереть комментарий client'а)."""
    _get_stage_or_404(project_id, stage_id, db)
    _get_task_or_404(stage_id, task_id, db)

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


app.include_router(comments_router)

# =========================================================================
# Pydantic SCHEMAS — Project Executors
# =========================================================================

class ProjectExecutorAdd(BaseModel):
    """Добавление исполнителя в проект — по email, как и при создании
    самого проекта (client_email), для единообразия UX."""
    email: EmailStr


class ProjectExecutorOut(BaseModel):
    """Один исполнитель проекта — с флагом is_owner, чтобы фронт мог
    визуально отличить основного исполнителя (создателя проекта) от
    добавленных позже коллег, и не давать их удалить."""
    id: str  # id пользователя (User.id) — то, что явно просили "видно ID"
    full_name: str
    email: EmailStr
    avatar_url: Optional[str] = None
    is_owner: bool
    added_at: datetime


# =========================================================================
# РОУТЕР: /projects/{project_id}/executors
# =========================================================================

project_executors_router = APIRouter(
    prefix="/projects/{project_id}/executors", tags=["project-executors"]
)


@project_executors_router.get("", response_model=List[ProjectExecutorOut])
def list_project_executors(
    project_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _project: Project = Depends(require_project_access)
):
    """
    Все исполнители проекта: сначала владелец (Project.executor_id),
    затем все из project_executor. Owner идёт первым и помечен
    is_owner=True — фронт может показать его иначе (например, без
    кнопки "удалить").
    """
    project = _get_project_or_404(project_id, db)

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


@project_executors_router.post("", response_model=ProjectExecutorOut, status_code=status.HTTP_201_CREATED)
def add_project_executor(
    project_id: str,
    payload: ProjectExecutorAdd,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("executor")),
    _project: Project = Depends(require_project_access)
):
    """
    Добавить исполнителя в проект по email. Только executor может это
    делать (по аналогии с create_project — require_role("executor")).

    Не проверяем, что current_user — именно владелец ЭТОГО проекта:
    по твоему решению на этом этапе любой executor может добавлять
    коллег в любой проект. Если нужно ограничить только владельцем —
    добавь проверку project.executor_id == current_user.id (см. TODO
    ниже) — тривиальная правка, если понадобится ужесточить позже.
    """
    project = _get_project_or_404(project_id, db)

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
    create_notification(                                # ← добавить
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


@project_executors_router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_project_executor(
    project_id: str,
    user_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("executor")),
    _project: Project = Depends(require_project_access)
):
    """
    Удалить исполнителя из проекта. Владельца (Project.executor_id)
    удалить так нельзя — это архитектурно "тот, кто ведёт проект",
    убрать его отсюда значило бы обезглавить проект. Если нужно сменить
    владельца — это отдельная операция (например, PATCH /projects/{id}
    с новым executor_id), сюда не относится.
    """
    project = _get_project_or_404(project_id, db)
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


app.include_router(project_executors_router)
# =========================================================================
# FILE — загрузка и получение файлов
# =========================================================================
# Файлы хранятся на диске в папке uploads/.
# В БД хранится только путь к файлу (file_url) — сам файл в БД не кладём.
#
# Структура папок на диске:
#   uploads/tasks/{task_id}/           <- файлы задачи
#   uploads/approvals/{approval_id}/   <- файлы конкретного раунда
#
# Разделение по папкам важно — так легче найти все файлы конкретной
# задачи или раунда, и легче удалить их при удалении родителя.

UPLOAD_DIR = Path("uploads")
UPLOAD_DIR.mkdir(exist_ok=True)  # создать папку если её нет

# Разрешённые типы файлов — защита от загрузки исполняемых файлов.
# Расширяй по необходимости, но не убирай эту проверку совсем.
ALLOWED_MIME_TYPES = {
    "image/jpeg", "image/png", "image/gif", "image/webp",
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "text/plain",
    "application/zip",
}

MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB


class FileOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    task_id: Optional[str] = None
    approval_id: Optional[str] = None
    uploaded_by_user_id: Optional[str] = None
    file_name: str
    file_url: str
    file_size_bytes: Optional[int] = None
    mime_type: Optional[str] = None
    created_at: datetime


files_router = APIRouter(
    prefix="/projects/{project_id}/stages/{stage_id}/tasks/{task_id}",
    tags=["files"],
)


@files_router.post("/files", response_model=FileOut, status_code=status.HTTP_201_CREATED)
async def upload_file_to_task(
    project_id: str,
    stage_id: str,
    task_id: str,
    file: UploadFile = FastAPIFile(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _project: Project = Depends(require_project_access)
):
    """
    Загрузить файл к задаче (не к конкретному раунду, а к задаче целиком).
    Используется для общих файлов: брифов, референсов, исходников.

    Принимает multipart/form-data — не JSON!
    На фронте нужно использовать FormData:

        const form = new FormData();
        form.append('file', fileInput.files[0]);
        await API.post(`/projects/.../tasks/${taskId}/files`, form, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });
    """
    _get_stage_or_404(project_id, stage_id, db)
    _get_task_or_404(stage_id, task_id, db)

    # Проверяем тип файла
    if file.content_type not in ALLOWED_MIME_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Тип файла не поддерживается: {file.content_type}",
        )

    # Читаем файл в память чтобы проверить размер
    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Файл слишком большой. Максимум {MAX_FILE_SIZE // (1024*1024)} MB",
        )

    # Создаём папку для задачи и сохраняем файл с уникальным именем.
    # uuid4() в имени файла защищает от коллизий (два файла с одинаковым
    # именем не перезапишут друг друга) и от path traversal атак
    # (злоумышленник не может загрузить файл с именем "../../важный_файл").
    task_upload_dir = UPLOAD_DIR / "tasks" / task_id
    task_upload_dir.mkdir(parents=True, exist_ok=True)

    file_ext = Path(file.filename).suffix  # ".jpg", ".pdf" и т.п.
    unique_filename = f"{uuid.uuid4()}{file_ext}"
    file_path = task_upload_dir / unique_filename

    with open(file_path, "wb") as f:
        f.write(content)

    # Сохраняем запись в БД — только путь, не сам файл
    db_file = File(
        task_id=task_id,
        uploaded_by_user_id=current_user.id,
        file_name=file.filename,       # оригинальное имя для отображения
        file_url=str(file_path),       # путь на диске для скачивания
        file_size_bytes=len(content),
        mime_type=file.content_type,
    )
    db.add(db_file)
    db.commit()
    db.refresh(db_file)
    return db_file


@files_router.post(
    "/approvals/{approval_id}/files",
    response_model=FileOut,
    status_code=status.HTTP_201_CREATED,
)
async def upload_file_to_approval(
    project_id: str,
    stage_id: str,
    task_id: str,
    approval_id: str,
    file: UploadFile = FastAPIFile(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("executor")),
    _project: Project = Depends(require_project_access)
):
    """
    Загрузить файл к конкретному раунду согласования.
    Используется для отправки версий работы (v1, v2, v3...).
    Только executor может загружать файлы к раунду.
    """
    _get_stage_or_404(project_id, stage_id, db)
    _get_task_or_404(stage_id, task_id, db)

    approval = (
        db.query(Approval)
        .filter(Approval.id == approval_id, Approval.task_id == task_id)
        .first()
    )
    if not approval:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Раунд не найден")

    if file.content_type not in ALLOWED_MIME_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Тип файла не поддерживается: {file.content_type}",
        )

    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Файл слишком большой. Максимум {MAX_FILE_SIZE // (1024*1024)} MB",
        )

    approval_upload_dir = UPLOAD_DIR / "approvals" / approval_id
    approval_upload_dir.mkdir(parents=True, exist_ok=True)

    file_ext = Path(file.filename).suffix
    unique_filename = f"{uuid.uuid4()}{file_ext}"
    file_path = approval_upload_dir / unique_filename

    with open(file_path, "wb") as f:
        f.write(content)

    db_file = File(
        approval_id=approval_id,
        uploaded_by_user_id=current_user.id,
        file_name=file.filename,
        file_url=str(file_path),
        file_size_bytes=len(content),
        mime_type=file.content_type,
    )
    db.add(db_file)
    db.commit()
    db.refresh(db_file)
    return db_file


@files_router.get("/approvals/{approval_id}/files", response_model=List[FileOut])
def list_approval_files(
    project_id: str,
    stage_id: str,
    task_id: str,
    approval_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _project: Project = Depends(require_project_access)
):
    """Список файлов конкретного раунда согласования."""
    _get_stage_or_404(project_id, stage_id, db)
    _get_task_or_404(stage_id, task_id, db)

    files = (
        db.query(File)
        .filter(File.approval_id == approval_id)
        .order_by(File.created_at.desc())
        .all()
    )
    return files


@files_router.delete(
    "/approvals/{approval_id}/files/{file_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_approval_file(
    project_id: str,
    stage_id: str,
    task_id: str,
    approval_id: str,
    file_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("executor")),
    _project: Project = Depends(require_project_access)
):
    """Удалить файл раунда — только executor."""
    db_file = (
        db.query(File)
        .filter(File.id == file_id, File.approval_id == approval_id)
        .first()
    )
    if not db_file:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Файл не найден")

    file_path = Path(db_file.file_url)
    if file_path.exists():
        file_path.unlink()

    db.delete(db_file)
    db.commit()
    return None


@files_router.get("/approvals/{approval_id}/files/{file_id}/download")
def download_approval_file(
    project_id: str,
    stage_id: str,
    task_id: str,
    approval_id: str,
    file_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _project: Project = Depends(require_project_access)
):
    """Скачать файл раунда."""
    db_file = (
        db.query(File)
        .filter(File.id == file_id, File.approval_id == approval_id)
        .first()
    )
    if not db_file:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Файл не найден")

    file_path = Path(db_file.file_url)
    if not file_path.exists():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Файл не найден на диске")

    return FileResponse(path=file_path, filename=db_file.file_name, media_type=db_file.mime_type)


@files_router.get("/files", response_model=List[FileOut])
def list_task_files(
    project_id: str,
    stage_id: str,
    task_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _project: Project = Depends(require_project_access)
):
    """Список всех файлов задачи (без файлов конкретных раундов)."""
    _get_stage_or_404(project_id, stage_id, db)
    _get_task_or_404(stage_id, task_id, db)

    files = (
        db.query(File)
        .filter(File.task_id == task_id)
        .order_by(File.created_at.desc())
        .all()
    )
    return files


@files_router.delete("/files/{file_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_file(
    project_id: str,
    stage_id: str,
    task_id: str,
    file_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _project: Project = Depends(require_project_access)
):
    """
    Удалить файл — из БД и с диска.
    Важно удалять и там, и там: если удалить только из БД, файл
    останется на диске и будет занимать место. Если только с диска —
    в БД будет "битая" ссылка.
    """
    db_file = (
        db.query(File)
        .filter(File.id == file_id, File.task_id == task_id)
        .first()
    )
    if not db_file:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Файл не найден")

    # Удаляем с диска если файл там ещё есть
    file_path = Path(db_file.file_url)
    if file_path.exists():
        file_path.unlink()  # unlink = удалить файл (не папку)

    db.delete(db_file)
    db.commit()
    return None


# Отдаём файл для скачивания — FastAPI сам поставит правильные заголовки
from fastapi.responses import FileResponse

@files_router.get("/files/{file_id}/download")
def download_file(
    project_id: str,
    stage_id: str,
    task_id: str,
    file_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _project: Project = Depends(require_project_access)
):
    """
    Скачать файл. Возвращает сам файл, а не JSON.
    На фронте используй как href ссылку или через window.open().
    """
    db_file = (
        db.query(File)
        .filter(File.id == file_id, File.task_id == task_id)
        .first()
    )
    if not db_file:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Файл не найден")

    file_path = Path(db_file.file_url)
    if not file_path.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Файл не найден на диске",
        )

    return FileResponse(
        path=file_path,
        filename=db_file.file_name,   # оригинальное имя при скачивании
        media_type=db_file.mime_type,
    )


app.include_router(files_router)


# =========================================================================
# Файлы на уровне Stage — привязаны напрямую к stage_id
# =========================================================================

stage_files_router = APIRouter(
    prefix="/projects/{project_id}/stages/{stage_id}/files",
    tags=["files"],
)


@stage_files_router.post("", response_model=FileOut, status_code=status.HTTP_201_CREATED)
async def upload_file_to_stage(
    project_id: str,
    stage_id: str,
    file: UploadFile = FastAPIFile(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _project: Project = Depends(require_project_access)
):
    """
    Загрузить файл к этапу — для вкладки Files на уровне Stage.
    Эти файлы не привязаны к конкретной задаче, это общие файлы этапа
    (например, общий бриф на весь дизайн-этап, референсы и т.п.).
    """
    _get_project_or_404(project_id, db)
    stage = (
        db.query(Stage)
        .filter(Stage.id == stage_id, Stage.project_id == project_id)
        .first()
    )
    if not stage:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Этап не найден")

    if file.content_type not in ALLOWED_MIME_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Тип файла не поддерживается: {file.content_type}",
        )

    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Файл слишком большой. Максимум {MAX_FILE_SIZE // (1024*1024)} MB",
        )

    stage_upload_dir = UPLOAD_DIR / "stages" / stage_id
    stage_upload_dir.mkdir(parents=True, exist_ok=True)

    file_ext = Path(file.filename).suffix
    unique_filename = f"{uuid.uuid4()}{file_ext}"
    file_path = stage_upload_dir / unique_filename

    with open(file_path, "wb") as f:
        f.write(content)

    db_file = File(
        stage_id=stage_id,          # привязка к этапу, не к задаче
        task_id=None,
        approval_id=None,
        uploaded_by_user_id=current_user.id,
        file_name=file.filename,
        file_url=str(file_path),
        file_size_bytes=len(content),
        mime_type=file.content_type,
    )
    db.add(db_file)
    db.commit()
    db.refresh(db_file)
    return db_file


@stage_files_router.get("", response_model=List[FileOut])
def list_stage_files(
    project_id: str,
    stage_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _project: Project = Depends(require_project_access)
):
    """
    Список файлов этапа — только те, что привязаны к stage_id напрямую.
    Файлы задач сюда не попадают — они живут отдельно.
    """
    _get_project_or_404(project_id, db)
    files = (
        db.query(File)
        .filter(File.stage_id == stage_id)
        .order_by(File.created_at.desc())
        .all()
    )
    return files


@stage_files_router.delete("/{file_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_stage_file(
    project_id: str,
    stage_id: str,
    file_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _project: Project = Depends(require_project_access)
):
    """Удалить файл этапа — из БД и с диска."""
    db_file = (
        db.query(File)
        .filter(File.id == file_id, File.stage_id == stage_id)
        .first()
    )
    if not db_file:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Файл не найден")

    file_path = Path(db_file.file_url)
    if file_path.exists():
        file_path.unlink()

    db.delete(db_file)
    db.commit()
    return None


@stage_files_router.get("/{file_id}/download")
def download_stage_file(
    project_id: str,
    stage_id: str,
    file_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _project: Project = Depends(require_project_access)
):
    """Скачать файл этапа."""
    db_file = (
        db.query(File)
        .filter(File.id == file_id, File.stage_id == stage_id)
        .first()
    )
    if not db_file:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Файл не найден")

    file_path = Path(db_file.file_url)
    if not file_path.exists():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Файл не найден на диске")

    return FileResponse(path=file_path, filename=db_file.file_name, media_type=db_file.mime_type)

dashboard_router = APIRouter(prefix="/dashboard", tags=["dashboard"])



@dashboard_router.get("/pending-approvals")

def list_pending_approval_tasks(

    db: Session = Depends(get_db),

    current_user: User = Depends(get_current_user),

):

    """

    Все задачи, ожидающие согласования.

    Используется для главной страницы/дашборда.

    """



    tasks = (

        db.query(Task)

        .options(selectinload(Task.assignee))

        .filter(Task.status == "pending_approval")

        .order_by(Task.created_at.desc())

        .all()

    )



    return tasks
    
app.include_router(stage_files_router)
app.include_router(dashboard_router)
# =========================================================================
# Pydantic SCHEMAS — Notification
# =========================================================================

class NotificationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    type: str
    title: str
    body: Optional[str] = None
    related_project_id: Optional[str] = None
    related_task_id: Optional[str] = None
    is_read: bool
    created_at: datetime


def create_notification(
    db: Session,
    recipient_user_id: str,
    type: str,
    title: str,
    body: Optional[str] = None,
    related_project_id: Optional[str] = None,
    related_task_id: Optional[str] = None,
) -> None:
    """
    Общий хелпер для создания уведомления — вызывается из других
    эндпоинтов (send_for_approval, decide_approval, create_comment,
    add_project_executor), а не напрямую пользователем через API.

    Не делает db.commit() сам — уведомление создаётся в РАМКАХ той же
    транзакции, что и основное действие (например, отправка на
    согласование), и коммитится вместе с ним одним db.commit() в конце
    вызывающей функции. Так надёжнее: если основное действие упадёт,
    "осиротевшее" уведомление не останется в БД.
    """
    notification = Notification(
        recipient_user_id=recipient_user_id,
        type=type,
        title=title,
        body=body,
        related_project_id=related_project_id,
        related_task_id=related_task_id,
    )
    db.add(notification)


# =========================================================================
# РОУТЕР: /notifications
# =========================================================================

notifications_router = APIRouter(prefix="/notifications", tags=["notifications"])


@notifications_router.get("", response_model=List[NotificationOut])
def list_notifications(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Уведомления текущего пользователя, от новых к старым."""
    notifications = (
        db.query(Notification)
        .filter(Notification.recipient_user_id == current_user.id)
        .order_by(Notification.created_at.desc())
        .all()
    )
    return notifications


@notifications_router.get("/unread-count")
def get_unread_count(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Число непрочитанных — для бейджа с цифрой в сайдбаре/иконке колокольчика."""
    count = (
        db.query(Notification)
        .filter(
            Notification.recipient_user_id == current_user.id,
            Notification.is_read == False,  # noqa: E712
        )
        .count()
    )
    return {"count": count}


@notifications_router.patch("/{notification_id}/read", response_model=NotificationOut)
def mark_notification_read(
    notification_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Отметить одно уведомление прочитанным."""
    notification = (
        db.query(Notification)
        .filter(
            Notification.id == notification_id,
            Notification.recipient_user_id == current_user.id,
        )
        .first()
    )
    if not notification:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Уведомление не найдено")

    notification.is_read = True
    db.commit()
    db.refresh(notification)
    return notification


@notifications_router.patch("/read-all", status_code=status.HTTP_204_NO_CONTENT)
def mark_all_notifications_read(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Отметить все уведомления пользователя прочитанными — кнопка
    'Прочитать всё' в UI."""
    db.query(Notification).filter(
        Notification.recipient_user_id == current_user.id,
        Notification.is_read == False,  # noqa: E712
    ).update({"is_read": True})
    db.commit()
    return None


app.include_router(notifications_router)

# =========================================================================
# Pydantic SCHEMAS — ActivityLog
# =========================================================================

class ActivityLogOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    project_id: str
    task_id: Optional[str] = None
    actor_user_id: Optional[str] = None
    actor: Optional[UserOut] = None
    event_type: str
    event_data: Optional[str] = None
    created_at: datetime


def log_activity(
    db: Session,
    project_id: str,
    event_type: str,
    actor_user_id: Optional[str] = None,
    task_id: Optional[str] = None,
    event_data: Optional[dict] = None,
) -> None:
    """
    Хелпер для записи события в историю проекта. По аналогии с
    create_notification — не делает db.commit() сам, коммитится вместе
    с основным действием в той же транзакции.

    event_data — произвольный dict с доп. контекстом (например,
    {"task_title": "..."/"stage_name": "..."}), сериализуется в JSON-
    строку, потому что колонка в БД — Text, не JSON-тип (SQLite).
    """
    import json
    log = ActivityLog(
        project_id=project_id,
        task_id=task_id,
        actor_user_id=actor_user_id,
        event_type=event_type,
        event_data=json.dumps(event_data) if event_data else None,
    )
    db.add(log)


# =========================================================================
# РОУТЕР: /projects/{project_id}/activity
# =========================================================================

activity_router = APIRouter(prefix="/projects/{project_id}/activity", tags=["activity"])


@activity_router.get("", response_model=List[ActivityLogOut])
def list_activity(
    project_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _project: Project = Depends(require_project_access),
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


app.include_router(activity_router)
# =========================================================================
# Создание таблиц при первом запуске
# =========================================================================

@app.on_event("startup")
def on_startup():
    """Создаёт таблицы при старте сервера, если их ещё нет — аналог
    того, как ты раньше выполнял schema.sql руками через sqlite3."""
    Base.metadata.create_all(bind=engine)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)