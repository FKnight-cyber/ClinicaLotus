import { notFound, redirect } from "next/navigation";
import { AppShell } from "@/components/shell/AppShell";
import { PlaceholderModule } from "@/components/placeholder/PlaceholderModule";
import { getModuleBySlug } from "@/config/modules";
import { PacientesPage } from "@/features/pacientes/PacientesPage";
import { ProntuarioPage } from "@/features/prontuario/ProntuarioPage";

type PlaceholderPageProps = {
  params: Promise<{ slug: string }>;
};

export default async function PlaceholderPage({ params }: PlaceholderPageProps) {
  const { slug } = await params;
  const moduleItem = getModuleBySlug(slug);

  if (!moduleItem || moduleItem.slug === "anamnese") {
    notFound();
  }

  if (moduleItem.slug === "controle-acesso") {
    redirect("/modulos/controle-acesso/grupos-e-acessos");
  }

  if (moduleItem.slug === "auditoria") {
    redirect("/modulos/auditoria/logs-controle-acessos");
  }

  if (moduleItem.slug === "prontuario") {
    return (
      <AppShell activeSlug={moduleItem.slug}>
        <ProntuarioPage />
      </AppShell>
    );
  }

  if (moduleItem.slug === "pacientes") {
    return (
      <AppShell activeSlug={moduleItem.slug}>
        <PacientesPage />
      </AppShell>
    );
  }

  return (
    <AppShell activeSlug={moduleItem.slug}>
      <PlaceholderModule module={moduleItem} />
    </AppShell>
  );
}