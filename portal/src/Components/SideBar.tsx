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
  UserRoundX
} from "lucide-react";
import { useAuth } from '../Context/AuthContext';





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
  const { me, clearMe } = useAuth();
  const handleLogout = () => {
    clearMe();
    navigate('/login'); // подставь свой реальный путь на страницу логина
  };
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
              <div>

              </div>
              <div className="absolute bottom-6 left-4 flex items-center " >
                <div className="flex items-center gap-2" >
                  <div>
                    {me?.avatar_url ? <div className="" >
                      <img className="flex h-8 w-8  hover:bg-black/50 items-center justify-center rounded-full bg-indigo-100 ring-4 ring-white" src={me.avatar_url} alt="" />
                    </div> : <div>
                      <div className="flex   hover:bg-zinc-400 h-10 w-10 items-center justify-center rounded-full bg-indigo-100 ring-4 ring-white">

                        <img src={me?.avatar_url} alt="" />
                        <span className="text-xl font-bold text-indigo-700">{me?.full_name[0].toUpperCase()}</span>
                      </div>

                    </div>}
                  </div>
                  <div>

                    {me?.full_name}
                  </div>
                </div>
                <div onClick={handleLogout} className="ml-22" >
                  <UserRoundX />
                </div>
              </div>
            </nav>

          </div>
        </div>
      )}
    </>
  );
}