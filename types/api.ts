// HTTP 메서드
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'

// API 응답 기본 구조
export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
  message?: string
  code?: string | number
}

// 페이지네이션 정보
export interface PaginationInfo {
  page: number
  limit: number
  total: number
  totalPages: number
  hasNext: boolean
  hasPrev: boolean
}

// 페이지네이션된 응답
export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: PaginationInfo
}

// API 에러 클래스
export class ApiError extends Error {
  public readonly code: string | number
  public readonly status?: number
  public readonly response?: unknown

  constructor(
    message: string,
    code: string | number = 'UNKNOWN_ERROR',
    status?: number,
    response?: unknown
  ) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.status = status
    this.response = response
  }
}

// 요청 설정
export interface RequestConfig {
  method?: HttpMethod
  headers?: Record<string, string>
  params?: Record<string, unknown>
  timeout?: number
  retries?: number
  retryDelay?: number
}

// 업로드 진행 상태
export interface UploadProgress {
  loaded: number
  total: number
  percentage: number
}

// 파일 업로드 설정
export interface FileUploadConfig extends RequestConfig {
  onProgress?: (progress: UploadProgress) => void
  file: File
  fieldName?: string
}

// 검색 필터
export interface SearchFilter {
  query?: string
  category?: string
  tags?: string[]
  dateFrom?: string
  dateTo?: string
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

// 정렬 옵션
export interface SortOption {
  field: string
  direction: 'asc' | 'desc'
  label: string
}

// API 상태
export interface ApiState<T = unknown> {
  data: T | null
  loading: boolean
  error: string | null
  lastFetch: Date | null
}

// 캐시 설정
export interface CacheConfig {
  ttl: number // Time to live in milliseconds
  key: string
  tags?: string[]
}

// Rate Limiting 정보
export interface RateLimitInfo {
  limit: number
  remaining: number
  reset: Date
  retryAfter?: number
}

// API 응답 헤더
export interface ApiResponseHeaders {
  'content-type'?: string
  'content-length'?: string
  'x-rate-limit-limit'?: string
  'x-rate-limit-remaining'?: string
  'x-rate-limit-reset'?: string
  'x-request-id'?: string
  [key: string]: string | undefined
}

// 완전한 API 응답
export interface FullApiResponse<T = unknown> {
  data: T
  status: number
  statusText: string
  headers: ApiResponseHeaders
  config: RequestConfig
}

// 웹훅 페이로드
export interface WebhookPayload {
  event: string
  timestamp: string
  data: unknown
  id: string
}

// 인증 토큰
export interface AuthToken {
  accessToken: string
  refreshToken?: string
  expiresAt: Date
  tokenType: 'Bearer' | 'Basic'
}

// 인증 상태
export interface AuthState {
  isAuthenticated: boolean
  user: unknown | null
  token: AuthToken | null
  loading: boolean
  error: string | null
}

// 배치 요청
export interface BatchRequest {
  id: string
  method: HttpMethod
  url: string
  body?: unknown
  headers?: Record<string, string>
}

// 배치 응답
export interface BatchResponse {
  id: string
  status: number
  body: unknown
  headers?: Record<string, string>
}

// 실시간 연결 상태
export interface RealtimeConnectionState {
  connected: boolean
  reconnecting: boolean
  error: string | null
  lastConnected: Date | null
  connectionId?: string
}

// 실시간 메시지
export interface RealtimeMessage<T = unknown> {
  type: string
  payload: T
  timestamp: Date
  id: string
}

// API 메트릭스
export interface ApiMetrics {
  requestCount: number
  errorCount: number
  averageResponseTime: number
  lastRequestTime: Date | null
  uptime: number
} 