"use client"

import type React from "react"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { PlayCircle, Edit, Plus, Trash2, PlusCircle, ListPlus, GripVertical, MessageSquare } from "lucide-react"
import { secondsToTime } from "@/utils/time"
import { reorderArray } from "@/lib/drag-utils"
import type { Segment } from "@/types"

interface SegmentsTabProps {
  segments: Segment[]
  onPlaySegment: (segment: Segment) => void
  onEditSegment: (segment: Segment) => void
  onSelectSegment?: (segment: Segment) => void
  onAddToQueue: (segment: Segment) => void
  onRemoveSegment: (segmentId: string) => void
  onReorderSegments: (segments: Segment[]) => void
  onAddSelectedToQueue: (segments: Segment[]) => void
  isMaximized: boolean
}

export function SegmentsTab({
  segments,
  onPlaySegment,
  onEditSegment,
  onSelectSegment,
  onAddToQueue,
  onRemoveSegment,
  onReorderSegments,
  onAddSelectedToQueue,
  isMaximized,
}: SegmentsTabProps) {
  const [selectedSegments, setSelectedSegments] = useState<Set<string>>(new Set())
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false)
  const [draggedItem, setDraggedItem] = useState<{ id: string; index: number } | null>(null)

  const toggleSegmentSelection = (segmentId: string) => {
    const newSelected = new Set(selectedSegments)
    if (newSelected.has(segmentId)) {
      newSelected.delete(segmentId)
    } else {
      newSelected.add(segmentId)
    }
    setSelectedSegments(newSelected)
  }

  const toggleAllSegments = () => {
    if (selectedSegments.size === segments.length) {
      setSelectedSegments(new Set())
    } else {
      setSelectedSegments(new Set(segments.map((s) => s.id)))
    }
  }

  const handleAddSelectedToQueue = () => {
    const selectedSegmentObjects = segments.filter((segment) => selectedSegments.has(segment.id))
    onAddSelectedToQueue(selectedSegmentObjects)
    setSelectedSegments(new Set())
    setIsMultiSelectMode(false)
  }

  const handleDragStart = (e: React.DragEvent, id: string, index: number) => {
    setDraggedItem({ id, index })
    e.dataTransfer.effectAllowed = "move"
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = "move"
  }

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault()
    if (!draggedItem) return

    const reorderedSegments = reorderArray(segments, draggedItem.index, dropIndex)
    onReorderSegments(reorderedSegments)
    setDraggedItem(null)
  }

  return (
    <Card className={isMaximized ? "h-[calc(100vh-200px)]" : "h-[800px]"}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>생성된 구간</CardTitle>
            <CardDescription>총 {segments.length}개의 구간</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {isMultiSelectMode && (
              <>
                <Button size="sm" variant="outline" onClick={toggleAllSegments}>
                  {selectedSegments.size === segments.length ? "전체 해제" : "전체 선택"}
                </Button>
                <Button size="sm" onClick={handleAddSelectedToQueue} disabled={selectedSegments.size === 0}>
                  <ListPlus className="w-4 h-4 mr-2" />
                  선택된 구간 추가 ({selectedSegments.size})
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setIsMultiSelectMode(false)
                    setSelectedSegments(new Set())
                  }}
                >
                  취소
                </Button>
              </>
            )}
            {!isMultiSelectMode && segments.length > 0 && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setSelectedSegments(new Set())
                  setIsMultiSelectMode(true)
                }}
              >
                <PlusCircle className="w-4 h-4 mr-2" />
                다중 선택
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className={`space-y-3 overflow-y-auto ${isMaximized ? "max-h-[calc(100vh-300px)]" : "max-h-[700px]"}`}>
          {segments.map((segment, index) => (
            <div
              key={segment.id}
              draggable={!isMultiSelectMode}
              onDragStart={(e) => handleDragStart(e, segment.id, index)}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, index)}
              className={`border rounded-lg p-4 space-y-3 transition-colors ${
                isMultiSelectMode
                  ? selectedSegments.has(segment.id)
                    ? "bg-primary/10 border-primary"
                    : "hover:bg-muted/50 cursor-pointer"
                  : "hover:bg-muted/50 cursor-move"
              }`}
              onClick={() => isMultiSelectMode && toggleSegmentSelection(segment.id)}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  {!isMultiSelectMode && (
                    <div className="mt-1 cursor-move">
                      <GripVertical className="w-4 h-4 text-muted-foreground" />
                    </div>
                  )}
                  {isMultiSelectMode && (
                    <div className="mt-1">
                      <input
                        type="checkbox"
                        checked={selectedSegments.has(segment.id)}
                        onChange={() => toggleSegmentSelection(segment.id)}
                        className="w-4 h-4"
                      />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{segment.title}</div>
                    <div className="text-sm text-muted-foreground">
                      {secondsToTime(segment.startTime)} - {secondsToTime(segment.endTime)}
                      <span className="ml-2 text-xs">({secondsToTime(segment.endTime - segment.startTime)})</span>
                    </div>
                    {segment.description && (
                      <div className="text-sm text-muted-foreground mt-1 italic line-clamp-2">
                        {segment.description}
                      </div>
                    )}
                  </div>
                </div>
                {!isMultiSelectMode && (
                  <div className="flex gap-1 ml-2">
                    <Button size="sm" variant="outline" onClick={() => onPlaySegment(segment)} title="재생">
                      <PlayCircle className="w-4 h-4" />
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => onEditSegment(segment)} title="편집">
                      <Edit className="w-4 h-4" />
                    </Button>
                    {onSelectSegment && (
                      <Button size="sm" variant="outline" onClick={() => onSelectSegment(segment)} title="편집 탭에 로드">
                        <Edit className="w-4 h-4" />
                        로드
                      </Button>
                    )}
                    <Button size="sm" onClick={() => onAddToQueue(segment)} title="큐에 추가">
                      <Plus className="w-4 h-4" />
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => onRemoveSegment(segment.id)} title="삭제">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                )}
              </div>
            </div>
          ))}
          {segments.length === 0 && (
            <div className="text-center text-muted-foreground py-12">
              <MessageSquare className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>아직 생성된 구간이 없습니다</p>
              <p className="text-sm">영상을 로드하고 구간을 추가해보세요</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
