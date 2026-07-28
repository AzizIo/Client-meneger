import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import API from '../API/api'
import { useToast } from '../Context/ToastContext'

export default function RegisterPage() {
	const { showToast } = useToast()
	const [whois, setWhois] = useState<string | null>(null)
	const [email, setEmail] = useState('')
	const navigate = useNavigate()
	const [password, setPassword] = useState('')
	const [confirmPassword, setConfirmPassword] = useState('')
	const [name, setName] = useState('')

	async function handleSubmit(e: any) {
		e.preventDefault()
		if (!whois) {
			showToast('Выберите роль')
			return
		}
		if (password !== confirmPassword) {
			showToast('Пароли не совпадают')
			return
		}
		if (!name) {
			showToast('Введите имя')
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
				navigate('/main')
			} catch (err: any) {
				console.error(err.response?.data || err)
				showToast('Ошибка регистрации')
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
				navigate('/main')
			} catch (err: any) {
				console.error(err.response?.data || err)
				showToast('Ошибка регистрации')
			}
		}
	}

	const inputClass =
		'w-full px-3.5 py-2.5 text-sm border border-gray-300 rounded-md outline-none transition focus:border-gray-900'
	const labelClass = 'block text-sm text-gray-500 mb-1.5'

	return (
		<div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
			<div className="w-full max-w-md bg-white rounded-lg border border-gray-200 p-8">
				<h1 className="text-xl font-semibold text-center text-gray-900 mb-1.5">
					Регистрация
				</h1>

				<p className="text-gray-500 text-sm text-center mb-6">
					Создайте новый аккаунт
				</p>

				<div className="grid grid-cols-2 gap-2 mb-6">
					<button
						type="button"
						onClick={() => setWhois('client')}
						className={`px-4 py-2.5 rounded-md text-sm font-medium transition-colors border ${whois === 'client'
							? 'bg-gray-900 text-white border-gray-900'
							: 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
							}`}
					>
						Я клиент
					</button>
					<button
						type="button"
						onClick={() => setWhois('worker')}
						className={`px-4 py-2.5 rounded-md text-sm font-medium transition-colors border ${whois === 'worker'
							? 'bg-gray-900 text-white border-gray-900'
							: 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
							}`}
					>
						Я работник
					</button>
				</div>

				<form onSubmit={handleSubmit} className="space-y-4">
					<div>
						<label className={labelClass}>Имя</label>
						<input
							onChange={(e) => setName(e.target.value)}
							type="text"
							placeholder="Введите имя"
							className={inputClass}
						/>
					</div>

					<div>
						<label className={labelClass}>Email</label>
						<input
							onChange={(e) => setEmail(e.target.value)}
							type="email"
							placeholder="Введите email"
							className={inputClass}
						/>
					</div>

					<div>
						<label className={labelClass}>Пароль</label>
						<input
							onChange={(e) => setPassword(e.target.value)}
							type="password"
							placeholder="Введите пароль"
							className={inputClass}
						/>
					</div>

					<div>
						<label className={labelClass}>Подтверждение пароля</label>
						<input
							onChange={(e) => setConfirmPassword(e.target.value)}
							type="password"
							placeholder="Повторите пароль"
							className={inputClass}
						/>
					</div>

					<button
						type="submit"
						className="w-full bg-gray-900 text-white text-sm font-medium py-2.5 rounded-md hover:bg-gray-700 transition-colors"
					>
						Зарегистрироваться
					</button>
				</form>

				<p className="text-center text-sm text-gray-500 mt-6">
					Уже есть аккаунт?{' '}
					<Link to="/login" className="text-gray-900 font-medium hover:underline">
						Войти
					</Link>
				</p>
			</div>
		</div>
	)
}