import { useCallback, useRef } from 'react';
import { useQuery, useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { YouTubeAPIServiceImpl } from '@/services/youtube/youtube-api.service';
import { 
  UseVideoSearchState, 
  YouTubeVideoInfo, 
  BaseHookState 
} from '@/types/hooks';

// YouTube API 서비스 인스턴스 생성
const createYouTubeService = () => {
  const apiKey = process.env.NEXT_PUBLIC_YOUTUBE_API_KEY;
  if (!apiKey) {
    console.warn('YouTube API key not found. Some features may not work.');
    return null;
  }
  return new YouTubeAPIServiceImpl(apiKey);
};

// Query Keys
export const videoSearchKeys = {
  all: ['videoSearch'] as const,
  search: (query: string) => [...videoSearchKeys.all, 'search', query] as const,
  details: (videoId: string) => [...videoSearchKeys.all, 'details', videoId] as const,
  suggestions: (videoId: string) => [...videoSearchKeys.all, 'suggestions', videoId] as const,
};

export interface VideoSearchOptions {
  maxResults?: number;
  order?: 'relevance' | 'date' | 'rating' | 'viewCount' | 'title';
  videoDuration?: 'short' | 'medium' | 'long';
  videoDefinition?: 'high' | 'standard';
  enabled?: boolean;
}

export interface UseVideoSearchWithQueryState extends BaseHookState {
  // 검색 결과
  data: YouTubeVideoInfo[];
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  
  // 현재 검색 쿼리
  currentQuery: string;
  
  // 액션들
  search: (query: string, options?: VideoSearchOptions) => void;
  loadMore: () => void;
  reset: () => void;
  invalidateCache: () => void;
  
  // 개별 비디오 상세 정보 조회
  getVideoDetails: (videoId: string) => Promise<YouTubeVideoInfo | null>;
  
  // 관련 영상 조회  
  getRelatedVideos: (videoId: string) => Promise<YouTubeVideoInfo[]>;
}

/**
 * React Query를 사용하는 개선된 비디오 검색 Hook
 * 
 * 특징:
 * - 무한 스크롤 지원
 * - 자동 캐싱 및 백그라운드 업데이트
 * - 실제 YouTube API 연동
 * - 오류 처리 및 재시도 로직
 * - TypeScript 완전 지원
 */
export function useVideoSearchWithQuery(
  initialQuery?: string,
  options: VideoSearchOptions = {}
): UseVideoSearchWithQueryState {
  const queryClient = useQueryClient();
  const youtubeService = useRef(createYouTubeService());
  const currentQueryRef = useRef(initialQuery || '');

  // 무한 쿼리를 사용한 검색
  const {
    data,
    error,
    isLoading,
    isFetching,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    refetch,
  } = useInfiniteQuery({
    queryKey: videoSearchKeys.search(currentQueryRef.current),
    queryFn: async ({ pageParam }) => {
      if (!youtubeService.current) {
        // API 키가 없으면 Mock 데이터 반환
        return getMockSearchResults(currentQueryRef.current, pageParam);
      }

      const searchQuery = {
        query: currentQueryRef.current,
        maxResults: options.maxResults || 25,
        pageToken: pageParam,
        order: options.order || 'relevance',
        videoDuration: options.videoDuration,
        videoDefinition: options.videoDefinition,
      };

      const response = await youtubeService.current.searchVideos(searchQuery);
      return {
        items: response.data || [],
        nextPageToken: response.nextPageToken,
        totalResults: response.total || 0,
      };
    },
    getNextPageParam: (lastPage) => lastPage.nextPageToken,
    enabled: !!currentQueryRef.current && (options.enabled !== false),
    staleTime: 5 * 60 * 1000, // 5분간 fresh
    gcTime: 30 * 60 * 1000, // 30분간 캐시 유지
    retry: (failureCount, error: any) => {
      // YouTube API 쿼터 초과시 재시도 안함
      if (error?.status === 403) return false;
      return failureCount < 2;
    },
  });

  // 검색 함수
  const search = useCallback((query: string, searchOptions?: VideoSearchOptions) => {
    if (!query.trim()) return;
    
    currentQueryRef.current = query;
    
    // 새로운 검색시 기존 캐시 무효화
    queryClient.removeQueries({
      queryKey: videoSearchKeys.search(query),
    });
    
    // 검색 옵션 업데이트
    if (searchOptions) {
      Object.assign(options, searchOptions);
    }
    
    refetch();
  }, [queryClient, refetch, options]);

  // 더 보기 함수
  const loadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  // 리셋 함수
  const reset = useCallback(() => {
    currentQueryRef.current = '';
    queryClient.removeQueries({
      queryKey: videoSearchKeys.all,
    });
  }, [queryClient]);

  // 캐시 무효화
  const invalidateCache = useCallback(() => {
    queryClient.invalidateQueries({
      queryKey: videoSearchKeys.all,
    });
  }, [queryClient]);

  // 개별 비디오 상세 정보
  const getVideoDetails = useCallback(async (videoId: string): Promise<YouTubeVideoInfo | null> => {
    if (!youtubeService.current) return null;

    try {
      const cachedData = queryClient.getQueryData(videoSearchKeys.details(videoId));
      if (cachedData) return cachedData as YouTubeVideoInfo;

      const details = await youtubeService.current.getVideoDetails(videoId);
      
      // 캐시에 저장
      queryClient.setQueryData(videoSearchKeys.details(videoId), details);
      
      return details;
    } catch (error) {
      console.error('Failed to get video details:', error);
      return null;
    }
  }, [queryClient]);

  // 관련 영상 조회
  const getRelatedVideos = useCallback(async (videoId: string): Promise<YouTubeVideoInfo[]> => {
    if (!youtubeService.current) return [];

    try {
      const cachedData = queryClient.getQueryData(videoSearchKeys.suggestions(videoId));
      if (cachedData) return cachedData as YouTubeVideoInfo[];

      const related = await youtubeService.current.getRelatedVideos(videoId);
      const relatedVideos = related.data || [];
      
      // 캐시에 저장
      queryClient.setQueryData(videoSearchKeys.suggestions(videoId), relatedVideos);
      
      return relatedVideos;
    } catch (error) {
      console.error('Failed to get related videos:', error);
      return [];
    }
  }, [queryClient]);

  // 검색 결과 데이터 평탄화
  const flattenedData = data?.pages.flatMap(page => page.items) || [];

  return {
    // 상태
    isLoading,
    error: error as Error | null,
    isSuccess: !isLoading && !error,
    
    // 데이터
    data: flattenedData,
    hasNextPage: !!hasNextPage,
    isFetchingNextPage,
    
    // 현재 쿼리
    currentQuery: currentQueryRef.current,
    
    // 액션들
    search,
    loadMore,
    reset,
    invalidateCache,
    getVideoDetails,
    getRelatedVideos,
  };
}

/**
 * Mock 데이터 (API 키가 없을 때 사용)
 */
function getMockSearchResults(query: string, pageToken?: string) {
  const mockVideos: YouTubeVideoInfo[] = [
    {
      id: `mock-${Date.now()}-1`,
      title: `${query} - 실전 React Hook 활용법`,
      description: 'React Hook을 실무에서 효과적으로 활용하는 방법을 알아봅니다.',
      channelTitle: 'React Master',
      thumbnail: 'https://via.placeholder.com/320x180/61DAFB/000000?text=React',
      publishedAt: new Date().toISOString(),
      duration: 780, // 13분
      viewCount: 12340,
      url: `https://www.youtube.com/watch?v=mock-${Date.now()}-1`
    },
    {
      id: `mock-${Date.now()}-2`,
      title: `${query} - TypeScript 고급 패턴`,
      description: 'TypeScript의 고급 타입 시스템을 활용한 안전한 코드 작성법',
      channelTitle: 'TypeScript Pro',
      thumbnail: 'https://via.placeholder.com/320x180/3178C6/ffffff?text=TypeScript',
      publishedAt: new Date(Date.now() - 86400000).toISOString(),
      duration: 1260, // 21분
      viewCount: 8750,
      url: `https://www.youtube.com/watch?v=mock-${Date.now()}-2`
    },
    {
      id: `mock-${Date.now()}-3`,
      title: `${query} - Next.js 최신 기능 살펴보기`,
      description: 'Next.js의 최신 기능들과 성능 최적화 기법',
      channelTitle: 'Next.js Korea',
      thumbnail: 'https://via.placeholder.com/320x180/000000/ffffff?text=Next.js',
      publishedAt: new Date(Date.now() - 172800000).toISOString(),
      duration: 1500, // 25분
      viewCount: 19680,
      url: `https://www.youtube.com/watch?v=mock-${Date.now()}-3`
    }
  ];

  return {
    items: mockVideos,
    nextPageToken: pageToken ? undefined : 'mock-next-token',
    totalResults: 50,
  };
} 