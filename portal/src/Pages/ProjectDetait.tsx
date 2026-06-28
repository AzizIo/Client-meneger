import { useState, useEffect } from 'react'
import API from '../API/api'
import { useParams } from 'react-router-dom'
import { Link, Trash2, PenLine } from 'lucide-react';
import Header from '../Components/Header';
import StageStepper from '../Components/Stagesstepper';

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

export default function ProjectDetait() {

  const { projectId } = useParams()
  const [project, setProject] = useState<Project | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [modal, setModal] = useState(false)
  const [stageName, setStageName] = useState("")
  const [stages, setStages] = useState<Stage[]>([])
  const [isSaving, setIsSaving] = useState(false);

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
      .then(res => setStages(res.data))
      .catch(err => console.error(err))
  }, [projectId]);

  if (isLoading) return <div>Загрузка...</div>;
  if (!project) return <div>Проект не найден</div>;

  async function onStageClick(id: string) {
    await API.patch(`/projects/${projectId}/stages/${id}`, {
      status: 'completed'
    })
    window.location.reload()
  }

  async function createStage(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
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

  async function handleSaveAll() {
    setIsSaving(true);
    try {
      // Promise.all запускает все запросы ПАРАЛЛЕЛЬНО, и ждёт, пока
      // ВСЕ они завершатся — быстрее, чем await в цикле for по очереди.
      await Promise.all(
        stages.map(stage =>
          API.patch(`/projects/${projectId}/stages/${stage.id}`, {
            name: stage.name,
          })
        )
      );
      alert('Изменения сохранены');
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

  return (
    <>
      <Header />
      <div>
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

          <div className='container px-2 mx-auto py-8'>
            <div>
              <div>
                <h1>Этапы проекта</h1>
                <div>
                  <div className='flex relative items-center justify-center gap-2 overflow-x-auto bg-zinc-100 mt-4 border border-gray-300 rounded-lg px-3 py-2 whitespace-nowrap'>

                    {/* ИСПРАВЛЕНО: убрал лишний вложенный div с absolute,
                        теперь только один элемент позиционируется в угол */}
                    <button
                      onClick={() => setModal(true)}
                      className='absolute top-2 right-4 text-gray-400 hover:text-gray-700'
                    >
                      <PenLine size={12} />
                    </button>

                    <StageStepper stages={stages} onStageClick={onStageClick} />

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
                              {/* ИСПРАВЛЕНО: добавлен key, onChange для
                                  инпута (его не было — поле было заблокировано) */}
                              {stages.map(stage => (
                                <div key={stage.id} className='flex items-center justify-between mx-8 mb-3'>
                                  <input
                                    value={stage.name}
                                    onChange={(e) => handleNameChange(stage.id, e.target.value)}
                                    type="text"
                                    className="flex-1 mr-3 rounded border border-gray-300 px-3 py-1.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                                  />
                                  <button
                                    onClick={() => deleteStage(stage.id)}
                                    className='p-3 rounded bg-red-500 hover:bg-red-600'
                                  >
                                    <Trash2 size={16} color='white' />
                                  </button>
                                </div>
                              ))}
                            </div>

                            {/* НОВОЕ: кнопки "Сохранить" не было вообще —
                                handleSaveAll существовала, но никем не вызывалась */}
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
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}