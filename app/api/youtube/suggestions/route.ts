import { type NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const query = searchParams.get("q")

    if (!query || query.length < 2) {
      return NextResponse.json({ success: true, suggestions: [] })
    }

    const apiKey = process.env.YOUTUBE_API_KEY
    if (!apiKey) {
      return NextResponse.json({ success: false, error: "YouTube API key not configured" }, { status: 500 })
    }

    // YouTube 검색 제안 API 호출
    const response = await fetch(
      `https://suggestqueries.google.com/complete/search?client=youtube&ds=yt&q=${encodeURIComponent(query)}&callback=?`,
    )

    if (!response.ok) {
      throw new Error(`Suggestion API error: ${response.status}`)
    }

    const text = await response.text()
    // JSONP 응답을 파싱
    const jsonMatch = text.match(/\?$$(.*)$$/)
    if (!jsonMatch) {
      return NextResponse.json({ success: true, suggestions: [] })
    }

    const data = JSON.parse(jsonMatch[1])
    const suggestions = data[1]?.slice(0, 8).map((item: any) => item[0]) || []

    return NextResponse.json({ success: true, suggestions })
  } catch (error) {
    console.error("Suggestion error:", error)

    // 기본 제안어 반환
    const query = new URL(request.url).searchParams.get("q")?.toLowerCase() || ""
    const defaultSuggestions = ["music", "tutorial", "review", "gameplay", "news", "comedy", "education", "technology"]
      .filter((s) => s.includes(query))
      .slice(0, 5)

    return NextResponse.json({ success: true, suggestions: defaultSuggestions })
  }
}
