import { Link } from 'react-router-dom'

export default function RegisterPage() {
	return (
		<div className="min-h-screen flex items-center justify-center bg-gray-100 px-4">
			<div className="w-full max-w-md bg-white rounded-2xl shadow-lg p-8">
				<h1 className="text-3xl font-bold text-center mb-2">
					Регистрация
				</h1>

				<p className="text-gray-500 text-center mb-6">
					Создайте новый аккаунт
				</p>

				<form className="space-y-4">
					<div>
						<label className="block text-sm font-medium mb-1">
							Имя
						</label>
						<input
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