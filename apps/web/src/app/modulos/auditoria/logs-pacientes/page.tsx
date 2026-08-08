import { AppShell } from "@/components/shell/AppShell";
import { AccessAuditLogsPage, patientAuditConfig } from "@/features/audit/AccessAuditLogsPage";

export default function AuditPatientLogsRoute() {
  return (
    <AppShell activeSlug="auditoria">
      <AccessAuditLogsPage config={patientAuditConfig} />
    </AppShell>
  );
}
