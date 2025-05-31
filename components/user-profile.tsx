"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useAuth } from "@/contexts/auth-context"
import { LogIn, LogOut, Settings, FolderOpen, Loader2 } from "lucide-react"
import { toast } from "@/hooks/use-toast"
import Link from "next/link"

export function UserProfile() {
  const { user, loading, signInWithGoogle, signOut } = useAuth()
  const [isSigningIn, setIsSigningIn] = useState(false)
  const [showLoginDialog, setShowLoginDialog] = useState(false)

  const handleSignIn = async () => {
    setIsSigningIn(true)
    try {
      await signInWithGoogle()
      setShowLoginDialog(false)
      toast({
        title: "로그인 성공",
        description: "구글 계정으로 로그인되었습니다.",
      })
    } catch (error) {
      toast({
        title: "로그인 실패",
        description: "로그인 중 오류가 발생했습니다.",
        variant: "destructive",
      })
    } finally {
      setIsSigningIn(false)
    }
  }

  const handleSignOut = async () => {
    try {
      await signOut()
      toast({
        title: "로그아웃",
        description: "성공적으로 로그아웃되었습니다.",
      })
    } catch (error) {
      toast({
        title: "로그아웃 실패",
        description: "로그아웃 중 오류가 발생했습니다.",
        variant: "destructive",
      })
    }
  }

  if (loading) {
    return (
      <Button variant="ghost" size="icon" disabled>
        <Loader2 className="w-4 h-4 animate-spin" />
      </Button>
    )
  }

  if (!user) {
    return (
      <>
        <Button onClick={() => setShowLoginDialog(true)} variant="outline">
          <LogIn className="w-4 h-4 mr-2" />
          로그인
        </Button>

        <Dialog open={showLoginDialog} onOpenChange={setShowLoginDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>로그인</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <p className="text-sm text-muted-foreground">구글 계정으로 로그인하여 프로젝트를 저장하고 관리하세요.</p>
              <Button onClick={handleSignIn} disabled={isSigningIn} className="w-full" size="lg">
                {isSigningIn ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <LogIn className="w-4 h-4 mr-2" />}
                구글로 로그인
              </Button>
              <p className="text-xs text-muted-foreground text-center">
                로그인하지 않아도 앱을 사용할 수 있지만, 프로젝트가 저장되지 않습니다.
              </p>
            </div>
          </DialogContent>
        </Dialog>
      </>
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-10 w-10 rounded-full">
          <Avatar className="h-10 w-10">
            <AvatarImage
              src={user.user_metadata?.avatar_url || "/placeholder.svg"}
              alt={user.user_metadata?.name || user.email}
            />
            <AvatarFallback>{user.user_metadata?.name?.[0] || user.email?.[0] || "U"}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end" forceMount>
        <div className="flex items-center justify-start gap-2 p-2">
          <div className="flex flex-col space-y-1 leading-none">
            {user.user_metadata?.name && <p className="font-medium">{user.user_metadata.name}</p>}
            <p className="w-[200px] truncate text-sm text-muted-foreground">{user.email}</p>
          </div>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/mypage">
            <FolderOpen className="mr-2 h-4 w-4" />내 프로젝트
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem disabled>
          <Settings className="mr-2 h-4 w-4" />
          설정
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleSignOut}>
          <LogOut className="mr-2 h-4 w-4" />
          로그아웃
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
