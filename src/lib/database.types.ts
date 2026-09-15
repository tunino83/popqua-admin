export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Message {
  id: string
  text: string
  location: string
  created_at: string
  visible_at: string
  expires_at: string
  votes_up: number
  votes_down: number
  report_count: number
  is_hidden_by_reports: boolean
  is_anonymous: boolean
  place_id: string | null
  username: string
  author_id: string | null
  display_nickname: string
  grid_cell: string | null
  place_name?: string | null
  title?: string | null
  subdomain?: string | null
  image_url?: string | null
  message_type?: 'message' | 'event' | 'offer' | null
  distance_meters?: number | null
}

export interface Database {
  public: {
    Tables: {
      messages: {
        Row: {
          id: string
          text: string
          title: string | null
          location: string
          created_at: string
          visible_at: string
          expires_at: string
          votes_up: number
          votes_down: number
          report_count: number
          is_anonymous: boolean
          place_id: string | null
          username: string
          author_id: string | null
          display_nickname: string
          grid_cell: string | null
          message_type: 'message' | 'event' | 'offer' | null
        }
        Insert: Record<string, unknown>
        Update: Record<string, unknown>
      }
      profiles: {
        Row: {
          id: string
          username: string
          role: string | null
          avatar_url: string | null
          created_at: string
        }
        Insert: Record<string, unknown>
        Update: Record<string, unknown>
      }
      system_settings: {
        Row: {
          key: string
          value: string
          description: string | null
          updated_at: string
        }
        Insert: Record<string, unknown>
        Update: Record<string, unknown>
      }
    }
    Views: Record<string, never>
    Functions: Record<string, unknown>
    Enums: Record<string, never>
  }
}
