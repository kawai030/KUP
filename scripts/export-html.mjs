import { chromium } from "playwright-core";
import fs from "fs";
import path from "path";

const BASE = "http://localhost:3009";
const OUT = path.resolve("exports");
fs.mkdirSync(OUT, { recursive: true });

const ca = fs.readFileSync("/tmp/cookieA", "utf8").trim();
const cb = fs.readFileSync("/tmp/cookieB", "utf8").trim();
const editId = fs.readFileSync("/tmp/editid", "utf8").trim();

const ROUTES = [
  // 공개
  ["landing", "/", null, "랜딩"],
  ["features", "/features", null, "주요 기능"],
  ["pricing", "/pricing", null, "요금제(공개)"],
  ["contact", "/contact", null, "문의하기"],
  ["terms", "/terms", null, "이용약관"],
  ["privacy", "/privacy", null, "개인정보 처리방침"],
  ["login", "/login", null, "로그인"],
  ["signup", "/signup", null, "회원가입"],
  ["onboarding", "/onboarding", "B", "온보딩 설문"],
  // 워크스페이스
  ["app-home", "/app/home", "A", "워크스페이스 홈"],
  ["app-plans", "/app/plans", "A", "AI 기획 리스트"],
  ["app-board", "/app/board", "A", "콘텐츠 관리(칸반)"],
  ["app-insights", "/app/insights", "A", "콘텐츠 성과"],
  ["app-accounts", "/app/accounts", "A", "연동 인스타 계정"],
  ["app-dm", "/app/dm", "A", "DM 리드마그넷"],
  ["app-mypage", "/app/mypage", "A", "마이페이지"],
  ["app-pricing", "/app/pricing", "A", "요금제(워크스페이스)"],
  ["app-editor", `/app/create/${editId}`, "A", "카드 에디터(편집·검수·발행)"],
];

async function inlineCss(html) {
  const links = [...html.matchAll(/<link[^>]+rel="stylesheet"[^>]*>/gi)];
  for (const m of links) {
    const href = (m[0].match(/href="([^"]+)"/) || [])[1];
    if (!href) continue;
    try {
      const url = href.startsWith("http") ? href : BASE + href;
      const css = await fetch(url).then((r) => r.text());
      html = html.replace(m[0], `<style>\n${css}\n</style>`);
    } catch {
      /* keep link */
    }
  }
  return html;
}

function clean(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "") // 하이드레이션 스크립트 제거(정적 스냅샷)
    .replace(/<link[^>]+rel="(preload|modulepreload)"[^>]*>/gi, "");
}

const browser = await chromium.launch({ channel: "chrome", headless: true });
const ctxAnon = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const ctxA = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const ctxB = await browser.newContext({ viewport: { width: 1280, height: 900 } });
await ctxA.addCookies([{ name: "onekup_session", value: ca, url: BASE }]);
await ctxB.addCookies([{ name: "onekup_session", value: cb, url: BASE }]);
const ctx = { A: ctxA, B: ctxB, null: ctxAnon };

const done = [];
for (const [file, route, who, title] of ROUTES) {
  const page = await ctx[who].newPage();
  try {
    await page.goto(BASE + route, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForFunction(() => !document.body.innerText.includes("불러오는 중"), { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(700);
    let html = await page.content();
    html = await inlineCss(html);
    html = clean(html);
    fs.writeFileSync(path.join(OUT, `${file}.html`), html, "utf8");
    console.log(`✓ ${file.padEnd(14)} ${title}`);
    done.push([file, title]);
  } catch (e) {
    console.log(`✗ ${file}: ${e.message}`);
  }
  await page.close();
}

// index
const items = done.map(([f, t]) => `<li><a href="./${f}.html">${t}</a> <code>${f}.html</code></li>`).join("\n");
const index = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>KUP 화면 내보내기</title>
<style>body{font-family:system-ui,sans-serif;max-width:720px;margin:48px auto;padding:0 20px;color:#1b1a17;background:#f6f3ec}
h1{font-size:28px}li{margin:8px 0;line-height:1.6}code{color:#8b8579;font-size:12px}a{color:#ef5a35;font-weight:600;text-decoration:none}a:hover{text-decoration:underline}</style></head>
<body><h1>KUP 화면 내보내기</h1><p>아래 화면들을 더블클릭해 브라우저로 열어보세요. (정적 스냅샷 — 데이터가 채워진 실제 렌더 화면입니다)</p>
<ul>\n${items}\n</ul></body></html>`;
fs.writeFileSync(path.join(OUT, "index.html"), index, "utf8");

await browser.close();
console.log(`\n완료: ${done.length}개 → exports/`);
