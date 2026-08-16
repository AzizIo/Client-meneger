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

// Notion-style easing — тот самый мягкий "выезд" вместо линейной анимации
const EASE = 'cubic-bezier(0.16, 1, 0.3, 1)'

export default function RegisterPage() {
	const { showToast } = useToast()
	const { refetchMe } = useAuth()
	const [whois, setWhois] = useState<string | null>(null)
	const [email, setEmail] = useState('')
	const navigate = useNavigate()
	const [password, setPassword] = useState('')
	const [confirmPassword, setConfirmPassword] = useState('')
	const [name, setName] = useState('')
	const [isSubmitting, setIsSubmitting] = useState(false)

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

		setIsSubmitting(true)
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
			setIsSubmitting(false)
		}
	}

	const inputClass =
		'w-full px-3.5 py-2.5 text-sm rounded-md outline-none'
	const inputStyle = {
		border: `1px solid ${colors.line}`,
		color: colors.ink,
		transition: `border-color 200ms ${EASE}, box-shadow 200ms ${EASE}`,
	}
	const labelClass = 'block text-sm mb-1.5'

	// Каскадная задержка полей — каждое следующее появляется чуть позже
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
        .rp-input:focus {
          border-color: ${colors.stampBlue} !important;
          box-shadow: 0 0 0 3px ${colors.stampBlue}1a;
        }
        .rp-submit {
          transition: transform 150ms ${EASE}, opacity 150ms ${EASE};
        }
        .rp-submit:hover { transform: translateY(-1px); }
        .rp-submit:active { transform: translateY(0) scale(0.98); }
        .rp-link { transition: opacity 150ms ${EASE}; }
        .rp-link:hover { opacity: 0.6; }
      `}</style>

			<div
				className="w-full max-w-md bg-white rounded-lg p-8"
				style={{ border: `1px solid ${colors.line}`, ...fadeUp(0) }}
			>
				<div style={fadeUp(40)}>
					<Eyebrow>Approval Portal</Eyebrow>
					<h1 className="text-xl font-semibold mt-1 mb-1.5" style={{ color: colors.ink, fontFamily: fontDisplay }}>
						Регистрация
					</h1>
					<p className="text-sm mb-6" style={{ color: colors.muted }}>
						Создайте новый аккаунт
					</p>
				</div>

				{/* Сегментированный переключатель со скользящим индикатором — как view-switcher в Notion */}
				<div
					className="relative grid grid-cols-2 gap-0 mb-6 rounded-md p-1"
					style={{ backgroundColor: colors.paper, border: `1px solid ${colors.line}`, ...fadeUp(80) }}
				>
					<div
						className="absolute top-1 bottom-1 rounded"
						style={{
							width: 'calc(50% - 4px)',
							backgroundColor: colors.ink,
							left: whois === 'worker' ? 'calc(50% + 2px)' : '4px',
							transition: `left 320ms ${EASE}`,
						}}
					/>
					<button
						type="button"
						onClick={() => setWhois('client')}
						className="relative z-10 px-4 py-2 rounded-md text-sm font-medium"
						style={{
							color: whois === 'client' ? 'white' : colors.muted,
							transition: `color 250ms ${EASE}`,
						}}
					>
						Я клиент
					</button>
					<button
						type="button"
						onClick={() => setWhois('worker')}
						className="relative z-10 px-4 py-2 rounded-md text-sm font-medium"
						style={{
							color: whois === 'worker' ? 'white' : colors.muted,
							transition: `color 250ms ${EASE}`,
						}}
					>
						Я работник
					</button>
				</div>

				<form onSubmit={handleSubmit} className="space-y-4">
					<div style={fadeUp(120)}>
						<label className={labelClass} style={{ color: colors.muted }}>Имя</label>
						<input
							onChange={(e) => setName(e.target.value)}
							type="text"
							placeholder="Введите имя"
							className={`${inputClass} rp-input`}
							style={inputStyle}
						/>
					</div>

					<div style={fadeUp(160)}>
						<label className={labelClass} style={{ color: colors.muted }}>Email</label>
						<input
							onChange={(e) => setEmail(e.target.value)}
							type="email"
							placeholder="Введите email"
							className={`${inputClass} rp-input`}
							style={inputStyle}
						/>
					</div>

					<div style={fadeUp(200)}>
						<label className={labelClass} style={{ color: colors.muted }}>Пароль</label>
						<input
							onChange={(e) => setPassword(e.target.value)}
							type="password"
							placeholder="Введите пароль"
							className={`${inputClass} rp-input`}
							style={inputStyle}
						/>
					</div>

					<div style={fadeUp(240)}>
						<label className={labelClass} style={{ color: colors.muted }}>Подтверждение пароля</label>
						<input
							onChange={(e) => setConfirmPassword(e.target.value)}
							type="password"
							placeholder="Повторите пароль"
							className={`${inputClass} rp-input`}
							style={inputStyle}
						/>
					</div>

					<div style={fadeUp(280)}>
						<button
							type="submit"
							disabled={isSubmitting}
							className={`w-full rp-submit ${btnPrimary}`}
							style={{ ...btnPrimaryStyle, opacity: isSubmitting ? 0.6 : 1 }}
						>
							{isSubmitting ? 'Создаём аккаунт...' : 'Зарегистрироваться'}
						</button>
					</div>
				</form>

				<p className="text-center text-sm mt-6" style={fadeUp(320)}>
					<span style={{ color: colors.muted }}>Уже есть аккаунт? </span>
					<Link to="/login" className="rp-link font-medium" style={{ color: colors.ink }}>
						Войти
					</Link>
				</p>
			</div>
		</div>
	)
}