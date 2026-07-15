// 템플릿/미디어 필드가 저장→재조회까지 살아남는지 검증 (PATCH 화이트리스트 버그 재발 방지)
const BASE = "http://localhost:3000";
let cookie = "";
async function call(p, opts = {}) {
  const r = await fetch(BASE + p, { ...opts, headers: { ...(opts.headers || {}), ...(cookie ? { cookie } : {}) }, redirect: "manual" });
  const sc = r.headers.get("set-cookie"); if (sc) cookie = sc.split(";")[0];
  return r;
}
const j = async (p, m, b) => {
  const r = await call(p, { method: m, headers: { "content-type": "application/json" }, body: b ? JSON.stringify(b) : undefined });
  return { status: r.status, data: await r.json().catch(() => ({})) };
};
let fails = 0;
const ok = (c, m) => { if (!c) fails++; console.log(`${c ? "✓" : "✗ FAIL"} ${m}`); };

await j("/api/auth/guest", "POST");
await j("/api/survey", "PUT", { niche: "인테리어", followers: 800, mainFormats: ["카드뉴스"] });

// 1) 카드 생성 → AI(또는 mock)가 template 을 배정했는지
const c = await j("/api/cards", "POST", { topicSource: "직접입력", topicTitle: "가심비 인테리어 소품 BEST", format: "카드뉴스", objective: "저장", pageCount: 5 });
const id = c.data.card?.id;
ok(!!id, `카드 생성 (${c.status})`);
const planTpl = (c.data.card?.pages || []).map((p) => p.template);
ok(planTpl[0] === "cover", `기획: 1장 = cover (실제: ${planTpl[0]})`);
ok(planTpl[planTpl.length - 1] === "cta", `기획: 마지막 = cta (실제: ${planTpl.at(-1)})`);
console.log(`   기획 템플릿 배정: [${planTpl.join(", ")}]`);

// 2) 제작(본문 생성) → template 유지 + 템플릿별 필드
const g = await j(`/api/cards/${id}/generate`, "POST");
const genPages = g.data.card?.pages || [];
const genTpl = genPages.map((p) => p.template);
ok(g.status === 200 && genTpl.every(Boolean), `제작 후 전 장에 template 존재 [${genTpl.join(", ")}]`);

// 3) 사용자가 템플릿을 직접 바꿔서 저장 (여기가 원래 버그 지점)
const edited = genPages.map((p, i) =>
  i === 1
    ? { ...p, template: "compare", mediaType: "video", mediaLayout: "bg", tag: "AI", compare: { leftLabel: "BEFORE", left: "허전한 벽", rightLabel: "AFTER", right: "포스터 한 장" } }
    : i === 2
    ? { ...p, template: "stat", mediaType: "photo", stat: { value: "87", unit: "%", caption: "체감 만족도" } }
    : i === 3
    ? { ...p, template: "list", items: ["무드등", "포스터", "디퓨저"] }
    : p
);
const patched = await j(`/api/cards/${id}`, "PATCH", { pages: edited, photoStyle: "bg", ratio: "3:4" });
ok(patched.status === 200, `PATCH 저장 (${patched.status})`);

// 4) 재조회 — 진짜로 살아남았는지 (새로고침 시뮬레이션)
const re = await j(`/api/cards/${id}`, "GET");
const P = re.data.card?.pages || [];
ok(P[1]?.template === "compare", `2장 template=compare 유지 (실제: ${P[1]?.template})`);
ok(P[1]?.mediaType === "video", `2장 mediaType=video 유지 (실제: ${P[1]?.mediaType})`);
ok(P[1]?.compare?.right === "포스터 한 장", `2장 compare 객체 유지 (실제: ${JSON.stringify(P[1]?.compare)})`);
ok(P[1]?.tag === "AI", `2장 tag="AI" 유지 — 비교형에도 태그 (실제: ${P[1]?.tag})`);
ok(P[1]?.mediaLayout === "bg", `2장 mediaLayout=bg 유지 — 배경+DIM 레이아웃 (실제: ${P[1]?.mediaLayout})`);
ok(P[2]?.stat?.value === "87", `3장 stat 유지 (실제: ${JSON.stringify(P[2]?.stat)})`);
ok(Array.isArray(P[3]?.items) && P[3].items.length === 3, `4장 items 유지 (실제: ${JSON.stringify(P[3]?.items)})`);
ok(re.data.card?.photoStyle === "bg", `photoStyle 유지 (기존 잠복버그) — 실제: ${re.data.card?.photoStyle}`);
ok(re.data.card?.ratio === "3:4", `ratio 유지 (기존 잠복버그) — 실제: ${re.data.card?.ratio}`);

console.log(fails === 0 ? "\n🎉 ALL PASS — 템플릿/미디어/비율 전부 영속됨" : `\n❌ ${fails} FAIL`);
process.exit(fails === 0 ? 0 : 1);
