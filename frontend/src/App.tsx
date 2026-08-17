import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate, Outlet } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider, useAuth } from "@/lib/auth";
import { Sidebar } from "@/components/sidebar";

// 路由懒加载：每个页面独立 chunk，按需下载
const Landing = lazy(() => import("@/pages/landing").then((m) => ({ default: m.Landing })));
const Login = lazy(() => import("@/pages/login").then((m) => ({ default: m.Login })));
const Signup = lazy(() => import("@/pages/signup").then((m) => ({ default: m.Signup })));
const AgentsList = lazy(() => import("@/pages/agents/list").then((m) => ({ default: m.AgentsList })));
const AgentNew = lazy(() => import("@/pages/agents/new").then((m) => ({ default: m.AgentNew })));
const AgentDetail = lazy(() => import("@/pages/agents/detail").then((m) => ({ default: m.AgentDetail })));
const AgentEdit = lazy(() => import("@/pages/agents/edit").then((m) => ({ default: m.AgentEdit })));
const ToolsList = lazy(() => import("@/pages/tools/list").then((m) => ({ default: m.ToolsList })));
const ToolNew = lazy(() => import("@/pages/tools/new").then((m) => ({ default: m.ToolNew })));
const ToolEdit = lazy(() => import("@/pages/tools/edit").then((m) => ({ default: m.ToolEdit })));
const KnowledgeList = lazy(() => import("@/pages/knowledge/list").then((m) => ({ default: m.KnowledgeList })));
const KnowledgeNew = lazy(() => import("@/pages/knowledge/new").then((m) => ({ default: m.KnowledgeNew })));
const KnowledgeDetail = lazy(() => import("@/pages/knowledge/detail").then((m) => ({ default: m.KnowledgeDetail })));

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

// 落地页守卫：仅未登录用户可见，已登录用户访问跳转应用主页
function GuestOnly({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <PageLoading />;
  if (user) return <Navigate to="/agents" replace />;
  return <>{children}</>;
}

// 页面懒加载占位：路由 chunk 下载期间的加载态
function PageLoading() {
  return <div className="flex items-center justify-center h-screen text-neutral-500">加载中...</div>;
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
          <Suspense fallback={<PageLoading />}>
            <Routes>
              <Route path="/" element={<GuestOnly><Landing /></GuestOnly>} />
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<Signup />} />
              <Route element={<AuthGuard><AppLayout><Outlet /></AppLayout></AuthGuard>}>
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
          </Suspense>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
