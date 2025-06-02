import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"

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

    console.log("큐 아이템 생성 시작 - 프로젝트:", data.projectId)

    // 큐 아이템 생성
    const queueData = {
      project_id: data.projectId,
      item_type: data.type,
      segment_id: data.segmentId || null,
      description_text: data.description || null,
      order_index: data.orderIndex,
    }

    console.log("큐 데이터:", queueData)

    const { data: queueItem, error: queueError } = await supabase
      .from("queue_items")
      .insert(queueData)
      .select()
      .single()

    if (queueError) {
      console.error("큐 아이템 생성 오류:", queueError)
      return NextResponse.json(
        {
          success: false,
          error: "Failed to create queue item",
          details: queueError.message,
        },
        { status: 500 },
      )
    }

    console.log("큐 아이템 생성 성공:", queueItem.id)

    return NextResponse.json({ success: true, queueItem })
  } catch (error) {
    console.error("큐 아이템 생성 전체 오류:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Failed to create queue item",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const queueItemId = searchParams.get("id")

    if (!queueItemId) {
      return NextResponse.json({ success: false, error: "Queue item ID is required" }, { status: 400 })
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

    console.log("큐 아이템 삭제 시작 - 아이템:", queueItemId)

    // 큐 아이템 삭제
    const { error: queueError } = await supabase.from("queue_items").delete().eq("id", queueItemId)

    if (queueError) {
      console.error("큐 아이템 삭제 오류:", queueError)
      return NextResponse.json(
        {
          success: false,
          error: "Failed to delete queue item",
          details: queueError.message,
        },
        { status: 500 },
      )
    }

    console.log("큐 아이템 삭제 성공")

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("큐 아이템 삭제 전체 오류:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Failed to delete queue item",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
