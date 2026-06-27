import Link from "next/link";
import { ClinicLogo } from "@/components/brand/ClinicLogo";
import { moduleItems } from "@/config/modules";

type AppShellProps = {
  activeSlug: string;
  children: React.ReactNode;
};

export function AppShell({ activeSlug, children }: AppShellProps) {
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
          {moduleItems.map((module) => {
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
          <div className="operator-chip">
            Profissional logado
          </div>
        </header>

        {children}
      </main>
    </div>
  );
}