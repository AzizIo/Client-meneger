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
  LogOut,
} from "lucide-react";
import { useAuth } from '../Context/AuthContext';
import { colors, fontDisplay, btnPrimary, btnPrimaryStyle } from './ui/designSystem'
import { motion, AnimatePresence } from "motion/react"

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
    navigate('/login');
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        aria-label="Открыть меню"
        className="rounded-md p-2 transition-colors hover:bg-black/[0.03]"
        style={{ color: colors.muted }}
      >
        <Menu size={18} />
      </button>
      <AnimatePresence>

        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 bg-black/40"
            onClick={() => setIsOpen(false)}
          >
            <div
              className="flex h-screen w-60 flex-col px-3 py-4"
              style={{ backgroundColor: colors.paper, borderRight: `1px solid ${colors.line}` }}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                aria-label="Закрыть меню"
                className="mb-2 self-end rounded-md p-1.5 transition-colors hover:bg-black/[0.03]"
                style={{ color: colors.muted }}
              >
                <X size={18} />
              </button>

              <button
                type="button"
                className={`${btnPrimary} w-full mb-3`}
                style={btnPrimaryStyle}
                onClick={() => navigate("/new-project")}
              >
                <Plus size={16} />
                Новый проект
              </button>

              <hr className="mb-2" style={{ borderColor: colors.line }} />

              <nav className="flex flex-col gap-0.5">
                {NAV_ITEMS.map(({ label, to, icon: Icon }) => (
                  <NavLink
                    key={to}
                    to={to}
                    className={({ isActive }) =>
                      `flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors ${isActive ? 'font-medium bg-black/[0.04]' : 'hover:bg-black/[0.03]'
                      }`
                    }
                    style={({ isActive }: any) => ({ color: isActive ? colors.ink : colors.muted })}
                  >
                    <Icon size={18} className="shrink-0" />
                    {label}
                  </NavLink>
                ))}
              </nav>

              <div className="mt-auto pt-4 flex items-center justify-between" style={{ borderTop: `1px solid ${colors.line}` }}>
                <NavLink
                  to="/profile"
                  aria-label="Открыть профиль"
                  className="flex min-w-0 items-center gap-2 rounded-md text-left transition-opacity hover:opacity-75 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
                >
                  {me?.avatar_url ? (
                    <img
                      className="h-8 w-8 rounded-full object-cover shrink-0"
                      style={{ border: `1px solid ${colors.line}` }}
                      src={me.avatar_url}
                      alt=""
                    />
                  ) : (
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full" style={{ backgroundColor: colors.ink }}>
                      <span className="text-xs font-semibold text-white" style={{ fontFamily: fontDisplay }}>
                        {me?.full_name?.[0]?.toUpperCase() ?? "?"}
                      </span>
                    </div>
                  )}
                  <span className="text-sm truncate" style={{ color: colors.ink }}>
                    {me?.full_name}
                  </span>
                </NavLink>

                <button
                  type="button"
                  onClick={handleLogout}
                  aria-label="Выйти из аккаунта"
                  title="Выйти"
                  className="inline-flex items-center justify-center h-8 w-8 rounded-md transition-colors hover:bg-black/[0.03] shrink-0"
                  style={{ color: colors.muted }}
                >
                  <LogOut size={16} />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}