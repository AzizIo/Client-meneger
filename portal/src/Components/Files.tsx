import { useState, useEffect } from 'react'
import API from '../API/api'
import AddFile from '../Components/AddFile'
import { Download, Trash2, FileText } from "lucide-react";
import { useToast } from '../Context/ToastContext';
import { colors, fontMono } from './ui/designSystem'

interface ProjectFile {
  id: string,
  task_id: string,
  approval_id: string,
  uploaded_by_user_id: string,
  file_name: string,
  file_url: string,
  file_size_bytes: number,
  mime_type: string,
  created_at: string
}
interface FilesProps {
  endpoints: {
    list: string
    upload: string
    download: string
    remove: string
  }
  isVisible?: boolean
}

export default function Files({ endpoints, isVisible = false }: FilesProps) {
  const { showToast } = useToast();
  const [files, setFiles] = useState<ProjectFile[]>([])
  const [newFilesOpen, setNewFilesOpen] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)

  useEffect(() => {
    API.get(endpoints.list)
      .then(res => setFiles(res.data))
  }, [endpoints.list])

  const downloadFile = async (file: ProjectFile) => {
    try {
      const response = await API.get(
        `${endpoints.download}/${file.id}/download`,
        { responseType: "blob" }
      );

      const url = URL.createObjectURL(response.data);
      const link = document.createElement("a");
      link.href = url;
      link.download = file.file_name;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error(error);
      showToast("Не удалось скачать файл");
    }
  };

  const deleteFile = async (file: ProjectFile) => {
    const confirmDelete = window.confirm(
      `Вы точно хотите удалить файл "${file.file_name}"?`
    );

    if (!confirmDelete) return;

    try {
      await API.delete(`${endpoints.remove}/${file.id}`);
      setFiles(prev => prev.filter(item => item.id !== file.id));
    } catch (error) {
      console.error("Ошибка удаления файла", error);
      showToast("Не удалось удалить файл");
    }
  };

  return (
    <>
      <div className="space-y-2">
        {files.map((file) => (
          <div
            key={file.id}
            className="flex items-center justify-between gap-3 rounded-md bg-white px-4 py-3"
            style={{ border: `1px solid ${colors.line}` }}
          >
            <div className="flex items-center gap-3 min-w-0">
              <FileText size={18} style={{ color: colors.muted }} className="shrink-0" />
              <span className="text-sm truncate" style={{ color: colors.ink }}>
                {file.file_name}
              </span>
              <span className="text-xs shrink-0" style={{ color: colors.muted, fontFamily: fontMono }}>
                {(file.file_size_bytes / (1024 * 1024)).toFixed(2)} МБ
              </span>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <button onClick={() => downloadFile(file)} className="transition-colors hover:opacity-70" style={{ color: colors.muted }}>
                <Download size={17} />
              </button>
              <button onClick={() => deleteFile(file)} className="transition-colors hover:opacity-70" style={{ color: colors.stampRed }}>
                <Trash2 size={17} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {isVisible && (
        <div onClick={() => setNewFilesOpen(true)} className="flex mt-3 w-full">
          <div
            className="w-full text-center py-4 rounded-lg cursor-pointer transition-colors hover:bg-black/[0.02]"
            style={{ border: `1.5px dashed ${colors.line}`, color: colors.muted }}
          >
            + Добавить файл
          </div>
        </div>
      )}

      <AddFile
        newFilesOpen={newFilesOpen}
        selectedFile={selectedFile}
        setSelectedFile={setSelectedFile}
        setNewFilesOpen={setNewFilesOpen}
        setFiles={setFiles}
        postUrl={endpoints.upload}
      />
    </>
  )
}