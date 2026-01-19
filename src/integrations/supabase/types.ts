export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      backup_codes: {
        Row: {
          code_hash: string
          created_at: string
          id: string
          used: boolean
          used_at: string | null
          user_id: string
        }
        Insert: {
          code_hash: string
          created_at?: string
          id?: string
          used?: boolean
          used_at?: string | null
          user_id: string
        }
        Update: {
          code_hash?: string
          created_at?: string
          id?: string
          used?: boolean
          used_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      call_participants: {
        Row: {
          call_request_id: string
          id: string
          invited_at: string
          responded_at: string | null
          status: string
          telegram_id: number | null
          user_id: string | null
        }
        Insert: {
          call_request_id: string
          id?: string
          invited_at?: string
          responded_at?: string | null
          status?: string
          telegram_id?: number | null
          user_id?: string | null
        }
        Update: {
          call_request_id?: string
          id?: string
          invited_at?: string
          responded_at?: string | null
          status?: string
          telegram_id?: number | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "call_participants_call_request_id_fkey"
            columns: ["call_request_id"]
            isOneToOne: false
            referencedRelation: "call_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      call_requests: {
        Row: {
          created_at: string
          created_by: string | null
          expires_at: string
          id: string
          is_group_call: boolean
          room_name: string
          status: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          expires_at?: string
          id?: string
          is_group_call?: boolean
          room_name: string
          status?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          expires_at?: string
          id?: string
          is_group_call?: boolean
          room_name?: string
          status?: string
        }
        Relationships: []
      }
      contacts: {
        Row: {
          contact_user_id: string
          created_at: string
          id: string
          nickname: string | null
          user_id: string
        }
        Insert: {
          contact_user_id: string
          created_at?: string
          id?: string
          nickname?: string | null
          user_id: string
        }
        Update: {
          contact_user_id?: string
          created_at?: string
          id?: string
          nickname?: string | null
          user_id?: string
        }
        Relationships: []
      }
      diagnostics_history: {
        Row: {
          created_at: string
          fixes: Json | null
          id: string
          results: Json
          run_by: string | null
          summary: Json
          telegram_sent: boolean | null
          trigger_type: string
        }
        Insert: {
          created_at?: string
          fixes?: Json | null
          id?: string
          results: Json
          run_by?: string | null
          summary: Json
          telegram_sent?: boolean | null
          trigger_type?: string
        }
        Update: {
          created_at?: string
          fixes?: Json | null
          id?: string
          results?: Json
          run_by?: string | null
          summary?: Json
          telegram_sent?: boolean | null
          trigger_type?: string
        }
        Relationships: []
      }
      error_groups: {
        Row: {
          error_hash: string
          error_message: string
          error_type: string
          first_seen: string | null
          id: string
          last_seen: string | null
          occurrence_count: number | null
          severity: string | null
          source: string | null
          telegram_message_id: number | null
        }
        Insert: {
          error_hash: string
          error_message: string
          error_type: string
          first_seen?: string | null
          id?: string
          last_seen?: string | null
          occurrence_count?: number | null
          severity?: string | null
          source?: string | null
          telegram_message_id?: number | null
        }
        Update: {
          error_hash?: string
          error_message?: string
          error_type?: string
          first_seen?: string | null
          id?: string
          last_seen?: string | null
          occurrence_count?: number | null
          severity?: string | null
          source?: string | null
          telegram_message_id?: number | null
        }
        Relationships: []
      }
      error_logs: {
        Row: {
          created_at: string
          details: Json | null
          error_message: string
          error_type: string
          id: string
          notified: boolean
          severity: string
          source: string | null
          url: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          details?: Json | null
          error_message: string
          error_type: string
          id?: string
          notified?: boolean
          severity?: string
          source?: string | null
          url?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          details?: Json | null
          error_message?: string
          error_type?: string
          id?: string
          notified?: boolean
          severity?: string
          source?: string | null
          url?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      meeting_participants: {
        Row: {
          id: string
          joined_at: string
          left_at: string | null
          room_id: string
          user_id: string | null
          user_name: string
        }
        Insert: {
          id?: string
          joined_at?: string
          left_at?: string | null
          room_id: string
          user_id?: string | null
          user_name: string
        }
        Update: {
          id?: string
          joined_at?: string
          left_at?: string | null
          room_id?: string
          user_id?: string | null
          user_name?: string
        }
        Relationships: []
      }
      meeting_transcripts: {
        Row: {
          created_at: string
          ended_at: string | null
          id: string
          key_points: Json | null
          owner_user_id: string | null
          participants: Json | null
          room_id: string
          room_name: string
          started_at: string
          summary: string | null
          transcript: string | null
        }
        Insert: {
          created_at?: string
          ended_at?: string | null
          id?: string
          key_points?: Json | null
          owner_user_id?: string | null
          participants?: Json | null
          room_id: string
          room_name: string
          started_at?: string
          summary?: string | null
          transcript?: string | null
        }
        Update: {
          created_at?: string
          ended_at?: string | null
          id?: string
          key_points?: Json | null
          owner_user_id?: string | null
          participants?: Json | null
          room_id?: string
          room_name?: string
          started_at?: string
          summary?: string | null
          transcript?: string | null
        }
        Relationships: []
      }
      news: {
        Row: {
          created_at: string
          description: string
          id: string
          language: string
          published_at: string
          source: string | null
          title: string
          url: string | null
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          language?: string
          published_at?: string
          source?: string | null
          title: string
          url?: string | null
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          language?: string
          published_at?: string
          source?: string | null
          title?: string
          url?: string | null
        }
        Relationships: []
      }
      participant_geo_data: {
        Row: {
          city: string | null
          country: string | null
          country_code: string | null
          created_at: string | null
          id: string
          ip_address: string | null
          participant_id: string
          region: string | null
        }
        Insert: {
          city?: string | null
          country?: string | null
          country_code?: string | null
          created_at?: string | null
          id?: string
          ip_address?: string | null
          participant_id: string
          region?: string | null
        }
        Update: {
          city?: string | null
          country?: string | null
          country_code?: string | null
          created_at?: string | null
          id?: string
          ip_address?: string | null
          participant_id?: string
          region?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          id: string
          telegram_id: number | null
          telegram_username: string | null
          updated_at: string
          user_id: string
          username: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          telegram_id?: number | null
          telegram_username?: string | null
          updated_at?: string
          user_id: string
          username?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          telegram_id?: number | null
          telegram_username?: string | null
          updated_at?: string
          user_id?: string
          username?: string | null
        }
        Relationships: []
      }
      scheduled_calls: {
        Row: {
          created_at: string
          created_by: string
          description: string | null
          id: string
          participants_telegram_ids: number[] | null
          reminder_sent: boolean | null
          room_name: string
          scheduled_at: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          participants_telegram_ids?: number[] | null
          reminder_sent?: boolean | null
          room_name: string
          scheduled_at: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          participants_telegram_ids?: number[] | null
          reminder_sent?: boolean | null
          room_name?: string
          scheduled_at?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      shared_meeting_links: {
        Row: {
          created_at: string
          created_by: string
          expires_at: string | null
          id: string
          is_active: boolean
          meeting_id: string
          share_token: string
        }
        Insert: {
          created_at?: string
          created_by: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          meeting_id: string
          share_token?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          meeting_id?: string
          share_token?: string
        }
        Relationships: [
          {
            foreignKeyName: "shared_meeting_links_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meeting_transcripts"
            referencedColumns: ["id"]
          },
        ]
      }
      site_analytics: {
        Row: {
          created_at: string
          event_data: Json | null
          event_type: string
          id: string
          page_path: string | null
          referrer: string | null
          session_id: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          event_data?: Json | null
          event_type: string
          id?: string
          page_path?: string | null
          referrer?: string | null
          session_id?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          event_data?: Json | null
          event_type?: string
          id?: string
          page_path?: string | null
          referrer?: string | null
          session_id?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      telegram_activity_log: {
        Row: {
          action: string
          created_at: string
          id: string
          metadata: Json | null
          telegram_id: number | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          metadata?: Json | null
          telegram_id?: number | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          metadata?: Json | null
          telegram_id?: number | null
          user_id?: string | null
        }
        Relationships: []
      }
      translation_history: {
        Row: {
          created_at: string
          id: string
          original_text: string
          room_id: string | null
          source_language: string | null
          target_language: string
          translated_text: string
          user_id: string
          voice_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          original_text: string
          room_id?: string | null
          source_language?: string | null
          target_language: string
          translated_text: string
          user_id: string
          voice_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          original_text?: string
          room_id?: string | null
          source_language?: string | null
          target_language?: string
          translated_text?: string
          user_id?: string
          voice_id?: string | null
        }
        Relationships: []
      }
      user_presence: {
        Row: {
          current_room: string | null
          id: string
          is_online: boolean
          last_seen: string
          user_id: string
        }
        Insert: {
          current_room?: string | null
          id?: string
          is_online?: boolean
          last_seen?: string
          user_id: string
        }
        Update: {
          current_room?: string | null
          id?: string
          is_online?: boolean
          last_seen?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      cleanup_old_translation_history: { Args: never; Returns: number }
      get_room_participants: {
        Args: { room_id_param: string }
        Returns: {
          id: string
          joined_at: string
          left_at: string
          room_id: string
          user_id: string
          user_name: string
        }[]
      }
      get_safe_participants_for_room: {
        Args: { room_id_param: string }
        Returns: {
          id: string
          joined_at: string
          left_at: string
          room_id: string
          user_id: string
          user_name: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: never; Returns: boolean }
      is_room_participant: {
        Args: { check_room_id: string; check_user_id: string }
        Returns: boolean
      }
      search_profile_by_username: {
        Args: { search_username: string }
        Returns: {
          avatar_url: string
          display_name: string
          user_id: string
          username: string
        }[]
      }
      validate_backup_code: { Args: { code_input: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "user"
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
      app_role: ["admin", "user"],
    },
  },
} as const
