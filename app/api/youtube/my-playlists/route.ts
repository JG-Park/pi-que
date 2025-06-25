import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    // Authorization 헤더에서 토큰 추출
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { success: false, error: 'Authorization token required' },
        { status: 401 }
      )
    }

    const accessToken = authHeader.substring(7) // "Bearer " 제거

    const { searchParams } = new URL(request.url)
    const maxResults = searchParams.get('maxResults') || '25'

    // Google OAuth 토큰을 사용하여 사용자의 재생목록 가져오기
    const playlistsResponse = await fetch(
      `https://www.googleapis.com/youtube/v3/playlists?part=snippet,contentDetails&mine=true&maxResults=${maxResults}`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json',
        },
      }
    )

    if (!playlistsResponse.ok) {
      const errorData = await playlistsResponse.text()
      console.error('YouTube API error:', errorData)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch user playlists' },
        { status: playlistsResponse.status }
      )
    }

    const playlistsData = await playlistsResponse.json()

    const playlists = playlistsData.items?.map((item: any) => ({
      id: item.id,
      title: item.snippet.title,
      description: item.snippet.description,
      thumbnail: item.snippet.thumbnails?.medium?.url || item.snippet.thumbnails?.default?.url,
      itemCount: item.contentDetails.itemCount,
      publishedAt: item.snippet.publishedAt,
      privacy: item.snippet.defaultLanguage ? 'public' : 'private'
    })) || []

    return NextResponse.json({
      success: true,
      playlists
    })

  } catch (error) {
    console.error('My playlists API error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch user playlists' },
      { status: 500 }
    )
  }
} 