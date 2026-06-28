import { useState } from 'react'

import API from '../API/api'
import Header from '../Components/Header'


export default function NewProjectPage() {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [client_email, setClientEmail] = useState('')

  async function handleSubmit(e: any) {
    e.preventDefault()
    try {
      await API.post('/projects', {
        name: name,
        description: description,
        client_email: client_email
      })
    }
    catch (err: any) {
      console.error(err.response?.data || err)
      if (err == 'Error: Request failed with status code 400') {
        alert('Ошибка: Некорректные данные. Пожалуйста, проверьте введённые данные.')
      }
      else if (err == 'Error: Request failed with status code 404') {
        alert('Ошибка: Клиент не найден.')
      }
      else {
        alert('Ошибка при создании проекта')
      }
    }


  }

  return (

    <>
      <Header />
      <div className="min-h-screen flex items-center justify-center bg-gray-100 px-4">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-lg p-8">
          <h1 className="text-3xl font-bold text-center mb-2">
            Создание нового проекта
          </h1>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">
                Название проекта
              </label>
              <input
                onChange={(e) => setName(e.target.value)}
                type="text"
                placeholder="Введите название проекта"
                className="w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Описание проекта
              </label>
              <input
                onChange={(e) => setDescription(e.target.value)}
                type="text"
                placeholder="Введите описание проекта"
                className="w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">
                Введите email клиента
              </label>
              <input
                onChange={(e) => setClientEmail(e.target.value)}
                type="email"
                placeholder="Введите email клиента"
                className="w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <button
              type="submit"
              className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition"
            >
              Создать проект
            </button>
          </form>


        </div>
      </div>


    </>
  )
}