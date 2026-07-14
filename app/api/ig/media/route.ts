import { json, withUser } from "@/lib/workspace/api";
import { fetchMediaList } from "@/lib/workspace/ig";
import { findIgAccount, isLiveAccount } from "@/lib/workspace/types";

// 활성(정식) 계정의 최근 게시물 목록 — DM 규칙의 "적용 게시물" 선택기용.
// 테스터/미연동이면 빈 목록 + live:false (화면은 "전체 게시물"로 폴백).
export async function GET() {
  const guard = await withUser();
  if ("res" in guard) return guard.res;

  const account = findIgAccount(guard.user);
  if (!account || !isLiveAccount(account)) return json({ live: false, media: [] });

  try {
    const media = await fetchMediaList(account, 25);
    return json({ live: true, media });
  } catch (e) {
    return json({ live: true, media: [], error: (e as Error).message });
  }
}
