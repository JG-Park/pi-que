"use client"

import { useRef, useCallback, useState, useEffect } from "react"
import { toast } from "@/hooks/use-toast"

interface UseYouTubePlayerOptions {
  isAPIReady: boolean
  onVideoReady?: (duration: number, title: string) => void
  onStateChange?: (isPlaying: boolean) => void
  onProgress?: (currentTime: number) => void
}

export function useYouTubePlayer({ isAPIReady, onVideoReady, onStateChange, onProgress }: UseYouTubePlayerOptions) {
  const playerRef = useRef<any>(null)
  const [currentVideoId, setCurrentVideoId] = useState("")
  const [isPlayerReady, setIsPlayerReady] = useState(false)
  const [isInitializing, setIsInitializing] = useState(false)
  const containerCheckRef = useRef<NodeJS.Timeout | null>(null)
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null)

  // 플레이어 완전 제거
  const destroyPlayer = useCallback(() => {
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current)
      progressIntervalRef.current = null
    }
    if (playerRef.current) {
      try {
        if (typeof playerRef.current.destroy === "function") {
          playerRef.current.destroy()
        }
      } catch (error) {
        console.warn("플레이어 제거 중 오류 (무시됨):", error)
      }
      playerRef.current = null
    }
    setIsPlayerReady(false)
    setCurrentVideoId("")
    setIsInitializing(false)
  }, [])

  // DOM 컨테이너 확인 및 대기
  const waitForContainer = useCallback((containerId: string): Promise<HTMLElement> => {
    return new Promise((resolve, reject) => {
      const checkContainer = () => {
        const container = document.getElementById(containerId)
        if (container) {
          resolve(container)
        } else {
          // 최대 5초 대기
          const timeout = setTimeout(() => {
            reject(new Error(`컨테이너 '${containerId}'를 찾을 수 없습니다.`))
          }, 5000)

          // 100ms마다 확인
          const interval = setInterval(() => {
            const container = document.getElementById(containerId)
            if (container) {
              clearTimeout(timeout)
              clearInterval(interval)
              resolve(container)
            }
          }, 100)
        }
      }
      checkContainer()
    })
  }, [])

  // 플레이어 생성
  const createPlayer = useCallback(
    async (videoId: string, startTime = 0, autoplay = false) => {
      if (!isAPIReady || !window.YT || isInitializing) {
        console.warn("YouTube API가 준비되지 않았거나 이미 초기화 중입니다.")
        return false
      }

      setIsInitializing(true)

      try {
        // 기존 플레이어 제거
        destroyPlayer()

        // DOM 컨테이너 대기
        await waitForContainer("youtube-player")

        // 플레이어 생성
        playerRef.current = new window.YT.Player("youtube-player", {
          height: "315",
          width: "100%",
          videoId: videoId,
          playerVars: {
            playsinline: 1,
            controls: 1,
            autoplay: autoplay ? 1 : 0,
            start: startTime,
            enablejsapi: 1,
            origin: window.location.origin,
          },
          events: {
            onReady: (event: any) => {
              console.log("플레이어 준비 완료:", videoId)
              setIsPlayerReady(true)
              setCurrentVideoId(videoId)
              setIsInitializing(false)

              try {
                const duration = event.target.getDuration()
                const videoData = event.target.getVideoData()
                const title = videoData?.title || "제목 없음"
                const safeDuration = Math.max(0, duration - 1)

                onVideoReady?.(safeDuration, title)

                toast({
                  title: "영상 로드됨",
                  description: title,
                })
              } catch (error) {
                console.error("비디오 정보 가져오기 오류:", error)
              }
            },
            onStateChange: (event: any) => {
              try {
                const isPlaying = event.data === window.YT.PlayerState.PLAYING
                onStateChange?.(isPlaying)
                
                // 재생 중일 때 progress tracking 시작
                if (isPlaying && onProgress) {
                  if (progressIntervalRef.current) {
                    clearInterval(progressIntervalRef.current)
                  }
                  progressIntervalRef.current = setInterval(() => {
                    try {
                      if (playerRef.current && typeof playerRef.current.getCurrentTime === "function") {
                        const currentTime = playerRef.current.getCurrentTime()
                        onProgress(currentTime)
                      }
                    } catch (error) {
                      console.error("시간 추적 오류:", error)
                    }
                  }, 200) // 200ms마다 체크로 더 정확한 시간 추적
                } else {
                  // 재생이 중지되면 progress tracking 중지
                  if (progressIntervalRef.current) {
                    clearInterval(progressIntervalRef.current)
                    progressIntervalRef.current = null
                  }
                }
              } catch (error) {
                console.error("상태 변경 처리 오류:", error)
              }
            },
            onError: (event: any) => {
              console.error("YouTube 플레이어 오류:", event.data)
              setIsInitializing(false)

              let errorMessage = "영상을 로드할 수 없습니다."
              switch (event.data) {
                case 2:
                  errorMessage = "잘못된 비디오 ID입니다."
                  break
                case 5:
                  errorMessage = "HTML5 플레이어 오류가 발생했습니다."
                  break
                case 100:
                  errorMessage = "비디오를 찾을 수 없습니다."
                  break
                case 101:
                case 150:
                  errorMessage = "비디오 소유자가 임베드를 허용하지 않습니다."
                  break
              }

              toast({
                title: "영상 로드 실패",
                description: errorMessage,
                variant: "destructive",
              })
            },
          },
        })

        return true
      } catch (error) {
        console.error("플레이어 생성 오류:", error)
        setIsInitializing(false)
        toast({
          title: "플레이어 오류",
          description: error instanceof Error ? error.message : "플레이어를 생성할 수 없습니다.",
          variant: "destructive",
        })
        return false
      }
    },
    [isAPIReady, destroyPlayer, waitForContainer, onVideoReady, onStateChange, isInitializing],
  )

  // 비디오 로드
  const loadVideo = useCallback(
    async (videoId: string, startTime = 0, autoplay = false) => {
      if (!isAPIReady) {
        console.warn("YouTube API가 준비되지 않았습니다.")
        return
      }

      if (isInitializing) {
        console.warn("이미 플레이어 초기화 중입니다.")
        return
      }

      // 플레이어가 없거나 준비되지 않은 경우 새로 생성
      if (!playerRef.current || !isPlayerReady) {
        await createPlayer(videoId, startTime, autoplay)
        return
      }

      try {
        if (videoId === currentVideoId) {
          // 같은 영상이면 시간만 이동
          if (typeof playerRef.current.seekTo === "function") {
            playerRef.current.seekTo(startTime)
          }
          if (autoplay && typeof playerRef.current.playVideo === "function") {
            playerRef.current.playVideo()
          }
        } else {
          // 다른 영상이면 새로 로드
          if (typeof playerRef.current.loadVideoById === "function") {
            playerRef.current.loadVideoById({
              videoId: videoId,
              startSeconds: startTime,
            })
            setCurrentVideoId(videoId)
          } else {
            // loadVideoById가 없으면 새로 생성
            await createPlayer(videoId, startTime, autoplay)
          }
        }
      } catch (error) {
        console.error("비디오 로드 오류:", error)
        // 오류 시 새로 생성 시도
        await createPlayer(videoId, startTime, autoplay)
      }
    },
    [isAPIReady, currentVideoId, isPlayerReady, createPlayer, isInitializing],
  )

  // 안전한 플레이어 메서드 호출
  const safePlayerCall = useCallback(
    (methodName: string, ...args: any[]) => {
      if (playerRef.current && isPlayerReady && !isInitializing) {
        try {
          if (typeof playerRef.current[methodName] === "function") {
            return playerRef.current[methodName](...args)
          }
        } catch (error) {
          console.error(`플레이어 메서드 '${methodName}' 호출 오류:`, error)
        }
      }
      return null
    },
    [isPlayerReady, isInitializing],
  )

  const seekTo = useCallback(
    (seconds: number) => {
      safePlayerCall("seekTo", seconds)
    },
    [safePlayerCall],
  )

  const getCurrentTime = useCallback(() => {
    const time = safePlayerCall("getCurrentTime")
    const result = typeof time === "number" ? Math.floor(time) : 0
    // console.log('⏱️ [GET_TIME] 현재 시간 가져오기:', result, '(원본:', time, ')')
    return result
  }, [safePlayerCall])

  const playVideo = useCallback(() => {
    safePlayerCall("playVideo")
  }, [safePlayerCall])

  const pauseVideo = useCallback(() => {
    safePlayerCall("pauseVideo")
  }, [safePlayerCall])

  const setVolume = useCallback(
    (volume: number) => {
      safePlayerCall("setVolume", volume)
    },
    [safePlayerCall],
  )

  // 컴포넌트 언마운트 시 정리
  useEffect(() => {
    return () => {
      if (containerCheckRef.current) {
        clearTimeout(containerCheckRef.current)
      }
      destroyPlayer()
    }
  }, [destroyPlayer])

  // API 준비 상태 변경 시 기존 플레이어 정리
  useEffect(() => {
    if (!isAPIReady && playerRef.current) {
      destroyPlayer()
    }
  }, [isAPIReady, destroyPlayer])

  return {
    playerRef,
    currentVideoId,
    isPlayerReady: isPlayerReady && !isInitializing,
    isInitializing,
    loadVideo,
    seekTo,
    getCurrentTime,
    playVideo,
    pauseVideo,
    setVolume,
    destroyPlayer,
  }
}
