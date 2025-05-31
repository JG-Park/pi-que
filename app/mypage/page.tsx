"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useAuth } from "@/contexts/auth-context"
import { formatDate } from "@/lib/utils"
import { FolderOpen, Play, Share2, Search, Filter, Eye, EyeOff, Loader2, ArrowLeft, Plus } from "lucide-react"
import { toast } from "@/hooks/use-toast"
import Link from "next/link"
import { useRouter } from "next/navigation"

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

export default function MyPage() {
  const { user, session, loading } = useAuth()
  const router = useRouter()
  const [projects, setProjects] = useState<Project[]>([])
  const [filteredProjects, setFilteredProjects] = useState<Project[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [visibilityFilter, setVisibilityFilter] = useState<string>("all")
  const [isCreatingProject, setIsCreatingProject] = useState(false)

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

  const getVisibilityIcon = (visibility: string) => {
    switch (visibility) {
      case "public":
        return <Eye className="w-4 h-4" />
      case "private":
        return <EyeOff className="w-4 h-4" />
      case "link_only":
        return <Link className="w-4 h-4" />
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
          </p>
        </div>
        <Button onClick={createNewProject} disabled={isCreatingProject}>
          {isCreatingProject ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}새
          프로젝트
        </Button>
      </div>

      {/* 검색 및 필터 */}
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
      </div>

      {/* 프로젝트 목록 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredProjects.map((project) => (
          <Card key={project.id} className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <CardTitle className="truncate">{project.title}</CardTitle>
                  {project.video_title && (
                    <CardDescription className="truncate mt-1">{project.video_title}</CardDescription>
                  )}
                </div>
                <Badge variant="secondary" className="ml-2 flex items-center gap-1">
                  {getVisibilityIcon(project.visibility)}
                  {getVisibilityLabel(project.visibility)}
                </Badge>
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
                  <Button variant="outline" size="sm" onClick={() => shareProject(project.id)}>
                    <Share2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

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
    </div>
  )
}
