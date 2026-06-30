"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/client";
import { Button, Field, inputClass } from "@/components/ui";
import { AuthShell } from "@/components/AuthShell";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  function go(user: { survey?: unknown }) {
    router.push(user.survey ? "/app/home" : "/onboarding");
    router.refresh();
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    setLoading(true);
    try {
      const { user } = await api<{ user: { survey?: unknown } }>("/api/auth/login", {
        method: "POST",
        body: { email, password },
      });
      go(user);
    } catch (e) {
      setErr((e as Error).message);
      setLoading(false);
    }
  }
  async function google() {
    setLoading(true);
    const { user } = await api<{ user: { survey?: unknown } }>("/api/auth/google", { method: "POST" });
    go(user);
  }
  async function guest() {
    setLoading(true);
    const { user } = await api<{ user: { survey?: unknown } }>("/api/auth/guest", { method: "POST" });
    go(user);
  }

  return (
    <AuthShell title="다시 만나서 반가워요" sub="로그인하고 이번 주 루틴을 이어가요.">
      <form onSubmit={submit} className="space-y-4">
        <Field label="이메일">
          <input className={inputClass} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required />
        </Field>
        <Field label="비밀번호">
          <input className={inputClass} type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••" required />
        </Field>
        {err && <p className="text-sm text-coral">{err}</p>}
        <Button type="submit" size="lg" className="w-full" disabled={loading}>
          {loading ? "확인 중…" : "로그인"}
        </Button>
      </form>

      <div className="flex items-center gap-3 my-5">
        <div className="flex-1 h-px bg-line" />
        <span className="text-xs text-muted">또는</span>
        <div className="flex-1 h-px bg-line" />
      </div>

      <div className="space-y-2">
        <Button variant="outline" size="lg" className="w-full" onClick={google} disabled={loading}>
          <span className="font-bold text-[#4285F4]">G</span> 구글로 계속하기
        </Button>
        <Button variant="ghost" size="lg" className="w-full" onClick={guest} disabled={loading}>
          비회원으로 둘러보기
        </Button>
      </div>

      <p className="text-sm text-ink-soft mt-5 text-center">
        아직 계정이 없나요?{" "}
        <Link href="/signup" className="text-coral font-medium">
          무료로 시작하기
        </Link>
      </p>
    </AuthShell>
  );
}
