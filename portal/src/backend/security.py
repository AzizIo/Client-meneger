"""
security.py
============
Всё, что касается паролей и JWT: хеширование, выдача токена,
dependency-"стражи" get_current_user и require_role.

Это вынесено из main.py без единого изменения в логике — просто
изолировано, чтобы routers/*.py могли делать
`from security import get_current_user, require_role`, не таща за
собой весь main.py.
"""
from datetime import datetime, timedelta

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import jwt, JWTError
from passlib.context import CryptContext
from sqlalchemy.orm import Session

from config import SECRET_KEY, ALGORITHM, ACCESS_TOKEN_EXPIRE_MINUTES
from database import get_db
from models import User

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
    Фабрика dependency-функций для проверки роли.

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
