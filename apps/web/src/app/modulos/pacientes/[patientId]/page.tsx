import { AppShell } from "@/components/shell/AppShell";
import { PatientDetailPage } from "@/features/pacientes/PatientDetailPage";

type PatientDetailRouteProps = {
  params: Promise<{ patientId: string }>;
  searchParams: Promise<{ clinicId?: string }>;
};

export default async function PatientDetailRoute({ params, searchParams }: PatientDetailRouteProps) {
  const { patientId } = await params;
  const { clinicId } = await searchParams;

  return (
    <AppShell activeSlug="pacientes">
      <PatientDetailPage clinicId={clinicId} patientId={patientId} />
    </AppShell>
  );
}