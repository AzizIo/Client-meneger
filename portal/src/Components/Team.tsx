import API from "../API/api";
import { useAuth } from "../Context/AuthContext";
import { useToast } from "../Context/ToastContext";
import { useState, useEffect } from "react";
import { Trash2, UserPlus } from "lucide-react";
import {
  colors,
  fontDisplay,
  fontMono,
  Eyebrow,
  CornerMarks,
  StampBadge,
  btnPrimary,
  btnPrimaryStyle,
  btnOutline,
  btnOutlineStyle,
} from "./ui/designSystem"; // или путь до designSystem
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
  const { showToast } = useToast();
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
        showToast("Пользователь с таким email не найден");
      } else if (err.response?.status === 400) {
        showToast("Этот пользователь не зарегистрирован как исполнитель");
      } else if (err.response?.status === 409) {
        showToast("Этот исполнитель уже добавлен в проект");
      } else {
        showToast("Не удалось добавить исполнителя");
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
        showToast("Нельзя удалить владельца проекта");
      } else {
        showToast("Не удалось удалить исполнителя");
      }
      console.log(err.response?.data);
    }
  }

  const inputClass =
    "flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm outline-none transition focus:border-gray-900";
  const btnPrimary =
    "inline-flex items-center justify-center gap-1.5 rounded-md bg-gray-900 text-white hover:bg-gray-700 px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50";

  return (
    <div className="mt-8 space-y-8">
      {isOwner && (
        <section
          className="rounded-lg bg-white p-6"
          style={{ border: `1px solid ${colors.line}` }}
        >
          <Eyebrow>Добавить исполнителя</Eyebrow>

          <form onSubmit={handleAdd} className="mt-4 flex gap-3">
            <input
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              type="email"
              placeholder="executor@email.com"
              className="flex-1 rounded-md px-3 py-2.5 text-sm outline-none transition"
              style={{
                border: `1px solid ${colors.line}`,
                color: colors.ink,
                fontFamily: fontMono,
              }}
            />

            <button
              type="submit"
              disabled={isAdding}
              className={btnPrimary}
              style={btnPrimaryStyle}
            >
              <UserPlus size={16} />
              {isAdding ? "Добавление..." : "Добавить"}
            </button>
          </form>
        </section>
      )}

      <section>
        <div className="flex items-center justify-between mb-5">
          <div>
            <Eyebrow>Команда проекта</Eyebrow>

            <h2
              className="mt-1 text-xl font-semibold"
              style={{
                color: colors.ink,
                fontFamily: fontDisplay,
              }}
            >
              Исполнители
            </h2>
          </div>

          <StampBadge label={`${executors.length} участников`} tone="blue" />
        </div>

        {executors.length === 0 ? (
          <div
            className="rounded-lg bg-white px-8 py-10 text-center"
            style={{ border: `1px solid ${colors.line}` }}
          >
            <Eyebrow>TEAM EMPTY</Eyebrow>

            <p
              className="mt-3 text-sm"
              style={{ color: colors.muted }}
            >
              Пока ни один исполнитель не добавлен в проект
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {executors.map((ex, index) => (
              <div
                key={ex.id}
                className="group relative rounded-lg bg-white p-5 transition-all hover:shadow-sm"
                style={{
                  border: `1px solid ${colors.line}`,
                }}
              >
                <CornerMarks />

                <div className="flex items-start justify-between gap-6">
                  <div className="flex gap-4 min-w-0">
                    {ex.avatar_url ? (
                      <img
                        src={ex.avatar_url}
                        alt=""
                        className="h-12 w-12 rounded-md object-cover shrink-0"
                        style={{
                          border: `1px solid ${colors.line}`,
                        }}
                      />
                    ) : (
                      <div
                        className="flex h-12 w-12 items-center justify-center rounded-md text-sm font-semibold shrink-0"
                        style={{
                          border: `1px solid ${colors.line}`,
                          background: colors.paper,
                          color: colors.ink,
                          fontFamily: fontDisplay,
                        }}
                      >
                        {ex.full_name?.[0]?.toUpperCase() ?? "?"}
                      </div>
                    )}

                    <div className="min-w-0">
                      <div className="flex items-center gap-3 flex-wrap">
                        <Eyebrow>
                          MEMBER {String(index + 1).padStart(2, "0")}
                        </Eyebrow>

                        {ex.is_owner && (
                          <StampBadge
                            label="Владелец"
                            tone="blue"
                          />
                        )}
                      </div>

                      <h3
                        className="mt-1 font-semibold truncate"
                        style={{
                          color: colors.ink,
                          fontFamily: fontDisplay,
                        }}
                      >
                        {ex.full_name}
                      </h3>

                      <p
                        className="mt-2 text-sm"
                        style={{
                          color: colors.muted,
                          fontFamily: fontMono,
                        }}
                      >
                        {ex.email}
                      </p>

                      <p
                        className="mt-1 text-xs"
                        style={{
                          color: colors.muted,
                          fontFamily: fontMono,
                        }}
                      >
                        ID · {ex.id}
                      </p>
                    </div>
                  </div>

                  {isOwner && !ex.is_owner && (
                    <button
                      onClick={() => handleRemove(ex.id)}
                      className={btnOutline}
                      style={{
                        ...btnOutlineStyle,
                        color: colors.stampRed,
                        borderColor: colors.stampRed,
                        padding: "8px",
                      }}
                      title="Удалить исполнителя"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}