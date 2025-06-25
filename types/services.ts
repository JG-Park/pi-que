// Service Layer Type Definitions
// Following SOLID principles for clean architecture

import { YouTubeVideoInfo, YouTubePlayerConfig } from './youtube';
import { ApiResponse, ApiError } from './api';

// =============================================================================
// Base Service Interfaces
// =============================================================================

/**
 * 기본 서비스 인터페이스 - 모든 서비스가 구현해야 하는 공통 계약
 */
export interface BaseService {
  readonly serviceName: string;
  readonly version: string;
  isHealthy(): Promise<boolean>;
  dispose?(): Promise<void>;
}

/**
 * 페이지네이션 지원 서비스를 위한 인터페이스
 */
export interface PaginatedResponse<T> {
  items: T[];
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
    hasNext: boolean;
    hasPrevious: boolean;
  };
}

/**
 * 검색 가능한 서비스를 위한 인터페이스
 */
export interface SearchableService<T, U = string> {
  search(query: U, options?: SearchOptions): Promise<PaginatedResponse<T>>;
}

export interface SearchOptions {
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  filters?: Record<string, any>;
}

// =============================================================================
// YouTube API Service Interface
// =============================================================================

export interface YouTubeAPIService extends BaseService, SearchableService<YouTubeVideoInfo, YouTubeSearchQuery> {
  // 비디오 검색
  searchVideos(query: YouTubeSearchQuery): Promise<PaginatedResponse<YouTubeVideoInfo>>;
  
  // 비디오 세부 정보 조회
  getVideoDetails(videoId: string): Promise<YouTubeVideoInfo>;
  
  // 여러 비디오 정보 한번에 조회
  getMultipleVideoDetails(videoIds: string[]): Promise<YouTubeVideoInfo[]>;
  
  // 추천 비디오 조회
  getRelatedVideos(videoId: string, options?: SearchOptions): Promise<PaginatedResponse<YouTubeVideoInfo>>;
  
  // URL에서 비디오 ID 추출
  extractVideoId(url: string): string | null;
  
  // 비디오 URL 유효성 검사
  validateVideoUrl(url: string): boolean;
  
  // API 할당량 정보
  getQuotaUsage(): Promise<YouTubeQuotaInfo>;
}

export interface YouTubeSearchQuery {
  q: string; // 검색어
  channelId?: string;
  publishedAfter?: Date;
  publishedBefore?: Date;
  duration?: 'short' | 'medium' | 'long';
  order?: 'date' | 'rating' | 'relevance' | 'title' | 'viewCount';
  safeSearch?: 'moderate' | 'none' | 'strict';
  type?: 'video' | 'channel' | 'playlist';
}

export interface YouTubeQuotaInfo {
  used: number;
  limit: number;
  remaining: number;
  resetTime: Date;
}

// =============================================================================
// Project Management Service Interface
// =============================================================================

export interface ProjectService extends BaseService {
  // CRUD 작업
  createProject(project: CreateProjectRequest): Promise<Project>;
  getProject(id: string): Promise<Project>;
  getAllProjects(options?: SearchOptions): Promise<PaginatedResponse<Project>>;
  updateProject(id: string, updates: UpdateProjectRequest): Promise<Project>;
  deleteProject(id: string): Promise<void>;
  
  // 프로젝트 복제
  duplicateProject(id: string, newName: string): Promise<Project>;
  
  // 프로젝트 내보내기/가져오기
  exportProject(id: string, format: ExportFormat): Promise<ExportResult>;
  importProject(data: ImportData): Promise<Project>;
  
  // 프로젝트 공유
  shareProject(id: string, shareOptions: ShareOptions): Promise<ShareResult>;
  getSharedProject(shareId: string): Promise<Project>;
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  videoUrl: string;
  videoInfo?: YouTubeVideoInfo;
  segments: Segment[];
  queue: QueueItem[];
  settings: ProjectSettings;
  metadata: ProjectMetadata;
}

export interface CreateProjectRequest {
  name: string;
  description?: string;
  videoUrl: string;
  settings?: Partial<ProjectSettings>;
}

export interface UpdateProjectRequest {
  name?: string;
  description?: string;
  videoUrl?: string;
  settings?: Partial<ProjectSettings>;
}

export interface ProjectSettings {
  autoSave: boolean;
  autoSaveInterval: number; // 초 단위
  defaultVolume: number; // 0-100
  playbackRate: number; // 0.25-2.0
  theme: 'light' | 'dark' | 'auto';
  visibility: 'private' | 'public' | 'unlisted';
}

export interface ProjectMetadata {
  createdAt: Date;
  updatedAt: Date;
  lastAccessedAt: Date;
  version: string;
  owner?: string;
  collaborators?: string[];
  tags?: string[];
}

export type ExportFormat = 'json' | 'csv' | 'srt' | 'vtt';

export interface ExportResult {
  format: ExportFormat;
  data: string | Blob;
  filename: string;
}

export interface ImportData {
  format: ExportFormat;
  data: string | File;
}

export interface ShareOptions {
  visibility: 'public' | 'unlisted';
  allowComments?: boolean;
  allowDownload?: boolean;
  expiresAt?: Date;
}

export interface ShareResult {
  shareId: string;
  shareUrl: string;
  expiresAt?: Date;
}

// =============================================================================
// Segment Management Service Interface
// =============================================================================

export interface SegmentService extends BaseService {
  // CRUD 작업
  createSegment(projectId: string, segment: CreateSegmentRequest): Promise<Segment>;
  getSegment(projectId: string, segmentId: string): Promise<Segment>;
  getProjectSegments(projectId: string, options?: SearchOptions): Promise<PaginatedResponse<Segment>>;
  updateSegment(projectId: string, segmentId: string, updates: UpdateSegmentRequest): Promise<Segment>;
  deleteSegment(projectId: string, segmentId: string): Promise<void>;
  
  // 세그먼트 순서 변경
  reorderSegments(projectId: string, segmentIds: string[]): Promise<void>;
  
  // 세그먼트 복제
  duplicateSegment(projectId: string, segmentId: string): Promise<Segment>;
  
  // 세그먼트 병합/분할
  mergeSegments(projectId: string, segmentIds: string[]): Promise<Segment>;
  splitSegment(projectId: string, segmentId: string, splitTime: number): Promise<Segment[]>;
  
  // 세그먼트 검색
  searchSegments(projectId: string, query: string, options?: SearchOptions): Promise<PaginatedResponse<Segment>>;
}

export interface Segment {
  id: string;
  title: string;
  description?: string;
  startTime: number; // 초 단위
  endTime: number; // 초 단위
  tags: string[];
  metadata: SegmentMetadata;
  settings: SegmentSettings;
}

export interface CreateSegmentRequest {
  title: string;
  description?: string;
  startTime: number;
  endTime: number;
  tags?: string[];
  settings?: Partial<SegmentSettings>;
}

export interface UpdateSegmentRequest {
  title?: string;
  description?: string;
  startTime?: number;
  endTime?: number;
  tags?: string[];
  settings?: Partial<SegmentSettings>;
}

export interface SegmentMetadata {
  createdAt: Date;
  updatedAt: Date;
  order: number;
  duration: number; // 계산된 값 (endTime - startTime)
}

export interface SegmentSettings {
  autoPlay: boolean;
  loop: boolean;
  volume: number; // 0-100
  playbackRate: number; // 0.25-2.0
  fadeIn: number; // 초 단위
  fadeOut: number; // 초 단위
}

// =============================================================================
// Queue Management Service Interface
// =============================================================================

export interface QueueService extends BaseService {
  // 큐 관리
  addToQueue(projectId: string, item: AddQueueItemRequest): Promise<QueueItem>;
  removeFromQueue(projectId: string, itemId: string): Promise<void>;
  clearQueue(projectId: string): Promise<void>;
  getQueue(projectId: string): Promise<QueueItem[]>;
  
  // 큐 아이템 순서 변경
  reorderQueue(projectId: string, itemIds: string[]): Promise<void>;
  moveQueueItem(projectId: string, itemId: string, newPosition: number): Promise<void>;
  
  // 재생 제어
  playNext(projectId: string): Promise<QueueItem | null>;
  playPrevious(projectId: string): Promise<QueueItem | null>;
  playItem(projectId: string, itemId: string): Promise<void>;
  
  // 큐 상태 관리
  getQueueState(projectId: string): Promise<QueueState>;
  updateQueueState(projectId: string, state: Partial<QueueState>): Promise<QueueState>;
}

export interface QueueItem {
  id: string;
  segmentId: string;
  segment: Segment;
  order: number;
  metadata: QueueItemMetadata;
}

export interface AddQueueItemRequest {
  segmentId: string;
  position?: number; // 지정하지 않으면 맨 끝에 추가
}

export interface QueueItemMetadata {
  addedAt: Date;
  playCount: number;
  lastPlayedAt?: Date;
}

export interface QueueState {
  currentItemId: string | null;
  currentPosition: number;
  isPlaying: boolean;
  isLooping: boolean;
  isShuffled: boolean;
  repeatMode: 'none' | 'one' | 'all';
}

// =============================================================================
// Storage Service Interfaces
// =============================================================================

export interface StorageService extends BaseService {
  // 기본 CRUD
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T): Promise<void>;
  remove(key: string): Promise<void>;
  clear(): Promise<void>;
  
  // 키 관리
  getKeys(): Promise<string[]>;
  exists(key: string): Promise<boolean>;
  
  // 배치 작업
  getMultiple<T>(keys: string[]): Promise<Record<string, T | null>>;
  setMultiple<T>(items: Record<string, T>): Promise<void>;
  removeMultiple(keys: string[]): Promise<void>;
  
  // 스토리지 정보
  getStorageInfo(): Promise<StorageInfo>;
}

export interface StorageInfo {
  used: number; // 바이트 단위
  available: number; // 바이트 단위
  total: number; // 바이트 단위
  itemCount: number;
}

/**
 * 로컬 스토리지 서비스 인터페이스
 */
export interface LocalStorageService extends StorageService {
  // 로컬 스토리지 특화 기능
  exportData(): Promise<string>;
  importData(data: string): Promise<void>;
  getStorageQuota(): Promise<StorageQuota>;
}

export interface StorageQuota {
  quota: number;
  usage: number;
  available: number;
}

// =============================================================================
// Supabase Integration Service Interface
// =============================================================================

export interface SupabaseService extends BaseService {
  // 인증
  signIn(credentials: SignInCredentials): Promise<AuthResult>;
  signOut(): Promise<void>;
  getCurrentUser(): Promise<User | null>;
  
  // 프로젝트 동기화
  syncProject(project: Project): Promise<Project>;
  fetchProject(id: string): Promise<Project>;
  deleteRemoteProject(id: string): Promise<void>;
  
  // 사용자 프로젝트 목록
  getUserProjects(userId: string, options?: SearchOptions): Promise<PaginatedResponse<Project>>;
  
  // 실시간 동기화
  subscribeToProjectChanges(projectId: string, callback: (project: Project) => void): Promise<() => void>;
  
  // 오프라인 지원
  getOfflineChanges(): Promise<OfflineChange[]>;
  syncOfflineChanges(): Promise<SyncResult>;
  
  // 파일 업로드 (썸네일, 첨부파일 등)
  uploadFile(file: File, path: string): Promise<UploadResult>;
  deleteFile(path: string): Promise<void>;
  getFileUrl(path: string): Promise<string>;
}

export interface SignInCredentials {
  email: string;
  password: string;
}

export interface AuthResult {
  user: User;
  session: Session;
}

export interface User {
  id: string;
  email: string;
  name?: string;
  avatar?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Session {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
}

export interface OfflineChange {
  id: string;
  type: 'create' | 'update' | 'delete';
  entity: 'project' | 'segment' | 'queue';
  entityId: string;
  data: any;
  timestamp: Date;
}

export interface SyncResult {
  success: boolean;
  syncedChanges: number;
  conflicts: SyncConflict[];
  errors: SyncError[];
}

export interface SyncConflict {
  entityId: string;
  localData: any;
  remoteData: any;
  resolution?: 'local' | 'remote' | 'merge';
}

export interface SyncError {
  changeId: string;
  error: string;
  retryable: boolean;
}

export interface UploadResult {
  path: string;
  url: string;
  size: number;
  mimeType: string;
}

// =============================================================================
// Service Factory and Dependency Injection
// =============================================================================

/**
 * 서비스 팩토리 인터페이스 - 의존성 주입을 위한 계약
 */
export interface ServiceFactory {
  createYouTubeAPIService(): YouTubeAPIService;
  createProjectService(): ProjectService;
  createSegmentService(): SegmentService;
  createQueueService(): QueueService;
  createLocalStorageService(): LocalStorageService;
  createSupabaseService(): SupabaseService;
}

/**
 * 서비스 컨테이너 인터페이스 - 단일 책임 원칙을 위한 서비스 관리
 */
export interface ServiceContainer {
  register<T extends BaseService>(name: string, service: T): void;
  get<T extends BaseService>(name: string): T;
  getAll(): Map<string, BaseService>;
  dispose(): Promise<void>;
}

// =============================================================================
// Error Handling for Services
// =============================================================================

export class ServiceError extends Error {
  constructor(
    message: string,
    public readonly serviceName: string,
    public readonly errorCode: string,
    public readonly originalError?: Error
  ) {
    super(message);
    this.name = 'ServiceError';
  }
}

export class ValidationError extends ServiceError {
  constructor(serviceName: string, field: string, value: any, expectedType: string) {
    super(
      `Validation failed for field '${field}': expected ${expectedType}, got ${typeof value}`,
      serviceName,
      'VALIDATION_ERROR'
    );
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends ServiceError {
  constructor(serviceName: string, entityType: string, id: string) {
    super(
      `${entityType} with id '${id}' not found`,
      serviceName,
      'NOT_FOUND'
    );
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends ServiceError {
  constructor(serviceName: string, message: string) {
    super(message, serviceName, 'CONFLICT');
    this.name = 'ConflictError';
  }
}

export class QuotaExceededError extends ServiceError {
  constructor(serviceName: string, quotaType: string) {
    super(
      `${quotaType} quota exceeded`,
      serviceName,
      'QUOTA_EXCEEDED'
    );
    this.name = 'QuotaExceededError';
  }
}

// Repository interfaces for dependency inversion
export interface Repository<T, TCreate = Partial<T>, TUpdate = Partial<T>> {
  findAll(): Promise<T[]>;
  findById(id: string): Promise<T | null>;
  create(data: TCreate): Promise<T>;
  update(id: string, data: TUpdate): Promise<T>;
  delete(id: string): Promise<void>;
  exists(id: string): Promise<boolean>;
}

export interface ProjectRepository extends Repository<Project, CreateProjectRequest, UpdateProjectRequest> {
  findByName(name: string): Promise<Project[]>;
  search(query: string): Promise<Project[]>;
}

export interface SegmentRepository extends Repository<Segment, CreateSegmentRequest, UpdateSegmentRequest> {
  findByProjectId(projectId: string): Promise<Segment[]>;
  findByTimeRange(projectId: string, startTime: number, endTime: number): Promise<Segment[]>;
}

export interface QueueRepository extends Repository<QueueItem, AddQueueItemRequest, Partial<QueueItem>> {
  findByProjectId(projectId: string): Promise<QueueItem[]>;
  reorder(projectId: string, itemIds: string[]): Promise<void>;
} 