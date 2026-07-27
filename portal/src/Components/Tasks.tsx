import { Trash2, Pencil, X, Check } from 'lucide-react';
import { useState } from 'react';
import API from '../API/api'
import { useAuth } from '../Context/AuthContext';
import Files from './Files';
import Comments from './Comments';
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
  approvals?: Approval[];
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

  const taskFilesEndpoints = {
    list: `/projects/${projectId}/stages/${stageId}/tasks/${selectedTask?.id}/files`,
    upload: `/projects/${projectId}/stages/${stageId}/tasks/${selectedTask?.id}/files`,
    download: `/projects/${projectId}/stages/${stageId}/tasks/${selectedTask?.id}/files`,
    remove: `/projects/${projectId}/stages/${stageId}/tasks/${selectedTask?.id}/files`,
  }

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
    try {
      await API.post(`/projects/${projectId}/stages/${stageId}/tasks/${selectedTask?.id}/approvals`);
      const response = await API.get(`/projects/${projectId}/stages/${stageId}/tasks/${selectedTask?.id}`);
      setSelectedTask(response.data);
      onTaskUpdate();
    } catch (err: any) {
      if (err.response?.status === 409) {
        alert('Задача уже отправлена на согласование');
      } else {
        alert('Ошибка при отправке');
      }
    }
  }

  // Единая нейтральная палитра для статусов: только точка-индикатор меняет цвет,
  // фон и текст остаются одинаковыми у всех статусов
  function getStatusBadge(status: string) {
    const map: Record<string, { label: string; dot: string }> = {
      not_started: { label: 'Не начата', dot: 'bg-gray-400' },
      pending_approval: { label: 'На согласовании', dot: 'bg-amber-500' },
      approved: { label: 'Одобрено', dot: 'bg-emerald-500' },
      changes_requested: { label: 'Требуются правки', dot: 'bg-red-500' },
    };

    return map[status] ?? { label: status, dot: 'bg-gray-400' };
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
        { title: editTitle, description: editDescription }
      );

      if (onTaskUpdate) onTaskUpdate();

      setSelectedTask({ ...selectedTask, title: editTitle, description: editDescription });
      setIsEditing(false);
    } catch (error) {
      console.error('Ошибка при обновлении задачи:', error);
      alert('Ошибка при обновлении задачи');
    } finally {
      setIsSaving(false);
    }
  };

  // Общие классы кнопок — один визуальный язык на весь компонент
  const btnBase =
    'inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium transition-colors disabled:opacity-50 disabled:pointer-events-none';
  const btnPrimary = `${btnBase} bg-gray-900 text-white hover:bg-gray-700 px-4 py-2.5`;
  const btnOutline = `${btnBase} border border-gray-300 text-gray-700 hover:bg-gray-50 px-4 py-2.5`;
  const btnDanger = `${btnBase} border border-gray-300 text-gray-700 hover:border-red-300 hover:text-red-600 hover:bg-red-50 px-4 py-2.5`;
  const iconBtn =
    'inline-flex items-center justify-center h-9 w-9 rounded-md border border-gray-300 text-gray-500 hover:bg-gray-50 hover:text-gray-900 transition-colors';

  return (
    <>
      <div>
        {newTaskOpen && (
          <div
            className="fixed inset-0 bg-black/40 flex items-center justify-center z-50"
            onClick={() => setNewTaskOpen(false)}
          >
            <div
              className="bg-white p-6 rounded-lg w-full max-w-md border border-gray-200"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="text-base font-semibold text-gray-900 mb-4">Новая задача</h2>

              <form onSubmit={createTask} className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="task-input" className="text-sm text-gray-500">
                    Название задачи
                  </label>
                  <input
                    onChange={(e) => setTaskName(e.target.value)}
                    id="task-input"
                    type="text"
                    placeholder="Дизайн главной страницы"
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none transition focus:border-gray-900"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="task-desc" className="text-sm text-gray-500">
                    Описание задачи
                  </label>
                  <input
                    onChange={(e) => setTaskDisc(e.target.value)}
                    id="task-desc"
                    type="text"
                    placeholder="Заголовок, картинки и иконки"
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none transition focus:border-gray-900"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="task-assignee" className="text-sm text-gray-500">
                    Айди исполнителя (опционально)
                  </label>
                  <input
                    onChange={(e) => setAssignee(e.target.value)}
                    id="task-assignee"
                    type="text"
                    placeholder="KSA-123S"
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none transition focus:border-gray-900"
                  />
                </div>
                <button type="submit" className={btnPrimary}>
                  Добавить
                </button>
              </form>

              <div className="mt-6 pt-6 border-t border-gray-200">
                <h3 className="text-sm font-medium text-gray-900 mb-3">Управление задачами</h3>
                <div className="flex flex-col gap-1">
                  {tasks.map((task: Task) => (
                    <div className="flex justify-between items-center py-1.5" key={task.id}>
                      <span className="text-sm text-gray-700">{task.title}</span>
                      <button
                        onClick={() => deleteTasks(task.id)}
                        className="text-sm text-gray-400 hover:text-red-600 transition-colors"
                      >
                        Удалить
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <button onClick={() => setNewTaskOpen(false)} className={`${btnOutline} mt-6 w-full`}>
                Закрыть
              </button>
            </div>
          </div>
        )}

        <div className="mt-8">
          <div className="flex flex-col gap-2">
            {tasks.map((task: Task) => (
              <div key={task.id}>
                <div
                  onClick={() => handleOpen(task)}
                  className="border border-gray-200 hover:border-gray-300 bg-white py-3 px-4 flex justify-between items-center rounded-lg cursor-pointer transition-colors"
                >
                  <div>
                    <h1 className="font-medium text-gray-900">{task.title}</h1>
                    <p className="text-gray-500 text-sm mt-0.5">{task.description}</p>
                  </div>

                  <div className="flex items-center gap-4 shrink-0">
                    <span className="text-gray-400 text-xs">
                      {new Date(task.created_at).toLocaleDateString('ru-RU')}
                    </span>
                    <div className="flex items-center gap-1.5 text-sm text-gray-600">
                      <span className={`h-1.5 w-1.5 rounded-full ${getStatusBadge(task.status).dot}`} />
                      {getStatusBadge(task.status).label}
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {isOpen && (
              <div className="fixed inset-0 z-50">
                <div className="absolute inset-0 bg-black/40" onClick={handleClose} />

                <div className="absolute right-0 top-0 h-full w-full max-w-md bg-white border-l border-gray-200 overflow-y-auto">
                  <div className="p-6">
                    <div className="mb-4">
                      <div className="flex justify-between items-start mb-3 gap-3">
                        <div className="flex-1">
                          {isEditing ? (
                            <input
                              type="text"
                              value={editTitle}
                              onChange={(e) => setEditTitle(e.target.value)}
                              className="w-full text-xl font-semibold border border-gray-300 rounded-md px-3 py-2 outline-none focus:border-gray-900"
                              placeholder="Название задачи"
                            />
                          ) : (
                            <h2 className="text-xl font-semibold text-gray-900">{selectedTask?.title}</h2>
                          )}
                        </div>

                        <div className="flex gap-2 shrink-0">
                          <button
                            onClick={() => handleDelete(selectedTask?.id)}
                            className={iconBtn}
                            title="Удалить"
                          >
                            <Trash2 size={16} />
                          </button>

                          {isEditing ? (
                            <>
                              <button
                                onClick={handleSaveEdit}
                                disabled={isSaving}
                                className={iconBtn}
                                title="Сохранить"
                              >
                                <Check size={16} />
                              </button>
                              <button
                                onClick={() => setIsEditing(false)}
                                disabled={isSaving}
                                className={iconBtn}
                                title="Отмена"
                              >
                                <X size={16} />
                              </button>
                            </>
                          ) : (
                            <button onClick={handleEditToggle} className={iconBtn} title="Редактировать">
                              <Pencil size={16} />
                            </button>
                          )}
                        </div>
                      </div>

                      {isEditing ? (
                        <textarea
                          value={editDescription}
                          onChange={(e) => setEditDescription(e.target.value)}
                          className="w-full text-gray-700 text-sm border border-gray-300 rounded-md px-3 py-2 outline-none focus:border-gray-900 resize-none"
                          placeholder="Описание задачи"
                          rows={3}
                        />
                      ) : (
                        <p className="text-gray-500 text-sm">{selectedTask?.description}</p>
                      )}
                    </div>

                    <hr className="border-gray-100 mb-6" />

                    <div className="flex flex-col gap-4">
                      <div className="flex flex-col gap-1">
                        <p className="text-gray-400 text-xs uppercase tracking-wide">Статус</p>
                        <div className="flex items-center gap-1.5 text-sm text-gray-700">
                          <span className={`h-1.5 w-1.5 rounded-full ${getStatusBadge(selectedTask?.status ?? '').dot}`} />
                          {getStatusBadge(selectedTask?.status ?? '').label}
                        </div>
                      </div>

                      <div className="flex flex-col gap-1">
                        <p className="text-gray-400 text-xs uppercase tracking-wide">Исполнитель</p>
                        <div className="flex items-center gap-2">
                          {selectedTask?.assignee?.avatar_url && (
                            <img
                              className="w-6 h-6 rounded-full object-cover bg-gray-100"
                              src={selectedTask.assignee.avatar_url}
                              alt=""
                            />
                          )}
                          <p className="text-sm text-gray-700">
                            {selectedTask?.assignee ? selectedTask.assignee.full_name : 'Не назначен'}
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-col gap-1">
                        <p className="text-gray-400 text-xs uppercase tracking-wide">Дата создания</p>
                        <p className="text-sm text-gray-700">
                          {selectedTask?.created_at
                            ? new Date(selectedTask.created_at).toLocaleDateString('ru-RU')
                            : ''}
                        </p>
                      </div>
                      <hr className="border-gray-100 my-2" />
                      <Comments
                        projectId={projectId}
                        stageId={stageId}
                        taskId={selectedTask?.id}
                      />
                    </div>

                    {me?.role === 'executor' && (
                      <div className="mt-8 flex flex-col gap-4">
                        <Files endpoints={taskFilesEndpoints} isVisible={true} />

                        {!pendingApproval ? (
                          <button onClick={SendAprove} className={`${btnPrimary} w-full`}>
                            Отправить на согласование
                          </button>
                        ) : (
                          <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-center text-sm text-gray-600">
                            Работа отправлена заказчику и ожидает решения
                          </div>
                        )}

                        <div className="flex flex-col gap-2">
                          {history.map(a => (
                            <div key={a.id} className="rounded-lg border border-gray-200 px-3 py-2 text-sm">
                              <div className="flex items-center gap-2">
                                <span className="text-gray-700">Версия {a.round_number}</span>
                                <span
                                  className={`flex items-center gap-1 font-medium ${a.status === 'approved' ? 'text-emerald-600' : 'text-red-500'
                                    }`}
                                >
                                  <span
                                    className={`h-1.5 w-1.5 rounded-full ${a.status === 'approved' ? 'bg-emerald-500' : 'bg-red-500'
                                      }`}
                                  />
                                  {a.status === 'approved' ? 'Одобрено' : 'Отклонено'}
                                </span>
                              </div>
                              {a.decision_comment && (
                                <p className="mt-1 text-gray-500">{a.decision_comment}</p>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {me?.role === 'client' && (
                      <div className="mt-8 flex flex-col gap-4">
                        {history.length > 0 && (
                          <div className="flex flex-col gap-2">
                            <p className="text-gray-400 text-xs uppercase tracking-wide">История согласования</p>
                            {history.map(a => (
                              <div key={a.id} className="flex flex-col gap-1 rounded-lg border border-gray-200 px-3 py-2 text-sm">
                                <div className="flex items-center gap-2">
                                  <span className="text-gray-700">Версия {a.round_number}:</span>
                                  <span
                                    className={`flex items-center gap-1 font-medium ${a.status === 'approved' ? 'text-emerald-600' : 'text-red-500'
                                      }`}
                                  >
                                    <span
                                      className={`h-1.5 w-1.5 rounded-full ${a.status === 'approved' ? 'bg-emerald-500' : 'bg-red-500'
                                        }`}
                                    />
                                    {a.status === 'approved' ? 'Одобрено' : 'Отклонено'}
                                  </span>
                                </div>
                                {a.decision_comment && (
                                  <p className="text-gray-500">{a.decision_comment}</p>
                                )}
                              </div>
                            ))}
                          </div>
                        )}

                        {pendingApproval ? (
                          <div className="flex flex-col gap-3">
                            <p className="text-gray-400 text-xs uppercase tracking-wide">
                              Версия {pendingApproval.round_number} ожидает вашего решения
                            </p>

                            <Files endpoints={taskFilesEndpoints} />

                            <button
                              onClick={() => decide(pendingApproval.id, 'approved')}
                              className={`${btnPrimary} w-full`}
                            >
                              Одобрить
                            </button>
                            <button
                              onClick={() => {
                                const comment = prompt('Что нужно исправить?');
                                if (comment !== null) {
                                  decide(pendingApproval.id, 'rejected', comment);
                                }
                              }}
                              className={`${btnDanger} w-full`}
                            >
                              Отклонить
                            </button>
                          </div>
                        ) : (
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
        <div onClick={() => setNewTaskOpen(true)} className="flex mt-4 w-full">
          <div className="w-full text-center hover:bg-gray-50 border border-dashed border-gray-300 text-gray-400 py-4 rounded-lg cursor-pointer transition-colors">
            + Добавить новую задачу
          </div>
        </div>
      )}
    </>
  );
}