'use client';

import React from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import { ErrorHandler } from '@/utils/common/error-handler';

interface ErrorBoundaryWrapperProps {
  children: React.ReactNode;
  fallback?: React.ComponentType<{ error: Error; resetErrorBoundary: () => void }>;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
  resetOnPropsChange?: boolean;
  isolate?: boolean;
}

// 기본 에러 폴백 컴포넌트
const DefaultErrorFallback: React.FC<{ error: Error; resetErrorBoundary: () => void }> = ({
  error,
  resetErrorBoundary
}) => {
  return (
    <div className="flex flex-col items-center justify-center min-h-[200px] p-8 bg-red-50 border border-red-200 rounded-lg">
      <div className="text-center max-w-md">
        <h2 className="text-lg font-semibold text-red-800 mb-2">
          문제가 발생했습니다
        </h2>
        <p className="text-sm text-red-600 mb-4">
          예상치 못한 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.
        </p>
        <details className="mb-4 text-left">
          <summary className="cursor-pointer text-sm text-red-700 hover:text-red-800">
            기술적 세부사항 보기
          </summary>
          <pre className="mt-2 p-2 bg-red-100 text-red-800 text-xs rounded border overflow-auto max-h-32">
            {error.message}
          </pre>
        </details>
        <button
          onClick={resetErrorBoundary}
          className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
        >
          다시 시도
        </button>
      </div>
    </div>
  );
};

const ErrorBoundaryWrapper: React.FC<ErrorBoundaryWrapperProps> = ({
  children,
  fallback: FallbackComponent = DefaultErrorFallback,
  onError,
  resetOnPropsChange = true,
  isolate = false
}) => {
  const handleError = (error: Error, errorInfo: React.ErrorInfo) => {
    // ErrorHandler를 사용해 에러를 로깅
    ErrorHandler.handle(error, {
      component: 'ErrorBoundary',
      errorInfo: errorInfo.componentStack,
      timestamp: new Date().toISOString()
    });

    // 사용자 정의 에러 핸들러 호출
    onError?.(error, errorInfo);
  };

  return (
    <ErrorBoundary
      FallbackComponent={FallbackComponent}
      onError={handleError}
      resetOnPropsChange={resetOnPropsChange}
      isolate={isolate}
    >
      {children}
    </ErrorBoundary>
  );
};

export default ErrorBoundaryWrapper;
export { DefaultErrorFallback }; 