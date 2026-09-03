"""
routers/ai.py
===============
AI-ассистент: краткое резюме задачи и её комментариев для того, кто
должен принять решение по согласованию. Дергает Groq (OpenAI-совместимый
эндпоинт chat completions).

NB: GROQ_API_KEY в config.py сейчас пустой — эндпоинт вернёт 503, пока
ключ не заполнен.
"""
import httpx
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from config import GROQ_API_KEY
from database import get_db
from models import User, Task, Stage, Project, Comment, ProjectExecutor
from security import get_current_user

router = APIRouter(tags=["ai"])


@router.get("/tasks/{task_id}/ai-summary")
async def get_ai_summary(
    task_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    task = db.get(Task, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Задача не найдена")

    stage = db.get(Stage, task.stage_id)
    project = db.get(Project, stage.project_id) if stage else None

    is_related = project and (
        project.executor_id == current_user.id
        or project.client_id == current_user.id
        or db.query(ProjectExecutor)
            .filter(
                ProjectExecutor.project_id == project.id,
                ProjectExecutor.user_id == current_user.id,
            )
            .first() is not None
    )
    if not is_related:
        raise HTTPException(status_code=403, detail="У вас нет доступа к этой задаче")

    comments = db.query(Comment).filter(Comment.task_id == task_id).all()
    if current_user.role == "client":
        comments = [c for c in comments if not c.is_internal]

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

    if not GROQ_API_KEY:
        raise HTTPException(status_code=503, detail="AI-ассистент не настроен")

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(
                "https://api.groq.com/openai/v1/chat/completions",
                headers={"Authorization": f"Bearer {GROQ_API_KEY}", "Content-Type": "application/json"},
                json={"model": "llama-3.3-70b-versatile", "max_tokens": 200, "messages": [{"role": "user", "content": prompt}]},
            )
            data = resp.json()
            if "choices" not in data:
                raise HTTPException(status_code=502, detail="Ошибка AI-сервиса")

            return {
                "summary": data["choices"][0]["message"]["content"],
                "task_id": task.id,
                "stage_id": task.stage_id,
                "project_id": project.id,
            }
    except httpx.HTTPError:
        raise HTTPException(status_code=502, detail="Не удалось связаться с AI-сервисом")
