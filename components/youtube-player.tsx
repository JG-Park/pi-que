"use client"

import type React from "react"
import { useEffect, useRef, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Clock, Target, Youtube, Maximize2, Minimize2, Loader2, FileText, ChevronDown, ChevronUp } from "lucide-react"
import { timeToSeconds } from "@/utils/time"

interface YouTubePlayerProps {
  videoUrl: string
  onVideoUrlChange: (url: string) => void
  onSearchClick: () => void
  onSeekBy: (seconds: number) => void
  onSeekTo: (seconds: number) => void
  isMaximized: boolean
  onToggleMaximize: () => void
  showControls: boolean
  isPlayerReady: boolean
  isInitializing: boolean
  onApplyVideo?: (url: string, description?: string) => void
}

interface VideoInfo {
  title: string
  description: string
  channelTitle: string
  publishedAt: string
  duration: string
}

export function YouTubePlayer({
  videoUrl,
  onVideoUrlChange,
  onSearchClick,
  onSeekBy,
  onSeekTo,
  isMaximized,
  onToggleMaximize,
  showControls,
  isPlayerReady,
  isInitializing,
  onApplyVideo,
}: YouTubePlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [urlInput, setUrlInput] = useState(videoUrl)
  const [videoInfo, setVideoInfo] = useState<VideoInfo | null>(null)
  const [isLoadingInfo, setIsLoadingInfo] = useState(false)
  const [showDescription, setShowDescription] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // videoUrl이 변경되면 urlInput도 업데이트
  useEffect(() => {
    setUrlInput(videoUrl)
  }, [videoUrl])

  const extractVideoId = (url: string): string | null => {
    const regExp = /^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#&?]*).*/
    const match = url.match(regExp)
    return (match && match[7]?.length === 11) ? match[7] : null
  }

  const fetchVideoInfo = async (url: string): Promise<VideoInfo | null> => {
    const videoId = extractVideoId(url)
    if (!videoId) return null

    try {
      const response = await fetch(`/api/youtube/video-info?videoId=${videoId}`)
      if (response.ok) {
        const data = await response.json()
        return data.info
      }
    } catch (error) {
      console.error('비디오 정보 가져오기 실패:', error)
    }
    return null
  }

  const handleApplyVideo = async () => {
    if (!urlInput.trim()) return

    setIsLoadingInfo(true)
    setError(null)

    try {
      // 비디오 정보 가져오기
      const info = await fetchVideoInfo(urlInput)
      setVideoInfo(info)

      // 부모 컴포넌트에 적용 알림
      onVideoUrlChange(urlInput)
      onApplyVideo?.(urlInput, info?.description)
    } catch (err) {
      setError('비디오 정보를 가져오는데 실패했습니다.')
      console.error('비디오 적용 오류:', err)
    } finally {
      setIsLoadingInfo(false)
    }
  }

  const handleSeekToTime = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      const timeStr = (e.target as HTMLInputElement).value
      const seconds = timeToSeconds(timeStr)
      onSeekTo(seconds)
      ;(e.target as HTMLInputElement).value = ""
    }
  }

  // 컨테이너가 DOM에 마운트되었는지 확인
  useEffect(() => {
    if (containerRef.current) {
      console.log("YouTube 플레이어 컨테이너 마운트됨")
    }
  }, [])

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>YouTube 영상 플레이어</CardTitle>
          <CardDescription>
            YouTube URL을 입력하거나 검색하여 영상을 로드하세요
            {isInitializing && <span className="ml-2 text-amber-600">• 로딩 중...</span>}
            {isPlayerReady && <span className="ml-2 text-green-600">• 준비됨</span>}
          </CardDescription>
        </div>
        <Button variant="ghost" size="icon" onClick={onToggleMaximize} className="ml-2">
          {isMaximized ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
        </Button>
      </CardHeader>
      <CardContent className="space-y-6">
        {showControls && (
          <div className="space-y-4">
            <div className="flex gap-3">
              <Input
                placeholder="https://www.youtube.com/watch?v=..."
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                className="flex-1"
                onKeyDown={(e) => e.key === 'Enter' && handleApplyVideo()}
              />
              <Button 
                onClick={handleApplyVideo} 
                disabled={!urlInput.trim() || isLoadingInfo}
                className="min-w-[80px]"
              >
                {isLoadingInfo ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  '적용'
                )}
              </Button>
              <Button onClick={onSearchClick} variant="outline">
                <Youtube className="w-4 h-4 mr-2" />
                YouTube에서 찾기
              </Button>
            </div>

            {error && (
              <div className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">
                {error}
              </div>
            )}

            {/* 비디오 정보 표시 */}
            {videoInfo && (
              <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    <span className="font-medium text-sm">비디오 정보</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowDescription(!showDescription)}
                    className="h-6 px-2"
                  >
                    {showDescription ? (
                      <ChevronUp className="w-4 h-4" />
                    ) : (
                      <ChevronDown className="w-4 h-4" />
                    )}
                  </Button>
                </div>
                
                <div>
                  <h4 className="font-medium text-sm mb-1">{videoInfo.title}</h4>
                  <p className="text-xs text-muted-foreground">
                    {videoInfo.channelTitle} • {new Date(videoInfo.publishedAt).toLocaleDateString('ko-KR')}
                  </p>
                </div>

                {showDescription && videoInfo.description && (
                  <div className="border-t pt-3">
                    <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap max-h-32 overflow-y-auto">
                      {videoInfo.description}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <div className="relative">
          <div ref={containerRef} id="youtube-player" className="w-full aspect-video bg-muted rounded-lg" />
          {isInitializing && (
            <div className="absolute inset-0 flex items-center justify-center bg-muted/80 rounded-lg">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>플레이어 로딩 중...</span>
              </div>
            </div>
          )}
        </div>

        {showControls && isPlayerReady && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4" />
              <span className="text-sm font-medium">정밀 시간 이동</span>
            </div>

            <div className="flex items-center justify-between gap-2">
              <div className="flex gap-1">
                <Button size="sm" variant="outline" onClick={() => onSeekBy(-10)} className="text-xs">
                  -10초
                </Button>
                <Button size="sm" variant="outline" onClick={() => onSeekBy(-5)} className="text-xs">
                  -5초
                </Button>
                <Button size="sm" variant="outline" onClick={() => onSeekBy(-1)} className="text-xs">
                  -1초
                </Button>
                <Button size="sm" variant="outline" onClick={() => onSeekBy(-0.1)} className="text-xs">
                  -0.1초
                </Button>
              </div>
              <div className="flex gap-1">
                <Button size="sm" variant="outline" onClick={() => onSeekBy(0.1)} className="text-xs">
                  +0.1초
                </Button>
                <Button size="sm" variant="outline" onClick={() => onSeekBy(1)} className="text-xs">
                  +1초
                </Button>
                <Button size="sm" variant="outline" onClick={() => onSeekBy(5)} className="text-xs">
                  +5초
                </Button>
                <Button size="sm" variant="outline" onClick={() => onSeekBy(10)} className="text-xs">
                  +10초
                </Button>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
              <Target className="w-4 h-4 text-muted-foreground" />
              <Label htmlFor="seek-time" className="text-sm font-medium">
                특정 시간으로 이동:
              </Label>
              <Input id="seek-time" placeholder="mm:ss" className="w-24" onKeyDown={handleSeekToTime} />
              <span className="text-xs text-muted-foreground">Enter</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
