// 카드 에디터 재설계 + 사진첨부 스모크 테스트 (API 흐름 + 에디터 렌더)
// 사용: 개발 서버(:3000) 실행 중에 `node scripts/smoke-editor.mjs`
const BASE = process.env.BASE || "http://localhost:3000";

let cookie = "";
async function call(pathname, opts = {}) {
  const res = await fetch(BASE + pathname, {
    ...opts,
    headers: { ...(opts.headers || {}), ...(cookie ? { cookie } : {}) },
    redirect: "manual",
  });
  const sc = res.headers.get("set-cookie");
  if (sc) cookie = sc.split(";")[0];
  return res;
}
async function jcall(pathname, method, body) {
  const res = await call(pathname, {
    method,
    headers: { "content-type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text; }
  return { status: res.status, data };
}

const ok = (c, m) => console.log(`${c ? "✓" : "✗ FAIL"} ${m}`);
let fails = 0;
const assert = (c, m) => { if (!c) fails++; ok(c, m); };

// 1x1 JPEG
const TINY_JPEG = Buffer.from(
  "/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////2wBDAf//////////////////////////////////////////////////////////////////////////////////////wgARCAABAAEDASIAAhEBAxEB/8QAFAABAAAAAAAAAAAAAAAAAAAAAv/EABQQAQAAAAAAAAAAAAAAAAAAAAD/xAAUAQEAAAAAAAAAAAAAAAAAAAAA/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAwDAQACEQMRAD8AfwD/2Q==",
  "base64",
);

(async () => {
  // 1) 비회원 로그인
  let r = await jcall("/api/auth/guest", "POST");
  assert(r.status === 200 && r.data.user, "비회원 로그인");

  // 2) 시작 설문
  r = await jcall("/api/survey", "PUT", {
    niche: "동네 베이커리", followers: 800, operatingMonths: 6,
    goals: ["저장"], weeklyCapacity: 2, mainFormats: ["사진첨부형 카드뉴스"],
    brandColor: "#ef5a35",
  });
  assert(r.status === 200, "시작 설문 저장");

  // 3) 사진첨부형 카드뉴스 기획 추가
  r = await jcall("/api/cards", "POST", {
    topicSource: "직접입력", topicTitle: "신메뉴 3종 소개",
    format: "사진첨부형 카드뉴스", objective: "저장", pageCount: 4,
    keyMessage: "이번 주 신메뉴",
  });
  assert(r.status === 200 && r.data.card?.id, `기획 추가 (사진첨부형) → ${r.data.card?.status}`);
  const id = r.data.card.id;
  assert(r.data.card.format === "사진첨부형 카드뉴스", "포맷 = 사진첨부형 카드뉴스");

  // 4) 제작(본문 생성)
  r = await jcall(`/api/cards/${id}/generate`, "POST");
  assert(r.status === 200 && r.data.card?.pages?.length >= 3, `제작 → ${r.data.card?.pages?.length}장, 상태 ${r.data.card?.status}`);

  // 5) 사진 업로드 (0장)
  {
    const fd = new FormData();
    fd.append("photo", new Blob([TINY_JPEG], { type: "image/jpeg" }), "p0.jpg");
    const res = await call(`/api/cards/${id}/photo/0`, { method: "PUT", body: fd });
    const data = await res.json().catch(() => ({}));
    assert(res.status === 200 && data.ok, `사진 업로드 PUT (page 0) → ${data.sizeBytes}B`);
  }

  // 6) 사진 목록
  r = await jcall(`/api/cards/${id}/photos`, "GET");
  assert(r.status === 200 && Array.isArray(r.data.pages) && r.data.pages.includes(0), `사진 목록 GET → pages=${JSON.stringify(r.data.pages)}`);

  // 7) 사진 서빙
  {
    const res = await call(`/api/cards/${id}/photo/0`, { method: "GET" });
    const ct = res.headers.get("content-type");
    assert(res.status === 200 && ct?.startsWith("image/"), `사진 서빙 GET → ${res.status} ${ct}`);
  }

  // 8) 자동저장(PATCH) — 제목 변경
  r = await jcall(`/api/cards/${id}`, "PATCH", { title: "신메뉴 3종 — 자동저장 테스트" });
  assert(r.status === 200 && r.data.card?.title?.includes("자동저장"), "자동저장 PATCH(제목)");

  // 9) 검수 실행 + 통과
  r = await jcall(`/api/cards/${id}/review`, "POST");
  assert(r.status === 200, `검수 실행 → 플래그 ${r.data.card?.reviewFlags?.length ?? "?"}건`);
  for (const f of r.data.card?.reviewFlags?.filter((x) => !x.resolved) ?? []) {
    await jcall(`/api/cards/${id}/review`, "PATCH", { flagId: f.id, resolved: true });
  }
  r = await jcall(`/api/cards/${id}/review`, "PATCH", { action: "pass" });
  assert(r.status === 200 && r.data.card?.status === "제작완료", `검수 통과 → 상태 ${r.data.card?.status}`);

  // 10) 에디터 페이지 렌더(SSR 200)
  {
    const res = await call(`/app/create/${id}`, { method: "GET" });
    assert(res.status === 200, `에디터 페이지 렌더 → ${res.status}`);
  }

  // 11) 사진 삭제
  r = await jcall(`/api/cards/${id}/photo/0`, "DELETE");
  assert(r.status === 200, "사진 삭제 DELETE");
  r = await jcall(`/api/cards/${id}/photos`, "GET");
  assert(r.status === 200 && !r.data.pages.includes(0), `삭제 후 목록 → ${JSON.stringify(r.data.pages)}`);

  console.log(fails === 0 ? "\n🎉 ALL PASS" : `\n❌ ${fails} FAIL`);
  process.exit(fails === 0 ? 0 : 1);
})();
