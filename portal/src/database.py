"""
database.py
============
Подключение к базе данных. Аналогия из фронтенда: как ты один раз
создаёшь axios-инстанс с base URL в начале проекта и потом просто
импортируешь его везде — здесь то же самое, но для БД.
"""

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

DATABASE_URL = "sqlite:///./approval_portal.db"

# connect_args нужен только для SQLite. Когда (если) переедем на
# Postgres, эта строка уйдёт, всё остальное останется как есть.
engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False},
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base — родительский класс. От него наследуются все модели в models.py.
# Именно это связывает Python-класс с конкретной SQL-таблицей.
Base = declarative_base()


def get_db():
    """
    Dependency для FastAPI: используется как Depends(get_db) в эндпоинтах.

    Аналогия: кастомный хук useDb(), который выдаёт подключение и сам
    "убирает за собой" после запроса — только здесь это происходит на
    каждый HTTP-запрос, а не на каждый рендер компонента.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
