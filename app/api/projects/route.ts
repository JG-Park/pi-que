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
    const projectId = generateId()

    console.log("프로젝트 생성 시작 - 사용자:", user.email, "ID:", userId)

    // 프로젝트 생성
    const projectData = {
      id: projectId,
      title: data.title || data.videoTitle || "제목 없음",
      description: data.description || null,
      video_url: data.videoUrl || null,
      video_id: data.videoId || null,
      video_title: data.videoTitle || null,
      video_duration: data.videoDuration || 0,
      visibility: "public",
      owner_id: userId,
    }

    console.log("프로젝트 데이터:", projectData)

    const { data: project, error: projectError } = await supabase.from("projects").insert(projectData).select().single()

    if (projectError) {
      console.error("프로젝트 생성 오류:", projectError)
      return NextResponse.json(
        {
          success: false,
          error: "Failed to create project",
          details: projectError.message,
        },
        { status: 500 },
      )
    }

    console.log("프로젝트 생성 성공:", project.id)

    // 구간들 저장
    if (data.segments && data.segments.length > 0) {
      const segmentsToInsert = data.segments.map((segment: any) => ({
        id: segment.id,
        title: segment.title,
        description: segment.description || null,
        video_id: segment.videoId,
        video_title: segment.videoTitle || null,
        start_time: segment.startTime,
        end_time: segment.endTime,
        owner_id: userId,
      }))

      console.log("구간 저장 시도:", segmentsToInsert.length, "개")

      const { error: segmentsError } = await supabase.from("segments").insert(segmentsToInsert)

      if (segmentsError) {
        console.error("구간 저장 오류:", segmentsError)
      } else {
        console.log("구간 저장 성공")
      }
    }

    // 큐 아이템들 저장
    if (data.queue && data.queue.length > 0) {
      const queueItemsToInsert = data.queue.map((item: any, index: number) => ({
        project_id: projectId,
        item_type: item.type,
        segment_id: item.segment?.id || null,
        description_text: item.description || null,
        order_index: index,
      }))

      console.log("큐 아이템 저장 시도:", queueItemsToInsert.length, "개")

      const { error: queueError } = await supabase.from("queue_items").insert(queueItemsToInsert)

      if (queueError) {
        console.error("큐 저장 오류:", queueError)
      } else {
        console.log("큐 저장 성공")
      }
    }

    return NextResponse.json({ success: true, projectId, project })
  } catch (error) {
    console.error("프로젝트 저장 전체 오류:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Failed to save project",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const data = await request.json()
    const { projectId, ...updateData } = data
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

    console.log("프로젝트 업데이트 시작 - 사용자:", user.email, "프로젝트:", projectId)

    // 프로젝트 소유자 확인 및 업데이트
    const { data: project, error: projectError } = await supabase
      .from("projects")
      .update({
        title: updateData.title,
        description: updateData.description || null,
        video_url: updateData.videoUrl || null,
        video_id: updateData.videoId || null,
        video_title: updateData.videoTitle || null,
        video_duration: updateData.videoDuration || 0,
      })
      .eq("id", projectId)
      .eq("owner_id", userId)
      .select()
      .single()

    if (projectError) {
      console.error("프로젝트 업데이트 오류:", projectError)
      return NextResponse.json(
        {
          success: false,
          error: "Failed to update project",
          details: projectError.message,
        },
        { status: 500 },
      )
    }

    if (!project) {
      return NextResponse.json({ success: false, error: "Project not found or access denied" }, { status: 404 })
    }

    console.log("프로젝트 업데이트 성공")

    // 기존 구간들과 큐 아이템들 삭제
    await supabase
      .from("segments")
      .delete()
      .eq("owner_id", userId)
      .eq("video_id", updateData.videoId || "")
    await supabase.from("queue_items").delete().eq("project_id", projectId)

    // 새 구간들 저장
    if (updateData.segments && updateData.segments.length > 0) {
      const segmentsToInsert = updateData.segments.map((segment: any) => ({
        id: segment.id,
        title: segment.title,
        description: segment.description || null,
        video_id: segment.videoId,
        video_title: segment.videoTitle || null,
        start_time: segment.startTime,
        end_time: segment.endTime,
        owner_id: userId,
      }))

      const { error: segmentsError } = await supabase.from("segments").insert(segmentsToInsert)
      if (segmentsError) {
        console.error("구간 업데이트 오류:", segmentsError)
      }
    }

    // 새 큐 아이템들 저장
    if (updateData.queue && updateData.queue.length > 0) {
      const queueItemsToInsert = updateData.queue.map((item: any, index: number) => ({
        project_id: projectId,
        item_type: item.type,
        segment_id: item.segment?.id || null,
        description_text: item.description || null,
        order_index: index,
      }))

      const { error: queueError } = await supabase.from("queue_items").insert(queueItemsToInsert)
      if (queueError) {
        console.error("큐 업데이트 오류:", queueError)
      }
    }

    return NextResponse.json({ success: true, project })
  } catch (error) {
    console.error("프로젝트 업데이트 전체 오류:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Failed to update project",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
