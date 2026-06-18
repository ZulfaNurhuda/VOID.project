import { Link, useLocation } from "@tanstack/react-router";
import {
  BarChart3,
  FileText,
  Key,
  LogOut,
  Menu,
  Server,
  Ticket,
  User,
  UserCircle,
  Users,
  Users2,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useAuthStore } from "../../store/auth";
import { authApi } from "../../lib/api";
import axios from "axios";


interface NavItem {
  label: string;
  path: string;
  icon: React.ElementType;
}

const userNavItems: NavItem[] = [
  { label: "Secrets",  path: "/dashboard/secrets",  icon: Key },
  { label: "Personal", path: "/dashboard/personal", icon: User },
  { label: "Teams",    path: "/dashboard/teams",    icon: Users },
  { label: "Audit",    path: "/dashboard/audit",    icon: FileText },
];

const adminNavItems: NavItem[] = [
  { label: "Analytics", path: "/dashboard/analytics", icon: BarChart3 },
  { label: "Users",     path: "/dashboard/users",     icon: Users2 },
  { label: "Instance",  path: "/dashboard/instance",  icon: Server },
];

function NavLink({ item }: { item: NavItem }) {
  const location = useLocation();
  const isActive =
    item.path === "/dashboard/secrets"
      ? location.pathname === item.path ||
        location.pathname.startsWith("/dashboard/apps")
      : location.pathname === item.path ||
        location.pathname.startsWith(item.path + "/");

  return (
    <Link
      to={item.path}
      className={`flex items-center gap-3 px-3 py-2 text-sm transition-colors ${
        isActive
          ? "border-l-2 border-void-accent bg-void-accent/10 text-void-accent"
          : "border-l-2 border-transparent text-void-muted hover:bg-void-surface-2 hover:text-void-text"
      }`}
    >
      <item.icon size={14} />
      {item.label}
    </Link>
  );
}

function SidebarContent({ onClose }: { onClose?: () => void }) {
  const user = useAuthStore((s) => s.user);
  const clearAuth = useAuthStore((s) => s.clearAuth);

  const isAdmin = user?.role === "admin";
  const [inviteOnly, setInviteOnly] = useState(false);

  useEffect(() => {
    axios
      .get("/api/instance/public")
      .then((r) => setInviteOnly(r.data.registrationMode === "invite-only"))
      .catch(() => {});
  }, []);

  const handleLogout = async () => {
    try {
      await authApi.logout();
    } catch {}
    clearAuth();
    window.location.href = "/login";
  };

  const username = user?.username ?? "";
  const email    = user?.email    ?? "";
  const initials = username.slice(0, 2).toUpperCase() || "??";

  return (
    <div className="flex h-full flex-col bg-void-surface border-r border-void-border">
      {/* Logo */}
      <div className="flex h-14 items-center justify-between px-4 border-b border-void-border">
        <div className="flex items-center gap-2">
          <svg viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 flex-shrink-0">
            <polygon points="176,80 336,80 432,176 432,336 336,432 176,432 80,336 80,176" fill="white"/>
          </svg>
          <div className="flex items-baseline gap-2">
            <span className="font-bold text-void-text tracking-wider text-lg">VOID</span>
            <span className="text-[9px] tracking-[0.28em] uppercase font-semibold text-void-accent opacity-60">by AEGIS</span>
          </div>
        </div>
        {onClose && (
          <button onClick={onClose} className="text-void-muted hover:text-void-text">
            <X size={18} />
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-2 py-4 space-y-0.5">
        {userNavItems.map((item) => (
          <NavLink key={item.path} item={item} />
        ))}

        {isAdmin && (
          <>
            <div className="my-3 mx-3 border-t border-void-border" />
            {adminNavItems.map((item) => (
              <NavLink key={item.path} item={item} />
            ))}
            {inviteOnly && (
              <NavLink
                item={{ label: "Invites", path: "/dashboard/invites", icon: Ticket }}
              />
            )}
          </>
        )}

        <div className="my-3 mx-3 border-t border-void-border" />
        <NavLink
          item={{ label: "Account", path: "/dashboard/account", icon: UserCircle }}
        />
      </nav>

      {/* User card */}
      <div className="border-t border-void-border px-3 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center bg-void-accent/20 text-xs font-semibold text-void-accent flex-shrink-0">
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-void-text">{username || "Unknown"}</p>
            <p className="truncate text-xs text-void-muted">{email}</p>
          </div>
          <button
            onClick={handleLogout}
            className="text-void-muted hover:text-void-danger transition-colors flex-shrink-0"
            title="Logout"
          >
            <LogOut size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Sidebar() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      {/* Desktop sidebar — fixed left */}
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-64 md:block">
        <SidebarContent />
      </aside>

      {/* Mobile hamburger */}
      <button
        className="fixed left-4 top-4 z-30 rounded p-2 bg-void-surface border border-void-border text-void-muted hover:text-void-text md:hidden"
        onClick={() => setMobileOpen(true)}
      >
        <Menu size={18} />
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <>
          <div
            className="fixed inset-0 z-30 bg-black/50 md:hidden"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="fixed inset-y-0 left-0 z-40 w-64 md:hidden">
            <SidebarContent onClose={() => setMobileOpen(false)} />
          </aside>
        </>
      )}
    </>
  );
}
