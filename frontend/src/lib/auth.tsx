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
    api.getSession().then((s) => {
      if (s?.user) setUser({ id: s.user.id, name: s.user.name });
    }).finally(() => setLoading(false));
  }, []);

  const signIn = async (email: string, password: string) => {
    const res = await api.signIn({ email, password }) as { user?: User };
    if (res?.user) setUser(res.user);
  };

  const signUp = async (email: string, password: string, name: string) => {
    const res = await api.signUp({ email, password, name }) as { user?: User };
    if (res?.user) setUser(res.user);
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
