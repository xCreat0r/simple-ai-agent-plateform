"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

export function Header() {
  const { data: session } = authClient.useSession();
  const router = useRouter();

  const handleLogout = async () => {
    await authClient.signOut();
    router.push("/login");
  };

  return (
    <header className="border-b border-gray-200">
      <div className="max-w-3xl mx-auto px-4 h-10 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/agents" className="text-sm font-medium">
            Agent Platform
          </Link>
          <Link href="/tools" className="text-xs text-gray-400 hover:text-gray-600">
            工具
          </Link>
          <Link href="/knowledge" className="text-xs text-gray-400 hover:text-gray-600">
            知识库
          </Link>
        </div>
        {session ? (
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">{session.user?.name || session.user?.email}</span>
            <button
              onClick={handleLogout}
              className="text-xs text-gray-400 hover:text-gray-600"
            >
              退出
            </button>
          </div>
        ) : (
          <Link href="/login" className="text-xs text-gray-400 hover:text-gray-600">
            登录
          </Link>
        )}
      </div>
    </header>
  );
}
