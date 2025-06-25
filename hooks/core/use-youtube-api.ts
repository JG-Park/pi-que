'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

// YouTube API 전역 타입 정의 (기존 타입 유지)
declare global {
  interface Window {
    YT: any
    onYouTubeIframeAPIReady: () => void
  }
}

export interface UseYouTubeAPIReturn {
  isReady: boolean
  isLoading: boolean
  error: string | null
  retryLoad: () => void
}

const API_SCRIPT_SRC = 'https://www.youtube.com/iframe_api'
const API_LOAD_TIMEOUT = 15000 // 15초

export function useYouTubeAPI(): UseYouTubeAPIReturn {
  const [isReady, setIsReady] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const initRef = useRef(false)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)

  const checkAPIReady = useCallback((): boolean => {
    return !!(window.YT && window.YT.Player && typeof window.YT.Player === 'function')
  }, [])

  const clearTimeout = useCallback(() => {
    if (timeoutRef.current) {
      globalThis.clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
  }, [])

  const loadAPI = useCallback(() => {
    // 클라이언트 사이드에서만 실행
    if (typeof window === 'undefined') return

    // 이미 초기화 중이면 스킵
    if (initRef.current) return

    // 이미 API가 준비되어 있는지 확인
    if (checkAPIReady()) {
      setIsReady(true)
      setIsLoading(false)
      setError(null)
      return
    }

    // 스크립트 로딩 상태 확인
    const existingScript = document.querySelector(`script[src="${API_SCRIPT_SRC}"]`)
    
    if (existingScript) {
      setIsLoading(true)
      // 기존 스크립트가 있으면 API 준비 상태 확인
      const checkReadyInterval = setInterval(() => {
        if (checkAPIReady()) {
          clearInterval(checkReadyInterval)
          setIsReady(true)
          setIsLoading(false)
          setError(null)
        }
      }, 100)

      // 타임아웃 설정
      timeoutRef.current = setTimeout(() => {
        clearInterval(checkReadyInterval)
        setError('YouTube API 로드 시간 초과')
        setIsLoading(false)
        initRef.current = false
      }, API_LOAD_TIMEOUT)

      return
    }

    // 새로운 스크립트 로드
    initRef.current = true
    setIsLoading(true)
    setError(null)

    const script = document.createElement('script')
    script.src = API_SCRIPT_SRC
    script.async = true

    // 기존 콜백 보존
    const originalCallback = window.onYouTubeIframeAPIReady

    // 글로벌 콜백 설정
    window.onYouTubeIframeAPIReady = () => {
      console.log('YouTube API 준비 완료')
      clearTimeout()
      setIsReady(true)
      setIsLoading(false)
      setError(null)

      // 기존 콜백 실행
      if (typeof originalCallback === 'function') {
        originalCallback()
      }
    }

    // 스크립트 로드 실패 처리
    script.onerror = () => {
      console.error('YouTube API 스크립트 로드 실패')
      clearTimeout()
      setError('YouTube API 스크립트를 로드할 수 없습니다.')
      setIsLoading(false)
      initRef.current = false
    }

    // 스크립트 로드 성공 처리
    script.onload = () => {
      console.log('YouTube API 스크립트 로드됨')
      // API가 준비될 때까지 대기
      timeoutRef.current = setTimeout(() => {
        if (!checkAPIReady()) {
          setError('YouTube API 초기화 시간 초과')
          setIsLoading(false)
          initRef.current = false
        }
      }, API_LOAD_TIMEOUT)
    }

    document.head.appendChild(script)
  }, [checkAPIReady, clearTimeout])

  const retryLoad = useCallback(() => {
    initRef.current = false
    setError(null)
    clearTimeout()
    loadAPI()
  }, [loadAPI, clearTimeout])

  useEffect(() => {
    loadAPI()

    return () => {
      clearTimeout()
    }
  }, [loadAPI, clearTimeout])

  return {
    isReady,
    isLoading,
    error,
    retryLoad
  }
} 