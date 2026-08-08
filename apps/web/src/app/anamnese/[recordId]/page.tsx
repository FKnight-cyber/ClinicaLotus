import { AppShell } from "@/components/shell/AppShell";
import { AnamneseWorkspace } from "@/features/anamnese/AnamneseWorkspace";

type AnamneseDetailPageProps = {
  params: Promise<{ recordId: string }>;
  searchParams: Promise<{ clinicId?: string }>;
};

export default async function AnamneseDetailPage({ params, searchParams }: AnamneseDetailPageProps) {
  const { recordId } = await params;
  const { clinicId } = await searchParams;

  return (
    <AppShell activeSlug="anamnese">
      <AnamneseWorkspace clinicId={clinicId} recordId={recordId} />
    </AppShell>
  );
}