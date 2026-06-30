"use client";

import Link from "next/link";
import { LogOut } from "lucide-react";
import { ClinicLogo } from "@/components/brand/ClinicLogo";
import { moduleItems } from "@/config/modules";
import { useAuth } from "@/features/auth/AuthProvider";

type AppShellProps = {
  activeSlug: string;
  children: React.ReactNode;
};

export function AppShell({ activeSlug, children }: AppShellProps) {
  const { hasPermission, logout, user } = useAuth();
  const visibleModules = moduleItems.filter((module) => module.slug === "anamnese" || hasPermission(module.visibilityPermission));

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
          {visibleModules.map((module) => {
            const Icon = module.icon;
            const isActive = module.slug === activeSlug;
            return (
              <Link
                className={`module-link ${isActive ? "is-active" : ""} ${module.status === "locked" ? "is-locked" : ""}`}
                href={module.href}
                key={module.slug}
                title={module.status === "locked" ? "Em desenvolvimento" : module.description}
              >
                <Icon aria-hidden="true" size={19} />
                <span>{module.label}</span>
              </Link>
            );
          })}
        </nav>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div>
            <span className="eyebrow">Sistema clínico</span>
            <h1>Anamnese clínica</h1>
          </div>
          <div className="operator-actions">
            <Link className="operator-chip" href={user ? `/usuarios/${user.id}` : "/login"} title="Abrir detalhes do usuário">
              {user?.name ?? "Profissional logado"}
            </Link>
            <button className="icon-button" onClick={logout} title="Sair" type="button">
              <LogOut aria-hidden="true" size={18} />
            </button>
          </div>
        </header>

        {children}
      </main>
    </div>
  );
}