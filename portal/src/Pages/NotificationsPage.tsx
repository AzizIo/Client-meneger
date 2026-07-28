import API from "../API/api";
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Header from "../Components/Header"
import { Bell, MessageSquare, CheckCircle2, UserPlus, Inbox } from 'lucide-react'

interface Notification {
  id: string;
  type: string;
  title: string;
  body: string | null;
  related_project_id: string | null;
  related_task_id: string | null;
  is_read: boolean;
  created_at: string;
}

export default function NotificationsPage() {
  const navigate = useNavigate()
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchNotifications()
  }, [])

  function fetchNotifications() {
    setIsLoading(true)
    API.get('/notifications')
      .then((res) => setNotifications(res.data))
      .catch((error) => console.error('Error fetching notifications:', error))
      .finally(() => setIsLoading(false))
  }

  async function handleOpen(n: Notification) {
    if (!n.is_read) {
      try {
        await API.patch(`/notifications/${n.id}/read`)
        setNotifications(prev =>
          prev.map(item => item.id === n.id ? { ...item, is_read: true } : item)
        );
      } catch (error) {
        console.error('Error marking notification as read:', error)
      }
    }

    if (n.related_project_id) {
      navigate(`/projects/${n.related_project_id}`)
    }
  }

  async function handleMarkAllRead() {
    try {
      await API.patch('/notifications/read-all')
      setNotifications(prev => prev.map(item => ({ ...item, is_read: true })))
    } catch (error) {
      console.error('Error marking all as read:', error)
    }
  }

  function getIcon(type: string) {
    switch (type) {
      case 'approval_requested':
        return Bell;
      case 'approval_decided':
        return CheckCircle2;
      case 'new_comment':
        return MessageSquare;
      case 'added_to_project':
        return UserPlus;
      default:
        return Bell;
    }
  }

  function formatDate(dateStr: string) {
    const date = new Date(dateStr);
    return date.toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  const hasUnread = notifications.some(n => !n.is_read);

  const btnOutline =
    'inline-flex items-center justify-center rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50 px-4 py-2 text-sm font-medium transition-colors';

  return (
    <>
      <Header />
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-semibold text-gray-900">Уведомления</h1>
          {hasUnread && (
            <button onClick={handleMarkAllRead} className={btnOutline}>
              Прочитать всё
            </button>
          )}
        </div>

        {isLoading ? (
          <p className="text-sm text-gray-400 text-center py-12">Загрузка...</p>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Inbox className="text-gray-300 mb-3" size={32} />
            <p className="text-sm text-gray-400">Пока нет уведомлений</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {notifications.map((n) => {
              const Icon = getIcon(n.type);
              return (
                <div
                  key={n.id}
                  onClick={() => handleOpen(n)}
                  className={`flex items-start gap-3 rounded-lg border px-4 py-3 cursor-pointer transition-colors ${n.is_read
                      ? 'border-gray-200 bg-white hover:border-gray-300'
                      : 'border-gray-300 bg-gray-50 hover:bg-gray-100'
                    }`}
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-100 mt-0.5">
                    <Icon size={15} className="text-gray-600" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className={`text-sm ${n.is_read ? 'text-gray-700' : 'font-medium text-gray-900'}`}>
                        {n.title}
                      </p>
                      {!n.is_read && (
                        <span className="h-1.5 w-1.5 rounded-full bg-gray-900 shrink-0" />
                      )}
                    </div>
                    {n.body && (
                      <p className="text-sm text-gray-500 mt-0.5 truncate">{n.body}</p>
                    )}
                    <p className="text-xs text-gray-400 mt-1">{formatDate(n.created_at)}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}