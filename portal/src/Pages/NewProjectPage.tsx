import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import API from '../API/api'
import Header from '../Components/Header'

export default function NewProjectPage() {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [client_email, setClientEmail] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const navigate = useNavigate()

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()

    if (!name.trim()) {
      alert('Введите название проекта')
      return
    }

    try {
      setIsSaving(true)
      const res = await API.post('/projects', {
        name,
        description,
        client_email,
      })
      navigate(`/projects/${res.data.id}`)
    } catch (err: any) {
      console.error(err.response?.data || err)

      // НОВОЕ: раньше сравнивалось err == 'Error: ...' — err это
      // объект ошибки axios, а не строка, поэтому такое сравнение
      // никогда не срабатывало и всегда падало в else. Правильно —
      // смотреть на err.response?.status.
      if (err.response?.status === 400) {
        alert('Ошибка: Некорректные данные. Пожалуйста, проверьте введённые данные.')
      } else if (err.response?.status === 404) {
        alert('Ошибка: Клиент не найден.')
      } else {
        alert('Ошибка при создании проекта')
      }
    } finally {
      setIsSaving(false)
    }
  }

  const inputClass =
    'w-full px-3.5 py-2.5 text-sm border border-gray-300 rounded-md outline-none transition focus:border-gray-900'
  const labelClass = 'block text-sm text-gray-500 mb-1.5'

  return (
    <>
      <Header />
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-md bg-white rounded-lg border border-gray-200 p-8">
          <h1 className="text-xl font-semibold text-center text-gray-900 mb-6">
            Создание нового проекта
          </h1>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className={labelClass}>Название проекта</label>
              <input
                onChange={(e) => setName(e.target.value)}
                type="text"
                placeholder="Введите название проекта"
                className={inputClass}
              />
            </div>

            <div>
              <label className={labelClass}>Описание проекта</label>
              <input
                onChange={(e) => setDescription(e.target.value)}
                type="text"
                placeholder="Введите описание проекта"
                className={inputClass}
              />
            </div>

            <div>
              <label className={labelClass}>Email клиента</label>
              <input
                onChange={(e) => setClientEmail(e.target.value)}
                type="email"
                placeholder="Введите email клиента"
                className={inputClass}
              />
            </div>

            <button
              type="submit"
              disabled={isSaving}
              className="w-full bg-gray-900 text-white text-sm font-medium py-2.5 rounded-md hover:bg-gray-700 transition-colors disabled:opacity-50"
            >
              {isSaving ? 'Создание...' : 'Создать проект'}
            </button>
          </form>
        </div>
      </div>
    </>
  )
}