"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/client";
import { Badge, Button, Card, SectionTitle } from "@/components/ui";
import { PricingPlans } from "@/components/PricingPlans";
import { Modal } from "@/components/WorkspaceShell";
import type { BillingCycle, Plan, PublicUser } from "@/lib/types";

export default function WorkspacePricingPage() {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [pending, setPending] = useState<{ plan: Plan; cycle: BillingCycle } | null>(null);
  const [done, setDone] = useState("");

  async function load() {
    const { user } = await api<{ user: PublicUser }>("/api/auth/me");
    setUser(user);
  }
  useEffect(() => {
    load();
  }, []);

  async function confirm() {
    if (!pending) return;
    const { user } = await api<{ user: PublicUser }>("/api/account", { method: "PATCH", body: { plan: pending.plan, billingCycle: pending.cycle } });
    setUser(user);
    setDone(`${pending.plan} 플랜으로 변경했어요.`);
    setPending(null);
  }

  if (!user) return <div className="py-20 text-center text-muted">불러오는 중…</div>;

  return (
    <div className="space-y-6">
      <SectionTitle eyebrow="구독" title="요금제" desc="베타 기간에는 전 기능을 무료로 이용할 수 있어요." />

      <Card className="p-5 flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="text-sm text-muted">현재 플랜</div>
          <div className="flex items-center gap-2 mt-1">
            <Badge tone="coral">{user.plan}</Badge>
            <span className="text-sm text-ink-soft">{user.billingCycle}간 결제</span>
          </div>
        </div>
        {done && <span className="text-sm text-teal">{done}</span>}
      </Card>

      <PricingPlans mode="workspace" currentPlan={user.plan} currentCycle={user.billingCycle} onSelect={(plan, cycle) => (plan === "베이직" ? confirmFree(plan, cycle) : setPending({ plan, cycle }))} />

      {/* 결제 팝업(스텁) */}
      {pending && (
        <Modal onClose={() => setPending(null)}>
          <h3 className="font-display text-xl mb-1">결제 정보</h3>
          <p className="text-sm text-ink-soft mb-4">{pending.plan} · {pending.cycle}간 결제</p>
          <div className="space-y-2 text-sm">
            <Row label="플랜" value={pending.plan} />
            <Row label="결제 주기" value={`${pending.cycle}간`} />
            <Row label="다음 결제일" value="베타 기간 무료" />
          </div>
          <div className="mt-4 rounded-xl bg-paper-2/60 p-3 text-xs text-muted">
            정식 결제는 PG사(포트원/토스페이먼츠) 연동 + 간편결제(카카오·네이버·토스)로 처리되며 카드번호는
            PG가 직접 수집(우리 미보관)합니다. 현재는 베타 — 즉시 적용돼요.
          </div>
          <div className="flex justify-end gap-2 mt-5">
            <Button variant="ghost" onClick={() => setPending(null)}>취소</Button>
            <Button onClick={confirm}>구독 시작</Button>
          </div>
        </Modal>
      )}
    </div>
  );

  async function confirmFree(plan: Plan, cycle: BillingCycle) {
    const { user } = await api<{ user: PublicUser }>("/api/account", { method: "PATCH", body: { plan, billingCycle: cycle } });
    setUser(user);
    setDone("베이직 플랜으로 변경했어요.");
  }
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted">{label}</span>
      <span className="text-ink font-medium">{value}</span>
    </div>
  );
}
