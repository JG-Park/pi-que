"use client"

import type React from "react"
import { useEffect, useRef } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Clock, Target, Youtube, Maximize2, Minimize2, Loader2 } from "lucide-react"
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
}: YouTubePlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null)

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
          <div className="flex gap-3">
            <Input
              placeholder="https://www.youtube.com/watch?v=..."
              value={videoUrl}
              onChange={(e) => onVideoUrlChange(e.target.value)}
              className="flex-1"
            />
            <Button onClick={onSearchClick} variant="outline">
              <Youtube className="w-4 h-4 mr-2" />
              YouTube에서 찾기
            </Button>
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
