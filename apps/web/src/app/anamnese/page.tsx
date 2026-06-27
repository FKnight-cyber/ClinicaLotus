import { AppShell } from "@/components/shell/AppShell";
import { AnamneseListPage } from "@/features/anamnese/AnamneseListPage";

export default function AnamnesePage() {
  return (
    <AppShell activeSlug="anamnese">
      <AnamneseListPage />
    </AppShell>
  );
}