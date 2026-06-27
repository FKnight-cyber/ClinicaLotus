import type { ModuleItem } from "@/config/modules";

type PlaceholderModuleProps = {
  module: ModuleItem;
};

export function PlaceholderModule({ module }: PlaceholderModuleProps) {
  const Icon = module.icon;

  return (
    <section className="placeholder-page">
      <div className="page-intro">
        <div className="intro-icon" aria-hidden="true">
          <Icon size={28} />
        </div>
        <div>
          <span className="eyebrow">Estrutura inicial</span>
          <h2>{module.label}</h2>
          <p>{module.description}</p>
        </div>
      </div>

      <div className="placeholder-grid">
        <section className="plain-panel">
          <h3>Ações previstas</h3>
          <div className="disabled-actions">
            {module.actions.map((action) => (
              <button disabled key={action} title="Em desenvolvimento" type="button">
                {action}
              </button>
            ))}
          </div>
        </section>

        <section className="plain-panel">
          <h3>Status do módulo</h3>
          <p>
            Este módulo aparece no menu principal e possui layout base preparado, mas não possui regras de negócio nesta primeira entrega.
          </p>
          <button disabled title="Em desenvolvimento" type="button">
            Abrir fluxo completo
          </button>
        </section>
      </div>
    </section>
  );
}