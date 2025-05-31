import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { visibility } = await request.json()
    const projectId = params.id
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

    console.log("공개범위 업데이트 - 사용자:", user.email, "프로젝트:", projectId, "공개범위:", visibility)

    // 프로젝트 소유자 확인 및 공개범위 업데이트 (RLS 정책에 의해 자동 확인)
    const { data: project, error } = await supabase
      .from("projects")
      .update({ visibility })
      .eq("id", projectId)
      .eq("owner_id", userId)
      .select()
      .single()

    if (error) {
      console.error("공개범위 업데이트 오류:", error)
      return NextResponse.json(
        {
          success: false,
          error: "Failed to update visibility",
          details: error.message,
        },
        { status: 500 },
      )
    }

    if (!project) {
      return NextResponse.json({ success: false, error: "Project not found or access denied" }, { status: 404 })
    }

    console.log("공개범위 업데이트 성공")

    return NextResponse.json({ success: true, project })
  } catch (error) {
    console.error("공개범위 업데이트 전체 오류:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Failed to update visibility",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
