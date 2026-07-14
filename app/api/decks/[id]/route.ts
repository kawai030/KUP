import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getDeckRow } from "@/lib/db/decks";

/**
 * GET /api/decks/:id  — 단일 deck 조회.
 *   getDeckRow()(lib/db/decks)로 decks row 반환. 없으면 404.
 *   TODO(인증): RLS 사용자 기준으로 교체. ?restore=1 시 deckFromRow로 Deck 계약 복원(conceptId 필요).
 */
export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const db = createAdminClient();
    const row = await getDeckRow(db, id);
    return NextResponse.json({ deck: row });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 404 });
  }
}
