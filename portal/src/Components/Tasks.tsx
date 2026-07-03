import { Trash2, Pencil } from 'lucide-react';
import { useState } from 'react';
import API from '../API/api'
import { useAuth } from '../Context/AuthContext';
interface Assignee {
  avatar_url: string | null;
  full_name: string;
}

interface Task {
  id: string;
  title: string;
  description: string;
  status: string;
  created_at: string;
  assignee_id: string | null;
  assignee?: Assignee | null;
  approvals?: Approval[]; // добавили
}

interface Approval {
  id: string;
  round_number: number;
  status: 'pending' | 'approved' | 'rejected';
  decision_comment: string | null;
  submitted_at: string;
  decided_at: string | null;
}

export default function Tasks({
  tasks,
  newTaskOpen,
  setNewTaskOpen,
  createTask,
  setTaskName,
  setTaskDisc,
  setAssignee,
  deleteTasks,
  projectId,
  stageId,
  onTaskUpdate,
}: any) {
  const { me } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [currentTask, setCurrentTask] = useState<Task | null>(null);
  const pendingApproval =
    selectedTask?.approvals?.find(a => a.status === 'pending');
  const history =
    selectedTask?.approvals?.filter(a => a.status !== 'pending') ?? [];
  const handleOpen = async (task: Task) => {
    const response = await API.get(`/projects/${projectId}/stages/${stageId}/tasks/${task.id}`);
    setSelectedTask(response.data);
    setIsOpen(true);
    setIsEditing(false);
  };

  const handleClose = () => {
    setIsOpen(false);
    setIsEditing(false);
  };

  const handleDelete = (taskId?: string) => {
    if (!taskId) return;
    deleteTasks(taskId);
    handleClose();
  };
  async function decide(approvalId: string, status: 'approved' | 'rejected', comment?: string) {
    try {
      await API.post(
        `/projects/${projectId}/stages/${stageId}/tasks/${selectedTask?.id}/approvals/${approvalId}/decide`,
        { status, decision_comment: comment ?? null }
      );
      onTaskUpdate();
      handleClose();
    } catch (err) {
      console.error(err);
      alert('Ошибка при принятии решения');
    }
  }


  async function SendAprove() {
    await API.post(`/projects/${projectId}/stages/${stageId}/tasks/${selectedTask?.id}/approvals`)
  }

  const handleEditToggle = () => {
    if (!isEditing && selectedTask) {
      setEditTitle(selectedTask.title);
      setEditDescription(selectedTask.description);
    }
    setIsEditing(!isEditing);
  };

  const handleSaveEdit = async () => {
    if (!selectedTask || !editTitle.trim()) {
      alert('Название задачи не может быть пустым');
      return;
    }

    try {
      setIsSaving(true);
      await API.patch(
        `/projects/${projectId}/stages/${stageId}/tasks/${selectedTask.id}`,
        {
          title: editTitle,
          description: editDescription,
        }
      );

      if (onTaskUpdate) {
        onTaskUpdate();
      }

      setSelectedTask({
        ...selectedTask,
        title: editTitle,
        description: editDescription,
      });

      setIsEditing(false);
    } catch (error) {
      console.error('Ошибка при обновлении задачи:', error);
      alert('Ошибка при обновлении задачи');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <div>
        <div className="flex flex-col items-center justify-center"></div>

        {newTaskOpen && (
          <div
            className="fixed inset-0 bg-black/50 flex items-center justify-center"
            onClick={() => setNewTaskOpen(false)}
          >
            <div
              className="bg-white p-6 rounded-xl w-full max-w-md"
              onClick={(e) => e.stopPropagation()}
            >
              <form onSubmit={createTask} className="flex flex-col gap-4 max-w-md">
                <div className="flex flex-col gap-2">
                  <label htmlFor="task-input" className="text-sm font-medium text-gray-700">
                    Название задачи
                  </label>
                  <input
                    onChange={(e) => setTaskName(e.target.value)}
                    id="task-input"
                    type="text"
                    placeholder="Дизайн главной страницы"
                    className="w-full rounded-lg border border-gray-300 px-4 py-2 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label htmlFor="task-desc" className="text-sm font-medium text-gray-700">
                    Описание задачи
                  </label>
                  <input
                    onChange={(e) => setTaskDisc(e.target.value)}
                    id="task-desc"
                    type="text"
                    placeholder="Заголовок, картинки и иконки"
                    className="w-full rounded-lg border border-gray-300 px-4 py-2 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label htmlFor="task-assignee" className="text-sm font-medium text-gray-700">
                    Айди исполнителя (опционально)
                  </label>
                  <input
                    onChange={(e) => setAssignee(e.target.value)}
                    id="task-assignee"
                    type="text"
                    placeholder="KSA-123S"
                    className="w-full rounded-lg border border-gray-300 px-4 py-2 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                  />
                </div>
                <button
                  type="submit"
                  className="rounded-lg bg-blue-600 px-4 py-2 font-medium text-white transition hover:bg-blue-700 active:scale-95"
                >
                  Добавить
                </button>
              </form>

              <div className="mt-6">
                <h1 className="text-2xl flex justify-center font-bold">Управление задачами</h1>
                <div className="mt-4">
                  {tasks.map((task) => (
                    <div className="flex justify-between" key={task.id}>
                      <div>{task.title}</div>
                      <button onClick={() => deleteTasks(task.id)}>Удалить</button>
                    </div>
                  ))}
                </div>
              </div>

              <button
                onClick={() => setNewTaskOpen(false)}
                className="mt-4 bg-red-500 text-white px-4 py-2 rounded"
              >
                Закрыть
              </button>
            </div>
          </div>
        )}

        <div className="mt-8">
          <div className="flex flex-col gap-4">
            {tasks.map((task) => (
              <div key={task.id}>
                <div
                  onClick={() => handleOpen(task)}
                  className="bg-gray-100 hover:bg-gray-200 py-2 pl-4 flex justify-between items-center rounded cursor-pointer"
                >
                  <div>
                    <h1 className="font-semibold">{task.title}</h1>
                    <p className="text-gray-500 text-sm">{task.description}</p>
                  </div>

                  <div className="pr-4 flex items-center gap-4">
                    <div className="text-gray-500 text-sm">
                      {new Date(task.created_at).toLocaleDateString('ru-RU')}
                    </div>
                    <div className="bg-emerald-600/20 text-emerald-600 px-2 py-1 text-sm rounded-3xl">
                      {task.status}
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {isOpen && (
              <div className="fixed inset-0 z-50">
                {/* Затемнение */}
                <div className="absolute inset-0 bg-black/50" onClick={handleClose} />

                {/* Меню справа */}
                <div className="absolute right-0 top-0 h-full w-[480px] bg-white shadow-xl overflow-y-auto">
                  <div className="p-6">
                    {/* Заголовок */}
                    <div className="mb-4">
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex-1">
                          {isEditing ? (
                            <input
                              type="text"
                              value={editTitle}
                              onChange={(e) => setEditTitle(e.target.value)}
                              className="w-full text-2xl font-bold border border-blue-400 rounded px-3 py-2 outline-none focus:ring-2 focus:ring-blue-300"
                              placeholder="Название задачи"
                            />
                          ) : (
                            <h2 className="text-2xl font-bold">{selectedTask?.title}</h2>
                          )}
                        </div>

                        <div className="flex gap-2 ml-3">
                          <button
                            onClick={() => handleDelete(selectedTask?.id)}
                            className="bg-red-500 p-2 rounded cursor-pointer hover:bg-red-600 transition"
                            title="Удалить"
                          >
                            <Trash2 size={20} color="white" />
                          </button>

                          {isEditing ? (
                            <>
                              <button
                                onClick={handleSaveEdit}
                                disabled={isSaving}
                                className="bg-green-500 p-2 rounded cursor-pointer hover:bg-green-600 disabled:opacity-50 transition"
                                title="Сохранить"
                              >
                                ✓
                              </button>
                              <button
                                onClick={() => setIsEditing(false)}
                                disabled={isSaving}
                                className="bg-gray-500 p-2 rounded cursor-pointer hover:bg-gray-600 disabled:opacity-50 transition"
                                title="Отмена"
                              >
                                ✕
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={handleEditToggle}
                              className="bg-blue-500 p-2 rounded cursor-pointer hover:bg-blue-600 transition"
                              title="Редактировать"
                            >
                              <Pencil size={20} color="white" />
                            </button>
                          )}
                        </div>
                      </div>

                      {isEditing ? (
                        <textarea
                          value={editDescription}
                          onChange={(e) => setEditDescription(e.target.value)}
                          className="w-full text-gray-600 text-sm border border-blue-400 rounded px-3 py-2 outline-none focus:ring-2 focus:ring-blue-300 resize-none"
                          placeholder="Описание задачи"
                          rows={3}
                        />
                      ) : (
                        <p className="text-gray-600 text-sm">{selectedTask?.description}</p>
                      )}
                    </div>

                    <hr className="border-gray-200 mb-6" />

                    {/* Данные */}
                    <div className="flex flex-col gap-5">
                      <div className="flex flex-col gap-1">
                        <p className="text-gray-600 font-semibold text-sm">Статус:</p>
                        <p>{selectedTask?.status}</p>
                      </div>

                      <div className="flex flex-col gap-1">
                        <p className="text-gray-600 font-semibold text-sm">Исполнитель:</p>
                        <div className="flex items-center gap-2">
                          {selectedTask?.assignee?.avatar_url && (
                            <img
                              className="w-6 h-6 rounded-full object-cover bg-gray-100"
                              src={selectedTask.assignee.avatar_url}
                              alt=""
                            />
                          )}
                          <p>
                            {selectedTask?.assignee
                              ? selectedTask.assignee.full_name
                              : 'Не назначен'}
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-col gap-1">
                        <p className="text-gray-600 font-semibold text-sm">Дата создания:</p>
                        <p>
                          {selectedTask?.created_at
                            ? new Date(selectedTask.created_at).toLocaleDateString('ru-RU')
                            : ''}
                        </p>
                      </div>
                    </div>


                    {me?.role === 'executor' && (
                      <div className="mt-8 flex flex-col gap-4">

                        <button onClick={() => SendAprove()} className="w-full mt-8  bg-green-500 text-white font-medium py-3 rounded-lg hover:bg-green-600 transition">
                          Отправить на согласование
                        </button>
                        <div>
                          {history.map(a => (
                            <div key={a.id} className="flex flex-col gap-4 rounded-lg bg-gray-50 px-3 py-2 text-sm">
                              <div className="flex items-center gap-2">
                                <span>Версия {a.round_number}:</span>
                                {a.status === 'approved'
                                  ? <span className="text-green-600 font-medium">✅ Одобрено</span>
                                  : <span className="text-red-500 font-medium">❌ Отклонено</span>
                                }
                              </div>
                              {a.decision_comment && (
                                <p className="text-gray-500">{a.decision_comment}</p>
                              )}
                            </div>
                          ))}


                        </div>
                      </div>
                    )}


                    {/* Добавить обработчик */}
                    {me?.role === 'client' && (
                      <div className="mt-8 flex flex-col gap-4">
                        {/* История предыдущих раундов */}
                        {history.length > 0 && (
                          <div className="flex flex-col gap-2">
                            <p className="text-gray-600 font-semibold text-sm">История согласования:</p>
                            {history.map(a => (
                              <div key={a.id} className="flex flex-col gap-1 rounded-lg bg-gray-50 px-3 py-2 text-sm">
                                <div className="flex items-center gap-2">
                                  <span>Версия {a.round_number}:</span>
                                  {a.status === 'approved'
                                    ? <span className="text-green-600 font-medium">✅ Одобрено</span>
                                    : <span className="text-red-500 font-medium">❌ Отклонено</span>
                                  }
                                </div>
                                {a.decision_comment && (
                                  <p className="text-gray-500">{a.decision_comment}</p>
                                )}
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Кнопки только если есть pending раунд */}
                        {pendingApproval ? (
                          <div className="flex flex-col gap-2">
                            <p className="text-gray-600 font-semibold text-sm">
                              Версия {pendingApproval.round_number} ожидает вашего решения:
                            </p>
                            <button
                              onClick={() => decide(pendingApproval.id, 'approved')}
                              className="w-full bg-green-500 text-white font-medium py-3 rounded-lg hover:bg-green-600 transition"
                            >
                              ✅ Одобрить
                            </button>
                            <button
                              onClick={() => {
                                const comment = prompt('Что нужно исправить?');
                                if (comment !== null) {
                                  decide(pendingApproval.id, 'rejected', comment);
                                }
                              }}
                              className="w-full bg-red-500 text-white font-medium py-3 rounded-lg hover:bg-red-600 transition"
                            >
                              ❌ Отклонить
                            </button>
                          </div>
                        ) : (
                          // Нет pending раунда — исполнитель ещё не отправил на согласование
                          <p className="text-gray-400 text-sm text-center">
                            Ожидаем отправки на согласование от исполнителя
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {me?.role === 'executor' && (
        <div onClick={() => setNewTaskOpen(true)} className="flex mt-4 text-center w-full">
          <div className="w-full hover:bg-gray-100 border-2 py-4 border-dashed border-gray-300 text-gray-400 rounded-lg">
            + Добавить новую задачу
          </div>
        </div>
      )}
    </>
  );
}