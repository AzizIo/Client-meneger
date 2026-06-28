import API from '../API/api'
import Header from '../Components/Header'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'


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
      <div className='' >
        <Header />
        <div className='container mx-auto py-8'>
          <h1 className='text-3xl font-bold mb-4'>Добро пожаловать, {me ? me.full_name : '...'}</h1>
          <p className='text-gray-700 text-lg'>Это главная страница вашего портала. Здесь вы можете управлять своими проектами, задачами и общаться с командой.</p>
        </div>

        <div className='container mx-auto py-8'>
          <h1>Статистика проектов</h1>
          <div className='flex gap-4 mt-4'>
            <div className='bg-amber-50 p-4 flex flex-col gap-4  rounded-lg shadow-md text-gray-700 text-sm'>
              <p>
                Общее количество проектов
              </p>flex flex-col gap-4
              <p className='text-black text-2xl font-bold'>

                {projects.length}
              </p>
            </div>
            <div className='bg-amber-50 p-4 flex flex-col gap-4 rounded-lg shadow-md text-gray-700'>
              <p >
                Активные проекты
              </p>
              <p className='text-black text-2xl font-bold' >

                {projects.filter(p => p.status === 'active').length}
              </p>
            </div>
            <div className='bg-amber-50 p-4 rounded-lg flex flex-col gap-4  shadow-md text-gray-700'>
              <p>
                Завершенные проекты
              </p>
              <p className='text-black text-2xl font-bold' >

                {projects.filter(p => p.status === 'completed').length}
              </p>
            </div>
            <div className='bg-amber-50 p-4 rounded-lg flex flex-col gap-4  shadow-md text-gray-700'>
              <p>
                В ожидании
              </p>
              <p className='text-black text-2xl font-bold' >
                {projects.filter(p => p.status === 'on_hold').length}

              </p>
            </div>

          </div>

        </div>
        <div>
          <div className='container mx-auto py-8'>
            <h2 className='text-2xl font-semibold mb-4'>Ваши проекты</h2>
            <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'>
              {projects.map(project => (
                <Link key={project.id} to={`/projects/${project.id}`}>
                  <div key={project.id} className='bg-white p-4 rounded-lg shadow-md'>
                    <h3 className='text-xl font-semibold mb-2'>{project.name}</h3>
                    <p className='text-gray-600'>{project.description}</p>
                    <p>{project.status}</p>
                  </div>
                </Link>
              ))}
            </div>


          </div>
        </div>
      </div>

    </>
  )
}