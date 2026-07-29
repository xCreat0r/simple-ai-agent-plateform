import { createContext, useContext, useEffect, useState } from "react";
import { api } from "./api";

interface User { id: string; name: string | null; }

interface AuthCtx {
  user: User | null; loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, name: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthCtx>(null!);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.refresh().then((data) => {
      if (data?.user) setUser({ id: data.user.id, name: data.user.name });
    }).finally(() => setLoading(false));
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
    <AuthContext.Provider value={{ user, loading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() { return useContext(AuthContext); }
