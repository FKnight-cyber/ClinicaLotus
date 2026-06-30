import { AppShell } from "@/components/shell/AppShell";
import { UserDetailPage } from "@/features/users/UserDetailPage";

export const runtime = "edge";

type UserPageProps = {
  params: Promise<{ userId: string }>;
};

export default async function UserPage({ params }: UserPageProps) {
  const { userId } = await params;

  return (
    <AppShell activeSlug="controle-acesso">
      <UserDetailPage userId={userId} />
    </AppShell>
  );
}