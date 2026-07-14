import type { SupabaseClient } from "@supabase/supabase-js";
import { deckSchema, type Deck } from "@/lib/deck-schema";
import type { Database, Json, DeckStatus } from "@/lib/db/database.types";

/**
 * decks 영속화 — Deck 계약(deck-schema, 파이프라인 §1.2) ↔ decks 테이블(데이터모델 §2.3) 매핑.
 * Deck.conceptId 는 DB에서 channel_id 로 치환된다(채널=컨셉 1:1). slides/ai_flags 는 jsonb.
 */

type Db = SupabaseClient<Database>;
type DeckRow = Database["public"]["Tables"]["decks"]["Row"];
type DeckInsert = Database["public"]["Tables"]["decks"]["Insert"];

/** Deck → decks insert row. 생성·렌더 완료분은 칸반 'produced'(편집 가능, 데이터모델 §3). */
export function deckRowFromDeck(deck: Deck, channelId: string, status: DeckStatus = "produced"): DeckInsert {
  return {
    channel_id: channelId,
    status,
    format: "cardnews",
    topic: deck.topic,
    strategy: deck.strategy,
    hook: null, // ② 전략 단계 hook 은 현재 Deck 계약에 미포함 → 추후 thread
    lead_keyword: deck.leadKeyword,
    slides: deck.slides as unknown as Json,
    caption: deck.caption,
    hashtags: deck.hashtags,
    ai_flags: deck.ai_flags as unknown as Json,
    risk_level: deck.risk_level,
    slide_count: deck.slides.length,
  };
}

export async function saveDeck(
  db: Db,
  channelId: string,
  deck: Deck,
  status: DeckStatus = "produced",
): Promise<string> {
  const { data, error } = await db
    .from("decks")
    .insert(deckRowFromDeck(deck, channelId, status))
    .select("id")
    .single();
  if (error) throw new Error(`[db] deck 저장 실패: ${error.message}`);
  return data.id;
}

export async function getDeckRow(db: Db, id: string): Promise<DeckRow> {
  const { data, error } = await db.from("decks").select("*").eq("id", id).single();
  if (error) throw new Error(`[db] deck 조회 실패(${id}): ${error.message}`);
  return data;
}

/** decks row → Deck 계약 복원 + 검증. conceptId 는 row에 없으므로 호출자가 채널의 컨셉 id를 넘긴다. */
export function deckFromRow(row: DeckRow, conceptId: string): Deck {
  return deckSchema.parse({
    conceptId,
    topic: row.topic,
    strategy: row.strategy,
    slides: row.slides,
    caption: row.caption,
    hashtags: row.hashtags,
    leadKeyword: row.lead_keyword,
    ai_flags: row.ai_flags,
    risk_level: row.risk_level,
  });
}
