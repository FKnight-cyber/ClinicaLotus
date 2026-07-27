import { AppShell } from "@/components/shell/AppShell";
import { PatientDetailPage } from "@/features/pacientes/PatientDetailPage";

type PatientDetailRouteProps = {
  params: Promise<{ patientId: string }>;
};

export default async function PatientDetailRoute({ params }: PatientDetailRouteProps) {
  const { patientId } = await params;

  return (
    <AppShell activeSlug="pacientes">
      <PatientDetailPage patientId={patientId} />
    </AppShell>
  );
}