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
          supplier: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          notes?: string | null
          price_date: string
          price_per_litre: number
          supplier?: string
        }
        Update: {
          created_at?: string | null
          id?: string
          notes?: string | null
          price_date?: string
          price_per_litre?: number
          supplier?: string
        }
        Relationships: []
      }
      client_accounts: {
        Row: {
          auth_user_id: string | null
          brand_accent: string | null
          branding_enabled: boolean
          company_name: string
          contact_email: string
          contact_name: string | null
          contact_phone: string | null
          created_at: string | null
          id: number
          is_active: boolean | null
          logo_url: string | null
          speedsol_name: string | null
          speedsol_names: string[] | null
          updated_at: string | null
        }
        Insert: {
          auth_user_id?: string | null
          brand_accent?: string | null
          branding_enabled?: boolean
          company_name: string
          contact_email: string
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string | null
          id?: never
          is_active?: boolean | null
          logo_url?: string | null
          speedsol_name?: string | null
          speedsol_names?: string[] | null
          updated_at?: string | null
        }
        Update: {
          auth_user_id?: string | null
          brand_accent?: string | null
          branding_enabled?: boolean
          company_name?: string
          contact_email?: string
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string | null
          id?: never
          is_active?: boolean | null
          logo_url?: string | null
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
      client_profiles: {
        Row: {
          abn: string | null
          accounts_contact_email: string | null
          accounts_contact_name: string | null
          accounts_contact_phone: string | null
          billing_address_line1: string | null
          billing_address_line2: string | null
          billing_country: string | null
          billing_postcode: string | null
          billing_state: string | null
          billing_suburb: string | null
          client_account_id: number
          created_at: string
          id: string
          legal_business_name: string | null
          ops_contact_email: string | null
          ops_contact_name: string | null
          ops_contact_phone: string | null
          primary_contact_email: string | null
          primary_contact_name: string | null
          primary_contact_phone: string | null
          site_contact_email: string | null
          site_contact_name: string | null
          site_contact_phone: string | null
          updated_at: string
          website: string | null
        }
        Insert: {
          abn?: string | null
          accounts_contact_email?: string | null
          accounts_contact_name?: string | null
          accounts_contact_phone?: string | null
          billing_address_line1?: string | null
          billing_address_line2?: string | null
          billing_country?: string | null
          billing_postcode?: string | null
          billing_state?: string | null
          billing_suburb?: string | null
          client_account_id: number
          created_at?: string
          id?: string
          legal_business_name?: string | null
          ops_contact_email?: string | null
          ops_contact_name?: string | null
          ops_contact_phone?: string | null
          primary_contact_email?: string | null
          primary_contact_name?: string | null
          primary_contact_phone?: string | null
          site_contact_email?: string | null
          site_contact_name?: string | null
          site_contact_phone?: string | null
          updated_at?: string
          website?: string | null
        }
        Update: {
          abn?: string | null
          accounts_contact_email?: string | null
          accounts_contact_name?: string | null
          accounts_contact_phone?: string | null
          billing_address_line1?: string | null
          billing_address_line2?: string | null
          billing_country?: string | null
          billing_postcode?: string | null
          billing_state?: string | null
          billing_suburb?: string | null
          client_account_id?: number
          created_at?: string
          id?: string
          legal_business_name?: string | null
          ops_contact_email?: string | null
          ops_contact_name?: string | null
          ops_contact_phone?: string | null
          primary_contact_email?: string | null
          primary_contact_name?: string | null
          primary_contact_phone?: string | null
          site_contact_email?: string | null
          site_contact_name?: string | null
          site_contact_phone?: string | null
          updated_at?: string
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_profiles_client_account_id_fkey"
            columns: ["client_account_id"]
            isOneToOne: true
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
      demo_analytics_events: {
        Row: {
          accent_color: string | null
          brand: string | null
          created_at: string
          event_type: string
          id: string
          metadata: Json
          path: string | null
          referrer: string | null
          search_params: string | null
          section: string | null
          session_id: string | null
          source: string | null
          user_agent: string | null
        }
        Insert: {
          accent_color?: string | null
          brand?: string | null
          created_at?: string
          event_type: string
          id?: string
          metadata?: Json
          path?: string | null
          referrer?: string | null
          search_params?: string | null
          section?: string | null
          session_id?: string | null
          source?: string | null
          user_agent?: string | null
        }
        Update: {
          accent_color?: string | null
          brand?: string | null
          created_at?: string
          event_type?: string
          id?: string
          metadata?: Json
          path?: string | null
          referrer?: string | null
          search_params?: string | null
          section?: string | null
          session_id?: string | null
          source?: string | null
          user_agent?: string | null
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
      dispatch_recurring: {
        Row: {
          address: string | null
          client_account_id: number
          created_at: string
          created_by: string | null
          end_date: string | null
          estimated_litres: number | null
          frequency: string
          id: string
          is_active: boolean
          notes: string | null
          project_id: string | null
          site_name: string
          start_date: string
          truck_id: string | null
          updated_at: string
          weekdays: number[]
        }
        Insert: {
          address?: string | null
          client_account_id: number
          created_at?: string
          created_by?: string | null
          end_date?: string | null
          estimated_litres?: number | null
          frequency?: string
          id?: string
          is_active?: boolean
          notes?: string | null
          project_id?: string | null
          site_name: string
          start_date?: string
          truck_id?: string | null
          updated_at?: string
          weekdays?: number[]
        }
        Update: {
          address?: string | null
          client_account_id?: number
          created_at?: string
          created_by?: string | null
          end_date?: string | null
          estimated_litres?: number | null
          frequency?: string
          id?: string
          is_active?: boolean
          notes?: string | null
          project_id?: string | null
          site_name?: string
          start_date?: string
          truck_id?: string | null
          updated_at?: string
          weekdays?: number[]
        }
        Relationships: []
      }
      dispatch_stops: {
        Row: {
          address: string | null
          client_account_id: number
          completed_at: string | null
          created_at: string
          created_by: string | null
          delivered_litres: number | null
          driver_user_id: string | null
          estimated_litres: number | null
          id: string
          latitude: number | null
          longitude: number | null
          notes: string | null
          project_id: string | null
          recurring_id: string | null
          scheduled_date: string
          sequence: number
          site_name: string
          status: string
          truck_id: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          client_account_id: number
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          delivered_litres?: number | null
          driver_user_id?: string | null
          estimated_litres?: number | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          notes?: string | null
          project_id?: string | null
          recurring_id?: string | null
          scheduled_date: string
          sequence?: number
          site_name: string
          status?: string
          truck_id?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          client_account_id?: number
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          delivered_litres?: number | null
          driver_user_id?: string | null
          estimated_litres?: number | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          notes?: string | null
          project_id?: string | null
          recurring_id?: string | null
          scheduled_date?: string
          sequence?: number
          site_name?: string
          status?: string
          truck_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "dispatch_stops_recurring_id_fkey"
            columns: ["recurring_id"]
            isOneToOne: false
            referencedRelation: "dispatch_recurring"
            referencedColumns: ["id"]
          },
        ]
      }
      driver_locations: {
        Row: {
          accuracy: number | null
          created_at: string
          driver_user_id: string
          heading: number | null
          id: string
          latitude: number
          longitude: number
          recorded_at: string
          speed: number | null
        }
        Insert: {
          accuracy?: number | null
          created_at?: string
          driver_user_id: string
          heading?: number | null
          id?: string
          latitude: number
          longitude: number
          recorded_at?: string
          speed?: number | null
        }
        Update: {
          accuracy?: number | null
          created_at?: string
          driver_user_id?: string
          heading?: number | null
          id?: string
          latitude?: number
          longitude?: number
          recorded_at?: string
          speed?: number | null
        }
        Relationships: []
      }
      email_cta_clicks: {
        Row: {
          campaign: string
          clicked_at: string
          cta_id: string
          destination: string | null
          id: string
          ip_hash: string | null
          referer: string | null
          user_agent: string | null
        }
        Insert: {
          campaign?: string
          clicked_at?: string
          cta_id: string
          destination?: string | null
          id?: string
          ip_hash?: string | null
          referer?: string | null
          user_agent?: string | null
        }
        Update: {
          campaign?: string
          clicked_at?: string
          cta_id?: string
          destination?: string | null
          id?: string
          ip_hash?: string | null
          referer?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      email_templates: {
        Row: {
          created_at: string
          created_by: string | null
          default_values: Json
          description: string | null
          html_body: string
          id: string
          is_active: boolean
          name: string
          subject: string
          text_body: string
          updated_at: string
          variables: Json
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          default_values?: Json
          description?: string | null
          html_body: string
          id?: string
          is_active?: boolean
          name: string
          subject: string
          text_body: string
          updated_at?: string
          variables?: Json
        }
        Update: {
          created_at?: string
          created_by?: string | null
          default_values?: Json
          description?: string | null
          html_body?: string
          id?: string
          is_active?: boolean
          name?: string
          subject?: string
          text_body?: string
          updated_at?: string
          variables?: Json
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
          odometer_km: number | null
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
          odometer_km?: number | null
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
          odometer_km?: number | null
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
      operating_expenses: {
        Row: {
          amount: number
          category: string
          created_at: string
          frequency: string
          id: string
          is_active: boolean
          name: string
          next_due_date: string | null
          notes: string | null
          updated_at: string
        }
        Insert: {
          amount: number
          category: string
          created_at?: string
          frequency: string
          id?: string
          is_active?: boolean
          name: string
          next_due_date?: string | null
          notes?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string
          frequency?: string
          id?: string
          is_active?: boolean
          name?: string
          next_due_date?: string | null
          notes?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      outreach_send_log: {
        Row: {
          bcc: string | null
          body: string
          channel: string
          created_at: string
          gmail_message_id: string | null
          gmail_thread_id: string | null
          id: string
          organisation: string | null
          pipedrive_person_id: number | null
          recipient_email: string | null
          recipient_name: string | null
          send_status: string
          sent_by: string
          subject: string
          template_id: string | null
        }
        Insert: {
          bcc?: string | null
          body: string
          channel: string
          created_at?: string
          gmail_message_id?: string | null
          gmail_thread_id?: string | null
          id?: string
          organisation?: string | null
          pipedrive_person_id?: number | null
          recipient_email?: string | null
          recipient_name?: string | null
          send_status?: string
          sent_by: string
          subject: string
          template_id?: string | null
        }
        Update: {
          bcc?: string | null
          body?: string
          channel?: string
          created_at?: string
          gmail_message_id?: string | null
          gmail_thread_id?: string | null
          id?: string
          organisation?: string | null
          pipedrive_person_id?: number | null
          recipient_email?: string | null
          recipient_name?: string | null
          send_status?: string
          sent_by?: string
          subject?: string
          template_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "outreach_send_log_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "email_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      outreach_thread_status: {
        Row: {
          details: Json | null
          id: string
          last_message_at: string | null
          last_polled_at: string
          pipedrive_thread_id: number | null
          send_id: string
          status: string
        }
        Insert: {
          details?: Json | null
          id?: string
          last_message_at?: string | null
          last_polled_at?: string
          pipedrive_thread_id?: number | null
          send_id: string
          status?: string
        }
        Update: {
          details?: Json | null
          id?: string
          last_message_at?: string | null
          last_polled_at?: string
          pipedrive_thread_id?: number | null
          send_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "outreach_thread_status_send_id_fkey"
            columns: ["send_id"]
            isOneToOne: true
            referencedRelation: "outreach_send_log"
            referencedColumns: ["id"]
          },
        ]
      }
      plant_assignment_audit: {
        Row: {
          changed_at: string
          changed_by: string | null
          from_project_id: string | null
          id: string
          notes: string | null
          plant_item_id: string
          source: string
          to_project_id: string | null
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          from_project_id?: string | null
          id?: string
          notes?: string | null
          plant_item_id: string
          source?: string
          to_project_id?: string | null
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          from_project_id?: string | null
          id?: string
          notes?: string | null
          plant_item_id?: string
          source?: string
          to_project_id?: string | null
        }
        Relationships: []
      }
      plant_item_tags: {
        Row: {
          created_at: string
          plant_item_id: string
          tag_id: string
        }
        Insert: {
          created_at?: string
          plant_item_id: string
          tag_id: string
        }
        Update: {
          created_at?: string
          plant_item_id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "plant_item_tags_plant_item_id_fkey"
            columns: ["plant_item_id"]
            isOneToOne: false
            referencedRelation: "plant_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plant_item_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "plant_tags"
            referencedColumns: ["id"]
          },
        ]
      }
      plant_items: {
        Row: {
          client_account_id: number
          colour: string | null
          created_at: string
          description: string | null
          display_asset_id: string | null
          equipment_type: string | null
          ftc_rate_id: string | null
          id: string
          is_active: boolean
          manufacturer: string | null
          model: string | null
          name: string
          photo_url: string | null
          placa: string | null
          serial_number: string | null
          service_notes: string | null
          size: string | null
          tank_size_litres: number | null
          updated_at: string
        }
        Insert: {
          client_account_id: number
          colour?: string | null
          created_at?: string
          description?: string | null
          display_asset_id?: string | null
          equipment_type?: string | null
          ftc_rate_id?: string | null
          id?: string
          is_active?: boolean
          manufacturer?: string | null
          model?: string | null
          name: string
          photo_url?: string | null
          placa?: string | null
          serial_number?: string | null
          service_notes?: string | null
          size?: string | null
          tank_size_litres?: number | null
          updated_at?: string
        }
        Update: {
          client_account_id?: number
          colour?: string | null
          created_at?: string
          description?: string | null
          display_asset_id?: string | null
          equipment_type?: string | null
          ftc_rate_id?: string | null
          id?: string
          is_active?: boolean
          manufacturer?: string | null
          model?: string | null
          name?: string
          photo_url?: string | null
          placa?: string | null
          serial_number?: string | null
          service_notes?: string | null
          size?: string | null
          tank_size_litres?: number | null
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
      plant_tags: {
        Row: {
          client_account_id: number
          colour: string | null
          created_at: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          client_account_id: number
          colour?: string | null
          created_at?: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          client_account_id?: number
          colour?: string | null
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "plant_tags_client_account_id_fkey"
            columns: ["client_account_id"]
            isOneToOne: false
            referencedRelation: "client_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      pricing_presets: {
        Row: {
          adblue_price: number | null
          adblue_price_inc: number | null
          created_at: string
          created_by: string | null
          diesel_price: number | null
          diesel_price_inc: number | null
          id: string
          name: string
          notes: string | null
          product_mix: Json
          ulp_price: number | null
          ulp_price_inc: number | null
          updated_at: string
          weekly_volume: string | null
        }
        Insert: {
          adblue_price?: number | null
          adblue_price_inc?: number | null
          created_at?: string
          created_by?: string | null
          diesel_price?: number | null
          diesel_price_inc?: number | null
          id?: string
          name: string
          notes?: string | null
          product_mix?: Json
          ulp_price?: number | null
          ulp_price_inc?: number | null
          updated_at?: string
          weekly_volume?: string | null
        }
        Update: {
          adblue_price?: number | null
          adblue_price_inc?: number | null
          created_at?: string
          created_by?: string | null
          diesel_price?: number | null
          diesel_price_inc?: number | null
          id?: string
          name?: string
          notes?: string | null
          product_mix?: Json
          ulp_price?: number | null
          ulp_price_inc?: number | null
          updated_at?: string
          weekly_volume?: string | null
        }
        Relationships: []
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
          truck: string
        }
        Insert: {
          created_at?: string | null
          driver_id: string
          id?: string
          litres: number
          notes?: string | null
          reading_date?: string
          truck?: string
        }
        Update: {
          created_at?: string | null
          driver_id?: string
          id?: string
          litres?: number
          notes?: string | null
          reading_date?: string
          truck?: string
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
      transaction_overrides: {
        Row: {
          created_at: string
          notes: string | null
          plant_item_id: string | null
          project_id: string | null
          set_by: string | null
          transaction_id: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          notes?: string | null
          plant_item_id?: string | null
          project_id?: string | null
          set_by?: string | null
          transaction_id: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          notes?: string | null
          plant_item_id?: string | null
          project_id?: string | null
          set_by?: string | null
          transaction_id?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "transaction_overrides_plant_item_id_fkey"
            columns: ["plant_item_id"]
            isOneToOne: false
            referencedRelation: "plant_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transaction_overrides_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
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
      truck_documents: {
        Row: {
          created_at: string
          doc_type: string
          expiry_date: string | null
          file_path: string | null
          id: string
          issue_date: string | null
          label: string | null
          notes: string | null
          truck_id: string
          updated_at: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          doc_type: string
          expiry_date?: string | null
          file_path?: string | null
          id?: string
          issue_date?: string | null
          label?: string | null
          notes?: string | null
          truck_id: string
          updated_at?: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          doc_type?: string
          expiry_date?: string | null
          file_path?: string | null
          id?: string
          issue_date?: string | null
          label?: string | null
          notes?: string | null
          truck_id?: string
          updated_at?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "truck_documents_truck_id_fkey"
            columns: ["truck_id"]
            isOneToOne: false
            referencedRelation: "trucks"
            referencedColumns: ["id"]
          },
        ]
      }
      truck_service_records: {
        Row: {
          cost: number | null
          created_at: string
          created_by: string | null
          file_path: string | null
          id: string
          notes: string | null
          service_date: string
          service_km: number | null
          service_type: string | null
          truck_id: string
          updated_at: string
          vendor: string | null
        }
        Insert: {
          cost?: number | null
          created_at?: string
          created_by?: string | null
          file_path?: string | null
          id?: string
          notes?: string | null
          service_date: string
          service_km?: number | null
          service_type?: string | null
          truck_id: string
          updated_at?: string
          vendor?: string | null
        }
        Update: {
          cost?: number | null
          created_at?: string
          created_by?: string | null
          file_path?: string | null
          id?: string
          notes?: string | null
          service_date?: string
          service_km?: number | null
          service_type?: string | null
          truck_id?: string
          updated_at?: string
          vendor?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "truck_service_records_truck_id_fkey"
            columns: ["truck_id"]
            isOneToOne: false
            referencedRelation: "trucks"
            referencedColumns: ["id"]
          },
        ]
      }
      trucks: {
        Row: {
          build_date: string | null
          created_at: string
          current_km: number | null
          id: string
          is_active: boolean
          last_service_date: string | null
          last_service_km: number | null
          make: string | null
          model: string | null
          name: string
          next_service_date: string | null
          next_service_km: number | null
          notes: string | null
          photo_path: string | null
          rego: string | null
          serial_number: string | null
          speedsol_estacion: string | null
          tank_capacity_litres: number | null
          updated_at: string
          vin: string | null
        }
        Insert: {
          build_date?: string | null
          created_at?: string
          current_km?: number | null
          id?: string
          is_active?: boolean
          last_service_date?: string | null
          last_service_km?: number | null
          make?: string | null
          model?: string | null
          name: string
          next_service_date?: string | null
          next_service_km?: number | null
          notes?: string | null
          photo_path?: string | null
          rego?: string | null
          serial_number?: string | null
          speedsol_estacion?: string | null
          tank_capacity_litres?: number | null
          updated_at?: string
          vin?: string | null
        }
        Update: {
          build_date?: string | null
          created_at?: string
          current_km?: number | null
          id?: string
          is_active?: boolean
          last_service_date?: string | null
          last_service_km?: number | null
          make?: string | null
          model?: string | null
          name?: string
          next_service_date?: string | null
          next_service_km?: number | null
          notes?: string | null
          photo_path?: string | null
          rego?: string | null
          serial_number?: string | null
          speedsol_estacion?: string | null
          tank_capacity_litres?: number | null
          updated_at?: string
          vin?: string | null
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
      check_plant_rego_conflict: {
        Args: { _plant_item_id: string }
        Returns: Json
      }
      clear_auto_backfill_for_plant: {
        Args: { _plant_item_id: string }
        Returns: number
      }
      expand_dispatch_recurring: {
        Args: { _days_ahead?: number }
        Returns: number
      }
      get_client_company_name: { Args: { _user_id: string }; Returns: string }
      get_last_sync_status: {
        Args: never
        Returns: {
          status: string
          synced_at: string
        }[]
      }
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
      list_rego_conflicts: {
        Args: never
        Returns: {
          placa: string
          plant_items: Json
        }[]
      }
      preview_tag_transaction: {
        Args: { _plant_item_id: string; _transaction_id: number }
        Returns: Json
      }
      tag_transaction_single: {
        Args: {
          _notes?: string
          _plant_item_id: string
          _project_id: string
          _transaction_id: number
        }
        Returns: Json
      }
      tag_transaction_with_feedback: {
        Args: {
          _notes?: string
          _plant_item_id: string
          _project_id: string
          _transaction_id: number
        }
        Returns: Json
      }
      user_owns_speedsol_name: {
        Args: { _name: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "client" | "driver" | "operations"
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
      app_role: ["admin", "client", "driver", "operations"],
    },
  },
} as const
