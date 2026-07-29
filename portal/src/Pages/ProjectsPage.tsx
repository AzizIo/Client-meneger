import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Plus, FolderOpen } from "lucide-react";
import API from "../API/api";
import Header from "../Components/Header";
import {
  colors,
  fontDisplay,
  fontMono,
  Eyebrow,
  StampBadge,
  btnPrimary,
  btnPrimaryStyle,
  type StampTone,
} from "../Components/ui/designSystem";

interface Project {
  id: string;
  name: string;
  description: string;
  status: string;
  created_at: string;
}

const STATUS_STAMP: Record<string, { label: string; tone: StampTone }> = {
  active: { label: 'В работе', tone: 'blue' },
  completed: { label: 'Завершён', tone: 'ink' },
  on_hold: { label: 'На паузе', tone: 'red' },
};

function getStatusStamp(status: string) {
  return STATUS_STAMP[status] ?? { label: status, tone: 'ink' as const };
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [query, setQuery] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    API.get("/projects")
      .then((res) => setProjects(res.data))
      .catch((err) => console.error(err))
      .finally(() => setIsLoading(false));
  }, []);

  const filteredProjects = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return projects;
    return projects.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.description?.toLowerCase().includes(q)
    );
  }, [projects, query]);

  return (
    <>
      <Header />
      <div className="min-h-screen" style={{ backgroundColor: colors.paper }}>
        <div className="max-w-5xl mx-auto p-8">
          <div className="flex items-center justify-between mb-6 gap-4">
            <div>
              <Eyebrow>Проекты</Eyebrow>
              <h1 className="text-2xl font-semibold mt-1" style={{ color: colors.ink, fontFamily: fontDisplay }}>
                Все проекты
              </h1>
            </div>
            <button
              onClick={() => navigate("/new-project")}
              className={btnPrimary}
              style={btnPrimaryStyle}
            >
              <Plus size={16} />
              Новый проект
            </button>
          </div>

          <div className="relative mb-4">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2"
              style={{ color: colors.muted }}
            />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              type="text"
              placeholder="Поиск проектов..."
              className="w-full rounded-md pl-9 pr-3 py-2.5 text-sm outline-none transition"
              style={{ border: `1px solid ${colors.line}`, color: colors.ink }}
            />
          </div>

          <div className="rounded-lg bg-white overflow-hidden" style={{ border: `1px solid ${colors.line}` }}>
            <div
              className="grid grid-cols-[2fr_1fr_1fr] px-6 py-3"
              style={{ borderBottom: `1px solid ${colors.line}` }}
            >
              <Eyebrow>Проект</Eyebrow>
              <Eyebrow>Статус</Eyebrow>
              <Eyebrow>Создан</Eyebrow>
            </div>

            {isLoading &&
              Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="grid grid-cols-[2fr_1fr_1fr] items-center px-6 py-4 animate-pulse last:border-none"
                  style={{ borderBottom: `1px solid ${colors.paper}` }}
                >
                  <div className="h-4 w-40 rounded" style={{ backgroundColor: colors.paper }} />
                  <div className="h-4 w-16 rounded" style={{ backgroundColor: colors.paper }} />
                  <div className="h-4 w-20 rounded" style={{ backgroundColor: colors.paper }} />
                </div>
              ))}

            {!isLoading &&
              filteredProjects.map((project) => {
                const stamp = getStatusStamp(project.status);
                return (
                  <div
                    key={project.id}
                    onClick={() => navigate(`/projects/${project.id}`)}
                    className="group relative grid grid-cols-[2fr_1fr_1fr] items-center px-6 py-4 last:border-none transition-colors cursor-pointer hover:bg-black/[0.015]"
                    style={{ borderBottom: `1px solid ${colors.paper}` }}
                  >
                    <div className="min-w-0">
                      <h2 className="font-medium truncate" style={{ color: colors.ink }}>{project.name}</h2>
                      {project.description && (
                        <p className="text-sm truncate mt-0.5" style={{ color: colors.muted }}>
                          {project.description}
                        </p>
                      )}
                    </div>

                    <div>
                      <StampBadge label={stamp.label} tone={stamp.tone} />
                    </div>

                    <span className="text-sm" style={{ color: colors.muted, fontFamily: fontMono }}>
                      {new Date(project.created_at).toLocaleDateString('ru-RU')}
                    </span>
                  </div>
                );
              })}

            {!isLoading && projects.length === 0 && (
              <div className="py-14 flex flex-col items-center gap-2" style={{ color: colors.muted }}>
                <FolderOpen size={28} strokeWidth={1.5} />
                <p className="text-sm">Проектов пока нет</p>
                <button
                  onClick={() => navigate("/new-project")}
                  className="text-sm font-medium hover:underline"
                  style={{ color: colors.ink }}
                >
                  Создать первый проект
                </button>
              </div>
            )}

            {!isLoading && projects.length > 0 && filteredProjects.length === 0 && (
              <div className="py-14 text-center text-sm" style={{ color: colors.muted }}>
                Ничего не найдено по запросу «{query}»
              </div>
            )}
          </div>

          {!isLoading && filteredProjects.length > 0 && (
            <p className="mt-3 text-xs" style={{ color: colors.muted, fontFamily: fontMono }}>
              {filteredProjects.length} из {projects.length} проектов
            </p>
          )}
        </div>
      </div>
    </>
  );
}