import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"

export async function GET(request: NextRequest) {
  try {
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

    console.log("사용자 프로젝트 조회 - 사용자:", user.email, "ID:", userId)

    // 사용자의 프로젝트들 조회 (RLS 정책에 의해 자동 필터링)
    const { data: projects, error } = await supabase
      .from("projects")
      .select("*")
      .eq("owner_id", userId)
      .order("updated_at", { ascending: false })

    if (error) {
      console.error("프로젝트 목록 조회 오류:", error)
      return NextResponse.json(
        {
          success: false,
          error: "Failed to fetch projects",
          details: error.message,
        },
        { status: 500 },
      )
    }

    console.log("프로젝트 조회 성공:", projects?.length || 0, "개")

    return NextResponse.json({ success: true, projects: projects || [] })
  } catch (error) {
    console.error("프로젝트 목록 조회 전체 오류:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch projects",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
