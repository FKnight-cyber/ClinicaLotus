import { notFound } from "next/navigation";
import { AppShell } from "@/components/shell/AppShell";
import { PlaceholderModule } from "@/components/placeholder/PlaceholderModule";
import { getModuleBySlug } from "@/config/modules";
import { AccessAdminPage } from "@/features/access/AccessAdminPage";

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
    return (
      <AppShell activeSlug={moduleItem.slug}>
        <AccessAdminPage />
      </AppShell>
    );
  }

  return (
    <AppShell activeSlug={moduleItem.slug}>
      <PlaceholderModule module={moduleItem} />
    </AppShell>
  );
}