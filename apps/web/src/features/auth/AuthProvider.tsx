"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

type AuthUser = {
  id: string;
  login: string;
  name: string;
  email?: string | null;
  mustChangePassword?: boolean;
  permissions: string[];
};

type LoginResponse = {
  accessToken: string;
  user: AuthUser;
};

type AuthContextValue = {
  status: "loading" | "authenticated" | "anonymous";
  token: string | null;
  user: AuthUser | null;
  login: (login: string, password: string) => Promise<void>;
  logout: () => void;
  refreshProfile: () => Promise<AuthUser | null>;
  hasPermission: (permission: string) => boolean;
};

const AUTH_STORAGE_KEY = "clinica.auth";
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3333";

const AuthContext = createContext<AuthContextValue | null>(null);

async function requestJson<T>(path: string, options: RequestInit = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers
    }
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.message ?? "Nao foi possivel concluir a operacao.");
  }

  return response.json() as Promise<T>;
}

export function AuthProvider({ children }: Readonly<{ children: React.ReactNode }>) {
  const [status, setStatus] = useState<AuthContextValue["status"]>("loading");
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const router = useRouter();

  const clearSession = () => {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    setToken(null);
    setUser(null);
    setStatus("anonymous");
  };

  const persistSession = (accessToken: string, nextUser: AuthUser) => {
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({ accessToken, user: nextUser }));
    setToken(accessToken);
    setUser(nextUser);
    setStatus("authenticated");
  };

  useEffect(() => {
    const storedSession = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!storedSession) {
      setStatus("anonymous");
      return;
    }

    const parsedSession = JSON.parse(storedSession) as LoginResponse;
    setToken(parsedSession.accessToken);
    setUser(parsedSession.user);

    requestJson<AuthUser>("/api/auth/me", {
      headers: { Authorization: `Bearer ${parsedSession.accessToken}` }
    })
      .then((profile) => {
        setUser(profile);
        setStatus("authenticated");
      })
      .catch(() => clearSession());
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    status,
    token,
    user,
    login: async (login, password) => {
      const session = await requestJson<LoginResponse>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ login, password })
      });
      persistSession(session.accessToken, session.user);
      router.replace("/anamnese");
    },
    logout: () => {
      clearSession();
      router.replace("/login");
    },
    refreshProfile: async () => {
      if (!token) return null;
      const profile = await requestJson<AuthUser>("/api/auth/me", {
        headers: { Authorization: `Bearer ${token}` }
      });
      persistSession(token, profile);
      return profile;
    },
    hasPermission: (permission) => user?.permissions.includes(permission) ?? false
  }), [router, status, token, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function AuthGate({ children }: Readonly<{ children: React.ReactNode }>) {
  const { status } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const isPublicPage = pathname === "/login" || pathname === "/cadastro";

  useEffect(() => {
    if (status === "anonymous" && !isPublicPage) {
      router.replace("/login");
    }
  }, [isPublicPage, router, status]);

  if (isPublicPage) {
    return children;
  }

  if (status !== "authenticated") {
    return <div className="loading-panel auth-loading">Carregando sessao...</div>;
  }

  return children;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth deve ser usado dentro de AuthProvider.");
  }

  return context;
}