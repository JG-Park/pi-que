"use client"

import { useState, useEffect, useRef } from "react"

declare global {
  interface Window {
    YT: any
    onYouTubeIframeAPIReady: () => void
  }
}

export function useYouTubeAPI() {
  const [isReady, setIsReady] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const initRef = useRef(false)

  useEffect(() => {
    // 클라이언트 사이드에서만 실행
    if (typeof window === "undefined") return

    // 이미 초기화되었으면 스킵
    if (initRef.current) return

    // 이미 API가 준비되어 있는지 확인
    if (window.YT && window.YT.Player) {
      setIsReady(true)
      return
    }

    // 이미 스크립트가 로드 중이거나 로드되었는지 확인
    const existingScript = document.querySelector('script[src*="youtube.com/iframe_api"]')
    if (existingScript) {
      // 스크립트는 있지만 API가 아직 준비되지 않은 경우
      setIsLoading(true)
      const checkReady = () => {
        if (window.YT && window.YT.Player) {
          setIsReady(true)
          setIsLoading(false)
        } else {
          setTimeout(checkReady, 100)
        }
      }
      checkReady()
      return
    }

    // 새로 스크립트 로드
    initRef.current = true
    setIsLoading(true)
    setError(null)

    const script = document.createElement("script")
    script.src = "https://www.youtube.com/iframe_api"
    script.async = true

    // 글로벌 콜백 설정 (기존 콜백 보존)
    const originalCallback = window.onYouTubeIframeAPIReady
    window.onYouTubeIframeAPIReady = () => {
      console.log("YouTube API 준비 완료")
      setIsReady(true)
      setIsLoading(false)
      setError(null)

      // 기존 콜백이 있으면 실행
      if (originalCallback && typeof originalCallback === "function") {
        originalCallback()
      }
    }

    script.onerror = () => {
      console.error("YouTube API 스크립트 로드 실패")
      setError("YouTube API 로드에 실패했습니다.")
      setIsLoading(false)
      initRef.current = false
    }

    document.head.appendChild(script)

    // 타임아웃 설정 (10초)
    const timeout = setTimeout(() => {
      if (!isReady) {
        setError("YouTube API 로드 시간 초과")
        setIsLoading(false)
        initRef.current = false
      }
    }, 10000)

    return () => {
      clearTimeout(timeout)
    }
  }, [isReady])

  return { isReady, isLoading, error }
}
