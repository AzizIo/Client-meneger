import { useState } from "react"
import { useNavigate } from 'react-router-dom'
import { Link } from 'react-router-dom'
import API from "../API/api"
import { useToast } from '../Context/ToastContext'

export default function LoginPage() {
	const { showToast } = useToast()
	const [email, setEmail] = useState('')
	const [password, setPassword] = useState('')
	const navigate = useNavigate()

	async function handleSubmit(e: any) {
		e.preventDefault()

		try {
			let res = await API.post('/auth/login', {
				email,
				password,
			})

			localStorage.setItem('token', res.data.access_token)
			navigate('/main')
		} catch (err: any) {
			console.error(err.response?.data || err)
			showToast('Неверный логин или пароль')
		}
	}

	const inputClass =
		'w-full px-3.5 py-2.5 text-sm border border-gray-300 rounded-md outline-none transition focus:border-gray-900'
	const labelClass = 'block text-sm text-gray-500 mb-1.5'

	return (
		<div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
			<div className="w-full max-w-md bg-white rounded-lg border border-gray-200 p-8">
				<h1 className="text-xl font-semibold text-center text-gray-900 mb-1.5">
					Вход
				</h1>
				<p className="text-gray-500 text-sm text-center mb-6">
					Войдите в свой аккаунт
				</p>

				<form onSubmit={handleSubmit} className="space-y-4">
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

					<button
						type="submit"
						className="w-full bg-gray-900 text-white text-sm font-medium py-2.5 rounded-md hover:bg-gray-700 transition-colors"
					>
						Войти
					</button>
				</form>

				<p className="text-center text-sm text-gray-500 mt-6">
					Нет аккаунта?{" "}
					<Link to="/register" className="text-gray-900 font-medium hover:underline">
						Зарегистрироваться
					</Link>
				</p>
			</div>
		</div>
	)
}