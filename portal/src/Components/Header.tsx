import SaidBar from './SideBar'
import { Bell } from 'lucide-react';
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import API from '../API/api';
import { colors, fontDisplay, Eyebrow } from './ui/designSystem'

export default function Header() {
  const navigate = useNavigate()
  const [me, setMe] = useState<any>(null)
  const [unreadCount, setUnreadCount] = useState<number>(0);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await API.get('/auth/me')
        setMe(res.data)
      } catch (error) {
        console.error('Error fetching profile:', error)
      }
    }
    fetchProfile()
  }, [])

  useEffect(() => {
    API.get('/notifications/unread-count')
      .then((res) => setUnreadCount(res.data?.count ?? 0))
      .catch((error) => console.error('Error fetching unread count:', error))
  }, [])

  return (
    <>
      <header className='p-4' style={{ backgroundColor: colors.paper }}>
        <div className='flex justify-between items-center'>
          <div className='flex gap-4 items-center'>
            <SaidBar />
            <Eyebrow>Dashboard</Eyebrow>
          </div>

          <div className='flex gap-6 items-center'>
            <button
              type="button"
              onClick={() => navigate('/notifications')}
              aria-label="Уведомления"
              className='relative inline-flex items-center justify-center h-9 w-9 rounded-md transition-colors hover:bg-black/[0.03]'
              style={{ color: colors.muted }}
            >
              <Bell size={18} />
              {unreadCount > 0 && (
                <span
                  className='absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold text-white -rotate-2'
                  style={{ backgroundColor: colors.stampBlue, fontFamily: "'IBM Plex Mono', monospace" }}
                >
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => navigate('/profile')}
              className='rounded-full transition-opacity hover:opacity-80'
            >
              {me?.avatar_url ? (
                <img
                  className="h-9 w-9 rounded-full object-cover"
                  style={{ border: `1px solid ${colors.line}` }}
                  src={me.avatar_url}
                  alt=""
                />
              ) : (
                <div className="flex h-9 w-9 items-center justify-center rounded-full" style={{ backgroundColor: colors.ink }}>
                  <span className="text-sm font-semibold text-white" style={{ fontFamily: fontDisplay }}>
                    {me?.full_name?.[0]?.toUpperCase() ?? "?"}
                  </span>
                </div>
              )}
            </button>
          </div>
        </div>
      </header>
      <hr style={{ borderColor: colors.line }} />
    </>
  );
}