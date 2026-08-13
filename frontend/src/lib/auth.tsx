/* oxlint-disable react/only-export-components -- AuthProvider 与 useAuth 需同文件共享 Context */
import { createContext, useContext, useEffect, useState } from "react";
import { api } from "./api";

interface User { id: string; name: string | null; }

interface AuthCtx {
  user: User | null; loading: boolean;
  // 注册开关：null 表示尚未加载完成
  allowSignup: boolean | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, name: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthCtx>(null!);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [allowSignup, setAllowSignup] = useState<boolean | null>(null);

  // 应用启动时尝试用 refresh token 恢复登录态，并读取注册开关配置
  useEffect(() => {
    api.refresh().then((data) => {
      if (data?.user) setUser({ id: data.user.id, name: data.user.name });
    }).finally(() => setLoading(false));
    api.getAuthConfig().then((data) => setAllowSignup(data.allowSignup)).catch(() => {});
  }, []);

  const signIn = async (email: string, password: string) => {
    const res = await api.signIn({ email, password });
    if (res?.user) setUser({ id: res.user.id, name: res.user.name });
  };

  const signUp = async (email: string, password: string, name: string) => {
    const res = await api.signUp({ email, password, name });
    if (res?.user) setUser({ id: res.user.id, name: res.user.name });
  };

  const signOut = async () => {
    await api.signOut();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, allowSignup, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() { return useContext(AuthContext); }
