/**
 * Supabase DB 타입 — `npx supabase gen types typescript --local` 자동 생성(마이그레이션 적용 후).
 * ⚠️ 본문 수정 금지. 스키마 변경 시 위 명령으로 재생성. 하단 편의 별칭만 수기 유지.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      challenge_logs: {
        Row: {
          channel_id: string
          id: string
          log_date: string
          publish_count: number
        }
        Insert: {
          channel_id: string
          id?: string
          log_date: string
          publish_count?: number
        }
        Update: {
          channel_id?: string
          id?: string
          log_date?: string
          publish_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "challenge_logs_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
        ]
      }
      channel_configs: {
        Row: {
          cadence: string | null
          channel_id: string
          locked_at: string
          persona: string
          pillars: string[]
          survey_raw: Json | null
          tone: string
          visual: Json
        }
        Insert: {
          cadence?: string | null
          channel_id: string
          locked_at?: string
          persona: string
          pillars: string[]
          survey_raw?: Json | null
          tone: string
          visual?: Json
        }
        Update: {
          cadence?: string | null
          channel_id?: string
          locked_at?: string
          persona?: string
          pillars?: string[]
          survey_raw?: Json | null
          tone?: string
          visual?: Json
        }
        Relationships: [
          {
            foreignKeyName: "channel_configs_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: true
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
        ]
      }
      channel_insights_daily: {
        Row: {
          captured_at: string | null
          channel_id: string
          followers_count: number | null
          follows: number | null
          id: string
          snapshot_date: string
          unfollows: number | null
        }
        Insert: {
          captured_at?: string | null
          channel_id: string
          followers_count?: number | null
          follows?: number | null
          id?: string
          snapshot_date: string
          unfollows?: number | null
        }
        Update: {
          captured_at?: string | null
          channel_id?: string
          followers_count?: number | null
          follows?: number | null
          id?: string
          snapshot_date?: string
          unfollows?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "channel_insights_daily_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
        ]
      }
      channels: {
        Row: {
          connected_at: string | null
          id: string
          ig_user_id: string | null
          ig_username: string | null
          status: Database["public"]["Enums"]["channel_status"]
          user_id: string
        }
        Insert: {
          connected_at?: string | null
          id?: string
          ig_user_id?: string | null
          ig_username?: string | null
          status?: Database["public"]["Enums"]["channel_status"]
          user_id: string
        }
        Update: {
          connected_at?: string | null
          id?: string
          ig_user_id?: string | null
          ig_username?: string | null
          status?: Database["public"]["Enums"]["channel_status"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "channels_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      decks: {
        Row: {
          ai_flags: Json
          caption: string | null
          channel_id: string
          created_at: string
          format: Database["public"]["Enums"]["deck_format"]
          hashtags: string[]
          hook: string | null
          id: string
          lead_keyword: string | null
          risk_level: Database["public"]["Enums"]["risk_level"] | null
          slide_count: number | null
          slides: Json
          status: Database["public"]["Enums"]["deck_status"]
          strategy: string | null
          topic: string | null
          updated_at: string
        }
        Insert: {
          ai_flags?: Json
          caption?: string | null
          channel_id: string
          created_at?: string
          format?: Database["public"]["Enums"]["deck_format"]
          hashtags?: string[]
          hook?: string | null
          id?: string
          lead_keyword?: string | null
          risk_level?: Database["public"]["Enums"]["risk_level"] | null
          slide_count?: number | null
          slides?: Json
          status?: Database["public"]["Enums"]["deck_status"]
          strategy?: string | null
          topic?: string | null
          updated_at?: string
        }
        Update: {
          ai_flags?: Json
          caption?: string | null
          channel_id?: string
          created_at?: string
          format?: Database["public"]["Enums"]["deck_format"]
          hashtags?: string[]
          hook?: string | null
          id?: string
          lead_keyword?: string | null
          risk_level?: Database["public"]["Enums"]["risk_level"] | null
          slide_count?: number | null
          slides?: Json
          status?: Database["public"]["Enums"]["deck_status"]
          strategy?: string | null
          topic?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "decks_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
        ]
      }
      dm_logs: {
        Row: {
          channel_id: string
          id: string
          ig_recipient_id: string | null
          lead_magnet_id: string
          sent_at: string
          status: Database["public"]["Enums"]["dm_status"]
        }
        Insert: {
          channel_id: string
          id?: string
          ig_recipient_id?: string | null
          lead_magnet_id: string
          sent_at?: string
          status: Database["public"]["Enums"]["dm_status"]
        }
        Update: {
          channel_id?: string
          id?: string
          ig_recipient_id?: string | null
          lead_magnet_id?: string
          sent_at?: string
          status?: Database["public"]["Enums"]["dm_status"]
        }
        Relationships: [
          {
            foreignKeyName: "dm_logs_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dm_logs_lead_magnet_id_fkey"
            columns: ["lead_magnet_id"]
            isOneToOne: false
            referencedRelation: "lead_magnets"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          channel_id: string | null
          created_at: string
          id: string
          payload: Json
          type: string
          user_id: string | null
        }
        Insert: {
          channel_id?: string | null
          created_at?: string
          id?: string
          payload?: Json
          type: string
          user_id?: string | null
        }
        Update: {
          channel_id?: string | null
          created_at?: string
          id?: string
          payload?: Json
          type?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "events_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ig_tokens: {
        Row: {
          access_token_enc: string
          channel_id: string
          expires_at: string | null
          token_type: string
        }
        Insert: {
          access_token_enc: string
          channel_id: string
          expires_at?: string | null
          token_type?: string
        }
        Update: {
          access_token_enc?: string
          channel_id?: string
          expires_at?: string | null
          token_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "ig_tokens_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: true
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_magnets: {
        Row: {
          active: boolean
          channel_id: string
          dm_payload: Json
          id: string
          keyword: string
          post_id: string | null
        }
        Insert: {
          active?: boolean
          channel_id: string
          dm_payload?: Json
          id?: string
          keyword: string
          post_id?: string | null
        }
        Update: {
          active?: boolean
          channel_id?: string
          dm_payload?: Json
          id?: string
          keyword?: string
          post_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_magnets_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_magnets_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      post_insights: {
        Row: {
          captured_at: string
          comments: number | null
          follows: number | null
          id: string
          likes: number | null
          post_id: string
          profile_visits: number | null
          reach: number | null
          saved: number | null
          shares: number | null
          views: number | null
        }
        Insert: {
          captured_at?: string
          comments?: number | null
          follows?: number | null
          id?: string
          likes?: number | null
          post_id: string
          profile_visits?: number | null
          reach?: number | null
          saved?: number | null
          shares?: number | null
          views?: number | null
        }
        Update: {
          captured_at?: string
          comments?: number | null
          follows?: number | null
          id?: string
          likes?: number | null
          post_id?: string
          profile_visits?: number | null
          reach?: number | null
          saved?: number | null
          shares?: number | null
          views?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "post_insights_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      posts: {
        Row: {
          channel_id: string
          deck_id: string
          id: string
          ig_container_id: string | null
          ig_media_id: string | null
          permalink: string | null
          published_at: string | null
          status: Database["public"]["Enums"]["post_status"]
        }
        Insert: {
          channel_id: string
          deck_id: string
          id?: string
          ig_container_id?: string | null
          ig_media_id?: string | null
          permalink?: string | null
          published_at?: string | null
          status?: Database["public"]["Enums"]["post_status"]
        }
        Update: {
          channel_id?: string
          deck_id?: string
          id?: string
          ig_container_id?: string | null
          ig_media_id?: string | null
          permalink?: string | null
          published_at?: string | null
          status?: Database["public"]["Enums"]["post_status"]
        }
        Relationships: [
          {
            foreignKeyName: "posts_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "posts_deck_id_fkey"
            columns: ["deck_id"]
            isOneToOne: false
            referencedRelation: "decks"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          id: string
          marketing_opt_in: boolean
          nickname: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id: string
          marketing_opt_in?: boolean
          nickname?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          marketing_opt_in?: boolean
          nickname?: string | null
        }
        Relationships: []
      }
      reviews: {
        Row: {
          ai_flags: Json
          ai_label_applied: boolean
          approved_by: string | null
          decided_at: string
          decision: Database["public"]["Enums"]["review_decision"]
          deck_id: string
          id: string
          risk_level: Database["public"]["Enums"]["risk_level"] | null
        }
        Insert: {
          ai_flags?: Json
          ai_label_applied?: boolean
          approved_by?: string | null
          decided_at?: string
          decision: Database["public"]["Enums"]["review_decision"]
          deck_id: string
          id?: string
          risk_level?: Database["public"]["Enums"]["risk_level"] | null
        }
        Update: {
          ai_flags?: Json
          ai_label_applied?: boolean
          approved_by?: string | null
          decided_at?: string
          decision?: Database["public"]["Enums"]["review_decision"]
          deck_id?: string
          id?: string
          risk_level?: Database["public"]["Enums"]["risk_level"] | null
        }
        Relationships: [
          {
            foreignKeyName: "reviews_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_deck_id_fkey"
            columns: ["deck_id"]
            isOneToOne: false
            referencedRelation: "decks"
            referencedColumns: ["id"]
          },
        ]
      }
      schedules: {
        Row: {
          attempts: number
          bullmq_job_id: string | null
          deck_id: string
          id: string
          last_error: string | null
          scheduled_at: string
          status: Database["public"]["Enums"]["schedule_status"]
        }
        Insert: {
          attempts?: number
          bullmq_job_id?: string | null
          deck_id: string
          id?: string
          last_error?: string | null
          scheduled_at: string
          status?: Database["public"]["Enums"]["schedule_status"]
        }
        Update: {
          attempts?: number
          bullmq_job_id?: string | null
          deck_id?: string
          id?: string
          last_error?: string | null
          scheduled_at?: string
          status?: Database["public"]["Enums"]["schedule_status"]
        }
        Relationships: [
          {
            foreignKeyName: "schedules_deck_id_fkey"
            columns: ["deck_id"]
            isOneToOne: false
            referencedRelation: "decks"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          auto_renew: boolean
          billing_cycle: Database["public"]["Enums"]["billing_cycle"]
          current_period_end: string | null
          id: string
          plan: Database["public"]["Enums"]["plan_tier"]
          status: Database["public"]["Enums"]["sub_status"]
          user_id: string
        }
        Insert: {
          auto_renew?: boolean
          billing_cycle?: Database["public"]["Enums"]["billing_cycle"]
          current_period_end?: string | null
          id?: string
          plan?: Database["public"]["Enums"]["plan_tier"]
          status?: Database["public"]["Enums"]["sub_status"]
          user_id: string
        }
        Update: {
          auto_renew?: boolean
          billing_cycle?: Database["public"]["Enums"]["billing_cycle"]
          current_period_end?: string | null
          id?: string
          plan?: Database["public"]["Enums"]["plan_tier"]
          status?: Database["public"]["Enums"]["sub_status"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      billing_cycle: "monthly" | "yearly"
      channel_status: "connected" | "needs_setup"
      deck_format: "cardnews" | "cardnews_photo"
      deck_status:
        | "planning"
        | "planned"
        | "producing"
        | "produced"
        | "scheduled"
        | "published"
      dm_status: "sent" | "failed" | "skipped_quota"
      plan_tier: "basic" | "pro" | "premium"
      post_status: "creating" | "published" | "failed"
      review_decision: "approved" | "rejected"
      risk_level: "low" | "high"
      schedule_status: "pending" | "processing" | "done" | "failed" | "canceled"
      sub_status: "beta_free" | "active" | "canceled" | "past_due"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      billing_cycle: ["monthly", "yearly"],
      channel_status: ["connected", "needs_setup"],
      deck_format: ["cardnews", "cardnews_photo"],
      deck_status: [
        "planning",
        "planned",
        "producing",
        "produced",
        "scheduled",
        "published",
      ],
      dm_status: ["sent", "failed", "skipped_quota"],
      plan_tier: ["basic", "pro", "premium"],
      post_status: ["creating", "published", "failed"],
      review_decision: ["approved", "rejected"],
      risk_level: ["low", "high"],
      schedule_status: ["pending", "processing", "done", "failed", "canceled"],
      sub_status: ["beta_free", "active", "canceled", "past_due"],
    },
  },
} as const


// ── 편의 별칭 (이전 수기 타입 호환) ──────────────────────────────────────
export type PlanTier = Enums<"plan_tier">;
export type BillingCycle = Enums<"billing_cycle">;
export type SubStatus = Enums<"sub_status">;
export type ChannelStatus = Enums<"channel_status">;
export type DeckStatus = Enums<"deck_status">;
export type DeckFormat = Enums<"deck_format">;
export type RiskLevel = Enums<"risk_level">;
export type ReviewDecision = Enums<"review_decision">;
export type ScheduleStatus = Enums<"schedule_status">;
export type PostStatus = Enums<"post_status">;
export type DmStatus = Enums<"dm_status">;
