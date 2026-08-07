"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
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
  activeClinicId?: string | null;
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
  activeClinic?: AuthClinic | null;
};

type StoredSession = LoginResponse;

type AuthContextValue = {
  status: "loading" | "authenticated" | "anonymous";
  token: string | null;
  user: AuthUser | null;
  clinics: AuthClinic[];
  activeClinic: AuthClinic | null;
  login: (login: string, password: string) => Promise<void>;
  logout: () => void;
  refreshProfile: () => Promise<AuthUser | null>;
  switchActiveClinic: (clinicId: string) => Promise<void>;
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
    throw new Error(payload?.message ?? "Não foi possível concluir a operação.");
  }

  return response.json() as Promise<T>;
}

export function AuthProvider({ children }: Readonly<{ children: React.ReactNode }>) {
  const [status, setStatus] = useState<AuthContextValue["status"]>("loading");
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [clinics, setClinics] = useState<AuthClinic[]>([]);
  const [activeClinic, setActiveClinic] = useState<AuthClinic | null>(null);
  const router = useRouter();

  const clearSession = () => {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    setToken(null);
    setUser(null);
    setClinics([]);
    setActiveClinic(null);
    setStatus("anonymous");
  };

  const persistSession = (accessToken: string, nextUser: AuthUser, nextClinics: AuthClinic[] = [], nextActiveClinic: AuthClinic | null = null) => {
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({ accessToken, user: nextUser, clinics: nextClinics, activeClinic: nextActiveClinic }));
    setToken(accessToken);
    setUser(nextUser);
    setClinics(nextClinics);
    setActiveClinic(nextActiveClinic);
    setStatus("authenticated");
  };

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
    setActiveClinic(parsedSession.activeClinic ?? null);

    requestJson<AuthUser & { clinics?: AuthClinic[]; activeClinic?: AuthClinic | null }>("/api/auth/me", {
      headers: { Authorization: `Bearer ${parsedSession.accessToken}` }
    })
      .then((profile) => {
        persistSession(parsedSession.accessToken, profile, profile.clinics ?? [], profile.activeClinic ?? null);
      })
      .catch(() => clearSession());
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    status,
    token,
    user,
    clinics,
    activeClinic,
    login: async (login, password) => {
      const session = await requestJson<LoginResponse>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ login, password })
      });
      persistSession(session.accessToken, session.user, session.clinics ?? [], session.activeClinic ?? null);
      router.replace(getDefaultModuleHrefForPermissions(session.user.permissions));
    },
    logout: () => {
      clearSession();
      router.replace("/login");
    },
    refreshProfile: async () => {
      if (!token) return null;
      const profile = await requestJson<AuthUser & { clinics?: AuthClinic[]; activeClinic?: AuthClinic | null }>("/api/auth/me", {
        headers: { Authorization: `Bearer ${token}` }
      });
      persistSession(token, profile, profile.clinics ?? [], profile.activeClinic ?? null);
      return profile;
    },
    switchActiveClinic: async (clinicId) => {
      if (!token) return;
      const session = await requestJson<LoginResponse>("/api/auth/active-clinic", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify({ clinicId })
      });
      persistSession(session.accessToken, session.user, session.clinics ?? [], session.activeClinic ?? null);
      window.dispatchEvent(new CustomEvent("clinica:active-clinic-changed", { detail: { clinicId } }));
      router.refresh();
    },
    hasPermission: (permission) => user?.permissions.includes(permission) ?? false
  }), [activeClinic, clinics, router, status, token, user]);

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