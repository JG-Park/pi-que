import React from 'react'
import { Play, Clock, Eye, Calendar } from 'lucide-react'
import { YouTubeVideoInfo } from '../../../../types/youtube'
import { Button } from '../../../../components/ui/button'
import { Card, CardContent } from '../../../../components/ui/card'
import { Badge } from '../../../../components/ui/badge'

interface SearchItemProps {
  video: YouTubeVideoInfo
  onSelect: (video: YouTubeVideoInfo) => void
  isSelected?: boolean
  className?: string
}

const SearchItem: React.FC<SearchItemProps> = ({
  video,
  onSelect,
  isSelected = false,
  className = ''
}) => {
  const handleClick = () => {
    onSelect(video)
  }

  const formatViewCount = (count?: string) => {
    if (!count) return 'N/A'
    const num = parseInt(count)
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(1)}M views`
    } else if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}K views`
    }
    return `${num} views`
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  const truncateText = (text: string, maxLength: number) => {
    if (text.length <= maxLength) return text
    return text.slice(0, maxLength) + '...'
  }

  return (
    <Card 
      className={`
        group cursor-pointer transition-all duration-200 hover:shadow-md
        ${isSelected ? 'ring-2 ring-primary bg-primary/5' : 'hover:bg-accent/50'}
        ${className}
      `}
      onClick={handleClick}
    >
      <CardContent className="p-3">
        <div className="flex gap-3">
          {/* Thumbnail */}
          <div className="relative flex-shrink-0">
            <div className="relative w-40 h-24 rounded-md overflow-hidden bg-muted">
              <img
                src={video.thumbnail}
                alt={video.title}
                className="w-full h-full object-cover"
                loading="lazy"
              />
              
              {/* Play overlay */}
              <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center">
                <Play className="h-8 w-8 text-white fill-white" />
              </div>
              
              {/* Duration badge */}
              {video.duration && (
                <Badge 
                  variant="secondary" 
                  className="absolute bottom-1 right-1 text-xs bg-black/70 text-white border-none"
                >
                  {video.duration}
                </Badge>
              )}
            </div>
          </div>

          {/* Video info */}
          <div className="flex-1 min-w-0 space-y-2">
            {/* Title */}
            <h3 className="font-medium text-sm leading-tight line-clamp-2">
              {truncateText(video.title, 80)}
            </h3>
            
            {/* Channel */}
            <p className="text-xs text-muted-foreground">
              {video.channelTitle}
            </p>
            
            {/* Description */}
            {video.description && (
              <p className="text-xs text-muted-foreground line-clamp-2">
                {truncateText(video.description, 120)}
              </p>
            )}
            
            {/* Metadata */}
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              {video.viewCount && (
                <div className="flex items-center gap-1">
                  <Eye className="h-3 w-3" />
                  <span>{formatViewCount(video.viewCount)}</span>
                </div>
              )}
              
              <div className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                <span>{formatDate(video.publishedAt)}</span>
              </div>
            </div>
          </div>

          {/* Action button */}
          <div className="flex-shrink-0 self-start">
            <Button
              size="sm"
              variant={isSelected ? "default" : "outline"}
              className="h-8 px-3"
              onClick={(e) => {
                e.stopPropagation()
                handleClick()
              }}
            >
              {isSelected ? 'Selected' : 'Select'}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export default SearchItem 