export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json }
  | Json[]

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          auth0_id: string
          email: string
          full_name: string | null
          avatar_url: string | null
          provider: string | null
          provider_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          auth0_id: string
          email: string
          full_name?: string | null
          avatar_url?: string | null
          provider?: string | null
          provider_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          auth0_id?: string
          email?: string
          full_name?: string | null
          avatar_url?: string | null
          provider?: string | null
          provider_id?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      files: {
        Row: {
          id: string
          user_id: string
          file_name: string
          file_type: string
          file_size: number
          file_url: string
          analysis: Json | null
          is_deleted: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          file_name: string
          file_type: string
          file_size: number
          file_url: string
          analysis?: Json | null
          is_deleted?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          file_name?: string
          file_type?: string
          file_size?: number
          file_url?: string
          analysis?: Json | null
          is_deleted?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      apps: {
        Row: {
          id: string
          user_id: string
          name: string
          description: string | null
          file_ids: string[]
          current_version_id: string | null
          is_public: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          description?: string | null
          file_ids?: string[]
          current_version_id?: string | null
          is_public?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          description?: string | null
          file_ids?: string[]
          current_version_id?: string | null
          is_public?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      app_versions: {
        Row: {
          id: string
          app_id: string
          version_number: number
          code_content: string
          metadata: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          app_id: string
          version_number: number
          code_content: string
          metadata?: Json | null
          created_at?: string
        }
        Update: {
          id?: string
          app_id?: string
          version_number?: number
          code_content?: string
          metadata?: Json | null
          created_at?: string
        }
      }
      chats: {
        Row: {
          id: string
          user_id: string
          name: string | null
          file_ids: string[]
          expires_at: string | null
          is_deleted: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name?: string | null
          file_ids?: string[]
          expires_at?: string | null
          is_deleted?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string | null
          file_ids?: string[]
          expires_at?: string | null
          is_deleted?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      messages: {
        Row: {
          id: string
          chat_id: string
          user_id: string
          role: 'user' | 'assistant'
          content: string
          created_at: string
        }
        Insert: {
          id?: string
          chat_id: string
          user_id: string
          role: 'user' | 'assistant'
          content: string
          created_at?: string
        }
        Update: {
          id?: string
          chat_id?: string
          user_id?: string
          role?: 'user' | 'assistant'
          content?: string
          created_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
}