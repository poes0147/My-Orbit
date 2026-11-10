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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      ai_interview_sessions: {
        Row: {
          answers: Json
          created_at: string
          id: string
          status: string
          updated_at: string
          user_id: string
          workshop_session_id: string | null
        }
        Insert: {
          answers?: Json
          created_at?: string
          id?: string
          status?: string
          updated_at?: string
          user_id: string
          workshop_session_id?: string | null
        }
        Update: {
          answers?: Json
          created_at?: string
          id?: string
          status?: string
          updated_at?: string
          user_id?: string
          workshop_session_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_interview_sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_interview_sessions_workshop_session_id_fkey"
            columns: ["workshop_session_id"]
            isOneToOne: false
            referencedRelation: "workshop_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      clay_materials: {
        Row: {
          code: string
          color_code: string
          created_at: string
          description: string
          display_order: number
          id: string
          is_active: boolean
          name: string
          type: string
          updated_at: string
        }
        Insert: {
          code: string
          color_code: string
          created_at?: string
          description?: string
          display_order?: number
          id?: string
          is_active?: boolean
          name: string
          type: string
          updated_at?: string
        }
        Update: {
          code?: string
          color_code?: string
          created_at?: string
          description?: string
          display_order?: number
          id?: string
          is_active?: boolean
          name?: string
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      clay_recipe_items: {
        Row: {
          material_id: string
          parts: number
          recipe_id: string
        }
        Insert: {
          material_id: string
          parts: number
          recipe_id: string
        }
        Update: {
          material_id?: string
          parts?: number
          recipe_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "clay_recipe_items_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "clay_materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clay_recipe_items_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "clay_recipes"
            referencedColumns: ["id"]
          },
        ]
      }
      clay_recipes: {
        Row: {
          created_at: string
          description: string
          id: string
          is_active: boolean
          result_color_code: string
          result_name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string
          id?: string
          is_active?: boolean
          result_color_code: string
          result_name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          is_active?: boolean
          result_color_code?: string
          result_name?: string
          updated_at?: string
        }
        Relationships: []
      }
      contact_cards: {
        Row: { id: string; user_id: string; card_name: string; display_name: string; phone_number: string | null; email: string | null; organization_name: string | null; job_title: string | null; website_url: string | null; created_at: string; updated_at: string }
        Insert: { id?: string; user_id: string; card_name: string; display_name: string; phone_number?: string | null; email?: string | null; organization_name?: string | null; job_title?: string | null; website_url?: string | null; created_at?: string; updated_at?: string }
        Update: { id?: string; user_id?: string; card_name?: string; display_name?: string; phone_number?: string | null; email?: string | null; organization_name?: string | null; job_title?: string | null; website_url?: string | null; created_at?: string; updated_at?: string }
        Relationships: []
      }
      nfc_tags: {
        Row: {
          claim_code_hash: string | null
          created_at: string
          custom_url: string | null
          is_active: boolean
          mapped_at: string | null
          profile_id: string | null
          owner_id: string | null
          card_id: string | null
          alias: string | null
          tag_id: string
          target_type: Database["public"]["Enums"]["nfc_target_type"]
          updated_at: string
        }
        Insert: {
          claim_code_hash?: string | null
          created_at?: string
          custom_url?: string | null
          is_active?: boolean
          mapped_at?: string | null
          profile_id?: string | null
          owner_id?: string | null
          card_id?: string | null
          alias?: string | null
          tag_id: string
          target_type?: Database["public"]["Enums"]["nfc_target_type"]
          updated_at?: string
        }
        Update: {
          claim_code_hash?: string | null
          created_at?: string
          custom_url?: string | null
          is_active?: boolean
          mapped_at?: string | null
          profile_id?: string | null
          owner_id?: string | null
          card_id?: string | null
          alias?: string | null
          tag_id?: string
          target_type?: Database["public"]["Enums"]["nfc_target_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "nfc_tags_card_owner_fkey"
            columns: ["card_id", "owner_id"]
            isOneToOne: false
            referencedRelation: "contact_cards"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "nfc_tags_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string
          competency_tags: string[]
          contact_email: string | null
          contact_phone: string | null
          created_at: string
          display_name: string | null
          headline: string
          id: string
          is_published: boolean
          last_draft_commit_key: string | null
          slug: string
          theme_preset: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          bio?: string
          competency_tags?: string[]
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          display_name?: string | null
          headline?: string
          id?: string
          is_published?: boolean
          last_draft_commit_key?: string | null
          slug: string
          theme_preset?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          bio?: string
          competency_tags?: string[]
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          display_name?: string | null
          headline?: string
          id?: string
          is_published?: boolean
          last_draft_commit_key?: string | null
          slug?: string
          theme_preset?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      project_items: {
        Row: {
          star_card: Json | null
          created_at: string
          description: string
          id: string
          is_draft_derived: boolean
          link_url: string | null
          profile_id: string
          sort_order: number
          title: string
          updated_at: string
        }
        Insert: {
          star_card?: Json | null
          created_at?: string
          description?: string
          id?: string
          is_draft_derived?: boolean
          link_url?: string | null
          profile_id: string
          sort_order?: number
          title: string
          updated_at?: string
        }
        Update: {
          star_card?: Json | null
          created_at?: string
          description?: string
          id?: string
          is_draft_derived?: boolean
          link_url?: string | null
          profile_id?: string
          sort_order?: number
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_items_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      resume_documents: {
        Row: {
          created_at: string
          expires_at: string
          file_name: string
          id: string
          mime_type: string
          parsed_content: Json | null
          size_bytes: number
          source_type: string
          storage_path: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string
          file_name: string
          id?: string
          mime_type: string
          parsed_content?: Json | null
          size_bytes: number
          source_type?: string
          storage_path?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          file_name?: string
          id?: string
          mime_type?: string
          parsed_content?: Json | null
          size_bytes?: number
          source_type?: string
          storage_path?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "resume_documents_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          id: string
          name: string
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          id: string
          name: string
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          id?: string
          name?: string
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Relationships: []
      }
      workshop_participants: {
        Row: {
          is_current: boolean
          joined_at: string
          user_id: string
          workshop_session_id: string
        }
        Insert: {
          is_current?: boolean
          joined_at?: string
          user_id: string
          workshop_session_id: string
        }
        Update: {
          is_current?: boolean
          joined_at?: string
          user_id?: string
          workshop_session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workshop_participants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workshop_participants_workshop_session_id_fkey"
            columns: ["workshop_session_id"]
            isOneToOne: false
            referencedRelation: "workshop_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      workshop_sessions: {
        Row: {
          created_at: string
          created_by: string | null
          expires_at: string
          id: string
          max_capacity: number
          organization_name: string
          session_code: string
          starts_at: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          expires_at: string
          id?: string
          max_capacity?: number
          organization_name: string
          session_code: string
          starts_at?: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          expires_at?: string
          id?: string
          max_capacity?: number
          organization_name?: string
          session_code?: string
          starts_at?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "workshop_sessions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
        bind_nfc_tag: {
          Args: { p_tag_id: string; p_registration_code: string; p_ip_hash: string }
          Returns: { result_code: string; public_slug: string | null; mapped_at: string | null }[]
        }
      claim_project_card_attempt: { Args: { p_ip_hash: string }; Returns: boolean }
      claim_resume_analysis_attempt: {
        Args: { p_ip_hash: string }
        Returns: boolean
      }
      commit_draft_to_profile: {
        Args: {
          p_draft_session_id: string
          p_existing_profile_id: string
          p_expected_content: Json
          p_idempotency_key: string
        }
        Returns: Json
      }
      current_workshop_session_id: { Args: never; Returns: string }
      get_current_workshop_session: { Args: never; Returns: Json }
      join_workshop_session: { Args: { p_code: string }; Returns: Json }
      profile_owner_status: { Args: { p_profile_id: string }; Returns: string }
        get_nfc_contact: { Args: { p_tag_id: string }; Returns: { display_name: string; phone_number: string | null; email: string | null; organization_name: string | null; job_title: string | null; website_url: string | null }[] }
        save_contact_card: { Args: { p_card_id: string | null; p_data: Json }; Returns: string }
        delete_contact_card: { Args: { p_card_id: string }; Returns: boolean }
        set_nfc_destination: { Args: { p_tag_id: string; p_target: Database["public"]["Enums"]["nfc_target_type"]; p_custom_url?: string | null; p_card_id?: string | null; p_alias?: string | null; p_acknowledged?: boolean }; Returns: boolean }
        resolve_nfc_tag: {
          Args: { p_tag_id: string }
          Returns: { tag_status: string; public_slug: string | null; external_url: string | null }[]
        }
      save_clay_recipe: {
        Args: { p_id: string; p_items: Json; p_recipe: Json }
        Returns: string
      }
      verify_workshop_code: { Args: { p_code: string }; Returns: Json }
    }
    Enums: {
        nfc_target_type: "profile" | "custom_url" | "contact_card" | "none"
      user_role: "participant" | "instructor" | "admin"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      nfc_target_type: ["profile", "custom_url", "contact_card", "none"],
      user_role: ["participant", "instructor", "admin"],
    },
  },
} as const
