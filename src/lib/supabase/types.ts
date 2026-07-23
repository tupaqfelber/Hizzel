// Generated from the live project — do not hand-edit the Database type.
// Regenerate with: supabase gen types typescript --linked
//
// npx supabase gen types typescript --linked

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
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      areas: {
        Row: {
          created_at: string
          id: string
          is_locked: boolean
          name: string
          property_id: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          id?: string
          is_locked?: boolean
          name: string
          property_id: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          id?: string
          is_locked?: boolean
          name?: string
          property_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "areas_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      moves: {
        Row: {
          created_at: string
          id: string
          is_example: boolean
          move_date: string | null
          mover_name: string | null
          mover_phone: string | null
          notes: string | null
          status: Database["public"]["Enums"]["move_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_example?: boolean
          move_date?: string | null
          mover_name?: string | null
          mover_phone?: string | null
          notes?: string | null
          status?: Database["public"]["Enums"]["move_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_example?: boolean
          move_date?: string | null
          mover_name?: string | null
          mover_phone?: string | null
          notes?: string | null
          status?: Database["public"]["Enums"]["move_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "moves_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      placements: {
        Row: {
          created_at: string
          id: string
          move_id: string
          room_id: string | null
          rotation_deg: number
          thing_id: string
          updated_at: string
          x_cm: number | null
          y_cm: number | null
        }
        Insert: {
          created_at?: string
          id?: string
          move_id: string
          room_id?: string | null
          rotation_deg?: number
          thing_id: string
          updated_at?: string
          x_cm?: number | null
          y_cm?: number | null
        }
        Update: {
          created_at?: string
          id?: string
          move_id?: string
          room_id?: string | null
          rotation_deg?: number
          thing_id?: string
          updated_at?: string
          x_cm?: number | null
          y_cm?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "placements_move_id_fkey"
            columns: ["move_id"]
            isOneToOne: false
            referencedRelation: "moves"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "placements_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "placements_thing_id_fkey"
            columns: ["thing_id"]
            isOneToOne: false
            referencedRelation: "things"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          id: string
          onboarded: boolean
          plan_tier: Database["public"]["Enums"]["plan_tier"]
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id: string
          onboarded?: boolean
          plan_tier?: Database["public"]["Enums"]["plan_tier"]
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          onboarded?: boolean
          plan_tier?: Database["public"]["Enums"]["plan_tier"]
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
        }
        Relationships: []
      }
      properties: {
        Row: {
          address: string
          created_at: string
          id: string
          move_id: string
          nickname: string
          photo_url: string | null
          role: Database["public"]["Enums"]["property_role"]
        }
        Insert: {
          address: string
          created_at?: string
          id?: string
          move_id: string
          nickname: string
          photo_url?: string | null
          role: Database["public"]["Enums"]["property_role"]
        }
        Update: {
          address?: string
          created_at?: string
          id?: string
          move_id?: string
          nickname?: string
          photo_url?: string | null
          role?: Database["public"]["Enums"]["property_role"]
        }
        Relationships: [
          {
            foreignKeyName: "properties_move_id_fkey"
            columns: ["move_id"]
            isOneToOne: false
            referencedRelation: "moves"
            referencedColumns: ["id"]
          },
        ]
      }
      rooms: {
        Row: {
          area_id: string
          canvas_x: number
          canvas_y: number
          created_at: string
          depth_cm: number
          id: string
          name: string
          rotation_deg: number
          updated_at: string
          width_cm: number
        }
        Insert: {
          area_id: string
          canvas_x?: number
          canvas_y?: number
          created_at?: string
          depth_cm: number
          id?: string
          name: string
          rotation_deg?: number
          updated_at?: string
          width_cm: number
        }
        Update: {
          area_id?: string
          canvas_x?: number
          canvas_y?: number
          created_at?: string
          depth_cm?: number
          id?: string
          name?: string
          rotation_deg?: number
          updated_at?: string
          width_cm?: number
        }
        Relationships: [
          {
            foreignKeyName: "rooms_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "areas"
            referencedColumns: ["id"]
          },
        ]
      }
      structural_elements: {
        Row: {
          created_at: string
          id: string
          offset_cm: number
          room_id: string
          type: Database["public"]["Enums"]["structural_type"]
          wall_side: Database["public"]["Enums"]["wall_side"]
          width_cm: number
        }
        Insert: {
          created_at?: string
          id?: string
          offset_cm: number
          room_id: string
          type: Database["public"]["Enums"]["structural_type"]
          wall_side: Database["public"]["Enums"]["wall_side"]
          width_cm: number
        }
        Update: {
          created_at?: string
          id?: string
          offset_cm?: number
          room_id?: string
          type?: Database["public"]["Enums"]["structural_type"]
          wall_side?: Database["public"]["Enums"]["wall_side"]
          width_cm?: number
        }
        Relationships: [
          {
            foreignKeyName: "structural_elements_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      things: {
        Row: {
          category: Database["public"]["Enums"]["thing_category"]
          created_at: string
          depth_cm: number
          height_cm: number
          id: string
          name: string
          notes: string | null
          photo_url: string | null
          updated_at: string
          user_id: string
          width_cm: number
        }
        Insert: {
          category?: Database["public"]["Enums"]["thing_category"]
          created_at?: string
          depth_cm: number
          height_cm: number
          id?: string
          name: string
          notes?: string | null
          photo_url?: string | null
          updated_at?: string
          user_id: string
          width_cm: number
        }
        Update: {
          category?: Database["public"]["Enums"]["thing_category"]
          created_at?: string
          depth_cm?: number
          height_cm?: number
          id?: string
          name?: string
          notes?: string | null
          photo_url?: string | null
          updated_at?: string
          user_id?: string
          width_cm?: number
        }
        Relationships: [
          {
            foreignKeyName: "things_user_id_fkey"
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
      seed_example_content: { Args: { p_user_id: string }; Returns: undefined }
    }
    Enums: {
      move_status: "current" | "archived"
      plan_tier: "free" | "paid"
      property_role: "current" | "new"
      structural_type: "door" | "window"
      thing_category:
        | "Appliances"
        | "Beds"
        | "Boxes"
        | "Lighting"
        | "Other"
        | "Seating"
        | "Shelving"
        | "Storage"
        | "Tables"
      wall_side: "n" | "e" | "s" | "w"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      move_status: ["current", "archived"],
      plan_tier: ["free", "paid"],
      property_role: ["current", "new"],
      structural_type: ["door", "window"],
      thing_category: [
        "Appliances",
        "Beds",
        "Boxes",
        "Lighting",
        "Other",
        "Seating",
        "Shelving",
        "Storage",
        "Tables",
      ],
      wall_side: ["n", "e", "s", "w"],
    },
  },
} as const

// Convenience aliases used throughout the app (kept stable across regenerations).
export type MoveStatus = Database["public"]["Enums"]["move_status"]
export type PropertyRole = Database["public"]["Enums"]["property_role"]
export type ThingCategory = Database["public"]["Enums"]["thing_category"]
export type StructuralType = Database["public"]["Enums"]["structural_type"]
export type WallSide = Database["public"]["Enums"]["wall_side"]
export type PlanTier = Database["public"]["Enums"]["plan_tier"]
