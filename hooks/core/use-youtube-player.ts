'use client'

import { useRef, useCallback, useState, useEffect } from 'react'
import { toast } from '@/hooks/use-toast'

// YouTube Player 인터페이스 정의
export interface YouTubePlayerOptions {
  isAPIReady: boolean
  onVideoReady?: (duration: number, title: string) => void
  onStateChange?: (isPlaying: boolean) => void
  onError?: (error: string) => void
}

export interface YouTubePlayerControls {
  currentVideoId: string
  isPlayerReady: boolean
  isInitializing: boolean
  loadVideo: (videoId: string, startTime?: number, autoplay?: boolean) => Promise<void>
  seekTo: (seconds: number) => void
  getCurrentTime: () => number
  playVideo: () => void
  pauseVideo: () => void
  setVolume: (volume: number) => void
  destroyPlayer: () => void
}

interface PlayerInstance {
  destroy: () => void
  loadVideoById: (videoId: string, startSeconds?: number) => void
  seekTo: (seconds: number, allowSeekAhead?: boolean) => void
  getCurrentTime: () => number
  playVideo: () => void
  pauseVideo: () => void
  setVolume: (volume: number) => void
  getDuration: () => number
  getVideoData: () => { title?: string }
}

const PLAYER_CONTAINER_ID = 'youtube-player'
const CONTAINER_WAIT_TIMEOUT = 5000
const CONTAINER_CHECK_INTERVAL = 100

export function useYouTubePlayer(options: YouTubePlayerOptions): YouTubePlayerControls {
  const { isAPIReady, onVideoReady, onStateChange, onError } = options
  
  const playerRef = useRef<PlayerInstance | null>(null)
  const [currentVideoId, setCurrentVideoId] = useState('')
  const [isPlayerReady, setIsPlayerReady] = useState(false)
  const [isInitializing, setIsInitializing] = useState(false)

  // 컨테이너 대기 함수
  const waitForContainer = useCallback((containerId: string): Promise<HTMLElement> => {
    return new Promise((resolve, reject) => {
      const container = document.getElementById(containerId)
      if (container) {
        resolve(container)
        return
      }

      let attempts = 0
      const maxAttempts = CONTAINER_WAIT_TIMEOUT / CONTAINER_CHECK_INTERVAL

      const checkContainer = () => {
        attempts++
        const container = document.getElementById(containerId)
        
        if (container) {
          resolve(container)
        } else if (attempts >= maxAttempts) {
          reject(new Error(`컨테이너 '${containerId}'를 찾을 수 없습니다.`))
        } else {
          setTimeout(checkContainer, CONTAINER_CHECK_INTERVAL)
        }
      }

      checkContainer()
    })
  }, [])

  // 플레이어 완전 제거
  const destroyPlayer = useCallback(() => {
    if (playerRef.current) {
      try {
        if (typeof playerRef.current.destroy === 'function') {
          playerRef.current.destroy()
        }
      } catch (error) {
        console.warn('플레이어 제거 중 오류 (무시됨):', error)
      }
      playerRef.current = null
    }
    setIsPlayerReady(false)
    setCurrentVideoId('')
    setIsInitializing(false)
  }, [])

  // 에러 메시지 생성
  const getErrorMessage = useCallback((errorCode: number): string => {
    switch (errorCode) {
      case 2:
        return '잘못된 비디오 ID입니다.'
      case 5:
        return 'HTML5 플레이어 오류가 발생했습니다.'
      case 100:
        return '비디오를 찾을 수 없습니다.'
      case 101:
      case 150:
        return '비디오 소유자가 임베드를 허용하지 않습니다.'
      default:
        return '영상을 로드할 수 없습니다.'
    }
  }, [])

  // 플레이어 생성
  const createPlayer = useCallback(
    async (videoId: string, startTime = 0, autoplay = false): Promise<boolean> => {
      if (!isAPIReady || !window.YT || isInitializing) {
        console.warn('YouTube API가 준비되지 않았거나 이미 초기화 중입니다.')
        return false
      }

      setIsInitializing(true)

      try {
        // 기존 플레이어 제거
        destroyPlayer()

        // DOM 컨테이너 대기
        await waitForContainer(PLAYER_CONTAINER_ID)

        // 플레이어 생성
        playerRef.current = new window.YT.Player(PLAYER_CONTAINER_ID, {
          height: '315',
          width: '100%',
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
              console.log('플레이어 준비 완료:', videoId)
              setIsPlayerReady(true)
              setCurrentVideoId(videoId)
              setIsInitializing(false)

              try {
                const duration = event.target.getDuration()
                const videoData = event.target.getVideoData()
                const title = videoData?.title || '제목 없음'
                const safeDuration = Math.max(0, duration - 1)

                onVideoReady?.(safeDuration, title)

                toast({
                  title: '영상 로드됨',
                  description: title,
                })
              } catch (error) {
                console.error('비디오 정보 가져오기 오류:', error)
                onError?.('비디오 정보를 가져올 수 없습니다.')
              }
            },
            onStateChange: (event: any) => {
              try {
                const isPlaying = event.data === window.YT.PlayerState.PLAYING
                onStateChange?.(isPlaying)
              } catch (error) {
                console.error('상태 변경 처리 오류:', error)
              }
            },
            onError: (event: any) => {
              const errorMessage = getErrorMessage(event.data)
              console.error('YouTube 플레이어 오류:', event.data, errorMessage)
              setIsInitializing(false)

              onError?.(errorMessage)

              toast({
                title: '영상 로드 실패',
                description: errorMessage,
                variant: 'destructive',
              })
            },
          },
        })

        return true
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : '플레이어를 생성할 수 없습니다.'
        console.error('플레이어 생성 오류:', error)
        setIsInitializing(false)
        
        onError?.(errorMessage)

        toast({
          title: '플레이어 오류',
          description: errorMessage,
          variant: 'destructive',
        })
        return false
      }
    },
    [isAPIReady, destroyPlayer, waitForContainer, onVideoReady, onStateChange, onError, getErrorMessage, isInitializing]
  )

  // 비디오 로드
  const loadVideo = useCallback(
    async (videoId: string, startTime = 0, autoplay = false): Promise<void> => {
      if (!isAPIReady) {
        console.warn('YouTube API가 준비되지 않았습니다.')
        return
      }

      if (isInitializing) {
        console.warn('이미 플레이어 초기화 중입니다.')
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
          if (typeof playerRef.current.seekTo === 'function') {
            playerRef.current.seekTo(startTime, true)
          }
          if (autoplay && typeof playerRef.current.playVideo === 'function') {
            playerRef.current.playVideo()
          }
        } else {
          // 다른 영상이면 새로 로드
          if (typeof playerRef.current.loadVideoById === 'function') {
            playerRef.current.loadVideoById(videoId, startTime)
            setCurrentVideoId(videoId)
          }
        }
      } catch (error) {
        console.error('비디오 로드 오류:', error)
        // 오류 발생 시 새로 생성 시도
        await createPlayer(videoId, startTime, autoplay)
      }
    },
    [isAPIReady, isPlayerReady, currentVideoId, createPlayer, isInitializing]
  )

  // 플레이어 컨트롤 함수들
  const seekTo = useCallback((seconds: number) => {
    if (playerRef.current && typeof playerRef.current.seekTo === 'function') {
      playerRef.current.seekTo(seconds, true)
    }
  }, [])

  const getCurrentTime = useCallback((): number => {
    if (playerRef.current && typeof playerRef.current.getCurrentTime === 'function') {
      return playerRef.current.getCurrentTime()
    }
    return 0
  }, [])

  const playVideo = useCallback(() => {
    if (playerRef.current && typeof playerRef.current.playVideo === 'function') {
      playerRef.current.playVideo()
    }
  }, [])

  const pauseVideo = useCallback(() => {
    if (playerRef.current && typeof playerRef.current.pauseVideo === 'function') {
      playerRef.current.pauseVideo()
    }
  }, [])

  const setVolume = useCallback((volume: number) => {
    if (playerRef.current && typeof playerRef.current.setVolume === 'function') {
      const clampedVolume = Math.max(0, Math.min(100, volume))
      playerRef.current.setVolume(clampedVolume)
    }
  }, [])

  // 정리 작업
  useEffect(() => {
    return () => {
      destroyPlayer()
    }
  }, [destroyPlayer])

  return {
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
  }
} 