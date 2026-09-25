import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { api, clearToken, getToken, setToken } from '../api/client';
import type { AuthResponse, User } from '../api/types';

interface AuthState {
  user: User | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  register: (name: string, username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const token = await getToken();
        if (token) {
          const me = await api.get<User>('/api/me');
          setUser(me);
        }
      } catch {
        await clearToken();
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    const res = await api.post<AuthResponse>('/api/auth/login', {
      username,
      password,
    });
    await setToken(res.token);
    setUser(res.user);
  }, []);

  const register = useCallback(
    async (name: string, username: string, password: string) => {
      const res = await api.post<AuthResponse>('/api/auth/register', {
        name,
        username,
        password,
      });
      await setToken(res.token);
      setUser(res.user);
    },
    [],
  );

  const logout = useCallback(async () => {
    await clearToken();
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, loading, login, register, logout }),
    [user, loading, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
