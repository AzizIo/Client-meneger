"""
routers/stage_files.py
========================
Файлы, привязанные напрямую к этапу (Stage) — общие файлы этапа
(например, общий бриф на весь дизайн-этап), не относящиеся к
конкретной задаче.
"""
import uuid
from pathlib import Path
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File as FastAPIFile
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from config import UPLOAD_DIR, ALLOWED_MIME_TYPES, MAX_FILE_SIZE
from database import get_db
from models import User, Stage, File
from security import get_current_user
from dependencies import get_project_or_404, require_project_access
from schemas.file import FileOut

router = APIRouter(
    prefix="/projects/{project_id}/stages/{stage_id}/files",
    tags=["files"],
)


@router.post("", response_model=FileOut, status_code=status.HTTP_201_CREATED)
async def upload_file_to_stage(
    project_id: str,
    stage_id: str,
    file: UploadFile = FastAPIFile(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _project=Depends(require_project_access),
):
    """Загрузить файл к этапу — для вкладки Files на уровне Stage."""
    get_project_or_404(project_id, db)
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
        stage_id=stage_id,
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


@router.get("", response_model=List[FileOut])
def list_stage_files(
    project_id: str,
    stage_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _project=Depends(require_project_access),
):
    """Список файлов этапа — только те, что привязаны к stage_id напрямую."""
    get_project_or_404(project_id, db)
    files = (
        db.query(File)
        .filter(File.stage_id == stage_id)
        .order_by(File.created_at.desc())
        .all()
    )
    return files


@router.delete("/{file_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_stage_file(
    project_id: str,
    stage_id: str,
    file_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _project=Depends(require_project_access),
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


@router.get("/{file_id}/download")
def download_stage_file(
    project_id: str,
    stage_id: str,
    file_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _project=Depends(require_project_access),
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
