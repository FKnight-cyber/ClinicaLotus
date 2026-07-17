import { AppShell } from "@/components/shell/AppShell";
import { AccessGroupsPage } from "@/features/access/AccessAdminPage";

export default function AccessGroupsRoute() {
  return (
    <AppShell activeSlug="controle-acesso">
      <AccessGroupsPage />
    </AppShell>
  );
}