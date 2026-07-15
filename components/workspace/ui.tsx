import Link from "next/link";
import type { ReactNode } from "react";
import { Icon } from "@/components/ui/icon";

// 공용 UI 프리미티브 (프레젠테이션 전용 — 클라/서버 양쪽에서 사용 가능)

export function Button({
  children,
  variant = "primary",
  size = "md",
  className = "",
  ...props
}: {
  children: ReactNode;
  variant?: "primary" | "ghost" | "outline" | "soft" | "danger";
  size?: "sm" | "md" | "lg";
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const base =
    "inline-flex items-center justify-center gap-2 font-medium rounded-full transition disabled:opacity-45 disabled:cursor-not-allowed select-none";
  const sizes = {
    sm: "text-sm px-3.5 py-1.5",
    md: "text-sm px-5 py-2.5",
    lg: "text-base px-6 py-3",
  };
  const variants = {
    primary: "bg-coral text-white hover:brightness-95",
    danger: "bg-coral text-white hover:brightness-95",
    soft: "bg-coral-soft text-coral hover:brightness-95",
    outline: "border border-line bg-card text-ink hover:bg-paper-2",
    ghost: "text-ink-soft hover:text-ink hover:bg-paper-2",
  };
  return (
    <button className={`${base} ${sizes[size]} ${variants[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
}

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`bg-card border border-line rounded-2xl ${className}`}>{children}</div>
  );
}

export function Badge({
  children,
  tone = "ink",
}: {
  children: ReactNode;
  tone?: "ink" | "coral" | "teal" | "amber" | "muted" | "rose";
}) {
  const tones = {
    ink: "bg-coral text-white",
    coral: "bg-coral-soft text-coral",
    teal: "bg-teal-soft text-teal",
    amber: "bg-amber-soft text-amber",
    muted: "bg-paper-2 text-muted",
    rose: "bg-rose-soft text-rose",
  };
  return (
    <span
      className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full whitespace-nowrap ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

// 라벨 옆 ⓘ 호버 툴팁 — 부가 설명을 인라인 텍스트 대신 툴팁으로.
export function Tip({ text }: { text: string }) {
  return (
    <span className="group relative inline-flex align-middle" title={text}>
      <span className="cursor-help inline-flex items-center justify-center text-muted">
        <Icon name="info" size={16} />
      </span>
      <span className="pointer-events-none absolute left-1/2 -translate-x-1/2 bottom-full mb-1.5 hidden group-hover:block w-max max-w-[220px] whitespace-normal text-left rounded-lg bg-ink text-paper text-xs font-normal px-2.5 py-1.5 shadow-lg z-30">
        {text}
      </span>
    </span>
  );
}

export function Field({
  label,
  hint,
  tip,
  children,
}: {
  label: string;
  hint?: string;
  tip?: string; // 설정 시 라벨 옆 ⓘ 툴팁으로 표시(인라인 hint 대신)
  children: ReactNode;
}) {
  return (
    <label className="block">
      <div className="flex items-baseline justify-between mb-1.5 gap-2">
        <span className="text-sm font-medium text-ink inline-flex items-center gap-1.5">
          {label}
          {tip && <Tip text={tip} />}
        </span>
        {hint && <span className="text-xs text-muted shrink-0">{hint}</span>}
      </div>
      {children}
    </label>
  );
}

export const inputClass =
  "w-full bg-card border border-line rounded-xl px-3.5 py-2.5 text-sm text-ink placeholder:text-muted focus:outline-none focus:border-ink/40 focus:ring-2 focus:ring-ink/5 transition";

export function SectionTitle({
  eyebrow,
  title,
  desc,
  action,
}: {
  eyebrow?: string;
  title: string;
  desc?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-end justify-between gap-4 mb-5">
      <div>
        {eyebrow && (
          <div className="text-xs font-semibold tracking-wide text-coral uppercase mb-1">
            {eyebrow}
          </div>
        )}
        <h2 className="font-display text-2xl text-ink">{title}</h2>
        {desc && <p className="text-sm text-ink-soft mt-1 max-w-2xl">{desc}</p>}
      </div>
      {action}
    </div>
  );
}

export function Logo({ size = "md", href = "/" }: { size?: "sm" | "md" | "lg"; href?: string }) {
  const cls = { sm: "text-lg", md: "text-xl", lg: "text-2xl" }[size];
  return (
    <Link href={href} className={`font-display ${cls} text-ink inline-flex items-center gap-1.5`}>
      <span className="inline-grid place-items-center w-6 h-6 rounded-md bg-coral text-white text-xs font-bold not-italic">
        K
      </span>
      <span className="font-semibold">KUP</span>
    </Link>
  );
}

export function EmptyState({
  title,
  desc,
  action,
  nowrapDesc = false, // 설명을 줄바꿈 없이 한 줄로(넓은 카드용)
}: {
  title: string;
  desc?: string;
  action?: ReactNode;
  nowrapDesc?: boolean;
}) {
  return (
    <div className="text-center py-14 px-6">
      <div className="mx-auto w-12 h-12 rounded-2xl bg-paper-2 grid place-items-center mb-3 text-muted">
        <Icon name="sparkle" size={22} />
      </div>
      <h3 className="font-display text-lg text-ink">{title}</h3>
      {desc && <p className={`text-sm text-ink-soft mt-1 ${nowrapDesc ? "whitespace-nowrap" : "max-w-sm mx-auto"}`}>{desc}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}
