import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { generateId } from "@/lib/utils"

// 기본 프로젝트 이름 생성 함수
async function generateDefaultProjectName(supabase: any, userId: string): Promise<string> {
  // 사용자의 기존 프로젝트 수 조회
  const { data: projects, error } = await supabase
    .from("projects")
    .select("title")
    .eq("owner_id", userId)
    .ilike("title", "이름 없는 프로젝트%")
    .order("created_at", { ascending: false })

  if (error) {
    console.error("프로젝트 수 조회 오류:", error)
    return "이름 없는 프로젝트(1)"
  }

  // 기존 프로젝트 이름에서 번호 추출
  const existingNumbers = projects
    .map((project: any) => {
      const match = project.title.match(/이름 없는 프로젝트$$(\d+)$$/)
      return match ? Number.parseInt(match[1]) : 0
    })
    .filter((num: number) => num > 0)

  // 다음 번호 계산
  const nextNumber = existingNumbers.length > 0 ? Math.max(...existingNumbers) + 1 : 1

  return `이름 없는 프로젝트(${nextNumber})`
}

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

    // 기본 프로젝트 이름 생성
    const defaultTitle = await generateDefaultProjectName(supabase, userId)

    // 프로젝트 생성
    const projectData = {
      id: projectId,
      title: data.title || defaultTitle,
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
