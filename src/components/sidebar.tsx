"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bot, Book, Wrench, LogOut } from "lucide-react";
import { authClient } from "@/lib/auth-client";

const navItems = [
  { href: "/agents", icon: Bot, label: "Agent" },
  { href: "/knowledge", icon: Book, label: "知识库" },
  { href: "/tools", icon: Wrench, label: "工具" },
];

export function Sidebar() {
  const pathname = usePathname();
  const { data: session } = authClient.useSession();

  return (
    <aside className="w-14 h-screen flex flex-col items-center py-3 border-r border-gray-200 bg-white shrink-0">
      <Link
        href="/agents"
        className="mb-6 text-gray-700 hover:text-gray-900 transition-colors"
      >
        <Bot className="w-6 h-6" />
      </Link>

      <nav className="flex-1 flex flex-col items-center gap-3">
        {navItems.map((item) => {
          const isActive = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              title={item.label}
              className={`w-9 h-9 flex items-center justify-center rounded-lg transition-colors group relative ${
                isActive
                  ? "bg-gray-100 text-gray-900"
                  : "text-gray-400 hover:text-gray-600 hover:bg-gray-50"
              }`}
            >
              <item.icon className="w-5 h-5" />
              <span className="absolute left-full ml-2 px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 whitespace-nowrap pointer-events-none z-50">
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>

      {session && (
        <div className="flex flex-col items-center gap-2 pb-1">
          <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center text-xs text-gray-500">
            {(session.user?.name?.[0] || session.user?.email?.[0] || "?").toUpperCase()}
          </div>
          <button
            onClick={async () => {
              await authClient.signOut();
              window.location.href = "/login";
            }}
            className="text-gray-400 hover:text-red-600 transition-colors"
            title="退出"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      )}
    </aside>
  );
}
