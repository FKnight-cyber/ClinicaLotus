"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { getDefaultModuleHrefForPermissions } from "@/config/modules";

type AuthUser = {
  id: string;
  login: string;
  name: string;
  email?: string | null;
  userType?: "MANAGER" | "PATIENT" | "NURSE" | "DOCTOR";
  professionalArea?: string | null;
  professionalCouncil?: string | null;
  professionalRegistration?: string | null;
  professionalCouncilState?: string | null;
  professionalSpecialty?: string | null;
  mustChangePassword?: boolean;
  permissions: string[];
};

type AuthClinic = {
  id: string;
  name: string;
  code?: string | null;
  status: "ACTIVE" | "INACTIVE";
  isDefault?: boolean;
};

type LoginResponse = {
  accessToken: string;
  user: AuthUser;
  clinics?: AuthClinic[];
};

type StoredSession = LoginResponse;

type AuthContextValue = {
  status: "loading" | "authenticated" | "anonymous";
  token: string | null;
  user: AuthUser | null;
  clinics: AuthClinic[];
  login: (login: string, password: string) => Promise<void>;
  logout: () => void;
  refreshProfile: () => Promise<(AuthUser & { clinics?: AuthClinic[] }) | null>;
  hasPermission: (permission: string) => boolean;
};

const AUTH_STORAGE_KEY = "clinica.auth";
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3333";
const PROFILE_REFRESH_INTERVAL_MS = 15 * 1000;

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
    const error = new Error(payload?.message ?? "Não foi possível concluir a operação.") as Error & { status?: number };
    error.status = response.status;
    throw error;
  }

  return response.json() as Promise<T>;
}

export function AuthProvider({ children }: Readonly<{ children: React.ReactNode }>) {
  const [status, setStatus] = useState<AuthContextValue["status"]>("loading");
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [clinics, setClinics] = useState<AuthClinic[]>([]);
  const router = useRouter();

  const clearSession = useCallback(() => {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    setToken(null);
    setUser(null);
    setClinics([]);
    setStatus("anonymous");
  }, []);

  const persistSession = useCallback((accessToken: string, nextUser: AuthUser, nextClinics: AuthClinic[] = []) => {
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({ accessToken, user: nextUser, clinics: nextClinics }));
    setToken(accessToken);
    setUser(nextUser);
    setClinics(nextClinics);
    setStatus("authenticated");
  }, []);

  useEffect(() => {
    const storedSession = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!storedSession) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setStatus("anonymous");
      return;
    }

    const parsedSession = JSON.parse(storedSession) as StoredSession;
    setToken(parsedSession.accessToken);
    setUser(parsedSession.user);
    setClinics(parsedSession.clinics ?? []);

    requestJson<AuthUser & { clinics?: AuthClinic[] }>("/api/auth/me", {
      headers: { Authorization: `Bearer ${parsedSession.accessToken}` }
    })
      .then((profile) => {
        persistSession(parsedSession.accessToken, profile, profile.clinics ?? []);
      })
      .catch(() => clearSession());
  }, [clearSession, persistSession]);

  useEffect(() => {
    if (status !== "authenticated" || !token) return;
    let isCurrent = true;

    const syncProfile = () => {
      requestJson<AuthUser & { clinics?: AuthClinic[] }>("/api/auth/me", {
        headers: { Authorization: `Bearer ${token}` }
      })
        .then((profile) => {
          if (!isCurrent) return;
          persistSession(token, profile, profile.clinics ?? []);
        })
        .catch((error) => {
          if (!isCurrent) return;
          if ((error as { status?: number }).status === 401) {
            clearSession();
          }
        });
    };

    const handleWindowFocus = () => {
      void syncProfile();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void syncProfile();
      }
    };

    const intervalId = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void syncProfile();
      }
    }, PROFILE_REFRESH_INTERVAL_MS);

    window.addEventListener("focus", handleWindowFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      isCurrent = false;
      window.clearInterval(intervalId);
      window.removeEventListener("focus", handleWindowFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [clearSession, persistSession, status, token]);

  const value = useMemo<AuthContextValue>(() => ({
    status,
    token,
    user,
    clinics,
    login: async (login, password) => {
      const session = await requestJson<LoginResponse>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ login, password })
      });
      persistSession(session.accessToken, session.user, session.clinics ?? []);
      router.replace(getDefaultModuleHrefForPermissions(session.user.permissions));
    },
    logout: () => {
      clearSession();
      router.replace("/login");
    },
    refreshProfile: async () => {
      if (!token) return null;
      const profile = await requestJson<AuthUser & { clinics?: AuthClinic[] }>("/api/auth/me", {
        headers: { Authorization: `Bearer ${token}` }
      });
      persistSession(token, profile, profile.clinics ?? []);
      return profile;
    },
    hasPermission: (permission) => user?.permissions.includes(permission) ?? false
  }), [clearSession, clinics, persistSession, router, status, token, user]);

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
    return <div className="loading-panel auth-loading">Carregando sessão...</div>;
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