import { Trash2, Pencil, X, Check } from 'lucide-react';
import { useState } from 'react';
import API from '../API/api'
import { useAuth } from '../Context/AuthContext';
import Files from './Files';
import Comments from './Comments';
import { useToast } from '../Context/ToastContext';
import { motion, AnimatePresence } from "motion/react"
import {
  colors,
  fontDisplay,
  fontMono,
  Eyebrow,
  StampBadge,
  btnPrimary,
  btnPrimaryStyle,
  btnOutline,
  btnOutlineStyle,
  type StampTone,
} from './ui/designSystem';

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
  due_date?: string | null;
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

const TASK_STATUS_STAMP: Record<string, { label: string; tone: StampTone }> = {
  not_started: { label: 'Не начата', tone: 'ink' },
  pending_approval: { label: 'На согласовании', tone: 'blue' },
  approved: { label: 'Одобрено', tone: 'ink' },
  changes_requested: { label: 'Требуются правки', tone: 'red' },
};

function getTaskStamp(status: string) {
  return TASK_STATUS_STAMP[status] ?? { label: status, tone: 'ink' as const };
}

function isOverdue(task: Task) {
  return !!task.due_date && new Date(task.due_date) < new Date() && task.status !== 'approved';
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
  setDueDate
}: any) {
  const { me } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const { showToast } = useToast();

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
      showToast('Ошибка при принятии решения');
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
        showToast('Задача уже отправлена на согласование');
      } else {
        showToast('Ошибка при отправке');
      }
    }
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
      showToast('Название задачи не может быть пустым');
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
      showToast('Ошибка при обновлении задачи');
    } finally {
      setIsSaving(false);
    }
  };

  const iconBtn =
    'inline-flex items-center justify-center h-9 w-9 rounded-md transition-colors hover:bg-black/[0.04]';
  const iconBtnStyle = { border: `1px solid ${colors.line}`, color: colors.muted };

  const inputClass = "w-full rounded-md px-3 py-2 text-sm outline-none transition";
  const inputStyle = { border: `1px solid ${colors.line}`, color: colors.ink };

  return (
    <>
      <div>
        {newTaskOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="fixed inset-0 bg-black/40 flex items-center justify-center z-50"
            onClick={() => setNewTaskOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, y: 16, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.98 }}
              transition={{ duration: 0.24, ease: 'easeOut' }}
              className="bg-white p-6 rounded-lg w-full max-w-md"
              style={{ border: `1px solid ${colors.line}` }}
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="text-base font-semibold mb-4" style={{ color: colors.ink, fontFamily: fontDisplay }}>
                Новая задача
              </h2>

              <form onSubmit={createTask} className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <Eyebrow>Название задачи</Eyebrow>
                  <input
                    onChange={(e) => setTaskName(e.target.value)}
                    id="task-input"
                    type="text"

                    required
                    placeholder="Дизайн главной страницы"
                    className={inputClass}
                    style={inputStyle}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Eyebrow>Описание задачи</Eyebrow>
                  <input
                    onChange={(e) => setTaskDisc(e.target.value)}
                    id="task-desc"
                    type="text"
                    placeholder="Заголовок, картинки и иконки"
                    className={inputClass}
                    style={inputStyle}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Eyebrow>Айди исполнителя (опционально)</Eyebrow>
                  <input
                    onChange={(e) => setAssignee(e.target.value)}
                    id="task-assignee"
                    type="text"
                    placeholder="KSA-123S"
                    className={inputClass}
                    style={inputStyle}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Eyebrow>Дедлайн (опционально)</Eyebrow>
                  <input
                    onChange={(e) => setDueDate(e.target.value)}
                    id="task-due"
                    type="date"
                    className={inputClass}
                    style={{ ...inputStyle, fontFamily: fontMono }}
                  />
                </div>
                <button type="submit" className={btnPrimary} style={btnPrimaryStyle}>
                  Добавить
                </button>
              </form>

              <div className="mt-6 pt-6" style={{ borderTop: `1px solid ${colors.line}` }}>
                <Eyebrow>Управление задачами</Eyebrow>
                <div className="flex flex-col gap-1 mt-3">
                  {tasks.map((task: Task) => (
                    <div className="flex justify-between items-center py-1.5" key={task.id}>
                      <span className="text-sm" style={{ color: colors.ink }}>{task.title}</span>
                      <button
                        onClick={() => deleteTasks(task.id)}
                        className="text-sm transition-colors hover:opacity-70"
                        style={{ color: colors.stampRed }}
                      >
                        Удалить
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <motion.button
                whileHover={{ y: -1, scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                onClick={() => setNewTaskOpen(false)}
                className={`${btnOutline} mt-6 w-full`}
                style={btnOutlineStyle}
              >
                Закрыть
              </motion.button>
            </motion.div>
          </motion.div>
        )}

        <div className="mt-8">
          <div className="flex flex-col gap-2">
            {tasks.map((task: Task, index: number) => {
              const stamp = getTaskStamp(task.status);
              return (
                <motion.div
                  key={task.id}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.22, delay: index * 0.03, ease: 'easeOut' }}
                  whileHover={{ y: -2, scale: 1.01, boxShadow: '0 10px 24px rgba(15, 23, 42, 0.06)' }}
                  whileTap={{ scale: 0.995 }}
                  onClick={() => handleOpen(task)}
                  className="group relative bg-white py-3 px-4 flex justify-between items-center rounded-lg cursor-pointer transition-colors hover:shadow-sm"
                  style={{ border: `1px solid ${colors.line}` }}
                >
                  <div className="min-w-0">
                    <h1 className="font-medium truncate" style={{ color: colors.ink }}>{task.title}</h1>
                    <p className="text-sm mt-0.5 truncate" style={{ color: colors.muted }}>{task.description}</p>
                  </div>

                  <div className="flex items-center gap-4 shrink-0">
                    {task.due_date && (
                      <span
                        className="text-xs"
                        style={{
                          color: isOverdue(task) ? colors.stampRed : colors.muted,
                          fontWeight: isOverdue(task) ? 600 : 400,
                          fontFamily: fontMono,
                        }}
                      >
                        до {new Date(task.due_date).toLocaleDateString('ru-RU')}
                      </span>
                    )}
                    <span className="text-xs" style={{ color: colors.muted, fontFamily: fontMono }}>
                      {new Date(task.created_at).toLocaleDateString('ru-RU')}
                    </span>
                    <StampBadge label={stamp.label} tone={stamp.tone} />
                  </div>
                </motion.div>
              );
            })}
            <AnimatePresence>
              {isOpen && (
                <motion.div initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }} className="fixed inset-0 z-50">
                  <div className="absolute inset-0 bg-black/40" onClick={handleClose} />

                  <motion.div
                    initial={{ x: 24, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    exit={{ x: 24, opacity: 0 }}
                    transition={{ duration: 0.25, ease: 'easeOut' }}
                    className="absolute right-0 top-0 h-full w-full max-w-md bg-white overflow-y-auto"
                    style={{ borderLeft: `1px solid ${colors.line}` }}
                  >
                    <div className="p-6">
                      <div className="mb-4">
                        <div className="flex justify-between items-start mb-3 gap-3">
                          <div className="flex-1">
                            {isEditing ? (
                              <input
                                type="text"
                                value={editTitle}
                                onChange={(e) => setEditTitle(e.target.value)}
                                className="w-full text-xl font-semibold rounded-md px-3 py-2 outline-none"
                                style={{ border: `1px solid ${colors.line}`, color: colors.ink, fontFamily: fontDisplay }}
                                placeholder="Название задачи"
                              />
                            ) : (
                              <h2 className="text-xl font-semibold" style={{ color: colors.ink, fontFamily: fontDisplay }}>
                                {selectedTask?.title}
                              </h2>
                            )}
                          </div>

                          <div className="flex gap-2 shrink-0">
                            <button onClick={() => handleDelete(selectedTask?.id)} className={iconBtn} style={iconBtnStyle} title="Удалить">
                              <Trash2 size={16} />
                            </button>

                            {isEditing ? (
                              <>
                                <button onClick={handleSaveEdit} disabled={isSaving} className={iconBtn} style={iconBtnStyle} title="Сохранить">
                                  <Check size={16} />
                                </button>
                                <button onClick={() => setIsEditing(false)} disabled={isSaving} className={iconBtn} style={iconBtnStyle} title="Отмена">
                                  <X size={16} />
                                </button>
                              </>
                            ) : (
                              <button onClick={handleEditToggle} className={iconBtn} style={iconBtnStyle} title="Редактировать">
                                <Pencil size={16} />
                              </button>
                            )}
                          </div>
                        </div>

                        {isEditing ? (
                          <motion.textarea

                            value={editDescription}
                            onChange={(e) => setEditDescription(e.target.value)}
                            className="w-full text-sm rounded-md px-3 py-2 outline-none resize-none"
                            style={{ border: `1px solid ${colors.line}`, color: colors.ink }}
                            placeholder="Описание задачи"
                            rows={3}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ duration: 0.2 }}
                          />
                        ) : (
                          <p className="text-sm" style={{ color: colors.muted }}>{selectedTask?.description}</p>
                        )}
                      </div>

                      <hr className="mb-6" style={{ borderColor: colors.line }} />

                      <motion.div className="flex flex-col gap-4" initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.2 }} >

                        <div className="flex flex-col gap-1">
                          <Eyebrow>Статус</Eyebrow>
                          <div>
                            <StampBadge {...getTaskStamp(selectedTask?.status ?? '')} />
                          </div>
                        </div>

                        <div className="flex flex-col gap-1">
                          <Eyebrow>Исполнитель</Eyebrow>
                          <div className="flex items-center gap-2">
                            {selectedTask?.assignee?.avatar_url && (
                              <img
                                className="w-6 h-6 rounded-full object-cover"
                                style={{ border: `1px solid ${colors.line}` }}
                                src={selectedTask.assignee.avatar_url}
                                alt=""
                              />
                            )}
                            <p className="text-sm" style={{ color: colors.ink }}>
                              {selectedTask?.assignee ? selectedTask.assignee.full_name : 'Не назначен'}
                            </p>
                          </div>
                        </div>

                        <div className="flex flex-col gap-1">
                          <Eyebrow>Дата создания</Eyebrow>
                          <p className="text-sm" style={{ color: colors.ink, fontFamily: fontMono }}>
                            {selectedTask?.created_at ? new Date(selectedTask.created_at).toLocaleDateString('ru-RU') : ''}
                          </p>
                        </div>

                        <div className="flex flex-col gap-1">
                          <Eyebrow>Дедлайн</Eyebrow>
                          <p
                            className="text-sm"
                            style={{
                              color: selectedTask && isOverdue(selectedTask) ? colors.stampRed : colors.ink,
                              fontWeight: selectedTask && isOverdue(selectedTask) ? 600 : 400,
                              fontFamily: fontMono,
                            }}
                          >
                            {selectedTask?.due_date ? new Date(selectedTask.due_date).toLocaleDateString('ru-RU') : 'Не указан'}
                          </p>
                        </div>

                        <hr className="my-2" style={{ borderColor: colors.line }} />
                        <Comments
                          projectId={projectId}
                          stageId={stageId}
                          taskId={selectedTask?.id}
                        />
                      </motion.div>

                      {me?.role === 'executor' && (
                        <div className="mt-8 flex flex-col gap-4">
                          <Files endpoints={taskFilesEndpoints} isVisible={true} />

                          {!pendingApproval ? (
                            <button onClick={SendAprove} className={`${btnPrimary} w-full`} style={btnPrimaryStyle}>
                              Отправить на согласование
                            </button>
                          ) : (
                            <div
                              className="rounded-lg p-3 text-center text-sm"
                              style={{ border: `1px solid ${colors.line}`, backgroundColor: colors.paper, color: colors.muted }}
                            >
                              Работа отправлена заказчику и ожидает решения
                            </div>
                          )}

                          <div className="flex flex-col gap-2">
                            {history.map(a => (
                              <div key={a.id} className="rounded-lg px-3 py-2 text-sm" style={{ border: `1px solid ${colors.line}` }}>
                                <div className="flex items-center gap-2">
                                  <span style={{ color: colors.ink, fontFamily: fontMono }}>Версия {a.round_number}</span>
                                  <StampBadge label={a.status === 'approved' ? 'Одобрено' : 'Отклонено'} tone={a.status === 'approved' ? 'ink' : 'red'} />
                                </div>
                                {a.decision_comment && (
                                  <p className="mt-1" style={{ color: colors.muted }}>{a.decision_comment}</p>
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
                              <Eyebrow>История согласования</Eyebrow>
                              {history.map(a => (
                                <div key={a.id} className="flex flex-col gap-1 rounded-lg px-3 py-2 text-sm" style={{ border: `1px solid ${colors.line}` }}>
                                  <div className="flex items-center gap-2">
                                    <span style={{ color: colors.ink, fontFamily: fontMono }}>Версия {a.round_number}:</span>
                                    <StampBadge label={a.status === 'approved' ? 'Одобрено' : 'Отклонено'} tone={a.status === 'approved' ? 'ink' : 'red'} />
                                  </div>
                                  {a.decision_comment && (
                                    <p style={{ color: colors.muted }}>{a.decision_comment}</p>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}

                          {pendingApproval ? (
                            <div className="flex flex-col gap-3">
                              <Eyebrow>Версия {pendingApproval.round_number} ожидает вашего решения</Eyebrow>

                              <Files endpoints={taskFilesEndpoints} />

                              <button onClick={() => decide(pendingApproval.id, 'approved')} className={`${btnPrimary} w-full`} style={btnPrimaryStyle}>
                                Одобрить
                              </button>
                              <button
                                onClick={() => {
                                  const comment = prompt('Что нужно исправить?');
                                  if (comment !== null) {
                                    decide(pendingApproval.id, 'rejected', comment);
                                  }
                                }}
                                className={`${btnOutline} w-full`}
                                style={{ ...btnOutlineStyle, borderColor: colors.stampRed, color: colors.stampRed }}
                              >
                                Отклонить
                              </button>
                            </div>
                          ) : (
                            <p className="text-sm text-center" style={{ color: colors.muted }}>
                              Ожидаем отправки на согласование от исполнителя
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>


          </div>
        </div>
      </div>

      {me?.role === 'executor' && (
        <motion.div
          whileHover={{ y: -1, scale: 1.005 }}
          whileTap={{ scale: 0.995 }}
          onClick={() => setNewTaskOpen(true)}
          className="flex mt-4 w-full"
        >
          <div
            className="w-full text-center py-4 rounded-lg cursor-pointer transition-colors hover:bg-black/[0.02]"
            style={{ border: `1.5px dashed ${colors.line}`, color: colors.muted }}
          >
            + Добавить новую задачу
          </div>
        </motion.div>
      )}
    </>
  );
}