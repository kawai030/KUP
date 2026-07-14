import { redirect } from "next/navigation";
import { getCurrentUser, toPublicUser } from "@/lib/workspace/auth";
import { WorkspaceShell } from "@/components/workspace/WorkspaceShell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/"); // 미로그인 → 마케팅 정문(모달 로그인). 별도 로그인 화면 없음
  // 설문은 더 이상 강제하지 않는다 — 홈 우측 버튼/‘기획 추가’ 게이트로 유도.
  return (
    <div className="bg-paper text-ink font-sans min-h-screen">
      <WorkspaceShell user={toPublicUser(user)}>
        {children}
      </WorkspaceShell>
    </div>
  );
}
