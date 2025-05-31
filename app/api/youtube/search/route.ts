import { type NextRequest, NextResponse } from "next/server"

interface YouTubeSearchResult {
  id: {
    videoId: string
  }
  snippet: {
    title: string
    description: string
    thumbnails: {
      medium: {
        url: string
      }
      high?: {
        url: string
      }
    }
    channelTitle: string
    publishedAt: string
  }
}

interface YouTubeVideoDetails {
  id: string
  contentDetails: {
    duration: string
  }
  statistics?: {
    viewCount: string
  }
  snippet?: {
    description: string
  }
}

// ISO 8601 duration을 사람이 읽기 쉬운 형태로 변환
function parseDuration(duration: string): string {
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/)
  if (!match) return "0:00"

  const hours = Number.parseInt(match[1] || "0")
  const minutes = Number.parseInt(match[2] || "0")
  const seconds = Number.parseInt(match[3] || "0")

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`
  }
  return `${minutes}:${seconds.toString().padStart(2, "0")}`
}

// 조회수 포맷팅
function formatViewCount(viewCount: string): string {
  const count = Number.parseInt(viewCount)
  if (count >= 1000000) {
    return `${(count / 1000000).toFixed(1)}M`
  } else if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}K`
  }
  return count.toString()
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const query = searchParams.get("q")
    const page = Number.parseInt(searchParams.get("page") || "1")
    const maxResults = Number.parseInt(searchParams.get("maxResults") || "10")

    if (!query) {
      return NextResponse.json({ success: false, error: "Query parameter is required" }, { status: 400 })
    }

    const apiKey = process.env.YOUTUBE_API_KEY
    if (!apiKey) {
      return NextResponse.json({ success: false, error: "YouTube API key not configured" }, { status: 500 })
    }

    // 페이지네이션을 위한 pageToken 계산 (간단한 구현)
    const startIndex = (page - 1) * maxResults

    // YouTube Data API로 검색
    const searchResponse = await fetch(
      `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&q=${encodeURIComponent(query)}&maxResults=${maxResults}&order=relevance&key=${apiKey}`,
    )

    if (!searchResponse.ok) {
      throw new Error(`YouTube API error: ${searchResponse.status}`)
    }

    const searchData = await searchResponse.json()
    const videoIds = searchData.items.map((item: YouTubeSearchResult) => item.id.videoId).join(",")

    // 비디오 상세 정보 (재생시간, 조회수, 설명 포함) 가져오기
    const detailsResponse = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?part=contentDetails,statistics,snippet&id=${videoIds}&key=${apiKey}`,
    )

    if (!detailsResponse.ok) {
      throw new Error(`YouTube API error: ${detailsResponse.status}`)
    }

    const detailsData = await detailsResponse.json()
    const videoDetails = new Map<string, YouTubeVideoDetails>()

    detailsData.items.forEach((item: YouTubeVideoDetails) => {
      videoDetails.set(item.id, item)
    })

    // 결과 포맷팅
    const results = searchData.items.map((item: YouTubeSearchResult) => {
      const details = videoDetails.get(item.id.videoId)
      return {
        id: item.id.videoId,
        title: item.snippet.title,
        thumbnail: item.snippet.thumbnails.high?.url || item.snippet.thumbnails.medium.url,
        duration: details ? parseDuration(details.contentDetails.duration) : "알 수 없음",
        channelTitle: item.snippet.channelTitle,
        publishedAt: item.snippet.publishedAt,
        description: item.snippet.description.substring(0, 150) + (item.snippet.description.length > 150 ? "..." : ""),
        viewCount: details?.statistics?.viewCount ? formatViewCount(details.statistics.viewCount) : undefined,
      }
    })

    return NextResponse.json({
      success: true,
      results,
      page,
      hasMore: results.length === maxResults,
    })
  } catch (error) {
    console.error("YouTube search error:", error)

    // API 오류 시 fallback으로 mock 데이터 사용
    const mockResults = [
      {
        id: "dQw4w9WgXcQ",
        title: "Rick Astley - Never Gonna Give You Up (Official Video)",
        thumbnail: "https://i.ytimg.com/vi/dQw4w9WgXcQ/mqdefault.jpg",
        duration: "3:33",
        channelTitle: "Rick Astley",
        publishedAt: "2009-10-25T06:57:33Z",
        description: "The official video for Rick Astley's 'Never Gonna Give You Up'...",
        viewCount: "1.4B",
      },
      {
        id: "kJQP7kiw5Fk",
        title: "Despacito",
        thumbnail: "https://i.ytimg.com/vi/kJQP7kiw5Fk/mqdefault.jpg",
        duration: "4:42",
        channelTitle: "Luis Fonsi",
        publishedAt: "2017-01-12T19:30:00Z",
        description: "Despacito by Luis Fonsi featuring Daddy Yankee...",
        viewCount: "8.2B",
      },
    ]

    const query = new URL(request.url).searchParams.get("q")?.toLowerCase() || ""
    const filteredResults = mockResults.filter(
      (video) => video.title.toLowerCase().includes(query) || video.channelTitle.toLowerCase().includes(query),
    )

    return NextResponse.json({
      success: true,
      results: filteredResults,
      fallback: true, // API 오류로 인한 fallback임을 표시
      page: 1,
      hasMore: false,
    })
  }
}
