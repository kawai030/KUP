"use client";

import { useState } from "react";

/** FAQ — 카테고리 탭 + 아코디언. */
const CATS = [
  { key: "login", label: "계정·로그인" },
  { key: "join", label: "회원가입" },
  { key: "use", label: "서비스 이용" },
] as const;

const FAQS: Record<string, [string, string][]> = {
  login: [
    ["로그인이 안 돼요.", "비밀번호를 5회 이상 틀리면 일시적으로 제한될 수 있어요. 잠시 후 다시 시도하거나 비밀번호를 재설정해 주세요."],
    ["구글 로그인은 어떻게 하나요?", "로그인 화면에서 “Google 계정으로 로그인”을 누르면 인증창이 열려요. 비밀번호는 따로 입력하지 않아요."],
    ["비회원으로도 써볼 수 있나요?", "네, 비회원으로 주요 화면을 둘러볼 수 있어요. 콘텐츠 발행은 계정 연동 후 가능해요."],
  ],
  join: [
    ["이메일 인증 메일이 안 와요.", "스팸함을 확인해 주세요. 그래도 없으면 인증 메일 다시 보내기를 눌러 재발송할 수 있어요."],
    ["닉네임에 제한이 있나요?", "닉네임은 10자 이내로, 이미 사용 중인 닉네임은 등록할 수 없어요."],
    ["인스타 연동은 꼭 해야 하나요?", "가입은 연동 없이 가능하지만, 콘텐츠 발행·성과 분석은 인스타 계정 연동 후 이용할 수 있어요."],
  ],
  use: [
    ["AI가 만든 콘텐츠는 바로 올라가나요?", "아니요. 발행 전 반드시 사용자 승인을 거쳐요. 검수 후 직접 승인해야 발행됩니다."],
    ["DM 리드마그넷은 몇 건까지 되나요?", "베이직 100건, 프로 1,000건, 프리미엄 무제한이에요."],
    ["콘텐츠 성과는 언제 갱신되나요?", "인사이트 수치는 매일 오전 4시에 안정적으로 업데이트되고, 새로고침으로 최신값을 불러올 수 있어요."],
  ],
};

export function Faq() {
  const [cat, setCat] = useState<string>("login");
  const [open, setOpen] = useState<number | null>(0);
  const items = FAQS[cat] ?? [];

  return (
    <>
      <div className="faq-tabs">
        {CATS.map((c) => (
          <button
            key={c.key}
            onClick={() => {
              setCat(c.key);
              setOpen(0);
            }}
            className={`btn btn-sm ${cat === c.key ? "btn-primary" : "btn-line"}`}
          >
            {c.label}
          </button>
        ))}
      </div>

      <div className="faq-list">
        {items.map(([q, a], i) => (
          <div key={q} className="faq-item">
            <button className="faq-q" aria-expanded={open === i} onClick={() => setOpen(open === i ? null : i)}>
              {q}
              <svg className="caret" width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            {open === i && <p className="faq-a">{a}</p>}
          </div>
        ))}
      </div>
    </>
  );
}
