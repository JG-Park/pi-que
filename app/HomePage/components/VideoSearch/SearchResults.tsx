import React, { useCallback, useMemo } from 'react'
import { FixedSizeList as List } from 'react-window'
import { useInView } from 'react-intersection-observer'
import { YouTubeVideoInfo } from '../../../../types/youtube'
import SearchItem from './SearchItem'
import { Loader2, AlertCircle, Search } from 'lucide-react'
import { Alert, AlertDescription } from '../../../../components/ui/alert'
import { Button } from '../../../../components/ui/button'

interface SearchResultsProps {
  videos: YouTubeVideoInfo[]
  onVideoSelect: (video: YouTubeVideoInfo) => void
  selectedVideoId?: string
  isLoading?: boolean
  isLoadingMore?: boolean
  hasNextPage?: boolean
  onLoadMore?: () => void
  error?: string | null
  className?: string
}

const ITEM_HEIGHT = 120 // Height of each search item in pixels
const CONTAINER_HEIGHT = 600 // Maximum height of the results container

const SearchResults: React.FC<SearchResultsProps> = ({
  videos,
  onVideoSelect,
  selectedVideoId,
  isLoading = false,
  isLoadingMore = false,
  hasNextPage = false,
  onLoadMore,
  error,
  className = ''
}) => {
  // Intersection observer for infinite scrolling
  const { ref: loadMoreRef, inView } = useInView({
    threshold: 0,
    triggerOnce: false,
  })

  // Trigger load more when the sentinel comes into view
  React.useEffect(() => {
    if (inView && hasNextPage && !isLoadingMore && onLoadMore) {
      onLoadMore()
    }
  }, [inView, hasNextPage, isLoadingMore, onLoadMore])

  // Memoized item renderer for react-window
  const ItemRenderer = useCallback(({ index, style }: { index: number; style: React.CSSProperties }) => {
    const video = videos[index]
    const isSelected = selectedVideoId === video.id
    const isLastItem = index === videos.length - 1

    return (
      <div style={style}>
        <div className="px-1 pb-2">
          <SearchItem
            video={video}
            onSelect={onVideoSelect}
            isSelected={isSelected}
          />
        </div>
        
        {/* Load more sentinel for the last item */}
        {isLastItem && hasNextPage && onLoadMore && (
          <div ref={loadMoreRef} className="h-4" />
        )}
      </div>
    )
  }, [videos, selectedVideoId, onVideoSelect, hasNextPage, onLoadMore, loadMoreRef])

  // Calculate the height for the virtualized list
  const listHeight = useMemo(() => {
    const itemCount = videos.length
    const calculatedHeight = itemCount * ITEM_HEIGHT
    return Math.min(calculatedHeight, CONTAINER_HEIGHT)
  }, [videos.length])

  // Loading state
  if (isLoading && videos.length === 0) {
    return (
      <div className={`flex flex-col items-center justify-center p-8 space-y-4 ${className}`}>
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Searching for videos...</p>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className={`p-4 ${className}`}>
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {error}
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  // Empty state
  if (!isLoading && videos.length === 0) {
    return (
      <div className={`flex flex-col items-center justify-center p-8 space-y-4 text-center ${className}`}>
        <Search className="h-12 w-12 text-muted-foreground" />
        <div className="space-y-2">
          <h3 className="text-lg font-medium">No videos found</h3>
          <p className="text-sm text-muted-foreground max-w-md">
            Try adjusting your search terms or check your spelling.
          </p>
        </div>
      </div>
    )
  }

  // Results with virtualized list
  return (
    <div className={`space-y-4 ${className}`}>
      {/* Results header */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {videos.length} video{videos.length !== 1 ? 's' : ''} found
          {hasNextPage && ' (loading more...)'}
        </p>
      </div>

      {/* Virtualized list */}
      <div className="border rounded-lg overflow-hidden">
        {videos.length > 0 && (
          <List
            height={listHeight}
            itemCount={videos.length}
            itemSize={ITEM_HEIGHT}
            overscanCount={5}
            className="scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100"
          >
            {ItemRenderer}
          </List>
        )}
      </div>

      {/* Load more indicator */}
      {isLoadingMore && (
        <div className="flex items-center justify-center p-4">
          <Loader2 className="h-6 w-6 animate-spin text-primary mr-2" />
          <span className="text-sm text-muted-foreground">Loading more videos...</span>
        </div>
      )}

      {/* End of results indicator */}
      {!hasNextPage && videos.length > 10 && (
        <div className="text-center p-4">
          <p className="text-sm text-muted-foreground">
            You've reached the end of the results
          </p>
        </div>
      )}
    </div>
  )
}

export default SearchResults 