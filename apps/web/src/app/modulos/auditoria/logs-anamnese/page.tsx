import { AppShell } from "@/components/shell/AppShell";
import { AccessAuditLogsPage, anamnesisAuditConfig } from "@/features/audit/AccessAuditLogsPage";

export default function AuditAnamnesisLogsRoute() {
  return (
    <AppShell activeSlug="auditoria">
      <AccessAuditLogsPage config={anamnesisAuditConfig} />
    </AppShell>
  );
}