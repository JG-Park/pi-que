"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import {
  Play,
  SkipForward,
  Trash2,
  Plus,
  Share2,
  MessageSquare,
  SkipBack,
  SkipForwardIcon as SkipToEnd,
  Edit,
  Save,
  X,
  Clock,
  Target,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Maximize2,
  Minimize2,
  Search,
  Loader2,
  PlayCircle,
  PlusCircle,
  ListPlus,
  CheckCircle,
  Youtube,
  Calendar,
  User,
  Eye,
  ArrowUp,
  Moon,
  Sun,
  Globe,
  Lock,
  Link,
  Database,
} from "lucide-react"
import { toast } from "@/hooks/use-toast"
import { useRouter, useSearchParams } from "next/navigation"
import { UserProfile } from "@/components/user-profile"
import { useAuth } from "@/contexts/auth-context"
import { useTheme } from "next-themes"
import { extractVideoId, isValidYouTubeUrl, debounce, formatDate, generateId } from "@/lib/utils"

interface Segment {
  id: string
  title: string
  description: string
  videoId: string
  videoTitle?: string
  startTime: number
  endTime: number
  orderIndex: number
}

interface QueueItem {
  id: string
  type: "segment" | "description"
  segment?: Segment
  description?: string
  orderIndex: number
}

interface YouTubeVideo {
  id: string
  title: string
  thumbnail: string
  duration: string
  channelTitle: string
  publishedAt: string
  description?: string
  viewCount?: string
}

declare global {
  interface Window {
    YT: any
    onYouTubeIframeAPIReady: () => void
  }
}

export default function YouTubeSegmentPlayer() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { session } = useAuth()
  const { theme, setTheme } = useTheme()

  const [videoUrl, setVideoUrl] = useState("")
  const [currentVideoId, setCurrentVideoId] = useState("")
  const [videoDuration, setVideoDuration] = useState(0)
  const [videoTitle, setVideoTitle] = useState("")
  const [segments, setSegments] = useState<Segment[]>([])
  const [queue, setQueue] = useState<QueueItem[]>([])
  const [currentQueueIndex, setCurrentQueueIndex] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [newSegment, setNewSegment] = useState({
    title: "",
    description: "",
    startTime: "0:00",
    endTime: "",
  })
  const [newDescription, setNewDescription] = useState("")
  const [isYouTubeAPIReady, setIsYouTubeAPIReady] = useState(false)
  const [editingSegment, setEditingSegment] = useState<Segment | null>(null)
  const [editForm, setEditForm] = useState({
    title: "",
    description: "",
    startTime: "",
    endTime: "",
  })
  const [activeTab, setActiveTab] = useState("segments")

  // 프로젝트 관련 상태
  const [projectName, setProjectName] = useState("")
  const [projectDescription, setProjectDescription] = useState("")
  const [isEditingProjectName, setIsEditingProjectName] = useState(false)
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null)
  const [projectVisibility, setProjectVisibility] = useState<"public" | "private" | "link_only">("public")
  const [isSaving, setIsSaving] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)

  // 접기/펼치기 상태
  const [isSegmentFormExpanded, setIsSegmentFormExpanded] = useState(true)
  const [isDescriptionFormExpanded, setIsDescriptionFormExpanded] = useState(false)

  // 플레이어 최대화 상태
  const [isPlayerMaximized, setIsPlayerMaximized] = useState(false)

  // YouTube 검색 관련 상태
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<YouTubeVideo[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [showSearchDialog, setShowSearchDialog] = useState(false)
  const [searchPage, setSearchPage] = useState(1)
  const [hasMoreResults, setHasMoreResults] = useState(true)
  const [searchSuggestions, setSearchSuggestions] = useState<string[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)

  // 영상 로드 확인 모달
  const [showVideoLoadConfirm, setShowVideoLoadConfirm] = useState(false)
  const [pendingVideo, setPendingVideo] = useState<YouTubeVideo | null>(null)

  // 재생큐 추가 관련
  const [selectedSegments, setSelectedSegments] = useState<Set<string>>(new Set())
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false)

  const [showScrollTop, setShowScrollTop] = useState(false)

  const playerRef = useRef<any>(null)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const titleInputRef = useRef<HTMLInputElement>(null)
  const searchResultsRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  // 변경사항 감지
  useEffect(() => {
    setHasUnsavedChanges(true)
  }, [segments, queue, projectName, projectDescription])

  // 스크롤 감지
  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 300)
    }

    window.addEventListener("scroll", handleScroll)
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  // URL에서 프로젝트 ID 확인 및 로드
  useEffect(() => {
    const projectId = searchParams.get("id")
    if (projectId) {
      loadProject(projectId)
    } else {
      // 새 프로젝트 자동 생성
      createNewProject()
    }
  }, [searchParams])

  // URL 자동 로드 (디바운스 적용)
  const debouncedLoadVideo = useCallback(
    debounce((url: string) => {
      if (isValidYouTubeUrl(url)) {
        loadVideoFromUrl(url)
      }
    }, 1000),
    [isYouTubeAPIReady],
  )

  // URL 변경 감지 및 자동 로드
  useEffect(() => {
    if (videoUrl && isYouTubeAPIReady) {
      debouncedLoadVideo(videoUrl)
    }
  }, [videoUrl, debouncedLoadVideo])

  // 검색 제안 가져오기
  const debouncedGetSuggestions = useCallback(
    debounce(async (query: string) => {
      if (query.length < 2) {
        setSearchSuggestions([])
        return
      }

      try {
        const response = await fetch(`/api/youtube/suggestions?q=${encodeURIComponent(query)}`)
        const data = await response.json()
        if (data.success) {
          setSearchSuggestions(data.suggestions)
        }
      } catch (error) {
        console.error("제안 검색 오류:", error)
      }
    }, 300),
    [],
  )

  // 검색어 변경 시 제안 가져오기
  useEffect(() => {
    if (showSearchDialog && searchQuery) {
      debouncedGetSuggestions(searchQuery)
    }
  }, [searchQuery, showSearchDialog, debouncedGetSuggestions])

  // 새 프로젝트 생성
  const createNewProject = async () => {
    if (!session?.access_token) {
      // 로그인하지 않은 경우 기본 프로젝트 이름만 설정
      setProjectName("이름 없는 프로젝트(1)")
      setHasUnsavedChanges(false)
      return
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
        setHasUnsavedChanges(false)
        // URL 업데이트
        router.push(`?id=${data.projectId}`, { scroll: false })

        toast({
          title: "새 프로젝트 생성됨",
          description: `"${data.project.title}" 프로젝트가 생성되었습니다.`,
        })
      } else {
        throw new Error(data.error || data.details)
      }
    } catch (error) {
      console.error("프로젝트 생성 오류:", error)
      // 오류 시 기본 이름 설정
      setProjectName("이름 없는 프로젝트(1)")
      setHasUnsavedChanges(false)
    }
  }

  // 프로젝트 로드
  const loadProject = async (projectId: string) => {
    setIsLoading(true)
    try {
      const response = await fetch(`/api/projects/${projectId}`)
      const data = await response.json()

      if (data.success) {
        const project = data.project
        setCurrentProjectId(projectId)
        setProjectName(project.title)
        setProjectDescription(project.description || "")
        setProjectVisibility(project.visibility || "public")
        setSegments(project.segments || [])
        setQueue(project.queue || [])
        setHasUnsavedChanges(false)

        // 첫 번째 구간의 비디오 정보로 플레이어 설정
        if (project.segments && project.segments.length > 0) {
          const firstSegment = project.segments[0]
          setVideoUrl(`https://www.youtube.com/watch?v=${firstSegment.videoId}`)
          setCurrentVideoId(firstSegment.videoId)
          setVideoTitle(firstSegment.videoTitle || "")
        }

        // 큐에 데이터가 있으면 큐 탭을 활성화
        if (project.queue && project.queue.length > 0) {
          setActiveTab("queue")
        }

        toast({
          title: "프로젝트 로드됨",
          description: `"${project.title}" 프로젝트가 로드되었습니다.`,
        })
      } else {
        toast({
          title: "오류",
          description: "프로젝트를 찾을 수 없습니다.",
          variant: "destructive",
        })
      }
    } catch (error) {
      toast({
        title: "오류",
        description: "프로젝트를 로드하는 중 오류가 발생했습니다.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  // 프로젝트 저장 (일괄 저장)
  const saveProject = async () => {
    if (!session?.access_token) {
      toast({
        title: "로그인 필요",
        description: "프로젝트를 저장하려면 로그인이 필요합니다.",
        variant: "destructive",
      })
      return
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

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      }

      let response
      if (currentProjectId) {
        // 기존 프로젝트 업데이트
        response = await fetch("/api/projects", {
          method: "PUT",
          headers,
          body: JSON.stringify({ projectId: currentProjectId, ...projectData }),
        })
      } else {
        // 새 프로젝트 생성
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
          // URL 업데이트
          router.push(`?id=${data.projectId}`, { scroll: false })
        }

        setHasUnsavedChanges(false)
        toast({
          title: "저장 완료",
          description: "프로젝트가 성공적으로 저장되었습니다.",
        })
      } else {
        throw new Error(data.error || data.details)
      }
    } catch (error) {
      console.error("저장 오류:", error)
      toast({
        title: "저장 실패",
        description: error instanceof Error ? error.message : "프로젝트를 저장하는 중 오류가 발생했습니다.",
        variant: "destructive",
      })
    } finally {
      setIsSaving(false)
    }
  }

  // 공개범위 변경
  const changeVisibility = async (newVisibility: "public" | "private" | "link_only") => {
    if (!currentProjectId || !session?.access_token) {
      toast({
        title: "오류",
        description: "로그인이 필요합니다.",
        variant: "destructive",
      })
      return
    }

    try {
      const response = await fetch(`/api/projects/${currentProjectId}/visibility`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ visibility: newVisibility }),
      })

      const data = await response.json()

      if (data.success) {
        setProjectVisibility(newVisibility)
        const visibilityLabels = {
          public: "공개",
          private: "비공개",
          link_only: "링크 공유",
        }
        toast({
          title: "공개범위 변경됨",
          description: `프로젝트가 "${visibilityLabels[newVisibility]}"로 설정되었습니다.`,
        })
      } else {
        throw new Error(data.error || data.details)
      }
    } catch (error) {
      console.error("공개범위 변경 오류:", error)
      toast({
        title: "변경 실패",
        description: error instanceof Error ? error.message : "공개범위를 변경하는 중 오류가 발생했습니다.",
        variant: "destructive",
      })
    }
  }

  // YouTube 검색 (무한 스크롤 지원, 중복 방지)
  const searchYouTube = async (page = 1, append = false) => {
    if (!searchQuery.trim()) return

    setIsSearching(true)
    try {
      const response = await fetch(
        `/api/youtube/search?q=${encodeURIComponent(searchQuery)}&page=${page}&maxResults=20`,
      )
      const data = await response.json()

      if (data.success) {
        if (append) {
          // 중복 제거
          const existingIds = new Set(searchResults.map((v) => v.id))
          const newResults = data.results.filter((v: YouTubeVideo) => !existingIds.has(v.id))
          setSearchResults((prev) => [...prev, ...newResults])
        } else {
          setSearchResults(data.results)
        }
        setHasMoreResults(data.results.length === 20)

        // API fallback 사용 시 사용자에게 알림
        if (data.fallback && !append) {
          toast({
            title: "제한된 검색 결과",
            description: "YouTube API 오류로 인해 샘플 결과를 표시합니다.",
            variant: "destructive",
          })
        }
      } else {
        toast({
          title: "검색 실패",
          description: data.error || "YouTube 검색 중 오류가 발생했습니다.",
          variant: "destructive",
        })
      }
    } catch (error) {
      toast({
        title: "검색 실패",
        description: "네트워크 오류가 발생했습니다.",
        variant: "destructive",
      })
    } finally {
      setIsSearching(false)
    }
  }

  // 무한 스크롤 핸들러
  const handleScrollSearch = useCallback(() => {
    if (!searchResultsRef.current || isSearching || !hasMoreResults) return

    const { scrollTop, scrollHeight, clientHeight } = searchResultsRef.current
    if (scrollTop + clientHeight >= scrollHeight - 5) {
      const nextPage = searchPage + 1
      setSearchPage(nextPage)
      searchYouTube(nextPage, true)
    }
  }, [searchPage, isSearching, hasMoreResults, searchQuery])

  // 검색 결과에서 영상 선택
  const selectVideo = (video: YouTubeVideo) => {
    // 이미 로드된 영상이 있는 경우 확인 모달 표시
    if (currentVideoId && currentVideoId !== video.id) {
      setPendingVideo(video)
      setShowVideoLoadConfirm(true)
      return
    }

    // 로드된 영상이 없거나 같은 영상인 경우 바로 로드
    loadSelectedVideo(video)
  }

  // 선택된 영상 로드 (큐와 구간 유지)
  const loadSelectedVideo = (video: YouTubeVideo) => {
    setVideoUrl(`https://www.youtube.com/watch?v=${video.id}`)
    setShowSearchDialog(false)
    setSearchQuery("")
    setSearchResults([])
    setSearchSuggestions([])
    setShowSuggestions(false)
    setShowVideoLoadConfirm(false)
    setPendingVideo(null)

    toast({
      title: "영상 선택됨",
      description: `"${video.title}"이 선택되었습니다.`,
    })
  }

  // 영상 로드 확인 취소
  const cancelVideoLoad = () => {
    setShowVideoLoadConfirm(false)
    setPendingVideo(null)
  }

  // 영상 로드 확인 (큐와 구간 유지)
  const confirmVideoLoad = () => {
    if (pendingVideo) {
      loadSelectedVideo(pendingVideo)
    }
  }

  // URL에서 영상 로드
  const loadVideoFromUrl = async (url: string) => {
    if (!isYouTubeAPIReady) {
      return
    }

    const videoId = extractVideoId(url)
    if (!videoId) {
      return
    }

    // 이미 같은 영상이 로드되어 있으면 스킵
    if (videoId === currentVideoId) {
      return
    }

    setCurrentVideoId(videoId)

    if (playerRef.current) {
      playerRef.current.destroy()
    }

    playerRef.current = new window.YT.Player("youtube-player", {
      height: "315",
      width: "100%",
      videoId: videoId,
      playerVars: {
        playsinline: 1,
        controls: 1,
      },
      events: {
        onReady: async (event: any) => {
          const duration = event.target.getDuration()
          // 안전 마진 적용 (1초)
          const safeDuration = Math.max(0, duration - 1)
          const title = event.target.getVideoData().title

          setVideoDuration(safeDuration)
          setVideoTitle(title)
          setNewSegment((prev) => ({
            ...prev,
            title: title,
            endTime: secondsToTime(safeDuration),
          }))

          toast({
            title: "영상 로드됨",
            description: "영상이 성공적으로 로드되었습니다.",
          })
        },
        onStateChange: (event: any) => {
          if (event.data === window.YT.PlayerState.PLAYING) {
            setIsPlaying(true)
          } else if (event.data === window.YT.PlayerState.PAUSED) {
            setIsPlaying(false)
          }
        },
        onError: (event: any) => {
          toast({
            title: "영상 로드 실패",
            description: "영상을 로드할 수 없습니다. URL을 확인해주세요.",
            variant: "destructive",
          })
        },
      },
    })
  }

  // 구간 선택 토글
  const toggleSegmentSelection = (segmentId: string) => {
    const newSelected = new Set(selectedSegments)
    if (newSelected.has(segmentId)) {
      newSelected.delete(segmentId)
    } else {
      newSelected.add(segmentId)
    }
    setSelectedSegments(newSelected)
  }

  // 모든 구간 선택/해제
  const toggleAllSegments = () => {
    if (selectedSegments.size === segments.length) {
      setSelectedSegments(new Set())
    } else {
      setSelectedSegments(new Set(segments.map((s) => s.id)))
    }
  }

  // 선택된 구간들을 큐에 추가
  const addSelectedToQueue = () => {
    const selectedSegmentObjects = segments.filter((segment) => selectedSegments.has(segment.id))

    selectedSegmentObjects.forEach((segment) => {
      const queueItem: QueueItem = {
        id: generateId(),
        type: "segment",
        segment,
        orderIndex: queue.length,
      }
      setQueue((prev) => [...prev, queueItem])
    })

    setSelectedSegments(new Set())
    setIsMultiSelectMode(false)
    setActiveTab("queue")

    toast({
      title: "큐에 추가됨",
      description: `${selectedSegmentObjects.length}개 구간이 큐에 추가되었습니다.`,
    })
  }

  // 큐에 데이터가 있고 비디오 ID가 있으면 자동으로 비디오 로드
  useEffect(() => {
    if (queue.length > 0 && currentVideoId && !playerRef.current) {
      const firstSegmentItem = queue.find((item) => item.type === "segment" && item.segment)
      if (firstSegmentItem?.segment) {
        loadVideoForSegment(firstSegmentItem.segment)
      }
    }
  }, [queue, currentVideoId])

  // YouTube API 로드
  useEffect(() => {
    if (window.YT && window.YT.Player) {
      setIsYouTubeAPIReady(true)
      return
    }

    const tag = document.createElement("script")
    tag.src = "https://www.youtube.com/iframe_api"
    const firstScriptTag = document.getElementsByTagName("script")[0]
    firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag)

    window.onYouTubeIframeAPIReady = () => {
      console.log("YouTube API ready")
      setIsYouTubeAPIReady(true)
    }
  }, [])

  // 현재 재생 중인 구간 모니터링
  useEffect(() => {
    if (isPlaying && queue.length > 0 && playerRef.current) {
      intervalRef.current = setInterval(() => {
        const currentItem = queue[currentQueueIndex]
        if (currentItem?.type === "segment" && currentItem.segment) {
          const currentTime = playerRef.current.getCurrentTime()
          const fadeOutDuration = 3 // 페이드아웃에 걸리는 시간(초)

          // 페이드아웃 시작 시점 = 종료 시간 - 페이드아웃 시간
          if (currentTime >= currentItem.segment.endTime - fadeOutDuration) {
            fadeOutAndNext()
            // 인터벌 클리어하여 중복 실행 방지
            if (intervalRef.current) {
              clearInterval(intervalRef.current)
              intervalRef.current = null
            }
          }
        }
      }, 1000)
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [isPlaying, currentQueueIndex, queue])

  // 새 프로젝트 시작
  const startNewProject = () => {
    setCurrentProjectId(null)
    setProjectName("")
    setProjectDescription("")
    setProjectVisibility("public")
    setVideoUrl("")
    setCurrentVideoId("")
    setVideoDuration(0)
    setVideoTitle("")
    setSegments([])
    setQueue([])
    setCurrentQueueIndex(0)
    setActiveTab("segments")
    setSelectedSegments(new Set())
    setIsMultiSelectMode(false)
    setHasUnsavedChanges(false)
    router.push("/", { scroll: false })

    if (playerRef.current) {
      playerRef.current.destroy()
      playerRef.current = null
    }

    // 새 프로젝트 자동 생성
    createNewProject()

    toast({
      title: "새 프로젝트",
      description: "새 프로젝트를 시작합니다.",
    })
  }

  const timeToSeconds = (timeStr: string) => {
    const parts = timeStr.split(":").map(Number)
    if (parts.length === 2) {
      return parts[0] * 60 + parts[1]
    } else if (parts.length === 3) {
      return parts[0] * 3600 + parts[1] * 60 + parts[2]
    }
    return Number.parseInt(timeStr) || 0
  }

  const secondsToTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = Math.floor(seconds % 60)

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
    }
    return `${minutes}:${secs.toString().padStart(2, "0")}`
  }

  const validateTimeRange = (startTime: string, endTime: string) => {
    const startSeconds = timeToSeconds(startTime)
    const endSeconds = timeToSeconds(endTime)

    if (startSeconds < 0 || endSeconds < 0) {
      return "시간은 0보다 커야 합니다."
    }

    if (startSeconds > videoDuration || endSeconds > videoDuration) {
      return `시간은 영상 길이(${secondsToTime(videoDuration)})를 초과할 수 없습니다.`
    }

    if (startSeconds >= endSeconds) {
      return "시작 시간은 종료 시간보다 작아야 합니다."
    }

    return null
  }

  const addSegment = () => {
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

    const validationError = validateTimeRange(newSegment.startTime, newSegment.endTime)
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

    const segment: Segment = {
      id: generateId(),
      title: newSegment.title,
      description: newSegment.description,
      videoId: currentVideoId,
      videoTitle,
      startTime: startSeconds,
      endTime: endSeconds,
      orderIndex: segments.length,
    }

    // 로컬 상태 업데이트
    setSegments((prev) => [...prev, segment])

    // 구간 추가 후 초기화
    setNewSegment({
      title: videoTitle,
      description: "",
      startTime: "0:00",
      endTime: videoDuration ? secondsToTime(videoDuration) : "",
    })

    // 플레이어를 시작점으로 이동
    if (playerRef.current) {
      playerRef.current.seekTo(0)
    }

    toast({
      title: "성공",
      description: "구간이 추가되었습니다.",
    })
  }

  const startEditSegment = (segment: Segment) => {
    setEditingSegment(segment)
    setEditForm({
      title: segment.title,
      description: segment.description,
      startTime: secondsToTime(segment.startTime),
      endTime: secondsToTime(segment.endTime),
    })
  }

  const saveEditSegment = () => {
    if (!editingSegment) return

    if (!editForm.title.trim()) {
      toast({
        title: "오류",
        description: "구간 제목을 입력해주세요.",
        variant: "destructive",
      })
      return
    }

    const validationError = validateTimeRange(editForm.startTime, editForm.endTime)
    if (validationError) {
      toast({
        title: "오류",
        description: validationError,
        variant: "destructive",
      })
      return
    }

    const updatedSegment: Segment = {
      ...editingSegment,
      title: editForm.title,
      description: editForm.description,
      startTime: timeToSeconds(editForm.startTime),
      endTime: timeToSeconds(editForm.endTime),
    }

    // 로컬 상태 업데이트
    setSegments((prev) => prev.map((seg) => (seg.id === editingSegment.id ? updatedSegment : seg)))

    // 큐에서도 업데이트
    setQueue((prev) =>
      prev.map((item) =>
        item.type === "segment" && item.segment?.id === editingSegment.id ? { ...item, segment: updatedSegment } : item,
      ),
    )

    setEditingSegment(null)
    toast({
      title: "성공",
      description: "구간이 수정되었습니다.",
    })
  }

  const fadeOutAndNext = () => {
    // 이미 페이드아웃 중인지 확인하는 플래그
    if (playerRef.current && playerRef.current.setVolume && !playerRef.current.isFadingOut) {
      playerRef.current.isFadingOut = true

      // 페이드 아웃 (3배 길게)
      let volume = 100
      const fadeOut = setInterval(() => {
        volume -= 5
        if (volume <= 0) {
          clearInterval(fadeOut)
          playerRef.current.setVolume(0)
          playerRef.current.isFadingOut = false
          playNextInQueue()

          // 페이드 인
          setTimeout(() => {
            if (playerRef.current) {
              let volume = 0
              const fadeIn = setInterval(() => {
                volume += 5
                if (volume >= 100) {
                  clearInterval(fadeIn)
                  if (playerRef.current) {
                    playerRef.current.setVolume(100)
                  }
                } else {
                  if (playerRef.current) {
                    playerRef.current.setVolume(volume)
                  }
                }
              }, 150)
            }
          }, 300)
        } else {
          if (playerRef.current) {
            playerRef.current.setVolume(volume)
          }
        }
      }, 150)
    }
  }

  const addToQueue = (segment: Segment) => {
    const queueItem: QueueItem = {
      id: generateId(),
      type: "segment",
      segment,
      orderIndex: queue.length,
    }

    setQueue((prev) => [...prev, queueItem])
    setActiveTab("queue")

    toast({
      title: "큐에 추가됨",
      description: `"${segment.title}" 구간이 큐에 추가되었습니다.`,
    })
  }

  const addDescriptionToQueue = () => {
    if (!newDescription.trim()) {
      toast({
        title: "오류",
        description: "설명을 입력해주세요.",
        variant: "destructive",
      })
      return
    }

    const queueItem: QueueItem = {
      id: generateId(),
      type: "description",
      description: newDescription,
      orderIndex: queue.length,
    }

    setQueue((prev) => [...prev, queueItem])
    setNewDescription("")
    setActiveTab("queue")

    toast({
      title: "설명 블럭 추가됨",
      description: "큐에 설명 블럭이 추가되었습니다.",
    })
  }

  const removeFromQueue = (queueItemId: string) => {
    setQueue((prev) => prev.filter((item) => item.id !== queueItemId))
  }

  const removeSegment = (segmentId: string) => {
    // 로컬 상태에서 삭제
    setSegments((prev) => prev.filter((seg) => seg.id !== segmentId))
    // 큐에서도 제거
    setQueue((prev) => prev.filter((item) => item.segment?.id !== segmentId))
    // 선택된 구간에서도 제거
    setSelectedSegments((prev) => {
      const newSet = new Set(prev)
      newSet.delete(segmentId)
      return newSet
    })
  }

  const playSegment = (segment: Segment) => {
    if (!playerRef.current) {
      // 플레이어가 없으면 먼저 로드
      loadVideoForSegment(segment)
      return
    }

    // 이미 같은 영상이면 seekTo만 수행
    if (segment.videoId === currentVideoId) {
      playerRef.current.seekTo(segment.startTime)
      playerRef.current.playVideo()
    } else {
      // 다른 영상이면 loadVideoById 사용
      playerRef.current.loadVideoById({
        videoId: segment.videoId,
        startSeconds: segment.startTime,
      })
      setCurrentVideoId(segment.videoId)
    }
  }

  const loadVideoForSegment = (segment: Segment) => {
    if (!isYouTubeAPIReady) {
      toast({
        title: "오류",
        description: "YouTube API가 아직 로드되지 않았습니다.",
        variant: "destructive",
      })
      return
    }

    // 이미 같은 영상이고 플레이어가 있으면 seekTo만 수행
    if (playerRef.current && segment.videoId === currentVideoId) {
      playerRef.current.seekTo(segment.startTime)
      playerRef.current.playVideo()
      return
    }

    setCurrentVideoId(segment.videoId)

    if (playerRef.current) {
      playerRef.current.destroy()
    }

    playerRef.current = new window.YT.Player("youtube-player", {
      height: "315",
      width: "100%",
      videoId: segment.videoId,
      playerVars: {
        playsinline: 1,
        controls: 1,
        start: segment.startTime,
        autoplay: 1,
      },
      events: {
        onReady: (event: any) => {
          const duration = event.target.getDuration()
          // 안전 마진 적용 (1초)
          const safeDuration = Math.max(0, duration - 1)
          const title = event.target.getVideoData().title
          setVideoDuration(safeDuration)
          setVideoTitle(title)

          // 시작 시간으로 이동하고 재생
          event.target.seekTo(segment.startTime)
          setTimeout(() => {
            event.target.playVideo()
          }, 100)
        },
        onStateChange: (event: any) => {
          if (event.data === window.YT.PlayerState.PLAYING) {
            setIsPlaying(true)
          } else if (event.data === window.YT.PlayerState.PAUSED) {
            setIsPlaying(false)
          }
        },
      },
    })
  }

  const playQueue = () => {
    if (queue.length === 0) {
      toast({
        title: "오류",
        description: "큐가 비어있습니다.",
        variant: "destructive",
      })
      return
    }

    setCurrentQueueIndex(0)
    const firstItem = queue[0]
    if (firstItem.type === "segment" && firstItem.segment) {
      playSegment(firstItem.segment)
    } else if (firstItem.type === "segment" && !firstItem.segment) {
      // 세그먼트 타입이지만 세그먼트 데이터가 없는 경우
      toast({
        title: "재생 불가",
        description: "이 구간에 대한 데이터를 찾을 수 없습니다. 다음 항목으로 넘어갑니다.",
        variant: "destructive",
      })
      // 다음 아이템으로 넘어감
      playNextInQueue()
    } else {
      // 설명 블럭인 경우
      toast({
        title: "설명 표시",
        description: firstItem.description || "설명 블럭입니다.",
      })
      setTimeout(() => playNextInQueue(), 3000)
    }
  }

  const playNextInQueue = () => {
    if (currentQueueIndex < queue.length - 1) {
      const nextIndex = currentQueueIndex + 1
      setCurrentQueueIndex(nextIndex)
      const nextItem = queue[nextIndex]

      if (nextItem.type === "segment" && nextItem.segment) {
        playSegment(nextItem.segment)
      } else if (nextItem.type === "segment" && !nextItem.segment) {
        // 세그먼트 타입이지만 세그먼트 데이터가 없는 경우
        toast({
          title: "재생 불가",
          description: "이 구간에 대한 데이터를 찾을 수 없습니다. 다음 항목으로 넘어갑니다.",
          variant: "destructive",
        })
        // 다음 아이템으로 넘어감
        setTimeout(() => playNextInQueue(), 1000)
      } else {
        // 설명 블럭인 경우
        toast({
          title: "설명 표시",
          description: nextItem.description || "설명 블럭입니다.",
        })
        setTimeout(() => playNextInQueue(), 3000) // 설명 블럭은 3초 표시
      }
    } else {
      setIsPlaying(false)
      toast({
        title: "완료",
        description: "모든 구간 재생이 완료되었습니다.",
      })
    }
  }

  const playQueueItem = (index: number) => {
    const item = queue[index]
    if (item.type === "segment" && item.segment) {
      setCurrentQueueIndex(index)
      playSegment(item.segment)
    } else if (item.type === "segment" && !item.segment) {
      // 세그먼트 타입이지만 세그먼트 데이터가 없는 경우
      toast({
        title: "재생 불가",
        description: "이 구간에 대한 데이터를 찾을 수 없습니다.",
        variant: "destructive",
      })
    } else {
      // 설명 블럭인 경우
      toast({
        title: "설명 표시",
        description: item.description || "설명 블럭입니다.",
      })
    }
  }

  const getCurrentTime = () => {
    if (playerRef.current && playerRef.current.getCurrentTime) {
      return Math.floor(playerRef.current.getCurrentTime())
    }
    return 0
  }

  const setCurrentTimeAsStart = () => {
    const currentTime = getCurrentTime()
    setNewSegment((prev) => ({ ...prev, startTime: secondsToTime(currentTime) }))
  }

  const setCurrentTimeAsEnd = () => {
    const currentTime = getCurrentTime()
    setNewSegment((prev) => ({ ...prev, endTime: secondsToTime(currentTime) }))
  }

  const seekBy = (seconds: number) => {
    if (playerRef.current && playerRef.current.getCurrentTime) {
      const currentTime = playerRef.current.getCurrentTime()
      const newTime = Math.max(0, Math.min(videoDuration, currentTime + seconds))
      playerRef.current.seekTo(newTime)
    }
  }

  const seekToTime = (seconds: number) => {
    if (playerRef.current) {
      const clampedTime = Math.max(0, Math.min(videoDuration, seconds))
      playerRef.current.seekTo(clampedTime)
    }
  }

  const seekToStart = () => {
    const startTime = timeToSeconds(newSegment.startTime)
    seekToTime(startTime)
  }

  const seekToEnd = () => {
    const endTime = timeToSeconds(newSegment.endTime)
    seekToTime(endTime)
  }

  const shareCurrentState = async () => {
    if (!currentProjectId) {
      toast({
        title: "알림",
        description: "먼저 프로젝트를 저장해주세요.",
        variant: "destructive",
      })
      return
    }

    const shareUrl = `${window.location.origin}?id=${currentProjectId}`

    try {
      await navigator.clipboard.writeText(shareUrl)
      toast({
        title: "링크 복사 완료",
        description: "공유 링크가 클립보드에 복사되었습니다.",
      })
    } catch (error) {
      toast({
        title: "링크 생성됨",
        description: shareUrl,
      })
    }
  }

  // 플레이어 최대화 토글
  const togglePlayerMaximize = () => {
    setIsPlayerMaximized(!isPlayerMaximized)
  }

  // 맨 위로 스크롤
  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  // 공개범위 아이콘 가져오기
  const getVisibilityIcon = () => {
    switch (projectVisibility) {
      case "public":
        return <Globe className="w-4 h-4" />
      case "private":
        return <Lock className="w-4 h-4" />
      case "link_only":
        return <Link className="w-4 h-4" />
      default:
        return <Globe className="w-4 h-4" />
    }
  }

  // 공개범위 라벨 가져오기
  const getVisibilityLabel = () => {
    switch (projectVisibility) {
      case "public":
        return "공개"
      case "private":
        return "비공개"
      case "link_only":
        return "링크 공유"
      default:
        return "공개"
    }
  }

  if (isLoading) {
    return (
      <div className="container mx-auto p-6 max-w-7xl">
        <div className="flex items-center justify-center h-96">
          <div className="flex items-center gap-3">
            <Loader2 className="w-6 h-6 animate-spin" />
            <span>프로젝트를 로드하는 중...</span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6 max-w-7xl pb-32">
      <div className="flex items-center justify-between mb-8">
        <div className="flex-1">
          <h1 className="text-3xl font-bold">Pi Que.</h1>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
            {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </Button>
        </div>
      </div>

      <div className={`grid gap-8 ${isPlayerMaximized ? "grid-cols-[1fr_300px]" : "grid-cols-1 lg:grid-cols-2"}`}>
        {/* 왼쪽: 영상 플레이어 및 컨트롤 */}
        <div className="space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>YouTube 영상 플레이어</CardTitle>
                <CardDescription>
                  YouTube URL을 입력하거나 검색하여 영상을 로드하세요
                  {videoDuration > 0 && <span className="ml-2">• 총 길이: {secondsToTime(videoDuration)}</span>}
                </CardDescription>
              </div>
              <Button variant="ghost" size="icon" onClick={togglePlayerMaximize} className="ml-2">
                {isPlayerMaximized ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
              </Button>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex gap-3">
                <Input
                  placeholder="https://www.youtube.com/watch?v=..."
                  value={videoUrl}
                  onChange={(e) => setVideoUrl(e.target.value)}
                  className="flex-1"
                />
                <Button onClick={() => setShowSearchDialog(true)} variant="outline">
                  <Youtube className="w-4 h-4 mr-2" />
                  YouTube에서 찾기
                </Button>
              </div>

              <div id="youtube-player" className="w-full aspect-video bg-muted rounded-lg"></div>

              {/* 정밀 시간 이동 컨트롤 */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  <span className="text-sm font-medium">정밀 시간 이동</span>
                </div>

                <div className="flex items-center justify-between gap-2">
                  <div className="flex gap-1">
                    <Button size="sm" variant="outline" onClick={() => seekBy(-10)} className="text-xs">
                      -10초
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => seekBy(-5)} className="text-xs">
                      -5초
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => seekBy(-1)} className="text-xs">
                      -1초
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => seekBy(-0.1)} className="text-xs">
                      -0.1초
                    </Button>
                  </div>
                  <div className="flex gap-1">
                    <Button size="sm" variant="outline" onClick={() => seekBy(0.1)} className="text-xs">
                      +0.1초
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => seekBy(1)} className="text-xs">
                      +1초
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => seekBy(5)} className="text-xs">
                      +5초
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => seekBy(10)} className="text-xs">
                      +10초
                    </Button>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                  <Target className="w-4 h-4 text-muted-foreground" />
                  <Label htmlFor="seek-time" className="text-sm font-medium">
                    특정 시간으로 이동:
                  </Label>
                  <Input
                    id="seek-time"
                    placeholder="mm:ss"
                    className="w-24"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        const timeStr = (e.target as HTMLInputElement).value
                        const seconds = timeToSeconds(timeStr)
                        seekToTime(seconds)
                        ;(e.target as HTMLInputElement).value = ""
                      }
                    }}
                  />
                  <span className="text-xs text-muted-foreground">Enter</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {!isPlayerMaximized && (
            <>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                  <div>
                    <CardTitle>구간 추가</CardTitle>
                    <CardDescription>현재 영상에서 구간을 만드세요</CardDescription>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => setIsSegmentFormExpanded(!isSegmentFormExpanded)}>
                    {isSegmentFormExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                  </Button>
                </CardHeader>
                {isSegmentFormExpanded && (
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
                      <Label htmlFor="segment-description">구간 설명</Label>
                      <Textarea
                        id="segment-description"
                        placeholder="구간에 대한 설명을 입력하세요"
                        value={newSegment.description}
                        onChange={(e) => setNewSegment((prev) => ({ ...prev, description: e.target.value }))}
                        rows={3}
                      />
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
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={setCurrentTimeAsStart}
                            title="현재 시간으로 설정"
                          >
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

                    <Button onClick={addSegment} className="w-full" size="lg">
                      <Plus className="w-4 h-4 mr-2" />
                      구간 추가
                    </Button>
                  </CardContent>
                )}
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                  <div>
                    <CardTitle>설명 블럭 추가</CardTitle>
                    <CardDescription>큐에 설명이나 메모를 추가하세요</CardDescription>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setIsDescriptionFormExpanded(!isDescriptionFormExpanded)}
                  >
                    {isDescriptionFormExpanded ? (
                      <ChevronUp className="w-5 h-5" />
                    ) : (
                      <ChevronDown className="w-5 h-5" />
                    )}
                  </Button>
                </CardHeader>
                {isDescriptionFormExpanded && (
                  <CardContent className="space-y-4 pt-0">
                    <Textarea
                      placeholder="설명이나 메모를 입력하세요"
                      value={newDescription}
                      onChange={(e) => setNewDescription(e.target.value)}
                      rows={4}
                    />
                    <Button onClick={addDescriptionToQueue} className="w-full">
                      <MessageSquare className="w-4 h-4 mr-2" />
                      설명 블럭 추가
                    </Button>
                  </CardContent>
                )}
              </Card>
            </>
          )}
        </div>

        {/* 오른쪽: 구간 목록 및 재생 큐 (탭으로 전환) */}
        <div className="space-y-6">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="segments" className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4" />
                생성된 구간 ({segments.length})
              </TabsTrigger>
              <TabsTrigger value="queue" className="flex items-center gap-2">
                <Play className="w-4 h-4" />
                재생 큐 ({queue.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="segments" className="mt-6">
              <Card className={isPlayerMaximized ? "h-[calc(100vh-200px)]" : "h-[800px]"}>
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
                          <Button size="sm" onClick={addSelectedToQueue} disabled={selectedSegments.size === 0}>
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
                        <Button size="sm" variant="outline" onClick={() => setIsMultiSelectMode(true)}>
                          <PlusCircle className="w-4 h-4 mr-2" />
                          다중 선택
                        </Button>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div
                    className={`space-y-3 overflow-y-auto ${isPlayerMaximized ? "max-h-[calc(100vh-300px)]" : "max-h-[700px]"}`}
                  >
                    {segments.map((segment) => (
                      <div
                        key={segment.id}
                        className={`border rounded-lg p-4 space-y-3 transition-colors ${
                          isMultiSelectMode
                            ? selectedSegments.has(segment.id)
                              ? "bg-primary/10 border-primary"
                              : "hover:bg-muted/50 cursor-pointer"
                            : "hover:bg-muted/50"
                        }`}
                        onClick={() => isMultiSelectMode && toggleSegmentSelection(segment.id)}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-start gap-3 flex-1 min-w-0">
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
                                <span className="ml-2 text-xs">
                                  ({secondsToTime(segment.endTime - segment.startTime)})
                                </span>
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
                              <Button size="sm" variant="outline" onClick={() => playSegment(segment)} title="재생">
                                <PlayCircle className="w-4 h-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => startEditSegment(segment)}
                                title="편집"
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                              <Button size="sm" onClick={() => addToQueue(segment)} title="큐에 추가">
                                <Plus className="w-4 h-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => removeSegment(segment.id)}
                                title="삭제"
                              >
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
            </TabsContent>

            <TabsContent value="queue" className="mt-6">
              <Card className={isPlayerMaximized ? "h-[calc(100vh-200px)]" : "h-[800px]"}>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    재생 큐
                    <div className="flex gap-2">
                      <Button size="sm" onClick={playQueue} disabled={queue.length === 0}>
                        <Play className="w-4 h-4 mr-2" />큐 재생
                      </Button>
                      <Button size="sm" variant="outline" onClick={playNextInQueue} disabled={queue.length === 0}>
                        <SkipForward className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardTitle>
                  <CardDescription>
                    총 {queue.length}개 항목
                    {queue.length > 0 && (
                      <span className="ml-2">
                        (현재: {currentQueueIndex + 1} / {queue.length})
                      </span>
                    )}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div
                    className={`space-y-3 overflow-y-auto ${isPlayerMaximized ? "max-h-[calc(100vh-300px)]" : "max-h-[700px]"}`}
                  >
                    {queue.map((item, index) => (
                      <div
                        key={item.id}
                        className={`border rounded-lg p-4 transition-all cursor-pointer ${
                          index === currentQueueIndex ? "bg-primary/10 border-primary shadow-md" : "hover:bg-muted/50"
                        }`}
                        onClick={() => item.type === "segment" && item.segment && playQueueItem(index)}
                      >
                        <div className="flex items-start gap-3">
                          <Badge
                            variant={index === currentQueueIndex ? "default" : "secondary"}
                            className="mt-0.5 min-w-[2rem] justify-center"
                          >
                            {index + 1}
                          </Badge>
                          <div className="flex-1 min-w-0">
                            {item.type === "segment" && item.segment ? (
                              <>
                                <div className="font-medium truncate">{item.segment.title}</div>
                                <div className="text-sm text-muted-foreground">
                                  {secondsToTime(item.segment.startTime)} - {secondsToTime(item.segment.endTime)}
                                  <span className="ml-2 text-xs">
                                    ({secondsToTime(item.segment.endTime - item.segment.startTime)})
                                  </span>
                                </div>
                                {item.segment.description && (
                                  <div className="text-sm text-muted-foreground mt-1 italic line-clamp-2">
                                    {item.segment.description}
                                  </div>
                                )}
                              </>
                            ) : item.type === "segment" && !item.segment ? (
                              // 세그먼트 타입이지만 데이터가 없는 경우
                              <div className="flex items-start gap-2">
                                <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
                                <div>
                                  <div className="font-medium text-amber-600">구간 데이터 없음</div>
                                  <div className="text-sm text-muted-foreground">
                                    이 구간의 데이터를 찾을 수 없습니다.
                                  </div>
                                </div>
                              </div>
                            ) : (
                              // 설명 블럭인 경우
                              <div className="flex items-start gap-2">
                                <MessageSquare className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                                <div className="text-sm text-muted-foreground italic break-words">
                                  {item.description}
                                </div>
                              </div>
                            )}
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={(e) => {
                              e.stopPropagation()
                              removeFromQueue(item.id)
                            }}
                            title="큐에서 제거"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                    {queue.length === 0 && (
                      <div className="text-center text-muted-foreground py-12">
                        <Play className="w-12 h-12 mx-auto mb-4 opacity-50" />
                        <p>큐가 비어있습니다</p>
                        <p className="text-sm">구간이나 설명 블럭을 추가해보세요</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* 하단 고정 컨트롤 바 */}
      <div className="fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-t z-50">
        <div className="container mx-auto max-w-7xl px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {/* 프로젝트 이름 편집 */}
              {isEditingProjectName ? (
                <div className="flex items-center gap-2">
                  <Input
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        setIsEditingProjectName(false)
                      }
                    }}
                    onBlur={() => setIsEditingProjectName(false)}
                    className="text-lg font-medium w-64"
                    autoFocus
                  />
                  <Button size="sm" onClick={() => setIsEditingProjectName(false)}>
                    <CheckCircle className="w-4 h-4" />
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <h2
                    className="text-lg font-medium cursor-pointer hover:text-primary"
                    onClick={() => setIsEditingProjectName(true)}
                  >
                    {projectName || "이름 없는 프로젝트"}
                  </h2>
                  <Button size="sm" variant="ghost" onClick={() => setIsEditingProjectName(true)}>
                    <Edit className="w-4 h-4" />
                  </Button>

                  {/* 공개범위 설정 드롭다운 */}
                  {currentProjectId && session?.access_token && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="sm" variant="ghost" className="flex items-center gap-1">
                          {getVisibilityIcon()}
                          <span className="text-xs">{getVisibilityLabel()}</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start">
                        <DropdownMenuItem onClick={() => changeVisibility("public")}>
                          <Globe className="w-4 h-4 mr-2" />
                          공개
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => changeVisibility("private")}>
                          <Lock className="w-4 h-4 mr-2" />
                          비공개
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => changeVisibility("link_only")}>
                          <Link className="w-4 h-4 mr-2" />
                          링크 공유
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              )}
              {currentProjectId && (
                <Badge variant="secondary" className="text-xs">
                  ID: {currentProjectId.slice(0, 8)}...
                </Badge>
              )}
              {hasUnsavedChanges && (
                <Badge variant="destructive" className="text-xs">
                  저장되지 않음
                </Badge>
              )}
            </div>

            <div className="flex items-center gap-3">
              <UserProfile />
              <Button onClick={startNewProject} variant="outline">
                새 프로젝트
              </Button>

              <Button onClick={saveProject} disabled={isSaving || !hasUnsavedChanges} className="relative">
                {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Database className="w-4 h-4 mr-2" />}
                저장
              </Button>

              <Button onClick={shareCurrentState} variant="outline" disabled={!currentProjectId}>
                <Share2 className="w-4 h-4 mr-2" />
                링크 공유
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* 스크롤 투 탑 버튼 */}
      {showScrollTop && (
        <Button className="fixed bottom-24 right-6 z-40" size="icon" onClick={scrollToTop} variant="outline">
          <ArrowUp className="w-4 h-4" />
        </Button>
      )}

      {/* 영상 로드 확인 모달 */}
      <Dialog open={showVideoLoadConfirm} onOpenChange={setShowVideoLoadConfirm}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              영상 변경 확인
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p>현재 로드된 영상을 다른 영상으로 변경하시겠습니까?</p>
            <p className="text-sm text-muted-foreground mt-2">영상만 변경되고, 기존 구간과 큐는 그대로 유지됩니다.</p>
            {pendingVideo && (
              <div className="mt-4 p-3 bg-muted rounded-lg">
                <p className="text-sm font-medium">선택된 영상:</p>
                <p className="text-sm text-muted-foreground">{pendingVideo.title}</p>
              </div>
            )}
          </div>
          <DialogFooter className="flex gap-2 sm:justify-end">
            <Button variant="outline" onClick={cancelVideoLoad}>
              취소
            </Button>
            <Button onClick={confirmVideoLoad}>영상 변경</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* YouTube 검색 다이얼로그 */}
      <Dialog open={showSearchDialog} onOpenChange={setShowSearchDialog}>
        <DialogContent className="max-w-6xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Youtube className="w-5 h-5" />
              YouTube 영상 검색
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="relative">
              <div className="flex gap-3">
                <div className="flex-1 relative">
                  <Input
                    ref={searchInputRef}
                    placeholder="검색어를 입력하세요..."
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value)
                      setShowSuggestions(true)
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        setSearchPage(1)
                        searchYouTube(1, false)
                        setShowSuggestions(false)
                      } else if (e.key === "Escape") {
                        setShowSuggestions(false)
                      }
                    }}
                    onFocus={() => setShowSuggestions(true)}
                    className="flex-1"
                  />

                  {/* 검색 제안 */}
                  {showSuggestions && searchSuggestions.length > 0 && (
                    <div className="absolute top-full left-0 right-0 bg-background border rounded-md shadow-lg z-50 mt-1">
                      {searchSuggestions.map((suggestion, index) => (
                        <div
                          key={index}
                          className="px-3 py-2 hover:bg-muted cursor-pointer text-sm"
                          onClick={() => {
                            setSearchQuery(suggestion)
                            setShowSuggestions(false)
                            setSearchPage(1)
                            searchYouTube(1, false)
                          }}
                        >
                          {suggestion}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <Button
                  onClick={() => {
                    setSearchPage(1)
                    searchYouTube(1, false)
                    setShowSuggestions(false)
                  }}
                  disabled={isSearching}
                >
                  {isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                  검색
                </Button>
              </div>
            </div>

            <div
              ref={searchResultsRef}
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[60vh] overflow-y-auto"
              onScroll={handleScrollSearch}
            >
              {searchResults.map((video) => (
                <div
                  key={video.id}
                  className="border rounded-lg p-4 hover:bg-muted/50 cursor-pointer transition-colors"
                  onClick={() => selectVideo(video)}
                >
                  <div className="space-y-3">
                    <div className="relative">
                      <img
                        src={video.thumbnail || "/placeholder.svg"}
                        alt={video.title}
                        className="w-full aspect-video object-cover rounded"
                      />
                      <Badge className="absolute bottom-2 right-2 bg-black/80 text-white">{video.duration}</Badge>
                    </div>
                    <div className="space-y-2">
                      <h3 className="font-medium line-clamp-2 text-sm leading-tight">{video.title}</h3>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <User className="w-3 h-3" />
                        <span className="truncate">{video.channelTitle}</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Calendar className="w-3 h-3" />
                        <span>{formatDate(video.publishedAt)}</span>
                      </div>
                      {video.viewCount && (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Eye className="w-3 h-3" />
                          <span>{video.viewCount} 조회수</span>
                        </div>
                      )}
                      {video.description && (
                        <p className="text-xs text-muted-foreground line-clamp-2">{video.description}</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              {isSearching && (
                <div className="col-span-full flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin" />
                  <span className="ml-2">검색 중...</span>
                </div>
              )}
              {searchResults.length === 0 && searchQuery && !isSearching && (
                <div className="col-span-full text-center text-muted-foreground py-8">검색 결과가 없습니다.</div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* 구간 편집 다이얼로그 */}
      <Dialog open={!!editingSegment} onOpenChange={() => setEditingSegment(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>구간 편집</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-title">구간 제목 *</Label>
              <Input
                id="edit-title"
                value={editForm.title}
                onChange={(e) => setEditForm((prev) => ({ ...prev, title: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="edit-description">구간 설명</Label>
              <Textarea
                id="edit-description"
                value={editForm.description}
                onChange={(e) => setEditForm((prev) => ({ ...prev, description: e.target.value }))}
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit-start-time">시작 시간</Label>
                <Input
                  id="edit-start-time"
                  value={editForm.startTime}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, startTime: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="edit-end-time">종료 시간</Label>
                <Input
                  id="edit-end-time"
                  value={editForm.endTime}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, endTime: e.target.value }))}
                />
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setEditingSegment(null)}>
                <X className="w-4 h-4 mr-2" />
                취소
              </Button>
              <Button onClick={saveEditSegment}>
                <Save className="w-4 h-4 mr-2" />
                저장
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
