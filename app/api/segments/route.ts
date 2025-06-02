import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { generateId } from "@/lib/utils"

export async function POST(request: NextRequest) {
  try {
    const data = await request.json()
    const supabase = createServerClient()

    // 사용자 인증 확인
    const authHeader = request.headers.get("authorization")
    if (!authHeader) {
      return NextResponse.json({ success: false, error: "Authentication required" }, { status: 401 })
    }

    const token = authHeader.replace("Bearer ", "")
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token)

    if (authError || !user) {
      console.error("인증 오류:", authError)
      return NextResponse.json({ success: false, error: "Authentication failed" }, { status: 401 })
    }

    const userId = user.id

    console.log("구간 생성 시작 - 사용자:", user.email)

    // 구간 생성
    const segmentData = {
      id: data.id || generateId(),
      title: data.title,
      description: data.description || null,
      video_id: data.videoId,
      video_title: data.videoTitle || null,
      start_time: data.startTime,
      end_time: data.endTime,
      owner_id: userId,
    }

    console.log("구간 데이터:", segmentData)

    const { data: segment, error: segmentError } = await supabase.from("segments").insert(segmentData).select().single()

    if (segmentError) {
      console.error("구간 생성 오류:", segmentError)
      return NextResponse.json(
        {
          success: false,
          error: "Failed to create segment",
          details: segmentError.message,
        },
        { status: 500 },
      )
    }

    console.log("구간 생성 성공:", segment.id)

    return NextResponse.json({ success: true, segment })
  } catch (error) {
    console.error("구간 생성 전체 오류:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Failed to create segment",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const data = await request.json()
    const supabase = createServerClient()

    // 사용자 인증 확인
    const authHeader = request.headers.get("authorization")
    if (!authHeader) {
      return NextResponse.json({ success: false, error: "Authentication required" }, { status: 401 })
    }

    const token = authHeader.replace("Bearer ", "")
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token)

    if (authError || !user) {
      console.error("인증 오류:", authError)
      return NextResponse.json({ success: false, error: "Authentication failed" }, { status: 401 })
    }

    const userId = user.id

    console.log("구간 수정 시작 - 사용자:", user.email, "구간:", data.id)

    // 구간 수정 (소유자 확인 포함)
    const { data: segment, error: segmentError } = await supabase
      .from("segments")
      .update({
        title: data.title,
        description: data.description || null,
        start_time: data.startTime,
        end_time: data.endTime,
      })
      .eq("id", data.id)
      .eq("owner_id", userId)
      .select()
      .single()

    if (segmentError) {
      console.error("구간 수정 오류:", segmentError)
      return NextResponse.json(
        {
          success: false,
          error: "Failed to update segment",
          details: segmentError.message,
        },
        { status: 500 },
      )
    }

    if (!segment) {
      return NextResponse.json({ success: false, error: "Segment not found or access denied" }, { status: 404 })
    }

    console.log("구간 수정 성공")

    return NextResponse.json({ success: true, segment })
  } catch (error) {
    console.error("구간 수정 전체 오류:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Failed to update segment",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const segmentId = searchParams.get("id")

    if (!segmentId) {
      return NextResponse.json({ success: false, error: "Segment ID is required" }, { status: 400 })
    }

    const supabase = createServerClient()

    // 사용자 인증 확인
    const authHeader = request.headers.get("authorization")
    if (!authHeader) {
      return NextResponse.json({ success: false, error: "Authentication required" }, { status: 401 })
    }

    const token = authHeader.replace("Bearer ", "")
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token)

    if (authError || !user) {
      console.error("인증 오류:", authError)
      return NextResponse.json({ success: false, error: "Authentication failed" }, { status: 401 })
    }

    const userId = user.id

    console.log("구간 삭제 시작 - 사용자:", user.email, "구간:", segmentId)

    // 구간 삭제 (소유자 확인 포함)
    const { error: segmentError } = await supabase.from("segments").delete().eq("id", segmentId).eq("owner_id", userId)

    if (segmentError) {
      console.error("구간 삭제 오류:", segmentError)
      return NextResponse.json(
        {
          success: false,
          error: "Failed to delete segment",
          details: segmentError.message,
        },
        { status: 500 },
      )
    }

    console.log("구간 삭제 성공")

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("구간 삭제 전체 오류:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Failed to delete segment",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
