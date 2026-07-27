import API from "../API/api"
import { useState, useEffect } from "react"
import Header from "../Components/Header"
import axios from "axios"
import { useNavigate } from "react-router-dom"
import { X, Camera } from "lucide-react"

interface User {
  id: string;
  full_name: string;
  email: string;
  avatar_url: string | undefined;
  role: string;
  create_at: string;
}

export default function ProfileCard() {
  const [me, setMe] = useState<User | null>(null)
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [avatarClick, setAvatarClick] = useState(false)
  const [avatarUrl, setAvatarUrl] = useState<string>("")
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

  const stats = [
    { value: 12, label: "Projects" },
    { value: 47, label: "Approvals sent" },
    { value: 8, label: "Clients" },
  ]

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
    }
    catch {
      alert("Ошибка")
    }
  }

  const btnPrimary =
    'inline-flex items-center justify-center rounded-md bg-gray-900 text-white hover:bg-gray-700 px-4 py-2.5 text-sm font-medium transition-colors';
  const btnOutline =
    'inline-flex items-center justify-center rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50 px-4 py-2.5 text-sm font-medium transition-colors';
  const btnDanger =
    'inline-flex items-center justify-center rounded-md border border-gray-300 text-gray-700 hover:border-red-300 hover:text-red-600 hover:bg-red-50 px-4 py-2.5 text-sm font-medium transition-colors';

  return (
    <>
      <Header />
      <div className="flex justify-center flex-col items-center min-h-screen bg-gray-50 py-10">
        <div className="w-full max-w-md rounded-lg border border-gray-200 bg-white overflow-hidden">
          {/* Banner */}
          <div className="relative h-24 bg-gray-100 border-b border-gray-200">
            {/* Avatar, overlapping banner and body */}
            <button
              onClick={() => setAvatarClick(true)}
              className="absolute -bottom-10 left-6 group"
            >
              {me?.avatar_url ? (
                <img
                  className="h-20 w-20 rounded-full object-cover ring-4 ring-white bg-gray-100"
                  src={me.avatar_url}
                  alt=""
                />
              ) : (
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gray-900 ring-4 ring-white">
                  <span className="text-xl font-semibold text-white">
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
                className="bg-white p-6 rounded-lg w-full max-w-md border border-gray-200"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-base font-semibold text-gray-900">Аватарка</h2>
                  <button
                    onClick={() => setAvatarClick(false)}
                    className="inline-flex items-center justify-center h-8 w-8 rounded-md text-gray-400 hover:text-gray-900 hover:bg-gray-50 transition-colors"
                  >
                    <X size={16} />
                  </button>
                </div>

                <form onSubmit={updateAvatar} className="flex flex-col gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="avatar-input" className="text-sm text-gray-500">
                      URL аватарки
                    </label>
                    <input
                      onChange={(e) => setAvatarUrl(e.target.value)}
                      id="avatar-input"
                      type="text"
                      placeholder="https://example.com/avatar.jpg"
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none transition focus:border-gray-900"
                    />
                  </div>

                  <button type="submit" className={btnPrimary}>
                    Сохранить
                  </button>
                </form>

                <button onClick={() => deleteUrl()} className={`${btnDanger} w-full mt-3`}>
                  Удалить аватарку
                </button>
              </div>
            </div>
          )}

          {/* Body */}
          <div className="px-6 pb-6 pt-14">
            {/* Role badge */}
            <div className="flex justify-end -mt-10 mb-2">
              <span className="rounded-md border border-gray-200 bg-white px-2.5 py-1 text-xs font-medium text-gray-600 capitalize">
                {me?.role}
              </span>
            </div>

            {/* Name & contact */}
            <h2 className="text-xl font-semibold text-gray-900">{me?.full_name}</h2>
            <p className="mt-1 text-gray-500 text-sm">{me?.email}</p>
            <p className="mt-1 text-xs text-gray-400">
              Member since {me?.create_at}
            </p>

            {/* Divider */}
            <hr className="my-5 border-gray-100" />

            {/* Stats */}
            <div className="grid grid-cols-3 gap-4">
              {stats.map((stat, i) => (
                <div key={i}>
                  <div className="text-xl font-semibold text-gray-900">{stat.value}</div>
                  <div className="mt-1 text-xs text-gray-400">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>

          <form onSubmit={handleSave} className="w-full border-t border-gray-100 p-6">
            <h2 className="text-sm font-semibold text-gray-900">Personal Information</h2>

            {/* Name */}
            <div className="mt-5 flex flex-col gap-1.5">
              <label htmlFor="name" className="text-sm text-gray-500">
                Name
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="rounded-md border border-gray-300 px-3 py-2.5 text-sm text-gray-900 outline-none transition focus:border-gray-900"
              />
            </div>

            {/* Email */}
            <div className="mt-5 flex flex-col gap-1.5">
              <label htmlFor="email" className="text-sm text-gray-500">
                Email address
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="rounded-md border border-gray-300 px-3 py-2.5 text-sm text-gray-900 outline-none transition focus:border-gray-900"
              />
            </div>

            {/* Footer */}
            <div className="mt-8 flex gap-3 justify-end border-t border-gray-100 pt-6">
              <button
                type="button"
                onClick={() => logout()}
                className={btnDanger}
              >
                Выйти из аккаунта
              </button>
              <button type="submit" className={btnPrimary}>
                Save changes
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}