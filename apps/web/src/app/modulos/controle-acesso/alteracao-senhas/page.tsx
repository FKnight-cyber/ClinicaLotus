import { AppShell } from "@/components/shell/AppShell";
import { PasswordChangeRequestsPage } from "@/features/access/AccessAdminPage";

export default function PasswordChangeRequestsRoute() {
  return (
    <AppShell activeSlug="controle-acesso">
      <PasswordChangeRequestsPage />
    </AppShell>
  );
}