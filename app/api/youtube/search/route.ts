import { NextRequest, NextResponse } from 'next/server';

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
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('q') || 'test';
    
    // API 키가 없는 경우 mock 데이터 반환 (개발용)
    if (!process.env.NEXT_PUBLIC_YOUTUBE_API_KEY) {
      console.log('YouTube API key not configured, returning mock data for development');
      
      // Mock 검색 결과 데이터
      const mockResults = {
        items: [
          {
            id: 'dQw4w9WgXcQ',
            title: `테스트 비디오 - ${query}`,
            description: '개발용 테스트 비디오입니다. YouTube API 키를 설정하면 실제 검색 결과가 표시됩니다.',
            thumbnail: 'https://img.youtube.com/vi/dQw4w9WgXcQ/maxresdefault.jpg',
            channelId: 'UCuAXFkgsw1L7xaCfnd5JJOw',
            channelTitle: '테스트 채널',
            publishedAt: new Date().toISOString(),
            duration: 'PT3M33S',
            viewCount: '1000000',
            likeCount: '10000',
            tags: ['test', 'demo']
          },
          {
            id: 'ScMzIvxBSi4',
            title: `샘플 영상 - ${query}`,
            description: 'YouTube API 연동을 위한 샘플 영상입니다.',
            thumbnail: 'https://img.youtube.com/vi/ScMzIvxBSi4/maxresdefault.jpg',
            channelId: 'UCuAXFkgsw1L7xaCfnd5JJOw',
            channelTitle: '샘플 채널',
            publishedAt: new Date(Date.now() - 86400000).toISOString(),
            duration: 'PT5M20S',
            viewCount: '500000',
            likeCount: '5000',
            tags: ['sample', 'youtube']
          }
        ],
        pagination: {
          page: 1,
          pageSize: 2,
          totalItems: 2,
          totalPages: 1,
          hasNext: false,
          hasPrevious: false
        }
      };
      
      return NextResponse.json({
        success: true,
        data: mockResults,
        apiKeyStatus: 'missing',
        mockData: true
      });
    }
    
    // 실제 YouTube API 사용 (서버에서 직접 호출)
    const response = await fetch(`https://www.googleapis.com/youtube/v3/search?` + 
      `part=snippet&q=${encodeURIComponent(query)}&type=video&maxResults=20&key=${process.env.NEXT_PUBLIC_YOUTUBE_API_KEY}`
    );
    
    if (!response.ok) {
      throw new Error(`YouTube API error: ${response.status}`);
    }
    
    const data = await response.json();
    
    // 응답 데이터를 우리 형식으로 변환
    const searchResult = {
      items: data.items.map((item: any) => ({
        id: item.id.videoId,
        title: item.snippet.title,
        description: item.snippet.description,
        thumbnail: item.snippet.thumbnails.medium?.url || item.snippet.thumbnails.default?.url,
        channelId: item.snippet.channelId,
        channelTitle: item.snippet.channelTitle,
        publishedAt: item.snippet.publishedAt,
        duration: 'PT0S', // 검색 API에서는 duration이 포함되지 않음
        viewCount: '0',
        likeCount: '0',
        tags: []
      })),
      pagination: {
        page: 1,
        pageSize: data.items.length,
        totalItems: data.pageInfo?.totalResults || data.items.length,
        totalPages: 1,
        hasNext: !!data.nextPageToken,
        hasPrevious: false
      }
    };
    
    return NextResponse.json({
      success: true,
      data: searchResult,
      apiKeyStatus: 'configured'
    });
    
  } catch (error) {
    console.error('YouTube search API error:', error);
    
    return NextResponse.json(
      { 
        error: 'YouTube search failed',
        details: error instanceof Error ? error.message : 'Unknown error',
        apiKeyStatus: process.env.NEXT_PUBLIC_YOUTUBE_API_KEY ? 'configured' : 'missing'
      },
      { status: 500 }
    );
  }
}
