"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { LogOut, UserCircle } from "lucide-react";
import { usePathname } from "next/navigation";
import { ClinicLogo } from "@/components/brand/ClinicLogo";
import { moduleItems } from "@/config/modules";
import { useAuth } from "@/features/auth/AuthProvider";

type AppShellProps = {
  activeSlug: string;
  children: React.ReactNode;
};

const ShellTitleContext = createContext<((title: string | null) => void) | null>(null);

export function useShellTitle(title: string | null) {
  const setShellTitle = useContext(ShellTitleContext);

  useEffect(() => {
    setShellTitle?.(title);
    return () => setShellTitle?.(null);
  }, [setShellTitle, title]);
}

export function AppShell({ activeSlug, children }: AppShellProps) {
  const { hasPermission, logout, user } = useAuth();
  const pathname = usePathname();
  const [customTitle, setCustomTitle] = useState<string | null>(null);
  const setShellTitle = useMemo(() => setCustomTitle, []);
  const visibleModules = moduleItems.filter((module) => hasPermission(module.visibilityPermission));
  const activeModule = moduleItems.find((module) => module.slug === activeSlug);
  const title = customTitle ?? activeModule?.label ?? "Sistema clínico";

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
                        {subItem.label}
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