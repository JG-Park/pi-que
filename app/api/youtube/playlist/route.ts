import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const playlistId = searchParams.get('id')
  const maxResults = searchParams.get('maxResults') || '50'

  if (!playlistId) {
    return NextResponse.json(
      { success: false, error: 'Playlist ID is required' },
      { status: 400 }
    )
  }

  try {
    const apiKey = process.env.NEXT_PUBLIC_YOUTUBE_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: 'YouTube API key not configured' },
        { status: 500 }
      )
    }

    // 재생목록 기본 정보 가져오기
    const playlistResponse = await fetch(
      `https://www.googleapis.com/youtube/v3/playlists?part=snippet,contentDetails&id=${playlistId}&key=${apiKey}`
    )

    if (!playlistResponse.ok) {
      throw new Error('Failed to fetch playlist info')
    }

    const playlistData = await playlistResponse.json()
    
    if (!playlistData.items || playlistData.items.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Playlist not found or is private' },
        { status: 404 }
      )
    }

    const playlist = playlistData.items[0]

    // 재생목록의 비디오 목록 가져오기
    const videosResponse = await fetch(
      `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet,contentDetails&playlistId=${playlistId}&maxResults=${maxResults}&key=${apiKey}`
    )

    if (!videosResponse.ok) {
      throw new Error('Failed to fetch playlist videos')
    }

    const videosData = await videosResponse.json()

    const videos = videosData.items?.map((item: any) => ({
      id: item.contentDetails.videoId,
      title: item.snippet.title,
      description: item.snippet.description,
      thumbnail: item.snippet.thumbnails?.medium?.url || item.snippet.thumbnails?.default?.url,
      url: `https://www.youtube.com/watch?v=${item.contentDetails.videoId}`,
      publishedAt: item.snippet.publishedAt,
      position: item.snippet.position
    })) || []

    return NextResponse.json({
      success: true,
      playlist: {
        id: playlist.id,
        title: playlist.snippet.title,
        description: playlist.snippet.description,
        thumbnail: playlist.snippet.thumbnails?.medium?.url || playlist.snippet.thumbnails?.default?.url,
        itemCount: playlist.contentDetails.itemCount,
        publishedAt: playlist.snippet.publishedAt
      },
      videos
    })

  } catch (error) {
    console.error('YouTube playlist API error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch playlist data' },
      { status: 500 }
    )
  }
} 