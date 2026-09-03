"""
routers/files.py
==================
Файлы, привязанные к задаче или к конкретному раунду согласования.
Файлы хранятся на диске в uploads/, в БД — только путь (file_url).

Структура на диске:
  uploads/tasks/{task_id}/           <- файлы задачи
  uploads/approvals/{approval_id}/   <- файлы конкретного раунда
"""
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File as FastAPIFile
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from typing import List

from config import UPLOAD_DIR, ALLOWED_MIME_TYPES, MAX_FILE_SIZE
from database import get_db
from models import User, Approval, File
from security import get_current_user, require_role
from dependencies import get_stage_or_404, get_task_or_404, require_project_access
from schemas.file import FileOut

router = APIRouter(
    prefix="/projects/{project_id}/stages/{stage_id}/tasks/{task_id}",
    tags=["files"],
)


@router.post("/files", response_model=FileOut, status_code=status.HTTP_201_CREATED)
async def upload_file_to_task(
    project_id: str,
    stage_id: str,
    task_id: str,
    file: UploadFile = FastAPIFile(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _project=Depends(require_project_access),
):
    """
    Загрузить файл к задаче целиком (не к раунду) — общие файлы:
    брифы, референсы, исходники. Принимает multipart/form-data.
    """
    get_stage_or_404(project_id, stage_id, db)
    get_task_or_404(stage_id, task_id, db)

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

    task_upload_dir = UPLOAD_DIR / "tasks" / task_id
    task_upload_dir.mkdir(parents=True, exist_ok=True)

    file_ext = Path(file.filename).suffix
    unique_filename = f"{uuid.uuid4()}{file_ext}"
    file_path = task_upload_dir / unique_filename

    with open(file_path, "wb") as f:
        f.write(content)

    db_file = File(
        task_id=task_id,
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


@router.post(
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
    _project=Depends(require_project_access),
):
    """Загрузить файл к конкретному раунду согласования (версии v1,
    v2, v3...). Только executor может загружать файлы к раунду."""
    get_stage_or_404(project_id, stage_id, db)
    get_task_or_404(stage_id, task_id, db)

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


@router.get("/approvals/{approval_id}/files", response_model=List[FileOut])
def list_approval_files(
    project_id: str,
    stage_id: str,
    task_id: str,
    approval_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _project=Depends(require_project_access),
):
    """Список файлов конкретного раунда согласования."""
    get_stage_or_404(project_id, stage_id, db)
    get_task_or_404(stage_id, task_id, db)

    files = (
        db.query(File)
        .filter(File.approval_id == approval_id)
        .order_by(File.created_at.desc())
        .all()
    )
    return files


@router.delete(
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
    _project=Depends(require_project_access),
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


@router.get("/approvals/{approval_id}/files/{file_id}/download")
def download_approval_file(
    project_id: str,
    stage_id: str,
    task_id: str,
    approval_id: str,
    file_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _project=Depends(require_project_access),
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


@router.get("/files", response_model=List[FileOut])
def list_task_files(
    project_id: str,
    stage_id: str,
    task_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _project=Depends(require_project_access),
):
    """Список всех файлов задачи (без файлов конкретных раундов)."""
    get_stage_or_404(project_id, stage_id, db)
    get_task_or_404(stage_id, task_id, db)

    files = (
        db.query(File)
        .filter(File.task_id == task_id)
        .order_by(File.created_at.desc())
        .all()
    )
    return files


@router.delete("/files/{file_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_file(
    project_id: str,
    stage_id: str,
    task_id: str,
    file_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _project=Depends(require_project_access),
):
    """
    Удалить файл — из БД и с диска. Важно удалять и там, и там: иначе
    либо файл останется занимать место, либо в БД будет "битая" ссылка.
    """
    db_file = (
        db.query(File)
        .filter(File.id == file_id, File.task_id == task_id)
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


@router.get("/files/{file_id}/download")
def download_file(
    project_id: str,
    stage_id: str,
    task_id: str,
    file_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _project=Depends(require_project_access),
):
    """Скачать файл. Возвращает сам файл, а не JSON — на фронте
    используй как href-ссылку или через window.open()."""
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
        filename=db_file.file_name,
        media_type=db_file.mime_type,
    )
