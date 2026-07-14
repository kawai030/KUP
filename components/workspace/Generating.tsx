"use client";

import { useEffect, useState } from "react";

// 생성 대기용 로딩 UI — opus 생성이 10~20초 걸려도 "멈춘 게 아니라 작업 중"으로 보이게.
// 진행 메시지를 순환시키고, 예상 소요시간을 명시한다.

export function Generating({
  title,
  messages,
  estimate = "보통 10~20초쯤 걸려요",
}: {
  title: string;
  messages: string[];
  estimate?: string;
}) {
  const [i, setI] = useState(0);
  const [secs, setSecs] = useState(0);

  useEffect(() => {
    const m = setInterval(() => setI((x) => (x + 1) % messages.length), 2400);
    const s = setInterval(() => setSecs((x) => x + 1), 1000);
    return () => {
      clearInterval(m);
      clearInterval(s);
    };
  }, [messages.length]);

  return (
    <div className="py-14 text-center float-in">
      {/* 점 3개 펄스 */}
      <div className="flex items-center justify-center gap-2 mb-6">
        {[0, 1, 2].map((d) => (
          <span
            key={d}
            className="w-3 h-3 rounded-full bg-coral inline-block"
            style={{ animation: "pulseDot 1.2s ease-in-out infinite", animationDelay: `${d * 0.16}s` }}
          />
        ))}
      </div>
      <div className="font-display text-2xl text-ink">{title}</div>
      <div className="h-6 mt-2">
        <p key={i} className="text-ink-soft float-in">
          {messages[i]}
        </p>
      </div>
      {/* 진행 바 (불확정 — 천천히 채워졌다 반복) */}
      <div className="mx-auto mt-6 max-w-xs h-1.5 bg-paper-2 rounded-full overflow-hidden">
        <div
          className="h-full bg-coral rounded-full origin-left"
          style={{ animation: "barGrow 18s linear forwards" }}
        />
      </div>
      <p className="text-xs text-muted mt-3">
        {estimate} · {secs}초 경과 · 창을 닫지 말고 잠깐만요
      </p>
    </div>
  );
}
