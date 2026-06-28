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

from datetime import datetime, timedelta
from typing import Optional, List

from fastapi import FastAPI, APIRouter, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr, ConfigDict
from jose import jwt, JWTError
from passlib.context import CryptContext

from database import Base, engine, get_db
from models import User, Project, Stage, Task, Approval, File, Comment, ActivityLog, Notification


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
    allow_origins=[
        "http://localhost:5173",  # Vite dev server по умолчанию
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
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
    projects = db.query(Project).order_by(Project.created_at.desc()).all()
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


@stages_router.post("", response_model=StageOut, status_code=status.HTTP_201_CREATED)
def create_stage(
    project_id: str,
    payload: StageCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
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
# Создание таблиц при первом запуске
# =========================================================================

@app.on_event("startup")
def on_startup():
    """Создаёт таблицы при старте сервера, если их ещё нет — аналог
    того, как ты раньше выполнял schema.sql руками через sqlite3."""
    Base.metadata.create_all(bind=engine)