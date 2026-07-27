import API from "../API/api";
import { useAuth } from "../Context/AuthContext";
import { useState, useEffect } from "react";
import { Trash2, UserPlus } from "lucide-react";

interface Executors {
  id: string;
  full_name: string;
  email: string;
  avatar_url: string | undefined;
  is_owner: boolean;
  added_at: string;
}

interface Props {
  projectId: string;
  executorId: string
}

export default function Team({ projectId, executorId }: Props) {
  const [executors, setExecutors] = useState<Executors[]>([]);
  const [newEmail, setNewEmail] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const { me } = useAuth();
  const defLink = `/projects/${projectId}/executors`;
  const isOwner = me?.id === executorId; // вместо isExecutor

  useEffect(() => {
    fetchExecutors();
  }, [projectId]);

  function fetchExecutors() {
    API.get(defLink)
      .then((res) => setExecutors(res.data))
      .catch((err) => console.log(err.response?.data));
  }

  async function handleAdd(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!newEmail.trim()) return;

    try {
      setIsAdding(true);
      await API.post(defLink, { email: newEmail });
      setNewEmail("");
      fetchExecutors();
    } catch (err: any) {
      if (err.response?.status === 404) {
        alert("Пользователь с таким email не найден");
      } else if (err.response?.status === 400) {
        alert("Этот пользователь не зарегистрирован как исполнитель");
      } else if (err.response?.status === 409) {
        alert("Этот исполнитель уже добавлен в проект");
      } else {
        alert("Не удалось добавить исполнителя");
      }
    } finally {
      setIsAdding(false);
    }
  }

  async function handleRemove(userId: string) {
    try {
      await API.delete(`${defLink}/${userId}`);
      setExecutors((prev) => prev.filter((ex) => ex.id !== userId));
    } catch (err: any) {
      if (err.response?.status === 400) {
        alert("Нельзя удалить владельца проекта");
      } else {
        alert("Не удалось удалить исполнителя");
      }
      console.log(err.response?.data);
    }
  }

  const inputClass =
    "flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm outline-none transition focus:border-gray-900";
  const btnPrimary =
    "inline-flex items-center justify-center gap-1.5 rounded-md bg-gray-900 text-white hover:bg-gray-700 px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50";

  return (
    <div className="mt-8">
      {isOwner && (
        <form onSubmit={handleAdd} className="flex gap-2 mb-6">
          <input
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            type="email"
            placeholder="Email исполнителя"
            className={inputClass}
          />
          <button type="submit" disabled={isAdding} className={btnPrimary}>
            <UserPlus size={15} />
            {isAdding ? "Добавление..." : "Добавить"}
          </button>
        </form>
      )}

      {executors.length === 0 ? (
        <div className="py-10 text-center text-sm text-gray-400">
          Исполнителей пока нет
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {executors.map((ex) => (
            <div
              key={ex.id}
              className="flex items-center justify-between rounded-lg border border-gray-200 px-4 py-3"
            >
              <div className="flex items-center gap-3">
                {ex.avatar_url ? (
                  <img
                    className="h-9 w-9 rounded-full object-cover bg-gray-100"
                    src={ex.avatar_url}
                    alt=""
                  />
                ) : (
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-900">
                    <span className="text-sm font-semibold text-white">
                      {ex.full_name?.[0]?.toUpperCase() ?? "?"}
                    </span>
                  </div>
                )}

                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900 text-sm">
                      {ex.full_name}
                    </span>
                    {ex.is_owner && (
                      <span className="rounded-md border border-gray-200 px-1.5 py-0.5 text-[11px] font-medium text-gray-500">
                        Владелец
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-gray-400">{ex.email}</div>
                  <div className="text-xs text-gray-300">ID: {ex.id}</div>
                </div>
              </div>

              {isOwner && !ex.is_owner && (
                <button
                  onClick={() => handleRemove(ex.id)}
                  className="inline-flex items-center justify-center h-8 w-8 rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                  title="Удалить из проекта"
                >
                  <Trash2 size={15} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}