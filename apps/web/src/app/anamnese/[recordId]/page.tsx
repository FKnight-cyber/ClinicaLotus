import { AppShell } from "@/components/shell/AppShell";
import { AnamneseWorkspace } from "@/features/anamnese/AnamneseWorkspace";

export const runtime = "edge";

type AnamneseDetailPageProps = {
  params: Promise<{ recordId: string }>;
};

export default async function AnamneseDetailPage({ params }: AnamneseDetailPageProps) {
  const { recordId } = await params;

  return (
    <AppShell activeSlug="anamnese">
      <AnamneseWorkspace recordId={recordId} />
    </AppShell>
  );
}