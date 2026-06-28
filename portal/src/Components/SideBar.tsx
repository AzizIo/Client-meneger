import { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  FolderKanban,
  Users,
  Bell,
  Settings,
  Plus,
  Menu,
  X,
} from "lucide-react";

const NAV_ITEMS = [
  { label: "Dashboard", to: "/main", icon: LayoutDashboard },
  { label: "Projects", to: "/projects", icon: FolderKanban },
  { label: "Clients", to: "/clients", icon: Users },
  { label: "Notifications", to: "/notifications", icon: Bell },
  { label: "Settings", to: "/settings", icon: Settings },
];

export default function Sidebar() {
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();
  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        aria-label="Открыть меню"
        className="rounded-lg p-2 text-gray-600 hover:bg-gray-100"
      >
        <Menu size={18} />
      </button>

      {isOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/40"
          onClick={() => setIsOpen(false)}
        >

          <div
            className="flex h-screen w-60 flex-col gap-1 bg-white px-3 py-4"
            onClick={(e) => e.stopPropagation()}
          >

            <button
              type="button"
              onClick={() => setIsOpen(false)}
              aria-label="Закрыть меню"
              className="mb-2 self-end rounded-lg p-1.5 text-gray-400 hover:bg-gray-50 hover:text-gray-700"
            >
              <X size={18} />
            </button>

            <button
              type="button"
              className="mb-3 flex w-full items-center justify-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700 active:bg-indigo-800"
              onClick={() => navigate("/new-project")}
            >
              <Plus size={16} />
              New project
            </button>

            <hr className="mb-2 border-gray-200" />

            <nav className="flex flex-col gap-0.5">
              {NAV_ITEMS.map(({ label, to, icon: Icon }) => (
                <NavLink
                  key={to}
                  to={to}
                  className={({ isActive }) =>
                    [
                      "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors",
                      isActive
                        ? "bg-indigo-50 font-medium text-indigo-700"
                        : "text-gray-600 hover:bg-gray-50 hover:text-gray-900",
                    ].join(" ")
                  }
                >
                  <Icon size={18} className="shrink-0" />
                  {label}
                </NavLink>
              ))}
            </nav>

          </div>
        </div>
      )}
    </>
  );
}