import { createClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// 클라이언트 사이드 Supabase 클라이언트 (싱글톤)
let supabaseClient: ReturnType<typeof createClient> | null = null

export function getSupabaseClient() {
  if (!supabaseClient) {
    supabaseClient = createClient(supabaseUrl, supabaseAnonKey)
  }
  return supabaseClient
}

// 서버 사이드 Supabase 클라이언트
export function createServerClient() {
  return createClient(supabaseUrl, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

// 새로운 DB 스키마에 맞춘 타입 정의
export interface Project {
  id: string
  title: string
  description?: string
  visibility: "public" | "private" | "link_only"
  owner_id: string
  created_at: string
  updated_at: string
}

export interface Segment {
  id: string
  project_id: string
  title: string
  description?: string
  video_id: string
  video_title?: string
  start_time: number
  end_time: number
  order_index: number
  owner_id: string
  created_at: string
  updated_at: string
}

export interface QueueItem {
  id: number
  project_id: string
  item_type: "segment" | "description"
  segment_id?: string
  description_text?: string
  order_index: number
  created_at: string
}

// 클라이언트용 인터페이스 (프론트엔드에서 사용)
export interface ClientSegment {
  id: string
  title: string
  description: string
  videoId: string
  videoTitle?: string
  startTime: number
  endTime: number
  orderIndex: number
}

export interface ClientQueueItem {
  id: string
  type: "segment" | "description"
  segment?: ClientSegment
  description?: string
  orderIndex: number
}
