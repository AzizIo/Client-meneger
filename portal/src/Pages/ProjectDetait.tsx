import { useState, useEffect } from 'react'
import API from '../API/api'
import { useParams } from 'react-router-dom'
import { Link, PenLine, X } from 'lucide-react';
import Header from '../Components/Header';
import StageStepper from '../Components/Stagesstepper';
import { useAuth } from '../Context/AuthContext';
import Tasks from '../Components/Tasks';
import Files from '../Components/Files'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import SortableStageRow from '../Components/Sortablestagerow'
import type { DragEndEvent } from "@dnd-kit/core";
import Team from '../Components/Team';
import ActivityFeed from '../Components/ActivityFeed';
import { useToast } from '../Context/ToastContext';
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
} from '../Components/ui/designSystem';

interface Project {
  id: string;
  executor_id: string;
  client_id: string;
  name: string;
  description: string;
  status: string;
  is_archived: boolean;
  created_at: string;
  updated_at: string;

  executor: {
    id: string;
    email: string;
    full_name: string;
    avatar_url: string;
    role: string;
    is_active: boolean;
    created_at: string;
  };

  client: {
    id: string;
    email: string;
    full_name: string;
    avatar_url: string;
    role: string;
    is_active: boolean;
    created_at: string;
  };
}
interface Stage {
  id: string;
  project_id: string;
  name: string;
  position: number;
  status: string;
  created_at: string;
}

interface Task {
  id: string;
  stage_id: string;
  title: string;
  description: string;
  assignee_id: string;
  status: string;
  position: Number;
  created_at: string;
  assignee: {
    id: string;
    email: string;
    full_name: string;
    avatar_url: string;
    role: string;
    is_active: boolean;
    created_at: string;
  }
}

const STATUS_STAMP: Record<string, { label: string; tone: StampTone }> = {
  active: { label: 'В работе', tone: 'blue' },
  completed: { label: 'Завершён', tone: 'ink' },
  on_hold: { label: 'На паузе', tone: 'red' },
};

function getStatusStamp(status: string) {
  return STATUS_STAMP[status] ?? { label: status, tone: 'ink' as const };
}

export default function ProjectDetait() {
  const { me } = useAuth();
  const { showToast } = useToast();
  const { projectId } = useParams()
  const [project, setProject] = useState<Project | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [modal, setModal] = useState(false)
  const [stageName, setStageName] = useState("")
  const [stages, setStages] = useState<Stage[]>([])
  const [isSaving, setIsSaving] = useState(false);
  const [newTaskOpen, setNewTaskOpen] = useState(false)
  const [currentStage, setCurrentStage] = useState<string>()
  const [taskName, setTaskName] = useState("")
  const [taskDisc, setTaskDisc] = useState("")
  const [tasks, setTasks] = useState<Task[]>([])
  const [assignee, setAssignee] = useState<string>()
  const [dueDate, setDueDate] = useState<string>("")
  const [whoOpen, setWhoOpen] = useState<'tasks' | 'files' | 'team' | 'history'>('tasks');
  const isExecutor = me?.role === 'executor';
  const isProjectOwner = me?.id === project?.executor_id;

  const stageFilesEndpoints = {
    list: `/projects/${projectId}/stages/${currentStage}/files`,
    upload: `/projects/${projectId}/stages/${currentStage}/files`,
    download: `/projects/${projectId}/stages/${currentStage}/files`,
    remove: `/projects/${projectId}/stages/${currentStage}/files`,
  }
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  );

  async function updateProjectStatus(newStatus: string) {
    try {
      const res = await API.patch(`/projects/${projectId}`, { status: newStatus });
      setProject(prev => prev ? { ...prev, status: res.data.status } : prev);
      showToast('Статус проекта обновлён', 'success');
    } catch (err) {
      console.error(err);
      showToast('Не удалось обновить статус проекта');
    }
  }

  useEffect(() => {
    API.get(`/projects/${projectId}`)
      .then(res => {
        setProject(res.data)
      })
      .catch(err => console.error(err))
      .finally(() => setIsLoading(false));

  }, [projectId]);

  useEffect(() => {
    console.log('ME FROM CONTEXT:', me);
    API.get(`/projects/${projectId}/stages`)
      .then(res => {
        setStages(res.data)
        if (res.data.length > 0) {
          setCurrentStage(res.data[0].id)
        }
      }
      )
      .catch(err => console.error(err))
  }, [projectId]);

  useEffect(() => {
    if (!currentStage) return;

    API.get(`/projects/${projectId}/stages/${currentStage}/tasks`)
      .then(res => setTasks(res.data))
      .catch(err => console.error(err))
  }, [currentStage])

  if (isLoading) return (
    <div className="flex items-center justify-center min-h-screen text-sm" style={{ color: colors.muted }}>
      Загрузка...
    </div>
  );
  if (!project) return (
    <div className="flex items-center justify-center min-h-screen text-sm" style={{ color: colors.muted }}>
      Проект не найден
    </div>
  );

  async function createTask(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    try {
      await API.post(`/projects/${projectId}/stages/${currentStage}/tasks`, {
        title: taskName,
        description: taskDisc,
        assignee_id: assignee,
        due_date: dueDate ? new Date(dueDate).toISOString() : null,
      })
      window.location.reload()
    }
    catch {
      showToast("Выберете шаг в который нужно добавить задачу")
    }
  }

  async function onStageClick(id: string) {
    setCurrentStage(id)
  }

  async function createStage(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (stageName.length < 1) {
      showToast("Задача не может быть пустой")
      return
    }
    try {
      const response = await API.post(`/projects/${projectId}/stages`, {
        name: stageName
      })
      const res = await response.data
      setStages(prev => [...prev, res])
      setStageName('')
    }
    catch {
      console.error()
    }
  }

  function handleNameChange(stageId: string, newName: string) {
    setStages(prevStages =>
      prevStages?.map(stage =>
        stage.id === stageId ? { ...stage, name: newName } : stage
      )
    );
  }

  async function deleteTasks(id: string) {
    try {
      await API.delete(`/projects/${projectId}/stages/${currentStage}/tasks/${id}`);
      window.location.reload()
    } catch (err: any) {
      console.log(err.response?.status);
      console.log(err.response?.data);
      console.log(err.response?.headers);
    }
  }

  async function handleSaveAll() {
    setIsSaving(true);
    try {
      await Promise.all(
        stages.map((stage) =>
          API.patch(`/projects/${projectId}/stages/${stage.id}`, {
            name: stage.name,
          })
        )
      );

      await API.put(`/projects/${projectId}/stages/reorder`, {
        stages: stages.map((stage) => ({
          id: stage.id,
          position: stage.position,
        })),
      });

      window.location.reload()
    } catch (err) {
      console.error(err);
      showToast('Не удалось сохранить некоторые изменения');
    } finally {
      setIsSaving(false);
    }
  }

  async function deleteStage(id: string) {
    try {
      await API.delete(`/projects/${projectId}/stages/${id}`);
      setStages(prev => prev.filter(stage => stage.id !== id));
    } catch (err) {
      console.error(err);
      showToast('Не удалось удалить этап');
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    setStages((prevStages) => {
      const oldIndex = prevStages.findIndex((s) => s.id === active.id);
      const newIndex = prevStages.findIndex((s) => s.id === over.id);
      const reordered = arrayMove(prevStages, oldIndex, newIndex);
      return reordered.map((stage, index) => ({ ...stage, position: index }));
    });
  }

  const stamp = getStatusStamp(project.status);

  const TABS: { key: typeof whoOpen; label: string }[] = [
    { key: 'tasks', label: 'Задачи' },
    { key: 'files', label: 'Файлы' },
    { key: 'team', label: 'Команда' },
    { key: 'history', label: 'История' },
  ];

  return (
    <>
      <Header />
      <div className="min-h-screen" style={{ backgroundColor: colors.paper }}>
        <div className='container px-2 mx-auto py-8 flex justify-between gap-4'>
          <div className="min-w-0">
            <Eyebrow>Проект</Eyebrow>
            <div className="font-semibold text-2xl mt-1" style={{ color: colors.ink, fontFamily: fontDisplay }}>
              {project.name}
            </div>
            <div className="text-sm mt-1" style={{ color: colors.muted }}>{project.description}</div>

            <div className='flex items-center flex-wrap mt-3 gap-3'>
              <div className="flex items-center gap-2">
                <img
                  className="flex h-6 w-6 items-center justify-center rounded-full"
                  style={{ border: `1px solid ${colors.line}` }}
                  src={project.executor.avatar_url}
                  alt=""
                />
                <span className="text-sm" style={{ color: colors.ink }}>{project.executor.full_name}</span>
              </div>

              {isProjectOwner ? (
                <select
                  value={project.status}
                  onChange={(e) => updateProjectStatus(e.target.value)}
                  className="text-sm rounded-md px-2 py-1 outline-none bg-white"
                  style={{ border: `1px solid ${colors.line}`, color: colors.ink, fontFamily: fontMono }}
                >
                  <option value="active">В работе</option>
                  <option value="completed">Завершён</option>
                  <option value="on_hold">На паузе</option>
                </select>
              ) : (
                <StampBadge label={stamp.label} tone={stamp.tone} />
              )}
            </div>
          </div>

          <div className="shrink-0">
            <button className={`${btnOutline} gap-2`} style={btnOutlineStyle}>
              <Link size={14} /> Share
            </button>
          </div>
        </div>

        <div className='container px-2 mx-auto'>
          <div
            className='flex relative items-center justify-center gap-2 overflow-x-auto bg-white mt-4 rounded-lg px-3 py-2 whitespace-nowrap'
            style={{ border: `1px solid ${colors.line}` }}
          >
            {isExecutor && (
              <button
                onClick={() => setModal(true)}
                className='absolute top-2 right-4 transition-colors hover:opacity-70'
                style={{ color: colors.muted }}
              >
                <PenLine size={14} />
              </button>
            )}

            <StageStepper stages={stages} currentStage={currentStage ?? ''} onStageClick={onStageClick} />

            {modal && (
              <div
                className="fixed inset-0 bg-black/40 flex items-center justify-center z-50"
                onClick={() => setModal(false)}
              >
                <div
                  className="bg-white p-6 rounded-lg w-full max-w-md max-h-[85vh] overflow-y-auto"
                  style={{ border: `1px solid ${colors.line}` }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-base font-semibold" style={{ color: colors.ink, fontFamily: fontDisplay }}>
                      Управление шагами
                    </h2>
                    <button
                      onClick={() => setModal(false)}
                      className="inline-flex items-center justify-center h-8 w-8 rounded-md transition-colors hover:bg-black/[0.04]"
                      style={{ color: colors.muted }}
                    >
                      <X size={16} />
                    </button>
                  </div>

                  <form onSubmit={createStage} className="flex flex-col gap-4">
                    <div className="flex flex-col gap-1.5">
                      <Eyebrow>Добавить новый шаг</Eyebrow>
                      <input
                        onChange={(e) => setStageName(e.target.value)}
                        value={stageName}
                        id="stage-input"
                        type="text"
                        placeholder='Разработка прототипа'
                        className="w-full rounded-md px-3 py-2 text-sm outline-none transition"
                        style={{ border: `1px solid ${colors.line}`, color: colors.ink }}
                      />
                    </div>
                    <button type="submit" className={btnPrimary} style={btnPrimaryStyle}>
                      Добавить
                    </button>
                  </form>

                  <div className='mt-6 pt-6' style={{ borderTop: `1px solid ${colors.line}` }}>
                    <Eyebrow>Существующие шаги</Eyebrow>
                    <div className="flex flex-col gap-1 mt-3">
                      <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragEnd={handleDragEnd}
                      >
                        <SortableContext
                          items={stages.map((s) => s.id)}
                          strategy={verticalListSortingStrategy}
                        >
                          {stages.map((stage) => (
                            <SortableStageRow
                              key={stage.id}
                              stage={stage}
                              onNameChange={handleNameChange}
                              onDelete={deleteStage}
                            />
                          ))}
                        </SortableContext>
                      </DndContext>
                    </div>

                    <button
                      onClick={handleSaveAll}
                      disabled={isSaving}
                      className={`${btnPrimary} w-full mt-4`}
                      style={btnPrimaryStyle}
                    >
                      {isSaving ? 'Сохранение...' : 'Сохранить'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="mt-4 mb-4" style={{ borderBottom: `1px solid ${colors.line}` }}>
            <div className="flex gap-6">
              {TABS.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setWhoOpen(tab.key)}
                  className="pb-3 text-sm font-medium transition-colors border-b-2 -mb-px"
                  style={{
                    color: whoOpen === tab.key ? colors.ink : colors.muted,
                    borderColor: whoOpen === tab.key ? colors.ink : 'transparent',
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {whoOpen === 'tasks' && (
            <Tasks
              tasks={tasks}
              setNewTaskOpen={setNewTaskOpen}
              newTaskOpen={newTaskOpen}
              setTaskName={setTaskName}
              setTaskDisc={setTaskDisc}
              createTask={createTask}
              setAssignee={setAssignee}
              deleteTasks={deleteTasks}
              projectId={projectId}
              stageId={currentStage}
              setDueDate={setDueDate}
              onTaskUpdate={() => {
                API.get(`/projects/${projectId}/stages/${currentStage}/tasks`)
                  .then(res => setTasks(res.data))
                  .catch(err => console.error(err));
              }}
            />
          )}

          {whoOpen === 'files' && (
            <div className='min-h-screen'>
              <Files endpoints={stageFilesEndpoints} isVisible={true} />
            </div>
          )}

          {whoOpen === 'team' && (
            <Team projectId={projectId ?? ''} executorId={project.executor_id} />
          )}

          {whoOpen === 'history' && (
            <div className='bg-white rounded-lg p-6' style={{ border: `1px solid ${colors.line}` }}>
              <ActivityFeed projectId={projectId!} />
            </div>
          )}
        </div>
      </div>
    </>
  )
}