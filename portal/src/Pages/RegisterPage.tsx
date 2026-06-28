import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import API from '../API/api'

export default function RegisterPage() {
	const [whois, setWhois] = useState<string | null>(null)
	const [email, setEmail] = useState('')
	const navigate = useNavigate()
	const [password, setPassword] = useState('')
	const [confirmPassword, setConfirmPassword] = useState('')
	const [name, setName] = useState('')

	async function handleSubmit(e: any) {
		e.preventDefault()
		if (!whois) {
			alert('Выберите роль')
			return
		}
		if (password !== confirmPassword) {
			alert('Пароли не совпадают')
			return
		}
		if (!name) {
			alert('Введите имя')
			return
		}

		if (whois === 'worker') {
			try {

				let res = await API.post('/auth/register', {
					full_name: name,
					role: 'executor',
					email,
					password,

				})
				localStorage.setItem('token', res.data.access_token)
				alert('Успешная регистрация')
				navigate('/main')
			} catch (err: any) {
				console.error(err.response?.data || err)
				alert('Ошибка регистрации')
			}

		} else if (whois === 'client') {
			try {
				let res = await API.post('/auth/register', {
					email,
					password,
					full_name: name,
					role: 'client',

				})
				localStorage.setItem('token', res.data.access_token)
				alert('Успешная регистрация')
				navigate('/main')
			} catch (err: any) {
				console.error(err.response?.data || err)
				alert('Ошибка регистрации')
			}
		}

	}
	return (
		<div className="min-h-screen flex items-center justify-center bg-gray-100 px-4">
			<div className="w-full max-w-md bg-white rounded-2xl shadow-lg p-8">
				<h1 className="text-3xl font-bold text-center mb-2">
					Регистрация
				</h1>

				<p className="text-gray-500 text-center mb-6">
					Создайте новый аккаунт
				</p>
				<div className="flex justify-between mx-8 my-4">
					<button onClick={() => setWhois('client')} className={`px-4 py-2 rounded ${whois === 'client'
						? 'bg-blue-500 text-white'
						: 'bg-gray-200 text-black'
						}`}  >Я клиент</button>
					<button onClick={() => setWhois('worker')} className={`px-4 py-2 rounded ${whois === 'worker'
						? 'bg-blue-500 text-white'
						: 'bg-gray-200 text-black'
						}`}  >Я работник</button>
				</div>
				<form onSubmit={handleSubmit} className="space-y-4">
					<div>
						<label className="block text-sm font-medium mb-1">
							Имя
						</label>
						<input
							onChange={(e) => setName(e.target.value)}
							type="text"
							placeholder="Введите имя"
							className="w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
						/>
					</div>


					<div>
						<label className="block text-sm font-medium mb-1">
							Email
						</label>
						<input
							onChange={(e) => setEmail(e.target.value)}
							type="email"
							placeholder="Введите email"
							className="w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
						/>
					</div>

					<div>
						<label className="block text-sm font-medium mb-1">
							Пароль
						</label>
						<input
							onChange={(e) => setPassword(e.target.value)}
							type="password"
							placeholder="Введите пароль"
							className="w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
						/>
					</div>

					<div>
						<label className="block text-sm font-medium mb-1">
							Подтверждение пароля
						</label>
						<input
							onChange={(e) => setConfirmPassword(e.target.value)}
							type="password"
							placeholder="Повторите пароль"
							className="w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
						/>
					</div>

					<button
						type="submit"
						className="w-full bg-green-600 text-white py-3 rounded-lg hover:bg-green-700 transition"
					>
						Зарегистрироваться
					</button>
				</form>

				<p className="text-center text-sm text-gray-500 mt-6">
					Уже есть аккаунт?{' '}
					<Link
						to="/login"
						className="text-green-600 hover:underline"
					>
						Войти
					</Link>
				</p>
			</div>
		</div>
	)
}