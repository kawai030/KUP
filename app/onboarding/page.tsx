import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/workspace/auth";
import { OnboardingClient } from "@/components/workspace/OnboardingClient";

export default async function OnboardingPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/");
  return (
    <div className="bg-paper text-ink font-sans min-h-screen">
      <OnboardingClient initial={user.survey ?? null} />
    </div>
  );
}
