import { AppShell } from "@/components/shell/AppShell";
import { AccessAuditLogsPage, medicalEvolutionAuditConfig } from "@/features/audit/AccessAuditLogsPage";

export default function AuditMedicalEvolutionLogsRoute() {
  return (
    <AppShell activeSlug="auditoria">
      <AccessAuditLogsPage config={medicalEvolutionAuditConfig} />
    </AppShell>
  );
}