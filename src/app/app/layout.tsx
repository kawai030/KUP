import { redirect } from "next/navigation";
import { getCurrentUser, toPublicUser } from "@/lib/auth";
import { aiAvailable } from "@/lib/ai";
import { WorkspaceShell } from "@/components/WorkspaceShell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!user.survey) redirect("/onboarding");
  return (
    <WorkspaceShell user={toPublicUser(user)} aiAvailable={aiAvailable()}>
      {children}
    </WorkspaceShell>
  );
}
