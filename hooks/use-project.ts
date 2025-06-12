"use client"

import { useState, useCallback } from "react"
import { useAuth } from "@/contexts/auth-context"
import { toast } from "@/hooks/use-toast"
import type { Segment, QueueItem } from "@/types"

export function useProject() {
  const { session, user } = useAuth()
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null)
  const [projectName, setProjectName] = useState("")
  const [projectDescription, setProjectDescription] = useState("")
  const [projectVisibility, setProjectVisibility] = useState<"public" | "private" | "link_only">("public")
  const [projectOwnerId, setProjectOwnerId] = useState<string | null>(null)
  const [segments, setSegments] = useState<Segment[]>([])
  const [queue, setQueue] = useState<QueueItem[]>([])
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [isProjectCreated, setIsProjectCreated] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [lastSaveTime, setLastSaveTime] = useState<Date | null>(null)

  const createNewProject = useCallback(async () => {
    if (!session?.access_token) {
      setProjectName("이름 없는 프로젝트(1)")
      setHasUnsavedChanges(false)
      setIsProjectCreated(true)
      return null
    }

    try {
      const response = await fetch("/api/projects", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({}),
      })

      const data = await response.json()

      if (data.success) {
        setCurrentProjectId(data.projectId)
        setProjectName(data.project.title)
        setProjectDescription(data.project.description || "")
        setProjectVisibility(data.project.visibility)
        setProjectOwnerId(user?.id || null)
        setHasUnsavedChanges(false)
        setIsProjectCreated(true)
        setLastSaveTime(new Date())

        toast({
          title: "새 프로젝트 생성됨",
          description: `"${data.project.title}" 프로젝트가 생성되었습니다.`,
        })

        return data.projectId
      } else {
        throw new Error(data.error || data.details)
      }
    } catch (error) {
      console.error("프로젝트 생성 오류:", error)
      setProjectName("이름 없는 프로젝트(1)")
      setHasUnsavedChanges(false)
      setIsProjectCreated(true)
      return null
    }
  }, [session, user])

  const loadProject = useCallback(async (projectId: string) => {
    try {
      const response = await fetch(`/api/projects/${projectId}`)
      const data = await response.json()

      if (data.success) {
        const project = data.project

        setCurrentProjectId(projectId)
        setProjectName(project.title)
        setProjectDescription(project.description || "")
        setProjectVisibility(project.visibility || "public")
        setProjectOwnerId(project.owner_id)
        setSegments(project.segments || [])
        setQueue(project.queue || [])
        setHasUnsavedChanges(false)
        setIsProjectCreated(true)

        toast({
          title: "프로젝트 로드됨",
          description: `"${project.title}" 프로젝트가 로드되었습니다.`,
        })

        return project
      } else {
        throw new Error(data.error)
      }
    } catch (error) {
      console.error("프로젝트 로드 오류:", error)
      toast({
        title: "오류",
        description: "프로젝트를 로드하는 중 오류가 발생했습니다.",
        variant: "destructive",
      })
      return null
    }
  }, [])

  const saveProject = useCallback(
    async (isAutoSave = false) => {
      if (!session?.access_token) {
        if (!isAutoSave) {
          toast({
            title: "로그인 필요",
            description: "프로젝트를 저장하려면 로그인이 필요합니다.",
            variant: "destructive",
          })
        }
        return false
      }

      setIsSaving(true)
      try {
        const projectData = {
          title: projectName || "이름 없는 프로젝트",
          description: projectDescription,
          segments: segments.map((segment, index) => ({
            ...segment,
            orderIndex: index,
          })),
          queue: queue.map((item, index) => ({
            ...item,
            orderIndex: index,
          })),
        }

        const headers = {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        }

        let response
        if (currentProjectId) {
          response = await fetch("/api/projects", {
            method: "PUT",
            headers,
            body: JSON.stringify({ projectId: currentProjectId, ...projectData }),
          })
        } else {
          response = await fetch("/api/projects", {
            method: "POST",
            headers,
            body: JSON.stringify(projectData),
          })
        }

        const data = await response.json()

        if (data.success) {
          if (!currentProjectId) {
            setCurrentProjectId(data.projectId)
          }

          setHasUnsavedChanges(false)
          setLastSaveTime(new Date())

          if (!isAutoSave) {
            toast({
              title: "저장 완료",
              description: "프로젝트가 성공적으로 저장되었습니다.",
            })
          }

          return data.projectId || currentProjectId
        } else {
          throw new Error(data.error || data.details)
        }
      } catch (error) {
        console.error("저장 오류:", error)
        if (!isAutoSave) {
          toast({
            title: "저장 실패",
            description: error instanceof Error ? error.message : "프로젝트를 저장하는 중 오류가 발생했습니다.",
            variant: "destructive",
          })
        }
        return false
      } finally {
        setIsSaving(false)
      }
    },
    [session, currentProjectId, projectName, projectDescription, segments, queue],
  )

  const resetProject = useCallback(() => {
    setCurrentProjectId(null)
    setProjectName("")
    setProjectDescription("")
    setProjectVisibility("public")
    setProjectOwnerId(null)
    setSegments([])
    setQueue([])
    setHasUnsavedChanges(false)
    setIsProjectCreated(false)
    setLastSaveTime(null)
  }, [])

  const addSegment = useCallback((segment: Segment) => {
    setSegments((prev) => [...prev, { ...segment, orderIndex: prev.length }])
    setHasUnsavedChanges(true)
  }, [])

  const updateSegment = useCallback((segmentId: string, updates: Partial<Segment>) => {
    setSegments((prev) => prev.map((seg) => (seg.id === segmentId ? { ...seg, ...updates } : seg)))
    setQueue((prev) =>
      prev.map((item) =>
        item.type === "segment" && item.segment?.id === segmentId
          ? { ...item, segment: { ...item.segment, ...updates } }
          : item,
      ),
    )
    setHasUnsavedChanges(true)
  }, [])

  const removeSegment = useCallback((segmentId: string) => {
    setSegments((prev) => prev.filter((seg) => seg.id !== segmentId))
    setQueue((prev) => prev.filter((item) => item.segment?.id !== segmentId))
    setHasUnsavedChanges(true)
  }, [])

  const addToQueue = useCallback((item: QueueItem) => {
    setQueue((prev) => [...prev, { ...item, orderIndex: prev.length }])
    setHasUnsavedChanges(true)
  }, [])

  const removeFromQueue = useCallback((queueItemId: string) => {
    setQueue((prev) => prev.filter((item) => item.id !== queueItemId))
    setHasUnsavedChanges(true)
  }, [])

  const reorderSegments = useCallback((newSegments: Segment[]) => {
    setSegments(newSegments)
    setHasUnsavedChanges(true)
  }, [])

  const reorderQueue = useCallback((newQueue: QueueItem[]) => {
    setQueue(newQueue)
    setHasUnsavedChanges(true)
  }, [])

  return {
    // State
    currentProjectId,
    projectName,
    projectDescription,
    projectVisibility,
    projectOwnerId,
    segments,
    queue,
    hasUnsavedChanges,
    isProjectCreated,
    isSaving,
    lastSaveTime,

    // Setters
    setProjectName,
    setProjectDescription,
    setProjectVisibility,
    setHasUnsavedChanges,

    // Actions
    createNewProject,
    loadProject,
    saveProject,
    resetProject,
    addSegment,
    updateSegment,
    removeSegment,
    addToQueue,
    removeFromQueue,
    reorderSegments,
    reorderQueue,
  }
}
