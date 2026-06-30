// 릴스 영상 교체 버그 검증 + 비율 토글 위치 확인
import { chromium } from "playwright-core";
const BASE = "http://localhost:3000";
let cookie = "";
async function call(p, opts = {}) { const res = await fetch(BASE + p, { ...opts, headers: { ...(opts.headers || {}), ...(cookie ? { cookie } : {}) }, redirect: "manual" }); const sc = res.headers.get("set-cookie"); if (sc) cookie = sc.split(";")[0]; return res; }
const j = async (p, m, b) => { const r = await call(p, { method: m, headers: { "content-type": "application/json" }, body: b ? JSON.stringify(b) : undefined }); return { status: r.status, data: await r.json().catch(() => ({})) }; };
const fakeMp4 = (n) => Buffer.from(`FAKEMP4-${n}-`.repeat(20));

let fails = 0;
const assert = (c, m) => { if (!c) fails++; console.log(`${c ? "✓" : "✗ FAIL"} ${m}`); };

await j("/api/auth/guest", "POST");
await j("/api/survey", "PUT", { niche: "운동", followers: 500, mainFormats: ["릴스"] });
const c = await j("/api/cards", "POST", { topicSource: "직접입력", topicTitle: "홈트 3분 루틴", format: "릴스", objective: "조회", pageCount: 4 });
const id = c.data.card.id;
assert(c.data.card.format === "릴스", "릴스 카드 생성");

// 1차 업로드
let res = await (async () => { const fd = new FormData(); fd.append("video", new Blob([fakeMp4("A")], { type: "video/mp4" }), "a.mp4"); return call(`/api/cards/${id}/video`, { method: "PUT", body: fd }); })();
let d = await res.json(); assert(res.status === 200 && d.ok, `1차 영상 업로드 (${d.sizeBytes}B)`);
let card1 = (await j(`/api/cards/${id}`, "GET")).data.card;
const up1 = card1.updatedAt;
let vidA = await (await call(`/api/render-video/${id}`)).text();
assert(vidA.includes("FAKEMP4-A"), "서버에 A영상 저장됨");

// 2차 업로드(교체) — 다른 영상
await new Promise((r) => setTimeout(r, 20));
res = await (async () => { const fd = new FormData(); fd.append("video", new Blob([fakeMp4("BBB")], { type: "video/mp4" }), "b.mp4"); return call(`/api/cards/${id}/video`, { method: "PUT", body: fd }); })();
d = await res.json(); assert(res.status === 200 && d.ok, `2차 영상 교체 업로드 (${d.sizeBytes}B)`);
let card2 = (await j(`/api/cards/${id}`, "GET")).data.card;
const up2 = card2.updatedAt;
let vidB = await (await call(`/api/render-video/${id}`)).text();
assert(vidB.includes("FAKEMP4-BBB"), "서버 영상이 B로 교체됨");
assert(up2 > up1, `updatedAt 갱신됨(캐시버스터): ${up1} → ${up2}`);

// 브라우저: 교체 후 미리보기 <video> src 의 ?v= 가 갱신되는지
const [name, value] = cookie.split("=");
const browser = await chromium.launch({ channel: "chrome", headless: true });
const ctx = await browser.newContext();
await ctx.addCookies([{ name, value, domain: "localhost", path: "/" }]);
const page = await ctx.newPage();
await page.goto(`${BASE}/app/create/${id}`, { waitUntil: "networkidle" });
await page.waitForTimeout(1200);
const src = await page.locator("video").first().getAttribute("src");
assert(src && src.includes(`?v=${up2}`), `미리보기 video src 캐시버스터 = 최신 updatedAt (src=${src})`);

await browser.close();
console.log(fails === 0 ? "\n🎉 REELS REPLACE OK" : `\n❌ ${fails} FAIL`);
process.exit(fails === 0 ? 0 : 1);
