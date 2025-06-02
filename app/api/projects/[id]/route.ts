import { type NextRequest, NextResponse } from "next/server"
import { createServerClient, type Segment, type QueueItem } from "@/lib/supabase"

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const projectId = params.id
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
