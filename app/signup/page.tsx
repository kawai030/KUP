"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/workspace/client";
import { signInWithGoogle } from "@/app/(marketing)/_components/auth-actions";
import { Button, Field, inputClass } from "@/components/workspace/ui";
import { AuthShell } from "@/components/workspace/AuthShell";

const PW_RE = /^(?=.*[A-Za-z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,16}$/;

export default function SignupPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [agree, setAgree] = useState({ terms: false, privacy: false, meta: false, marketing: false });
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  const allRequired = agree.terms && agree.privacy && agree.meta;
  const allChecked = allRequired && agree.marketing;

  function toggleAll() {
    const v = !allChecked;
    setAgree({ terms: v, privacy: v, meta: v, marketing: v });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    if (!name.trim() || name.trim().length > 10) return setErr("닉네임은 10자 이내로 입력하세요.");
    if (!PW_RE.test(password)) return setErr("비밀번호는 영문·숫자·특수문자 포함 8~16자여야 합니다.");
    if (password !== password2) return setErr("비밀번호 확인이 일치하지 않아요.");
    if (!allRequired) return setErr("필수 약관에 모두 동의해야 가입할 수 있어요.");
    setLoading(true);
    try {
      await api("/api/auth/signup", {
        method: "POST",
        body: {
          name,
          email,
          password,
          agreeTerms: agree.terms,
          agreePrivacy: agree.privacy,
          agreeMeta: agree.meta,
          marketingConsent: agree.marketing,
        },
      });
      router.push("/app/home");
      router.refresh();
    } catch (e) {
      setErr((e as Error).message);
      setLoading(false);
    }
  }

  const Check = ({ k, label, required }: { k: keyof typeof agree; label: string; required?: boolean }) => (
    <label className="flex items-center gap-2.5 text-sm cursor-pointer">
      <input
        type="checkbox"
        checked={agree[k]}
        onChange={(e) => setAgree((a) => ({ ...a, [k]: e.target.checked }))}
        className="w-4 h-4 accent-[#e52364]"
      />
      <span className={required ? "text-ink" : "text-ink-soft"}>
        <span className={required ? "text-coral" : "text-muted"}>[{required ? "필수" : "선택"}]</span> {label}
      </span>
    </label>
  );

  return (
    <AuthShell title="무료로 시작하기" sub="가입하고 설문 한 번이면 첫 전략까지.">
      <form onSubmit={submit} className="space-y-4">
        <Field label="닉네임" hint="10자 이내">
          <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} placeholder="지우" required />
        </Field>
        <Field label="이메일">
          <input className={inputClass} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required />
        </Field>
        <Field label="비밀번호" hint="영문·숫자·특수문자 8~16자">
          <input className={inputClass} type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required />
        </Field>
        <Field label="비밀번호 확인">
          <input className={inputClass} type="password" value={password2} onChange={(e) => setPassword2(e.target.value)} placeholder="••••••••" required />
        </Field>

        <div className="rounded-xl border border-line p-3.5 space-y-2.5">
          <label className="flex items-center gap-2.5 text-sm font-medium cursor-pointer pb-2 border-b border-line">
            <input type="checkbox" checked={allChecked} onChange={toggleAll} className="w-4 h-4 accent-[#e52364]" />
            전체 동의 (필수 + 선택)
          </label>
          <Check k="terms" label="서비스 이용약관 동의" required />
          <Check k="privacy" label="개인정보 수집·이용 동의" required />
          <Check k="meta" label="Meta 연동/법적 내용 확인" required />
          <Check k="marketing" label="이벤트 혜택 및 광고성 정보 수신" />
        </div>

        {err && <p className="text-sm text-coral">{err}</p>}
        <Button type="submit" size="lg" className="w-full" disabled={loading}>
          {loading ? "가입 중…" : "이메일로 가입"}
        </Button>
      </form>

      <div className="flex items-center gap-3 my-5">
        <div className="flex-1 h-px bg-line" />
        <span className="text-xs text-muted">또는</span>
        <div className="flex-1 h-px bg-line" />
      </div>
      <form action={signInWithGoogle}>
        <Button type="submit" variant="outline" size="lg" className="w-full" disabled={loading}>
          <span className="font-bold text-[#4285F4]">G</span> 구글로 가입
        </Button>
      </form>

      <p className="text-sm text-ink-soft mt-5 text-center">
        이미 계정이 있나요?{" "}
        <Link href="/?auth=1" className="text-coral font-medium">
          로그인
        </Link>
      </p>
    </AuthShell>
  );
}
