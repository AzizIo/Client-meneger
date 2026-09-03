"""
main.py
=======
Точка входа приложения. Создаёт FastAPI-приложение, подключает CORS
и все роутеры. Вся бизнес-логика теперь живёт в routers/ — этот файл
должен оставаться маленьким и не разрастаться обратно в 2000 строк.

Запуск: uvicorn main:app --reload
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from database import Base, engine
from routers import (
    auth,
    projects,
    stages,
    tasks,
    comments,
    project_executors,
    files,
    stage_files,
    dashboard,
    notifications,
    activity,
    ai,
)

app = FastAPI(title="Approval Portal API")

# CORS — без этого браузер блокирует запросы с фронтенда (другой порт =
# другой "источник" для браузера, даже если оба на localhost).
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(projects.router)
app.include_router(stages.router)
app.include_router(tasks.router)
app.include_router(comments.router)
app.include_router(project_executors.router)
app.include_router(files.router)
app.include_router(stage_files.router)
app.include_router(dashboard.router)
app.include_router(notifications.router)
app.include_router(activity.router)
app.include_router(ai.router)


@app.on_event("startup")
def on_startup():
    """Создаёт таблицы при старте сервера, если их ещё нет."""
    Base.metadata.create_all(bind=engine)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
