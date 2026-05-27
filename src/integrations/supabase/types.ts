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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      app_settings: {
        Row: {
          id: number
          pix_key: string | null
          pix_owner_name: string | null
          pix_qr_url: string | null
          updated_at: string
          whatsapp_number: string | null
        }
        Insert: {
          id?: number
          pix_key?: string | null
          pix_owner_name?: string | null
          pix_qr_url?: string | null
          updated_at?: string
          whatsapp_number?: string | null
        }
        Update: {
          id?: number
          pix_key?: string | null
          pix_owner_name?: string | null
          pix_qr_url?: string | null
          updated_at?: string
          whatsapp_number?: string | null
        }
        Relationships: []
      }
      candidate_profiles: {
        Row: {
          city: string | null
          created_at: string
          email: string | null
          full_name: string
          id: string
          is_blocked: boolean
          notes: string | null
          phone: string | null
          signup_source: string
          slug: string
          state: string | null
          trial_limit: number
          unblocked_at: string | null
          updated_at: string
        }
        Insert: {
          city?: string | null
          created_at?: string
          email?: string | null
          full_name: string
          id: string
          is_blocked?: boolean
          notes?: string | null
          phone?: string | null
          signup_source?: string
          slug: string
          state?: string | null
          trial_limit?: number
          unblocked_at?: string | null
          updated_at?: string
        }
        Update: {
          city?: string | null
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          is_blocked?: boolean
          notes?: string | null
          phone?: string | null
          signup_source?: string
          slug?: string
          state?: string | null
          trial_limit?: number
          unblocked_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number
          candidate_id: string
          created_at: string
          id: string
          method: string | null
          notes: string | null
          paid_at: string
        }
        Insert: {
          amount: number
          candidate_id: string
          created_at?: string
          id?: string
          method?: string | null
          notes?: string | null
          paid_at?: string
        }
        Update: {
          amount?: number
          candidate_id?: string
          created_at?: string
          id?: string
          method?: string | null
          notes?: string | null
          paid_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidate_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "public_candidate_basics"
            referencedColumns: ["id"]
          },
        ]
      }
      pending_meta_oauth_states: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          state: string
          used_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string
          id?: string
          state: string
          used_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          state?: string
          used_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      social_connections: {
        Row: {
          access_token: string | null
          created_at: string
          expires_at: string | null
          id: string
          instagram_business_id: string | null
          instagram_picture_url: string | null
          instagram_username: string | null
          metadata: Json
          page_id: string | null
          page_name: string | null
          page_picture_url: string | null
          platform: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          instagram_business_id?: string | null
          instagram_picture_url?: string | null
          instagram_username?: string | null
          metadata?: Json
          page_id?: string | null
          page_name?: string | null
          page_picture_url?: string | null
          platform?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          instagram_business_id?: string | null
          instagram_picture_url?: string | null
          instagram_username?: string | null
          metadata?: Json
          page_id?: string | null
          page_name?: string | null
          page_picture_url?: string | null
          platform?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      social_insights_cache: {
        Row: {
          cache_key: string
          connection_id: string
          data: Json
          expires_at: string
          fetched_at: string
          id: string
          period: string
          user_id: string
        }
        Insert: {
          cache_key: string
          connection_id: string
          data?: Json
          expires_at: string
          fetched_at?: string
          id?: string
          period: string
          user_id: string
        }
        Update: {
          cache_key?: string
          connection_id?: string
          data?: Json
          expires_at?: string
          fetched_at?: string
          id?: string
          period?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "social_insights_cache_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "social_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          candidate_id: string
          created_at: string
          due_date: string | null
          id: string
          monthly_amount: number | null
          status: string
          updated_at: string
        }
        Insert: {
          candidate_id: string
          created_at?: string
          due_date?: string | null
          id?: string
          monthly_amount?: number | null
          status?: string
          updated_at?: string
        }
        Update: {
          candidate_id?: string
          created_at?: string
          due_date?: string | null
          id?: string
          monthly_amount?: number | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: true
            referencedRelation: "candidate_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: true
            referencedRelation: "public_candidate_basics"
            referencedColumns: ["id"]
          },
        ]
      }
      templates: {
        Row: {
          background_transform: Json
          background_url: string | null
          base_circle_transform: Json
          base_circle_url: string | null
          candidate_id: string
          created_at: string
          element_transform: Json
          element_url: string | null
          generation_count: number
          id: string
          is_active: boolean
          logo_transform: Json
          logo_url: string | null
          name: string
          photo_circle: Json
          updated_at: string
        }
        Insert: {
          background_transform?: Json
          background_url?: string | null
          base_circle_transform?: Json
          base_circle_url?: string | null
          candidate_id: string
          created_at?: string
          element_transform?: Json
          element_url?: string | null
          generation_count?: number
          id?: string
          is_active?: boolean
          logo_transform?: Json
          logo_url?: string | null
          name: string
          photo_circle?: Json
          updated_at?: string
        }
        Update: {
          background_transform?: Json
          background_url?: string | null
          base_circle_transform?: Json
          base_circle_url?: string | null
          candidate_id?: string
          created_at?: string
          element_transform?: Json
          element_url?: string | null
          generation_count?: number
          id?: string
          is_active?: boolean
          logo_transform?: Json
          logo_url?: string | null
          name?: string
          photo_circle?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "templates_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidate_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "templates_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "public_candidate_basics"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      voter_leads: {
        Row: {
          candidate_id: string
          created_at: string
          full_name: string
          id: string
          neighborhood: string
          number: string
          phone: string
          street: string
          template_id: string | null
        }
        Insert: {
          candidate_id: string
          created_at?: string
          full_name: string
          id?: string
          neighborhood: string
          number: string
          phone: string
          street: string
          template_id?: string | null
        }
        Update: {
          candidate_id?: string
          created_at?: string
          full_name?: string
          id?: string
          neighborhood?: string
          number?: string
          phone?: string
          street?: string
          template_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "voter_leads_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidate_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "voter_leads_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "public_candidate_basics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "voter_leads_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "templates"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_broadcast_recipients: {
        Row: {
          broadcast_id: string
          created_at: string
          display_name: string | null
          error_message: string | null
          id: string
          jid: string
          message_id: string | null
          sent_at: string | null
          status: Database["public"]["Enums"]["whatsapp_recipient_status"]
          variables: Json
        }
        Insert: {
          broadcast_id: string
          created_at?: string
          display_name?: string | null
          error_message?: string | null
          id?: string
          jid: string
          message_id?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["whatsapp_recipient_status"]
          variables?: Json
        }
        Update: {
          broadcast_id?: string
          created_at?: string
          display_name?: string | null
          error_message?: string | null
          id?: string
          jid?: string
          message_id?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["whatsapp_recipient_status"]
          variables?: Json
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_broadcast_recipients_broadcast_id_fkey"
            columns: ["broadcast_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_broadcasts"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_broadcasts: {
        Row: {
          allowed_weekdays: number[]
          append_optout_footer: boolean
          candidate_id: string
          created_at: string
          daily_cap: number
          daytime_windows: Json
          failed_count: number
          finished_at: string | null
          hour_cap: number
          id: string
          interval_max_seconds: number
          interval_min_seconds: number
          long_pause_every: number
          long_pause_seconds_max: number
          long_pause_seconds_min: number
          media_url: string | null
          media_urls: string[]
          message_text: string
          name: string
          next_send_at: string | null
          recipient_cooldown_hours: number
          respect_quiet_hours: boolean
          sent_count: number
          shuffle_recipients: boolean
          simulate_typing: boolean
          skipped_count: number
          started_at: string | null
          status: Database["public"]["Enums"]["whatsapp_broadcast_status"]
          target_type: Database["public"]["Enums"]["whatsapp_target_type"]
          total: number
          updated_at: string
        }
        Insert: {
          allowed_weekdays?: number[]
          append_optout_footer?: boolean
          candidate_id: string
          created_at?: string
          daily_cap?: number
          daytime_windows?: Json
          failed_count?: number
          finished_at?: string | null
          hour_cap?: number
          id?: string
          interval_max_seconds?: number
          interval_min_seconds?: number
          long_pause_every?: number
          long_pause_seconds_max?: number
          long_pause_seconds_min?: number
          media_url?: string | null
          media_urls?: string[]
          message_text: string
          name: string
          next_send_at?: string | null
          recipient_cooldown_hours?: number
          respect_quiet_hours?: boolean
          sent_count?: number
          shuffle_recipients?: boolean
          simulate_typing?: boolean
          skipped_count?: number
          started_at?: string | null
          status?: Database["public"]["Enums"]["whatsapp_broadcast_status"]
          target_type?: Database["public"]["Enums"]["whatsapp_target_type"]
          total?: number
          updated_at?: string
        }
        Update: {
          allowed_weekdays?: number[]
          append_optout_footer?: boolean
          candidate_id?: string
          created_at?: string
          daily_cap?: number
          daytime_windows?: Json
          failed_count?: number
          finished_at?: string | null
          hour_cap?: number
          id?: string
          interval_max_seconds?: number
          interval_min_seconds?: number
          long_pause_every?: number
          long_pause_seconds_max?: number
          long_pause_seconds_min?: number
          media_url?: string | null
          media_urls?: string[]
          message_text?: string
          name?: string
          next_send_at?: string | null
          recipient_cooldown_hours?: number
          respect_quiet_hours?: boolean
          sent_count?: number
          shuffle_recipients?: boolean
          simulate_typing?: boolean
          skipped_count?: number
          started_at?: string | null
          status?: Database["public"]["Enums"]["whatsapp_broadcast_status"]
          target_type?: Database["public"]["Enums"]["whatsapp_target_type"]
          total?: number
          updated_at?: string
        }
        Relationships: []
      }
      whatsapp_chats: {
        Row: {
          candidate_id: string
          created_at: string
          id: string
          is_group: boolean
          jid: string
          last_message_at: string | null
          last_message_from_me: boolean | null
          last_message_text: string | null
          name: string | null
          unread_count: number
        }
        Insert: {
          candidate_id: string
          created_at?: string
          id?: string
          is_group?: boolean
          jid: string
          last_message_at?: string | null
          last_message_from_me?: boolean | null
          last_message_text?: string | null
          name?: string | null
          unread_count?: number
        }
        Update: {
          candidate_id?: string
          created_at?: string
          id?: string
          is_group?: boolean
          jid?: string
          last_message_at?: string | null
          last_message_from_me?: boolean | null
          last_message_text?: string | null
          name?: string | null
          unread_count?: number
        }
        Relationships: []
      }
      whatsapp_contacts: {
        Row: {
          candidate_id: string
          created_at: string
          id: string
          is_on_whatsapp: boolean | null
          jid: string
          last_checked_at: string | null
          last_synced_at: string
          name: string | null
          phone: string | null
          push_name: string | null
        }
        Insert: {
          candidate_id: string
          created_at?: string
          id?: string
          is_on_whatsapp?: boolean | null
          jid: string
          last_checked_at?: string | null
          last_synced_at?: string
          name?: string | null
          phone?: string | null
          push_name?: string | null
        }
        Update: {
          candidate_id?: string
          created_at?: string
          id?: string
          is_on_whatsapp?: boolean | null
          jid?: string
          last_checked_at?: string | null
          last_synced_at?: string
          name?: string | null
          phone?: string | null
          push_name?: string | null
        }
        Relationships: []
      }
      whatsapp_groups: {
        Row: {
          candidate_id: string
          created_at: string
          id: string
          is_admin: boolean
          is_favorite: boolean
          jid: string
          last_message_at: string | null
          last_synced_at: string
          name: string | null
          participants_count: number | null
        }
        Insert: {
          candidate_id: string
          created_at?: string
          id?: string
          is_admin?: boolean
          is_favorite?: boolean
          jid: string
          last_message_at?: string | null
          last_synced_at?: string
          name?: string | null
          participants_count?: number | null
        }
        Update: {
          candidate_id?: string
          created_at?: string
          id?: string
          is_admin?: boolean
          is_favorite?: boolean
          jid?: string
          last_message_at?: string | null
          last_synced_at?: string
          name?: string | null
          participants_count?: number | null
        }
        Relationships: []
      }
      whatsapp_instances: {
        Row: {
          api_key: string | null
          candidate_id: string
          created_at: string
          daily_cap: number
          hour_cap: number
          id: string
          instance_id: string | null
          last_connected_at: string | null
          last_qr: string | null
          name: string
          phone_number: string | null
          quiet_hours_end: number
          quiet_hours_start: number
          status: Database["public"]["Enums"]["whatsapp_instance_status"]
          updated_at: string
          warmup_day: number
          warmup_enabled: boolean
          warmup_started_at: string | null
          webhook_registered: boolean
        }
        Insert: {
          api_key?: string | null
          candidate_id: string
          created_at?: string
          daily_cap?: number
          hour_cap?: number
          id?: string
          instance_id?: string | null
          last_connected_at?: string | null
          last_qr?: string | null
          name: string
          phone_number?: string | null
          quiet_hours_end?: number
          quiet_hours_start?: number
          status?: Database["public"]["Enums"]["whatsapp_instance_status"]
          updated_at?: string
          warmup_day?: number
          warmup_enabled?: boolean
          warmup_started_at?: string | null
          webhook_registered?: boolean
        }
        Update: {
          api_key?: string | null
          candidate_id?: string
          created_at?: string
          daily_cap?: number
          hour_cap?: number
          id?: string
          instance_id?: string | null
          last_connected_at?: string | null
          last_qr?: string | null
          name?: string
          phone_number?: string | null
          quiet_hours_end?: number
          quiet_hours_start?: number
          status?: Database["public"]["Enums"]["whatsapp_instance_status"]
          updated_at?: string
          warmup_day?: number
          warmup_enabled?: boolean
          warmup_started_at?: string | null
          webhook_registered?: boolean
        }
        Relationships: []
      }
      whatsapp_messages: {
        Row: {
          candidate_id: string
          created_at: string
          from_me: boolean
          id: string
          jid: string
          media_filename: string | null
          media_mime: string | null
          media_size: number | null
          media_url: string | null
          message_id: string
          message_type: string
          push_name: string | null
          text: string | null
          ts: string
        }
        Insert: {
          candidate_id: string
          created_at?: string
          from_me?: boolean
          id?: string
          jid: string
          media_filename?: string | null
          media_mime?: string | null
          media_size?: number | null
          media_url?: string | null
          message_id: string
          message_type?: string
          push_name?: string | null
          text?: string | null
          ts?: string
        }
        Update: {
          candidate_id?: string
          created_at?: string
          from_me?: boolean
          id?: string
          jid?: string
          media_filename?: string | null
          media_mime?: string | null
          media_size?: number | null
          media_url?: string | null
          message_id?: string
          message_type?: string
          push_name?: string | null
          text?: string | null
          ts?: string
        }
        Relationships: []
      }
      whatsapp_optouts: {
        Row: {
          candidate_id: string
          created_at: string
          id: string
          jid: string
          reason: string | null
        }
        Insert: {
          candidate_id: string
          created_at?: string
          id?: string
          jid: string
          reason?: string | null
        }
        Update: {
          candidate_id?: string
          created_at?: string
          id?: string
          jid?: string
          reason?: string | null
        }
        Relationships: []
      }
      whatsapp_send_log: {
        Row: {
          broadcast_id: string | null
          candidate_id: string
          created_at: string
          id: string
          jid: string
          status: string
        }
        Insert: {
          broadcast_id?: string | null
          candidate_id: string
          created_at?: string
          id?: string
          jid: string
          status: string
        }
        Update: {
          broadcast_id?: string | null
          candidate_id?: string
          created_at?: string
          id?: string
          jid?: string
          status?: string
        }
        Relationships: []
      }
    }
    Views: {
      public_app_settings: {
        Row: {
          id: number | null
          pix_key: string | null
          pix_owner_name: string | null
          pix_qr_url: string | null
          updated_at: string | null
          whatsapp_number: string | null
        }
        Insert: {
          id?: number | null
          pix_key?: string | null
          pix_owner_name?: string | null
          pix_qr_url?: string | null
          updated_at?: string | null
          whatsapp_number?: string | null
        }
        Update: {
          id?: number | null
          pix_key?: string | null
          pix_owner_name?: string | null
          pix_qr_url?: string | null
          updated_at?: string | null
          whatsapp_number?: string | null
        }
        Relationships: []
      }
      public_candidate_basics: {
        Row: {
          full_name: string | null
          id: string | null
          is_blocked: boolean | null
          slug: string | null
        }
        Insert: {
          full_name?: string | null
          id?: string | null
          is_blocked?: boolean | null
          slug?: string | null
        }
        Update: {
          full_name?: string | null
          id?: string | null
          is_blocked?: boolean | null
          slug?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      _slugify: { Args: { input: string }; Returns: string }
      get_public_candidate: {
        Args: { _slug: string }
        Returns: {
          full_name: string
          id: string
          slug: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_template_generation: {
        Args: { _template_id: string }
        Returns: undefined
      }
      set_active_template: {
        Args: { _template_id: string }
        Returns: undefined
      }
      unaccent: { Args: { "": string }; Returns: string }
      unset_active_template: {
        Args: { _template_id: string }
        Returns: undefined
      }
      wa_warmup_cap: { Args: { _day: number }; Returns: number }
    }
    Enums: {
      app_role: "admin" | "candidate"
      whatsapp_broadcast_status:
        | "draft"
        | "running"
        | "paused"
        | "completed"
        | "failed"
      whatsapp_instance_status: "connecting" | "connected" | "disconnected"
      whatsapp_recipient_status: "pending" | "sent" | "failed" | "skipped"
      whatsapp_target_type:
        | "contacts"
        | "groups"
        | "leads"
        | "manual_list"
        | "mixed"
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
      app_role: ["admin", "candidate"],
      whatsapp_broadcast_status: [
        "draft",
        "running",
        "paused",
        "completed",
        "failed",
      ],
      whatsapp_instance_status: ["connecting", "connected", "disconnected"],
      whatsapp_recipient_status: ["pending", "sent", "failed", "skipped"],
      whatsapp_target_type: [
        "contacts",
        "groups",
        "leads",
        "manual_list",
        "mixed",
      ],
    },
  },
} as const
