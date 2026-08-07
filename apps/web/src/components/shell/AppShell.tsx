"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Building2, LogOut, UserCircle } from "lucide-react";
import { usePathname } from "next/navigation";
import { ClinicLogo } from "@/components/brand/ClinicLogo";
import { moduleItems } from "@/config/modules";
import { useAuth } from "@/features/auth/AuthProvider";

type AppShellProps = {
  activeSlug: string;
  children: React.ReactNode;
};

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3333";

const ShellTitleContext = createContext<((title: string | null) => void) | null>(null);

export function useShellTitle(title: string | null) {
  const setShellTitle = useContext(ShellTitleContext);

  useEffect(() => {
    setShellTitle?.(title);
    return () => setShellTitle?.(null);
  }, [setShellTitle, title]);
}

export function AppShell({ activeSlug, children }: AppShellProps) {
  const { activeClinic, clinics, hasPermission, logout, switchActiveClinic, token, user } = useAuth();
  const pathname = usePathname();
  const [customTitle, setCustomTitle] = useState<string | null>(null);
  const [pendingPasswordChangeRequests, setPendingPasswordChangeRequests] = useState<number | null>(null);
  const [isSwitchingClinic, setIsSwitchingClinic] = useState(false);
  const setShellTitle = useMemo(() => setCustomTitle, []);
  const visibleModules = moduleItems.filter((module) => hasPermission(module.visibilityPermission));
  const activeModule = moduleItems.find((module) => module.slug === activeSlug);
  const title = customTitle ?? activeModule?.label ?? "Sistema clínico";
  const canReadPasswordChangeRequests = hasPermission("access.password_changes.read");
  const canSwitchGlobalClinic = clinics.length > 1 && hasPermission("clinics.manage");
  const passwordChangeRequestsBadgeCount = token && canReadPasswordChangeRequests ? pendingPasswordChangeRequests : null;
  const currentClinic = activeClinic ?? (clinics.length === 1 ? clinics[0] : null);
  const activeClinicLabel = currentClinic ? `${currentClinic.name}${currentClinic.code ? ` (${currentClinic.code})` : ""}` : "Clínicas conforme permissões";

  const handleClinicChange = async (event: React.ChangeEvent<HTMLSelectElement>) => {
    const clinicId = event.target.value;
    if (!clinicId || clinicId === activeClinic?.id) return;

    setIsSwitchingClinic(true);
    try {
      await switchActiveClinic(clinicId);
    } finally {
      setIsSwitchingClinic(false);
    }
  };

  useEffect(() => {
    if (!token || !canReadPasswordChangeRequests) {
      return;
    }

    let isCurrent = true;

    const loadPendingPasswordChangeRequests = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/access/password-change-requests?limit=1&status=PENDING`, {
          headers: { Authorization: `Bearer ${token}` }
        });

        if (!response.ok) throw new Error("Não foi possível carregar os pedidos de alteração de senha.");
        const payload = await response.json() as { total?: number };
        if (isCurrent) setPendingPasswordChangeRequests(payload.total ?? 0);
      } catch {
        if (isCurrent) setPendingPasswordChangeRequests(null);
      }
    };

    void loadPendingPasswordChangeRequests();
    window.addEventListener("clinica:password-change-requests-updated", loadPendingPasswordChangeRequests);

    return () => {
      isCurrent = false;
      window.removeEventListener("clinica:password-change-requests-updated", loadPendingPasswordChangeRequests);
    };
  }, [canReadPasswordChangeRequests, token]);

  return (
    <div className="app-shell">
      <aside className="sidebar" aria-label="Menu principal">
        <div className="brand-block">
          <div className="brand-mark">
            <ClinicLogo />
          </div>
          <div>
            <strong>Flor de Lótus</strong>
            <span>Sistema clínico</span>
          </div>
        </div>

        <nav className="module-nav">
          <div className="module-nav-group">
            <Link
              className={`module-link ${pathname === "/meu-perfil" ? "is-active" : ""}`}
              href="/meu-perfil"
              title="Editar meus dados de acesso"
            >
              <UserCircle aria-hidden="true" size={19} />
              <span>Meu Perfil</span>
            </Link>
          </div>
          {visibleModules.map((module) => {
            const Icon = module.icon;
            const isActive = module.slug === activeSlug;
            const visibleSubItems = module.subItems?.filter((subItem) => hasPermission(subItem.visibilityPermission)) ?? [];
            return (
              <div className="module-nav-group" key={module.slug}>
                <Link
                  className={`module-link ${isActive ? "is-active" : ""} ${module.status === "locked" ? "is-locked" : ""}`}
                  href={module.href}
                  title={module.status === "locked" ? "Em desenvolvimento" : module.description}
                >
                  <Icon aria-hidden="true" size={19} />
                  <span>{module.label}</span>
                </Link>
                {visibleSubItems.length > 0 ? (
                  <div className="module-subnav" aria-label={`${module.label} submenu`}>
                    {visibleSubItems.map((subItem) => (
                      <Link className={`module-sublink ${pathname === subItem.href ? "is-active" : ""}`} href={subItem.href} key={subItem.slug}>
                        <span>{subItem.label}</span>
                        {subItem.slug === "alteracao-senhas" && passwordChangeRequestsBadgeCount !== null ? (
                          <span className="module-sublink-badge" title={`${passwordChangeRequestsBadgeCount} pedidos pendentes`}>
                            {passwordChangeRequestsBadgeCount}
                          </span>
                        ) : null}
                      </Link>
                    ))}
                  </div>
                ) : null}
              </div>
            );
          })}
        </nav>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div>
            <span className="eyebrow">Sistema clínico</span>
            <h1>{title}</h1>
          </div>
          <div className="operator-actions">
            {canSwitchGlobalClinic ? (
              <label className="clinic-switcher" title="Clínica ativa">
                <Building2 aria-hidden="true" size={18} />
                <select aria-label="Clínica ativa" disabled={isSwitchingClinic} onChange={handleClinicChange} value={activeClinic?.id ?? ""}>
                  {clinics.map((clinic) => (
                    <option key={clinic.id} value={clinic.id}>{clinic.name}{clinic.code ? ` (${clinic.code})` : ""}</option>
                  ))}
                </select>
              </label>
            ) : (
              <span className="clinic-context" title="Escopo de clínicas">
                <Building2 aria-hidden="true" size={18} />
                <span>{activeClinicLabel}</span>
              </span>
            )}
            <Link className="operator-chip" href="/meu-perfil" title="Abrir meu perfil">
              {user?.name ?? "Profissional logado"}
            </Link>
            <button className="icon-button" onClick={logout} title="Sair" type="button">
              <LogOut aria-hidden="true" size={18} />
            </button>
          </div>
        </header>

        <ShellTitleContext.Provider value={setShellTitle}>
          {children}
        </ShellTitleContext.Provider>
      </main>
    </div>
  );
}