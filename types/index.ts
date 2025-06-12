export interface Segment {
  id: string
  title: string
  description: string
  videoId: string
  videoTitle?: string
  startTime: number
  endTime: number
  orderIndex: number
}

export interface QueueItem {
  id: string
  type: "segment" | "description"
  segment?: Segment
  description?: string
  orderIndex: number
}

export interface YouTubeVideo {
  id: string
  title: string
  thumbnail: string
  duration: string
  channelTitle: string
  publishedAt: string
  description?: string
  viewCount?: string
}

export interface Project {
  id: string
  title: string
  description?: string
  visibility: "public" | "private" | "link_only"
  owner_id: string
  segments: Segment[]
  queue: QueueItem[]
  createdAt: string
  updatedAt: string
}
