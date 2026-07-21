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
  stages: object
}
export default function MainPage() {
  const [me, setMe] = useState<User | null>(null)
  const [projects, setProjects] = useState<Project[]>([])
  useEffect(() => {
    const token = localStorage.getItem('token')
    console.log("TOKEN:", token)

    API.get('/auth/me')
      .then(res => setMe(res.data))
      .catch(err => console.log(err.response?.data))
    API.get('/projects')
      .then(res => setProjects(res.data))
      .catch(err => console.log(err.response?.data))
  }, [])

  return (
    <>
      <div className=' bg-gray-50' >
        <Header />
        <main className='container  min-h-screen mx-auto px-6 py-8 space-y-10' >
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
                <p className='text-sm text-gray-500' >
                  Общее количество проектов
                </p>
                <p className='text-black text-2xl font-bold'>

                  {projects.length}
                </p>
              </div>
              <div className='rounded-lg max-h-30 border-[0.25px] border-gray-300  bg-white p-6  flex flex-col justify-between'>
                <p className='text-sm text-gray-500' >
                  Активные проекты
                </p>
                <p className='text-black text-2xl font-bold' >

                  {projects.filter(p => p.status === 'active').length}
                </p>
              </div>
              <div className='rounded-lg  bg-white p-6 border-[0.25px] border-gray-300 max-h-30 flex flex-col justify-between'>
                <p className='text-sm text-gray-500' >
                  Завершенные проекты
                </p>
                <p className='text-black text-2xl font-bold' >

                  {projects.filter(p => p.status === 'completed').length}
                </p>
              </div>
              <div className='rounded-lg bg-white p-6 border-[0.25px] border-gray-300 max-h-30 flex flex-col justify-between'>
                <p className='text-sm text-gray-500' >
                  В ожидании
                </p>
                <p className='text-black text-2xl font-bold' >
                  {projects.filter(p => p.status === 'on_hold').length}

                </p>
              </div>

            </div>

          </section>


          <section>
            <div className='flex items-center justify-between mb-6' >

              <h2 className='text-2xl font-semibold mb-4'>Ваши проекты</h2>
            </div>
            <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'>
              {projects.map(project => (
                <>
                  <Link className='h-full' key={project.id} to={`/projects/${project.id}`}>
                    <div className=' h-full rounded-lg border-0.5  bg-white border-[0.25px] border-gray-300 hover:shadow-lg transition-all duration-200 p-6 flex flex-col' >
                      <div className='flex justify-between' >

                        <div className="flex-1 space-y-1">
                          <div>
                            <h3 className="text-xl font-semibold">
                              {project.name}
                            </h3>

                            <p className=" text-gray-600 ">
                              {project.description}
                            </p>
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
                          project?.stages?.find(
                            s => s.status === "in_progress"
                          )?.id
                        }
                        compact
                      />

                    </div>
                  </Link>
                </>
              ))}
            </div>


          </section>
        </main>
      </div>

    </>
  )
}