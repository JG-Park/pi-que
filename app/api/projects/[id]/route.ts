import { type NextRequest, NextResponse } from "next/server"
import { createServerClient, type Segment, type QueueItem } from "@/lib/supabase"

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: projectId } = await params
    const supabase = createServerClient()

    console.log("프로젝트 상세 조회:", projectId)

    // 프로젝트 조회
    const { data: project, error: projectError } = await supabase
      .from("projects")
      .select("*")
      .eq("id", projectId)
      .single()

    if (projectError || !project) {
      console.error("프로젝트 조회 오류:", projectError)
      return NextResponse.json({ success: false, error: "Project not found" }, { status: 404 })
    }

    console.log("프로젝트 조회 성공:", project.title, "소유자:", project.owner_id, "공개범위:", project.visibility)

    // 해당 프로젝트의 구간들 조회 (순서대로)
    const { data: segments, error: segmentsError } = await supabase
      .from("segments")
      .select("*")
      .eq("project_id", projectId)
      .order("order_index", { ascending: true })

    if (segmentsError) {
      console.error("구간 조회 오류:", segmentsError)
    }

    // 해당 프로젝트의 큐 아이템들 조회 (순서대로)
    const { data: queueItems, error: queueError } = await supabase
      .from("queue_items")
      .select("*")
      .eq("project_id", projectId)
      .order("order_index", { ascending: true })

    if (queueError) {
      console.error("큐 조회 오류:", queueError)
    }

    // 구간 ID로 구간 정보 매핑
    const segmentMap = new Map<string, Segment>()
    if (segments) {
      segments.forEach((segment: Segment) => {
        segmentMap.set(segment.id, segment)
      })
    }

    // 데이터 변환
    const formattedSegments =
      segments?.map((segment: Segment) => ({
        id: segment.id,
        title: segment.title,
        description: segment.description || "",
        videoId: segment.video_id,
        videoTitle: segment.video_title,
        startTime: segment.start_time,
        endTime: segment.end_time,
        orderIndex: segment.order_index,
      })) || []

    const formattedQueue =
      queueItems?.map((item: QueueItem) => {
        const segment = item.segment_id ? segmentMap.get(item.segment_id) : null
        return {
          id: item.id.toString(),
          type: item.item_type,
          segment: segment
            ? {
                id: segment.id,
                title: segment.title,
                description: segment.description || "",
                videoId: segment.video_id,
                videoTitle: segment.video_title,
                startTime: segment.start_time,
                endTime: segment.end_time,
                orderIndex: segment.order_index,
              }
            : undefined,
          description: item.description_text || "",
          orderIndex: item.order_index,
        }
      }) || []

    const formattedProject = {
      id: project.id,
      title: project.title,
      description: project.description,
      visibility: project.visibility,
      owner_id: project.owner_id, // 소유자 ID 포함
      segments: formattedSegments,
      queue: formattedQueue,
      createdAt: project.created_at,
      updatedAt: project.updated_at,
    }

    console.log("프로젝트 데이터 변환 완료 - 세그먼트:", formattedSegments.length, "큐:", formattedQueue.length)

    return NextResponse.json({ success: true, project: formattedProject })
  } catch (error) {
    console.error("프로젝트 로드 전체 오류:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Failed to load project",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: projectId } = await params
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

    console.log("프로젝트 삭제 시작 - 사용자:", user.email, "프로젝트:", projectId)

    // 프로젝트 소유자 확인
    const { data: project, error: checkError } = await supabase
      .from("projects")
      .select("id, title, owner_id")
      .eq("id", projectId)
      .eq("owner_id", userId)
      .single()

    if (checkError || !project) {
      console.error("프로젝트 소유자 확인 오류:", checkError)
      return NextResponse.json({ success: false, error: "Project not found or access denied" }, { status: 404 })
    }

    // 먼저 관련된 큐 아이템들 삭제
    const { error: queueError } = await supabase
      .from("queue_items")
      .delete()
      .eq("project_id", projectId)

    if (queueError) {
      console.error("큐 아이템 삭제 오류:", queueError)
    }

    // 관련된 구간들 삭제
    const { error: segmentError } = await supabase
      .from("segments")
      .delete()
      .eq("project_id", projectId)

    if (segmentError) {
      console.error("구간 삭제 오류:", segmentError)
    }

    // 마지막으로 프로젝트 삭제
    const { error: deleteError } = await supabase
      .from("projects")
      .delete()
      .eq("id", projectId)
      .eq("owner_id", userId)

    if (deleteError) {
      console.error("프로젝트 삭제 오류:", deleteError)
      return NextResponse.json(
        {
          success: false,
          error: "Failed to delete project",
          details: deleteError.message,
        },
        { status: 500 },
      )
    }

    console.log("프로젝트 삭제 성공:", project.title)

    return NextResponse.json({ success: true, message: "Project deleted successfully" })
  } catch (error) {
    console.error("프로젝트 삭제 전체 오류:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Failed to delete project",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
