import { chromium } from "playwright-core";
const BASE = "http://localhost:3000";
const OUT = "/private/tmp/claude-501/-Volumes-Samsung-SSD-Work-Project-1KUP/0b9ae4ff-ff63-4fbe-943c-2ca9b4065280/scratchpad";
let cookie = "";
async function call(p, opts = {}) { const r = await fetch(BASE + p, { ...opts, headers: { ...(opts.headers||{}), ...(cookie?{cookie}:{}) }, redirect: "manual" }); const sc = r.headers.get("set-cookie"); if (sc) cookie = sc.split(";")[0]; return r; }
const j = async (p,m,b) => { const r = await call(p,{method:m,headers:{"content-type":"application/json"},body:b?JSON.stringify(b):undefined}); return {status:r.status, data: await r.json().catch(()=>({}))}; };
let fails = 0; const assert = (c,m) => { if(!c) fails++; console.log(`${c?"✓":"✗ FAIL"} ${m}`); };

await j("/api/auth/guest","POST");
await j("/api/survey","PUT",{niche:"운동",followers:500,mainFormats:["릴스"]});
const rel = await j("/api/cards","POST",{topicSource:"직접입력",topicTitle:"홈트 3분 루틴",format:"릴스",objective:"조회",pageCount:4});
await j("/api/cards","POST",{topicSource:"직접입력",topicTitle:"카드 게시물 테스트",format:"카드뉴스",objective:"저장",pageCount:5});
assert(rel.data.card?.status === "기획완료" && rel.data.card?.format === "릴스", "릴스 생성(status 기획완료)");
const reelsTitle = rel.data.card.title; // AI 생성 제목

const [name, value] = cookie.split("=");
const browser = await chromium.launch({ channel: "chrome", headless: true });
const ctx = await browser.newContext({ viewport: { width: 1500, height: 1000 }, deviceScaleFactor: 1.5 });
await ctx.addCookies([{ name, value, domain: "localhost", path: "/" }]);
const page = await ctx.newPage();
const errors = []; page.on("pageerror", e => errors.push(String(e)));

// 콘텐츠 관리(칸반)
await page.goto(`${BASE}/app/board`, { waitUntil: "networkidle" });
await page.waitForTimeout(1000);
const body = await page.innerText("body");
assert(body.includes(reelsTitle), `릴스 카드가 콘텐츠 관리에 표시됨 ("${reelsTitle}")`);
assert(body.includes("릴스") && body.includes("게시물"), "형식 배지: 릴스 / 게시물");
assert(!body.includes("사진첨부형") && !/\b카드\b(?!뉴스)/.test(body), "옛 '카드/사진' 라벨 미표시");
await page.screenshot({ path: `${OUT}/board.png`, fullPage: false });

// AI 기획 리스트 → 기획 추가 모달의 형식 옵션
await page.goto(`${BASE}/app/plans`, { waitUntil: "networkidle" });
await page.waitForTimeout(800);
for (const t of ["건너뛰기", "닫기"]) { const b = page.getByText(t, { exact: false }).first(); if (await b.count() && await b.isVisible().catch(()=>false)) { await b.click().catch(()=>{}); break; } }
const addBtn = page.getByRole("button", { name: /기획 추가|추가/ }).first();
if (await addBtn.count()) { await addBtn.click().catch(()=>{}); await page.waitForTimeout(500); }
const modal = await page.innerText("body");
assert(modal.includes("게시물") && modal.includes("릴스"), "기획 추가 형식 옵션: 게시물 / 릴스");

assert(errors.length === 0, `런타임 콘솔 에러 없음 (${errors.length})`);
if (errors.length) console.log(errors.join("\n"));
await browser.close();
console.log(fails === 0 ? "\n🎉 BOARD/FORMAT OK" : `\n❌ ${fails} FAIL`);
process.exit(fails === 0 ? 0 : 1);
