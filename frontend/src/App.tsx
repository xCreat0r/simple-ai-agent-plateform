import { BrowserRouter, Routes, Route, Navigate, Outlet } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider, useAuth } from "@/lib/auth";
import { AgentsList } from "@/pages/agents/list";
import { AgentNew } from "@/pages/agents/new";
import { AgentDetail } from "@/pages/agents/detail";
import { AgentEdit } from "@/pages/agents/edit";
import { ToolsList } from "@/pages/tools/list";
import { ToolNew } from "@/pages/tools/new";
import { ToolEdit } from "@/pages/tools/edit";
import { KnowledgeList } from "@/pages/knowledge/list";
import { KnowledgeNew } from "@/pages/knowledge/new";
import { KnowledgeDetail } from "@/pages/knowledge/detail";
import { Login } from "@/pages/login";
import { Signup } from "@/pages/signup";
import { Sidebar } from "@/components/sidebar";

// 默认查询策略：失败重试 1 次、30s 内不重复拉取、窗口聚焦不自动刷新
const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30_000, refetchOnWindowFocus: false },
  },
});

// 路由守卫：加载完成后若无登录态则跳转登录页
function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex items-center justify-center h-screen">加载中...</div>;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

// 登录后主布局：左侧栏 + 内容区
function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen">
      <Sidebar />
      <main className="flex-1 overflow-auto p-6">{children}</main>
    </div>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route element={<AuthGuard><AppLayout><Outlet /></AppLayout></AuthGuard>}>
              <Route path="/" element={<Navigate to="/agents" replace />} />
              <Route path="/agents" element={<AgentsList />} />
              <Route path="/agents/new" element={<AgentNew />} />
              <Route path="/agents/:id" element={<AgentDetail />} />
              <Route path="/agents/:id/edit" element={<AgentEdit />} />
              <Route path="/tools" element={<ToolsList />} />
              <Route path="/tools/new" element={<ToolNew />} />
              <Route path="/tools/:id/edit" element={<ToolEdit />} />
              <Route path="/knowledge" element={<KnowledgeList />} />
              <Route path="/knowledge/new" element={<KnowledgeNew />} />
              <Route path="/knowledge/:id" element={<KnowledgeDetail />} />
            </Route>
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
