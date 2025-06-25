'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { ThemeProvider } from '@/components/theme-provider';
import { AuthProvider } from '@/contexts/auth-context';
import { StateProviders } from '@/contexts/providers';
import { Toaster } from '@/components/ui/toaster';
import ErrorBoundaryWrapper from '@/components/error/ErrorBoundaryWrapper';
import ErrorFallback from '@/components/error/ErrorFallback';
import { logError, trackEvent } from '@/utils/common/logger';
import { useState } from 'react';

// React Query 설정
const createQueryClient = () => new QueryClient({
  defaultOptions: {
    queries: {
      // 5분간 캐시 유지
      staleTime: 5 * 60 * 1000,
      // 데이터가 stale해도 백그라운드에서 refetch
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
      // 3번 재시도
      retry: 3,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    },
    mutations: {
      // 뮤테이션 실패시 1번 재시도
      retry: 1,
    },
  },
});

// 글로벌 에러 핸들링 함수
const handleGlobalError = (error: Error, errorInfo: React.ErrorInfo) => {
  // 로거를 통해 에러 로깅
  logError('Global Error Boundary 에러 포착', {
    component: 'GlobalErrorBoundary',
    errorInfo: errorInfo.componentStack,
    url: typeof window !== 'undefined' ? window.location.href : undefined
  }, error);

  // 이벤트 트래킹
  trackEvent('global_error_boundary_triggered', {
    errorType: error.constructor.name,
    errorMessage: error.message,
    url: typeof window !== 'undefined' ? window.location.href : undefined
  });
};

// 에러 리포팅 함수
const handleErrorReport = async (error: Error) => {
  try {
    logError('사용자가 에러를 신고했습니다', {
      component: 'ErrorFallback',
      reportedBy: 'user'
    }, error);

    trackEvent('user_reported_error', {
      errorType: error.constructor.name,
      errorMessage: error.message
    });

    // TODO: 실제 에러 리포팅 서비스 연동 (예: Sentry, 백엔드 API 등)
    return Promise.resolve();
  } catch (reportError) {
    console.error('Error reporting failed:', reportError);
    throw reportError;
  }
};

export function Providers({ children }: { children: React.ReactNode }) {
  // 클라이언트 사이드에서만 QueryClient 생성
  const [queryClient] = useState(() => createQueryClient());

  return (
    <ErrorBoundaryWrapper
      fallback={({ error, resetErrorBoundary }) => (
        <ErrorFallback
          error={error}
          resetErrorBoundary={resetErrorBoundary}
          showDetails={process.env.NODE_ENV === 'development'}
          onReport={handleErrorReport}
          severity="critical"
        />
      )}
      onError={handleGlobalError}
      resetOnPropsChange={true}
    >
      <QueryClientProvider client={queryClient}>
                  <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            <AuthProvider>
              <StateProviders>
                {children}
                <Toaster />
              </StateProviders>
            </AuthProvider>
          </ThemeProvider>
        {/* 개발 환경에서만 DevTools 표시 */}
        {process.env.NODE_ENV === 'development' && (
          <ReactQueryDevtools 
            initialIsOpen={false}
          />
        )}
      </QueryClientProvider>
    </ErrorBoundaryWrapper>
  );
} 