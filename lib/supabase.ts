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

// 타입 정의 (새로운 DB 스키마에 맞춤)
export interface Project {
  id: string
  title: string
  description?: string
  video_url?: string
  video_id?: string
  video_title?: string
  video_duration: number
  visibility: "public" | "private" | "link_only"
  owner_id: string // UUID 타입
  created_at: string
  updated_at: string
}

export interface Segment {
  id: string
  title: string
  description?: string
  video_id: string
  video_title?: string
  start_time: number
  end_time: number
  owner_id: string // UUID 타입
  created_at: string
  updated_at: string
}

export interface QueueItem {
  id: number // SERIAL 타입
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
  videoId: string
  title: string
  description: string
  startTime: number
  endTime: number
  videoTitle?: string
}

export interface ClientQueueItem {
  id: string
  type: "segment" | "description"
  segment?: ClientSegment
  description?: string
}
