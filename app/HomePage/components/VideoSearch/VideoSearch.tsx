import React, { useState, useCallback, useMemo } from 'react'
import { useQuery, useInfiniteQuery } from '@tanstack/react-query'
import { useDebounce } from 'use-debounce'
import { YouTubeVideoInfo } from '../../../../types/youtube'
import SearchInput from './SearchInput'
import SearchResults from './SearchResults'
import { Card, CardContent, CardHeader, CardTitle } from '../../../../components/ui/card'
import { Separator } from '../../../../components/ui/separator'

interface VideoSearchProps {
  onVideoSelect?: (video: YouTubeVideoInfo) => void
  onVideoApply?: (url: string, description?: string) => void
  selectedVideoId?: string
  className?: string
}

interface SearchResponse {
  success: boolean
  data: {
    items: YouTubeVideoInfo[]
    totalResults: number
    nextPageToken?: string
    prevPageToken?: string
  }
  error?: string
}

// YouTube 검색 API 호출 함수
const searchYouTubeVideos = async (query: string, pageToken?: string): Promise<SearchResponse> => {
  const params = new URLSearchParams({
    q: query,
    ...(pageToken && { pageToken })
  })

  const response = await fetch(`/api/youtube/search?${params}`)
  
  if (!response.ok) {
    throw new Error(`Search failed: ${response.status}`)
  }

  return response.json()
}

const VideoSearch: React.FC<VideoSearchProps> = ({
  onVideoSelect,
  onVideoApply,
  selectedVideoId,
  className = ''
}) => {
  const [searchTerm, setSearchTerm] = useState('')
  const [debouncedSearchTerm] = useDebounce(searchTerm, 500)

  // 무한 스크롤을 위한 useInfiniteQuery
  const {
    data,
    error,
    fetchNextPage,
    hasNextPage,
    isFetching,
    isFetchingNextPage,
    isLoading,
    isError,
  } = useInfiniteQuery<SearchResponse, Error>({
    queryKey: ['youtube-search', debouncedSearchTerm],
    queryFn: ({ pageParam }) => searchYouTubeVideos(debouncedSearchTerm, pageParam as string | undefined),
    enabled: !!debouncedSearchTerm.trim(),
    initialPageParam: undefined,
    getNextPageParam: (lastPage) => lastPage.data.nextPageToken || undefined,
    staleTime: 5 * 60 * 1000, // 5분
    gcTime: 10 * 60 * 1000, // 10분
  })

  // 모든 페이지의 비디오들을 평면화
  const videos = useMemo(() => {
    if (!data?.pages) return []
    return data.pages.flatMap(page => page.data.items || [])
  }, [data])

  // 검색어 변경 핸들러
  const handleSearchChange = useCallback((value: string) => {
    setSearchTerm(value)
  }, [])

  // 검색 제출 핸들러
  const handleSearchSubmit = useCallback((query: string) => {
    setSearchTerm(query)
  }, [])

  // 비디오 선택 핸들러 - URL 적용 효과로 처리
  const handleVideoSelect = useCallback((video: YouTubeVideoInfo) => {
    const videoUrl = `https://www.youtube.com/watch?v=${video.id}`
    
    // 기존 선택 콜백 호출
    onVideoSelect?.(video)
    
    // URL 적용 효과로 처리 (비디오 설명 포함)
    onVideoApply?.(videoUrl, video.description)
  }, [onVideoSelect, onVideoApply])

  // 더 많은 결과 로드 핸들러
  const handleLoadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage()
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage])

  // 에러 메시지 생성
  const errorMessage = useMemo(() => {
    if (!isError || !error) return null
    
    if (error instanceof Error) {
      return error.message
    }
    
    return 'An unexpected error occurred while searching for videos.'
  }, [isError, error])

  return (
    <Card className={`w-full ${className}`}>
      <CardHeader className="pb-4">
        <CardTitle className="text-xl font-semibold">Video Search</CardTitle>
        <p className="text-sm text-muted-foreground">
          Search for YouTube videos to add to your project
        </p>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Search Input */}
        <SearchInput
          value={searchTerm}
          onChange={handleSearchChange}
          onSubmit={handleSearchSubmit}
          isLoading={isLoading || isFetching}
          placeholder="Search for videos..."
        />
        
        <Separator />
        
        {/* Search Results */}
        <SearchResults
          videos={videos}
          onVideoSelect={handleVideoSelect}
          selectedVideoId={selectedVideoId}
          isLoading={isLoading}
          isLoadingMore={isFetchingNextPage}
          hasNextPage={hasNextPage}
          onLoadMore={handleLoadMore}
          error={errorMessage}
        />
        
        {/* Search Stats */}
        {debouncedSearchTerm && !isLoading && !isError && (
          <div className="pt-2 border-t">
            <p className="text-xs text-muted-foreground text-center">
              Showing {videos.length} results for "{debouncedSearchTerm}"
              {hasNextPage && " • Scroll down for more"}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default VideoSearch 