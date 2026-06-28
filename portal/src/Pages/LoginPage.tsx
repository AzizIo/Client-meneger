
import { useState, } from "react"
import { useNavigate } from 'react-router-dom'
import API from "../API/api"
export default function LoginPage() {
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
			alert('Неверный логин или пароль')
		}
	}
	return (
		<>
			<div className="min-h-screen flex items-center justify-center bg-gray-100 px-4">
				<div className="w-full max-w-md bg-white rounded-2xl shadow-lg p-8">
					<h1 className="text-3xl font-bold text-center mb-2">
						Вход
					</h1>
					<p className="text-gray-500 text-center mb-6">
						Войдите в свой аккаунт
					</p>
					<form onSubmit={handleSubmit} className="space-y-4">
						<div>
							<label className="block text-sm font-medium mb-1">
								Email
							</label>
							<input
								onChange={(e) => setEmail(e.target.value)}
								type="email"
								placeholder="Введите email"
								className="w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
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
								className="w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
							/>
						</div>

						<button
							type="submit"
							className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition"
						>
							Войти
						</button>
					</form>

					<p className="text-center text-sm text-gray-500 mt-6">
						Нет аккаунта?{" "}
						<a href="/register" className="text-blue-600 hover:underline">
							Зарегистрироваться
						</a>
					</p>
				</div>
			</div>
		</>
	)
}