import API from "../API/api"
import { useState, useEffect } from "react"
import Header from "../Components/Header"
import axios from "axios"
import { useNavigate } from "react-router-dom"
import { X, Camera } from "lucide-react"
import { useToast } from '../Context/ToastContext'
import {
  colors,
  fontDisplay,
  fontMono,
  Eyebrow,
  btnPrimary,
  btnPrimaryStyle,
  btnOutline,
  btnOutlineStyle,
} from '../Components/ui/designSystem'

interface User {
  id: string;
  full_name: string;
  email: string;
  avatar_url: string | undefined;
  role: string;
  create_at: string;
}

interface Stats {
  projects: number;
  pendingApprovals: number;
  clients: number;
}

export default function ProfileCard() {
  const { showToast } = useToast()
  const [me, setMe] = useState<User | null>(null)
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [avatarClick, setAvatarClick] = useState(false)
  const [avatarUrl, setAvatarUrl] = useState<string>("")
  const [stats, setStats] = useState<Stats>({ projects: 0, pendingApprovals: 0, clients: 0 })
  const navigete = useNavigate()

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await API.get('/auth/me')
        setMe(res.data)
        setName(res.data.full_name)
        setEmail(res.data.email)
      } catch (error) {
        console.error('Error fetching profile:', error)
      }
    }

    fetchProfile()
  }, [])

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [projectsRes, pendingRes] = await Promise.all([
          API.get('/projects'),
          API.get('/dashboard/pending-approvals'),
        ])

        const projects = projectsRes.data ?? [];

        const clientIds = new Set(
          projects.map((p: any) => p.client_id).filter(Boolean)
        );

        setStats({
          projects: projects.length,
          pendingApprovals: pendingRes.data?.length ?? 0,
          clients: clientIds.size,
        })
      } catch (error) {
        console.error('Error fetching stats:', error)
      }
    }

    fetchStats()
  }, [])

  async function updateAvatar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    try {
      await API.put('/auth/me/avatar', {
        avatar_url: avatarUrl
      })
      setMe(prev =>
        prev
          ? {
            ...prev,
            avatar_url: avatarUrl,
          }
          : prev
      );
      setAvatarClick(false)
    }
    catch (err) {
      if (axios.isAxiosError(err)) {
        console.log(err.response?.data);
      } else {
        console.log(err);
      }
    }
  }

  async function deleteUrl() {
    await API.delete('/auth/me/avatar')
    window.location.reload()
  }

  async function logout() {
    localStorage.removeItem('token')
    navigete("/login")
  }

  async function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    try {
      const res = await API.patch('/auth/me', {
        full_name: name,
        email,
      })
      if (!me) return;

      setMe({
        ...me,
        full_name: res.data.full_name,
        email: res.data.email,
      });
      showToast('Изменения сохранены', 'success')
    }
    catch {
      showToast("Ошибка")
    }
  }

  const statItems = [
    { value: stats.projects, label: "Проекты" },
    { value: stats.pendingApprovals, label: "На согласовании" },
    { value: stats.clients, label: "Клиенты" },
  ]

  const inputClass = "w-full rounded-md px-3 py-2.5 text-sm outline-none transition";
  const inputStyle = { border: `1px solid ${colors.line}`, color: colors.ink };

  return (
    <>
      <Header />
      <div className="flex justify-center flex-col items-center min-h-screen py-10" style={{ backgroundColor: colors.paper }}>
        <div className="w-full max-w-md rounded-lg bg-white overflow-hidden" style={{ border: `1px solid ${colors.line}` }}>
          <div className="relative h-24" style={{ backgroundColor: colors.paper, borderBottom: `1px solid ${colors.line}` }}>
            <button
              onClick={() => setAvatarClick(true)}
              className="absolute -bottom-10 left-6 group"
            >
              {me?.avatar_url ? (
                <img
                  className="h-20 w-20 rounded-full object-cover ring-4 ring-white"
                  style={{ backgroundColor: colors.paper }}
                  src={me.avatar_url}
                  alt=""
                />
              ) : (
                <div className="flex h-20 w-20 items-center justify-center rounded-full ring-4 ring-white" style={{ backgroundColor: colors.ink }}>
                  <span className="text-xl font-semibold text-white" style={{ fontFamily: fontDisplay }}>
                    {me?.full_name?.[0]?.toUpperCase() ?? "?"}
                  </span>
                </div>
              )}
              <div className="absolute inset-0 rounded-full bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                <Camera size={16} className="text-white opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </button>
          </div>

          {avatarClick && (
            <div
              className="fixed inset-0 bg-black/40 flex items-center justify-center z-50"
              onClick={() => setAvatarClick(false)}
            >
              <div
                className="bg-white p-6 rounded-lg w-full max-w-md"
                style={{ border: `1px solid ${colors.line}` }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-base font-semibold" style={{ color: colors.ink, fontFamily: fontDisplay }}>
                    Аватарка
                  </h2>
                  <button
                    onClick={() => setAvatarClick(false)}
                    className="inline-flex items-center justify-center h-8 w-8 rounded-md transition-colors hover:bg-black/[0.04]"
                    style={{ color: colors.muted }}
                  >
                    <X size={16} />
                  </button>
                </div>

                <form onSubmit={updateAvatar} className="flex flex-col gap-4">
                  <div className="flex flex-col gap-1.5">
                    <Eyebrow>URL аватарки</Eyebrow>
                    <input
                      onChange={(e) => setAvatarUrl(e.target.value)}
                      id="avatar-input"
                      type="text"
                      placeholder="https://example.com/avatar.jpg"
                      className={inputClass}
                      style={inputStyle}
                    />
                  </div>

                  <button type="submit" className={btnPrimary} style={btnPrimaryStyle}>
                    Сохранить
                  </button>
                </form>

                <button
                  onClick={() => deleteUrl()}
                  className={`${btnOutline} w-full mt-3`}
                  style={{ ...btnOutlineStyle, borderColor: colors.stampRed, color: colors.stampRed }}
                >
                  Удалить аватарку
                </button>
              </div>
            </div>
          )}

          <div className="px-6 pb-6 pt-14">
            <div className="flex justify-end -mt-10 mb-2">
              <span
                className="rounded-md bg-white px-2.5 py-1 text-xs font-medium capitalize"
                style={{ border: `1px solid ${colors.line}`, color: colors.muted, fontFamily: fontMono }}
              >
                {me?.role}
              </span>
            </div>

            <h2 className="text-xl font-semibold" style={{ color: colors.ink, fontFamily: fontDisplay }}>{me?.full_name}</h2>
            <p className="mt-1 text-sm" style={{ color: colors.muted }}>{me?.email}</p>
            <p className="mt-1 text-xs" style={{ color: colors.muted, fontFamily: fontMono }}>
              Участник с {me?.create_at}
            </p>

            <hr className="my-5" style={{ borderColor: colors.line }} />

            <div className="grid grid-cols-3 gap-4">
              {statItems.map((stat, i) => (
                <div key={i}>
                  <div className="text-xl font-semibold" style={{ color: colors.ink, fontFamily: fontDisplay }}>{stat.value}</div>
                  <div className="mt-1 text-xs" style={{ color: colors.muted }}>{stat.label}</div>
                </div>
              ))}
            </div>
          </div>

          <form onSubmit={handleSave} className="w-full p-6" style={{ borderTop: `1px solid ${colors.line}` }}>
            <Eyebrow>Личные данные</Eyebrow>

            <div className="mt-4 flex flex-col gap-1.5">
              <label htmlFor="name" className="text-sm" style={{ color: colors.muted }}>
                Имя
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={inputClass}
                style={inputStyle}
              />
            </div>

            <div className="mt-5 flex flex-col gap-1.5">
              <label htmlFor="email" className="text-sm" style={{ color: colors.muted }}>
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputClass}
                style={inputStyle}
              />
            </div>

            <div className="mt-8 flex gap-3 justify-end pt-6" style={{ borderTop: `1px solid ${colors.line}` }}>
              <button
                type="button"
                onClick={() => logout()}
                className={btnOutline}
                style={{ ...btnOutlineStyle, borderColor: colors.stampRed, color: colors.stampRed }}
              >
                Выйти из аккаунта
              </button>
              <button type="submit" className={btnPrimary} style={btnPrimaryStyle}>
                Сохранить изменения
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}