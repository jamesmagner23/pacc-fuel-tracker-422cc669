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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      buy_prices: {
        Row: {
          created_at: string | null
          id: string
          notes: string | null
          price_date: string
          price_per_litre: number
          supplier: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          notes?: string | null
          price_date: string
          price_per_litre: number
          supplier?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          notes?: string | null
          price_date?: string
          price_per_litre?: number
          supplier?: string | null
        }
        Relationships: []
      }
      client_accounts: {
        Row: {
          auth_user_id: string | null
          company_name: string
          contact_email: string
          contact_name: string | null
          contact_phone: string | null
          created_at: string | null
          id: number
          is_active: boolean | null
          updated_at: string | null
        }
        Insert: {
          auth_user_id?: string | null
          company_name: string
          contact_email: string
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string | null
          id?: never
          is_active?: boolean | null
          updated_at?: string | null
        }
        Update: {
          auth_user_id?: string | null
          company_name?: string
          contact_email?: string
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string | null
          id?: never
          is_active?: boolean | null
          updated_at?: string | null
        }
        Relationships: []
      }
      client_portal_settings: {
        Row: {
          client_account_id: number | null
          created_at: string | null
          delivery_notification: boolean | null
          id: number
          monthly_summary_email: boolean | null
          weekly_summary_email: boolean | null
        }
        Insert: {
          client_account_id?: number | null
          created_at?: string | null
          delivery_notification?: boolean | null
          id?: never
          monthly_summary_email?: boolean | null
          weekly_summary_email?: boolean | null
        }
        Update: {
          client_account_id?: number | null
          created_at?: string | null
          delivery_notification?: boolean | null
          id?: never
          monthly_summary_email?: boolean | null
          weekly_summary_email?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "client_portal_settings_client_account_id_fkey"
            columns: ["client_account_id"]
            isOneToOne: false
            referencedRelation: "client_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      sync_log: {
        Row: {
          error_message: string | null
          id: number
          records_fetched: number | null
          records_upserted: number | null
          status: string | null
          synced_at: string | null
        }
        Insert: {
          error_message?: string | null
          id?: never
          records_fetched?: number | null
          records_upserted?: number | null
          status?: string | null
          synced_at?: string | null
        }
        Update: {
          error_message?: string | null
          id?: never
          records_fetched?: number | null
          records_upserted?: number | null
          status?: string | null
          synced_at?: string | null
        }
        Relationships: []
      }
      transactions: {
        Row: {
          cantidad: number | null
          cantidad_neta: number | null
          ciudad: string | null
          created_at: string | null
          date: string | null
          dinero_total: number | null
          documento_cliente1: string | null
          estacion: string | null
          factura: number | null
          fecha: string
          forma_de_pago: string | null
          id: number
          id_surtidor: number | null
          identificador_cliente1: string | null
          manguera: string | null
          nombre_cliente1: string | null
          nombre_flota: string | null
          nombre_flota_doc: string | null
          nombre_vendedor: string | null
          nombre_vendedor_id: string | null
          placa: string | null
          ppu: number | null
          producto: string | null
          region: string | null
          surtidor: string | null
          totalizador_bruto: number | null
        }
        Insert: {
          cantidad?: number | null
          cantidad_neta?: number | null
          ciudad?: string | null
          created_at?: string | null
          date?: string | null
          dinero_total?: number | null
          documento_cliente1?: string | null
          estacion?: string | null
          factura?: number | null
          fecha: string
          forma_de_pago?: string | null
          id: number
          id_surtidor?: number | null
          identificador_cliente1?: string | null
          manguera?: string | null
          nombre_cliente1?: string | null
          nombre_flota?: string | null
          nombre_flota_doc?: string | null
          nombre_vendedor?: string | null
          nombre_vendedor_id?: string | null
          placa?: string | null
          ppu?: number | null
          producto?: string | null
          region?: string | null
          surtidor?: string | null
          totalizador_bruto?: number | null
        }
        Update: {
          cantidad?: number | null
          cantidad_neta?: number | null
          ciudad?: string | null
          created_at?: string | null
          date?: string | null
          dinero_total?: number | null
          documento_cliente1?: string | null
          estacion?: string | null
          factura?: number | null
          fecha?: string
          forma_de_pago?: string | null
          id?: number
          id_surtidor?: number | null
          identificador_cliente1?: string | null
          manguera?: string | null
          nombre_cliente1?: string | null
          nombre_flota?: string | null
          nombre_flota_doc?: string | null
          nombre_vendedor?: string | null
          nombre_vendedor_id?: string | null
          placa?: string | null
          ppu?: number | null
          producto?: string | null
          region?: string | null
          surtidor?: string | null
          totalizador_bruto?: number | null
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
      get_client_company_name: { Args: { _user_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "client"
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
      app_role: ["admin", "client"],
    },
  },
} as const
