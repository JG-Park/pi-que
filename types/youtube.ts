// YouTube Player 상태
export enum YouTubePlayerState {
  UNSTARTED = -1,
  ENDED = 0,
  PLAYING = 1,
  PAUSED = 2,
  BUFFERING = 3,
  CUED = 5,
}

// YouTube 에러 코드
export enum YouTubeErrorCode {
  INVALID_PARAMETER = 2,
  HTML5_ERROR = 5,
  VIDEO_NOT_FOUND = 100,
  EMBED_NOT_ALLOWED = 101,
  EMBED_RESTRICTED = 150,
}

// YouTube Video 기본 정보
export interface YouTubeVideoInfo {
  id: string
  title: string
  description?: string
  thumbnail: string
  duration: string
  channelTitle: string
  channelId: string
  publishedAt: string
  viewCount?: string
  likeCount?: string
  tags?: string[]
}

// YouTube Player 설정
export interface YouTubePlayerConfig {
  height?: string | number
  width?: string | number
  playerVars?: {
    autoplay?: 0 | 1
    controls?: 0 | 1
    disablekb?: 0 | 1
    enablejsapi?: 0 | 1
    end?: number
    fs?: 0 | 1
    hl?: string
    iv_load_policy?: 1 | 3
    loop?: 0 | 1
    modestbranding?: 0 | 1
    origin?: string
    playlist?: string
    playsinline?: 0 | 1
    rel?: 0 | 1
    start?: number
    widget_referrer?: string
  }
}

// YouTube Player 이벤트
export interface YouTubePlayerEvent {
  target: YouTubePlayer
  data: number
}

// YouTube Player 인스턴스
export interface YouTubePlayer {
  // 기본 제어
  playVideo(): void
  pauseVideo(): void
  stopVideo(): void
  seekTo(seconds: number, allowSeekAhead?: boolean): void
  
  // 볼륨 제어
  setVolume(volume: number): void
  getVolume(): number
  mute(): void
  unMute(): void
  isMuted(): boolean
  
  // 정보 조회
  getCurrentTime(): number
  getDuration(): number
  getVideoLoadedFraction(): number
  getPlayerState(): YouTubePlayerState
  getPlaybackRate(): number
  
  // 비디오 관리
  loadVideoById(videoId: string, startSeconds?: number): void
  loadVideoByUrl(mediaContentUrl: string, startSeconds?: number): void
  cueVideoById(videoId: string, startSeconds?: number): void
  
  // 재생 목록
  nextVideo(): void
  previousVideo(): void
  getPlaylist(): string[]
  getPlaylistIndex(): number
  
  // 품질 설정
  getAvailableQualityLevels(): string[]
  getPlaybackQuality(): string
  setPlaybackQuality(suggestedQuality: string): void
  
  // 재생 속도
  getAvailablePlaybackRates(): number[]
  setPlaybackRate(suggestedRate: number): void
  
  // 비디오 정보
  getVideoData(): {
    video_id: string
    title: string
    author: string
  }
  
  // 기타
  destroy(): void
  getIframe(): HTMLIFrameElement
  addEventListener(event: string, listener: (event: YouTubePlayerEvent) => void): void
  removeEventListener(event: string, listener: (event: YouTubePlayerEvent) => void): void
}

// YouTube API 전역 객체
export interface YouTubeAPI {
  Player: new (elementId: string | HTMLElement, config: YouTubePlayerConfig) => YouTubePlayer
  PlayerState: typeof YouTubePlayerState
  ready: (callback: () => void) => void
}

// YouTube 검색 결과
export interface YouTubeSearchResult {
  kind: string
  etag: string
  id: {
    kind: string
    videoId: string
  }
  snippet: {
    publishedAt: string
    channelId: string
    title: string
    description: string
    thumbnails: {
      default: YouTubeThumbnail
      medium: YouTubeThumbnail
      high: YouTubeThumbnail
      standard?: YouTubeThumbnail
      maxres?: YouTubeThumbnail
    }
    channelTitle: string
    liveBroadcastContent: string
    publishTime: string
  }
}

export interface YouTubeThumbnail {
  url: string
  width: number
  height: number
}

// YouTube 검색 응답
export interface YouTubeSearchResponse {
  kind: string
  etag: string
  nextPageToken?: string
  prevPageToken?: string
  regionCode: string
  pageInfo: {
    totalResults: number
    resultsPerPage: number
  }
  items: YouTubeSearchResult[]
}

// YouTube 비디오 상세 정보
export interface YouTubeVideoDetails {
  kind: string
  etag: string
  id: string
  snippet: {
    publishedAt: string
    channelId: string
    title: string
    description: string
    thumbnails: {
      default: YouTubeThumbnail
      medium: YouTubeThumbnail
      high: YouTubeThumbnail
      standard?: YouTubeThumbnail
      maxres?: YouTubeThumbnail
    }
    channelTitle: string
    tags?: string[]
    categoryId: string
    liveBroadcastContent: string
    defaultLanguage?: string
    localized: {
      title: string
      description: string
    }
    defaultAudioLanguage?: string
  }
  contentDetails: {
    duration: string
    dimension: string
    definition: string
    caption: string
    licensedContent: boolean
    contentRating: Record<string, unknown>
    projection: string
  }
  statistics: {
    viewCount: string
    likeCount: string
    favoriteCount: string
    commentCount: string
  }
}

// YouTube 비디오 상세 응답
export interface YouTubeVideoDetailsResponse {
  kind: string
  etag: string
  items: YouTubeVideoDetails[]
}

// URL 파싱 결과
export interface YouTubeUrlParseResult {
  videoId: string | null
  timestamp?: number
  playlistId?: string
  isValid: boolean
  originalUrl: string
} 