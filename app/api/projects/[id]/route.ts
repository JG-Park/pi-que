import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { QueueItem, Segment } from "@/lib/supabase"

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const projectId = params.id
    const supabase = createServerClient()

    console.log("프로젝트 상세 조회:", projectId)

    // 프로젝트 조회 (공개 프로젝트는 누구나 조회 가능)
    const { data: project, error: projectError } = await supabase
      .from("projects")
      .select("*")
      .eq("id", projectId)
      .single()

    if (projectError || !project) {
      console.error("프로젝트 조회 오류:", projectError)
      return NextResponse.json({ success: false, error: "Project not found" }, { status: 404 })
    }

    console.log("프로젝트 조회 성공:", project.title)

    // 큐 아이템들 먼저 조회
    const { data: queueItems, error: queueError } = await supabase
      .from("queue_items")
      .select("*")
      .eq("project_id", projectId)
      .order("order_index", { ascending: true })

    if (queueError) {
      console.error("큐 조회 오류:", queueError)
    }

    // 큐 아이템의 세그먼트 ID 목록 추출
    const segmentIds = queueItems
      ?.filter((item: QueueItem) => item.segment_id)
      .map((item: QueueItem) => item.segment_id) || []

    // 세그먼트 조회 - 현재 비디오의 세그먼트와 큐에 있는 세그먼트 모두 조회
    let segments: Segment[] = []
    
    if (project.video_id) {
      // 현재 비디오의 세그먼트 조회
      const { data: videoSegments, error: videoSegmentsError } = await supabase
        .from("segments")
        .select("*")
        .eq("video_id", project.video_id)
        .order("created_at", { ascending: true })
      
      if (videoSegmentsError) {
        console.error("비디오 세그먼트 조회 오류:", videoSegmentsError)
      } else {
        segments = videoSegments || []
      }
    }

    // 큐 아이템의 세그먼트가 있고, 아직 로드되지 않은 경우 추가 조회
    if (segmentIds.length > 0) {
      const { data: queueSegments, error: queueSegmentsError } = await supabase
        .from("segments")
        .select("*")
        .in("id", segmentIds)
      
      if (queueSegmentsError) {
        console.error("큐 세그먼트 조회 오류:", queueSegmentsError)
      } else if (queueSegments) {
        // 중복 제거를 위해 Map 사용
        const segmentMap = new Map<string, Segment>()
        
        // 기존 세그먼트 추가
        segments.forEach((segment: Segment) => {
          segmentMap.set(segment.id, segment)
        })
        
        // 큐 세그먼트 추가
        queueSegments.forEach((segment: Segment) => {
          if (!segmentMap.has(segment.id)) {
            segmentMap.set(segment.id, segment)
          }
        })
        
        // Map에서 배열로 변환
        segments = Array.from(segmentMap.values())
      }
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
        videoId: segment.video_id,
        title: segment.title,
        description: segment.description,
        startTime: segment.start_time,
        endTime: segment.end_time,
        videoTitle: segment.video_title,
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
                videoId: segment.video_id,
                title: segment.title,
                description: segment.description,
                startTime: segment.start_time,
                endTime: segment.end_time,
                videoTitle: segment.video_title,
              }
            : undefined,
          description: item.description_text,
        }
      }) || []

    const formattedProject = {
      id: project.id,
      title: project.title,
      videoUrl: project.video_url,
      videoId: project.video_id,
      videoTitle: project.video_title,
      videoDuration: project.video_duration,
      segments: formattedSegments,
      queue: formattedQueue,
      createdAt: project.created_at,
      updatedAt: project.updated_at,
    }

    console.log("프로젝트 데이터 변환 완료")

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
