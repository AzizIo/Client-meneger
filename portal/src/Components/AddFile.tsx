import API from '../API/api'



export default function AddFile({ newFilesOpen, selectedFile, setSelectedFile, setNewFilesOpen, setFiles, postUrl }: any) {
  async function uploadFile() {
    if (!selectedFile) {
      alert("выберете файл");
    }
    const formData = new FormData();
    formData.append('file', selectedFile);
    try {
      const res = await API.post(postUrl, formData)

      setFiles(prev => [...prev, res.data])
      setSelectedFile(null);
      setNewFilesOpen(false);
    }

    catch (err) {
      console.error(err);
    }
  }
  return (
    <>
      {newFilesOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="text-xl font-semibold text-gray-900">
              Загрузка файла
            </h2>

            <p className="mt-1 text-sm text-gray-500">
              Выберите файл, который хотите прикрепить к этапу.
            </p>

            <label className="mt-6 flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-300 p-8 transition hover:border-blue-500 hover:bg-blue-50">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="mb-3 h-10 w-10 text-gray-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.8}
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a4 4 0 010 8h-2m-2-4v10m0-10l-3 3m3-3l3 3"
                />
              </svg>

              <span className="font-medium text-gray-700">
                Нажмите для выбора файла
              </span>

              <span className="mt-1 text-sm text-gray-400">
                или перетащите его сюда
              </span>

              <input
                type="file"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    setSelectedFile(file);
                  }
                }}
              />
            </label>

            {selectedFile && (
              <div className="mt-4 rounded-lg bg-gray-100 p-3">
                <p className="font-medium text-gray-800">
                  📄 {selectedFile.name}
                </p>
                <p className="text-sm text-gray-500">
                  {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>
            )}

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => {
                  setNewFilesOpen(false);
                  setSelectedFile(null);
                }}
                className="rounded-lg border border-gray-300 px-5 py-2 transition hover:bg-gray-100"
              >
                Отмена
              </button>

              <button
                disabled={!selectedFile}
                onClick={uploadFile}
                className="rounded-lg bg-blue-600 px-5 py-2 text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300"
              >
                Загрузить
              </button>
            </div>
          </div>
        </div>
      )}

    </>
  )
}





