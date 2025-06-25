"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import {
  Play,
  SkipForward,
  Share2,
  MessageSquare,
  Edit,
  Edit2,
  Save,
  X,
  AlertTriangle,
  Search,
  Loader2,
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
  Home,
  Timer,
  EyeOff,
  CheckCircle,
  ChevronUp,
  ChevronDown,
  Presentation,
} from "lucide-react"
import { toast } from "@/hooks/use-toast"
import { useRouter, useSearchParams } from "next/navigation"
import { UserProfile } from "@/components/user-profile"
import { useAuth } from "@/contexts/auth-context"
import { usePlayer } from "@/contexts/player-context"
import { useTheme } from "next-themes"
import { extractVideoId, isValidYouTubeUrl, debounce, formatDate, generateId } from "@/lib/utils"
import { PlaylistImport } from "./HomePage/components/PlaylistManager/PlaylistImport"
import { useYouTubeAPI } from "@/hooks/use-youtube-api"
import { useYouTubePlayer } from "@/hooks/use-youtube-player"
import { useProject } from "@/hooks/use-project"
import { YouTubePlayer } from "@/components/youtube-player"
import { SegmentForm } from "@/components/segment-form"
import { SegmentsTab } from "@/components/segments-tab"
import { secondsToTime, timeToSeconds, validateTimeRange } from "@/utils/time"
import type { Segment, QueueItem, YouTubeVideo } from "@/types"

export default function YouTubeSegmentPlayerPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { session, user, loading } = useAuth()
  const { state: playerState, setCurrentVideo, setCurrentTime, setDuration } = usePlayer()
  const { theme, setTheme } = useTheme()

  // YouTube API 및 플레이어
  const { isReady: isYouTubeAPIReady, isLoading: isAPILoading, error: apiError } = useYouTubeAPI()

  // 프로젝트 관리
  const {
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
    setProjectName,
    setProjectDescription,
    setProjectVisibility,
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
  } = useProject()

  // 상태
  const [videoUrl, setVideoUrl] = useState("")
  const [videoDuration, setVideoDuration] = useState(0)
  const [videoTitle, setVideoTitle] = useState("")
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentQueueIndex, setCurrentQueueIndex] = useState(0)
  const [activeTab, setActiveTab] = useState("segments")
  const [isEditingProjectName, setIsEditingProjectName] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [hasAccess, setHasAccess] = useState(true)
  const [accessError, setAccessError] = useState("")
  const [autoSaveEnabled, setAutoSaveEnabled] = useState(false)
  const [autoSaveInterval] = useState(30)
  const [isSegmentFormExpanded, setIsSegmentFormExpanded] = useState(true)
  const [isDescriptionFormExpanded, setIsDescriptionFormExpanded] = useState(false)
  const [isPlayerMaximized, setIsPlayerMaximized] = useState(false)
  const [showScrollTop, setShowScrollTop] = useState(false)
  
  // 앱 모드 관리
  const [appMode, setAppMode] = useState<'edit' | 'presentation'>('edit')
  const [isQueuePlayActive, setIsQueuePlayActive] = useState(false)

  // 검색 관련
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<YouTubeVideo[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [showSearchDialog, setShowSearchDialog] = useState(false)
  const [searchPage, setSearchPage] = useState(1)
  const [hasMoreResults, setHasMoreResults] = useState(true)
  const [searchSuggestions, setSearchSuggestions] = useState<string[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)

  // 모달
  const [showVideoLoadConfirm, setShowVideoLoadConfirm] = useState(false)
  const [pendingVideo, setPendingVideo] = useState<YouTubeVideo | null>(null)
  const [editingSegment, setEditingSegment] = useState<Segment | null>(null)
  const [editForm, setEditForm] = useState({
    title: "",
    description: "",
    startTime: "",
    endTime: "",
  })
  const [newDescription, setNewDescription] = useState("")

  // Refs
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const autoSaveRef = useRef<NodeJS.Timeout | null>(null)
  const searchResultsRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const tabChangeRef = useRef(false)
  const lastProcessedUrlRef = useRef<string>("")
  const isLoadingVideoRef = useRef(false)

  // YouTube 플레이어 - 탭 변경 감지 추가
  const {
    currentVideoId,
    isPlayerReady,
    isInitializing,
    loadVideo,
    seekTo,
    getCurrentTime,
    playVideo,
    pauseVideo,
    setVolume,
    destroyPlayer,
  } = useYouTubePlayer({
    isAPIReady: isYouTubeAPIReady,
    onVideoReady: (duration, title) => {
      setVideoDuration(duration)
      setVideoTitle(title)
      setDuration(duration)
      // 플레이어 컨텍스트에 현재 비디오 정보 업데이트 (정확한 제목으로)
      if (currentVideoId) {
        setCurrentVideo({
          id: currentVideoId,
          title: title,
          url: videoUrl
        })
      }
      isLoadingVideoRef.current = false
    },
    onProgress: (currentTime) => {
      // 플레이어 컨텍스트 시간 업데이트
      setCurrentTime(currentTime)
    },
    onStateChange: (playing) => {
      // 큐 재생 중이 아닐 때만 일반 재생 상태 업데이트
      if (queue.length === 0 || currentQueueIndex >= queue.length) {
        setIsPlaying(playing)
      } else {
        // 큐 재생 중일 때는 신중하게 상태 업데이트
        const currentItem = queue[currentQueueIndex]
        if (currentItem?.type === "segment" && currentItem.segment) {
          setIsPlaying(playing)
        }
      }
    },
  })

  // 탭 변경 시 플레이어 안전 처리
  useEffect(() => {
    if (tabChangeRef.current) {
      // 탭 변경 후 잠시 대기
      const timer = setTimeout(() => {
        tabChangeRef.current = false
      }, 500)

      return () => clearTimeout(timer)
    }
  }, [activeTab])

  // 탭 변경 핸들러
  const handleTabChange = useCallback(
    (newTab: string) => {
      if (newTab !== activeTab) {
        tabChangeRef.current = true
        setActiveTab(newTab)

        // 큐 탭으로 변경 시 플레이어 상태 확인
        if (newTab === "queue" && !isPlayerReady && currentVideoId) {
          console.log("큐 탭 활성화 - 플레이어 상태 확인 중...")
        }
      }
    },
    [activeTab, isPlayerReady, currentVideoId],
  )

  // 변경사항 감지
  useEffect(() => {
    if (isProjectCreated) {
      // 프로젝트가 생성된 후에만 변경사항 추적
    }
  }, [segments, queue, projectName, projectDescription, isProjectCreated])

  // 자동 저장
  useEffect(() => {
    if (autoSaveEnabled && hasUnsavedChanges && session?.access_token && currentProjectId) {
      if (autoSaveRef.current) {
        clearTimeout(autoSaveRef.current)
      }

      autoSaveRef.current = setTimeout(() => {
        saveProject(true)
      }, autoSaveInterval * 1000)
    }

    return () => {
      if (autoSaveRef.current) {
        clearTimeout(autoSaveRef.current)
      }
    }
  }, [autoSaveEnabled, hasUnsavedChanges, autoSaveInterval, session, currentProjectId, saveProject])

  // 스크롤 감지
  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 300)
    }

    window.addEventListener("scroll", handleScroll)
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  // 프로젝트 초기화
  useEffect(() => {
    if (loading) return

    const projectId = searchParams.get("id")
    if (projectId) {
      handleLoadProject(projectId)
    } else {
      handleCreateNewProject()
    }
  }, [searchParams, loading])

  // URL 자동 로드 - 중복 방지 로직 강화 및 자동재생 방지
  const handleVideoUrlChange = useCallback(
    (url: string) => {
      setVideoUrl(url)

      // URL이 비어있거나 같은 URL이면 처리하지 않음
      if (!url || url === lastProcessedUrlRef.current || isLoadingVideoRef.current) {
        return
      }

      // 유효한 YouTube URL인지 확인
      if (isValidYouTubeUrl(url)) {
        const videoId = extractVideoId(url)
        if (videoId && videoId !== currentVideoId && !tabChangeRef.current) {
          console.log("새 비디오 로드:", videoId)
          lastProcessedUrlRef.current = url
          isLoadingVideoRef.current = true
          
          // 플레이어 컨텍스트에 새 비디오 정보 즉시 업데이트 (제목은 로드 후 설정)
          setCurrentVideo({
            id: videoId,
            title: "로딩 중...",
            url: url
          })
          
          // 자동재생 방지: autoplay를 false로 설정
          loadVideo(videoId, 0, false)
        }
      } else {
        // 유효하지 않은 URL인 경우 현재 비디오 정보 초기화
        setCurrentVideo(null)
      }
    },
    [currentVideoId, loadVideo, setCurrentVideo],
  )

  // 검색 제안
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

  useEffect(() => {
    if (showSearchDialog && searchQuery) {
      debouncedGetSuggestions(searchQuery)
    }
  }, [searchQuery, showSearchDialog, debouncedGetSuggestions])

  // 큐 재생 모니터링 - 의도적인 큐 재생일 때만
  useEffect(() => {
    // 큐 재생이 활성화되고, 큐에 아이템이 있고, 플레이어가 준비되었고, 탭 변경 중이 아닐 때만 모니터링
    if (isQueuePlayActive && isPlaying && queue.length > 0 && isPlayerReady && !tabChangeRef.current && currentQueueIndex < queue.length) {
      const currentItem = queue[currentQueueIndex]

      // 현재 아이템이 구간이고, 구간 데이터가 있을 때만 모니터링
      if (currentItem?.type === "segment" && currentItem.segment) {
        intervalRef.current = setInterval(() => {
          try {
            const currentTime = getCurrentTime()
            const fadeOutDuration = 3
            
            // 플레이어 컨텍스트 시간 업데이트
            setCurrentTime(currentTime)

            // 현재 시간이 구간 종료 시간에 도달했을 때만 다음으로 이동
            if (currentItem.segment && currentTime >= currentItem.segment.endTime - fadeOutDuration && currentTime > 0) {
              fadeOutAndNext()
              if (intervalRef.current) {
                clearInterval(intervalRef.current)
                intervalRef.current = null
              }
            }
          } catch (error) {
            console.error("큐 모니터링 오류:", error)
            if (intervalRef.current) {
              clearInterval(intervalRef.current)
              intervalRef.current = null
            }
          }
        }, 1000)
      }
    } else {
      // 조건에 맞지 않으면 인터벌 정리
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
  }, [isQueuePlayActive, isPlaying, currentQueueIndex, queue, isPlayerReady, getCurrentTime])

  // API 오류 처리
  useEffect(() => {
    if (apiError) {
      toast({
        title: "YouTube API 오류",
        description: apiError,
        variant: "destructive",
      })
    }
  }, [apiError])

  // 컴포넌트 언마운트 시 정리
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
      if (autoSaveRef.current) {
        clearTimeout(autoSaveRef.current)
      }
    }
  }, [])

  // 접근 권한 확인
  const checkAccess = (project: any) => {
    if (!project) return false

    if (project.visibility === "public" || project.visibility === "link_only") {
      return true
    }

    if (project.visibility === "private") {
      if (!user) {
        setAccessError("이 프로젝트는 비공개 프로젝트입니다. 로그인이 필요합니다.")
        return false
      }

      if (user.id !== project.owner_id) {
        setAccessError("이 프로젝트는 비공개 프로젝트입니다. 소유자만 접근할 수 있습니다.")
        return false
      }
    }

    return true
  }

  // 프로젝트 생성
  const handleCreateNewProject = async () => {
    const projectId = await createNewProject()
    if (projectId) {
      router.push(`?id=${projectId}`, { scroll: false })
    }
  }

  // 프로젝트 로드
  const handleLoadProject = async (projectId: string) => {
    setIsLoading(true)
    try {
      const project = await loadProject(projectId)
      if (project) {
        if (!checkAccess(project)) {
          setHasAccess(false)
          return
        }

        setHasAccess(true)
        setAccessError("")

        // 첫 번째 구간의 비디오 정보로 플레이어 설정
        if (project.segments && project.segments.length > 0) {
          const firstSegment = project.segments[0]
          const url = `https://www.youtube.com/watch?v=${firstSegment.videoId}`
          setVideoUrl(url)
          lastProcessedUrlRef.current = url
        }

        // 큐에 데이터가 있으면 큐 탭을 활성화
        if (project.queue && project.queue.length > 0) {
          handleTabChange("queue")
        }
      }
    } finally {
      setIsLoading(false)
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

  // YouTube 검색
  const searchYouTube = async (page = 1, append = false) => {
    if (!searchQuery.trim()) return

    setIsSearching(true)
    try {
      const response = await fetch(
        `/api/youtube/search?q=${encodeURIComponent(searchQuery)}&page=${page}&maxResults=20`,
      )
      const data = await response.json()

      if (data.success) {
        const results = data.data?.items || []
        if (append) {
          const existingIds = new Set(searchResults.map((v) => v.id))
          const newResults = results.filter((v: YouTubeVideo) => !existingIds.has(v.id))
          setSearchResults((prev) => [...prev, ...newResults])
        } else {
          setSearchResults(results)
        }
        setHasMoreResults(results.length === 20)

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

  // 무한 스크롤
  const handleScrollSearch = useCallback(() => {
    if (!searchResultsRef.current || isSearching || !hasMoreResults) return

    const { scrollTop, scrollHeight, clientHeight } = searchResultsRef.current
    if (scrollTop + clientHeight >= scrollHeight - 5) {
      const nextPage = searchPage + 1
      setSearchPage(nextPage)
      searchYouTube(nextPage, true)
    }
  }, [searchPage, isSearching, hasMoreResults, searchQuery])

  // 영상 선택
  const selectVideo = (video: YouTubeVideo) => {
    if (currentVideoId && currentVideoId !== video.id) {
      setPendingVideo(video)
      setShowVideoLoadConfirm(true)
      return
    }

    loadSelectedVideo(video)
  }

  const loadSelectedVideo = (video: YouTubeVideo) => {
    const url = `https://www.youtube.com/watch?v=${video.id}`
    setVideoUrl(url)
    
    // 강제로 새 영상을 로드하기 위해 ref를 리셋하고 handleVideoUrlChange 호출
    lastProcessedUrlRef.current = ""
    isLoadingVideoRef.current = false
    handleVideoUrlChange(url)
    
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

  const cancelVideoLoad = () => {
    setShowVideoLoadConfirm(false)
    setPendingVideo(null)
  }

  const confirmVideoLoad = () => {
    if (pendingVideo) {
      loadSelectedVideo(pendingVideo)
    }
  }

  // 구간 관련
  const handleAddSegment = (segment: Segment) => {
    addSegment(segment)
  }

  const handlePlaySegment = (segment: Segment) => {
    if (!tabChangeRef.current) {
      // 개별 구간 재생 시 큐 재생 모드 비활성화
      setIsQueuePlayActive(false)
      
      // 기존 인터벌 정리
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }

      loadVideo(segment.videoId, segment.startTime, true)
    }
  }

  const handleEditSegment = (segment: Segment) => {
    setEditingSegment(segment)
    setEditForm({
      title: segment.title,
      description: segment.description,
      startTime: secondsToTime(segment.startTime),
      endTime: secondsToTime(segment.endTime),
    })
  }

  const handleSaveEditSegment = () => {
    if (!editingSegment) return

    if (!editForm.title.trim()) {
      toast({
        title: "오류",
        description: "구간 제목을 입력해주세요.",
        variant: "destructive",
      })
      return
    }

    const validationError = validateTimeRange(editForm.startTime, editForm.endTime, videoDuration)
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

    updateSegment(editingSegment.id, updatedSegment)
    setEditingSegment(null)

    toast({
      title: "성공",
      description: "구간이 수정되었습니다.",
    })
  }

  const handleAddToQueue = (segment: Segment) => {
    const queueItem: QueueItem = {
      id: generateId(),
      type: "segment",
      segment,
      orderIndex: queue.length,
    }

    addToQueue(queueItem)
    handleTabChange("queue")

    toast({
      title: "큐에 추가됨",
      description: `"${segment.title}" 구간이 큐에 추가되었습니다.`,
    })
  }

  const handleAddSelectedToQueue = (selectedSegments: Segment[]) => {
    if (selectedSegments.length === 0) {
      toast({
        title: "선택된 구간 없음",
        description: "큐에 추가할 구간을 선택해주세요.",
        variant: "destructive",
      })
      return
    }

    const newQueueItems = selectedSegments.map((segment) => ({
      id: generateId(),
      type: "segment" as const,
      segment,
      orderIndex: queue.length + selectedSegments.indexOf(segment),
    }))

    newQueueItems.forEach((item) => addToQueue(item))
    handleTabChange("queue")

    toast({
      title: "큐에 추가됨",
      description: `${selectedSegments.length}개 구간이 큐에 추가되었습니다.`,
    })
  }

  // 큐 관련
  const handleAddDescriptionToQueue = () => {
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

    addToQueue(queueItem)
    setNewDescription("")
    handleTabChange("queue")

    toast({
      title: "설명 블럭 추가됨",
      description: "큐에 설명 블럭이 추가되었습니다.",
    })
  }

  // 재생목록에서 비디오들을 큐에 일괄 추가
  const handleImportPlaylistVideos = (videos: any[], playlistTitle: string) => {
    videos.forEach((video, index) => {
      const queueItem: QueueItem = {
        id: video.id,
        type: "description",
        description: video.description,
        orderIndex: queue.length + index,
      }
      addToQueue(queueItem)
    })
    
    handleTabChange("queue")

    toast({
      title: "재생목록 가져오기 완료",
      description: `"${playlistTitle}"에서 ${videos.length}개 영상을 큐에 추가했습니다.`,
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

    // 큐 재생 모드 활성화
    setIsQueuePlayActive(true)
    
    // 큐 재생 시작 시 인터벌 정리
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }

    setCurrentQueueIndex(0)
    const firstItem = queue[0]
    if (firstItem.type === "segment" && firstItem.segment) {
      // 큐 재생의 첫 번째 아이템이므로 handlePlaySegment를 사용하지 않고 직접 로드
      loadVideo(firstItem.segment.videoId, firstItem.segment.startTime, true)
    } else if (firstItem.type === "segment" && !firstItem.segment) {
      toast({
        title: "재생 불가",
        description: "이 구간에 대한 데이터를 찾을 수 없습니다. 다음 항목으로 넘어갑니다.",
        variant: "destructive",
      })
      playNextInQueue()
    } else {
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
        handlePlaySegment(nextItem.segment)
      } else if (nextItem.type === "segment" && !nextItem.segment) {
        toast({
          title: "재생 불가",
          description: "이 구간에 대한 데이터를 찾을 수 없습니다. 다음 항목으로 넘어갑니다.",
          variant: "destructive",
        })
        setTimeout(() => playNextInQueue(), 1000)
      } else {
        toast({
          title: "설명 표시",
          description: nextItem.description || "설명 블럭입니다.",
        })
        setTimeout(() => playNextInQueue(), 3000)
      }
    } else {
      // 큐 재생 완료 시 모드 비활성화
      setIsQueuePlayActive(false)
      setIsPlaying(false)
      
      // 프레젠테이션 모드에서만 완료 메시지 표시
      if (appMode === 'presentation') {
        toast({
          title: "완료",
          description: "모든 구간 재생이 완료되었습니다.",
        })
      }
    }
  }

  const playQueueItem = (index: number) => {
    const item = queue[index]
    if (item.type === "segment" && item.segment) {
      setCurrentQueueIndex(index)
      handlePlaySegment(item.segment)
    } else if (item.type === "segment" && !item.segment) {
      toast({
        title: "재생 불가",
        description: "이 구간에 대한 데이터를 찾을 수 없습니다.",
        variant: "destructive",
      })
    } else {
      toast({
        title: "설명 표시",
        description: item.description || "설명 블럭입니다.",
      })
    }
  }

  const fadeOutAndNext = () => {
    let volume = 100
    const fadeOut = setInterval(() => {
      volume -= 5
      if (volume <= 0) {
        clearInterval(fadeOut)
        setVolume(0)
        playNextInQueue()

        setTimeout(() => {
          let volume = 0
          const fadeIn = setInterval(() => {
            volume += 5
            if (volume >= 100) {
              clearInterval(fadeIn)
              setVolume(100)
            } else {
              setVolume(volume)
            }
          }, 150)
        }, 300)
      } else {
        setVolume(volume)
      }
    }, 150)
  }

  // 유틸리티
  const seekBy = (seconds: number) => {
    if (!tabChangeRef.current) {
      const currentTime = getCurrentTime()
      const newTime = Math.max(0, Math.min(videoDuration, currentTime + seconds))
      seekTo(newTime)
    }
  }

  const seekToTime = (seconds: number) => {
    if (!tabChangeRef.current) {
      const clampedTime = Math.max(0, Math.min(videoDuration, seconds))
      seekTo(clampedTime)
    }
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

  const startNewProject = () => {
    resetProject()
    router.push("/", { scroll: false })
    handleCreateNewProject()

    toast({
      title: "새 프로젝트",
      description: "새 프로젝트를 시작합니다.",
    })
  }

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

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

  // 로딩 중
  if (loading) {
    return (
      <div className="container mx-auto p-6 max-w-7xl">
        <div className="flex items-center justify-center h-96">
          <div className="flex items-center gap-3">
            <Loader2 className="w-6 h-6 animate-spin" />
            <span>로딩 중...</span>
          </div>
        </div>
      </div>
    )
  }

  // 접근 권한 없음
  if (!hasAccess) {
    return (
      <div className="container mx-auto p-6 max-w-4xl">
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="w-full max-w-md">
            <div className="text-center mb-4">
              <EyeOff className="w-12 h-12 mx-auto text-muted-foreground" />
            </div>
            <h1 className="text-xl font-semibold text-center mb-2">접근 제한</h1>
            <p className="text-muted-foreground text-center mb-4">{accessError}</p>
            <div className="text-center space-y-4">
              {!user ? (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">로그인하여 프로젝트에 접근하세요.</p>
                  <UserProfile />
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">이 프로젝트에 대한 접근 권한이 없습니다.</p>
              )}
              <Button onClick={() => router.push("/")} className="w-full" variant="outline">
                <Home className="w-4 h-4 mr-2" />
                메인 화면으로 돌아가기
              </Button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // 프로젝트 로딩 중
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

  const showEditingUI = appMode === 'edit'

  return (
    <div className="container mx-auto p-6 max-w-7xl pb-32">
      <div className="flex items-center justify-between mb-8">
        <div className="flex-1">
          <h1 className="text-3xl font-bold">Pi Que.</h1>
          {isAPILoading && <p className="text-sm text-muted-foreground mt-1">YouTube API 로딩 중...</p>}
          {isInitializing && <p className="text-sm text-amber-600 mt-1">플레이어 초기화 중...</p>}
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Button
              variant={appMode === 'edit' ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setAppMode('edit')
                if (isQueuePlayActive) {
                  setIsQueuePlayActive(false)
                  pauseVideo()
                }
              }}
            >
              <Edit2 className="w-4 h-4 mr-2" />
              편집
            </Button>
            <Button
              variant={appMode === 'presentation' ? "default" : "outline"}
              size="sm"
              onClick={() => setAppMode('presentation')}
            >
              <Presentation className="w-4 h-4 mr-2" />
              발표
            </Button>
          </div>
          <Button variant="ghost" size="icon" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
            {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </Button>
        </div>
      </div>

      {appMode === 'presentation' ? (
        // 발표 모드: 플레이어와 재생 큐만 표시
        <div className="grid gap-8 grid-cols-1 lg:grid-cols-2">
          <div className="space-y-6">
            <YouTubePlayer
              videoUrl={videoUrl}
              onVideoUrlChange={handleVideoUrlChange}
              onSearchClick={() => setShowSearchDialog(true)}
              onSeekBy={seekBy}
              onSeekTo={seekToTime}
              isMaximized={false}
              onToggleMaximize={() => {}}
              showControls={false}
              isPlayerReady={isPlayerReady}
              isInitializing={isInitializing}
            />
          </div>
          
          <div className="space-y-6">
            {/* 재생 큐만 표시 */}
            <div className="bg-card rounded-lg border h-[800px]">
              <div className="p-6 border-b">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold">재생 큐</h3>
                    <p className="text-sm text-muted-foreground">
                      총 {queue.length}개 항목
                      {queue.length > 0 && (
                        <span className="ml-2">
                          (현재: {currentQueueIndex + 1} / {queue.length})
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <PlaylistImport onImportVideos={handleImportPlaylistVideos} />
                    <Button size="sm" onClick={playQueue} disabled={queue.length === 0 || isInitializing}>
                      <Play className="w-4 h-4 mr-2" />큐 재생
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={playNextInQueue}
                      disabled={queue.length === 0 || isInitializing}
                    >
                      <SkipForward className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
              <div className="p-6">
                <div className="space-y-3 overflow-y-auto max-h-[700px]">
                  {queue.map((item, index) => (
                    <div
                      key={item.id}
                      className={`border rounded-lg p-4 transition-all cursor-pointer ${
                        index === currentQueueIndex ? "bg-primary/10 border-primary shadow-md" : "hover:bg-muted/50"
                      }`}
                      onClick={() =>
                        item.type === "segment" && item.segment && !isInitializing && playQueueItem(index)
                      }
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
                            <div className="flex items-start gap-2">
                              <MessageSquare className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                              <div className="text-sm text-muted-foreground italic break-words">
                                {item.description}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                  {queue.length === 0 && (
                    <div className="text-center py-12 text-muted-foreground">
                      <MessageSquare className="w-12 h-12 mx-auto mb-4 opacity-30" />
                      <p>재생 큐가 비어있습니다.</p>
                      <p className="text-sm mt-1">편집 모드에서 구간을 추가해주세요.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        // 편집 모드: 기존 전체 UI
        <div className={`grid gap-8 ${isPlayerMaximized ? "grid-cols-[1fr_300px]" : "grid-cols-1 lg:grid-cols-2"}`}>
        {/* 왼쪽: 영상 플레이어 및 컨트롤 */}
        <div className="space-y-6">
          <YouTubePlayer
            videoUrl={videoUrl}
            onVideoUrlChange={handleVideoUrlChange}
            onSearchClick={() => setShowSearchDialog(true)}
            onSeekBy={seekBy}
            onSeekTo={seekToTime}
            isMaximized={isPlayerMaximized}
            onToggleMaximize={() => setIsPlayerMaximized(!isPlayerMaximized)}
            showControls={showEditingUI}
            isPlayerReady={isPlayerReady}
            isInitializing={isInitializing}
          />

          {!isPlayerMaximized && showEditingUI && (
            <>
              <SegmentForm
                currentVideoId={currentVideoId}
                videoTitle={videoTitle}
                videoDuration={videoDuration}
                onAddSegment={handleAddSegment}
                onGetCurrentTime={getCurrentTime}
                onSeekTo={seekTo}
                isExpanded={isSegmentFormExpanded}
                onToggleExpanded={() => setIsSegmentFormExpanded(!isSegmentFormExpanded)}
              />

              {/* 설명 블럭 추가 폼 */}
              <div className="bg-card rounded-lg border p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold">설명 블럭 추가</h3>
                    <p className="text-sm text-muted-foreground">큐에 설명이나 메모를 추가하세요</p>
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
                </div>
                {isDescriptionFormExpanded && (
                  <div className="space-y-4">
                    <textarea
                      placeholder="설명이나 메모를 입력하세요"
                      value={newDescription}
                      onChange={(e) => setNewDescription(e.target.value)}
                      rows={4}
                      className="w-full p-3 border rounded-md resize-none"
                    />
                    <Button onClick={handleAddDescriptionToQueue} className="w-full">
                      <MessageSquare className="w-4 h-4 mr-2" />
                      설명 블럭 추가
                    </Button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* 오른쪽: 구간 목록 및 재생 큐 */}
        <div className="space-y-6">
          <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
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
              <SegmentsTab
                segments={segments}
                onPlaySegment={handlePlaySegment}
                onEditSegment={handleEditSegment}
                onAddToQueue={handleAddToQueue}
                onRemoveSegment={removeSegment}
                onReorderSegments={reorderSegments}
                onAddSelectedToQueue={handleAddSelectedToQueue}
                isMaximized={isPlayerMaximized}
              />
            </TabsContent>

            <TabsContent value="queue" className="mt-6">
              {/* 큐 탭 내용 */}
              <div className={`bg-card rounded-lg border ${isPlayerMaximized ? "h-[calc(100vh-200px)]" : "h-[800px]"}`}>
                <div className="p-6 border-b">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-semibold">재생 큐</h3>
                      <p className="text-sm text-muted-foreground">
                        총 {queue.length}개 항목
                        {queue.length > 0 && (
                          <span className="ml-2">
                            (현재: {currentQueueIndex + 1} / {queue.length})
                          </span>
                        )}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <PlaylistImport onImportVideos={handleImportPlaylistVideos} />
                      <Button size="sm" onClick={playQueue} disabled={queue.length === 0 || isInitializing}>
                        <Play className="w-4 h-4 mr-2" />큐 재생
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={playNextInQueue}
                        disabled={queue.length === 0 || isInitializing}
                      >
                        <SkipForward className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
                <div className="p-6">
                  <div
                    className={`space-y-3 overflow-y-auto ${isPlayerMaximized ? "max-h-[calc(100vh-300px)]" : "max-h-[700px]"}`}
                  >
                    {queue.map((item, index) => (
                      <div
                        key={item.id}
                        className={`border rounded-lg p-4 transition-all cursor-pointer ${
                          index === currentQueueIndex ? "bg-primary/10 border-primary shadow-md" : "hover:bg-muted/50"
                        }`}
                        onClick={() =>
                          item.type === "segment" && item.segment && !isInitializing && playQueueItem(index)
                        }
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
                            <X className="w-4 h-4" />
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
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>
        </div>
      )}

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
                  {currentProjectId && session?.access_token && user?.id === projectOwnerId && (
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
              {/* 앱 모드 전환 버튼 */}
              <div className="flex items-center gap-1 ml-4 px-3 py-1 border rounded-md">
                <Button
                  size="sm"
                  variant={appMode === 'edit' ? 'default' : 'ghost'}
                  onClick={() => {
                    setAppMode('edit')
                    setIsQueuePlayActive(false) // 편집 모드로 전환 시 큐 재생 비활성화
                  }}
                  className="h-7 px-2"
                >
                  <Edit className="w-3 h-3 mr-1" />
                  편집
                </Button>
                <Button
                  size="sm"
                  variant={appMode === 'presentation' ? 'default' : 'ghost'}
                  onClick={() => setAppMode('presentation')}
                  className="h-7 px-2"
                >
                  <Play className="w-3 h-3 mr-1" />
                  발표
                </Button>
              </div>
              
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
              {lastSaveTime && (
                <Badge variant="outline" className="text-xs">
                  <Timer className="w-3 h-3 mr-1" />
                  {lastSaveTime.toLocaleTimeString()}
                </Badge>
              )}
            </div>

            <div className="flex items-center gap-3">
              {/* 자동 저장 설정 */}
              {session?.access_token && (
                <div className="flex items-center gap-2">
                  <Switch checked={autoSaveEnabled} onCheckedChange={setAutoSaveEnabled} id="auto-save" />
                  <Label htmlFor="auto-save" className="text-sm">
                    자동 저장 ({autoSaveInterval}초)
                  </Label>
                </div>
              )}

              <UserProfile />
              <Button onClick={startNewProject} variant="outline">
                새 프로젝트
              </Button>

              <Button onClick={() => saveProject(false)} disabled={isSaving || !hasUnsavedChanges} className="relative">
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

      {/* 모든 다이얼로그들 */}
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
              {searchResults && searchResults.length > 0 && searchResults.map((video) => (
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
              <textarea
                id="edit-description"
                value={editForm.description}
                onChange={(e) => setEditForm((prev) => ({ ...prev, description: e.target.value }))}
                rows={3}
                className="w-full p-3 border rounded-md resize-none"
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
              <Button onClick={handleSaveEditSegment}>
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
