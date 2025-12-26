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
      client_feira_photos: {
        Row: {
          client_feira_id: string
          id: string
          notes: string | null
          photo_url: string
          uploaded_at: string | null
          uploaded_by: string
        }
        Insert: {
          client_feira_id: string
          id?: string
          notes?: string | null
          photo_url: string
          uploaded_at?: string | null
          uploaded_by: string
        }
        Update: {
          client_feira_id?: string
          id?: string
          notes?: string | null
          photo_url?: string
          uploaded_at?: string | null
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_feira_photos_client_feira_id_fkey"
            columns: ["client_feira_id"]
            isOneToOne: false
            referencedRelation: "client_feiras"
            referencedColumns: ["id"]
          },
        ]
      }
      client_feiras: {
        Row: {
          client_id: string
          created_at: string | null
          created_by: string
          feira_id: string
          id: string
          notes: string | null
          visited: boolean | null
          visited_at: string | null
          visited_by: string | null
        }
        Insert: {
          client_id: string
          created_at?: string | null
          created_by: string
          feira_id: string
          id?: string
          notes?: string | null
          visited?: boolean | null
          visited_at?: string | null
          visited_by?: string | null
        }
        Update: {
          client_id?: string
          created_at?: string | null
          created_by?: string
          feira_id?: string
          id?: string
          notes?: string | null
          visited?: boolean | null
          visited_at?: string | null
          visited_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_feiras_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_feiras_feira_id_fkey"
            columns: ["feira_id"]
            isOneToOne: false
            referencedRelation: "feiras"
            referencedColumns: ["id"]
          },
        ]
      }
      client_notes: {
        Row: {
          client_id: string
          created_at: string | null
          id: string
          note: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          client_id: string
          created_at?: string | null
          id?: string
          note: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          client_id?: string
          created_at?: string | null
          id?: string
          note?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_notes_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_notes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          address: string | null
          city: string | null
          cnae_description: string | null
          cnae_principal: string | null
          cnpj: string
          company_name: string
          company_size: string | null
          competitors: string | null
          created_at: string | null
          created_by: string
          distributor: string | null
          email: string | null
          foundation_date: string | null
          id: string
          legal_nature: string | null
          phone: string | null
          rating: number | null
          region: string | null
          registration_status: string | null
          segment: string | null
          services: string | null
          share_capital: number | null
          state: string | null
          trade_name: string | null
          updated_at: string | null
          website: string | null
          zip_code: string | null
        }
        Insert: {
          address?: string | null
          city?: string | null
          cnae_description?: string | null
          cnae_principal?: string | null
          cnpj: string
          company_name: string
          company_size?: string | null
          competitors?: string | null
          created_at?: string | null
          created_by: string
          distributor?: string | null
          email?: string | null
          foundation_date?: string | null
          id?: string
          legal_nature?: string | null
          phone?: string | null
          rating?: number | null
          region?: string | null
          registration_status?: string | null
          segment?: string | null
          services?: string | null
          share_capital?: number | null
          state?: string | null
          trade_name?: string | null
          updated_at?: string | null
          website?: string | null
          zip_code?: string | null
        }
        Update: {
          address?: string | null
          city?: string | null
          cnae_description?: string | null
          cnae_principal?: string | null
          cnpj?: string
          company_name?: string
          company_size?: string | null
          competitors?: string | null
          created_at?: string | null
          created_by?: string
          distributor?: string | null
          email?: string | null
          foundation_date?: string | null
          id?: string
          legal_nature?: string | null
          phone?: string | null
          rating?: number | null
          region?: string | null
          registration_status?: string | null
          segment?: string | null
          services?: string | null
          share_capital?: number | null
          state?: string | null
          trade_name?: string | null
          updated_at?: string | null
          website?: string | null
          zip_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clients_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      cnpj_cache: {
        Row: {
          address: string | null
          cached_at: string | null
          city: string | null
          cnae_description: string | null
          cnae_principal: string | null
          cnpj: string
          company_name: string | null
          created_at: string | null
          email: string | null
          foundation_date: string | null
          id: string
          legal_nature: string | null
          phone: string | null
          registration_status: string | null
          segment: string | null
          share_capital: number | null
          state: string | null
          trade_name: string | null
          zip_code: string | null
        }
        Insert: {
          address?: string | null
          cached_at?: string | null
          city?: string | null
          cnae_description?: string | null
          cnae_principal?: string | null
          cnpj: string
          company_name?: string | null
          created_at?: string | null
          email?: string | null
          foundation_date?: string | null
          id?: string
          legal_nature?: string | null
          phone?: string | null
          registration_status?: string | null
          segment?: string | null
          share_capital?: number | null
          state?: string | null
          trade_name?: string | null
          zip_code?: string | null
        }
        Update: {
          address?: string | null
          cached_at?: string | null
          city?: string | null
          cnae_description?: string | null
          cnae_principal?: string | null
          cnpj?: string
          company_name?: string | null
          created_at?: string | null
          email?: string | null
          foundation_date?: string | null
          id?: string
          legal_nature?: string | null
          phone?: string | null
          registration_status?: string | null
          segment?: string | null
          share_capital?: number | null
          state?: string | null
          trade_name?: string | null
          zip_code?: string | null
        }
        Relationships: []
      }
      contacts: {
        Row: {
          client_id: string
          created_at: string | null
          created_by: string
          email: string | null
          id: string
          is_primary: boolean | null
          mobile: string | null
          name: string
          phone: string | null
          rating: number | null
          role: string | null
          updated_at: string | null
        }
        Insert: {
          client_id: string
          created_at?: string | null
          created_by: string
          email?: string | null
          id?: string
          is_primary?: boolean | null
          mobile?: string | null
          name: string
          phone?: string | null
          rating?: number | null
          role?: string | null
          updated_at?: string | null
        }
        Update: {
          client_id?: string
          created_at?: string | null
          created_by?: string
          email?: string | null
          id?: string
          is_primary?: boolean | null
          mobile?: string | null
          name?: string
          phone?: string | null
          rating?: number | null
          role?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contacts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      feira_audit_log: {
        Row: {
          change_type: string
          changed_at: string | null
          changed_by: string
          created_at: string | null
          feira_id: string
          id: string
          new_data: Json | null
          old_data: Json | null
        }
        Insert: {
          change_type: string
          changed_at?: string | null
          changed_by: string
          created_at?: string | null
          feira_id: string
          id?: string
          new_data?: Json | null
          old_data?: Json | null
        }
        Update: {
          change_type?: string
          changed_at?: string | null
          changed_by?: string
          created_at?: string | null
          feira_id?: string
          id?: string
          new_data?: Json | null
          old_data?: Json | null
        }
        Relationships: []
      }
      feiras: {
        Row: {
          city: string | null
          created_at: string
          created_by: string
          description: string | null
          end_date: string | null
          id: string
          location: string | null
          name: string
          segmento: string | null
          start_date: string | null
          state: string | null
          status: string | null
          updated_at: string
          updated_by: string | null
          website: string | null
        }
        Insert: {
          city?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          end_date?: string | null
          id?: string
          location?: string | null
          name: string
          segmento?: string | null
          start_date?: string | null
          state?: string | null
          status?: string | null
          updated_at?: string
          updated_by?: string | null
          website?: string | null
        }
        Update: {
          city?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          end_date?: string | null
          id?: string
          location?: string | null
          name?: string
          segmento?: string | null
          start_date?: string | null
          state?: string | null
          status?: string | null
          updated_at?: string
          updated_by?: string | null
          website?: string | null
        }
        Relationships: []
      }
      goals: {
        Row: {
          assigned_to: string | null
          created_at: string | null
          created_by: string
          description: string | null
          end_date: string
          goal_type: Database["public"]["Enums"]["goal_type"]
          id: string
          period: string
          start_date: string
          target_value: number
          title: string
          updated_at: string | null
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string | null
          created_by: string
          description?: string | null
          end_date: string
          goal_type: Database["public"]["Enums"]["goal_type"]
          id?: string
          period?: string
          start_date: string
          target_value: number
          title: string
          updated_at?: string | null
        }
        Update: {
          assigned_to?: string | null
          created_at?: string | null
          created_by?: string
          description?: string | null
          end_date?: string
          goal_type?: Database["public"]["Enums"]["goal_type"]
          id?: string
          period?: string
          start_date?: string
          target_value?: number
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "goals_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goals_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      import_history: {
        Row: {
          completed_at: string | null
          created_at: string
          duplicate_count: number
          error_count: number
          error_details: Json | null
          file_name: string
          file_size: number | null
          id: string
          import_type: string
          started_at: string
          status: string
          success_count: number
          total_rows: number
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          duplicate_count?: number
          error_count?: number
          error_details?: Json | null
          file_name: string
          file_size?: number | null
          id?: string
          import_type: string
          started_at?: string
          status?: string
          success_count?: number
          total_rows?: number
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          duplicate_count?: number
          error_count?: number
          error_details?: Json | null
          file_name?: string
          file_size?: number | null
          id?: string
          import_type?: string
          started_at?: string
          status?: string
          success_count?: number
          total_rows?: number
          user_id?: string
        }
        Relationships: []
      }
      import_progress: {
        Row: {
          created_at: string
          duplicate_count: number
          error_count: number
          error_message: string | null
          id: string
          processed_rows: number
          session_id: string
          status: string
          success_count: number
          total_rows: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          duplicate_count?: number
          error_count?: number
          error_message?: string | null
          id?: string
          processed_rows?: number
          session_id: string
          status?: string
          success_count?: number
          total_rows?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          duplicate_count?: number
          error_count?: number
          error_message?: string | null
          id?: string
          processed_rows?: number
          session_id?: string
          status?: string
          success_count?: number
          total_rows?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      knowledge_base: {
        Row: {
          category: string
          content: string
          created_at: string | null
          created_by: string
          id: string
          tags: string[] | null
          title: string
          type: string
          updated_at: string | null
          updated_by: string | null
          url: string | null
        }
        Insert: {
          category: string
          content: string
          created_at?: string | null
          created_by: string
          id?: string
          tags?: string[] | null
          title: string
          type: string
          updated_at?: string | null
          updated_by?: string | null
          url?: string | null
        }
        Update: {
          category?: string
          content?: string
          created_at?: string | null
          created_by?: string
          id?: string
          tags?: string[] | null
          title?: string
          type?: string
          updated_at?: string | null
          updated_by?: string | null
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_base_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "knowledge_base_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_base_comments: {
        Row: {
          comment: string
          created_at: string | null
          id: string
          knowledge_base_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          comment: string
          created_at?: string | null
          id?: string
          knowledge_base_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          comment?: string
          created_at?: string | null
          id?: string
          knowledge_base_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_base_comments_knowledge_base_id_fkey"
            columns: ["knowledge_base_id"]
            isOneToOne: false
            referencedRelation: "knowledge_base"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "knowledge_base_comments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_base_favorites: {
        Row: {
          created_at: string | null
          id: string
          knowledge_base_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          knowledge_base_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          knowledge_base_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_base_favorites_knowledge_base_id_fkey"
            columns: ["knowledge_base_id"]
            isOneToOne: false
            referencedRelation: "knowledge_base"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_base_history: {
        Row: {
          category: string
          change_type: string
          changed_at: string
          changed_by: string
          content: string
          id: string
          knowledge_base_id: string
          new_data: Json | null
          old_data: Json | null
          title: string
          type: string
          url: string | null
        }
        Insert: {
          category: string
          change_type: string
          changed_at?: string
          changed_by: string
          content: string
          id?: string
          knowledge_base_id: string
          new_data?: Json | null
          old_data?: Json | null
          title: string
          type: string
          url?: string | null
        }
        Update: {
          category?: string
          change_type?: string
          changed_at?: string
          changed_by?: string
          content?: string
          id?: string
          knowledge_base_id?: string
          new_data?: Json | null
          old_data?: Json | null
          title?: string
          type?: string
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_base_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "knowledge_base_history_knowledge_base_id_fkey"
            columns: ["knowledge_base_id"]
            isOneToOne: false
            referencedRelation: "knowledge_base"
            referencedColumns: ["id"]
          },
        ]
      }
      loss_reasons: {
        Row: {
          created_at: string | null
          created_by: string
          id: string
          reason: string
        }
        Insert: {
          created_at?: string | null
          created_by: string
          id?: string
          reason: string
        }
        Update: {
          created_at?: string | null
          created_by?: string
          id?: string
          reason?: string
        }
        Relationships: []
      }
      opportunities: {
        Row: {
          assigned_to: string
          billing_type: string | null
          business_type: Database["public"]["Enums"]["business_type"] | null
          charge_commission: boolean | null
          client_id: string
          close_cycle_days: number | null
          created_at: string | null
          created_by: string
          description: string | null
          expected_close_date: string | null
          id: string
          implementation_value: number | null
          loss_reason_id: string | null
          monthly_value: number | null
          probability: number | null
          product_id: string | null
          status: Database["public"]["Enums"]["opportunity_status"] | null
          title: string
          updated_at: string | null
          value: number | null
        }
        Insert: {
          assigned_to: string
          billing_type?: string | null
          business_type?: Database["public"]["Enums"]["business_type"] | null
          charge_commission?: boolean | null
          client_id: string
          close_cycle_days?: number | null
          created_at?: string | null
          created_by: string
          description?: string | null
          expected_close_date?: string | null
          id?: string
          implementation_value?: number | null
          loss_reason_id?: string | null
          monthly_value?: number | null
          probability?: number | null
          product_id?: string | null
          status?: Database["public"]["Enums"]["opportunity_status"] | null
          title: string
          updated_at?: string | null
          value?: number | null
        }
        Update: {
          assigned_to?: string
          billing_type?: string | null
          business_type?: Database["public"]["Enums"]["business_type"] | null
          charge_commission?: boolean | null
          client_id?: string
          close_cycle_days?: number | null
          created_at?: string | null
          created_by?: string
          description?: string | null
          expected_close_date?: string | null
          id?: string
          implementation_value?: number | null
          loss_reason_id?: string | null
          monthly_value?: number | null
          probability?: number | null
          product_id?: string | null
          status?: Database["public"]["Enums"]["opportunity_status"] | null
          title?: string
          updated_at?: string | null
          value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "opportunities_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunities_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunities_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunities_loss_reason_id_fkey"
            columns: ["loss_reason_id"]
            isOneToOne: false
            referencedRelation: "loss_reasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunities_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      opportunity_activities: {
        Row: {
          activity_type: string
          created_at: string | null
          created_by: string
          description: string
          id: string
          new_value: string | null
          old_value: string | null
          opportunity_id: string
        }
        Insert: {
          activity_type: string
          created_at?: string | null
          created_by: string
          description: string
          id?: string
          new_value?: string | null
          old_value?: string | null
          opportunity_id: string
        }
        Update: {
          activity_type?: string
          created_at?: string | null
          created_by?: string
          description?: string
          id?: string
          new_value?: string | null
          old_value?: string | null
          opportunity_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "opportunity_activities_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
        ]
      }
      opportunity_alerts: {
        Row: {
          alert_type: string
          assigned_to: string
          created_at: string
          dismissed_at: string | null
          expires_at: string | null
          id: string
          is_read: boolean
          message: string
          metadata: Json | null
          opportunity_id: string
          severity: string
          title: string
        }
        Insert: {
          alert_type: string
          assigned_to: string
          created_at?: string
          dismissed_at?: string | null
          expires_at?: string | null
          id?: string
          is_read?: boolean
          message: string
          metadata?: Json | null
          opportunity_id: string
          severity?: string
          title: string
        }
        Update: {
          alert_type?: string
          assigned_to?: string
          created_at?: string
          dismissed_at?: string | null
          expires_at?: string | null
          id?: string
          is_read?: boolean
          message?: string
          metadata?: Json | null
          opportunity_id?: string
          severity?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "opportunity_alerts_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunity_alerts_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
        ]
      }
      opportunity_attachments: {
        Row: {
          created_at: string | null
          file_name: string
          file_path: string
          file_size: number | null
          file_type: string | null
          id: string
          opportunity_id: string
          updated_at: string | null
          uploaded_by: string
        }
        Insert: {
          created_at?: string | null
          file_name: string
          file_path: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          opportunity_id: string
          updated_at?: string | null
          uploaded_by: string
        }
        Update: {
          created_at?: string | null
          file_name?: string
          file_path?: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          opportunity_id?: string
          updated_at?: string | null
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "opportunity_attachments_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
        ]
      }
      opportunity_history: {
        Row: {
          change_type: string
          changed_at: string | null
          changed_by: string
          created_at: string | null
          id: string
          new_data: Json | null
          old_data: Json | null
          opportunity_id: string
        }
        Insert: {
          change_type: string
          changed_at?: string | null
          changed_by: string
          created_at?: string | null
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          opportunity_id: string
        }
        Update: {
          change_type?: string
          changed_at?: string | null
          changed_by?: string
          created_at?: string | null
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          opportunity_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "opportunity_history_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          active: boolean | null
          created_at: string | null
          description: string | null
          id: string
          implementation_fee: number
          logo_url: string | null
          monthly_fee: number
          name: string
          updated_at: string | null
        }
        Insert: {
          active?: boolean | null
          created_at?: string | null
          description?: string | null
          id?: string
          implementation_fee?: number
          logo_url?: string | null
          monthly_fee?: number
          name: string
          updated_at?: string | null
        }
        Update: {
          active?: boolean | null
          created_at?: string | null
          description?: string | null
          id?: string
          implementation_fee?: number
          logo_url?: string | null
          monthly_fee?: number
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          email: string
          full_name: string
          id: string
          phone: string | null
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          email: string
          full_name: string
          id: string
          phone?: string | null
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          email?: string
          full_name?: string
          id?: string
          phone?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      radar_leads: {
        Row: {
          assigned_to: string | null
          city: string | null
          cnpj: string
          company_name: string
          contract_date: string | null
          contract_value: number | null
          created_at: string | null
          email: string | null
          id: string
          last_sync_at: string | null
          notes: string | null
          phone: string | null
          segment: string | null
          source: string
          source_data: Json | null
          state: string | null
          status: string | null
          trade_name: string | null
          updated_at: string | null
        }
        Insert: {
          assigned_to?: string | null
          city?: string | null
          cnpj: string
          company_name: string
          contract_date?: string | null
          contract_value?: number | null
          created_at?: string | null
          email?: string | null
          id?: string
          last_sync_at?: string | null
          notes?: string | null
          phone?: string | null
          segment?: string | null
          source: string
          source_data?: Json | null
          state?: string | null
          status?: string | null
          trade_name?: string | null
          updated_at?: string | null
        }
        Update: {
          assigned_to?: string | null
          city?: string | null
          cnpj?: string
          company_name?: string
          contract_date?: string | null
          contract_value?: number | null
          created_at?: string | null
          email?: string | null
          id?: string
          last_sync_at?: string | null
          notes?: string | null
          phone?: string | null
          segment?: string | null
          source?: string
          source_data?: Json | null
          state?: string | null
          status?: string | null
          trade_name?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "radar_leads_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      radar_sync_history: {
        Row: {
          created_at: string | null
          error_message: string | null
          id: string
          leads_found: number | null
          leads_new: number | null
          leads_updated: number | null
          source: string
          status: string
          sync_completed_at: string | null
          sync_started_at: string
        }
        Insert: {
          created_at?: string | null
          error_message?: string | null
          id?: string
          leads_found?: number | null
          leads_new?: number | null
          leads_updated?: number | null
          source: string
          status: string
          sync_completed_at?: string | null
          sync_started_at: string
        }
        Update: {
          created_at?: string | null
          error_message?: string | null
          id?: string
          leads_found?: number | null
          leads_new?: number | null
          leads_updated?: number | null
          source?: string
          status?: string
          sync_completed_at?: string | null
          sync_started_at?: string
        }
        Relationships: []
      }
      task_history: {
        Row: {
          change_type: string
          changed_at: string | null
          changed_by: string
          created_at: string | null
          id: string
          new_data: Json | null
          old_data: Json | null
          task_id: string
        }
        Insert: {
          change_type: string
          changed_at?: string | null
          changed_by: string
          created_at?: string | null
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          task_id: string
        }
        Update: {
          change_type?: string
          changed_at?: string | null
          changed_by?: string
          created_at?: string | null
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_history_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_message_templates: {
        Row: {
          created_at: string | null
          created_by: string
          id: string
          is_personal: boolean
          message: string
          task_type: string
          updated_at: string | null
          usage_count: number
        }
        Insert: {
          created_at?: string | null
          created_by: string
          id?: string
          is_personal?: boolean
          message: string
          task_type: string
          updated_at?: string | null
          usage_count?: number
        }
        Update: {
          created_at?: string | null
          created_by?: string
          id?: string
          is_personal?: boolean
          message?: string
          task_type?: string
          updated_at?: string | null
          usage_count?: number
        }
        Relationships: []
      }
      task_notes: {
        Row: {
          created_at: string | null
          id: string
          note: string
          task_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          note: string
          task_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          note?: string
          task_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_notes_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_notes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      task_templates: {
        Row: {
          category: string | null
          created_at: string | null
          created_by: string
          description: string | null
          id: string
          is_global: boolean
          name: string
          priority: string
          task_type: string
          updated_at: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          created_by: string
          description?: string | null
          id?: string
          is_global?: boolean
          name: string
          priority?: string
          task_type: string
          updated_at?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string | null
          created_by?: string
          description?: string | null
          id?: string
          is_global?: boolean
          name?: string
          priority?: string
          task_type?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      tasks: {
        Row: {
          assigned_to: string
          client_id: string | null
          completed_at: string | null
          contact_id: string | null
          created_at: string | null
          created_by: string
          description: string | null
          due_date: string | null
          email_body: string | null
          email_sent: boolean | null
          email_subject: string | null
          id: string
          opportunity_id: string | null
          priority: Database["public"]["Enums"]["priority_level"] | null
          status: Database["public"]["Enums"]["task_status"] | null
          task_type: Database["public"]["Enums"]["task_type"] | null
          title: string
          updated_at: string | null
        }
        Insert: {
          assigned_to: string
          client_id?: string | null
          completed_at?: string | null
          contact_id?: string | null
          created_at?: string | null
          created_by: string
          description?: string | null
          due_date?: string | null
          email_body?: string | null
          email_sent?: boolean | null
          email_subject?: string | null
          id?: string
          opportunity_id?: string | null
          priority?: Database["public"]["Enums"]["priority_level"] | null
          status?: Database["public"]["Enums"]["task_status"] | null
          task_type?: Database["public"]["Enums"]["task_type"] | null
          title: string
          updated_at?: string | null
        }
        Update: {
          assigned_to?: string
          client_id?: string | null
          completed_at?: string | null
          contact_id?: string | null
          created_at?: string | null
          created_by?: string
          description?: string | null
          due_date?: string | null
          email_body?: string | null
          email_sent?: boolean | null
          email_subject?: string | null
          id?: string
          opportunity_id?: string | null
          priority?: Database["public"]["Enums"]["priority_level"] | null
          status?: Database["public"]["Enums"]["task_status"] | null
          task_type?: Database["public"]["Enums"]["task_type"] | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tasks_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_user_id_fkey"
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
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "vendedor" | "gestor"
      business_type: "cliente_novo" | "venda_na_base"
      goal_type: "revenue" | "annualized_sales" | "tasks" | "activities"
      opportunity_status:
        | "lead"
        | "contacted"
        | "qualified"
        | "apresentacao"
        | "proposal"
        | "negotiation"
        | "won"
        | "lost"
      priority_level: "low" | "medium" | "high"
      task_status: "pending" | "in_progress" | "completed" | "cancelled"
      task_type:
        | "ligacao"
        | "email"
        | "whatsapp"
        | "visita_presencial"
        | "reuniao_online"
        | "visita_feira"
        | "visita_evento"
        | "linkedin"
        | "proposta"
        | "apresentacao"
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
      app_role: ["admin", "vendedor", "gestor"],
      business_type: ["cliente_novo", "venda_na_base"],
      goal_type: ["revenue", "annualized_sales", "tasks", "activities"],
      opportunity_status: [
        "lead",
        "contacted",
        "qualified",
        "apresentacao",
        "proposal",
        "negotiation",
        "won",
        "lost",
      ],
      priority_level: ["low", "medium", "high"],
      task_status: ["pending", "in_progress", "completed", "cancelled"],
      task_type: [
        "ligacao",
        "email",
        "whatsapp",
        "visita_presencial",
        "reuniao_online",
        "visita_feira",
        "visita_evento",
        "linkedin",
        "proposta",
        "apresentacao",
      ],
    },
  },
} as const
