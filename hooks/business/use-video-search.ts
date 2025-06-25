import { 
  useState, 
  useCallback, 
  useRef, 
  useEffect, 
  useMemo,
  useTransition,
  useDeferredValue,
  startTransition 
} from 'react';
import { 
  UseVideoSearchState, 
  YouTubeVideoInfo as HookYouTubeVideoInfo, 
  BaseHookState 
} from '@/types/hooks';
import { YouTubeVideoInfo as ServiceYouTubeVideoInfo } from '@/types/youtube';
import { defaultYouTubeAPIService } from '@/services/youtube/youtube-api.service';
import { ServiceError, ValidationError, QuotaExceededError } from '@/types/services';

// Enhanced error types for better error handling
export interface VideoSearchError extends Error {
  code: 'NETWORK_ERROR' | 'QUOTA_EXCEEDED' | 'INVALID_QUERY' | 'SERVICE_UNAVAILABLE' | 'UNKNOWN_ERROR';
  retryable: boolean;
  retryAfter?: number; // seconds
}

// Performance optimization: Memoized type conversion function
const convertVideoInfo = (serviceVideo: ServiceYouTubeVideoInfo): HookYouTubeVideoInfo => {
  // Parse duration from ISO 8601 format (PT4M13S) to seconds
  const parseDuration = (duration: string): number => {
    const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!match) return 0;
    
    const hours = parseInt(match[1] || '0', 10);
    const minutes = parseInt(match[2] || '0', 10);
    const seconds = parseInt(match[3] || '0', 10);
    
    return hours * 3600 + minutes * 60 + seconds;
  };

  return {
    id: serviceVideo.id,
    title: serviceVideo.title,
    description: serviceVideo.description || '',
    thumbnail: serviceVideo.thumbnail,
    duration: typeof serviceVideo.duration === 'string' ? parseDuration(serviceVideo.duration) : serviceVideo.duration,
    channelTitle: serviceVideo.channelTitle,
    publishedAt: serviceVideo.publishedAt,
  };
};

// React 18+: Enhanced hook with concurrent features and performance optimizations
export const useVideoSearch = (initialQuery?: string): UseVideoSearchState => {
  // React 18+: useTransition for non-urgent updates
  const [isPending, startTransition] = useTransition();
  
  // State management with enhanced error handling
  const [state, setState] = useState<BaseHookState>({
    isLoading: false,
    error: null,
    isSuccess: false,
  });

  const [data, setData] = useState<HookYouTubeVideoInfo[] | null>(null);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [currentQuery, setCurrentQuery] = useState(initialQuery || '');
  const [nextPageToken, setNextPageToken] = useState<string | undefined>();
  
  // React 18+: useDeferredValue for search query to reduce unnecessary API calls
  const deferredQuery = useDeferredValue(currentQuery);
  
  // Enhanced caching and request management with better memory management
  const cache = useRef<Map<string, { 
    data: HookYouTubeVideoInfo[]; 
    timestamp: number;
    accessCount: number; // For LRU cache management
  }>>(new Map());
  
  const abortController = useRef<AbortController | null>(null);
  const retryCount = useRef<number>(0);
  const maxRetries = 3;
  const cacheTimeout = 5 * 60 * 1000; // 5 minutes
  const maxCacheSize = 50; // Prevent memory bloat

  // Performance optimization: Memoized cache cleanup function
  const cleanupCache = useCallback(() => {
    const now = Date.now();
    const entries = Array.from(cache.current.entries());
    
    // Remove expired entries
    entries.forEach(([key, value]) => {
      if (now - value.timestamp > cacheTimeout) {
        cache.current.delete(key);
      }
    });
    
    // If still too large, remove least recently used
    if (cache.current.size > maxCacheSize) {
      const sortedEntries = entries
        .filter(([key]) => cache.current.has(key)) // Still exists after cleanup
        .sort((a, b) => a[1].accessCount - b[1].accessCount);
      
      const toRemove = sortedEntries.slice(0, cache.current.size - maxCacheSize);
      toRemove.forEach(([key]) => cache.current.delete(key));
    }
  }, [cacheTimeout, maxCacheSize]);

  // Performance optimization: Memoized error creation function
  const createError = useCallback((error: unknown, operation: string): VideoSearchError => {
    let code: VideoSearchError['code'] = 'UNKNOWN_ERROR';
    let retryable = false;
    let retryAfter: number | undefined;

    if (error instanceof QuotaExceededError) {
      code = 'QUOTA_EXCEEDED';
      retryable = false;
    } else if (error instanceof ValidationError) {
      code = 'INVALID_QUERY';
      retryable = false;
    } else if (error instanceof ServiceError) {
      code = 'SERVICE_UNAVAILABLE';
      retryable = true;
      retryAfter = Math.min(Math.pow(2, retryCount.current), 30); // Exponential backoff
    } else if (error instanceof Error && error.name === 'AbortError') {
      // Request was cancelled, don't treat as error
      throw error;
    } else if (error instanceof Error && (error.message.includes('network') || error.message.includes('fetch'))) {
      code = 'NETWORK_ERROR';
      retryable = true;
      retryAfter = 5;
    }

    const searchError = new Error(`${operation} failed: ${error instanceof Error ? error.message : 'Unknown error'}`) as VideoSearchError;
    searchError.code = code;
    searchError.retryable = retryable;
    searchError.retryAfter = retryAfter;
    
    return searchError;
  }, []);

  // Performance optimization: Memoized reset function with cleanup
  const reset = useCallback(() => {
    startTransition(() => {
      setData(null);
      setHasNextPage(false);
      setCurrentQuery('');
      setNextPageToken(undefined);
      retryCount.current = 0;
      setState({
        isLoading: false,
        error: null,
        isSuccess: false,
      });
    });
    
    if (abortController.current) {
      abortController.current.abort();
    }
  }, []);

  // React 18+: Enhanced search function with concurrent features
  const search = useCallback(async (query: string, retryAttempt = 0): Promise<void> => {
    if (!query.trim()) {
      reset();
      return;
    }

    // Cancel previous request
    if (abortController.current) {
      abortController.current.abort();
    }
    abortController.current = new AbortController();

    // Check cache first with access tracking
    const cacheKey = `search:${query}`;
    const cached = cache.current.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < cacheTimeout) {
      // Update access count for LRU
      cached.accessCount++;
      
      startTransition(() => {
        setData(cached.data);
        setCurrentQuery(query);
        setState({
          isLoading: false,
          error: null,
          isSuccess: true,
        });
      });
      return;
    }

    // React 18+: Use transition for state updates
    startTransition(() => {
      setState(prev => ({
        ...prev,
        isLoading: true,
        error: retryAttempt === 0 ? null : prev.error,
      }));
    });

    try {
      // Check service health before making request
      const isHealthy = await defaultYouTubeAPIService.isHealthy();
      if (!isHealthy) {
        throw new ServiceError('YouTube API service is not available', 'YouTubeAPIService', 'SERVICE_UNAVAILABLE');
      }

      const result = await defaultYouTubeAPIService.searchVideos({
        q: query,
        order: 'relevance',
        type: 'video'
      });
      
      // Check if request was aborted
      if (abortController.current?.signal.aborted) {
        return;
      }

      // Convert service types to hook types with memoization
      const convertedVideos = result.items.map(convertVideoInfo);
      
      // React 18+: Use transition for non-urgent updates
      startTransition(() => {
        setData(convertedVideos);
        setHasNextPage(result.pagination.hasNext);
        setNextPageToken(result.pagination.hasNext ? 'next' : undefined);
        setCurrentQuery(query);
        retryCount.current = 0;
        
        setState({
          isLoading: false,
          error: null,
          isSuccess: true,
        });
      });
      
      // Cache the results with timestamp and access tracking
      cache.current.set(cacheKey, { 
        data: convertedVideos, 
        timestamp: Date.now(),
        accessCount: 1
      });
      
      // Cleanup cache periodically
      cleanupCache();
      
    } catch (error) {
      if (abortController.current?.signal.aborted) {
        return;
      }

      try {
        const searchError = createError(error, 'Video search');
        
        // Retry logic for retryable errors
        if (searchError.retryable && retryAttempt < maxRetries) {
          retryCount.current = retryAttempt + 1;
          const retryDelay = searchError.retryAfter ? searchError.retryAfter * 1000 : 1000;
          
          setTimeout(() => {
            search(query, retryAttempt + 1);
          }, retryDelay);
          
          return;
        }

        // React 18+: Use transition for error state updates
        startTransition(() => {
          setState({
            isLoading: false,
            error: searchError,
            isSuccess: false,
          });
        });
      } catch (abortError) {
        // Request was aborted, don't update state
        return;
      }
    }
  }, [reset, createError, cleanupCache]);

  // Performance optimization: Memoized load more function
  const loadMore = useCallback(async (): Promise<void> => {
    if (!hasNextPage || !nextPageToken || !currentQuery) return;

    startTransition(() => {
      setState(prev => ({ ...prev, isLoading: true }));
    });

    try {
      // Implementation would depend on YouTube API pagination
      // For now, this is a placeholder that simulates pagination
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      startTransition(() => {
        setState(prev => ({ ...prev, isLoading: false }));
        setHasNextPage(false);
        setNextPageToken(undefined);
      });
    } catch (error) {
      const searchError = createError(error, 'Load more videos');
      startTransition(() => {
        setState({
          isLoading: false,
          error: searchError,
          isSuccess: false,
        });
      });
    }
  }, [hasNextPage, nextPageToken, currentQuery, createError]);

  // React 18+: Effect with deferred value to reduce API calls
  useEffect(() => {
    if (deferredQuery.trim()) {
      search(deferredQuery);
    }
  }, [deferredQuery, search]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortController.current) {
        abortController.current.abort();
      }
    };
  }, []);

  // Performance optimization: Memoized return value to prevent unnecessary re-renders
  return useMemo(() => ({
    ...state,
    data,
    hasNextPage,
    currentQuery,
    isPending, // React 18+: Expose pending state from useTransition
    search: useCallback(async (query: string): Promise<void> => {
      startTransition(() => {
        setCurrentQuery(query);
      });
      // Return immediately since the actual search is triggered by the deferred value effect
      return Promise.resolve();
    }, []),
    loadMore,
    reset,
  }), [
    state, 
    data, 
    hasNextPage, 
    currentQuery, 
    isPending, 
    loadMore, 
    reset
  ]);
}; 