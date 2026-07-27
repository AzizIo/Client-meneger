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

export default function ProjectDetait() {
  const { me } = useAuth();
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
  const [whoOpen, setWhoOpen] = useState<'tasks' | 'files' | 'team'>('tasks');
  const isExecutor = me?.role === 'executor';

  // переменная хранит в себе все пути чтобы в пропсы передовать только одно занчение
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
        // Сразу выбираем первый этап как дефолтный —
        // res.data[0] существует только если этапы вообще есть
        if (res.data.length > 0) {
          setCurrentStage(res.data[0].id)
        }
      }
      )
      .catch(err => console.error(err))
  }, [projectId]);

  useEffect(() => {
    // Защита: не делаем запрос пока currentStage ещё undefined
    if (!currentStage) return;

    API.get(`/projects/${projectId}/stages/${currentStage}/tasks`)
      .then(res => setTasks(res.data))
      .catch(err => console.error(err))
  }, [currentStage])

  if (isLoading) return <div className="flex items-center justify-center min-h-screen text-sm text-gray-400">Загрузка...</div>;
  if (!project) return <div className="flex items-center justify-center min-h-screen text-sm text-gray-400">Проект не найден</div>;

  async function createTask(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    try {
      await API.post(`/projects/${projectId}/stages/${currentStage}/tasks`, {
        title: taskName,
        description: taskDisc,
        assignee_id: assignee
      })
      window.location.reload()

    }
    catch {
      alert("Выберете шаг в который нужно добавить задачу")
    }
  }

  // перейти к stage
  async function onStageClick(id: string) {
    setCurrentStage(id)
  }
  // поставить потом ошибку что не выбран stage
  async function createStage(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (stageName.length < 1) {
      alert("Задача не может быть пустой")
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

  // НОВОЕ: эта функция была нужна для onChange инпута, но отсутствовала.
  // Без неё value={stage.name} без onChange делал поле нередактируемым.
  // Паттерн: создаём НОВЫЙ массив, где только нужный stage заменён на
  // копию с обновлённым name — остальные элементы остаются как были.
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
      // 1. Имена — отдельными PATCH-запросами, как и раньше
      await Promise.all(
        stages.map((stage) =>
          API.patch(`/projects/${projectId}/stages/${stage.id}`, {
            name: stage.name,
          })
        )
      );

      // 2. Порядок — ОДНИМ запросом на reorder-эндпоинт, который мы
      // делали на бэкенде. stages уже хранят актуальные position
      // после handleDragEnd, просто собираем их в нужный формат.
      await API.put(`/projects/${projectId}/stages/reorder`, {
        stages: stages.map((stage) => ({
          id: stage.id,
          position: stage.position,
        })),
      });

      window.location.reload()
    } catch (err) {
      console.error(err);
      alert('Не удалось сохранить некоторые изменения');
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
      alert('Не удалось удалить этап');
    }
  }


  // Вызывается, когда пользователь ОТПУСТИЛ элемент после перетаскивания.
  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;

    // over может быть null, если бросили элемент не над списком
    // (например, вынесли за пределы модалки) — тогда ничего не делаем.
    if (!over || active.id === over.id) return;

    setStages((prevStages) => {
      const oldIndex = prevStages.findIndex((s) => s.id === active.id);
      const newIndex = prevStages.findIndex((s) => s.id === over.id);

      // arrayMove — готовая утилита из @dnd-kit/sortable, переставляет
      // элемент массива с oldIndex на newIndex, возвращая НОВЫЙ массив
      // (не мутирует исходный — это важно для React state).
      const reordered = arrayMove(prevStages, oldIndex, newIndex);

      // После локальной перестановки сразу пересчитываем position
      // у каждого элемента по его новому индексу в массиве — это и
      // есть то, что отправится на сервер при следующем handleSaveAll
      // ИЛИ можно отправить сразу здесь же (см. вариант Б ниже).
      return reordered.map((stage, index) => ({ ...stage, position: index }));
    });
  }

  // Единый визуальный язык кнопок — те же классы, что и в Tasks.tsx
  const btnPrimary =
    'inline-flex items-center justify-center rounded-md bg-gray-900 text-white hover:bg-gray-700 px-4 py-2.5 text-sm font-medium transition-colors disabled:opacity-50 disabled:pointer-events-none';
  const btnOutline =
    'inline-flex items-center justify-center rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50 px-4 py-2.5 text-sm font-medium transition-colors';

  return (
    <>
      <Header />
      <div className='bg-gray-50 min-h-screen' >

        <div>
          <div className='container px-2 mx-auto py-8 flex justify-between'>
            <div>
              <div className='font-bold text-2xl text-gray-900'>{project.name}</div>

              <div className='text-sm text-gray-500'>{project.description}</div>
              <div className='flex items-center mt-2 gap-2'>
                <div>
                  <img
                    className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-100 ring-2 ring-white"
                    src={project.executor.avatar_url}
                    alt=""
                  />
                </div>
                <div className='text-gray-700 text-sm'>{project.executor.full_name}</div>
                <div className='flex items-center gap-1.5 text-sm text-gray-600 ml-4'>
                  <span className='h-1.5 w-1.5 rounded-full bg-gray-400' />
                  {project.status}
                </div>
              </div>
            </div>
            <div>
              <button className={`${btnOutline} gap-2`}>
                <Link size={14} /> Share
              </button>
            </div>
          </div>

          <div className='container px-2 mx-auto '>
            <div>
              <div>
                <div>
                  <div className='flex relative items-center justify-center gap-2 overflow-x-auto bg-white mt-4 border border-gray-200 rounded-lg px-3 py-2 whitespace-nowrap'>
                    {isExecutor && (
                      <button
                        onClick={() => setModal(true)}
                        className='absolute top-2 right-4 text-gray-400 hover:text-gray-700 transition-colors'
                      >
                        <PenLine size={14} />
                      </button>
                    )}

                    <StageStepper stages={stages} currentStage={currentStage} onStageClick={onStageClick} />

                    {modal && (
                      <div
                        className="fixed inset-0 bg-black/40 flex items-center justify-center z-50"
                        onClick={() => setModal(false)}
                      >
                        <div
                          className="bg-white p-6 rounded-lg w-full max-w-md border border-gray-200 max-h-[85vh] overflow-y-auto"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="flex items-center justify-between mb-4">
                            <h2 className="text-base font-semibold text-gray-900">Управление шагами</h2>
                            <button
                              onClick={() => setModal(false)}
                              className="inline-flex items-center justify-center h-8 w-8 rounded-md text-gray-400 hover:text-gray-900 hover:bg-gray-50 transition-colors"
                            >
                              <X size={16} />
                            </button>
                          </div>

                          <form onSubmit={createStage} className="flex flex-col gap-4">
                            <div className="flex flex-col gap-1.5">
                              <label htmlFor="stage-input" className="text-sm text-gray-500">
                                Добавить новый шаг
                              </label>
                              <input
                                onChange={(e) => setStageName(e.target.value)}
                                value={stageName}
                                id="stage-input"
                                type="text"
                                placeholder='Разработка прототипа'
                                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none transition focus:border-gray-900"
                              />
                            </div>
                            <button type="submit" className={btnPrimary}>
                              Добавить
                            </button>
                          </form>

                          <div className='mt-6 pt-6 border-t border-gray-100'>
                            <p className="text-gray-400 text-xs uppercase tracking-wide mb-3">
                              Существующие шаги
                            </p>
                            <div className="flex flex-col gap-1">
                              <DndContext
                                sensors={sensors}
                                collisionDetection={closestCenter}
                                onDragEnd={handleDragEnd}
                              >
                                {/* items — массив id в ТЕКУЩЕМ порядке. SortableContext должен
          получать актуальный список id на каждый рендер, иначе он не
          поймёт, что порядок изменился. */}
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

                            {/* Кнопка "Сохранить" теперь должна отправлять и name, И position —
      см. обновлённую handleSaveAll ниже */}
                            <button
                              onClick={handleSaveAll}
                              disabled={isSaving}
                              className={`${btnPrimary} w-full mt-4`}
                            >
                              {isSaving ? 'Сохранение...' : 'Сохранить'}
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="border-b mt-4 border-gray-200 mb-4">
                    <div className="flex gap-6">
                      <button
                        onClick={() => setWhoOpen('tasks')}
                        className={`pb-3 text-sm font-medium transition-colors border-b-2 -mb-px ${whoOpen === 'tasks'
                          ? 'text-gray-900 border-gray-900'
                          : 'text-gray-400 border-transparent hover:text-gray-600'
                          }`}
                      >
                        Tasks
                      </button>

                      <button
                        onClick={() => setWhoOpen('files')}
                        className={`pb-3 text-sm font-medium transition-colors border-b-2 -mb-px ${whoOpen === 'files'
                          ? 'text-gray-900 border-gray-900'
                          : 'text-gray-400 border-transparent hover:text-gray-600'
                          }`}
                      >
                        Files
                      </button>
                      <button
                        onClick={() => setWhoOpen('team')}
                        className={`pb-3 text-sm font-medium transition-colors border-b-2 -mb-px ${whoOpen === 'team'
                          ? 'text-gray-900 border-gray-900'
                          : 'text-gray-400 border-transparent hover:text-gray-600'
                          }`}
                      >
                        Команда
                      </button>
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

                  {/* НОВОЕ — вставь свой готовый компонент здесь */}
                  {whoOpen === 'team' && (
                    <Team projectId={projectId} executorId={project.executor_id} />
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div >
    </>
  )
}