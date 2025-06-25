"use client"

import type React from "react"
import { createContext, useContext, useEffect, useState } from "react"
import { getSupabaseClient } from "@/lib/supabase"
import type { User, Session } from "@supabase/supabase-js"
import { AuthenticationError, ExternalServiceError } from "@/utils/common/errors"
import { logInfo, logError, trackEvent } from "@/utils/common/logger"

interface AuthContextType {
  user: User | null
  session: Session | null
  loading: boolean
  signInWithGoogle: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const supabase = getSupabaseClient()

  useEffect(() => {
    const initializeAuth = async () => {
      try {
        // 현재 세션 확인
        const { data: { session }, error } = await supabase.auth.getSession()
        
        if (error) {
          logError('Auth 세션 초기화 실패', { component: 'AuthProvider' }, 
            new ExternalServiceError('Supabase 세션 조회 실패', 'supabase', 'getSession', error)
          )
        } else {
          setSession(session)
          setUser(session?.user ?? null)
          
          if (session?.user) {
            logInfo('사용자 세션 복원됨', {
              component: 'AuthProvider',
              userId: session.user.id,
              provider: session.user.app_metadata.provider
            })
            
            trackEvent('user_session_restored', {
              userId: session.user.id,
              provider: session.user.app_metadata.provider
            })
          }
        }
      } catch (error) {
        logError('Auth 초기화 중 예상치 못한 오류', { component: 'AuthProvider' }, error as Error)
      } finally {
        setLoading(false)
      }
    }

    initializeAuth()

    // 인증 상태 변경 리스너
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      try {
        setSession(session)
        setUser(session?.user ?? null)
        setLoading(false)

        // 인증 상태 변경 로깅
        logInfo(`Auth 상태 변경: ${event}`, {
          component: 'AuthProvider',
          event,
          userId: session?.user?.id,
          provider: session?.user?.app_metadata?.provider
        })

        // 이벤트별 트래킹
        switch (event) {
          case 'SIGNED_IN':
            trackEvent('user_signed_in', {
              userId: session?.user?.id,
              provider: session?.user?.app_metadata?.provider,
              method: 'oauth'
            })
            break
          case 'SIGNED_OUT':
            trackEvent('user_signed_out', { method: 'manual' })
            break
          case 'TOKEN_REFRESHED':
            trackEvent('token_refreshed', { userId: session?.user?.id })
            break
        }
      } catch (error) {
        logError('Auth 상태 변경 처리 중 오류', { 
          component: 'AuthProvider', 
          event 
        }, error as Error)
      }
    })

    return () => subscription.unsubscribe()
  }, [supabase.auth])

  const signInWithGoogle = async () => {
    try {
      logInfo('Google 로그인 시도', { component: 'AuthProvider', provider: 'google' })
      
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      })
      
      if (error) {
        const authError = new AuthenticationError(
          `Google 로그인 실패: ${error.message}`,
          'google',
          undefined,
          { originalError: error }
        )
        
        logError('Google 로그인 실패', { 
          component: 'AuthProvider',
          provider: 'google',
          errorCode: error.message
        }, authError)
        
        trackEvent('auth_signin_failed', {
          provider: 'google',
          errorMessage: error.message
        })
        
        throw authError
      }
      
      trackEvent('auth_signin_initiated', { provider: 'google' })
    } catch (error) {
      if (error instanceof AuthenticationError) {
        throw error
      }
      
      const authError = new AuthenticationError(
        'Google 로그인 중 예상치 못한 오류가 발생했습니다',
        'google',
        undefined,
        { originalError: error }
      )
      
      logError('Google 로그인 중 예상치 못한 오류', { 
        component: 'AuthProvider' 
      }, authError)
      
      throw authError
    }
  }

  const signOut = async () => {
    try {
      const currentUserId = user?.id
      
      logInfo('로그아웃 시도', { 
        component: 'AuthProvider',
        userId: currentUserId
      })
      
      const { error } = await supabase.auth.signOut()
      
      if (error) {
        const authError = new ExternalServiceError(
          `로그아웃 실패: ${error.message}`,
          'supabase',
          'signOut',
          error
        )
        
        logError('로그아웃 실패', { 
          component: 'AuthProvider',
          userId: currentUserId,
          errorCode: error.message
        }, authError)
        
        trackEvent('auth_signout_failed', {
          userId: currentUserId,
          errorMessage: error.message
        })
        
        throw authError
      }
      
      trackEvent('auth_signout_success', { userId: currentUserId })
    } catch (error) {
      if (error instanceof ExternalServiceError) {
        throw error
      }
      
      const authError = new ExternalServiceError(
        '로그아웃 중 예상치 못한 오류가 발생했습니다',
        'supabase',
        'signOut',
        error
      )
      
      logError('로그아웃 중 예상치 못한 오류', { 
        component: 'AuthProvider' 
      }, authError)
      
      throw authError
    }
  }

  return (
    <AuthContext.Provider value={{ user, session, loading, signInWithGoogle, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    const configError = new Error("useAuth must be used within an AuthProvider")
    logError('useAuth 훅 잘못된 사용', { 
      component: 'useAuth',
      error: 'AuthProvider 외부에서 호출됨'
    }, configError)
    throw configError
  }
  return context
}
