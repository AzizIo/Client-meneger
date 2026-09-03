"""
routers/auth.py
================
/auth/register, /auth/login, /auth/me и работа с аватаркой.
Логика 1:1 перенесена из main.py — только имя роутера сменилось с
auth_router на router (по конвенции: внутри каждого router-модуля
объект называется одинаково, импортируется как `from routers import auth`
и используется как `auth.router`).
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from database import get_db
from models import User
from security import hash_password, verify_password, create_access_token, get_current_user
from schemas.user import (
    RegisterRequest, LoginRequest, TokenResponse, UserUpdate, AvatarUpdateRequest, UserOut,
)

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
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

    # Сразу выдаём токен — после регистрации не нужен отдельный логин.
    token = create_access_token({"sub": user.id, "role": user.role})
    return TokenResponse(access_token=token, role=user.role)


@router.post("/login", response_model=TokenResponse)
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


@router.get("/me", response_model=UserOut)
def get_my_profile(current_user: User = Depends(get_current_user)):
    """Проверочный эндпоинт: 'кто я сейчас залогинен'."""
    return current_user


@router.patch("/me", response_model=UserOut)
def update_user_info(
    data: UserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Обновление профиля текущего пользователя (PATCH-семантика:
    обновляем только переданные поля)."""
    if data.full_name:
        current_user.full_name = data.full_name

    if data.email:
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
    db.refresh(current_user)
    return current_user


@router.put("/me/avatar", response_model=UserOut)
def update_avatar(
    data: AvatarUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Обновление ссылки на аватарку. PUT, а не PATCH: тут заменяем
    значение целиком, частичное обновление не имеет смысла."""
    current_user.avatar_url = data.avatar_url
    db.commit()
    db.refresh(current_user)
    return current_user


@router.delete("/me/avatar", response_model=UserOut)
def delete_avatar(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Убирает аватарку — сбрасывает поле в NULL."""
    current_user.avatar_url = None
    db.commit()
    db.refresh(current_user)
    return current_user
