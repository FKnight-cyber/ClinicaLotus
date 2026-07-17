import { AppShell } from "@/components/shell/AppShell";
import { AccessAuditLogsPage } from "@/features/audit/AccessAuditLogsPage";

export default function AuditAccessLogsRoute() {
  return (
    <AppShell activeSlug="auditoria">
      <AccessAuditLogsPage />
    </AppShell>
  );
}