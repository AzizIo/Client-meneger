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

const EASE = 'cubic-bezier(0.16, 1, 0.3, 1)'

export default function LoginPage() {
	const { showToast } = useToast()
	const { refetchMe } = useAuth()
	const [email, setEmail] = useState('')
	const [password, setPassword] = useState('')
	const [isSubmitting, setIsSubmitting] = useState(false)
	const navigate = useNavigate()

	async function handleSubmit(e: any) {
		e.preventDefault()

		setIsSubmitting(true)
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
			setIsSubmitting(false)
		}
	}

	const inputClass = 'w-full px-3.5 py-2.5 text-sm rounded-md outline-none'
	const inputStyle = {
		border: `1px solid ${colors.line}`,
		color: colors.ink,
		transition: `border-color 200ms ${EASE}, box-shadow 200ms ${EASE}`,
	}
	const labelClass = 'block text-sm mb-1.5'

	const fadeUp = (delayMs: number) => ({
		animation: `fadeUp 420ms ${EASE} both`,
		animationDelay: `${delayMs}ms`,
	})

	return (
		<div className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: colors.paper }}>
			<style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .lp-input:focus {
          border-color: ${colors.stampBlue} !important;
          box-shadow: 0 0 0 3px ${colors.stampBlue}1a;
        }
        .lp-submit {
          transition: transform 150ms ${EASE}, opacity 150ms ${EASE};
        }
        .lp-submit:hover { transform: translateY(-1px); }
        .lp-submit:active { transform: translateY(0) scale(0.98); }
        .lp-link { transition: opacity 150ms ${EASE}; }
        .lp-link:hover { opacity: 0.6; }
      `}</style>

			<div
				className="w-full max-w-md bg-white rounded-lg p-8"
				style={{ border: `1px solid ${colors.line}`, ...fadeUp(0) }}
			>
				<div style={fadeUp(40)}>
					<Eyebrow>Approval Portal</Eyebrow>
					<h1 className="text-xl font-semibold mt-1 mb-1.5" style={{ color: colors.ink, fontFamily: fontDisplay }}>
						Вход
					</h1>
					<p className="text-sm mb-6" style={{ color: colors.muted }}>
						Войдите в свой аккаунт
					</p>
				</div>

				<form onSubmit={handleSubmit} className="space-y-4">
					<div style={fadeUp(100)}>
						<label className={labelClass} style={{ color: colors.muted }}>Email</label>
						<input
							onChange={(e) => setEmail(e.target.value)}
							type="email"
							placeholder="Введите email"
							className={`${inputClass} lp-input`}
							style={inputStyle}
						/>
					</div>

					<div style={fadeUp(140)}>
						<label className={labelClass} style={{ color: colors.muted }}>Пароль</label>
						<input
							onChange={(e) => setPassword(e.target.value)}
							type="password"
							placeholder="Введите пароль"
							className={`${inputClass} lp-input`}
							style={inputStyle}
						/>
					</div>

					<div style={fadeUp(180)}>
						<button
							type="submit"
							disabled={isSubmitting}
							className={`w-full lp-submit ${btnPrimary}`}
							style={{ ...btnPrimaryStyle, opacity: isSubmitting ? 0.6 : 1 }}
						>
							{isSubmitting ? 'Входим...' : 'Войти'}
						</button>
					</div>
				</form>

				<p className="text-center text-sm mt-6" style={fadeUp(220)}>
					<span style={{ color: colors.muted }}>Нет аккаунта? </span>
					<Link to="/register" className="lp-link font-medium" style={{ color: colors.ink }}>
						Зарегистрироваться
					</Link>
				</p>
			</div>
		</div>
	)
}