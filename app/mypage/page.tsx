"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useAuth } from "@/contexts/auth-context"
import { formatDate } from "@/lib/utils"
import { FolderOpen, Play, Share2, Search, Filter, Eye, EyeOff, Loader2, ArrowLeft, Plus, Grid3X3, List, Trash2, MoreHorizontal, CheckCircle2, Circle } from "lucide-react"
import { toast } from "@/hooks/use-toast"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Checkbox } from "@/components/ui/checkbox"
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
  DropdownMenuSeparator 
} from "@/components/ui/dropdown-menu"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

interface Project {
  id: string
  title: string
  description?: string
  video_title?: string
  video_duration: number
  visibility: "public" | "private" | "link_only"
  created_at: string
  updated_at: string
}

type ViewMode = "grid" | "list"

export default function MyPage() {
  const { user, session, loading } = useAuth()
  const router = useRouter()
  const [projects, setProjects] = useState<Project[]>([])
  const [filteredProjects, setFilteredProjects] = useState<Project[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [visibilityFilter, setVisibilityFilter] = useState<string>("all")
  const [isCreatingProject, setIsCreatingProject] = useState(false)
  const [viewMode, setViewMode] = useState<ViewMode>("grid")
  
  // 일괄 선택 관련 상태
  const [selectedProjects, setSelectedProjects] = useState<Set<string>>(new Set())
  const [isSelectMode, setIsSelectMode] = useState(false)
  
  // 일괄 작업 관련 상태
  const [isBulkUpdating, setIsBulkUpdating] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [projectToDelete, setProjectToDelete] = useState<string | null>(null)

  useEffect(() => {
    if (!loading && !user) {
      router.push("/")
      return
    }

    if (user && session) {
      fetchProjects()
    }
  }, [user, session, loading, router])

  useEffect(() => {
    filterProjects()
  }, [projects, searchQuery, visibilityFilter])

  const fetchProjects = async () => {
    if (!session?.access_token) {
      toast({
        title: "인증 오류",
        description: "로그인이 필요합니다.",
        variant: "destructive",
      })
      return
    }

    try {
      const response = await fetch("/api/user/projects", {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      })
      const data = await response.json()

      if (data.success) {
        setProjects(data.projects || [])
      } else {
        toast({
          title: "오류",
          description: data.error || "프로젝트 목록을 불러오는데 실패했습니다.",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("프로젝트 목록 조회 오류:", error)
      toast({
        title: "오류",
        description: "네트워크 오류가 발생했습니다.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const createNewProject = async () => {
    if (!session?.access_token) {
      toast({
        title: "인증 오류",
        description: "로그인이 필요합니다.",
        variant: "destructive",
      })
      return
    }

    setIsCreatingProject(true)
    try {
      const projectData = {
        title: "새 프로젝트",
        videoUrl: "",
        videoId: "",
        videoTitle: "",
        videoDuration: 0,
        segments: [],
        queue: [],
      }

      const response = await fetch("/api/projects", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(projectData),
      })

      const data = await response.json()

      if (data.success) {
        toast({
          title: "프로젝트 생성됨",
          description: "새 프로젝트가 생성되었습니다.",
        })
        // 새 프로젝트로 이동
        router.push(`/?id=${data.projectId}`)
      } else {
        throw new Error(data.error || data.details)
      }
    } catch (error) {
      console.error("프로젝트 생성 오류:", error)
      toast({
        title: "생성 실패",
        description: error instanceof Error ? error.message : "프로젝트를 생성하는 중 오류가 발생했습니다.",
        variant: "destructive",
      })
    } finally {
      setIsCreatingProject(false)
    }
  }

  const filterProjects = () => {
    let filtered = projects

    // 검색 필터
    if (searchQuery) {
      filtered = filtered.filter(
        (project) =>
          project.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          project.video_title?.toLowerCase().includes(searchQuery.toLowerCase()),
      )
    }

    // 공개범위 필터
    if (visibilityFilter !== "all") {
      filtered = filtered.filter((project) => project.visibility === visibilityFilter)
    }

    setFilteredProjects(filtered)
  }

  // 선택 모드 토글
  const toggleSelectMode = () => {
    setIsSelectMode(!isSelectMode)
    setSelectedProjects(new Set())
  }

  // 전체 선택/해제
  const toggleSelectAll = () => {
    if (selectedProjects.size === filteredProjects.length) {
      setSelectedProjects(new Set())
    } else {
      setSelectedProjects(new Set(filteredProjects.map(p => p.id)))
    }
  }

  // 개별 프로젝트 선택
  const toggleSelectProject = (projectId: string) => {
    const newSelected = new Set(selectedProjects)
    if (newSelected.has(projectId)) {
      newSelected.delete(projectId)
    } else {
      newSelected.add(projectId)
    }
    setSelectedProjects(newSelected)
  }

  // 일괄 공개상태 변경
  const bulkUpdateVisibility = async (visibility: "public" | "private" | "link_only") => {
    if (selectedProjects.size === 0 || !session?.access_token) return

    setIsBulkUpdating(true)
    const promises = Array.from(selectedProjects).map(async (projectId) => {
      const response = await fetch(`/api/projects/${projectId}/visibility`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ visibility }),
      })
      return response.json()
    })

    try {
      await Promise.all(promises)
      toast({
        title: "공개상태 변경 완료",
        description: `${selectedProjects.size}개 프로젝트의 공개상태가 변경되었습니다.`,
      })
      setSelectedProjects(new Set())
      fetchProjects()
    } catch (error) {
      toast({
        title: "오류",
        description: "일부 프로젝트의 공개상태 변경에 실패했습니다.",
        variant: "destructive",
      })
    } finally {
      setIsBulkUpdating(false)
    }
  }

  // 일괄 삭제
  const bulkDeleteProjects = async () => {
    if (selectedProjects.size === 0 || !session?.access_token) return

    setIsBulkUpdating(true)
    const promises = Array.from(selectedProjects).map(async (projectId) => {
      const response = await fetch(`/api/projects/${projectId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      })
      return response.json()
    })

    try {
      await Promise.all(promises)
      toast({
        title: "삭제 완료",
        description: `${selectedProjects.size}개 프로젝트가 삭제되었습니다.`,
      })
      setSelectedProjects(new Set())
      setShowDeleteDialog(false)
      fetchProjects()
    } catch (error) {
      toast({
        title: "오류",
        description: "일부 프로젝트 삭제에 실패했습니다.",
        variant: "destructive",
      })
    } finally {
      setIsBulkUpdating(false)
    }
  }

  // 개별 프로젝트 삭제
  const deleteProject = async (projectId: string) => {
    if (!session?.access_token) return

    try {
      const response = await fetch(`/api/projects/${projectId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      })

      const data = await response.json()

      if (data.success) {
        toast({
          title: "삭제 완료",
          description: "프로젝트가 삭제되었습니다.",
        })
        fetchProjects()
      } else {
        throw new Error(data.error || "삭제에 실패했습니다.")
      }
    } catch (error) {
      toast({
        title: "삭제 실패",
        description: error instanceof Error ? error.message : "프로젝트 삭제 중 오류가 발생했습니다.",
        variant: "destructive",
      })
    } finally {
      setProjectToDelete(null)
      setShowDeleteDialog(false)
    }
  }

  const getVisibilityIcon = (visibility: string) => {
    switch (visibility) {
      case "public":
        return <Eye className="w-4 h-4" />
      case "private":
        return <EyeOff className="w-4 h-4" />
      case "link_only":
        return <Share2 className="w-4 h-4" />
      default:
        return <Eye className="w-4 h-4" />
    }
  }

  const getVisibilityLabel = (visibility: string) => {
    switch (visibility) {
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

  const shareProject = async (projectId: string) => {
    const shareUrl = `${window.location.origin}?id=${projectId}`

    try {
      await navigator.clipboard.writeText(shareUrl)
      toast({
        title: "링크 복사 완료",
        description: "프로젝트 링크가 클립보드에 복사되었습니다.",
      })
    } catch (error) {
      toast({
        title: "링크 생성됨",
        description: shareUrl,
      })
    }
  }

  if (loading || isLoading) {
    return (
      <div className="container mx-auto p-6 max-w-6xl">
        <div className="flex items-center justify-center h-96">
          <div className="flex items-center gap-3">
            <Loader2 className="w-6 h-6 animate-spin" />
            <span>프로젝트를 불러오는 중...</span>
          </div>
        </div>
      </div>
    )
  }

  if (!user) {
    return null
  }

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <Link href="/">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="w-4 h-4" />
              </Button>
            </Link>
            <h1 className="text-3xl font-bold">내 프로젝트</h1>
          </div>
          <p className="text-muted-foreground">
            총 {projects.length}개의 프로젝트 • {filteredProjects.length}개 표시 중
            {selectedProjects.size > 0 && ` • ${selectedProjects.size}개 선택됨`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isSelectMode && selectedProjects.size > 0 && (
            <>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" disabled={isBulkUpdating}>
                    {isBulkUpdating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                    공개상태 변경
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onClick={() => bulkUpdateVisibility("public")}>
                    <Eye className="w-4 h-4 mr-2" />
                    공개로 변경
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => bulkUpdateVisibility("private")}>
                    <EyeOff className="w-4 h-4 mr-2" />
                    비공개로 변경
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => bulkUpdateVisibility("link_only")}>
                    <Share2 className="w-4 h-4 mr-2" />
                    링크 공유로 변경
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button
                variant="destructive"
                onClick={() => setShowDeleteDialog(true)}
                disabled={isBulkUpdating}
              >
                {isBulkUpdating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Trash2 className="w-4 h-4 mr-2" />}
                삭제
              </Button>
            </>
          )}
          <Button variant="outline" onClick={toggleSelectMode}>
            {isSelectMode ? "선택 완료" : "선택 모드"}
          </Button>
          <Button onClick={createNewProject} disabled={isCreatingProject}>
            {isCreatingProject ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
            새 프로젝트
          </Button>
        </div>
      </div>

      {/* 검색, 필터 및 뷰 모드 */}
      <div className="flex gap-4 mb-6">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="프로젝트 제목이나 영상 제목으로 검색..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={visibilityFilter} onValueChange={setVisibilityFilter}>
          <SelectTrigger className="w-40">
            <Filter className="w-4 h-4 mr-2" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">전체</SelectItem>
            <SelectItem value="public">공개</SelectItem>
            <SelectItem value="private">비공개</SelectItem>
            <SelectItem value="link_only">링크 공유</SelectItem>
          </SelectContent>
        </Select>
        {isSelectMode && (
          <Button variant="outline" onClick={toggleSelectAll}>
            {selectedProjects.size === filteredProjects.length ? (
              <>
                <CheckCircle2 className="w-4 h-4 mr-2" />
                전체 해제
              </>
            ) : (
              <>
                <Circle className="w-4 h-4 mr-2" />
                전체 선택
              </>
            )}
          </Button>
        )}
        <div className="flex border rounded-md">
          <Button
            variant={viewMode === "grid" ? "default" : "ghost"}
            size="sm"
            onClick={() => setViewMode("grid")}
          >
            <Grid3X3 className="w-4 h-4" />
          </Button>
          <Button
            variant={viewMode === "list" ? "default" : "ghost"}
            size="sm"
            onClick={() => setViewMode("list")}
          >
            <List className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* 프로젝트 목록 - 그리드 뷰 */}
      {viewMode === "grid" && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProjects.map((project) => (
            <Card key={project.id} className="hover:shadow-lg transition-shadow relative">
              {isSelectMode && (
                <div className="absolute top-3 left-3 z-10">
                  <Checkbox
                    checked={selectedProjects.has(project.id)}
                    onCheckedChange={() => toggleSelectProject(project.id)}
                  />
                </div>
              )}
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className={`flex-1 min-w-0 ${isSelectMode ? 'ml-8' : ''}`}>
                    <CardTitle className="truncate">{project.title}</CardTitle>
                    {project.video_title && (
                      <CardDescription className="truncate mt-1">{project.video_title}</CardDescription>
                    )}
                  </div>
                  <div className="flex items-center gap-2 ml-2">
                    <Badge variant="secondary" className="flex items-center gap-1">
                      {getVisibilityIcon(project.visibility)}
                      {getVisibilityLabel(project.visibility)}
                    </Badge>
                    {!isSelectMode && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => shareProject(project.id)}>
                            <Share2 className="w-4 h-4 mr-2" />
                            링크 복사
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem 
                            className="text-red-600"
                            onClick={() => {
                              setProjectToDelete(project.id)
                              setShowDeleteDialog(true)
                            }}
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            삭제
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="text-sm text-muted-foreground">
                    <p>생성: {formatDate(project.created_at)}</p>
                    <p>수정: {formatDate(project.updated_at)}</p>
                  </div>

                  <div className="flex gap-2">
                    <Link href={`/?id=${project.id}`} className="flex-1">
                      <Button className="w-full" size="sm">
                        <Play className="w-4 h-4 mr-2" />
                        열기
                      </Button>
                    </Link>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* 프로젝트 목록 - 리스트 뷰 */}
      {viewMode === "list" && (
        <div className="space-y-3">
          {filteredProjects.map((project) => (
            <Card key={project.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  {isSelectMode && (
                    <Checkbox
                      checked={selectedProjects.has(project.id)}
                      onCheckedChange={() => toggleSelectProject(project.id)}
                    />
                  )}
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1">
                      <h3 className="font-medium truncate">{project.title}</h3>
                      <Badge variant="secondary" className="flex items-center gap-1 text-xs">
                        {getVisibilityIcon(project.visibility)}
                        {getVisibilityLabel(project.visibility)}
                      </Badge>
                    </div>
                    {project.video_title && (
                      <p className="text-sm text-muted-foreground truncate">{project.video_title}</p>
                    )}
                    <div className="flex gap-4 text-xs text-muted-foreground mt-1">
                      <span>생성: {formatDate(project.created_at)}</span>
                      <span>수정: {formatDate(project.updated_at)}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Link href={`/?id=${project.id}`}>
                      <Button size="sm">
                        <Play className="w-4 h-4 mr-2" />
                        열기
                      </Button>
                    </Link>
                    {!isSelectMode && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" size="sm">
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => shareProject(project.id)}>
                            <Share2 className="w-4 h-4 mr-2" />
                            링크 복사
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem 
                            className="text-red-600"
                            onClick={() => {
                              setProjectToDelete(project.id)
                              setShowDeleteDialog(true)
                            }}
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            삭제
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {filteredProjects.length === 0 && (
        <div className="text-center py-12">
          <FolderOpen className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <h3 className="text-lg font-medium mb-2">
            {searchQuery || visibilityFilter !== "all" ? "검색 결과가 없습니다" : "아직 프로젝트가 없습니다"}
          </h3>
          <p className="text-muted-foreground mb-4">
            {searchQuery || visibilityFilter !== "all"
              ? "다른 검색어나 필터를 시도해보세요"
              : "첫 번째 프로젝트를 만들어보세요"}
          </p>
          <Button onClick={createNewProject} disabled={isCreatingProject}>
            {isCreatingProject ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
            새 프로젝트 만들기
          </Button>
        </div>
      )}

      {/* 삭제 확인 다이얼로그 */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>프로젝트 삭제</AlertDialogTitle>
            <AlertDialogDescription>
              {selectedProjects.size > 0 
                ? `선택한 ${selectedProjects.size}개의 프로젝트를 삭제하시겠습니까?`
                : "이 프로젝트를 삭제하시겠습니까?"
              }
              <br />
              이 작업은 되돌릴 수 없습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (selectedProjects.size > 0) {
                  bulkDeleteProjects()
                } else if (projectToDelete) {
                  deleteProject(projectToDelete)
                }
              }}
              className="bg-red-600 hover:bg-red-700"
            >
              삭제
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
