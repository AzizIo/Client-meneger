import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Plus, FolderOpen } from "lucide-react";
import API from "../API/api";
import Header from "../Components/Header";

interface Project {
  id: string;
  name: string;
  description: string;
  status: string;
  created_at: string;
}

// Единая палитра статусов — точка-индикатор вместо цветных плашек,
// тот же паттерн, что в Tasks.tsx и StageStepper.tsx
const STATUS_DOT: Record<string, string> = {
  open: "bg-gray-400",
  in_progress: "bg-amber-500",
  completed: "bg-emerald-500",
  archived: "bg-gray-300",
};

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

  // Фильтрация на клиенте — по названию и описанию, без лишних запросов
  const filteredProjects = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return projects;
    return projects.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.description?.toLowerCase().includes(q)
    );
  }, [projects, query]);

  const btnPrimary =
    "inline-flex items-center justify-center gap-2 rounded-md bg-gray-900 text-white hover:bg-gray-700 px-4 py-2.5 text-sm font-medium transition-colors";

  return (
    <>
      <Header />
      <div className="max-w-5xl mx-auto p-8">
        <div className="flex items-center justify-between mb-6 gap-4">
          <h1 className="text-2xl font-semibold text-gray-900">Projects</h1>
          <button
            onClick={() => navigate("/projects/new")}
            className={btnPrimary}
          >
            <Plus size={16} />
            New project
          </button>
        </div>

        <div className="relative mb-4">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
          />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            type="text"
            placeholder="Search projects..."
            className="w-full rounded-md border border-gray-300 pl-9 pr-3 py-2.5 text-sm outline-none transition focus:border-gray-900"
          />
        </div>

        <div className="rounded-lg border border-gray-200 overflow-hidden">
          {/* Header */}
          <div className="grid grid-cols-[2fr_1fr_1fr] px-6 py-3 text-xs uppercase tracking-wide text-gray-400 border-b border-gray-200">
            <span>Project</span>
            <span>Status</span>
            <span>Created</span>
          </div>

          {/* Loading skeleton */}
          {isLoading &&
            Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="grid grid-cols-[2fr_1fr_1fr] items-center px-6 py-4 border-b border-gray-100 last:border-none animate-pulse"
              >
                <div className="h-4 w-40 bg-gray-100 rounded" />
                <div className="h-4 w-16 bg-gray-100 rounded" />
                <div className="h-4 w-20 bg-gray-100 rounded" />
              </div>
            ))}

          {/* Rows */}
          {!isLoading &&
            filteredProjects.map((project) => (
              <div
                key={project.id}
                onClick={() => navigate(`/projects/${project.id}`)}
                className="grid grid-cols-[2fr_1fr_1fr] items-center px-6 py-4 border-b border-gray-100 last:border-none hover:bg-gray-50 transition-colors cursor-pointer"
              >
                <div>
                  <h2 className="font-medium text-gray-900">{project.name}</h2>

                  {project.description && (
                    <p className="text-sm text-gray-500 truncate mt-1">
                      {project.description}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-1.5 text-sm text-gray-600 capitalize">
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[project.status] ?? "bg-gray-400"
                      }`}
                  />
                  {project.status}
                </div>

                <span className="text-sm text-gray-500">
                  {new Date(project.created_at).toLocaleDateString()}
                </span>
              </div>
            ))}

          {/* Empty states */}
          {!isLoading && projects.length === 0 && (
            <div className="py-14 flex flex-col items-center gap-2 text-gray-400">
              <FolderOpen size={28} strokeWidth={1.5} />
              <p className="text-sm">No projects yet</p>
              <button
                onClick={() => navigate("/projects/new")}
                className="text-sm text-gray-900 font-medium hover:underline"
              >
                Create your first project
              </button>
            </div>
          )}

          {!isLoading && projects.length > 0 && filteredProjects.length === 0 && (
            <div className="py-14 text-center text-gray-400 text-sm">
              No projects match "{query}"
            </div>
          )}
        </div>

        {!isLoading && filteredProjects.length > 0 && (
          <p className="mt-3 text-xs text-gray-400">
            {filteredProjects.length} of {projects.length} projects
          </p>
        )}
      </div>
    </>
  );
}