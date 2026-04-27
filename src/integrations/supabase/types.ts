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
      auth_activity_log: {
        Row: {
          action: string
          created_at: string | null
          id: string
          metadata: Json | null
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string | null
          id?: string
          metadata?: Json | null
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string | null
          id?: string
          metadata?: Json | null
          user_id?: string
        }
        Relationships: []
      }
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
          speedsol_name: string | null
          speedsol_names: string[] | null
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
          speedsol_name?: string | null
          speedsol_names?: string[] | null
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
          speedsol_name?: string | null
          speedsol_names?: string[] | null
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
      customer_pricing: {
        Row: {
          client_account_id: number
          created_at: string | null
          id: string
          margin_percent: number
          max_litres: number | null
          min_litres: number
          notes: string | null
          payment_terms: string
          pricing_type: string
          updated_at: string | null
          weekly_volume_tier: string
        }
        Insert: {
          client_account_id: number
          created_at?: string | null
          id?: string
          margin_percent?: number
          max_litres?: number | null
          min_litres?: number
          notes?: string | null
          payment_terms?: string
          pricing_type?: string
          updated_at?: string | null
          weekly_volume_tier?: string
        }
        Update: {
          client_account_id?: number
          created_at?: string | null
          id?: string
          margin_percent?: number
          max_litres?: number | null
          min_litres?: number
          notes?: string | null
          payment_terms?: string
          pricing_type?: string
          updated_at?: string | null
          weekly_volume_tier?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_pricing_client_account_id_fkey"
            columns: ["client_account_id"]
            isOneToOne: false
            referencedRelation: "client_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_requests: {
        Row: {
          client_account_id: number
          created_at: string
          created_by: string | null
          estimated_litres: number | null
          id: string
          notes: string | null
          preferred_date: string
          site_name: string
          status: string
          updated_at: string
        }
        Insert: {
          client_account_id: number
          created_at?: string
          created_by?: string | null
          estimated_litres?: number | null
          id?: string
          notes?: string | null
          preferred_date: string
          site_name: string
          status?: string
          updated_at?: string
        }
        Update: {
          client_account_id?: number
          created_at?: string
          created_by?: string | null
          estimated_litres?: number | null
          id?: string
          notes?: string | null
          preferred_date?: string
          site_name?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      demo_leads: {
        Row: {
          brand_param: string | null
          color_param: string | null
          company_name: string
          created_at: string
          email: string
          full_name: string
          id: string
          phone: string | null
        }
        Insert: {
          brand_param?: string | null
          color_param?: string | null
          company_name: string
          created_at?: string
          email: string
          full_name: string
          id?: string
          phone?: string | null
        }
        Update: {
          brand_param?: string | null
          color_param?: string | null
          company_name?: string
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          phone?: string | null
        }
        Relationships: []
      }
      ftc_rates: {
        Row: {
          created_at: string
          display_order: number
          effective_from: string
          equipment_type: string
          id: string
          notes: string | null
          rate_per_litre: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_order?: number
          effective_from?: string
          equipment_type: string
          id?: string
          notes?: string | null
          rate_per_litre: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_order?: number
          effective_from?: string
          equipment_type?: string
          id?: string
          notes?: string | null
          rate_per_litre?: number
          updated_at?: string
        }
        Relationships: []
      }
      fuel_intake_logs: {
        Row: {
          bowser_retail_price: number | null
          created_at: string | null
          driver_user_id: string
          id: string
          litres_entered: number
          log_date: string
          notes: string | null
          photo_path: string | null
        }
        Insert: {
          bowser_retail_price?: number | null
          created_at?: string | null
          driver_user_id: string
          id?: string
          litres_entered: number
          log_date?: string
          notes?: string | null
          photo_path?: string | null
        }
        Update: {
          bowser_retail_price?: number | null
          created_at?: string | null
          driver_user_id?: string
          id?: string
          litres_entered?: number
          log_date?: string
          notes?: string | null
          photo_path?: string | null
        }
        Relationships: []
      }
      market_briefings: {
        Row: {
          briefing_date: string
          content: string
          created_at: string
          id: string
          market_data: Json | null
          status: string
        }
        Insert: {
          briefing_date?: string
          content: string
          created_at?: string
          id?: string
          market_data?: Json | null
          status?: string
        }
        Update: {
          briefing_date?: string
          content?: string
          created_at?: string
          id?: string
          market_data?: Json | null
          status?: string
        }
        Relationships: []
      }
      market_metrics: {
        Row: {
          created_at: string
          id: string
          metric_date: string
          metric_name: string
          previous_value: number | null
          source: string
          updated_at: string
          value: number
        }
        Insert: {
          created_at?: string
          id?: string
          metric_date?: string
          metric_name: string
          previous_value?: number | null
          source?: string
          updated_at?: string
          value: number
        }
        Update: {
          created_at?: string
          id?: string
          metric_date?: string
          metric_name?: string
          previous_value?: number | null
          source?: string
          updated_at?: string
          value?: number
        }
        Relationships: []
      }
      plant_items: {
        Row: {
          client_account_id: number
          created_at: string
          description: string | null
          equipment_type: string | null
          ftc_rate_id: string | null
          id: string
          is_active: boolean
          name: string
          photo_url: string | null
          placa: string | null
          serial_number: string | null
          service_notes: string | null
          updated_at: string
        }
        Insert: {
          client_account_id: number
          created_at?: string
          description?: string | null
          equipment_type?: string | null
          ftc_rate_id?: string | null
          id?: string
          is_active?: boolean
          name: string
          photo_url?: string | null
          placa?: string | null
          serial_number?: string | null
          service_notes?: string | null
          updated_at?: string
        }
        Update: {
          client_account_id?: number
          created_at?: string
          description?: string | null
          equipment_type?: string | null
          ftc_rate_id?: string | null
          id?: string
          is_active?: boolean
          name?: string
          photo_url?: string | null
          placa?: string | null
          serial_number?: string | null
          service_notes?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "plant_items_client_account_id_fkey"
            columns: ["client_account_id"]
            isOneToOne: false
            referencedRelation: "client_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plant_items_ftc_rate_id_fkey"
            columns: ["ftc_rate_id"]
            isOneToOne: false
            referencedRelation: "ftc_rates"
            referencedColumns: ["id"]
          },
        ]
      }
      pricing_tiers: {
        Row: {
          created_at: string | null
          id: string
          margin_percent: number
          max_litres: number | null
          min_litres: number
          tier_name: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          margin_percent?: number
          max_litres?: number | null
          min_litres?: number
          tier_name: string
        }
        Update: {
          created_at?: string | null
          id?: string
          margin_percent?: number
          max_litres?: number | null
          min_litres?: number
          tier_name?: string
        }
        Relationships: []
      }
      project_plant_assignments: {
        Row: {
          assigned_at: string
          id: string
          plant_item_id: string
          project_id: string
          removed_at: string | null
        }
        Insert: {
          assigned_at?: string
          id?: string
          plant_item_id: string
          project_id: string
          removed_at?: string | null
        }
        Update: {
          assigned_at?: string
          id?: string
          plant_item_id?: string
          project_id?: string
          removed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_plant_assignments_plant_item_id_fkey"
            columns: ["plant_item_id"]
            isOneToOne: false
            referencedRelation: "plant_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_plant_assignments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          client_account_id: number
          created_at: string
          end_date: string | null
          id: string
          name: string
          notes: string | null
          site_address: string | null
          start_date: string | null
          status: string
          updated_at: string
        }
        Insert: {
          client_account_id: number
          created_at?: string
          end_date?: string | null
          id?: string
          name: string
          notes?: string | null
          site_address?: string | null
          start_date?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          client_account_id?: number
          created_at?: string
          end_date?: string | null
          id?: string
          name?: string
          notes?: string | null
          site_address?: string | null
          start_date?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_client_account_id_fkey"
            columns: ["client_account_id"]
            isOneToOne: false
            referencedRelation: "client_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      pump_readings: {
        Row: {
          created_at: string | null
          driver_id: string
          id: string
          litres: number
          notes: string | null
          reading_date: string
        }
        Insert: {
          created_at?: string | null
          driver_id: string
          id?: string
          litres: number
          notes?: string | null
          reading_date?: string
        }
        Update: {
          created_at?: string | null
          driver_id?: string
          id?: string
          litres?: number
          notes?: string | null
          reading_date?: string
        }
        Relationships: []
      }
      quotes: {
        Row: {
          buy_price_per_litre: number
          created_at: string | null
          customer_email: string
          customer_name: string
          customer_phone: string | null
          id: string
          line_items: Json | null
          margin_percent: number
          notes: string | null
          sell_price_per_litre: number
          sent_at: string | null
          status: string
          total_ex_gst: number
          total_inc_gst: number
          valid_until: string | null
          volume_litres: number
        }
        Insert: {
          buy_price_per_litre: number
          created_at?: string | null
          customer_email: string
          customer_name: string
          customer_phone?: string | null
          id?: string
          line_items?: Json | null
          margin_percent: number
          notes?: string | null
          sell_price_per_litre: number
          sent_at?: string | null
          status?: string
          total_ex_gst: number
          total_inc_gst: number
          valid_until?: string | null
          volume_litres: number
        }
        Update: {
          buy_price_per_litre?: number
          created_at?: string | null
          customer_email?: string
          customer_name?: string
          customer_phone?: string | null
          id?: string
          line_items?: Json | null
          margin_percent?: number
          notes?: string | null
          sell_price_per_litre?: number
          sent_at?: string | null
          status?: string
          total_ex_gst?: number
          total_inc_gst?: number
          valid_until?: string | null
          volume_litres?: number
        }
        Relationships: []
      }
      recon_settings: {
        Row: {
          alert_sensitivity: string
          auto_weekly_report: boolean
          calibration_factor: number
          id: number
          report_email: string | null
          updated_at: string | null
          variance_threshold_litres: number
          variance_threshold_pct: number
        }
        Insert: {
          alert_sensitivity?: string
          auto_weekly_report?: boolean
          calibration_factor?: number
          id?: number
          report_email?: string | null
          updated_at?: string | null
          variance_threshold_litres?: number
          variance_threshold_pct?: number
        }
        Update: {
          alert_sensitivity?: string
          auto_weekly_report?: boolean
          calibration_factor?: number
          id?: number
          report_email?: string | null
          updated_at?: string | null
          variance_threshold_litres?: number
          variance_threshold_pct?: number
        }
        Relationships: []
      }
      reconciliation_alerts: {
        Row: {
          alert_date: string
          alert_type: string
          created_at: string | null
          id: string
          resolved_at: string | null
          resolved_by: string | null
          status: string
          suggested_action: string | null
          values: Json | null
        }
        Insert: {
          alert_date: string
          alert_type: string
          created_at?: string | null
          id?: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          suggested_action?: string | null
          values?: Json | null
        }
        Update: {
          alert_date?: string
          alert_type?: string
          created_at?: string | null
          id?: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          suggested_action?: string | null
          values?: Json | null
        }
        Relationships: []
      }
      scheduled_deliveries: {
        Row: {
          client_account_id: number | null
          created_at: string | null
          estimated_litres: number | null
          id: string
          notes: string | null
          scheduled_date: string
          site_name: string
          status: string | null
        }
        Insert: {
          client_account_id?: number | null
          created_at?: string | null
          estimated_litres?: number | null
          id?: string
          notes?: string | null
          scheduled_date: string
          site_name: string
          status?: string | null
        }
        Update: {
          client_account_id?: number | null
          created_at?: string | null
          estimated_litres?: number | null
          id?: string
          notes?: string | null
          scheduled_date?: string
          site_name?: string
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "scheduled_deliveries_client_account_id_fkey"
            columns: ["client_account_id"]
            isOneToOne: false
            referencedRelation: "client_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      sop_client_sites: {
        Row: {
          address: string
          client: string
          codes: Json
          contact: string
          created_at: string
          id: string
          notes: Json
          phone: string
          preferred_days: string
          site: string
          updated_at: string
        }
        Insert: {
          address?: string
          client: string
          codes?: Json
          contact?: string
          created_at?: string
          id?: string
          notes?: Json
          phone?: string
          preferred_days?: string
          site: string
          updated_at?: string
        }
        Update: {
          address?: string
          client?: string
          codes?: Json
          contact?: string
          created_at?: string
          id?: string
          notes?: Json
          phone?: string
          preferred_days?: string
          site?: string
          updated_at?: string
        }
        Relationships: []
      }
      sop_sections: {
        Row: {
          created_at: string
          display_order: number
          id: string
          subsections: Json
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_order?: number
          id?: string
          subsections?: Json
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_order?: number
          id?: string
          subsections?: Json
          title?: string
          updated_at?: string
        }
        Relationships: []
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
      terminal_gate_prices: {
        Row: {
          created_at: string | null
          id: string
          location: string
          price_cpl: number
          price_date: string
          price_per_litre: number | null
          product: string
          source: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          location?: string
          price_cpl: number
          price_date: string
          price_per_litre?: number | null
          product?: string
          source?: string
        }
        Update: {
          created_at?: string | null
          id?: string
          location?: string
          price_cpl?: number
          price_date?: string
          price_per_litre?: number | null
          product?: string
          source?: string
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
          client_account_id: number | null
          email: string | null
          full_name: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          client_account_id?: number | null
          email?: string | null
          full_name?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          client_account_id?: number | null
          email?: string | null
          full_name?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_client_account_id_fkey"
            columns: ["client_account_id"]
            isOneToOne: false
            referencedRelation: "client_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_client_company_name: { Args: { _user_id: string }; Returns: string }
      get_user_client_account_id: {
        Args: { _user_id: string }
        Returns: number
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      user_owns_speedsol_name: {
        Args: { _name: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "client" | "driver"
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
      app_role: ["admin", "client", "driver"],
    },
  },
} as const
