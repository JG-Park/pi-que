import { useState } from 'react'
import { useAuth } from '@/contexts/auth-context'

export interface PlaylistVideo {
  id: string
  title: string
  description: string
  thumbnail: string
  url: string
  publishedAt: string
  position: number
}

export interface PlaylistInfo {
  id: string
  title: string
  description: string
  thumbnail: string
  itemCount: number
  publishedAt: string
}

export interface UserPlaylist {
  id: string
  title: string
  description: string
  thumbnail: string
  itemCount: number
  publishedAt: string
  privacy: string
}

export function usePlaylist() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { session } = useAuth()

  // URL에서 재생목록 ID 추출
  const extractPlaylistId = (url: string): string | null => {
    try {
      const urlObj = new URL(url)
      
      // YouTube 재생목록 URL 패턴들
      if (urlObj.hostname === 'www.youtube.com' || urlObj.hostname === 'youtube.com') {
        return urlObj.searchParams.get('list')
      }
      
      // 직접 재생목록 ID인 경우
      if (url.match(/^[A-Za-z0-9_-]+$/)) {
        return url
      }
      
      return null
    } catch {
      return null
    }
  }

  // 공개 재생목록 정보 및 비디오 목록 가져오기
  const fetchPlaylist = async (playlistUrl: string, maxResults = 50): Promise<{ playlist: PlaylistInfo; videos: PlaylistVideo[] } | null> => {
    setLoading(true)
    setError(null)

    try {
      const playlistId = extractPlaylistId(playlistUrl)
      if (!playlistId) {
        throw new Error('유효하지 않은 재생목록 URL입니다.')
      }

      const response = await fetch(
        `/api/youtube/playlist?id=${playlistId}&maxResults=${maxResults}`
      )

      const data = await response.json()

      if (!data.success) {
        throw new Error(data.error || '재생목록을 가져오는데 실패했습니다.')
      }

      return {
        playlist: data.playlist,
        videos: data.videos
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.'
      setError(errorMessage)
      return null
    } finally {
      setLoading(false)
    }
  }

  // 사용자의 개인 재생목록 목록 가져오기
  const fetchMyPlaylists = async (maxResults = 25): Promise<UserPlaylist[]> => {
    setLoading(true)
    setError(null)

    try {
      if (!session?.access_token) {
        throw new Error('Google 로그인이 필요합니다.')
      }

      const response = await fetch(
        `/api/youtube/my-playlists?maxResults=${maxResults}`,
        {
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
        }
      )

      const data = await response.json()

      if (!data.success) {
        throw new Error(data.error || '개인 재생목록을 가져오는데 실패했습니다.')
      }

      return data.playlists
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.'
      setError(errorMessage)
      return []
    } finally {
      setLoading(false)
    }
  }

  // 재생목록의 비디오들을 큐에 일괄 추가할 수 있는 포맷으로 변환
  const prepareVideosForQueue = (videos: PlaylistVideo[]) => {
    return videos.map((video, index) => ({
      id: `playlist-${video.id}-${index}`,
      type: 'description' as const,
      description: `${video.title}\n${video.description}`,
      videoUrl: video.url,
      videoId: video.id,
      thumbnail: video.thumbnail,
      position: video.position
    }))
  }

  return {
    loading,
    error,
    extractPlaylistId,
    fetchPlaylist,
    fetchMyPlaylists,
    prepareVideosForQueue,
    clearError: () => setError(null)
  }
} 