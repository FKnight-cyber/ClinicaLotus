import { AppShell } from "@/components/shell/AppShell";
import { UserClinicAssignmentsPage } from "@/features/access/UserClinicAssignmentsPage";

export default function UserClinicAssignmentsRoute() {
  return (
    <AppShell activeSlug="controle-acesso">
      <UserClinicAssignmentsPage />
    </AppShell>
  );
}