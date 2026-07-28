import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { Bot, Library, Wrench, LogOut } from "lucide-react";

const navItems = [
  { path: "/agents", label: "Agent", icon: Bot },
  { path: "/knowledge", label: "知识库", icon: Library },
  { path: "/tools", label: "工具", icon: Wrench },
];

export function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();

  const handleSignOut = async () => {
    await signOut();
    navigate("/login");
  };

  return (
    <aside className="flex h-full w-56 flex-col border-r border-neutral-200 bg-neutral-50">
      <div className="flex h-14 items-center border-b border-neutral-200 px-4">
        <Bot className="mr-2 h-5 w-5 text-neutral-700" />
        <span className="text-base font-semibold text-neutral-900">AI Agent</span>
      </div>

      <nav className="flex-1 space-y-1 p-3">
        {navItems.map(({ path, label, icon: Icon }) => {
          const isActive = location.pathname.startsWith(path);
          return (
            <button
              key={path}
              onClick={() => navigate(path)}
              className={cn(
                "flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-neutral-200 text-neutral-900"
                  : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900"
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          );
        })}
      </nav>

      <div className="border-t border-neutral-200 p-3">
        <div className="mb-2 truncate px-3 text-sm text-neutral-500">{user?.name || user?.id}</div>
        <button
          onClick={handleSignOut}
          className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-neutral-600 transition-colors hover:bg-neutral-100 hover:text-neutral-900"
        >
          <LogOut className="h-4 w-4" />
          退出登录
        </button>
      </div>
    </aside>
  );
}
