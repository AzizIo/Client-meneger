import API from "../API/api"
import { useState, useEffect } from "react"
import Header from "../Components/Header"
import axios from "axios"
// interface ProfileStat {
//   value: string | number;
//   label: string;
// }

// interface ProfileCardProps {
//   initials?: string;
//   name?: string;
//   email?: string;
//   memberSince?: string;
//   organization?: string;
//   role?: string;
//   stats?: ProfileStat[];
// }

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
  async function updateAvatar() {
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



  const stats = [
    { value: 12, label: "Projects" },
    { value: 47, label: "Approvals sent" },
    { value: 8, label: "Clients" },
  ]
  async function handleSave() {
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
  return (
    <>
      <Header />
      <div className="flex justify-center flex-col items-center h-screen " >
        <div className="w-full max-w-md  rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
          {/* Banner */}

          <div className="relative h-28 bg-linear-to-b from-indigo-500 via-violet-500 to-violet-600">
            {/* Avatar, overlapping banner and body */}
            <div onClick={() => setAvatarClick(true)} className="absolute -bottom-10 left-6">

              {me?.avatar_url ? <div className="" >
                <img className="flex h-20 w-20  hover:bg-black/50 items-center justify-center rounded-full bg-indigo-100 ring-4 ring-white" src={me.avatar_url} alt="" />
              </div> : <div>
                <div className="flex   hover:bg-zinc-400 h-20 w-20 items-center justify-center rounded-full bg-indigo-100 ring-4 ring-white">

                  <img src={me?.avatar_url} alt="" />
                  <span className="text-xl font-bold text-indigo-700">{me?.full_name[0].toUpperCase()}</span>
                </div>

              </div>}

            </div>
          </div>
          {avatarClick && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center" onClick={() => setAvatarClick(false)} >
              <div onClick={() => setAvatarClick(false)} >X</div>
              <div className="bg-white p-6 rounded-xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
                <form onSubmit={updateAvatar} className="flex flex-col gap-4 max-w-md">
                  <div className="flex flex-col gap-2">
                    <label
                      htmlFor="avatar-input"
                      className="text-sm font-medium text-gray-700"
                    >
                      URL аватарки
                    </label>

                    <input
                      onChange={(e) => setAvatarUrl(e.target.value)}
                      id="avatar-input"
                      type="text"
                      placeholder="https://example.com/avatar.jpg"
                      className="w-full rounded-lg border border-gray-300 px-4 py-2 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                    />
                  </div>

                  <button
                    type="submit"
                    className="rounded-lg bg-blue-600 px-4 py-2 font-medium text-white transition hover:bg-blue-700 active:scale-95"
                  >
                    Сохранить
                  </button>
                </form>
                <button
                  onClick={() => setAvatarClick(false)}
                  className="mt-4 bg-red-500 text-white px-4 py-2 rounded"
                >
                  Закрыть
                </button>
                <button
                  onClick={() => deleteUrl()}
                  className="mt-4 ml-4 bg-red-500 text-white px-4 py-2 rounded"
                >
                  Удалить аватарку
                </button>
              </div>

            </div>
          )}



          {/* Body */}
          <div className="px-6 pb-6 pt-14">
            {/* Role badge */}
            <div className="flex justify-end -mt-10 mb-2">
              <span className="rounded-full bg-indigo-50 px-3 py-1 text-sm font-medium text-indigo-700">
                {me?.role}
              </span>
            </div>

            {/* Name & contact */}
            <h2 className="text-xl font-bold text-gray-900">{me?.full_name}</h2>
            <p className="mt-1 text-gray-600">{me?.email}</p>
            <p className="mt-1 text-sm text-gray-400">
              Member since {me?.create_at} · Google
            </p>

            {/* Divider */}
            <hr className="my-5 border-gray-200" />

            {/* Stats */}
            <div className="grid grid-cols-3 gap-4">
              {stats.map((stat, i) => (
                <div key={i}>
                  <div className="text-2xl font-bold text-gray-900">{stat.value}</div>
                  <div className="mt-1 text-sm text-gray-500">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
          <form onSubmit={handleSave} className="w-full    p-6 ">
            <h2 className="text-lg font-bold text-gray-900">Personal Information</h2>

            {/* Name */}
            <div className="mt-6">
              <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                Name
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-2 w-full rounded-lg border border-gray-300 px-4 py-2.5 text-gray-900 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
              />
            </div>

            {/* Email */}
            <div className="mt-6">
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                Email address
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-2 w-full rounded-lg border border-gray-300 px-4 py-2.5 text-gray-900 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
              />
            </div>

            {/* Footer */}
            <div className="mt-8 flex justify-end border-t border-gray-100 pt-6">
              <button
                type="submit"
                className="rounded-lg bg-indigo-600 px-5 py-2.5 font-semibold text-white hover:bg-indigo-700 transition-colors"
              >
                Save changes
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
