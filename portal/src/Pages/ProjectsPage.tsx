import { useEffect, useState } from "react";
import API from "../API/api";
import Header from "../Components/Header";
interface Project {
  id: string;
  name: string;
  description: string;
  status: string;
  created_at: string;
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);

  useEffect(() => {
    API.get("/projects").then((res) => setProjects(res.data));
  }, []);

  return (
    <>
      <Header />
      <div className="max-w-5xl mx-auto p-8">
        <h1 className="text-2xl font-semibold mb-6">Projects</h1>

        <div className="rounded-lg border border-gray-200 overflow-hidden">
          {/* Header */}
          <div className="grid grid-cols-[2fr_1fr_1fr] px-6 py-3 text-sm text-gray-500 border-b">
            <span>Project</span>
            <span>Status</span>
            <span>Created</span>
          </div>

          {/* Rows */}
          {projects.map((project) => (
            <div
              key={project.id}
              className="grid grid-cols-[2fr_1fr_1fr] items-center px-6 py-4 border-b last:border-none hover:bg-gray-50 transition"
            >
              <div>
                <h2 className="font-medium text-gray-900">{project.name}</h2>

                {project.description && (
                  <p className="text-sm text-gray-500 truncate mt-1">
                    {project.description}
                  </p>
                )}
              </div>

              <span className="text-sm text-gray-600 capitalize">
                {project.status}
              </span>

              <span className="text-sm text-gray-500">
                {new Date(project.created_at).toLocaleDateString()}
              </span>
            </div>
          ))}

          {projects.length === 0 && (
            <div className="py-10 text-center text-gray-400">
              No projects
            </div>
          )}
        </div>
      </div>

    </>
  );
}