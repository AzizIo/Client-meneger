import { useState, useEffect } from 'react'
import API from '../API/api'
import { CheckCircle2, MessageSquare, UserPlus, FileStack, SendHorizontal } from 'lucide-react'

interface Actor {
  full_name: string;
  avatar_url: string | null;
}

interface ActivityLog {
  id: string;
  event_type: string;
  event_data: string | null;
  actor: Actor | null;
  created_at: string;
}

export default function ActivityFeed({ projectId }: { projectId: string }) {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!projectId) return;
    API.get(`/projects/${projectId}/activity`)
      .then((res) => setLogs(res.data))
      .catch((err) => console.error('Error fetching activity:', err))
      .finally(() => setIsLoading(false));
  }, [projectId]);

  function parseData(raw: string | null): any {
    if (!raw) return {};
    try { return JSON.parse(raw); } catch { return {}; }
  }

  function getIcon(type: string) {
    switch (type) {
      case 'stage_created': return FileStack;
      case 'task_created': return FileStack;
      case 'approval_requested': return SendHorizontal;
      case 'approval_decided': return CheckCircle2;
      case 'comment_added': return MessageSquare;
      case 'executor_added': return UserPlus;
      default: return FileStack;
    }
  }

  function describe(log: ActivityLog): string {
    const d = parseData(log.event_data);
    const who = log.actor?.full_name ?? 'Кто-то';

    switch (log.event_type) {
      case 'stage_created':
        return `${who} создал этап «${d.stage_name}»`;
      case 'task_created':
        return `${who} создал задачу «${d.task_title}»`;
      case 'approval_requested':
        return `${who} отправил задачу «${d.task_title}» на согласование (раунд ${d.round})`;
      case 'approval_decided':
        return d.status === 'approved'
          ? `${who} одобрил задачу`
          : `${who} отправил задачу на доработку${d.comment ? `: ${d.comment}` : ''}`;
      case 'comment_added':
        return `${who} оставил комментарий`;
      case 'executor_added':
        return `${who} добавил исполнителя (${d.added_email})`;
      default:
        return `${who}: ${log.event_type}`;
    }
  }

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString('ru-RU', {
      day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
    });
  }

  if (isLoading) {
    return <p className="text-sm text-gray-400 text-center py-8">Загрузка...</p>;
  }

  if (logs.length === 0) {
    return <p className="text-sm text-gray-400 text-center py-8">Пока нет событий</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      {logs.map((log) => {
        const Icon = getIcon(log.event_type);
        return (
          <div key={log.id} className="flex items-start gap-3">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gray-100 mt-0.5">
              <Icon size={13} className="text-gray-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-gray-700">{describe(log)}</p>
              <p className="text-xs text-gray-400 mt-0.5">{formatDate(log.created_at)}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}