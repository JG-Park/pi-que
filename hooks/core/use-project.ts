'use client'

import { useState, useCallback, useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import { useAuth } from '@/contexts/auth-context'
import { toast } from '@/hooks/use-toast'
import type { Project, Segment, QueueItem } from '@/types'

// API 요청 인터페이스
interface CreateProjectRequest {
  title?: string
  description?: string
  visibility?: 'public' | 'private' | 'link_only'
}

interface UpdateProjectRequest extends CreateProjectRequest {
  projectId: string
  segments?: Segment[]
  queue?: QueueItem[]
}

interface ProjectAPIResponse {
  success: boolean
  project?: Project
  projectId?: string
  error?: string
  details?: string
}

// 프로젝트 API 함수들
const projectAPI = {
  create: async (data: CreateProjectRequest, token: string): Promise<Project> => {
    const response = await axios.post<ProjectAPIResponse>('/api/projects', data, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    })

    if (!response.data.success) {
      throw new Error(response.data.error || '프로젝트 생성에 실패했습니다.')
    }

    return response.data.project!
  },

  update: async (data: UpdateProjectRequest, token: string): Promise<Project> => {
    const response = await axios.put<ProjectAPIResponse>('/api/projects', data, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    })

    if (!response.data.success) {
      throw new Error(response.data.error || '프로젝트 업데이트에 실패했습니다.')
    }

    return response.data.project!
  },

  fetch: async (projectId: string): Promise<Project> => {
    const response = await axios.get<ProjectAPIResponse>(`/api/projects/${projectId}`)

    if (!response.data.success) {
      throw new Error(response.data.error || '프로젝트를 불러올 수 없습니다.')
    }

    return response.data.project!
  },

  fetchUserProjects: async (token: string): Promise<Project[]> => {
    const response = await axios.get<{ success: boolean; projects: Project[] }>('/api/user/projects', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })

    if (!response.data.success) {
      throw new Error('사용자 프로젝트를 불러올 수 없습니다.')
    }

    return response.data.projects
  },
}

// 훅 반환 타입
export interface UseProjectReturn {
  // 현재 프로젝트 상태
  currentProject: Project | null
  hasUnsavedChanges: boolean
  isProjectCreated: boolean
  
  // 로딩 상태
  isLoading: boolean
  isSaving: boolean
  isLoadingProject: boolean
  
  // 에러 상태
  error: string | null
  
  // 프로젝트 관리 함수
  createNewProject: (data?: CreateProjectRequest) => Promise<Project | null>
  loadProject: (projectId: string) => Promise<Project | null>
  saveProject: (isAutoSave?: boolean) => Promise<boolean>
  resetProject: () => void
  
  // 프로젝트 속성 업데이트
  updateProjectInfo: (updates: Partial<Pick<Project, 'title' | 'description' | 'visibility'>>) => void
  updateSegments: (segments: Segment[]) => void
  updateQueue: (queue: QueueItem[]) => void
  
  // 유틸리티
  markUnsaved: () => void
  canSave: boolean
}

export function useProject(): UseProjectReturn {
  const { session, user } = useAuth()
  const queryClient = useQueryClient()
  
  // 로컬 상태
  const [currentProject, setCurrentProject] = useState<Project | null>(null)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [isProjectCreated, setIsProjectCreated] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // React Query - 프로젝트 생성
  const createProjectMutation = useMutation({
    mutationFn: (data: CreateProjectRequest) => {
      if (!session?.access_token) {
        throw new Error('로그인이 필요합니다.')
      }
      return projectAPI.create(data, session.access_token)
    },
    onSuccess: (project) => {
      setCurrentProject(project)
      setIsProjectCreated(true)
      setHasUnsavedChanges(false)
      setError(null)
      
      // 사용자 프로젝트 목록 무효화
      queryClient.invalidateQueries({ queryKey: ['userProjects'] })
      
      toast({
        title: '새 프로젝트 생성됨',
        description: `"${project.title}" 프로젝트가 생성되었습니다.`,
      })
    },
    onError: (error: Error) => {
      setError(error.message)
      console.error('프로젝트 생성 오류:', error)
      
      // 오프라인 모드로 fallback
      const fallbackProject: Project = {
        id: `temp-${Date.now()}`,
        title: '이름 없는 프로젝트(1)',
        description: '',
        visibility: 'public',
        owner_id: user?.id || 'anonymous',
        segments: [],
        queue: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
      
      setCurrentProject(fallbackProject)
      setIsProjectCreated(true)
      setHasUnsavedChanges(false)
    },
  })

  // React Query - 프로젝트 업데이트
  const updateProjectMutation = useMutation({
    mutationFn: (data: UpdateProjectRequest) => {
      if (!session?.access_token) {
        throw new Error('로그인이 필요합니다.')
      }
      return projectAPI.update(data, session.access_token)
    },
    onSuccess: (project) => {
      setCurrentProject(project)
      setHasUnsavedChanges(false)
      setError(null)
      
      // 캐시 업데이트
      queryClient.setQueryData(['project', project.id], project)
      queryClient.invalidateQueries({ queryKey: ['userProjects'] })
      
      toast({
        title: '저장 완료',
        description: '프로젝트가 성공적으로 저장되었습니다.',
      })
    },
    onError: (error: Error) => {
      setError(error.message)
      console.error('프로젝트 저장 오류:', error)
      
      toast({
        title: '저장 실패',
        description: error.message,
        variant: 'destructive',
      })
    },
  })

  // React Query - 프로젝트 로드
  const {
    data: loadedProject,
    isLoading: isLoadingProject,
    error: loadError,
  } = useQuery({
    queryKey: ['project', currentProject?.id],
    queryFn: () => projectAPI.fetch(currentProject!.id),
    enabled: !!currentProject?.id && !currentProject.id.startsWith('temp-'),
    retry: 2,
    staleTime: 5 * 60 * 1000, // 5분
  })

  // 로드된 프로젝트 동기화
  const syncLoadedProject = useCallback((project: Project) => {
    setCurrentProject(project)
    setIsProjectCreated(true)
    setHasUnsavedChanges(false)
    setError(null)
    
    toast({
      title: '프로젝트 로드됨',
      description: `"${project.title}" 프로젝트가 로드되었습니다.`,
    })
  }, [])

  // 프로젝트 관리 함수들
  const createNewProject = useCallback(
    async (data: CreateProjectRequest = {}): Promise<Project | null> => {
      try {
        setError(null)
        const project = await createProjectMutation.mutateAsync(data)
        return project
      } catch (error) {
        return currentProject // fallback 프로젝트 반환
      }
    },
    [createProjectMutation, currentProject]
  )

  const loadProject = useCallback(
    async (projectId: string): Promise<Project | null> => {
      try {
        setError(null)
        const project = await projectAPI.fetch(projectId)
        syncLoadedProject(project)
        return project
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : '프로젝트를 로드할 수 없습니다.'
        setError(errorMessage)
        
        toast({
          title: '오류',
          description: errorMessage,
          variant: 'destructive',
        })
        return null
      }
    },
    [syncLoadedProject]
  )

  const saveProject = useCallback(
    async (isAutoSave = false): Promise<boolean> => {
      if (!currentProject) {
        setError('저장할 프로젝트가 없습니다.')
        return false
      }

      if (!session?.access_token) {
        if (!isAutoSave) {
          toast({
            title: '로그인 필요',
            description: '프로젝트를 저장하려면 로그인이 필요합니다.',
            variant: 'destructive',
          })
        }
        return false
      }

      try {
        setError(null)
        
        const updateData: UpdateProjectRequest = {
          projectId: currentProject.id,
          title: currentProject.title,
          description: currentProject.description,
          visibility: currentProject.visibility,
          segments: currentProject.segments?.map((segment, index) => ({
            ...segment,
            orderIndex: index,
          })),
          queue: currentProject.queue?.map((item, index) => ({
            ...item,
            orderIndex: index,
          })),
        }

        if (currentProject.id.startsWith('temp-')) {
          // 임시 프로젝트면 새로 생성
          await createProjectMutation.mutateAsync({
            title: currentProject.title,
            description: currentProject.description,
            visibility: currentProject.visibility,
          })
        } else {
          // 기존 프로젝트 업데이트
          await updateProjectMutation.mutateAsync(updateData)
        }

        return true
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : '저장 중 오류가 발생했습니다.'
        setError(errorMessage)
        
        if (!isAutoSave) {
          toast({
            title: '저장 실패',
            description: errorMessage,
            variant: 'destructive',
          })
        }
        return false
      }
    },
    [currentProject, session, createProjectMutation, updateProjectMutation]
  )

  const resetProject = useCallback(() => {
    setCurrentProject(null)
    setHasUnsavedChanges(false)
    setIsProjectCreated(false)
    setError(null)
  }, [])

  // 프로젝트 속성 업데이트 함수들
  const updateProjectInfo = useCallback(
    (updates: Partial<Pick<Project, 'title' | 'description' | 'visibility'>>) => {
      if (!currentProject) return

      const updatedProject = { ...currentProject, ...updates }
      setCurrentProject(updatedProject)
      setHasUnsavedChanges(true)
    },
    [currentProject]
  )

  const updateSegments = useCallback(
    (segments: Segment[]) => {
      if (!currentProject) return

      const updatedProject = { ...currentProject, segments }
      setCurrentProject(updatedProject)
      setHasUnsavedChanges(true)
    },
    [currentProject]
  )

  const updateQueue = useCallback(
    (queue: QueueItem[]) => {
      if (!currentProject) return

      const updatedProject = { ...currentProject, queue }
      setCurrentProject(updatedProject)
      setHasUnsavedChanges(true)
    },
    [currentProject]
  )

  const markUnsaved = useCallback(() => {
    setHasUnsavedChanges(true)
  }, [])

  // 계산된 값들
  const canSave = useMemo(() => {
    return !!(currentProject && hasUnsavedChanges && session?.access_token)
  }, [currentProject, hasUnsavedChanges, session])

  const isLoading = useMemo(() => {
    return createProjectMutation.isPending || updateProjectMutation.isPending
  }, [createProjectMutation.isPending, updateProjectMutation.isPending])

  const isSaving = useMemo(() => {
    return updateProjectMutation.isPending
  }, [updateProjectMutation.isPending])

  return {
    // 상태
    currentProject,
    hasUnsavedChanges,
    isProjectCreated,
    isLoading,
    isSaving,
    isLoadingProject,
    error: error || (loadError instanceof Error ? loadError.message : null),
    
    // 함수
    createNewProject,
    loadProject,
    saveProject,
    resetProject,
    updateProjectInfo,
    updateSegments,
    updateQueue,
    markUnsaved,
    
    // 유틸리티
    canSave,
  }
} 