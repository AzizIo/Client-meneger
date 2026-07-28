import { useState, useEffect } from 'react';
import { Send, Trash2, Lock } from 'lucide-react';
import API from '../API/api';
import { useAuth } from '../Context/AuthContext';
import { useToast } from '../Context/ToastContext';

interface Author {
  id: string;
  full_name: string;
  avatar_url: string | null;
  role: string;
}

interface CommentItem {
  id: string;
  task_id: string;
  author_user_id: string | null;
  author: Author | null;
  body: string;
  is_internal: boolean;
  created_at: string;
}

interface CommentsProps {
  projectId?: string;
  stageId?: string;
  taskId?: string;
}

export default function Comments({ projectId, stageId, taskId }: CommentsProps) {
  const { me } = useAuth();
  const { showToast } = useToast();
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [body, setBody] = useState('');
  const [isInternal, setIsInternal] = useState(false);
  const [isSending, setIsSending] = useState(false);

  const basePath = `/projects/${projectId}/stages/${stageId}/tasks/${taskId}/comments`;

  useEffect(() => {
    if (!taskId) return;
    API.get(basePath)
      .then((res) => setComments(res.data))
      .catch((err) => console.error(err));
  }, [taskId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;

    try {
      setIsSending(true);
      const res = await API.post(basePath, {
        body,
        is_internal: isInternal,
      });
      setComments((prev) => [...prev, res.data]);
      setBody('');
      setIsInternal(false);
    } catch (err) {
      console.error(err);
      showToast('Не удалось отправить комментарий');
    } finally {
      setIsSending(false);
    }
  }

  async function handleDelete(commentId: string) {
    try {
      await API.delete(`${basePath}/${commentId}`);
      setComments((prev) => prev.filter((c) => c.id !== commentId));
    } catch (err) {
      console.error(err);
      showToast('Не удалось удалить комментарий');
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-gray-400 text-xs uppercase tracking-wide">Комментарии</p>

      <div className="flex flex-col gap-3">
        {comments.length === 0 && (
          <p className="text-sm text-gray-400">Пока нет комментариев</p>
        )}

        {comments.map((comment) => {
          const isOwn = comment.author_user_id === me?.id;
          return (
            <div
              key={comment.id}
              className={`rounded-lg border px-3 py-2.5 text-sm ${comment.is_internal
                ? 'border-amber-200 bg-amber-50'
                : 'border-gray-200 bg-white'
                }`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  {comment.author?.avatar_url ? (
                    <img
                      src={comment.author.avatar_url}
                      alt=""
                      className="h-5 w-5 rounded-full object-cover bg-gray-100"
                    />
                  ) : (
                    <div className="h-5 w-5 rounded-full bg-gray-900 flex items-center justify-center">
                      <span className="text-[10px] text-white font-medium">
                        {comment.author?.full_name?.[0]?.toUpperCase() ?? '?'}
                      </span>
                    </div>
                  )}
                  <span className="font-medium text-gray-900">
                    {comment.author?.full_name ?? 'Удалённый пользователь'}
                  </span>
                  {comment.is_internal && (
                    <span className="flex items-center gap-1 text-amber-700 text-xs">
                      <Lock size={11} /> внутренний
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs text-gray-400">
                    {new Date(comment.created_at).toLocaleString('ru-RU', {
                      day: '2-digit',
                      month: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                  {isOwn && (
                    <button
                      onClick={() => handleDelete(comment.id)}
                      className="text-gray-300 hover:text-red-500 transition-colors"
                      title="Удалить"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              </div>

              <p className="mt-1.5 text-gray-700 whitespace-pre-wrap">{comment.body}</p>
            </div>
          );
        })}
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-2">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Написать комментарий..."
          rows={2}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none transition focus:border-gray-900 resize-none"
        />

        <div className="flex items-center justify-between">
          {me?.role === 'executor' ? (
            <label className="flex items-center gap-2 text-xs text-gray-500 cursor-pointer">
              <input
                type="checkbox"
                checked={isInternal}
                onChange={(e) => setIsInternal(e.target.checked)}
                className="rounded border-gray-300"
              />
              Только для команды (скрыт от заказчика)
            </label>
          ) : (
            <span />
          )}

          <button
            type="submit"
            disabled={isSending || !body.trim()}
            className="inline-flex items-center gap-1.5 rounded-md bg-gray-900 text-white hover:bg-gray-700 px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-50"
          >
            <Send size={14} />
            Отправить
          </button>
        </div>
      </form>
    </div>
  );
}