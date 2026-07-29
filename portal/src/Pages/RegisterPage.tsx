import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import API from '../API/api'
import { useToast } from '../Context/ToastContext'
import { useAuth } from '../Context/AuthContext'
import {
	colors,
	fontDisplay,
	Eyebrow,
	btnPrimary,
	btnPrimaryStyle,
} from '../Components/ui/designSystem'

export default function RegisterPage() {
	const { showToast } = useToast()
	const { refetchMe } = useAuth()
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

		const role = whois === 'worker' ? 'executor' : 'client';

		try {
			let res = await API.post('/auth/register', {
				full_name: name,
				role,
				email,
				password,
			})
			localStorage.setItem('token', res.data.access_token)
			await refetchMe()
			navigate('/main')
		} catch (err: any) {
			console.error(err.response?.data || err)
			showToast('Ошибка регистрации')
		}
	}

	const inputClass = 'w-full px-3.5 py-2.5 text-sm rounded-md outline-none transition'
	const inputStyle = { border: `1px solid ${colors.line}`, color: colors.ink }
	const labelClass = 'block text-sm mb-1.5'

	return (
		<div className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: colors.paper }}>
			<div className="w-full max-w-md bg-white rounded-lg p-8" style={{ border: `1px solid ${colors.line}` }}>
				<Eyebrow>Approval Portal</Eyebrow>
				<h1 className="text-xl font-semibold mt-1 mb-1.5" style={{ color: colors.ink, fontFamily: fontDisplay }}>
					Регистрация
				</h1>

				<p className="text-sm mb-6" style={{ color: colors.muted }}>
					Создайте новый аккаунт
				</p>

				<div className="grid grid-cols-2 gap-2 mb-6">
					<button
						type="button"
						onClick={() => setWhois('client')}
						className="px-4 py-2.5 rounded-md text-sm font-medium transition-colors"
						style={
							whois === 'client'
								? { backgroundColor: colors.ink, color: 'white', border: `1px solid ${colors.ink}` }
								: { backgroundColor: 'white', color: colors.muted, border: `1px solid ${colors.line}` }
						}
					>
						Я клиент
					</button>
					<button
						type="button"
						onClick={() => setWhois('worker')}
						className="px-4 py-2.5 rounded-md text-sm font-medium transition-colors"
						style={
							whois === 'worker'
								? { backgroundColor: colors.ink, color: 'white', border: `1px solid ${colors.ink}` }
								: { backgroundColor: 'white', color: colors.muted, border: `1px solid ${colors.line}` }
						}
					>
						Я работник
					</button>
				</div>

				<form onSubmit={handleSubmit} className="space-y-4">
					<div>
						<label className={labelClass} style={{ color: colors.muted }}>Имя</label>
						<input
							onChange={(e) => setName(e.target.value)}
							type="text"
							placeholder="Введите имя"
							className={inputClass}
							style={inputStyle}
						/>
					</div>

					<div>
						<label className={labelClass} style={{ color: colors.muted }}>Email</label>
						<input
							onChange={(e) => setEmail(e.target.value)}
							type="email"
							placeholder="Введите email"
							className={inputClass}
							style={inputStyle}
						/>
					</div>

					<div>
						<label className={labelClass} style={{ color: colors.muted }}>Пароль</label>
						<input
							onChange={(e) => setPassword(e.target.value)}
							type="password"
							placeholder="Введите пароль"
							className={inputClass}
							style={inputStyle}
						/>
					</div>

					<div>
						<label className={labelClass} style={{ color: colors.muted }}>Подтверждение пароля</label>
						<input
							onChange={(e) => setConfirmPassword(e.target.value)}
							type="password"
							placeholder="Повторите пароль"
							className={inputClass}
							style={inputStyle}
						/>
					</div>

					<button
						type="submit"
						className={`w-full ${btnPrimary}`}
						style={btnPrimaryStyle}
					>
						Зарегистрироваться
					</button>
				</form>

				<p className="text-center text-sm mt-6" style={{ color: colors.muted }}>
					Уже есть аккаунт?{' '}
					<Link to="/login" className="font-medium hover:underline" style={{ color: colors.ink }}>
						Войти
					</Link>
				</p>
			</div>
		</div>
	)
}