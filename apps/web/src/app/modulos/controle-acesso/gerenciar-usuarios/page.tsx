import { AppShell } from "@/components/shell/AppShell";
import { AccessUsersAdminPage } from "@/features/access/AccessAdminPage";

export default function AccessUsersRoute() {
  return (
    <AppShell activeSlug="controle-acesso">
      <AccessUsersAdminPage />
    </AppShell>
  );
}