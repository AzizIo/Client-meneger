import { useState, useEffect } from 'react'
import API from '../API/api'
import AddFile from '../Components/AddFile'
import { Download } from "lucide-react";
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
  isVisible: boolean
}


export default function Files({ endpoints, isVisible = false }: FilesProps) {
  const [files, setFiles] = useState<ProjectFile[]>([])
  const [newFilesOpen, setNewFilesOpen] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  useEffect(() => {
    API.get(endpoints.list)
      .then(res => setFiles(res.data))
  }, [])


  const downloadFile = async (file: ProjectFile) => {
    try {
      const response = await API.get(
        `${endpoints.download}/${file.id}/download`,
        {
          responseType: "blob",
        }
      );

      const url = URL.createObjectURL(response.data);

      const link = document.createElement("a");
      link.href = url;
      link.download = file.file_name;
      link.click();

      URL.revokeObjectURL(url);
    } catch (error) {
      console.error(error);
    }
  };

  const deleteFile = async (file: ProjectFile) => {
    const confirmDelete = window.confirm(
      `Вы точно хотите удалить файл "${file.file_name}"?`
    );

    if (!confirmDelete) return;

    try {
      await API.delete(`${endpoints.remove}/${file.id}`);

      setFiles(prev =>
        prev.filter(item => item.id !== file.id)
      );

    } catch (error) {
      console.error("Ошибка удаления файла", error);
      alert("Не удалось удалить файл");
    }
  };

  return (
    <>
      <div className='' >
        <div className="space-y-3">
          {files.map((file) => (
            <div className='flex flex-col sm:flex-row' >
              <div className='bg-gray-200 rounded p-2' >
                <div className='flex items-center gap-4' >

                  <div className='' >
                    📄
                  </div>
                  <div className='flex gap-4 items-center'>

                    <span className='text-sm text-gray-500'>
                      {file.file_name}
                    </span>

                    <span className='text-sm text-gray-500'>
                      {(file.file_size_bytes / (1024 * 1024)).toFixed(2)} МБ
                    </span>
                    <Download />

                    <button
                      onClick={() => deleteFile(file)}
                      className="text-red-500 hover:text-red-700"
                    >
                      Удалить
                    </button>

                  </div>
                </div>
              </div>
            </div>



          ))}
        </div>



      </div>
      <div className='flex items-center justify-center' >


        {isVisible && (
          <div onClick={() => setNewFilesOpen(true)} className="flex mt-4 text-center w-full">
            <div className="w-full hover:bg-gray-100 border-2 py-4 border-dashed border-gray-300 text-gray-400 rounded-lg">
              + Добавить файл
            </div>
          </div>
        )}

        {/* Логика добавления файла вынессена в отдельный компонент  */}
        <AddFile newFilesOpen={newFilesOpen} selectedFile={selectedFile} setSelectedFile={setSelectedFile} setNewFilesOpen={setNewFilesOpen} setFiles={setFiles} postUrl={endpoints.upload} />

      </div>


    </>
  )
}