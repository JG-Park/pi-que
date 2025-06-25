"use client"

import { useState, useRef, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { ChevronDown, ChevronUp, Plus, SkipBack, SkipForwardIcon as SkipToEnd } from "lucide-react"
import { toast } from "@/hooks/use-toast"
import { generateId } from "@/lib/utils"
import { timeToSeconds, validateTimeRange } from "@/utils/time"
import type { Segment } from "@/types"

interface SegmentFormProps {
  currentVideoId: string
  videoTitle: string
  videoDuration: number
  onAddSegment: (segment: Segment) => void
  onGetCurrentTime: () => number
  onSeekTo: (seconds: number) => void
  isExpanded: boolean
  onToggleExpanded: () => void
  selectedSegment?: Segment | null
  onClearSelection?: () => void
}

export function SegmentForm({
  currentVideoId,
  videoTitle,
  videoDuration,
  onAddSegment,
  onGetCurrentTime,
  onSeekTo,
  isExpanded,
  onToggleExpanded,
  selectedSegment,
  onClearSelection,
}: SegmentFormProps) {
  const [newSegment, setNewSegment] = useState({
    title: "",
    description: "",
    startTime: "0:00",
    endTime: "",
  })
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false)

  const titleInputRef = useRef<HTMLInputElement>(null)
  const lastVideoIdRef = useRef<string>("")
  const lastVideoTitleRef = useRef<string>("")
  const lastVideoDurationRef = useRef<number>(0)

  // 선택된 구간이 변경될 때 폼에 로드
  useEffect(() => {
    if (selectedSegment) {
      setNewSegment({
        title: selectedSegment.title,
        description: selectedSegment.description || "",
        startTime: `${Math.floor(selectedSegment.startTime / 60)}:${(selectedSegment.startTime % 60).toString().padStart(2, "0")}`,
        endTime: `${Math.floor(selectedSegment.endTime / 60)}:${(selectedSegment.endTime % 60).toString().padStart(2, "0")}`,
      })
    }
  }, [selectedSegment])

  // 영상이 변경될 때마다 폼 초기화 및 자동 입력
  useEffect(() => {
    // 선택된 구간이 있으면 영상 변경 시에도 초기화하지 않음
    if (selectedSegment) return

    // 비디오 ID가 변경되었거나, 제목이나 길이가 업데이트된 경우
    const videoChanged = currentVideoId && currentVideoId !== lastVideoIdRef.current
    const titleChanged = videoTitle && videoTitle !== lastVideoTitleRef.current
    const durationChanged = videoDuration > 0 && videoDuration !== lastVideoDurationRef.current

    if (videoChanged || titleChanged || durationChanged) {
      // 참조값 업데이트
      lastVideoIdRef.current = currentVideoId
      lastVideoTitleRef.current = videoTitle
      lastVideoDurationRef.current = videoDuration

      // 폼 업데이트
      setNewSegment({
        title: videoTitle || "",
        description: "",
        startTime: "0:00",
        endTime:
          videoDuration > 0
            ? `${Math.floor(videoDuration / 60)}:${(videoDuration % 60).toString().padStart(2, "0")}`
            : "",
      })
    }
  }, [currentVideoId, videoTitle, videoDuration, selectedSegment])

  const setCurrentTimeAsStart = () => {
    const currentTime = onGetCurrentTime()
    setNewSegment((prev) => ({
      ...prev,
      startTime: `${Math.floor(currentTime / 60)}:${(currentTime % 60).toString().padStart(2, "0")}`,
    }))
  }

  const setCurrentTimeAsEnd = () => {
    const currentTime = onGetCurrentTime()
    setNewSegment((prev) => ({
      ...prev,
      endTime: `${Math.floor(currentTime / 60)}:${(currentTime % 60).toString().padStart(2, "0")}`,
    }))
  }

  const seekToStart = () => {
    const startTime = timeToSeconds(newSegment.startTime)
    onSeekTo(startTime)
  }

  const seekToEnd = () => {
    const endTime = timeToSeconds(newSegment.endTime)
    onSeekTo(endTime)
  }

  const handleAddSegment = () => {
    if (!newSegment.title.trim()) {
      toast({
        title: "오류",
        description: "구간 제목을 입력해주세요.",
        variant: "destructive",
      })
      titleInputRef.current?.focus()
      return
    }

    if (!currentVideoId || !newSegment.startTime || !newSegment.endTime) {
      toast({
        title: "오류",
        description: "시작 시간과 종료 시간을 모두 입력해주세요.",
        variant: "destructive",
      })
      return
    }

    const validationError = validateTimeRange(newSegment.startTime, newSegment.endTime, videoDuration)
    if (validationError) {
      toast({
        title: "오류",
        description: validationError,
        variant: "destructive",
      })
      return
    }

    const startSeconds = timeToSeconds(newSegment.startTime)
    const endSeconds = timeToSeconds(newSegment.endTime)

    const segment: Segment = selectedSegment ? {
      ...selectedSegment,
      title: newSegment.title,
      description: newSegment.description,
      startTime: startSeconds,
      endTime: endSeconds,
    } : {
      id: generateId(),
      title: newSegment.title,
      description: newSegment.description,
      videoId: currentVideoId,
      videoTitle,
      startTime: startSeconds,
      endTime: endSeconds,
      orderIndex: 0,
    }

    onAddSegment(segment)

    // 선택된 구간이 있었다면 선택 해제
    if (selectedSegment && onClearSelection) {
      onClearSelection()
    }

    // 구간 추가/수정 후 초기화 (현재 영상 정보로)
    setNewSegment({
      title: videoTitle || "",
      description: "",
      startTime: "0:00",
      endTime: videoDuration
        ? `${Math.floor(videoDuration / 60)}:${(videoDuration % 60).toString().padStart(2, "0")}`
        : "",
    })

    onSeekTo(0)

    toast({
      title: "성공",
      description: selectedSegment ? "구간이 수정되었습니다." : "구간이 추가되었습니다.",
    })
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <div>
          <CardTitle>{selectedSegment ? "구간 편집" : "구간 추가"}</CardTitle>
          <CardDescription>
            {selectedSegment ? `"${selectedSegment.title}" 구간을 편집 중입니다` : "현재 영상에서 구간을 만드세요"}
          </CardDescription>
        </div>
        <div className="flex items-center gap-2">
          {selectedSegment && onClearSelection && (
            <Button variant="outline" size="sm" onClick={onClearSelection}>
              선택 해제
            </Button>
          )}
          <Button variant="ghost" size="icon" onClick={onToggleExpanded}>
            {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
          </Button>
        </div>
      </CardHeader>
      {isExpanded && (
        <CardContent className="space-y-4 pt-0">
          <div>
            <Label htmlFor="segment-title">구간 제목 *</Label>
            <Input
              ref={titleInputRef}
              id="segment-title"
              placeholder="구간 제목을 입력하세요"
              value={newSegment.title}
              onChange={(e) => setNewSegment((prev) => ({ ...prev, title: e.target.value }))}
            />
          </div>

          <div>
            <div className="flex items-center justify-between">
              <Label htmlFor="segment-description">구간 설명 (선택사항)</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setIsDescriptionExpanded(!isDescriptionExpanded)}
                className="h-auto p-1 text-gray-500 hover:text-gray-700"
              >
                {isDescriptionExpanded ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </Button>
            </div>
            {isDescriptionExpanded && (
              <Textarea
                id="segment-description"
                placeholder="구간에 대한 설명을 입력하세요"
                value={newSegment.description}
                onChange={(e) => setNewSegment((prev) => ({ ...prev, description: e.target.value }))}
                rows={3}
              />
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="start-time">시작 시간</Label>
              <div className="flex gap-1">
                <Input
                  id="start-time"
                  placeholder="0:00"
                  value={newSegment.startTime}
                  onChange={(e) => setNewSegment((prev) => ({ ...prev, startTime: e.target.value }))}
                  className="flex-1"
                />
                <Button size="sm" variant="outline" onClick={setCurrentTimeAsStart} title="현재 시간으로 설정">
                  현재
                </Button>
                <Button size="sm" variant="outline" onClick={seekToStart} title="시작점으로 이동">
                  <SkipBack className="w-4 h-4" />
                </Button>
              </div>
            </div>

            <div>
              <Label htmlFor="end-time">종료 시간</Label>
              <div className="flex gap-1">
                <Input
                  id="end-time"
                  placeholder="1:00"
                  value={newSegment.endTime}
                  onChange={(e) => setNewSegment((prev) => ({ ...prev, endTime: e.target.value }))}
                  className="flex-1"
                />
                <Button size="sm" variant="outline" onClick={setCurrentTimeAsEnd} title="현재 시간으로 설정">
                  현재
                </Button>
                <Button size="sm" variant="outline" onClick={seekToEnd} title="종료점으로 이동">
                  <SkipToEnd className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>

          <Button onClick={handleAddSegment} className="w-full" size="lg">
            <Plus className="w-4 h-4 mr-2" />
            {selectedSegment ? "구간 수정" : "구간 추가"}
          </Button>
        </CardContent>
      )}
    </Card>
  )
}
