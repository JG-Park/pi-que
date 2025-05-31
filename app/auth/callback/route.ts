import { type NextRequest, NextResponse } from "next/server"
import { getSupabaseClient } from "@/lib/supabase"

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get("code")

  if (code) {
    const supabase = getSupabaseClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (error) {
      console.error("인증 콜백 오류:", error)
      return NextResponse.redirect(`${requestUrl.origin}?error=auth_error`)
    }
  }

  // 성공적으로 로그인되면 메인 페이지로 리다이렉트
  return NextResponse.redirect(requestUrl.origin)
}
