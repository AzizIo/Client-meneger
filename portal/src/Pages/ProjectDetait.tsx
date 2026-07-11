import { useState, useEffect } from 'react'
import API from '../API/api'
import { useParams } from 'react-router-dom'
import { Link, PenLine } from 'lucide-react';
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
  const [whoOpen, setWhoOpen] = useState<'tasks' | 'files'>('tasks');
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

  if (isLoading) return <div>Загрузка...</div>;
  if (!project) return <div>Проект не найден</div>;

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


  return (
    <>
      <Header />
      <div className='bg-gray-50' >
        <div>
          <div className='container px-2 mx-auto py-8 flex justify-between'>
            <div>
              <div className='font-bold text-2xl'>{project.name}</div>
              <div className='text-sm text-gray-600'>{project.description}</div>
              <div className='flex items-center mt-2 gap-2'>
                <div>
                  <img
                    className="flex h-6 w-6 hover:bg-black/50 items-center justify-center rounded-full bg-indigo-100 ring-4 ring-white"
                    src={project.executor.avatar_url}
                    alt=""
                  />
                </div>
                <div className='text-gray-700 text-sm'>{project.executor.full_name}</div>
                <div className='bg-indigo-700/10 text-indigo-700 ml-4 px-2 py-1 rounded-2xl text-sm'>
                  {project.status}
                </div>
              </div>
            </div>
            <div>
              <button className='flex gap-2 bg-gray-300 px-2 rounded text-center justify-center items-center'>
                <Link size={14} /> <p className='text-gray-700 text-sm'>Share</p>
              </button>
            </div>
          </div>

          <div className='container px-2 mx-auto '>
            <div>
              <div>
                <div>
                  <div className='flex relative items-center justify-center gap-2 overflow-x-auto bg-zinc-100 mt-4 border border-gray-300 rounded-lg px-3 py-2 whitespace-nowrap'>
                    {isExecutor && (

                      <button
                        onClick={() => setModal(true)}
                        className='absolute top-2 right-4 text-gray-400 hover:text-gray-700'
                      >
                        <PenLine size={12} />
                      </button>
                    )}

                    <StageStepper stages={stages} currentStage={currentStage} onStageClick={onStageClick} />

                    {modal && (
                      <div
                        className="fixed inset-0 bg-black/50 flex items-center justify-center"
                        onClick={() => setModal(false)}
                      >
                        <div
                          className="bg-white p-6 rounded-xl w-full max-w-md"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <form onSubmit={createStage} className="flex flex-col gap-4 max-w-md">
                            <div className="flex flex-col gap-2">
                              <label htmlFor="avatar-input" className="text-sm font-medium text-gray-700">
                                Добавить новый шаг
                              </label>
                              <input
                                onChange={(e) => setStageName(e.target.value)}
                                value={stageName}
                                id="avatar-input"
                                type="text"
                                placeholder='Разработка прототипа'
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

                          <div className='mt-6'>
                            <h1 className='text-2xl mx-auto font-bold'>Управление шагами</h1>
                            <div className='mt-8'>
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
                              className="w-full mt-4 rounded-lg bg-indigo-600 px-4 py-2 font-medium text-white transition hover:bg-indigo-700 active:scale-95 disabled:opacity-50"
                            >
                              {isSaving ? 'Сохранение...' : 'Сохранить'}
                            </button>
                          </div>

                          <button
                            onClick={() => setModal(false)}
                            className="mt-4 bg-red-500 text-white px-4 py-2 rounded"
                          >
                            Закрыть
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="border-b mt-4 border-gray-200 mb-4">
                    <div className="flex gap-8">
                      <button
                        onClick={() => setWhoOpen('tasks')}
                        className={`pb-3 text-lg font-medium transition ${whoOpen === 'tasks'
                          ? 'text-indigo-600 border-b-2 border-indigo-600'
                          : 'text-gray-500 hover:text-gray-700'
                          }`}
                      >
                        Tasks
                      </button>

                      <button
                        onClick={() => setWhoOpen('files')}
                        className={`pb-3 text-lg font-medium transition ${whoOpen === 'files'
                          ? 'text-indigo-600 border-b-2 border-indigo-600'
                          : 'text-gray-500 hover:text-gray-700'
                          }`}
                      >
                        Files
                      </button>
                    </div>
                  </div>
                  {whoOpen === 'tasks' ? (
                    <>


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
                    </>
                  ) : (
                    // {{/* функция для добовления задачи, для двух вариантов реализованно разыне запросы поэтому пришлось в рочную передавать URL  */}}
                    <Files
                      endpoints={stageFilesEndpoints}
                    />

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