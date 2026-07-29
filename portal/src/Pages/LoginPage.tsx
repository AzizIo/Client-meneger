import { useState } from "react"
import { useNavigate } from 'react-router-dom'
import { Link } from 'react-router-dom'
import API from "../API/api"
import { useToast } from '../Context/ToastContext'
import { useAuth } from '../Context/AuthContext'
import {
	colors,
	fontDisplay,
	Eyebrow,
	btnPrimary,
	btnPrimaryStyle,
} from '../Components/ui/designSystem'

export default function LoginPage() {
	const { showToast } = useToast()
	const { refetchMe } = useAuth()
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
			await refetchMe()
			navigate('/main')
		} catch (err: any) {
			console.error(err.response?.data || err)
			showToast('Неверный логин или пароль')
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
					Вход
				</h1>
				<p className="text-sm mb-6" style={{ color: colors.muted }}>
					Войдите в свой аккаунт
				</p>

				<form onSubmit={handleSubmit} className="space-y-4">
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

					<button
						type="submit"
						className={`w-full ${btnPrimary}`}
						style={btnPrimaryStyle}
					>
						Войти
					</button>
				</form>

				<p className="text-center text-sm mt-6" style={{ color: colors.muted }}>
					Нет аккаунта?{" "}
					<Link to="/register" className="font-medium hover:underline" style={{ color: colors.ink }}>
						Зарегистрироваться
					</Link>
				</p>
			</div>
		</div>
	)
}