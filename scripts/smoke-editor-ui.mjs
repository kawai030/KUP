// 에디터 클라이언트 UI 스모크 (실제 브라우저) — 스텝퍼/확인버튼/사진업로드 렌더 확인
import { chromium } from "playwright-core";
const BASE = process.env.BASE || "http://localhost:3000";

// API로 사진첨부형 카드 1개 준비 → 쿠키 받아 브라우저에 주입
let cookie = "";
async function call(p, opts = {}) {
  const res = await fetch(BASE + p, { ...opts, headers: { ...(opts.headers || {}), ...(cookie ? { cookie } : {}) }, redirect: "manual" });
  const sc = res.headers.get("set-cookie");
  if (sc) cookie = sc.split(";")[0];
  return res;
}
async function j(p, m, b) {
  const res = await call(p, { method: m, headers: { "content-type": "application/json" }, body: b ? JSON.stringify(b) : undefined });
  return { status: res.status, data: await res.json().catch(() => ({})) };
}

let fails = 0;
const assert = (c, m) => { if (!c) fails++; console.log(`${c ? "✓" : "✗ FAIL"} ${m}`); };

await j("/api/auth/guest", "POST");
await j("/api/survey", "PUT", { niche: "베이커리", followers: 800, operatingMonths: 6, goals: ["저장"], mainFormats: ["카드뉴스"], brandColor: "#ef5a35" });
// 일반 카드뉴스에도 사진 업로드가 되는지 검증
const created = await j("/api/cards", "POST", { topicSource: "직접입력", topicTitle: "신메뉴 소개", format: "카드뉴스", objective: "저장", pageCount: 4 });
const id = created.data.card.id;
await j(`/api/cards/${id}/generate`, "POST");

// 0장에 실제 사진 업로드(빨강 1x1) → 미리보기에 <img>로 떠야 함
const TINY_JPEG = Buffer.from(
  "/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////2wBDAf//////////////////////////////////////////////////////////////////////////////////////wgARCAABAAEDASIAAhEBAxEB/8QAFAABAAAAAAAAAAAAAAAAAAAAAv/EABQQAQAAAAAAAAAAAAAAAAAAAAD/xAAUAQEAAAAAAAAAAAAAAAAAAAAA/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAwDAQACEQMRAD8AfwD/2Q==",
  "base64",
);
{
  const fd = new FormData();
  fd.append("photo", new Blob([TINY_JPEG], { type: "image/jpeg" }), "p0.jpg");
  await call(`/api/cards/${id}/photo/0`, { method: "PUT", body: fd });
}

const [name, value] = cookie.split("=");
const browser = await chromium.launch({ channel: "chrome", headless: true });
const ctx = await browser.newContext();
await ctx.addCookies([{ name, value, domain: "localhost", path: "/" }]);
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
await page.goto(`${BASE}/app/create/${id}`, { waitUntil: "networkidle" });
await page.waitForTimeout(1200);

const body = await page.innerText("body");
assert(/1\s*편집/.test(body), "스텝 '1 편집' 표시");
assert(/2\s*검수/.test(body), "스텝 '2 검수' 표시");
assert(/3\s*업로드/.test(body), "스텝 '3 업로드' 표시");
assert(body.includes("확인 — 검수로"), "하단 '확인 — 검수로' 버튼");
assert(body.includes("제목 (저장용)"), "제목 전체폭 카드");
assert(body.includes("페이지 ("), "페이지 네비(전체폭)");
assert(body.includes("사진 업로드"), "사진 업로드 UI (일반 카드뉴스에도 존재)");
assert(body.includes("사진 배치") && body.includes("상단 사진") && body.includes("배경 사진"), "사진 배치 2가지(상단/배경) 토글 존재");
assert(body.includes("비율") && body.includes("정사각") && body.includes("세로형"), "비율 2가지(정사각/세로형) 토글 존재");

// 미리보기 카드가 패널 밖으로 넘치지 않는지 (박스 right ≤ 패널 right)
const panel = await page.getByText("미리보기", { exact: false }).first().locator("xpath=..").boundingBox();
const previewBox = await page.locator('div[style*="336px"]').first().boundingBox();
assert(panel && previewBox && previewBox.x >= panel.x - 1 && previewBox.x + previewBox.width <= panel.x + panel.width + 1, "미리보기 카드가 패널 안에 들어옴(넘침 없음)");
assert(body.includes("미리보기"), "미리보기 패널");
const previewImgs = await page.locator('img[src^="data:image"]').count();
assert(previewImgs >= 1, `업로드 사진이 일반 카드뉴스 <img>로 렌더(${previewImgs}개)`);

// 카드에서 '넘기기'·페이지번호·캐러셀 점 제거 확인
assert(!body.includes("넘기기"), "'넘기기 →' 제거됨");
assert(!body.includes("저장 · 공유"), "'저장 · 공유' 제거됨");
assert(!/\d\s*\/\s*\d/.test(body), "카드/패널 내 'n / m' 페이지번호 제거됨");
assert(body.includes("자동 저장됨") || body.includes("수정 중") || body.includes("저장 중"), "자동저장 상태 표시");

// 테마는 있고, 브랜드 컬러(스포이드)는 제거됨
assert(body.includes("테마"), "테마 컨트롤 존재");
assert(!body.includes("브랜드 컬러"), "브랜드 컬러 컨트롤 제거됨");
assert((await page.locator('input[type="color"]').count()) === 0, "스포이드(컬러 피커) 제거됨");

// 좌우 스왑: 미리보기가 헤드라인 편집보다 왼쪽
const pvBox = await page.getByText("미리보기").first().boundingBox();
const hlBox = await page.getByText("헤드라인").first().boundingBox();
assert(pvBox && hlBox && pvBox.x < hlBox.x, `미리보기가 왼쪽(편집 ${Math.round(hlBox?.x)} > 미리보기 ${Math.round(pvBox?.x)})`);

assert(errors.length === 0, `런타임 콘솔 에러 없음 (${errors.length})`);
if (errors.length) console.log(errors.join("\n"));

await browser.close();
console.log(fails === 0 ? "\n🎉 UI ALL PASS" : `\n❌ ${fails} FAIL`);
process.exit(fails === 0 ? 0 : 1);
