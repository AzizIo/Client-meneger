import API from '../API/api'
import Header from '../Components/Header'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import StageStepper from '../Components/Stagesstepper'

interface User {
  id: string;
  full_name: string;
  email: string;
  avatar_url: string | undefined;
  role: string;
  create_at: string;
}

interface Project {
  id: string;
  executor_id: string;
  client_id: string;
  name: string;
  description: string;
  status: string;
  is_archived: boolean
  stages: { id: string; status: string }[]
}

interface Assignee {
  id: string;
  full_name: string;
  avatar_url?: string;
}

interface PendingApprovalTask {
  id: string;
  title: string;
  description?: string;
  project_id: string;
  stage_id: string;
  status: string;
  created_at: string;
  assignee?: Assignee;
}

export default function MainPage() {
  const [me, setMe] = useState<User | null>(null)
  const [projects, setProjects] = useState<Project[]>([])
  const [pendingApprovals, setPendingApprovals] = useState<PendingApprovalTask[]>([])
  const [loadingApprovals, setLoadingApprovals] = useState(false)

  useEffect(() => {
    API.get('/auth/me')
      .then(res => setMe(res.data))
      .catch(err => console.log(err.response?.data))
    API.get('/projects')
      .then(res => setProjects(res.data))
      .catch(err => console.log(err.response?.data))
  }, [])

  // Задачи на согласование доступны только клиенту
  useEffect(() => {
    if (me?.role !== 'client') return

    setLoadingApprovals(true)
    API.get('/dashboard/pending-approvals')
      .then(res => setPendingApprovals(res.data))
      .catch(err => console.log(err.response?.data))
      .finally(() => setLoadingApprovals(false))
  }, [me])

  return (
    <>
      <div className='bg-gray-50'>
        <Header />
        <main className='container min-h-screen mx-auto px-6 py-8 space-y-10'>
          <section>
            <h1 className="text-3xl font-bold">
              Добро пожаловать, {me ? me.full_name : "..."}
            </h1>

            <p className="mt-2 text-gray-600 max-w-3xl">
              Thursday, June 18, 2024
            </p>
          </section>

          <section>
            <div className='grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6'>
              <div className='rounded-lg bg-white p-6 border-[0.25px] border-gray-300 max-h-30 flex flex-col justify-between'>
                <p className='text-sm text-gray-500'>Общее количество проектов</p>
                <p className='text-indigo-500 text-2xl font-bold'>{projects.length}</p>
              </div>
              <div className='rounded-lg max-h-30 border-[0.25px] border-gray-300 bg-white p-6 flex flex-col justify-between'>
                <p className='text-sm text-gray-500'>Активные проекты</p>
                <p className='text-orange-500 text-2xl font-bold'>
                  {projects.filter(p => p.status === 'active').length}
                </p>
              </div>
              <div className='rounded-lg bg-white p-6 border-[0.25px] border-gray-300 max-h-30 flex flex-col justify-between'>
                <p className='text-sm text-gray-500'>Завершенные проекты</p>
                <p className='text-green-500 text-2xl font-bold'>
                  {projects.filter(p => p.status === 'completed').length}
                </p>
              </div>
              <div className='rounded-lg bg-white p-6 border-[0.25px] border-gray-300 max-h-30 flex flex-col justify-between'>
                <p className='text-sm text-gray-500'>В ожидании</p>
                <p className='text-red-500 text-2xl font-bold'>
                  {projects.filter(p => p.status === 'on_hold').length}
                </p>
              </div>
            </div>
          </section>

          {/* Блок задач на согласование — только для клиента */}
          {me?.role === 'client' && (
            <section>
              <div className='flex items-center justify-between mb-6'>
                <h2 className='text-2xl font-semibold'>Ожидают вашего согласования</h2>
                {pendingApprovals.length > 0 && (
                  <span className='inline-flex items-center rounded-full bg-amber-100 text-amber-700 px-3 py-1 text-sm font-medium'>
                    {pendingApprovals.length}
                  </span>
                )}
              </div>

              {loadingApprovals ? (
                <p className='text-gray-500 text-sm'>Загрузка...</p>
              ) : pendingApprovals.length === 0 ? (
                <div className='rounded-lg bg-white border-[0.25px] border-gray-300 p-6 text-gray-500 text-sm'>
                  Нет задач, ожидающих согласования
                </div>
              ) : (
                <div className='space-y-3'>
                  {pendingApprovals.map(task => (
                    <div
                      key={task.id}
                      to={`/projects/${task.project_id}?stage=${task.stage_id}&task=${task.id}`}
                      className='block'
                    >
                      <div className='rounded-lg bg-white border-l-4 border-amber-400 border-[0.25px] border-gray-300 hover:shadow-lg transition-all duration-200 p-5 flex items-center justify-between'>
                        <div className='flex-1'>
                          <h3 className='text-lg font-semibold'>{task.title}</h3>
                          {task.description && (
                            <p className='text-gray-600 text-sm mt-1 line-clamp-2'>
                              {task.description}
                            </p>
                          )}
                          <p className='text-xs text-gray-400 mt-2'>
                            {task.assignee ? `Исполнитель: ${task.assignee.full_name}` : ''}
                            {' · '}
                            {new Date(task.created_at).toLocaleDateString('ru-RU')}
                          </p>
                        </div>
                        <span className='ml-4 inline-flex rounded-full bg-amber-100 text-amber-700 px-3 py-1 text-sm font-medium whitespace-nowrap'>
                          На согласовании
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          <section>
            <div className='flex items-center justify-between mb-6'>
              <h2 className='text-2xl font-semibold mb-4'>Ваши проекты</h2>
            </div>
            <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'>
              {projects.length == 0 ? <div className='text-gray-400' >Проектов пока нет</div> :
                <div>
                  {projects.map(project => (
                    <Link className='h-full' key={project.id} to={`/projects/${project.id}`}>
                      <div className='h-full rounded-lg border-0.5 bg-white border-[0.25px] border-gray-300 hover:shadow-lg transition-all duration-200 p-6 flex flex-col'>
                        <div className='flex justify-between'>
                          <div className="flex-1 space-y-1">
                            <div>
                              <h3 className="text-xl font-semibold">{project.name}</h3>
                              <p className="text-gray-600">{project.description}</p>
                            </div>
                          </div>
                          <div>
                            <span className="inline-flex rounded-full bg-gray-100 px-3 py-1 text-sm font-medium">
                              {project.status}
                            </span>
                          </div>
                        </div>
                        <StageStepper
                          stages={project?.stages ?? []}
                          currentStage={
                            project?.stages?.find(s => s.status === "in_progress")?.id
                          }
                          compact
                        />
                      </div>
                    </Link>
                  ))}
                </div>

              }

            </div>
          </section>
        </main>
      </div>
    </>
  )
}