'use client';

import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { 
  YouTubeAPIService, 
  YouTubeSearchQuery, 
  YouTubeQuotaInfo,
  PaginatedResponse,
  SearchOptions,
  ServiceError,
  ValidationError,
  QuotaExceededError,
  NotFoundError
} from '../../types/services';
import { YouTubeVideoInfo, YouTubePlayerState } from '../../types/youtube';
import { errorHandler, ErrorCategory, ErrorSeverity } from '../../utils/common/error-handler';

/**
 * YouTube API 서비스 구현
 * SOLID 원칙을 따르며, axios를 사용하여 YouTube Data API v3와 통신
 */
export class YouTubeAPIServiceImpl implements YouTubeAPIService {
  public readonly serviceName = 'YouTubeAPIService';
  public readonly version = '1.0.0';

  private readonly httpClient: AxiosInstance;
  private readonly baseURL = 'https://www.googleapis.com/youtube/v3';
  private readonly apiKey: string;
  
  // Rate limiting and quota management
  private quotaUsed = 0;
  private quotaLimit = 10000; // Default daily quota
  private quotaResetTime = new Date();
  
  // Request cache for efficiency
  private readonly cache = new Map<string, { data: any; expiry: number }>();
  private readonly cacheTimeout = 5 * 60 * 1000; // 5분

  constructor(apiKey: string, options: YouTubeAPIServiceOptions = {}) {
    if (!apiKey) {
      throw new ValidationError(this.serviceName, 'apiKey', apiKey, 'non-empty string');
    }

    this.apiKey = apiKey;
    this.quotaLimit = options.quotaLimit || 10000;

    this.httpClient = axios.create({
      baseURL: this.baseURL,
      timeout: options.timeout || 10000,
      params: {
        key: this.apiKey,
      },
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'YouTube-Segment-Player/1.0',
      },
    });

    this.setupInterceptors();
  }

  /**
   * 서비스 상태 확인
   */
  async isHealthy(): Promise<boolean> {
    try {
      const response = await this.httpClient.get('/search', {
        params: {
          part: 'snippet',
          q: 'test',
          maxResults: 1,
          type: 'video',
        },
      });
      return response.status === 200;
    } catch (error) {
      console.error('[YouTubeAPIService] Health check failed:', error);
      return false;
    }
  }

  /**
   * 비디오 검색
   */
  async searchVideos(query: YouTubeSearchQuery): Promise<PaginatedResponse<YouTubeVideoInfo>> {
    try {
      this.validateSearchQuery(query);
      
      const cacheKey = this.generateCacheKey('search', query);
      const cached = this.getFromCache(cacheKey);
      if (cached) {
        return cached;
      }

      const searchParams = this.buildSearchParams(query);
      const response = await this.httpClient.get('/search', { params: searchParams });
      
      this.updateQuotaUsage(100); // Search costs 100 quota units
      
      const result = this.transformSearchResponse(response.data, query);
      this.setCache(cacheKey, result);
      
      return result;
    } catch (error) {
      const serviceError = this.handleError(error, 'searchVideos');
      errorHandler.createError(
        'YOUTUBE_SEARCH_FAILED',
        serviceError.message,
        ErrorCategory.YOUTUBE_API,
        ErrorSeverity.MEDIUM
      );
      throw serviceError;
    }
  }

  /**
   * 개별 검색 메서드 (인터페이스 호환성)
   */
  async search(query: YouTubeSearchQuery, options?: SearchOptions): Promise<PaginatedResponse<YouTubeVideoInfo>> {
    const searchQuery: YouTubeSearchQuery = {
      ...query,
      order: options?.sortBy as any || query.order,
    };
    
    return this.searchVideos(searchQuery);
  }

  /**
   * 비디오 세부 정보 조회
   */
  async getVideoDetails(videoId: string): Promise<YouTubeVideoInfo> {
    try {
      if (!videoId || typeof videoId !== 'string') {
        throw new ValidationError(this.serviceName, 'videoId', videoId, 'non-empty string');
      }

      const cacheKey = this.generateCacheKey('video', { videoId });
      const cached = this.getFromCache(cacheKey);
      if (cached) {
        return cached;
      }

      const response = await this.httpClient.get('/videos', {
        params: {
          part: 'snippet,contentDetails,statistics',
          id: videoId,
        },
      });

      this.updateQuotaUsage(1); // Video details costs 1 quota unit

      if (!response.data.items || response.data.items.length === 0) {
        throw new NotFoundError(this.serviceName, 'video', videoId);
      }

      const result = this.transformVideoResponse(response.data.items[0]);
      this.setCache(cacheKey, result);
      
      return result;
    } catch (error) {
      const serviceError = this.handleError(error, 'getVideoDetails');
      errorHandler.createError(
        'YOUTUBE_VIDEO_DETAILS_FAILED',
        serviceError.message,
        ErrorCategory.YOUTUBE_API,
        ErrorSeverity.MEDIUM
      );
      throw serviceError;
    }
  }

  /**
   * 여러 비디오 정보 한번에 조회
   */
  async getMultipleVideoDetails(videoIds: string[]): Promise<YouTubeVideoInfo[]> {
    try {
      if (!Array.isArray(videoIds) || videoIds.length === 0) {
        throw new ValidationError(this.serviceName, 'videoIds', videoIds, 'non-empty array');
      }

      if (videoIds.length > 50) {
        throw new ValidationError(this.serviceName, 'videoIds', videoIds.length, 'array with max 50 items');
      }

      const idsString = videoIds.join(',');
      const cacheKey = this.generateCacheKey('videos', { ids: idsString });
      const cached = this.getFromCache(cacheKey);
      if (cached) {
        return cached;
      }

      const response = await this.httpClient.get('/videos', {
        params: {
          part: 'snippet,contentDetails,statistics',
          id: idsString,
        },
      });

      this.updateQuotaUsage(1); // Batch video details costs 1 quota unit

      const result = response.data.items.map((item: any) => this.transformVideoResponse(item));
      this.setCache(cacheKey, result);
      
      return result;
    } catch (error) {
      const serviceError = this.handleError(error, 'getMultipleVideoDetails');
      errorHandler.createError(
        'YOUTUBE_BATCH_DETAILS_FAILED',
        serviceError.message,
        ErrorCategory.YOUTUBE_API,
        ErrorSeverity.MEDIUM
      );
      throw serviceError;
    }
  }

  /**
   * 관련 비디오 조회
   */
  async getRelatedVideos(videoId: string, options?: SearchOptions): Promise<PaginatedResponse<YouTubeVideoInfo>> {
    try {
      // YouTube API v3에서는 관련 비디오 직접 조회가 제한됨
      // 대신 같은 채널의 다른 비디오들을 조회
      const videoDetails = await this.getVideoDetails(videoId);
      const channelId = videoDetails.channelId;

      if (!channelId) {
        return {
          items: [],
          pagination: {
            page: 1,
            pageSize: 0,
            totalItems: 0,
            totalPages: 0,
            hasNext: false,
            hasPrevious: false,
          },
        };
      }

      const searchQuery: YouTubeSearchQuery = {
        q: '',
        channelId,
        order: 'relevance',
      };

      return this.searchVideos(searchQuery);
    } catch (error) {
      const serviceError = this.handleError(error, 'getRelatedVideos');
      errorHandler.createError(
        'YOUTUBE_RELATED_VIDEOS_FAILED',
        serviceError.message,
        ErrorCategory.YOUTUBE_API,
        ErrorSeverity.LOW
      );
      throw serviceError;
    }
  }

  /**
   * URL에서 비디오 ID 추출
   */
  extractVideoId(url: string): string | null {
    if (!url || typeof url !== 'string') {
      return null;
    }

    // YouTube URL 패턴들
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
      /youtube\.com\/v\/([^&\n?#]+)/,
      /youtube\.com\/shorts\/([^&\n?#]+)/,
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) {
        return match[1];
      }
    }

    return null;
  }

  /**
   * 비디오 URL 유효성 검사
   */
  validateVideoUrl(url: string): boolean {
    const videoId = this.extractVideoId(url);
    return videoId !== null && videoId.length === 11; // YouTube 비디오 ID는 11자
  }

  /**
   * API 할당량 정보 조회
   */
  async getQuotaUsage(): Promise<YouTubeQuotaInfo> {
    return {
      used: this.quotaUsed,
      limit: this.quotaLimit,
      remaining: Math.max(0, this.quotaLimit - this.quotaUsed),
      resetTime: this.quotaResetTime,
    };
  }

  /**
   * 서비스 정리
   */
  async dispose(): Promise<void> {
    this.cache.clear();
  }

  // Private helper methods

  private setupInterceptors(): void {
    // Request interceptor for quota checking
    this.httpClient.interceptors.request.use((config) => {
      if (this.quotaUsed >= this.quotaLimit) {
        throw new QuotaExceededError(this.serviceName, 'daily quota');
      }
      return config;
    });

    // Response interceptor for error handling
    this.httpClient.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 403) {
          if (error.response.data?.error?.errors?.[0]?.reason === 'quotaExceeded') {
            throw new QuotaExceededError(this.serviceName, 'API quota');
          }
        }
        return Promise.reject(error);
      }
    );
  }

  private validateSearchQuery(query: YouTubeSearchQuery): void {
    if (!query.q || typeof query.q !== 'string') {
      throw new ValidationError(this.serviceName, 'query.q', query.q, 'non-empty string');
    }

    if (query.q.length > 100) {
      throw new ValidationError(this.serviceName, 'query.q', query.q.length, 'string with max 100 characters');
    }
  }

  private buildSearchParams(query: YouTubeSearchQuery): Record<string, any> {
    const params: Record<string, any> = {
      part: 'snippet',
      q: query.q,
      type: query.type || 'video',
      maxResults: Math.min(50, 25), // Default 25, max 50
      order: query.order || 'relevance',
      safeSearch: query.safeSearch || 'moderate',
    };

    if (query.channelId) params.channelId = query.channelId;
    if (query.publishedAfter) params.publishedAfter = query.publishedAfter.toISOString();
    if (query.publishedBefore) params.publishedBefore = query.publishedBefore.toISOString();
    if (query.duration) params.videoDuration = query.duration;

    return params;
  }

  private transformSearchResponse(data: any, query: YouTubeSearchQuery): PaginatedResponse<YouTubeVideoInfo> {
    const items = data.items.map((item: any) => this.transformSearchItem(item));
    
    return {
      items,
      pagination: {
        page: 1, // YouTube API doesn't provide page numbers
        pageSize: items.length,
        totalItems: data.pageInfo?.totalResults || items.length,
        totalPages: 1,
        hasNext: !!data.nextPageToken,
        hasPrevious: false,
      },
    };
  }

  private transformSearchItem(item: any): YouTubeVideoInfo {
    return {
      id: item.id.videoId || item.id,
      title: item.snippet.title,
      description: item.snippet.description,
      thumbnail: item.snippet.thumbnails.high?.url || item.snippet.thumbnails.default?.url,
      channelId: item.snippet.channelId,
      channelTitle: item.snippet.channelTitle,
      publishedAt: new Date(item.snippet.publishedAt).toISOString(),
      duration: 'PT0S', // Search API doesn't include duration
      viewCount: '0', // Search API doesn't include statistics
      likeCount: '0',
      tags: [],
    };
  }

  private transformVideoResponse(item: any): YouTubeVideoInfo {
    return {
      id: item.id,
      title: item.snippet.title,
      description: item.snippet.description,
      thumbnail: item.snippet.thumbnails.high?.url || item.snippet.thumbnails.default?.url,
      channelId: item.snippet.channelId,
      channelTitle: item.snippet.channelTitle,
      publishedAt: new Date(item.snippet.publishedAt).toISOString(),
      duration: item.contentDetails?.duration || 'PT0S',
      viewCount: item.statistics?.viewCount || '0',
      likeCount: item.statistics?.likeCount || '0',
      tags: item.snippet.tags || [],
    };
  }

  private parseDuration(duration: string): number {
    // Parse ISO 8601 duration (PT1H2M3S) to seconds
    const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!match) return 0;

    const hours = parseInt(match[1] || '0', 10);
    const minutes = parseInt(match[2] || '0', 10);
    const seconds = parseInt(match[3] || '0', 10);

    return hours * 3600 + minutes * 60 + seconds;
  }

  private generateCacheKey(operation: string, params: any): string {
    return `${operation}:${JSON.stringify(params)}`;
  }

  private getFromCache(key: string): any {
    const cached = this.cache.get(key);
    if (cached && cached.expiry > Date.now()) {
      return cached.data;
    }
    this.cache.delete(key);
    return null;
  }

  private setCache(key: string, data: any): void {
    this.cache.set(key, {
      data,
      expiry: Date.now() + this.cacheTimeout,
    });
  }

  private updateQuotaUsage(cost: number): void {
    this.quotaUsed += cost;
    
    // Reset quota at midnight
    const now = new Date();
    if (now.getDate() !== this.quotaResetTime.getDate()) {
      this.quotaUsed = cost;
      this.quotaResetTime = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    }
  }

  private handleError(error: any, operation: string): ServiceError {
    if (error instanceof ServiceError) {
      return error;
    }

    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      const message = error.response?.data?.error?.message || error.message;

      switch (status) {
        case 400:
          return new ValidationError(this.serviceName, 'request', error.config?.params, 'valid parameters');
        case 403:
          return new QuotaExceededError(this.serviceName, 'API access');
        case 404:
          return new NotFoundError(this.serviceName, 'resource', 'unknown');
        default:
          return new ServiceError(
            `YouTube API ${operation} failed: ${message}`,
            this.serviceName,
            'YOUTUBE_API_ERROR',
            error
          );
      }
    }

    return new ServiceError(
      `Unexpected error in ${operation}: ${error.message}`,
      this.serviceName,
      'UNEXPECTED_ERROR',
      error
    );
  }
}

/**
 * YouTube API 서비스 생성 옵션
 */
export interface YouTubeAPIServiceOptions {
  timeout?: number;
  quotaLimit?: number;
  cacheTimeout?: number;
}

/**
 * YouTube API 서비스 생성 팩토리 함수
 * 환경변수에서 API 키를 자동으로 가져와 서비스 인스턴스를 생성
 */
export function createYouTubeAPIService(
  apiKey?: string, 
  options?: YouTubeAPIServiceOptions
): YouTubeAPIService {
  const key = apiKey || process.env.NEXT_PUBLIC_YOUTUBE_API_KEY;
  
  if (!key) {
    throw new Error(
      'YouTube API key is required. Set NEXT_PUBLIC_YOUTUBE_API_KEY environment variable or provide apiKey parameter.'
    );
  }
  
  return new YouTubeAPIServiceImpl(key, options);
}

/**
 * 기본 YouTube API 서비스 인스턴스
 * 환경변수에서 자동으로 설정을 가져와 초기화
 */
export const defaultYouTubeAPIService = createYouTubeAPIService();

/**
 * Default export for convenience
 */
export default YouTubeAPIServiceImpl; 