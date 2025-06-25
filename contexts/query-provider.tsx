'use client'

import React, { useState } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'

interface QueryProviderProps {
  children: React.ReactNode
}

// QueryClient 설정
const createQueryClient = () => {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // 기본 설정
        staleTime: 1000 * 60 * 5, // 5분
        gcTime: 1000 * 60 * 30, // 30분 (구 cacheTime)
        refetchOnWindowFocus: false,
        refetchOnReconnect: true,
        retry: (failureCount, error) => {
          // 특정 에러에 대해서는 재시도하지 않음
          if (error instanceof Error) {
            // 401, 403 등 인증 에러는 재시도하지 않음
            if (error.message.includes('401') || error.message.includes('403')) {
              return false
            }
            // 404는 재시도하지 않음
            if (error.message.includes('404')) {
              return false
            }
          }
          
          // 최대 3번까지 재시도
          return failureCount < 3
        },
        retryDelay: (attemptIndex) => {
          // 지수적 백오프: 1초, 2초, 4초
          return Math.min(1000 * 2 ** attemptIndex, 30000)
        },
      },
      mutations: {
        // 뮤테이션 기본 설정
        retry: 1,
        retryDelay: 1000,
        onError: (error) => {
          console.error('Mutation error:', error)
          // 글로벌 에러 처리 로직 추가 가능
        },
      },
    },
  })
}

export function QueryProvider({ children }: QueryProviderProps) {
  // 클라이언트 사이드에서만 QueryClient 생성
  const [queryClient] = useState(() => createQueryClient())

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {/* 개발 환경에서만 DevTools 표시 */}
      {process.env.NODE_ENV === 'development' && (
        <ReactQueryDevtools 
          initialIsOpen={false}
          position="bottom-right"
          buttonPosition="bottom-right"
        />
      )}
    </QueryClientProvider>
  )
}

// QueryClient에 접근하기 위한 훅
export { useQueryClient } from '@tanstack/react-query'

// 유용한 QueryClient 유틸리티 함수들
export const queryUtils = {
  // 특정 키의 모든 쿼리 무효화
  invalidateQueries: (queryClient: QueryClient, queryKey: unknown[]) => {
    return queryClient.invalidateQueries({ queryKey })
  },
  
  // 특정 키의 데이터 설정
  setQueryData: <T,>(queryClient: QueryClient, queryKey: unknown[], data: T) => {
    queryClient.setQueryData(queryKey, data)
  },
  
  // 특정 키의 데이터 가져오기
  getQueryData: <T,>(queryClient: QueryClient, queryKey: unknown[]): T | undefined => {
    return queryClient.getQueryData<T>(queryKey)
  },
  
  // 모든 쿼리 제거
  clear: (queryClient: QueryClient) => {
    queryClient.clear()
  },
  
  // 캐시에서 특정 쿼리 제거
  removeQueries: (queryClient: QueryClient, queryKey: unknown[]) => {
    queryClient.removeQueries({ queryKey })
  },
  
  // 쿼리 프리페치
  prefetchQuery: <T,>(
    queryClient: QueryClient,
    queryKey: unknown[],
    queryFn: () => Promise<T>,
    options?: { staleTime?: number }
  ) => {
    return queryClient.prefetchQuery({
      queryKey,
      queryFn,
      staleTime: options?.staleTime,
    })
  },
  
  // 백그라운드에서 쿼리 실행
  fetchQuery: <T,>(
    queryClient: QueryClient,
    queryKey: unknown[],
    queryFn: () => Promise<T>
  ) => {
    return queryClient.fetchQuery({
      queryKey,
      queryFn,
    })
  },
}

// 자주 사용되는 쿼리 키 생성 함수들
export const queryKeys = {
  // 프로젝트 관련
  projects: ['projects'] as const,
  project: (id: string) => ['projects', id] as const,
  userProjects: (userId: string) => ['projects', 'user', userId] as const,
  
  // YouTube 관련
  youtubeSearch: (query: string, options?: Record<string, unknown>) => 
    ['youtube', 'search', query, options] as const,
  youtubeVideo: (videoId: string) => ['youtube', 'video', videoId] as const,
  
  // 사용자 관련
  user: (id: string) => ['user', id] as const,
  userProfile: (id: string) => ['user', id, 'profile'] as const,
  
  // 설정 관련
  settings: ['settings'] as const,
  userSettings: (userId: string) => ['settings', 'user', userId] as const,
} 